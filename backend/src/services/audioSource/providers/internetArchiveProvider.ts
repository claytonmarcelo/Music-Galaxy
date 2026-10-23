// Internet Archive Provider — descoberta de áudio no archive.org (Regra 3).
//
// O archive.org é um site aberto que hospeda gravações enviadas por usuários:
// singles, álbuns, shows, raridades e versões instrumentais. Os arquivos são
// servidos por links HTTPS estáveis, então a fonte se encaixa na Regra 3
// (sites abertos do mundo inteiro, nunca plataformas de música).
//
// Como funciona:
//   1. Consulta a API pública advancedsearch (sem chave de API) por itens de
//      áudio cujo título/artista contenham o artista e a música procurados.
//   2. Lê os metadados de cada item e localiza OS ARQUIVOS da faixa desejada.
//   3. A identidade do candidato vem do próprio arquivo (nome e metadados
//      ID3); o título do item só entra quando ele tem um único arquivo de
//      áudio — mesma proteção contra players globais usada no provider web.
//   4. Compara a versão (remix, instrumental, live, bootleg...) com a versão
//      pedida: o original nunca recebe um remix no lugar, e vice-versa.
//   5. Toda URL de arquivo passa pelo guard anti-SSRF/Regra 3 antes de voltar.
//
// Esta é a fonte aberta que mantém player e download funcionando mesmo quando
// os mecanismos de busca (Brave) bloqueiam o IP do servidor.

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
  interpretarNomeDeArquivo,
  NomeInterpretado,
} from '../webAudio';

// Endpoints públicos do Internet Archive (nenhuma chave necessária).
const URL_BUSCA = 'https://archive.org/advancedsearch.php';
const URL_METADATA = 'https://archive.org/metadata/';
const URL_DOWNLOAD = 'https://archive.org/download/';
const URL_DETALHES = 'https://archive.org/details/';

// Orçamento da descoberta — mantém as consultas educadas e previsíveis.
const LIMITE_TOTAL_CANDIDATOS = 8;
const LIMITE_CANDIDATOS_POR_ITEM = 3;
const ORCAMENTO_BUSCA_MS = 28000;
const INTERVALO_ENTRE_METADADOS_MS = 300;
const TAMANHO_MAX_RESPOSTA = 6 * 1024 * 1024; // 6 MB por resposta JSON
const TTL_CACHE_ITEM_MS = 30 * 60 * 1000;     // metadados de item: 30 minutos
const TAMANHO_MAX_CACHE_ITENS = 100;

const EXTENSOES_AUDIO = [
  '.mp3', '.flac', '.wav', '.m4a', '.aac', '.ogg', '.opus', '.webm', '.wma',
];

// Preferência de formato (quanto maior, melhor) para escolher uma única URL
// quando o item traz o mesmo trecho em mais de um formato (FLAC + MP3 etc.).
const PRIORIDADE_FORMATO: Record<string, number> = {
  flac: 100,
  wav: 90,
  m4a: 70,
  mp3: 65,
  ogg: 45,
  opus: 40,
  aac: 35,
  webm: 30,
  wma: 20,
};

// Qualificadores que identificam uma versão REAL da música. É mais amplo que
// o padrão usado em audioController porque itens do Archive costumam rotular
// bootlegs, remakes, dubs e VIPs — todos precisam ser separados do original.
const PADRAO_QUALIFICADOR =
  /live|remix|remast|edit|version|mix|acoustic|instrumental|acapella|cover|mono|stereo|demo|take|bootleg|remake|dub|vip|mashup|tribute|karaoke/i;

// Rótulos que, na prática, descrevem o próprio original (não uma versão).
const PADRAO_VERSAO_NEUTRA = /^(album|original|single)\s+(version|mix)$/i;

interface DocumentoBusca {
  identifier?: string;
  title?: string | string[];
  creator?: string | string[];
}

interface ArquivoItem {
  name?: string;
  format?: string;
  source?: string;
  size?: string;
  length?: string;
  bitrate?: string;
  title?: string;
  artist?: string;
  creator?: string;
  album?: string;
  track?: string;
}

interface MetadadosItem {
  metadata?: {
    title?: string;
    creator?: string | string[];
  };
  files?: ArquivoItem[];
}

// Interpretação já validada: o título é obrigatório (sem título não há
// candidato), diferente do NomeInterpretado opcional vindo do interpretador.
interface InterpretacaoFaixa {
  artist?: string;
  title: string;
  version?: string;
  semelhanca: number;
}

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Mensagem legível para erros desconhecidos (axios, rede ou exceção comum).
function mensagemDeErro(error: unknown): string {
  if (axios.isAxiosError(error)) return error.message;
  if (error instanceof Error) return error.message;
  return String(error);
}

// Normaliza texto para comparação (sem acentos, caixa baixa, pontuação).
function normalizar(texto: string): string {
  return texto
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\w\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function distanciaLevenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array<number>(n + 1).fill(0));

  for (let i = 0; i <= m; i++) dp[i]![0] = i;
  for (let j = 0; j <= n; j++) dp[0]![j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i]![j] = a[i - 1] === b[j - 1]
        ? dp[i - 1]![j - 1]!
        : 1 + Math.min(dp[i - 1]![j]!, dp[i]![j - 1]!, dp[i - 1]![j - 1]!);
    }
  }

  return dp[m]![n]!;
}

function similaridade(a: string, b: string): number {
  const s1 = normalizar(a);
  const s2 = normalizar(b);
  if (!s1 || !s2) return 0;
  if (s1 === s2) return 1;

  const maior = s1.length >= s2.length ? s1 : s2;
  const menor = s1.length >= s2.length ? s2 : s1;
  const distancia = distanciaLevenshtein(maior, menor);
  return (maior.length - distancia) / maior.length;
}

// O campo creator/title da API pode vir como string ou lista.
function textoUnico(valor?: string | string[]): string {
  if (!valor) return '';
  return (Array.isArray(valor) ? valor[0] ?? '' : valor).trim();
}

function decodificar(texto: string): string {
  try {
    return decodeURIComponent(texto);
  } catch {
    return texto;
  }
}

function escaparRegex(texto: string): string {
  return texto.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Remove prefixos de faixa ("01 - ", "CD1 - ") dos nomes de arquivo.
function semPrefixoDeFaixa(nome: string): string {
  return nome
    .replace(/^\s*\d{1,3}\s*[-._)\]]\s*/, '')
    .replace(/^\s*(?:cd|disc|disco)\s*\d{1,2}\s*[-._)\]]?\s*/i, '')
    .trim();
}

// Limpa o texto bruto de um arquivo/título para interpretação.
function limparTextoDoArquivo(texto: string): string {
  return texto
    .replace(/\.[a-z0-9]{2,5}$/i, '')                    // extensão
    .replace(/\s+(?:ft\.?|feat\.?|featuring)\s+.*$/i, ' ') // participações
    .replace(/[-_]\d{5,}\s*$/, '')                       // sufixo numérico de upload
    .replace(/_/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Extrai o qualificador de versão de parênteses ou do último segmento
// separado por " - " (ex.: "One More Time - Remix").
function extrairQualificador(texto: string): string | undefined {
  const blocos = texto.match(/[([]([^)\]]{1,80})[)\]]/g);
  if (blocos) {
    for (const bloco of blocos) {
      const conteudo = bloco.slice(1, -1).trim();
      if (PADRAO_QUALIFICADOR.test(conteudo)) return conteudo;
    }
  }

  const ultimoSegmento = texto.split(/\s[-–—]\s/).pop()?.trim();
  if (ultimoSegmento && PADRAO_QUALIFICADOR.test(ultimoSegmento)) return ultimoSegmento;

  return undefined;
}

// Interpreta o nome de uma faixa: artista/título/versão.
// O qualificador é retirado do título antes de chamar o interpretador comum,
// para que "One More Time (Bootleg Remake)" vire título "One More Time" e
// versão "Bootleg Remake" (nunca um falso original).
function interpretarFaixa(texto: string): NomeInterpretado {
  const base = semPrefixoDeFaixa(limparTextoDoArquivo(texto));
  const versao = extrairQualificador(base);

  let semVersao = base;
  if (versao) {
    semVersao = base.replace(/[([]([^)\]]{1,80})[)\]]/g, (bloco) =>
      PADRAO_QUALIFICADOR.test(bloco.slice(1, -1)) ? ' ' : bloco
    );
  }

  const interpretado = interpretarNomeDeArquivo(semVersao);
  return {
    artist: interpretado.artist,
    title: interpretado.title ?? base,
    version: versao ?? interpretado.version,
  };
}

// Interpreta o título de um item de arquivo único. Remove o nome do artista
// repetido no título ("One More Time - Daft Punk (instrumental)") e preserva
// o qualificador de versão encontrado.
function interpretarTituloDoItem(titulo: string, artista?: string): NomeInterpretado {
  const versao = extrairQualificador(titulo);
  let base = limparTextoDoArquivo(titulo);

  if (artista) {
    base = base.replace(new RegExp(escaparRegex(artista), 'gi'), ' ');
  }

  base = base
    .replace(/[([]([^)\]]{1,80})[)\]]/g, (bloco) =>
      PADRAO_QUALIFICADOR.test(bloco.slice(1, -1)) ? ' ' : bloco
    )
    .replace(/\s[-–—|]\s*$/, '')
    .replace(/^\s*[-–—|.]+\s*/, '')
    .replace(/\s+/g, ' ')
    .trim();

  return {
    artist: artista || undefined,
    title: base || limparTextoDoArquivo(titulo),
    version: versao,
  };
}

// Um "artista" que na verdade é a assinatura de um site de conversão não é
// identidade musical ("y2mate.com", "savefrom.net" etc.).
function pareceAssinaturaDeSite(artista?: string): boolean {
  if (!artista) return true;
  const texto = artista.trim();
  return /\.(com|net|org|br|io|co|me|info|biz|xyz|ru|to|cc)$/i.test(texto) ||
    /\b(y2mate|ssyoutube|savefrom|mp3juices|320kbps|download)\b/i.test(texto);
}

export class InternetArchiveProvider extends BaseAudioSourceProvider {
  readonly providerId = 'internet-archive';
  readonly timeouts: ProviderTimeouts = {
    search: 30000,      // 30 segundos para consultar busca + metadados
    metadata: 15000,    // 15 segundos por item/HEAD
    download: 600000,   // 10 minutos para arquivos grandes
  };

  // Metadados de itens são reaproveitados entre releases do mesmo álbum.
  private readonly cacheItens = new Map<string, { dados: MetadadosItem; expiraEm: number }>();

  async search(identity: AudioIdentity): Promise<SearchResult> {
    const inicio = Date.now();

    try {
      console.log(
        `[InternetArchiveProvider] Descoberta iniciada: "${identity.artist} - ${identity.title}"` +
        (identity.version ? ` (${identity.version})` : '')
      );

      // Guard também nos endpoints fixos do Archive (Regra 3 + anti-SSRF).
      const buscaAuditada = await auditarUrl(URL_BUSCA);
      if (!buscaAuditada.ok) {
        return {
          providerId: this.providerId,
          candidates: [],
          status: 'FORBIDDEN',
          error: `Endpoint do Archive rejeitado pelo guard: ${buscaAuditada.motivo}`,
          durationMs: Date.now() - inicio,
        };
      }

      const consultas = this.montarConsultas(identity);
      const limitesPorConsulta = [4, 3, 2];
      const identificadoresVistos = new Set<string>();
      const candidatos: AudioCandidate[] = [];
      let fonteForteEncontrada = false;

      for (let indice = 0; indice < consultas.length; indice++) {
        if (fonteForteEncontrada) break;
        if (candidatos.length >= LIMITE_TOTAL_CANDIDATOS) break;
        if (!this.dentroDoOrcamento(inicio)) break;
        // A terceira consulta (só artista) é o último recurso: gasta mais
        // metadados e só vale a pena quando nada foi encontrado antes.
        if (indice === 2 && candidatos.length > 0) continue;

        let documentos: DocumentoBusca[] = [];
        try {
          documentos = await this.consultarItens(
            consultas[indice]!,
            indice === 0 ? 30 : 20
          );
        } catch (error: unknown) {
          console.warn(
            `[InternetArchiveProvider] Consulta ${indice + 1} falhou: ${mensagemDeErro(error)}`
          );
          continue;
        }

        console.log(
          `[InternetArchiveProvider] Consulta ${indice + 1}: ${documentos.length} itens (candidatos até aqui: ${candidatos.length})`
        );

        let analisados = 0;
        const limiteItens = limitesPorConsulta[indice] ?? 3;

        for (const documento of documentos) {
          if (analisados >= limiteItens) break;
          if (candidatos.length >= LIMITE_TOTAL_CANDIDATOS) break;
          if (!this.dentroDoOrcamento(inicio)) break;

          const identificador = documento.identifier?.trim();
          if (!identificador || identificadoresVistos.has(identificador)) continue;
          identificadoresVistos.add(identificador);
          analisados++;

          const achados = await this.extrairDoItem(identificador, documento, identity);
          if (achados.length > 0) {
            console.log(
              `[InternetArchiveProvider] Item ${identificador}: ${achados.length} candidato(s) compatível(is)`
            );
            candidatos.push(...achados);
          }

          // Já temos uma fonte com título exato e artista confirmado: não vale
          // gastar mais requisições — as demais só seriam alternativas.
          if (this.temFonteForte(candidatos, identity)) {
            fonteForteEncontrada = true;
            break;
          }

          if (analisados < limiteItens && this.dentroDoOrcamento(inicio)) {
            await delay(INTERVALO_ENTRE_METADADOS_MS);
          }
        }
      }

      const auditados = await this.auditarCandidatos(candidatos);

      console.log(
        `[InternetArchiveProvider] Descoberta concluída: itens analisados=${identificadoresVistos.size} ` +
        `candidatos=${auditados.length} duracao=${Date.now() - inicio}ms`
      );

      return {
        providerId: this.providerId,
        candidates: auditados,
        status: 'SUCCESS',
        durationMs: Date.now() - inicio,
      };
    } catch (error: unknown) {
      console.error(`[InternetArchiveProvider] Descoberta falhou:`, mensagemDeErro(error));

      let status: SearchResult['status'] = 'FAILED';
      if (axios.isAxiosError(error)) {
        if (error.code === 'ECONNABORTED' || error.message.includes('Timeout')) {
          status = 'TIMEOUT';
        } else if (error.response?.status === 403) {
          status = 'FORBIDDEN';
        } else if (error.response?.status === 429) {
          status = 'RATE_LIMITED';
        }
      }

      return {
        providerId: this.providerId,
        candidates: [],
        status,
        error: mensagemDeErro(error),
        durationMs: Date.now() - inicio,
      };
    }
  }

  // Consultas em ordem de precisão decrescente:
  //   1. artista + título em qualquer campo (acha singles e álbuns);
  //   2. artista + título no criador (itens enviados pelo próprio artista);
  //   3. somente artista (último recurso para álbuns cujo título não cita a faixa).
  private montarConsultas(identity: AudioIdentity): string[] {
    const artista = this.escaparLucene(identity.artist);
    const titulo = this.escaparLucene(identity.title);

    if (!artista || !titulo) return [];

    return [
      `mediatype:audio AND (creator:("${artista}") OR title:("${artista}")) AND (title:("${titulo}") OR "${titulo}")`,
      `mediatype:audio AND creator:("${artista}") AND (title:("${titulo}") OR "${titulo}")`,
      `mediatype:audio AND creator:("${artista}")`,
    ];
  }

  // Escapa caracteres que quebram a sintaxe Lucene da busca do Archive.
  private escaparLucene(texto: string): string {
    return texto
      .replace(/\\/g, '\\\\')
      .replace(/"/g, '\\"')
      .replace(/[\u0000-\u001f]/g, ' ')
      .trim();
  }

  // Consulta o advancedsearch (API pública, sem autenticação).
  private async consultarItens(consulta: string, linhas: number): Promise<DocumentoBusca[]> {
    const parametros = new URLSearchParams({
      q: consulta,
      rows: String(linhas),
      page: '1',
      output: 'json',
    });
    for (const campo of ['identifier', 'title', 'creator']) {
      parametros.append('fl[]', campo);
    }

    const resposta = await axios.get<{ response?: { docs?: DocumentoBusca[] } }>(
      `${URL_BUSCA}?${parametros.toString()}`,
      {
        headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
        timeout: 12000,
        maxRedirects: 3,
        beforeRedirect: criarBeforeRedirect(),
        maxContentLength: TAMANHO_MAX_RESPOSTA,
      }
    );

    return resposta.data?.response?.docs ?? [];
  }

  // Baixa (ou reaproveita do cache) os metadados completos de um item.
  private async baixarMetadados(identificador: string): Promise<MetadadosItem | null> {
    const agora = Date.now();
    const emCache = this.cacheItens.get(identificador);
    if (emCache && emCache.expiraEm > agora) return emCache.dados;

    const resposta = await axios.get<MetadadosItem>(
      `${URL_METADATA}${encodeURIComponent(identificador)}`,
      {
        headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
        timeout: this.timeouts.metadata,
        maxRedirects: 3,
        beforeRedirect: criarBeforeRedirect(),
        maxContentLength: TAMANHO_MAX_RESPOSTA,
      }
    );

    const dados = resposta.data;
    if (!dados || typeof dados !== 'object') return null;

    if (this.cacheItens.size >= TAMANHO_MAX_CACHE_ITENS) {
      const maisAntigo = this.cacheItens.keys().next().value;
      if (maisAntigo) this.cacheItens.delete(maisAntigo);
    }
    this.cacheItens.set(identificador, { dados, expiraEm: agora + TTL_CACHE_ITEM_MS });

    return dados;
  }

  // Examina um item e devolve os candidatos cuja identidade/versão batem.
  private async extrairDoItem(
    identificador: string,
    documento: DocumentoBusca,
    identity: AudioIdentity
  ): Promise<AudioCandidate[]> {
    let dados: MetadadosItem | null = null;
    try {
      dados = await this.baixarMetadados(identificador);
    } catch (error: unknown) {
      console.warn(
        `[InternetArchiveProvider] Metadados de ${identificador} falharam: ${mensagemDeErro(error)}`
      );
      return [];
    }
    if (!dados) return [];

    const tituloDoItem =
      textoUnico(dados.metadata?.title) || textoUnico(documento.title);
    const artistaDoItem =
      textoUnico(dados.metadata?.creator) || textoUnico(documento.creator);

    const arquivos = (dados.files ?? []).filter(
      (arquivo) => !!arquivo.name && !!this.formatoDoNome(arquivo.name)
    );
    if (arquivos.length === 0) return [];

    const totalArquivos = arquivos.length;
    const melhoresPorFaixa = new Map<string, {
      candidato: AudioCandidate;
      prioridade: number;
      semelhanca: number;
    }>();

    for (const arquivo of arquivos) {
      if (!arquivo.name) continue;

      const formato = this.formatoDoNome(arquivo.name);
      if (!formato) continue;

      const identidade = this.escolherIdentidade(
        identity,
        arquivo,
        tituloDoItem,
        artistaDoItem,
        totalArquivos
      );
      if (!identidade) continue;

      const chave = `${normalizar(identidade.title)}|${normalizar(identidade.version ?? '')}`;
      const url = this.urlDoArquivo(identificador, arquivo.name);
      const prioridade = PRIORIDADE_FORMATO[formato] ?? 0;
      const semelhanca = similaridade(identidade.title, identity.title);

      const bitrate = arquivo.bitrate ? parseInt(arquivo.bitrate, 10) : NaN;
      const candidato: AudioCandidate = {
        providerId: this.providerId,
        sourceId: url,
        artist: identidade.artist ?? '',
        title: identidade.title,
        ...(identidade.version ? { version: identidade.version } : {}),
        ...(this.duracaoEmSegundos(arquivo.length) !== undefined
          ? { duration: this.duracaoEmSegundos(arquivo.length) }
          : {}),
        format: formato,
        quality: this.rotuloQualidade(arquivo.format, formato),
        ...(Number.isFinite(bitrate) && bitrate > 0 ? { bitrate } : {}),
        url,
        downloadUrl: url,
        streamUrl: url,
        metadata: {
          sourcePageUrl: `${URL_DETALHES}${encodeURIComponent(identificador)}`,
          fileName: arquivo.name,
          identifier: identificador,
          itemTitle: tituloDoItem,
          itemCreator: artistaDoItem,
          formatLabel: arquivo.format,
          size: arquivo.size,
        },
      };

      const atual = melhoresPorFaixa.get(chave);
      if (!atual || prioridade > atual.prioridade) {
        melhoresPorFaixa.set(chave, { candidato, prioridade, semelhanca });
      }
    }

    return Array.from(melhoresPorFaixa.values())
      .sort((a, b) => (b.semelhanca - a.semelhanca) || (b.prioridade - a.prioridade))
      .slice(0, LIMITE_CANDIDATOS_POR_ITEM)
      .map((entrada) => entrada.candidato);
  }

  // Decide a identidade (artista/título/versão) de UM arquivo do item.
  // Nunca herda a identidade buscada: todas as hipóteses vêm do próprio
  // arquivo (nome e metadados) ou do título do item quando há um único áudio.
  private escolherIdentidade(
    identity: AudioIdentity,
    arquivo: ArquivoItem,
    tituloDoItem: string,
    artistaDoItem: string,
    totalArquivos: number
  ): InterpretacaoFaixa | null {
    const interpretacoes: InterpretacaoFaixa[] = [];

    const nomeDoArquivo = arquivo.name
      ? decodificar(arquivo.name.split('/').pop() ?? '')
      : '';

    if (nomeDoArquivo) {
      const doNome = interpretarFaixa(nomeDoArquivo);
      if (doNome.title) {
        interpretacoes.push({
          artist: doNome.artist,
          title: doNome.title,
          version: doNome.version,
          semelhanca: similaridade(doNome.title, identity.title),
        });
      }
    }

    if (arquivo.title) {
      const doTitulo = interpretarFaixa(arquivo.title);
      if (doTitulo.title) {
        interpretacoes.push({
          artist: arquivo.artist ?? doTitulo.artist,
          title: doTitulo.title,
          version: doTitulo.version,
          semelhanca: similaridade(doTitulo.title, identity.title),
        });
      }
    }

    if (totalArquivos === 1 && tituloDoItem) {
      const doItem = interpretarTituloDoItem(tituloDoItem, artistaDoItem);
      if (doItem.title) {
        interpretacoes.push({
          artist: doItem.artist,
          title: doItem.title,
          version: doItem.version,
          semelhanca: similaridade(doItem.title, identity.title),
        });
      }
    }

    const compativeis = interpretacoes.filter(
      (interpretacao) =>
        this.tituloCombina(interpretacao.title, identity.title) &&
        this.versaoCompativel(identity, interpretacao.version)
    );

    if (compativeis.length === 0) return null;

    compativeis.sort((a, b) => b.semelhanca - a.semelhanca);
    const escolhida = compativeis[0]!;

    // Artista: o da interpretação vencedora (nome/metadados do arquivo),
    // depois o artista do próprio arquivo, por último o criador do item.
    const artista = [escolhida.artist, arquivo.artist, artistaDoItem]
      .find((candidato) => !pareceAssinaturaDeSite(candidato));

    return {
      artist: artista,
      title: escolhida.title,
      version: escolhida.version,
      semelhanca: escolhida.semelhanca,
    };
  }

  // O título do arquivo precisa provar que é a música pedida. Quando o título
  // da fonte é muito mais longo (medley, show completo), a proporção de texto
  // aproveitado derruba a hipótese: "One More Time" dentro de um medley de 10
  // minutos não é a gravação original.
  private tituloCombina(titulo: string, alvo: string): boolean {
    const daFonte = normalizar(titulo);
    const procurado = normalizar(alvo);
    if (!daFonte || !procurado) return false;
    if (daFonte === procurado) return true;

    const menor = daFonte.length <= procurado.length ? daFonte : procurado;
    const maior = daFonte.length <= procurado.length ? procurado : daFonte;
    if (maior.includes(menor) && menor.length >= 3) {
      return menor.length / maior.length >= 0.45;
    }

    return similaridade(titulo, alvo) >= 0.62;
  }

  // Uma fonte "forte" tem o título exato e o artista confirmado — suficiente
  // para resolver a versão sem continuar consultando outros itens.
  private temFonteForte(candidatos: AudioCandidate[], identity: AudioIdentity): boolean {
    const tituloAlvo = normalizar(identity.title);
    return candidatos.some((candidato) => {
      const tituloExato = normalizar(candidato.title) === tituloAlvo;
      const artistaOk =
        candidato.artist.length > 0 &&
        similaridade(candidato.artist, identity.artist) >= 0.8;
      return tituloExato && artistaOk;
    });
  }

  // Só aceita o arquivo se a versão dele corresponde à versão pedida.
  // Original (sem versão) nunca aceita remix/instrumental/live como fonte.
  private versaoCompativel(identity: AudioIdentity, versao?: string): boolean {
    const pedida = identity.version?.trim();
    const daFonte = versao?.trim();

    if (!pedida) {
      if (!daFonte) return true;
      return PADRAO_VERSAO_NEUTRA.test(daFonte);
    }

    if (!daFonte) return PADRAO_VERSAO_NEUTRA.test(pedida);

    if (similaridade(pedida, daFonte) >= 0.55) return true;

    const a = normalizar(pedida);
    const b = normalizar(daFonte);
    return a.includes(b) || b.includes(a);
  }

  // Auditoria final de todas as URLs (Regra 3 + anti-SSRF), por host.
  private async auditarCandidatos(candidatos: AudioCandidate[]): Promise<AudioCandidate[]> {
    const hostsAprovados = new Map<string, boolean>();
    const aprovados: AudioCandidate[] = [];

    for (const candidato of candidatos) {
      const url = candidato.downloadUrl ?? candidato.url ?? candidato.sourceId;
      let host = '';
      try {
        host = new URL(url).hostname;
      } catch {
        continue;
      }

      let aprovado = hostsAprovados.get(host);
      if (aprovado === undefined) {
        const auditoria = await auditarUrl(url);
        aprovado = auditoria.ok;
        hostsAprovados.set(host, aprovado);
        if (!aprovado) {
          console.warn(
            `[InternetArchiveProvider] URL rejeitada pelo guard: ${url} (${auditoria.motivo})`
          );
        }
      }

      if (aprovado) aprovados.push(candidato);
    }

    return aprovados;
  }

  // Monta a URL direta do arquivo dentro do item do Archive.
  private urlDoArquivo(identificador: string, nome: string): string {
    const caminho = nome.split('/').map((parte) => encodeURIComponent(parte)).join('/');
    return `${URL_DOWNLOAD}${encodeURIComponent(identificador)}/${caminho}`;
  }

  private formatoDoNome(nome: string): string | undefined {
    let caminho = nome.toLowerCase();
    try {
      caminho = new URL(nome).pathname.toLowerCase();
    } catch {
      // É só o nome do arquivo — usa como está.
    }
    const extensao = EXTENSOES_AUDIO.find((ext) => caminho.endsWith(ext));
    return extensao ? extensao.slice(1) : undefined;
  }

  private formatoDoMime(mimeType: string): string | undefined {
    const mapa: Record<string, string> = {
      'audio/mpeg': 'mp3',
      'audio/mp3': 'mp3',
      'audio/flac': 'flac',
      'audio/x-flac': 'flac',
      'audio/wav': 'wav',
      'audio/x-wav': 'wav',
      'audio/mp4': 'm4a',
      'audio/x-m4a': 'm4a',
      'audio/aac': 'aac',
      'audio/ogg': 'ogg',
      'audio/webm': 'webm',
      'audio/opus': 'opus',
      'audio/x-ms-wma': 'wma',
    };
    return mapa[mimeType.toLowerCase().split(';')[0]!.trim()];
  }

  private rotuloQualidade(formatoDoArchive: string | undefined, extensao: string): string {
    const texto = String(formatoDoArchive ?? '').toLowerCase();
    if (texto.includes('flac') || extensao === 'flac') return 'FLAC';
    if (texto.includes('mp3') || extensao === 'mp3') return 'MP3';
    if (texto.includes('wav') || extensao === 'wav') return 'WAV';
    return extensao.toUpperCase();
  }

  // Duração do Archive vem como "320.42" (segundos) ou "5:20".
  private duracaoEmSegundos(valor?: string): number | undefined {
    if (!valor) return undefined;

    if (valor.includes(':')) {
      const partes = valor.split(':').map(Number);
      if (partes.some((parte) => Number.isNaN(parte))) return undefined;
      return partes.reduce((total, parte) => total * 60 + parte, 0);
    }

    const segundos = Number.parseFloat(valor);
    return Number.isFinite(segundos) && segundos > 0 ? segundos : undefined;
  }

  private dentroDoOrcamento(inicio: number): boolean {
    return Date.now() - inicio < ORCAMENTO_BUSCA_MS - 1500;
  }

  // Metadados de um candidato: candidateId é a URL direta do arquivo.
  async getMetadata(candidateId: string): Promise<AudioCandidate | null> {
    try {
      const auditoria = await auditarUrl(candidateId);
      if (!auditoria.ok) return null;

      const resposta = await axios.head(candidateId, {
        headers: { 'User-Agent': USER_AGENT, Accept: '*/*' },
        timeout: this.timeouts.metadata,
        maxRedirects: 3,
        beforeRedirect: criarBeforeRedirect(),
        validateStatus: (status) => status < 500,
      });

      if (resposta.status >= 400) return null;

      const contentType = String(resposta.headers['content-type'] ?? '');
      const formato =
        this.formatoDoNome(candidateId) ?? this.formatoDoMime(contentType);
      const ehAudio =
        contentType.toLowerCase().startsWith('audio') || !!formato;
      if (!ehAudio) return null;

      const nome = decodificar(new URL(candidateId).pathname.split('/').pop() ?? '');
      const interpretado = interpretarFaixa(nome);
      const contentLength = resposta.headers['content-length']
        ? parseInt(String(resposta.headers['content-length']), 10)
        : undefined;

      return {
        providerId: this.providerId,
        sourceId: candidateId,
        artist: interpretado.artist ?? '',
        title: interpretado.title ?? nome,
        ...(interpretado.version ? { version: interpretado.version } : {}),
        url: candidateId,
        downloadUrl: candidateId,
        streamUrl: candidateId,
        format: formato,
        metadata: { contentType, contentLength },
      };
    } catch (error: unknown) {
      console.warn(
        `[InternetArchiveProvider] Metadados falharam para ${candidateId}: ${mensagemDeErro(error)}`
      );
      return null;
    }
  }

  async getDownloadInfo(candidateId: string): Promise<{ url: string; format: string } | null> {
    const metadata = await this.getMetadata(candidateId);
    if (!metadata) return null;
    return { url: metadata.url ?? candidateId, format: metadata.format ?? 'mp3' };
  }

  async checkAvailability(candidateId: string): Promise<boolean> {
    return (await this.getMetadata(candidateId)) !== null;
  }
}
