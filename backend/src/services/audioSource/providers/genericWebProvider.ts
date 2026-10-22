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
import {
  USER_AGENT,
  auditarUrl,
  criarBeforeRedirect,
  dominioPlataformaProibida,
  extrairLinksDeAudio,
  interpretarNomeDeArquivo,
} from '../webAudio';

interface MotorDeBusca {
  id: string;
  // Monta a URL de busca para a consulta
  montarUrl(consulta: string): string;
  // Seletores CSS dos links de resultado no HTML da página de resultados
  seletorResultado: string;
  // Domínio do próprio motor (para descartar links internos)
  dominio: string;
  // Desembrulha links de redirect do motor (ddg: /l/?uddg=, bing: /ck/a base64)
  desembrulhar?: (href: string) => string | null;
}

// Desembrulha o redirect "/ck/a?!...&u=a1<base64>" do Bing.
// O prefixo "a1" marca a codificação; removemos os 2 primeiros caracteres.
function desembrulharBing(href: string): string | null {
  try {
    const m = href.match(/[?&]u=a1([A-Za-z0-9_\-+=]+)/);
    if (!m) return null;
    const decodificado = Buffer.from(m[1], 'base64').toString('utf8');
    return /^https?:\/\//.test(decodificado) ? decodificado : null;
  } catch {
    return null;
  }
}

// Desembrulha o redirect "/l/?uddg=<url-codificada>" do DuckDuckGo HTML.
function desembrulharUddg(href: string, dominio: string): string | null {
  try {
    if (!href.includes('uddg=')) return null;
    const parametro = new URL(href, `https://${dominio}`).searchParams.get('uddg');
    return parametro ? decodeURIComponent(parametro) : null;
  } catch {
    return null;
  }
}

// Motores de busca acessíveis por HTML simples, sem chave de API.
// Bing em primeiro lugar: é o único dos grandes que responde a requisições
// simples (DuckDuckGo HTML devolve desafio JS e Mojeek responde 403 em bot).
const MOTORES: MotorDeBusca[] = [
  {
    id: 'bing-html',
    montarUrl: (q) => `https://www.bing.com/search?q=${encodeURIComponent(q)}`,
    seletorResultado: 'li.b_algo h2 a',
    dominio: 'bing.com',
    desembrulhar: desembrulharBing,
  },
  {
    id: 'duckduckgo-html',
    montarUrl: (q) => `https://html.duckduckgo.com/html/?q=${encodeURIComponent(q)}`,
    seletorResultado: 'a.result__a',
    dominio: 'duckduckgo.com',
    desembrulhar: (href) => desembrulharUddg(href, 'duckduckgo.com'),
  },
  {
    id: 'mojeek',
    montarUrl: (q) => `https://www.mojeek.com/search?q=${encodeURIComponent(q)}`,
    seletorResultado: 'a.result-link, ul.results-standard li a',
    dominio: 'mojeek.com',
  },
];

// Orçamento de recursos da descoberta — mantém a busca educada e rápida.
const MAX_POR_PAGINA = 5;      // links de áudio por página visitada
const INTERVALO_ENTRE_PAGINAS = 400; // ms entre requisições
const TAMANHO_MAX_HTML = 2 * 1024 * 1024; // 2 MB por página

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

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

      // Consulta focada em arquivos de áudio hospedados em páginas abertas.
      // Sem aspas: os motores HTML ignoram correspondência exata com frequência,
      // e "artist title mp3 download" traz páginas com arquivos embutidos.
      const consulta = `${identity.artist} ${identity.title} mp3 download`;

      const candidatos: AudioCandidate[] = [];
      const urlsJaVistas = new Set<string>();
      let paginasVisitas = 0;

      // Busca em um motor por vez, respeitando o orçamento de tempo
      for (const motor of MOTORES) {
        if (candidatos.length >= 10) break;
        if (Date.now() - startTime > this.timeouts.search - 8000) break;

        const linksDaBusca = await this.buscarNoMotor(motor, consulta);
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

  // Consulta um motor de busca e devolve as URLs das páginas de resultado
  private async buscarNoMotor(motor: MotorDeBusca, consulta: string): Promise<string[]> {
    try {
      const auditada = await auditarUrl(motor.montarUrl(consulta));
      if (!auditada.ok) {
        console.warn(`[GenericWebProvider] Motor bloqueado no guard: ${motor.id} (${auditada.motivo})`);
        return [];
      }

      const resposta = await axios.get(auditada.url!.href, {
        headers: { 'User-Agent': USER_AGENT, Accept: 'text/html' },
        timeout: 8000,
        maxRedirects: 3,
        beforeRedirect: criarBeforeRedirect(),
        maxContentLength: TAMANHO_MAX_HTML,
      });

      // Import dinâmico do cheerio mantém a leitura do HTML isolada
      const cheerio = await import('cheerio');
      const $ = cheerio.load(resposta.data as string);

      const urls: string[] = [];
      $(motor.seletorResultado).each((_: number, el: any) => {
        let href = $(el).attr('href');
        if (!href) return;

        // Desembrulha redirects do motor (ddg uddg=, bing /ck/a base64)
        if (motor.desembrulhar) {
          const dest = motor.desembrulhar(href);
          if (dest) href = dest;
        }

        try {
          const absoluta = new URL(href);
          if (absoluta.protocol !== 'http:' && absoluta.protocol !== 'https:') return;
          if (absoluta.hostname.includes(motor.dominio)) return;           // link interno do motor
          if (dominioPlataformaProibida(absoluta.hostname)) return;        // Regra 3
          urls.push(absoluta.href);
        } catch {
          /* link malformado — ignora */
        }
      });

      console.log(`[GenericWebProvider] Motor ${motor.id} retornou ${urls.length} páginas`);
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
      const links = extrairLinksDeAudio(html, paginaUrl).slice(0, MAX_POR_PAGINA);
      if (links.length === 0) return [];

      // Título da página ajuda a interpretar arquivos sem padrão "Artista - Título"
      const cheerio = await import('cheerio');
      const $ = cheerio.load(html);
      const tituloPagina = $('title').first().text().trim();

      const candidatos: AudioCandidate[] = [];
      for (const link of links) {
        // O próprio arquivo de áudio também precisa passar no guard (Regra 3 + SSRF)
        const arquivo = await auditarUrl(link.url);
        if (!arquivo.ok) {
          console.warn(`[GenericWebProvider] Link de áudio rejeitado: ${link.url} (${arquivo.motivo})`);
          continue;
        }

        const nome = link.texto || tituloPagina || decodificarNomeDoArquivo(link.url);
        const interpretado = interpretarNomeDeArquivo(nome);

        candidatos.push({
          providerId: this.providerId,
          // Para providers web, o sourceId É a URL direta do arquivo
          sourceId: link.url,
          artist: interpretado.artist ?? identity.artist,
          title: interpretado.title ?? decodificarNomeDoArquivo(link.url),
          version: interpretado.version,
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
