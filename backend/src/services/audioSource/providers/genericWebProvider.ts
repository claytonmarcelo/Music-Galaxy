// Generic Web Provider — Descoberta global de áudio em sites abertos (Regra 3).
//
// Como a Regra 3 proíbe plataformas de música (YouTube, Spotify, Deezer, etc.),
// este provider é o responsável pela DESCOBERTA REAL: ele consulta mecanismos
// de busca públicos por "artista + título" em formatos de arquivo de áudio,
// visita as páginas de resultado (blogs, fóruns, sites pessoais) e extrai os
// links diretos de MP3/FLAC/etc. encontrados nelas.
//
// Segurança: toda URL visitada passa pelo guard anti-SSRF (auditarUrl) e pela
// lista negra de plataformas proibidas. Há limites de páginas, tempo e tamanho
// para manter o comportamento educado e previsível.

import { BaseAudioSourceProvider } from '../baseProvider';
import {
  AudioIdentity,
  SearchResult,
  AudioCandidate,
  ProviderTimeouts,
} from '../types';
import axios from 'axios';
import { execFile } from 'child_process';
import { promisify } from 'util';
import {
  USER_AGENT,
  auditarUrl,
  criarBeforeRedirect,
  dominioPlataformaProibida,
  extrairLinksDeAudio,
  interpretarNomeDeArquivo,
  NomeInterpretado,
} from '../webAudio';

// execFile com array de argumentos não passa por shell — elimina qualquer
// risco de injeção de comando no termo buscado pelo usuário.
const execFileAsync = promisify(execFile);

// O tsconfig do backend usa moduleResolution "node" (legado), que não enxerga
// os re-exports de TIPO do cheerio (ex.: CheerioAPI). Derivamos o tipo do
// próprio load() — mesma API, sem mudar configuração nem usar any.
type CheerioStatic = ReturnType<typeof import('cheerio').load>;

// Uma página candidata devolvida por um motor de busca.
interface ResultadoMotor {
  url: string;         // URL (pode ser relativa ou com redirect do motor)
  textoBloco: string;  // texto do bloco do resultado (título + snippet + citações)
}

interface MotorDeBusca {
  id: string;
  // Monta a URL de busca para a consulta
  montarUrl(consulta: string): string;
  // Domínio do próprio motor (para descartar links internos)
  dominio: string;
  // Quando true, o HTML é buscado via curl do sistema em vez do axios.
  // O Brave diferencia o cliente pelo fingerprint TLS: o axios (OpenSSL do
  // Node) recebe 429, enquanto o curl recebe 200 normal (verificado na prática).
  viaCurl?: boolean;
  // Extrai as páginas candidatas do HTML da página de resultados.
  // Cada motor tem markup próprio; a função devolve URL + texto do bloco,
  // que depois é filtrado pelas palavras obrigatórias (artista + título).
  extrair($: CheerioStatic): ResultadoMotor[];
}

// Motores de busca acessíveis sem chave de API.
//
// Sondagem real (curl, UA de navegador, 2026-10-22/23):
//   - Brave (search.brave.com): ÚNICO testado que respeita aspas e devolve
//     resultados orgânicos relevantes (mp3.pm, mdundo.com, archive.org para
//     "Daft Punk" "One More Time"). Responde 429 quando consultado repetidas
//     vezes — tratado com retry/backoff e intervalo entre consultas.
//   - Bing: IGNORA as aspas até com frases curtas — devolve lixo (OneDrive,
//     "ONE" transporte) → inútil para a regra de só visitar páginas com a
//     música. Removido.
//   - DuckDuckGo HTML: 0 resultados/desafio JS. Mojeek: 403. Yep/Ecosia: 403.
//     SearXNG públicas: 429 ou desafio Anubis. Yandex: redirect de bloqueio.
//
// A lista tem só o Brave; a arquitetura permite reativar outros motores
// quando surgir algum que respeite a busca por frase exata.
const MOTORES: MotorDeBusca[] = [
  {
    id: 'brave',
    montarUrl: (q) => `https://search.brave.com/search?q=${encodeURIComponent(q)}`,
    dominio: 'brave.com',
    viaCurl: true,
    // Brave: o título do resultado é um div.title.search-snippet-title dentro
    // do <a>; o snippet fica no bloco irmão .generic-snippet
    extrair: ($) => {
      const resultados: ResultadoMotor[] = [];
      $('.search-snippet-title').each((_, el) => {
        const ancora = $(el).closest('a');
        const href = ancora.attr('href');
        if (!href) return;
        const textoBloco = (
          ancora.text() + ' ' +
          ancora.nextAll('.generic-snippet').first().text()
        ).trim();
        resultados.push({ url: href, textoBloco });
      });
      return resultados;
    },
  },
];

// Orçamento de recursos da descoberta — mantém a busca educada e previsível.
const MAX_POR_PAGINA = 5;      // links de áudio por página visitada
const INTERVALO_ENTRE_PAGINAS = 400; // ms entre requisições
const INTERVALO_ENTRE_CONSULTAS = 3000; // ms entre consultas (evita o 429 do Brave)
const TAMANHO_MAX_HTML = 2 * 1024 * 1024; // 2 MB por página
// Depois de detectar o desafio anti-bot do Brave ("scheduled a captcha"),
// o motor fica em cooldown por este período para não piorar o bloqueio.
const COOLDOWN_DO_MOTOR = 10 * 60 * 1000; // 10 minutos

// Controle de cooldown do motor (em memória, por processo).
let motorEmCooldownAte = 0;

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

// O Brave, quando marca o IP como suspeito, devolve uma página de captcha
// com este texto (visto na prática, HTTP 429). Serviria de nada visitar o
// restante — melhor detectar e respeitar o bloqueio.
const PADRAO_DESAFIO = /schedule a captcha|flagged as being suspicious/i;

// Palavras obrigatórias para um resultado de busca ser aceito: TODAS as
// palavras do artista E do título (com 2+ letras, sem acentos/caixa).
// É o que implementa a regra do usuário: só visitar páginas que têm a música
// informada — qualquer lugar que apenas cita o artista ou a banda é ignorado.
function palavrasObrigatorias(identity: AudioIdentity): string[] {
  const separar = (s: string): string[] =>
    s
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter((p) => p.length >= 2);

  return [...new Set([...separar(identity.artist), ...separar(identity.title)])];
}

// Verifica se um texto contém TODAS as palavras exigidas (como tokens inteiros).
function contemTodasAsPalavras(texto: string, palavras: string[]): boolean {
  if (palavras.length === 0) return true;

  const tokens = new Set(
    texto
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter(Boolean)
  );

  return palavras.every((p) => tokens.has(p));
}

export class GenericWebProvider extends BaseAudioSourceProvider {
  readonly providerId = 'generic-web';
  readonly timeouts: ProviderTimeouts = {
    search: 30000,      // 30 segundos para a descoberta completa
    metadata: 10000,    // 10 segundos para metadados
    download: 600000,   // 10 minutos para download de arquivos grandes
  };

  // Descoberta global: motores de busca → páginas abertas → links de áudio
  async search(identity: AudioIdentity): Promise<SearchResult> {
    const startTime = Date.now();
    const normalizada = this.normalizeIdentity(identity);

    try {
      console.log(
        `[GenericWebProvider] Descoberta global iniciada: "${normalizada.artist} - ${normalizada.title}"`
      );

      // Consultas focadas em páginas que REALMENTE contêm a música (regra do
      // usuário): a primeira usa a frase exata entre aspas — "Artista Título" —
      // para que o motor só traga páginas com o nome completo da música, e não
      // páginas que apenas citam o artista ou a banda. A segunda é o fallback
      // sem aspas para quando o motor ignora a busca por frase.
      const consultas = this.montarConsultas(identity);
      const palavras = palavrasObrigatorias(identity);

      const candidatos: AudioCandidate[] = [];
      const urlsJaVistas = new Set<string>();
      let paginasVisitas = 0;

      // Busca por consulta (frase exata primeiro) e, dentro dela, por motor.
      // Intervalo entre consultas evita o rate limit 429 do Brave.
      for (const [indiceConsulta, consulta] of consultas.entries()) {
        if (candidatos.length >= 10) break;
        if (Date.now() - startTime > this.timeouts.search - 8000) break;

        if (indiceConsulta > 0) {
          await delay(INTERVALO_ENTRE_CONSULTAS);
          if (candidatos.length >= 10) break;
        }

        console.log(`[GenericWebProvider] Consulta: "${consulta}" (candidatos até aqui: ${candidatos.length})`);

        // Busca em um motor por vez, respeitando o orçamento de tempo
        for (const motor of MOTORES) {
          if (candidatos.length >= 10) break;
          if (Date.now() - startTime > this.timeouts.search - 8000) break;

          const linksDaBusca = await this.buscarNoMotor(motor, consulta, palavras);
          if (linksDaBusca.length === 0) continue;

          // Visita no máximo 6 páginas de cada motor
          for (const paginaUrl of linksDaBusca.slice(0, 6)) {
            if (paginasVisitas >= 10) break;
            if (candidatos.length >= 10) break;
            if (Date.now() - startTime > this.timeouts.search - 4000) break;
            if (urlsJaVistas.has(paginaUrl)) continue;
            urlsJaVistas.add(paginaUrl);
            paginasVisitas++;

            const achados = await this.extrairDaPagina(paginaUrl, identity);
            candidatos.push(...achados);
            await delay(INTERVALO_ENTRE_PAGINAS);
          }
        }
      }

      console.log(
        `[GenericWebProvider] Descoberta concluída: paginas=${paginasVisitas} ` +
        `candidatos=${candidatos.length} duracao=${Date.now() - startTime}ms`
      );

      return {
        providerId: this.providerId,
        candidates: candidatos,
        status: 'SUCCESS',
        durationMs: Date.now() - startTime,
      };
    } catch (error: any) {
      const durationMs = Date.now() - startTime;
      console.error(`[GenericWebProvider] Descoberta falhou:`, error.message);

      let status: SearchResult['status'] = 'FAILED';
      if (error.message?.includes('Timeout')) status = 'TIMEOUT';
      else if (error.response?.status === 403) status = 'FORBIDDEN';

      return { providerId: this.providerId, candidates: [], status, error: error.message, durationMs };
    }
  }

  // Monta as consultas de busca, cobrindo os formatos de arquivo da regra do
  // usuário (mp3, flac e afins encontrados em páginas abertas).
  // Frases CURTAS entre aspas ("artista" "título") — o Brave respeita aspas
  // em frases curtas, mas ignora uma frase longa "artista título" inteira.
  private montarConsultas(identity: AudioIdentity): string[] {
    return [
      `"${identity.artist}" "${identity.title}" mp3`,
      `"${identity.artist}" "${identity.title}" flac`,
      `"${identity.artist}" "${identity.title}" download`,
    ];
  }

  // Busca o HTML da página de resultados do motor.
  // Motores com viaCurl (Brave) usam o curl do sistema — presente no
  // Windows 10+ e em qualquer servidor, mesma dependência de sistema já
  // aceita no projeto (ffprobe). Se o curl não existir, cai para o axios.
  // Respeita o cooldown do motor (desafio anti-bot) e detecta a página de
  // captcha para não insistir durante o bloqueio.
  private async buscarHtmlDoMotor(motor: MotorDeBusca, url: string): Promise<string | null> {
    if (Date.now() < motorEmCooldownAte) {
      console.warn(`[GenericWebProvider] Motor ${motor.id} em cooldown (desafio anti-bot); consulta ignorada`);
      return null;
    }

    let html: string | null = null;

    if (motor.viaCurl) {
      try {
        const { stdout } = await execFileAsync('curl', [
          '-sS', '-L', '--max-redirs', '3', '-m', '15',
          '-A', USER_AGENT,
          '-H', 'Accept: text/html,application/xhtml+xml',
          '-H', 'Accept-Language: pt-BR,pt;q=0.9,en;q=0.8',
          url,
        ], { maxBuffer: TAMANHO_MAX_HTML + 1024, windowsHide: true });
        html = stdout;
      } catch (error: any) {
        console.warn(
          `[GenericWebProvider] curl indisponível para o motor ${motor.id}: ${error.message} — tentando axios`
        );
      }
    }

    if (html === null) {
      const resposta = await this.getComRetry(url);
      html = resposta ? String(resposta.data ?? '') : null;
    }

    // Página de captcha do motor: registra o cooldown e desiste desta rodada
    if (html && PADRAO_DESAFIO.test(html)) {
      motorEmCooldownAte = Date.now() + COOLDOWN_DO_MOTOR;
      console.warn(
        `[GenericWebProvider] Motor ${motor.id} pediu captcha — cooldown de ${COOLDOWN_DO_MOTOR / 60000} minutos`
      );
      return null;
    }

    return html;
  }

  // Faz a requisição ao motor com retry quando ele responde 429 (rate limit
  // do Brave para o cliente HTTP do Node). Espera 4s e depois 10s antes de
  // desistir — o limite é temporário e a busca volta a funcionar sozinha.
  private async getComRetry(url: string): Promise<{ data: unknown } | null> {
    const esperas = [0, 4000, 10000];
    for (let i = 0; i < esperas.length; i++) {
      if (i > 0) await delay(esperas[i]!);
      try {
        return await axios.get(url, {
          headers: { 'User-Agent': USER_AGENT, Accept: 'text/html' },
          timeout: 8000,
          maxRedirects: 3,
          beforeRedirect: criarBeforeRedirect(),
          maxContentLength: TAMANHO_MAX_HTML,
        });
      } catch (error: any) {
        const ehRateLimit = error.response?.status === 429;
        if (!ehRateLimit || i === esperas.length - 1) throw error;
        console.warn(`[GenericWebProvider] Motor respondeu 429 (rate limit); aguardando ${esperas[i + 1]}ms`);
      }
    }
    return null;
  }

  // Consulta um motor de busca e devolve apenas as URLs de páginas cujo bloco
  // de resultado (título + snippet) contém TODAS as palavras obrigatórias
  // (artista + título). Resultados que só citam o artista são descartados aqui.
  private async buscarNoMotor(
    motor: MotorDeBusca,
    consulta: string,
    palavras: string[]
  ): Promise<string[]> {
    try {
      const auditada = await auditarUrl(motor.montarUrl(consulta));
      if (!auditada.ok) {
        console.warn(`[GenericWebProvider] Motor bloqueado no guard: ${motor.id} (${auditada.motivo})`);
        return [];
      }

      const html = await this.buscarHtmlDoMotor(motor, auditada.url!.href);
      if (!html) return [];

      // Import dinâmico do cheerio mantém a leitura do HTML isolada
      const cheerio = await import('cheerio');
      const $ = cheerio.load(html);

      const urls: string[] = [];
      let descartadosPorFaltaDaMusica = 0;

      for (const resultado of motor.extrair($)) {
        const href = resultado.url;

        try {
          const absoluta = new URL(href, `https://${motor.dominio}`);
          if (absoluta.protocol !== 'http:' && absoluta.protocol !== 'https:') continue;
          if (absoluta.hostname.includes(motor.dominio)) continue;           // link interno do motor
          if (dominioPlataformaProibida(absoluta.hostname)) continue;        // Regra 3

          // Regra do usuário: o bloco precisa provar que a página tem a música.
          // Página que só cita o artista/banda é ignorada.
          if (!contemTodasAsPalavras(resultado.textoBloco, palavras)) {
            descartadosPorFaltaDaMusica++;
            console.log(`[GenericWebProvider] Ignorado (sem a música no bloco): ${absoluta.hostname}`);
            continue;
          }

          urls.push(absoluta.href);
        } catch {
          /* link malformado — ignora */
        }
      }

      console.log(
        `[GenericWebProvider] Motor ${motor.id}: ${urls.length} páginas compatíveis ` +
        `(${descartadosPorFaltaDaMusica} ignoradas por não terem a música no bloco)`
      );
      return urls;
    } catch (error: any) {
      console.warn(`[GenericWebProvider] Motor ${motor.id} indisponível: ${error.message}`);
      return [];
    }
  }

  // Visita uma página aberta e converte links de áudio em candidatos pontuáveis
  private async extrairDaPagina(paginaUrl: string, identity: AudioIdentity): Promise<AudioCandidate[]> {
    try {
      const auditada = await auditarUrl(paginaUrl);
      if (!auditada.ok) {
        console.warn(`[GenericWebProvider] Página rejeitada pelo guard: ${paginaUrl} (${auditada.motivo})`);
        return [];
      }

      const resposta = await axios.get(auditada.url!.href, {
        headers: { 'User-Agent': USER_AGENT, Accept: 'text/html,application/xhtml+xml' },
        timeout: 8000,
        maxRedirects: 3,
        beforeRedirect: criarBeforeRedirect(),
        maxContentLength: TAMANHO_MAX_HTML,
      });

      const html = typeof resposta.data === 'string' ? resposta.data : String(resposta.data ?? '');
      const todosLinks = extrairLinksDeAudio(html, paginaUrl);
      const links = todosLinks.slice(0, MAX_POR_PAGINA);
      if (links.length === 0) return [];

      // Título da página ajuda a interpretar arquivos sem padrão "Artista - Título"
      const cheerio = await import('cheerio');
      const $ = cheerio.load(html);
      const tituloPagina = $('title').first().text().trim();

      const interpretadoPagina = interpretarNomeDeArquivo(tituloPagina);

      const candidatos: AudioCandidate[] = [];
      for (const link of links) {
        // O próprio arquivo de áudio também precisa passar no guard (Regra 3 + SSRF)
        const arquivo = await auditarUrl(link.url);
        if (!arquivo.ok) {
          console.warn(`[GenericWebProvider] Link de áudio rejeitado: ${link.url} (${arquivo.motivo})`);
          continue;
        }

        // Regra do usuário: a identidade do candidato é definida pelo PRÓPRIO
        // arquivo de áudio (nome do arquivo e texto do link), nunca por
        // herança da identidade buscada nem do título de páginas com vários
        // áudios — um blog que fala de "Daft Punk" mas cujo player global
        // toca outras músicas NÃO pode gerar candidatos da música buscada.
        const interpretadoLink = interpretarNomeDeArquivo(link.texto || '');
        const interpretadoArquivo = interpretarNomeDeArquivo(decodificarNomeDoArquivo(link.url));
        const base = this.resolverBaseDoCandidato(
          interpretadoArquivo,
          interpretadoLink,
          interpretadoPagina,
          todosLinks.length
        );

        candidatos.push({
          providerId: this.providerId,
          // Para providers web, o sourceId É a URL direta do arquivo
          sourceId: link.url,
          artist: base.artist ?? '',
          title: base.title ?? decodificarNomeDoArquivo(link.url),
          version: base.version,
          format: link.formato,
          url: link.url,
          downloadUrl: link.url,
          streamUrl: link.url,
          metadata: {
            sourcePageUrl: paginaUrl,
            fileName: decodificarNomeDoArquivo(link.url),
            pageTitle: tituloPagina,
          },
        });
      }

      console.log(`[GenericWebProvider] ${candidatos.length} candidatos extraídos de ${paginaUrl}`);
      return candidatos;
    } catch (error: any) {
      console.warn(`[GenericWebProvider] Falha ao visitar ${paginaUrl}: ${error.message}`);
      return [];
    }
  }

  // Decide de onde vem a identidade (artista/título/versão) de um candidato.
  //
  // Prioridade — da evidência MAIS forte para a mais fraca:
  //   1. Nome do ARQUIVO de áudio: é o que será tocado de fato. Se ele traz
  //      "Artista - Título", é a prova mais forte que existe.
  //   2. Texto do link que aponta para o arquivo.
  //   3. Título da página — somente quando a página tem UM único link de
  //      áudio (página inteiramente dedicada àquela música). Páginas com
  //      vários áudios (players globais, listas de post) têm títulos que NÃO
  //      descrevem cada arquivo: herdar "Daft Punk - One More Time" do título
  //      e aplicar a um mp3 do CERRONES criava falso exact match 100
  //      (bug real encontrado em 2026-10-23, corrigido aqui).
  //
  // Sem nenhuma evidência, o candidato sai sem artista e o Exact Match
  // Engine o rejeita — nunca se herda a identidade buscada (regra do usuário:
  // lugar que só cita o artista não prova que tem a música).
  private resolverBaseDoCandidato(
    arquivo: NomeInterpretado,
    link: NomeInterpretado,
    pagina: NomeInterpretado,
    totalLinksNaPagina: number
  ): NomeInterpretado {
    if (arquivo.artist && arquivo.title) return arquivo;
    if (link.artist && link.title) return link;
    if (totalLinksNaPagina === 1 && pagina.artist && pagina.title) return pagina;
    return { title: arquivo.title ?? link.title, version: arquivo.version ?? link.version };
  }

  // Buscar links de áudio em uma URL específica (mantido para links diretos)
  async searchInUrl(url: string): Promise<SearchResult> {
    const startTime = Date.now();
    try {
      const auditada = await auditarUrl(url);
      if (!auditada.ok) {
        return {
          providerId: this.providerId,
          candidates: [],
          status: 'FORBIDDEN',
          error: `URL rejeitada pelo guard de segurança: ${auditada.motivo}`,
          durationMs: Date.now() - startTime,
        };
      }

      const resposta = await axios.get(url, {
        headers: { 'User-Agent': USER_AGENT },
        timeout: this.timeouts.search,
        maxRedirects: 3,
        beforeRedirect: criarBeforeRedirect(),
        maxContentLength: TAMANHO_MAX_HTML,
      });

      const html = typeof resposta.data === 'string' ? resposta.data : String(resposta.data ?? '');
      const links = extrairLinksDeAudio(html, url);

      const candidatos: AudioCandidate[] = [];
      for (const link of links) {
        const interpretado = interpretarNomeDeArquivo(link.texto || decodificarNomeDoArquivo(link.url));
        candidatos.push({
          providerId: this.providerId,
          sourceId: link.url,
          artist: interpretado.artist ?? '',
          title: interpretado.title ?? decodificarNomeDoArquivo(link.url),
          version: interpretado.version,
          format: link.formato,
          url: link.url,
          downloadUrl: link.url,
          streamUrl: link.url,
          metadata: { sourcePageUrl: url },
        });
      }

      return { providerId: this.providerId, candidates: candidatos, status: 'SUCCESS', durationMs: Date.now() - startTime };
    } catch (error: any) {
      return {
        providerId: this.providerId,
        candidates: [],
        status: error.message?.includes('Timeout') ? 'TIMEOUT' : 'FAILED',
        error: error.message,
        durationMs: Date.now() - startTime,
      };
    }
  }

  // Metadados de um candidato: candidateId é a URL direta do arquivo
  async getMetadata(candidateId: string): Promise<AudioCandidate | null> {
    try {
      const auditada = await auditarUrl(candidateId);
      if (!auditada.ok) {
        console.warn(`[GenericWebProvider] Metadata rejeitada pelo guard: ${auditada.motivo}`);
        return null;
      }

      const resposta = await axios.head(candidateId, {
        headers: { 'User-Agent': USER_AGENT },
        timeout: this.timeouts.metadata,
        maxRedirects: 3,
        beforeRedirect: criarBeforeRedirect(),
      });

      const contentType = (resposta.headers['content-type'] as string) || '';
      const tamanho = resposta.headers['content-length']
        ? parseInt(String(resposta.headers['content-length']), 10)
        : undefined;

      return {
        providerId: this.providerId,
        sourceId: candidateId,
        artist: '',
        title: decodificarNomeDoArquivo(candidateId),
        url: candidateId,
        downloadUrl: candidateId,
        format: this.extrairFormatoDaUrl(candidateId),
        metadata: { contentType, contentLength: tamanho },
      };
    } catch (error: any) {
      console.error(`[GenericWebProvider] Metadata falhou para ${candidateId}: ${error.message}`);
      return null;
    }
  }

  async getDownloadInfo(candidateId: string): Promise<{ url: string; format: string } | null> {
    const metadata = await this.getMetadata(candidateId);
    if (!metadata) return null;
    return { url: metadata.url || candidateId, format: metadata.format || 'mp3' };
  }

  async checkAvailability(candidateId: string): Promise<boolean> {
    const metadata = await this.getMetadata(candidateId);
    return metadata !== null;
  }

  private extrairFormatoDaUrl(url: string): string | undefined {
    try {
      const caminho = new URL(url).pathname.toLowerCase();
      const ext = ['.mp3', '.flac', '.wav', '.m4a', '.aac', '.ogg', '.opus', '.webm', '.wma']
        .find((e) => caminho.endsWith(e));
      return ext ? ext.replace('.', '') : undefined;
    } catch {
      return undefined;
    }
  }
}

// Extrai e decodifica o nome do arquivo de uma URL
function decodificarNomeDoArquivo(url: string): string {
  try {
    const caminho = new URL(url).pathname;
    return decodeURIComponent(caminho.split('/').pop() ?? '');
  } catch {
    return '';
  }
}
