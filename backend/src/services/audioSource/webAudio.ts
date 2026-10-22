// Utilitários compartilhados da descoberta de áudio em sites abertos (Regra 3).
//
// A Regra 3 do projeto proíbe qualquer plataforma de música (YouTube, Spotify,
// Deezer, iTunes/Apple, Amazon Music, Tidal, SoundCloud, Bandcamp etc.).
// O áudio só pode vir de sites abertos no mundo inteiro — blogs, fóruns,
// homepages e links diretos. Este módulo centraliza as proteções necessárias
// para navegar na web aberta com segurança:
//   1. Lista negra de plataformas proibidas (domínios).
//   2. Guard anti-SSRF: apenas http/https, nada de IPs privados/loopback.
//   3. Extração de links de áudio de HTML (tags e embeds).
//   4. Interpretação de nomes de arquivo no padrão "Artista - Título".

import dns from 'dns/promises';
import net from 'net';
import * as cheerio from 'cheerio';

// User agent de navegador — sites abertos bloqueiam UAs de bots genéricos.
export const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

// Extensões de áudio aceitas pela descoberta web.
export const AUDIO_EXTENSIONS = [
  '.mp3', '.flac', '.wav', '.m4a', '.aac', '.ogg', '.opus', '.webm', '.wma',
];

// Regra 3 — domínios de plataformas de música/áudio proibidos.
// Qualquer URL cujo host seja um desses domínios (ou subdomínio) é descartada.
const PLATAFORMAS_PROIBIDAS: string[] = [
  // YouTube (Google)
  'youtube.com', 'youtu.be', 'ytimg.com', 'youtube-nocookie.com', 'music.youtube.com',
  // Spotify
  'spotify.com', 'spotify.link', 'scdn.co', 'atspotify.com',
  // Deezer
  'deezer.com', 'deezer.link',
  // Apple (iTunes / Apple Music)
  'itunes.com', 'music.apple.com', 'apple.com', 'mzstatic.com',
  // Amazon Music
  'amazonmusic.com', 'amazon.com', 'amzn.to',
  // Outras plataformas de streaming/download de música
  'tidal.com', 'soundcloud.com', 'bandcamp.com', 'qobuz.com',
  'napster.com', 'anghami.com', 'gaana.com', 'jiosaavn.com',
  'pandora.com', 'iheart.com', 'boomplay.com', 'audiomack.com',
  'yandex.com', 'yandex.ru', 'vk.com', 'kkbox.com',
  'datpiff.com', 'mixcloud.com', 'audius.co',
];

// Verifica se um hostname pertence (ou é subdomínio) de um domínio proibido.
export function dominioPlataformaProibida(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/\.$/, '');
  return PLATAFORMAS_PROIBIDAS.some(
    (dom) => host === dom || host.endsWith('.' + dom)
  );
}

// Detecta endereços IP que não podem ser acessados (proteção anti-SSRF):
// loopback, privados, link-local, multicast e faixas reservadas.
export function enderecoNaoRoteavel(ip: string): boolean {
  const versao = net.isIP(ip);
  if (versao === 0) return true; // nem IPv4 nem IPv6 — trata como inseguro

  if (versao === 4) {
    const partes = ip.split('.').map(Number);
    const [a, b] = partes;
    if (a === 0 || a === 10 || a === 127) return true;            // este/privado/loopback
    if (a === 169 && b === 254) return true;                       // link-local
    if (a === 172 && b >= 16 && b <= 31) return true;              // privado
    if (a === 192 && b === 168) return true;                       // privado
    if (a === 192 && b === 0) return true;                         // TEST-NET
    if (a === 198 && (b === 18 || b === 19)) return true;          // benchmark
    if (a === 198 && b === 51) return true;                        // TEST-NET-2
    if (a === 203 && b === 0) return true;                         // TEST-NET-3
    if (a === 224 || a === 239 || a >= 240) return true;           // multicast/reservado
    if (a === 100 && b >= 64 && b <= 127) return true;             // CGNAT
    return false;
  }

  // IPv6
  const v6 = ip.toLowerCase().replace(/^\[|\]$/g, '');
  if (v6 === '::1' || v6 === '::') return true;                    // loopback
  if (v6.startsWith('fe80') || v6.startsWith('fc') || v6.startsWith('fd')) return true; // link-local/ULA
  if (v6.startsWith('ff')) return true;                             // multicast
  // Endereços IPv4 mapeados em IPv6 (::ffff:x.x.x.x)
  const mapeado = v6.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (mapeado) return enderecoNaoRoteavel(mapeado[1]);
  return false;
}

export interface ResultadoAuditoriaUrl {
  ok: boolean;
  motivo?: string;
  url?: URL;
}

// Audita uma URL antes de qualquer requisição de rede (Regra 3 + anti-SSRF):
// protocolo http/https, sem credenciais embutidas, domínio fora da lista negra
// de plataformas e resolvido para IP publicamente roteável.
export async function auditarUrl(candidato: string): Promise<ResultadoAuditoriaUrl> {
  let url: URL;
  try {
    url = new URL(candidato);
  } catch {
    return { ok: false, motivo: 'URL malformada' };
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    return { ok: false, motivo: `Protocolo não permitido: ${url.protocol}` };
  }

  if (url.username || url.password) {
    return { ok: false, motivo: 'URL com credenciais embutidas' };
  }

  const host = url.hostname;
  if (!host) return { ok: false, motivo: 'URL sem hostname' };

  if (dominioPlataformaProibida(host)) {
    return { ok: false, motivo: `Plataforma proibida pela Regra 3: ${host}` };
  }

  if (host.toLowerCase() === 'localhost' || host.endsWith('.local') || host.endsWith('.internal')) {
    return { ok: false, motivo: 'Host interno não permitido' };
  }

  // Se o host é um IP literal, valida direto; senão resolve o DNS.
  if (net.isIP(host)) {
    if (enderecoNaoRoteavel(host)) {
      return { ok: false, motivo: `Endereço não roteável: ${host}` };
    }
    return { ok: true, url };
  }

  try {
    const registros = await dns.lookup(host, { all: true, verbatim: true });
    for (const registro of registros) {
      if (enderecoNaoRoteavel(registro.address)) {
        return { ok: false, motivo: `DNS resolve para endereço não roteável: ${registro.address}` };
      }
    }
  } catch {
    return { ok: false, motivo: `Falha ao resolver DNS para ${host}` };
  }

  return { ok: true, url };
}

// Verificação leve (síncrona) para redirects do axios: checa protocolo,
// lista negra de plataformas e IPs privados literais em cada salto.
export function criarBeforeRedirect() {
  return (options: { href?: string; hostname?: string; protocol?: string }): void => {
    const destino = options.href ?? `${options.protocol ?? 'https:'}//${options.hostname ?? ''}`;
    let url: URL;
    try {
      url = new URL(destino);
    } catch {
      throw new Error('Redirect com URL inválida — requisição abortada');
    }
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      throw new Error(`Redirect para protocolo não permitido: ${url.protocol}`);
    }
    if (dominioPlataformaProibida(url.hostname)) {
      throw new Error(`Redirect para plataforma proibida (Regra 3): ${url.hostname}`);
    }
    if (net.isIP(url.hostname) && enderecoNaoRoteavel(url.hostname)) {
      throw new Error(`Redirect para endereço não roteável: ${url.hostname}`);
    }
  };
}

export interface LinkDeAudio {
  url: string;
  texto: string;
  formato?: string;
}

// Extrai links de áudio de uma página HTML: tags <a>, <audio>, <source>
// e também URLs "cruas" embutidas em JavaScript de players de blog/forum.
export function extrairLinksDeAudio(html: string, baseUrl: string): LinkDeAudio[] {
  const encontrados = new Map<string, LinkDeAudio>();

  const registrar = (bruta: string | undefined, texto: string, tipo?: string) => {
    if (!bruta) return;
    const limpa = bruta.trim();
    if (!limpa) return;

    // Ignora links com rastreamento/afiliados/redirects suspeitos
    if (/redirect|track|affiliate|utm_/i.test(limpa)) return;

    let absoluta: string;
    try {
      absoluta = new URL(limpa, baseUrl).href;
    } catch {
      return;
    }

    const minuscula = absoluta.toLowerCase();
    const semQuery = minuscula.split('?')[0].split('#')[0];
    const extensao = AUDIO_EXTENSIONS.find(
      (ext) => semQuery.endsWith(ext) || minuscula.includes(ext + '?')
    );
    const tipoAudio = tipo?.toLowerCase().startsWith('audio/');
    if (!extensao && !tipoAudio) return;

    if (encontrados.has(absoluta)) return;
    encontrados.set(absoluta, {
      url: absoluta,
      texto: texto.trim(),
      formato: extensao ? extensao.replace('.', '') : undefined,
    });
  };

  const $ = cheerio.load(html);

  // Links clássicos de página
  $('a[href]').each((_, el) => registrar($(el).attr('href'), $(el).text()));
  $('audio[src]').each((_, el) => registrar($(el).attr('src'), $(el).text()));
  $('source[src]').each((_, el) => registrar($(el).attr('src'), $(el).text(), $(el).attr('type')));

  // URLs cruas em JS/JSON de players embutidos (comum em blogs e fóruns)
  const regexUrlAudio =
    /["'(]([^"'()\s]+?\.(?:mp3|flac|wav|m4a|ogg|opus|aac|webm|wma))(?:\?[^"'()\s]*)?["')]/gi;
  let casamento: RegExpExecArray | null;
  let totalRegex = 0;
  while ((casamento = regexUrlAudio.exec(html)) !== null && totalRegex < 50) {
    registrar(casamento[1], '');
    totalRegex++;
  }

  return Array.from(encontrados.values());
}

export interface NomeInterpretado {
  artist?: string;
  title?: string;
  version?: string;
}

// Interpreta nomes de arquivo/links no padrão "Artista - Título (Versão)".
// Exemplos: "The Beatles - Let It Be (Remastered 2009).mp3"
const TERMOS_LIXO = [
  'official', 'audio', 'video', 'lyric', 'lyrics', 'hq', 'hd', '4k',
  '128kbps', '192kbps', '320kbps', 'mp3', 'flac',
];

export function interpretarNomeDeArquivo(nome: string): NomeInterpretado {
  if (!nome) return {};

  // Remove extensão e normaliza separadores
  let base = nome
    .replace(/\.[a-z0-9]{2,5}$/i, '')
    .replace(/_/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  // Extrai a versão de parênteses/colchetes: "(Remastered 2009)", "[Live]"
  let version: string | undefined;
  const parenteses = base.match(/[([]([^)\]]{1,60})[)\]]/g);
  if (parenteses) {
    const relevante = parenteses
      .map((p) => p.slice(1, -1).trim())
      .find((p) => /live|remix|remast|edit|version|mix|acoustic|instrumental|acapella|cover|mono|stereo|demo|take/i.test(p));
    if (relevante) version = relevante;
    base = base.replace(/[([][^)\]]{1,60}[)\]]/g, ' ');
  }

  base = base.replace(/\s+/g, ' ').trim();

  // "Artista - Título" (primeiro separador)
  const separador = base.indexOf(' - ');
  if (separador > 0) {
    const artist = base.slice(0, separador).trim();
    let title = base.slice(separador + 3).trim();
    // Remove termos de lixo comuns do título ("Official Audio" etc.)
    for (const termo of TERMOS_LIXO) {
      title = title.replace(new RegExp(`\\b${termo}\\b`, 'i'), '');
    }
    return {
      artist: artist || undefined,
      title: title.trim() || base || undefined,
      version,
    };
  }

  // Sem separador — usa o texto inteiro como título
  let title = base;
  for (const termo of TERMOS_LIXO) {
    title = title.replace(new RegExp(`\\b${termo}\\b`, 'i'), '');
  }
  return { title: title.trim() || base || undefined, version };
}

// Heurística rápida: a URL terminada em extensão de áudio? (sem rede)
export function pareceUrlDeAudio(url: string): boolean {
  try {
    const u = new URL(url);
    const caminho = u.pathname.toLowerCase();
    return AUDIO_EXTENSIONS.some((ext) => caminho.endsWith(ext));
  } catch {
    return false;
  }
}
