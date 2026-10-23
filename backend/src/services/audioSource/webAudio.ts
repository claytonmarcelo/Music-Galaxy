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
import type { LookupAddress, LookupOptions } from 'dns';
import net from 'net';
import http from 'http';
import https from 'https';
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
  // Plataformas de hospedagem de áudio ("ouça grátis")
  'audio.com',
];

// Verifica se um hostname pertence (ou é subdomínio) de um domínio proibido.
export function dominioPlataformaProibida(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/\.$/, '');
  return PLATAFORMAS_PROIBIDAS.some(
    (dom) => host === dom || host.endsWith('.' + dom)
  );
}

// Converte um endereço IPv6 (já validado por net.isIP) em BigInt de 128 bits.
// Suporta "::" e IPv4 embutido no final (ex.: ::ffff:127.0.0.1).
function ipv6ParaBigInt(ip: string): bigint | null {
  let endereco = ip.toLowerCase().replace(/^\[|\]$/g, '').split('%')[0] ?? '';
  if (!endereco) return null;

  // Converte um IPv4 no final para dois grupos hexadecimais
  const comIPv4 = endereco.match(/^(.*:)(\d+\.\d+\.\d+\.\d+)$/);
  if (comIPv4) {
    const octetos = comIPv4[2]!.split('.').map(Number);
    if (octetos.length !== 4 || octetos.some((o) => !Number.isInteger(o) || o < 0 || o > 255)) {
      return null;
    }
    const alto = ((octetos[0]! << 8) | octetos[1]!).toString(16);
    const baixo = ((octetos[2]! << 8) | octetos[3]!).toString(16);
    endereco = `${comIPv4[1]}${alto}:${baixo}`;
  }

  const partes = endereco.split('::');
  if (partes.length > 2) return null;

  const inicio = partes[0] ? partes[0].split(':') : [];
  const fim = partes.length === 2 && partes[1] ? partes[1].split(':') : [];
  const faltam = 8 - (inicio.length + fim.length);
  if (faltam < 0) return null;
  if (partes.length === 1 && faltam !== 0) return null;

  const grupos = [
    ...inicio,
    ...Array<string>(partes.length === 2 ? faltam : 0).fill('0'),
    ...fim,
  ];
  if (grupos.length !== 8) return null;

  let valor = 0n;
  for (const grupo of grupos) {
    if (!/^[0-9a-f]{1,4}$/.test(grupo)) return null;
    valor = (valor << 16n) | BigInt(parseInt(grupo, 16));
  }
  return valor;
}

// Verifica se os primeiros `bits` de um IPv6 batem com o prefixo informado.
function prefixoIpv6(valor: bigint, bits: number, prefixo: bigint): boolean {
  return (valor >> BigInt(128 - bits)) === prefixo;
}

// Faixas IPv6 que nunca podem ser acessadas (reservadas, privadas ou de
// transição que permitiriam alcançar destinos internos).
function ipv6NaoRoteavel(ip: string): boolean {
  const valor = ipv6ParaBigInt(ip);
  if (valor === null) return true; // não foi possível interpretar — inseguro

  if (valor === 0n || valor === 1n) return true;                     // :: e ::1
  if (prefixoIpv6(valor, 10, 0x3fan)) return true;                   // fe80::/10 link-local
  if (prefixoIpv6(valor, 10, 0x3fbn)) return true;                   // fec0::/10 site-local
  if (prefixoIpv6(valor, 7, 0x7en)) return true;                     // fc00::/7 ULA
  if (prefixoIpv6(valor, 8, 0xffn)) return true;                     // ff00::/8 multicast
  if (prefixoIpv6(valor, 32, 0x20010db8n)) return true;              // 2001:db8::/32 documentação
  if (prefixoIpv6(valor, 32, 0x20010000n)) return true;              // 2001::/32 Teredo
  if (prefixoIpv6(valor, 28, 0x2001001n)) return true;               // 2001:10::/28 ORCHID
  if (prefixoIpv6(valor, 28, 0x2001002n)) return true;               // 2001:20::/28 ORCHIDv2
  if (prefixoIpv6(valor, 16, 0x2002n)) return true;                  // 2002::/16 6to4
  if (prefixoIpv6(valor, 64, 0x0100000000000000n)) return true;      // 100::/64 discard
  if (prefixoIpv6(valor, 96, 0x0064ff9b0000000000000000n)) return true; // NAT64
  if (prefixoIpv6(valor, 48, 0x0064ff9b0001n)) return true;          // NAT64 local-use
  if (prefixoIpv6(valor, 96, 0xffffn)) {
    // IPv4 mapeado (::ffff:a.b.c.d) — valida o IPv4 embutido
    const ipv4 = Number(valor & 0xffffffffn);
    const octetos = [
      (ipv4 >>> 24) & 255,
      (ipv4 >>> 16) & 255,
      (ipv4 >>> 8) & 255,
      ipv4 & 255,
    ].join('.');
    return enderecoNaoRoteavel(octetos);
  }
  if (prefixoIpv6(valor, 96, 0n)) {
    // IPv4 compatível (::a.b.c.d, obsoleto) — mesma validação
    const ipv4 = Number(valor & 0xffffffffn);
    const octetos = [
      (ipv4 >>> 24) & 255,
      (ipv4 >>> 16) & 255,
      (ipv4 >>> 8) & 255,
      ipv4 & 255,
    ].join('.');
    return enderecoNaoRoteavel(octetos);
  }
  return false;
}

// Detecta endereços IP que não podem ser acessados (proteção anti-SSRF):
// loopback, privados, link-local, multicast e faixas reservadas.
export function enderecoNaoRoteavel(ip: string): boolean {
  const versao = net.isIP(ip);
  if (versao === 0) return true; // nem IPv4 nem IPv6 — trata como inseguro

  if (versao === 4) {
    const partes = ip.split('.').map(Number);
    const [a, b, c] = partes;
    if (a === 0 || a === 10 || a === 127) return true;            // este/privado/loopback
    if (a === 169 && b === 254) return true;                       // link-local
    if (a === 172 && b !== undefined && b >= 16 && b <= 31) return true; // privado
    if (a === 192 && b === 168) return true;                       // privado
    if (a === 192 && b === 0) return true;                         // IETF/TEST-NET-1
    if (a === 192 && b === 88 && c === 99) return true;            // 6to4 relay anycast
    if (a === 198 && (b === 18 || b === 19)) return true;          // benchmark
    if (a === 198 && b === 51 && c === 100) return true;           // TEST-NET-2
    if (a === 203 && b === 0 && c === 113) return true;            // TEST-NET-3
    if (a !== undefined && a >= 224) return true;                  // multicast/reservado/broadcast
    if (a === 100 && b !== undefined && b >= 64 && b <= 127) return true; // CGNAT
    return false;
  }

  return ipv6NaoRoteavel(ip);
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

  const host = url.hostname.toLowerCase().replace(/\.$/, '');
  if (!host) return { ok: false, motivo: 'URL sem hostname' };

  if (dominioPlataformaProibida(host)) {
    return { ok: false, motivo: `Plataforma proibida pela Regra 3: ${host}` };
  }

  if (
    host === 'localhost' ||
    host.endsWith('.localhost') ||
    host.endsWith('.local') ||
    host.endsWith('.internal') ||
    host.endsWith('.home.arpa') ||
    host.endsWith('.test') ||
    host.endsWith('.invalid') ||
    host.endsWith('.example') ||
    host.endsWith('.onion')
  ) {
    return { ok: false, motivo: 'Host interno ou reservado não permitido' };
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

// Cria agentes HTTP/HTTPS que revalidam o DNS no momento da conexão.
// O guard `auditarUrl` resolve o hostname antes da requisição; sem esta
// checagem de conexão, um DNS rebinding poderia trocar o IP entre a auditoria
// e o connect (TOCTOU). Todo IP resolvido precisa ser publicamente roteável.
export function criarAgentesSeguros(): { httpAgent: http.Agent; httpsAgent: http.Agent } {
  const lookupSeguro = (
    hostname: string,
    options: LookupOptions,
    callback: (err: NodeJS.ErrnoException | null, address: string | LookupAddress[], family?: number) => void
  ): void => {
    dns
      .lookup(hostname, { all: true, verbatim: true })
      .then((registros) => {
        if (registros.length === 0) {
          const erro: NodeJS.ErrnoException = new Error(`DNS sem registros para ${hostname}`);
          erro.code = 'ENOTFOUND';
          callback(erro, '', 0);
          return;
        }

        const bloqueado = registros.find((registro) => enderecoNaoRoteavel(registro.address));
        if (bloqueado) {
          const erro: NodeJS.ErrnoException = new Error(
            `DNS resolve para endereço não roteável: ${bloqueado.address}`
          );
          erro.code = 'EACCES';
          callback(erro, '', 0);
          return;
        }

        if (options.all) {
          callback(null, registros);
          return;
        }

        const primeiro = registros[0]!;
        callback(null, primeiro.address, primeiro.family);
      })
      .catch((erro: unknown) => {
        const err = erro instanceof Error ? erro : new Error('Falha ao resolver DNS');
        callback(err, '', 0);
      });
  };

  return {
    httpAgent: new http.Agent({ lookup: lookupSeguro, keepAlive: false }),
    httpsAgent: new https.Agent({ lookup: lookupSeguro, keepAlive: false }),
  };
}

// Extrai mensagem/status/código de um erro desconhecido sem recorrer a `any`.
// Funciona tanto para Error quanto para AxiosError (que tem response.status).
export function detalharErro(erro: unknown): {
  mensagem: string;
  status?: number;
  codigo?: string;
} {
  if (typeof erro !== 'object' || erro === null) {
    return { mensagem: String(erro) };
  }

  const bruto = erro as {
    message?: unknown;
    code?: unknown;
    response?: { status?: unknown };
  };

  const mensagem =
    typeof bruto.message === 'string' && bruto.message
      ? bruto.message
      : String(erro);

  const status =
    typeof bruto.response?.status === 'number' ? bruto.response.status : undefined;

  const codigo = typeof bruto.code === 'string' ? bruto.code : undefined;

  return { mensagem, ...(status !== undefined ? { status } : {}), ...(codigo ? { codigo } : {}) };
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
    .replace(/[–—]/g, ' - ') // travessões (en/em dash) viram o separador padrão
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
    // O título termina no próximo separador: blogs de download assinam as
    // faixas com o nome do site ("Artista - Título - Site.com"). Sem este
    // corte, "Site.com" vira parte do título e o match nunca acontece.
    const fimDoTitulo = title.search(/\s[-–—|]\s/);
    if (fimDoTitulo > 0) title = title.slice(0, fimDoTitulo);
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
  // Mesmo corte de assinatura de site do ramo acima ("Título - Site.com")
  const fimDoTitulo = title.search(/\s[-–—|]\s/);
  if (fimDoTitulo > 0) title = title.slice(0, fimDoTitulo);
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
