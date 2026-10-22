// Controller de Áudio — Streaming e Download via sites abertos (Regra 3).
//
// A Regra 3 do projeto PROÍBE YouTube, Spotify, Deezer, iTunes/Apple Music e
// qualquer plataforma de música. As únicas fontes de áudio permitidas são
// sites abertos no mundo inteiro: blogs, fóruns, homepages e links diretos.
//
// Endpoints:
//   GET  /api/releases/:id/stream        → proxy de streaming da URL direta descoberta
//   GET  /api/releases/:id/download      → baixa, converte (FFmpeg) e entrega MP3/FLAC
//   POST /api/releases/:id/audio-source  → registra uma fonte web direta fornecida
//
// Fluxo unificado (substitui os antigos subsistemas audio/ e o fallback YouTube):
//   resolverFonte() → fonte salva no banco (audio_source_url) ou descoberta
//   sob demanda pelo SourceOrchestrator (GenericWebProvider + DirectLinkProvider).

import { Request, Response } from 'express';
import { RowDataPacket } from 'mysql2';
import pool from '../config/database';
import axios from 'axios';
import ffmpegPath from 'ffmpeg-static';
import { path as ffprobePath } from 'ffprobe-static';
import ffmpeg from 'fluent-ffmpeg';
import fs from 'fs/promises';
import { createReadStream, createWriteStream } from 'fs';
import path from 'path';
import { downloadCache } from '../services/downloadCache';
import { downloadDeduplication } from '../services/downloadDeduplication';
import { SourceOrchestrator } from '../services/audioSource/sourceOrchestrator';
import { DirectLinkProvider } from '../services/audioSource/providers/directLinkProvider';
import { GenericWebProvider } from '../services/audioSource/providers/genericWebProvider';
import { AudioIdentity } from '../services/audioSource/types';
import { USER_AGENT, auditarUrl, criarBeforeRedirect } from '../services/audioSource/webAudio';

// Providers permitidos pela Regra 3 — apenas web aberta, sem plataformas.
const directLinkProvider = new DirectLinkProvider();
const genericWebProvider = new GenericWebProvider();

// Único orquestrador de áudio do sistema (não existe mais fallback paralelo).
const sourceOrchestrator = new SourceOrchestrator({
  enableParallelSearch: true,
  maxConcurrentProviders: 3,
  requireExactMatch: true,
  enableFallback: true,
});
sourceOrchestrator.registerProvider(genericWebProvider);
sourceOrchestrator.registerProvider(directLinkProvider);

// Tipos de erro para classificação do pipeline de download
enum DownloadErrorType {
  SOURCE_UNAVAILABLE = 'SOURCE_UNAVAILABLE',
  FORMAT_UNAVAILABLE = 'FORMAT_UNAVAILABLE',
  SOURCE_TIMEOUT = 'SOURCE_TIMEOUT',
  EXTRACTION_FAILED = 'EXTRACTION_FAILED',
  CONVERSION_FAILED = 'CONVERSION_FAILED',
  VALIDATION_FAILED = 'VALIDATION_FAILED',
  TEMPORARY_NETWORK_ERROR = 'TEMPORARY_NETWORK_ERROR',
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  NO_SUITABLE_SOURCE = 'NO_SUITABLE_SOURCE',
  FILE_TOO_LARGE = 'FILE_TOO_LARGE',
}

interface DownloadError extends Error {
  type?: DownloadErrorType;
  retryable?: boolean;
}

// Dados da release necessários para resolver a fonte de áudio
interface ReleaseAudioRow extends RowDataPacket {
  id: number;
  audio_source_url: string | null;
  audio_source_provider: string | null;
  audio_source_page_url: string | null;
  version_name: string;
  work_title: string;
  artist_name: string;
}

// Fonte de áudio resolvida (site aberto — Regra 3)
interface FonteAudio {
  url: string;        // URL direta do arquivo de áudio
  provider: string;   // generic-web | direct-link
  pageUrl?: string;   // página de origem (blog/forum), para auditoria
}

// Limites de segurança do pipeline
const TIMEOUTS = {
  DOWNLOAD: 5 * 60 * 1000,   // 5 minutos para baixar da fonte
  FFMPEG: 10 * 60 * 1000,    // 10 minutos para converter
  VALIDATION: 30 * 1000,     // 30 segundos para validar
};
const TAMANHO_MAX_AUDIO = 200 * 1024 * 1024; // 200 MB por arquivo

// Função de timeout com Promise.race
const withTimeout = <T>(promise: Promise<T>, timeoutMs: number, errorMessage: string): Promise<T> => {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      const timer = setTimeout(() => reject(new Error(errorMessage)), timeoutMs);
      (timer as { unref?: () => void }).unref?.();
    }),
  ]);
};

// Marca um erro com tipo e retentabilidade do pipeline
function erroDownload(message: string, type: DownloadErrorType, retryable = true): DownloadError {
  const erro = new Error(message) as DownloadError;
  erro.type = type;
  erro.retryable = retryable;
  return erro;
}

// Busca os dados de áudio da release (colunas web da Regra 3)
async function buscarRelease(releaseId: number): Promise<ReleaseAudioRow | null> {
  const [rows] = await pool.execute<ReleaseAudioRow[]>(
    `SELECT
       r.id,
       r.audio_source_url,
       r.audio_source_provider,
       r.audio_source_page_url,
       r.version_name,
       w.title  AS work_title,
       a.name   AS artist_name
     FROM releases r
     JOIN works   w ON w.id = r.work_id
     JOIN artists a ON a.id = w.artist_id
     WHERE r.id = ?
     LIMIT 1`,
    [releaseId]
  );
  return rows[0] ?? null;
}

// Salva a fonte descoberta na release para reaproveitar nas próximas requisições
async function persistirFonte(releaseId: number, fonte: FonteAudio): Promise<void> {
  await pool.execute(
    `UPDATE releases
        SET audio_source_url = ?, audio_source_provider = ?, audio_source_page_url = ?
      WHERE id = ?`,
    [fonte.url, fonte.provider, fonte.pageUrl ?? null, releaseId]
  );
}

// Limpa a fonte salva (quando sai do ar ou viola a Regra 3) para forçar nova descoberta
async function limparFonte(releaseId: number): Promise<void> {
  await pool.execute(
    `UPDATE releases
        SET audio_source_url = NULL, audio_source_provider = NULL, audio_source_page_url = NULL
      WHERE id = ?`,
    [releaseId]
  );
}

// Monta a identidade musical usada pelo Exact Match Engine
function montarIdentidade(release: ReleaseAudioRow): AudioIdentity {
  return {
    artist: release.artist_name,
    title: release.work_title,
    version: release.version_name,
  };
}

// Resolve a fonte de áudio de uma release (único caminho do sistema):
//   1. Usa a fonte salva no banco, se ainda estiver no ar e passar no guard.
//   2. Senão, dispara a descoberta global em sites abertos via SourceOrchestrator
//      e salva o resultado (exact match obrigatório).
async function resolverFonte(
  release: ReleaseAudioRow,
  opts: { reDescobrir?: boolean } = {}
): Promise<FonteAudio | null> {
  // 1. Fonte já salva — valida segurança (Regra 3) e disponibilidade
  if (!opts.reDescobrir && release.audio_source_url) {
    const guard = await auditarUrl(release.audio_source_url);
    if (guard.ok) {
      const disponivel = await directLinkProvider.checkAvailability(release.audio_source_url);
      if (disponivel) {
        return {
          url: release.audio_source_url,
          provider: release.audio_source_provider ?? 'web',
          pageUrl: release.audio_source_page_url ?? undefined,
        };
      }
      console.warn(`[AudioController] Fonte salva indisponível — redescobrindo (releaseId=${release.id})`);
    } else {
      // Fonte antiga viola a Regra 3 ou é insegura — descarta e limpa do banco
      console.warn(`[AudioController] Fonte salva rejeitada pelo guard (${guard.motivo}) — limpando (releaseId=${release.id})`);
      await limparFonte(release.id);
    }
  }

  // 2. Descoberta global em sites abertos (blogs, fóruns, links diretos)
  try {
    const discovery = await sourceOrchestrator.discover(montarIdentidade(release));
    const melhor = discovery.bestCandidate;

    if (melhor?.candidate) {
      const url = melhor.candidate.downloadUrl ?? melhor.candidate.url;
      if (url) {
        const guard = await auditarUrl(url);
        if (guard.ok) {
          const fonte: FonteAudio = {
            url,
            provider: melhor.candidate.providerId,
            pageUrl: melhor.candidate.metadata?.sourcePageUrl,
          };
          console.log(
            `[AudioController] Fonte web descoberta (releaseId=${release.id}): ` +
            `provider=${fonte.provider} score=${melhor.score.toFixed(1)} url=${fonte.url}`
          );
          await persistirFonte(release.id, fonte);
          return fonte;
        }
        console.warn(`[AudioController] Candidato rejeitado pelo guard: ${guard.motivo}`);
      }
    }
    console.warn(`[AudioController] Nenhum candidato exact match em sites abertos (releaseId=${release.id})`);
    return null;
  } catch (error) {
    console.error(`[AudioController] Descoberta de fonte falhou (releaseId=${release.id}):`, error);
    return null;
  }
}

// ============================================================
// GET /api/releases/:id/stream
// Proxy de streaming da URL direta em site aberto. Encaminha o cabeçalho
// Range para que o player (web ou expo-av) possa buscar posições.
// ============================================================
export async function streamAudio(req: Request, res: Response): Promise<void> {
  const releaseId = parseInt(req.params['id'] ?? '0', 10);

  if (!releaseId) {
    res.status(400).json({ success: false, error: 'ID de release inválido' });
    return;
  }

  const release = await buscarRelease(releaseId);
  if (!release) {
    res.status(404).json({ success: false, error: 'Release não encontrada' });
    return;
  }

  const fonte = await resolverFonte(release);
  if (!fonte) {
    res.status(404).json({
      success: false,
      error: 'Nenhum áudio encontrado em sites abertos para esta versão (Regra 3)',
    });
    return;
  }

  try {
    // Revalida no guard antes de pedir ao site externo
    const guard = await auditarUrl(fonte.url);
    if (!guard.ok) {
      await limparFonte(releaseId);
      res.status(404).json({ success: false, error: `Fonte rejeitada pelo guard de segurança: ${guard.motivo}` });
      return;
    }

    // Encaminha Range para suporte a seek no player do app
    const headers: Record<string, string> = { 'User-Agent': USER_AGENT };
    const range = req.headers.range;
    if (typeof range === 'string') headers['Range'] = range;

    const upstream = await axios.get(fonte.url, {
      responseType: 'stream',
      timeout: 30 * 1000,
      headers,
      maxRedirects: 3,
      beforeRedirect: criarBeforeRedirect(),
      validateStatus: (s) => s < 500,
    });

    if (upstream.status >= 400) {
      (upstream.data as NodeJS.ReadableStream & { resume?: () => void }).resume?.();
      await limparFonte(releaseId);
      res.status(502).json({ success: false, error: `A fonte externa respondeu HTTP ${upstream.status}` });
      return;
    }

    res.status(upstream.status); // 200 ou 206 (Partial Content)
    res.setHeader('Content-Type', String(upstream.headers['content-type'] ?? 'audio/mpeg'));
    const contentLength = upstream.headers['content-length'];
    if (contentLength) res.setHeader('Content-Length', String(contentLength));
    const contentRange = upstream.headers['content-range'];
    if (contentRange) res.setHeader('Content-Range', String(contentRange));
    res.setHeader('Accept-Ranges', 'bytes');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('X-Audio-Source-Provider', fonte.provider);

    const stream = upstream.data as NodeJS.ReadableStream & { destroy?: () => void };
    stream.pipe(res);

    // Se o cliente fechar a conexão, derruba o stream de origem
    req.on('close', () => stream.destroy?.());
    stream.on('error', (err: Error) => {
      console.error(`[AudioController] Erro no stream da fonte (releaseId=${releaseId}):`, err.message);
      if (!res.headersSent) {
        res.status(500).json({ success: false, error: 'Falha ao transmitir áudio' });
      } else if (!res.writableEnded) {
        res.end();
      }
    });
  } catch (err) {
    console.error(`[AudioController] Erro ao iniciar stream (releaseId=${releaseId}):`, err);
    await limparFonte(releaseId).catch(() => undefined);
    if (!res.headersSent) {
      res.status(500).json({ success: false, error: 'Erro interno ao processar áudio' });
    }
  }
}

// ============================================================
// GET /api/releases/:id/download?format=mp3|flac
// Pipeline: cache → deduplicação (leader/follower) → download HTTP da fonte
// → FFmpeg (se necessário) → validação → cache PERMANENTE → cliente.
// Correções: o cache não é mais apagado no finally (antes, set() gravava um
// arquivo que o próprio fluxo deletava) e cada requisição serve o seu próprio
// res (antes, o 2º cliente ficava pendurado esperando uma promise já resolvida).
// ============================================================
export async function downloadAudio(req: Request, res: Response): Promise<void> {
  const releaseId = parseInt(req.params['id'] ?? '0', 10);
  const startTime = Date.now();

  console.log(`[AudioDownload] releaseId=${releaseId} status=starting`);

  if (!releaseId) {
    res.status(400).json({ success: false, error: 'ID de release inválido' });
    return;
  }

  const release = await buscarRelease(releaseId);
  if (!release) {
    res.status(404).json({ success: false, error: 'Release não encontrada' });
    return;
  }

  // Formato solicitado (mp3 padrão; flac lossless)
  const queryFormat = req.query['format'] as string | undefined;
  const formatoAudio = queryFormat === 'flac' ? 'flac' : 'mp3';
  const mimeType = formatoAudio === 'flac' ? 'audio/flac' : 'audio/mpeg';

  const nomeArquivo = `${release.artist_name} - ${release.work_title} - ${release.version_name}`
    .replace(/[<>:"/\\|?*]/g, '')
    .trim()
    .substring(0, 200);

  try {
    // Passo 1: cache permanente — HIT entrega direto
    const cached = await downloadCache.get(releaseId, formatoAudio);
    if (cached) {
      console.log(`[AudioDownload] releaseId=${releaseId} status=cache-hit format=${formatoAudio}`);
      await servirArquivo(req, res, cached.filePath, nomeArquivo, mimeType, 'HIT', releaseId);
      return;
    }

    console.log(`[AudioDownload] releaseId=${releaseId} status=cache-miss format=${formatoAudio}`);

    // Passo 2: deduplicação — o produtor devolve o CAMINHO em cache e nunca
    // escreve na Response. Líder e seguidores servem cada um ao seu req/res.
    const caminhoCache = await downloadDeduplication.execute(releaseId, formatoAudio, async () => {
      // Re-confere o cache dentro do lock: quem chegou depois do líder acerta aqui
      const recemProduzido = await downloadCache.get(releaseId, formatoAudio);
      if (recemProduzido) return recemProduzido.filePath;
      return produzirArquivoCache(release, formatoAudio);
    });

    await servirArquivo(req, res, caminhoCache, nomeArquivo, mimeType, 'MISS', releaseId);

    const totalDuration = (Date.now() - startTime) / 1000;
    console.log(`[AudioDownload] releaseId=${releaseId} status=completed total=${totalDuration}s`);
  } catch (err: unknown) {
    const erro = err as DownloadError;
    const totalDuration = (Date.now() - startTime) / 1000;
    console.error(`[AudioDownload] releaseId=${releaseId} status=failed duration=${totalDuration}s error=`, erro?.message ?? err);

    if (!res.headersSent) {
      res.status(erro?.type === DownloadErrorType.NO_SUITABLE_SOURCE ? 404 : 503).json({
        success: false,
        error: erro?.message || 'Falha ao baixar áudio',
        errorType: erro?.type ?? DownloadErrorType.INTERNAL_ERROR,
      });
    }
  }
}

// Produz o arquivo de áudio e devolve o caminho PERMANENTE dentro do cache.
// Arquivos temporários são apagados no finally — o cache nunca é deletado.
async function produzirArquivoCache(
  release: ReleaseAudioRow,
  formatoAudio: string
): Promise<string> {
  const releaseId = release.id;

  const fonte = await resolverFonte(release);
  if (!fonte) {
    throw erroDownload(
      'Nenhum áudio encontrado em sites abertos para esta versão (Regra 3)',
      DownloadErrorType.NO_SUITABLE_SOURCE,
      false
    );
  }

  // Diretório temporário de trabalho (sempre apagado; o cache fica fora daqui)
  const tempDir = path.join(__dirname, '../../temp/audio');
  await fs.mkdir(tempDir, { recursive: true });
  const timestamp = Date.now();
  const sourceFile = path.join(tempDir, `source_${releaseId}_${timestamp}.bin`);
  const outputFile = path.join(tempDir, `output_${releaseId}_${timestamp}.${formatoAudio}`);
  const temporarios: string[] = [sourceFile, outputFile];

  // Passo 1: baixar o arquivo da fonte externa (com retry)
  console.log(`[AudioDownload] releaseId=${releaseId} stage=fetch status=start provider=${fonte.provider}`);
  try {
    await baixarComRetry(fonte.url, sourceFile, releaseId);
    console.log(`[AudioDownload] releaseId=${releaseId} stage=fetch status=complete`);

    // Passo 2: detectar o formato real da fonte
    const formatoFonte = await detectAudioFormat(sourceFile);
    let arquivoFinal = outputFile;
    let needsConversion = true;

    if (formatoFonte) {
      console.log(`[AudioDownload] releaseId=${releaseId} stage=detect format=${formatoFonte.format} codec=${formatoFonte.codec}`);
      if (formatoAudio === 'mp3' && formatoFonte.codec === 'mp3') needsConversion = false;
      else if (formatoAudio === 'flac' && formatoFonte.codec === 'flac') needsConversion = false;
    }

    if (needsConversion) {
      // Passo 3: converter com FFmpeg para o formato pedido
      console.log(`[AudioDownload] releaseId=${releaseId} stage=ffmpeg status=converting`);
      const ffmpegStart = Date.now();

      await withTimeout(
        new Promise<void>((resolve, reject) => {
          const cmd = ffmpeg(sourceFile).setFfmpegPath(ffmpegPath || 'ffmpeg').output(outputFile);

          if (formatoAudio === 'flac') {
            cmd.audioCodec('flac').audioFrequency(44100).audioChannels(2);
          } else {
            cmd.audioCodec('libmp3lame').audioBitrate('320k').audioFrequency(44100).audioChannels(2);
          }

          cmd
            .on('end', () => {
              console.log(`[AudioDownload] releaseId=${releaseId} stage=ffmpeg duration=${(Date.now() - ffmpegStart) / 1000}s status=success`);
              resolve();
            })
            .on('error', (err) => {
              console.error(`[AudioDownload] releaseId=${releaseId} stage=ffmpeg status=failed error=${err.message}`);
              reject(erroDownload('Falha ao converter áudio', DownloadErrorType.CONVERSION_FAILED, false));
            })
            .run();
        }),
        TIMEOUTS.FFMPEG,
        'Timeout ao converter áudio (FFmpeg)'
      );
    } else {
      // Fonte já está no formato pedido — usa o arquivo baixado direto
      arquivoFinal = sourceFile;
      console.log(`[AudioDownload] releaseId=${releaseId} stage=ffmpeg status=skipped source-already-in-format`);
    }

    // Passo 4: validar assinatura do arquivo final
    await validarArquivo(arquivoFinal, formatoAudio, releaseId);

    // Passo 5: mover para o cache PERMANENTE e devolver o caminho definitivo.
    // set() move o arquivo (rename) — o unlink do finally vira no-op seguro.
    const caminhoCache = await downloadCache.set(releaseId, formatoAudio, arquivoFinal);
    if (!caminhoCache) {
      throw erroDownload('Falha ao gravar arquivo no cache', DownloadErrorType.INTERNAL_ERROR, false);
    }

    return caminhoCache;
  } finally {
    // Limpeza: SOMENTE temporários — o cache permanente nunca é tocado aqui
    for (const arquivo of temporarios) {
      await fs.unlink(arquivo).catch(() => undefined);
    }
  }
}

// Baixa a fonte para um arquivo local, com limite de tamanho e 1 retry
async function baixarComRetry(url: string, destino: string, releaseId: number): Promise<void> {
  let ultimaFalha: DownloadError | null = null;

  for (let tentativa = 1; tentativa <= 2; tentativa++) {
    try {
      const guard = await auditarUrl(url);
      if (!guard.ok) {
        throw erroDownload(`Fonte rejeitada pelo guard: ${guard.motivo}`, DownloadErrorType.SOURCE_UNAVAILABLE, false);
      }

      const resposta = await axios.get(url, {
        responseType: 'stream',
        timeout: TIMEOUTS.DOWNLOAD,
        headers: { 'User-Agent': USER_AGENT },
        maxRedirects: 3,
        beforeRedirect: criarBeforeRedirect(),
        validateStatus: (s) => s < 400,
      });

      // Rejeita cedo respostas que não são áudio
      const contentType = String(resposta.headers['content-type'] ?? '');
      const ehAudio = contentType.toLowerCase().startsWith('audio') ||
        /\.(mp3|flac|wav|m4a|aac|ogg|opus|webm|wma)(\?|$)/i.test(url);
      if (!ehAudio) {
        (resposta.data as NodeJS.ReadableStream & { resume?: () => void }).resume?.();
        throw erroDownload(
          `A fonte não entregou áudio (content-type: ${contentType || 'desconhecido'})`,
          DownloadErrorType.FORMAT_UNAVAILABLE,
          false
        );
      }

      const declarado = parseInt(String(resposta.headers['content-length'] ?? '0'), 10);
      if (declarado > TAMANHO_MAX_AUDIO) {
        (resposta.data as NodeJS.ReadableStream & { resume?: () => void }).resume?.();
        throw erroDownload(
          `Arquivo grande demais (${Math.round(declarado / 1024 / 1024)} MB)`,
          DownloadErrorType.FILE_TOO_LARGE,
          false
        );
      }

      await gravarStreamComLimite(resposta.data, destino);
      return;
    } catch (err: unknown) {
      await fs.unlink(destino).catch(() => undefined);

      const erro = (err instanceof Error ? err : new Error(String(err))) as DownloadError;
      if (!erro.type) {
        const msg = String(erro.message ?? '');
        if (/status code 40[1-9]|status code 41[0-9]/.test(msg)) {
          erro.type = DownloadErrorType.SOURCE_UNAVAILABLE;
          erro.retryable = false;
        } else {
          erro.type = DownloadErrorType.TEMPORARY_NETWORK_ERROR;
          erro.retryable = true;
        }
      }

      console.warn(`[AudioDownload] releaseId=${releaseId} tentativa=${tentativa} falhou: ${erro.message}`);
      ultimaFalha = erro;

      if (erro.retryable === false) break;
      if (tentativa < 2) await new Promise((r) => setTimeout(r, 1500));
    }
  }

  throw ultimaFalha ?? erroDownload('Falha desconhecida ao baixar da fonte', DownloadErrorType.INTERNAL_ERROR, false);
}

// Grava um stream HTTP em disco respeitando o limite de tamanho
async function gravarStreamComLimite(stream: NodeJS.ReadableStream, destino: string): Promise<void> {
  const saida = createWriteStream(destino);
  let baixado = 0;

  await new Promise<void>((resolve, reject) => {
    const origem = stream as NodeJS.ReadableStream & { destroy?: () => void };

    origem.on('data', (chunk: Buffer) => {
      baixado += chunk.length;
      if (baixado > TAMANHO_MAX_AUDIO) {
        origem.destroy?.();
        saida.destroy();
        reject(erroDownload(
          `Download excedeu ${Math.round(TAMANHO_MAX_AUDIO / 1024 / 1024)} MB`,
          DownloadErrorType.FILE_TOO_LARGE,
          false
        ));
      }
    });
    origem.on('error', (err: Error) => {
      saida.destroy();
      reject(err);
    });
    saida.on('error', (err: Error) => {
      origem.destroy?.();
      reject(err);
    });
    saida.on('finish', () => resolve());
    origem.pipe(saida);
  });
}

// Detecta formato/codec reais do arquivo baixado via ffprobe
async function detectAudioFormat(filePath: string): Promise<{ format: string; codec: string } | null> {
  try {
    return await withTimeout(
      new Promise((resolve, reject) => {
        ffmpeg(filePath)
          .setFfmpegPath(ffmpegPath || 'ffmpeg')
          // ffprobe próprio: sem isso o fluent-ffmpeg procura no PATH e falha
          // ("Cannot find ffprobe"), forçando conversão até de arquivos já válidos
          .setFfprobePath(ffprobePath || 'ffprobe')
          .ffprobe((err, metadata) => {
            if (err) return reject(err);
            resolve({
              format: metadata.format?.format_name || '',
              codec: metadata.streams?.[0]?.codec_name || '',
            });
          });
      }),
      TIMEOUTS.VALIDATION,
      'Timeout ao inspecionar arquivo (ffprobe)'
    );
  } catch (error) {
    console.error('[AudioController] Erro ao detectar formato:', error);
    return null;
  }
}

// Valida a assinatura do arquivo final (MP3: ID3/sync; FLAC: "fLaC")
async function validarArquivo(arquivo: string, formato: string, releaseId: number): Promise<void> {
  console.log(`[AudioDownload] releaseId=${releaseId} stage=validation status=validating`);

  await withTimeout(
    (async () => {
      const buffer = await fs.readFile(arquivo);

      if (formato === 'flac') {
        const assinatura = buffer.subarray(0, 4).toString('ascii');
        if (assinatura !== 'fLaC') {
          throw erroDownload('Arquivo gerado não é um FLAC válido', DownloadErrorType.VALIDATION_FAILED, false);
        }
      } else {
        const b = buffer.subarray(0, 3);
        const ehId3 = b[0] === 0x49 && b[1] === 0x44 && b[2] === 0x33;
        const ehMpegSync = b[0] === 0xff && (b[1] & 0xe0) === 0xe0;
        if (!ehId3 && !ehMpegSync) {
          throw erroDownload('Arquivo gerado não é um MP3 válido', DownloadErrorType.VALIDATION_FAILED, false);
        }
      }
    })(),
    TIMEOUTS.VALIDATION,
    'Timeout ao validar arquivo'
  );

  console.log(`[AudioDownload] releaseId=${releaseId} stage=validation status=complete`);
}

// Entrega o arquivo em cache ao cliente (stream em disco, sem ler tudo em memória)
async function servirArquivo(
  req: Request,
  res: Response,
  caminho: string,
  nomeArquivo: string,
  mimeType: string,
  statusCache: 'HIT' | 'MISS',
  releaseId: number
): Promise<void> {
  const stats = await fs.stat(caminho);
  const extensao = caminho.split('.').pop() ?? 'mp3';

  res.setHeader('Content-Type', mimeType);
  res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(nomeArquivo)}.${extensao}"`);
  res.setHeader('Content-Length', String(stats.size));
  res.setHeader('Cache-Control', 'public, max-age=86400');
  res.setHeader('X-Cache', statusCache);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');

  await new Promise<void>((resolve, reject) => {
    const stream = createReadStream(caminho);
    stream.on('error', reject);
    req.on('close', () => stream.destroy());
    stream.on('end', () => resolve());
    stream.pipe(res);
  });

  console.log(`[AudioDownload] releaseId=${releaseId} stage=send status=sent cache=${statusCache} size=${stats.size}`);
}

// ============================================================
// POST /api/releases/:id/audio-source  { url }
// Registra uma fonte direta em site aberto fornecida pelo usuário/painel.
// Valida contra o guard (Regra 3 + anti-SSRF) antes de salvar.
// ============================================================
export async function definirFonteAudio(req: Request, res: Response): Promise<void> {
  const releaseId = parseInt(req.params['id'] ?? '0', 10);
  const url = typeof req.body?.['url'] === 'string' ? (req.body['url'] as string).trim() : '';

  if (!releaseId) {
    res.status(400).json({ success: false, error: 'ID de release inválido' });
    return;
  }
  if (!url) {
    res.status(400).json({ success: false, error: 'Informe a URL da fonte de áudio (body: { url })' });
    return;
  }

  const release = await buscarRelease(releaseId);
  if (!release) {
    res.status(404).json({ success: false, error: 'Release não encontrada' });
    return;
  }

  // 1. Tenta como arquivo de áudio direto
  const resultado = await directLinkProvider.searchInUrl(url);
  let urlArquivo = resultado.status === 'SUCCESS' && resultado.candidates.length > 0
    ? resultado.candidates[0]?.url ?? null
    : null;

  // 2. Senão, tenta como página de blog/forum que hospeda o arquivo
  if (!urlArquivo) {
    const naPagina = await genericWebProvider.searchInUrl(url);
    if (naPagina.status === 'SUCCESS' && naPagina.candidates.length > 0) {
      urlArquivo = naPagina.candidates[0]?.url ?? null;
    }
  }

  if (!urlArquivo) {
    res.status(400).json({
      success: false,
      error: 'Não foi possível validar uma fonte de áudio nessa URL',
      detalhe: resultado.error ?? 'URL rejeitada (plataforma proibida, formato inválido ou indisponível)',
    });
    return;
  }

  const fonte: FonteAudio = { url: urlArquivo, provider: 'direct-link', pageUrl: url };
  await persistirFonte(releaseId, fonte);

  res.json({
    success: true,
    message: 'Fonte de áudio registrada na release',
    fonte: { url: fonte.url, provider: fonte.provider, pageUrl: fonte.pageUrl },
  });
}
