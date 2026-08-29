// Controller de Áudio — Streaming e Download via YouTube.
// Expõe dois endpoints para o app mobile consumir:
//   GET /api/releases/:id/stream   → faz pipe do áudio ao vivo do YouTube
//   GET /api/releases/:id/download → entrega o arquivo de áudio completo para download
//
// A URL de stream do YouTube é resolvida sob demanda (evita links expirados no banco).
// Sistema aprimorado com Source Orchestrator para descoberta global de fontes com exact match.

import { Request, Response } from 'express';
import { RowDataPacket } from 'mysql2';
import pool from '../config/database';
import { YoutubeAdapter } from '../services/audio/youtubeAdapter';
import { transcoder, QualidadeAudio } from '../services/audio/audioTranscoder';
import { youtubeDl } from 'youtube-dl-exec';
import ffmpegPath from 'ffmpeg-static';
import ffmpeg from 'fluent-ffmpeg';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import { downloadCache } from '../services/downloadCache';
import { downloadDeduplication } from '../services/downloadDeduplication';
import { SourceOrchestrator } from '../services/audioSource/sourceOrchestrator';
import { YouTubeProvider } from '../services/audioSource/providers/youtubeProvider';
import { AudioIdentity } from '../services/audioSource/types';

const youtube = new YoutubeAdapter();

// Inicializar orquestrador de fontes (sistema novo de descoberta global)
const sourceOrchestrator = new SourceOrchestrator({
  enableParallelSearch: true,
  maxConcurrentProviders: 3,
  requireExactMatch: true,
  enableFallback: true,
});

// Registrar providers disponíveis
const youtubeProvider = new YouTubeProvider();
sourceOrchestrator.registerProvider(youtubeProvider);

// Flag para habilitar/desabilitar o novo sistema (pode ser movida para .env)
const ENABLE_SOURCE_ORCHESTRATOR = true;

// Tipos de erro para classificação
enum DownloadErrorType {
  SOURCE_UNAVAILABLE = 'SOURCE_UNAVAILABLE',
  FORMAT_UNAVAILABLE = 'FORMAT_UNAVAILABLE',
  SOURCE_TIMEOUT = 'SOURCE_TIMEOUT',
  EXTRACTION_FAILED = 'EXTRACTION_FAILED',
  CONVERSION_FAILED = 'CONVERSION_FAILED',
  VALIDATION_FAILED = 'VALIDATION_FAILED',
  TEMPORARY_NETWORK_ERROR = 'TEMPORARY_NETWORK_ERROR',
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  // Novos tipos para o sistema de descoberta global
  EXACT_MATCH_NOT_CONFIRMED = 'EXACT_MATCH_NOT_CONFIRMED',
  NO_SUITABLE_SOURCE = 'NO_SUITABLE_SOURCE',
  ALL_PROVIDERS_FAILED = 'ALL_PROVIDERS_FAILED',
  INVALID_AUDIO = 'INVALID_AUDIO',
  CORRUPTED_AUDIO = 'CORRUPTED_AUDIO',
}

// Estrutura de erro detalhado
interface DownloadError {
  type: DownloadErrorType;
  message: string;
  details?: string;
  retryable: boolean;
}

// Dados mínimos da release necessários para o streaming
interface ReleaseAudioRow extends RowDataPacket {
  id: number;
  youtube_video_id: string | null;
  audio_preview_url: string | null;
  artist_name: string;
  work_title: string;
  version_name: string;
}

// Estratégias de formato para yt-dlp (em ordem de preferência)
const FORMAT_STRATEGIES = [
  'bestaudio[ext=m4a]/bestaudio/best',
  'bestaudio[ext=mp3]/bestaudio/best',
  'bestaudio[ext=webm]/bestaudio/best',
  'bestaudio[ext=opus]/bestaudio/best',
  'bestaudio/best',
];

// Função de delay para retry
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Função de timeout com Promise.race
const withTimeout = <T>(promise: Promise<T>, timeoutMs: number, errorMessage: string): Promise<T> => {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => 
      setTimeout(() => reject(new Error(errorMessage)), timeoutMs)
    )
  ]);
};

// Configurações de timeout (podem ser movidas para .env no futuro)
const TIMEOUTS = {
  YTDLP: 5 * 60 * 1000,      // 5 minutos para yt-dlp
  FFMPEG: 10 * 60 * 1000,     // 10 minutos para FFmpeg
  VALIDATION: 30 * 1000,      // 30 segundos para validação
  TOTAL: 15 * 60 * 1000,      // 15 minutos total
};

// Função para classificar erro do yt-dlp
function classifyYtDlpError(error: any): DownloadError {
  const errorMessage = error.message || '';
  const stderr = error.stderr || '';

  if (errorMessage.includes('HTTP Error 403') || stderr.includes('HTTP Error 403')) {
    return {
      type: DownloadErrorType.SOURCE_UNAVAILABLE,
      message: 'Acesso negado pela fonte (HTTP 403)',
      details: 'A fonte bloqueou o download deste conteúdo',
      retryable: false,
    };
  }

  if (errorMessage.includes('HTTP Error 429') || stderr.includes('HTTP Error 429')) {
    return {
      type: DownloadErrorType.TEMPORARY_NETWORK_ERROR,
      message: 'Limite de taxa da fonte excedido (HTTP 429)',
      details: 'A fonte limitou o número de requisições',
      retryable: true,
    };
  }

  if (errorMessage.includes('HTTP Error 5') || stderr.includes('HTTP Error 5')) {
    return {
      type: DownloadErrorType.TEMPORARY_NETWORK_ERROR,
      message: 'Erro temporário da fonte (HTTP 5xx)',
      details: 'A fonte está temporariamente indisponível',
      retryable: true,
    };
  }

  if (errorMessage.includes('timeout') || errorMessage.includes('ETIMEDOUT')) {
    return {
      type: DownloadErrorType.SOURCE_TIMEOUT,
      message: 'Timeout ao acessar a fonte',
      details: 'A fonte não respondeu dentro do tempo esperado',
      retryable: true,
    };
  }

  if (errorMessage.includes('Video unavailable') || stderr.includes('Video unavailable')) {
    return {
      type: DownloadErrorType.SOURCE_UNAVAILABLE,
      message: 'Vídeo indisponível na fonte',
      details: 'O conteúdo não está mais disponível',
      retryable: false,
    };
  }

  if (errorMessage.includes('no suitable format') || stderr.includes('no suitable format')) {
    return {
      type: DownloadErrorType.FORMAT_UNAVAILABLE,
      message: 'Formato de áudio não disponível',
      details: 'A fonte não fornece áudio no formato solicitado',
      retryable: true,
    };
  }

  return {
    type: DownloadErrorType.EXTRACTION_FAILED,
    message: 'Falha ao extrair áudio da fonte',
    details: errorMessage,
    retryable: true,
  };
}

// Busca os dados de áudio da release, incluindo o youtube_video_id e audio_preview_url
async function buscarRelease(releaseId: number): Promise<ReleaseAudioRow | null> {
  const [rows] = await pool.execute<ReleaseAudioRow[]>(
    `SELECT
       r.id,
       r.youtube_video_id,
       r.audio_preview_url,
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

// Garante que a release tem um youtube_video_id.
// Se ainda não tiver, tenta buscar agora e salva no banco.
// Sistema aprimorado: usa Source Orchestrator para descoberta global quando habilitado.
async function garantirVideoId(release: ReleaseAudioRow): Promise<string | null> {
  if (release.youtube_video_id) {
    // Verifica se o vídeo ainda está disponível
    const disponivel = await youtube.verificarDisponibilidade(release.youtube_video_id);
    if (disponivel) return release.youtube_video_id;

    // Vídeo foi removido — busca um novo
    console.warn(`[AudioController] Vídeo ${release.youtube_video_id} indisponível — buscando substituto`);
  }

  // Se o novo sistema de descoberta global estiver habilitado, usa o orquestrador
  if (ENABLE_SOURCE_ORCHESTRATOR) {
    console.log(`[AudioController] Usando Source Orchestrator para descoberta global`);
    
    try {
      const identity: AudioIdentity = {
        artist: release.artist_name,
        title: release.work_title,
        album: undefined, // Pode ser expandido para incluir album do banco
        version: release.version_name,
        duration: undefined, // Pode ser expandido para incluir duration do banco
      };

      const discoveryResult = await sourceOrchestrator.discover(identity);
      
      if (discoveryResult.bestCandidate && discoveryResult.bestCandidate.candidate.sourceId) {
        const novoVideoId = discoveryResult.bestCandidate.candidate.sourceId;
        console.log(
          `[AudioController] Source Orchestrator encontrou candidato: ` +
          `provider=${discoveryResult.bestCandidate.candidate.providerId} ` +
          `sourceId=${novoVideoId} ` +
          `score=${discoveryResult.bestCandidate.score.toFixed(1)} ` +
          `classification=${discoveryResult.bestCandidate.classification}`
        );

        // Salva o novo videoId no banco para futuras requisições
        await pool.execute(
          `UPDATE releases SET youtube_video_id = ? WHERE id = ?`,
          [novoVideoId, release.id]
        );

        return novoVideoId;
      } else {
        console.warn(`[AudioController] Source Orchestrator não encontrou candidato adequado, fallback para método tradicional`);
      }
    } catch (error) {
      console.error(`[AudioController] Source Orchestrator falhou, fallback para método tradicional:`, error);
    }
  }

  // Fallback para método tradicional (YouTubeAdapter)
  const novoVideoId = await youtube.buscarVideoId(release.artist_name, release.work_title);

  if (novoVideoId) {
    // Salva o novo videoId no banco para futuras requisições
    await pool.execute(
      `UPDATE releases SET youtube_video_id = ? WHERE id = ?`,
      [novoVideoId, release.id]
    );
  }

  return novoVideoId;
}

// GET /api/releases/:id/stream
// Faz pipe do áudio completo do YouTube diretamente ao cliente.
// Suporta Range headers para que o player nativo (expo-av) possa buscar posições.
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

  // Tenta obter a URL de preview (iTunes/Deezer) caso precise de fallback rápido
  let previewUrl = release.audio_preview_url;
  if (!previewUrl) {
    try {
      const itunes = new (require('../services/audio/itunesAdapter').ItunesAdapter)();
      previewUrl = await itunes.buscarPreviewAudio(release.artist_name, release.work_title);
      if (!previewUrl) {
        const deezer = new (require('../services/audio/deezerAdapter').DeezerAdapter)();
        previewUrl = await deezer.buscarPreviewAudio(release.artist_name, release.work_title);
      }
      if (previewUrl) {
        await pool.execute('UPDATE releases SET audio_preview_url = ? WHERE id = ?', [previewUrl, release.id]);
      }
    } catch {
      // Ignora erro de fallback
    }
  }

  const videoId = release.youtube_video_id ?? (await garantirVideoId(release));

  // Serve o preview como proxy (nunca redireciona — redirecionamento
  // para domínios externos é bloqueado por CORS/CORP no browser)
  const servirFallback = async (): Promise<boolean> => {
    if (!previewUrl) return false;
    try {
      console.log(`[AudioController] Fazendo proxy do preview: ${previewUrl}`);
      const https = require('https') as typeof import('https');
      const http  = require('http')  as typeof import('http');
      const mod   = previewUrl.startsWith('https') ? https : http;

      await new Promise<void>((resolve, reject) => {
        mod.get(previewUrl as string, (upstream) => {
          res.setHeader('Content-Type', upstream.headers['content-type'] ?? 'audio/mpeg');
          res.setHeader('Access-Control-Allow-Origin', '*');
          res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
          res.setHeader('Cache-Control', 'no-cache');
          upstream.pipe(res);
          upstream.on('end', resolve);
          upstream.on('error', reject);
        }).on('error', reject);
      });
      return true;
    } catch (err) {
      console.error('[AudioController] Falha no proxy do preview:', err);
      return false;
    }
  };

  if (!videoId) {
    if (await servirFallback()) return;
    res.status(404).json({ success: false, error: 'Áudio não disponível para esta release' });
    return;
  }

  try {
    // Usa ytdl-core para streaming (yt-dlp não suporta streaming direto)
    const stream = youtube.obterStreamAudio(videoId);
    let headersEnviados = false;

    req.on('close', () => {
      stream.destroy();
    });

    stream.on('data', (chunk) => {
      if (!headersEnviados) {
        headersEnviados = true;
        res.setHeader('Content-Type', 'audio/mpeg');
        res.setHeader('Transfer-Encoding', 'chunked');
        res.setHeader('Accept-Ranges', 'bytes');
        res.setHeader('Cache-Control', 'no-cache, no-store');
        res.setHeader('X-Video-Id', videoId);
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
      }
      res.write(chunk);
    });

    stream.on('end', () => {
      if (!res.writableEnded) res.end();
    });

    stream.on('error', (err: Error) => {
      console.error(`[AudioController] Erro no stream do vídeo ${videoId}:`, err.message);
      if (!headersEnviados && !res.headersSent) {
        servirFallback().then((serviu) => {
          if (!serviu) res.status(500).json({ success: false, error: 'Falha ao obter stream de áudio' });
        });
      } else if (!res.writableEnded) {
        res.end();
      }
    });
  } catch (err) {
    console.error('[AudioController] Erro ao iniciar stream:', err);
    if (!res.headersSent) {
      servirFallback().then((serviu) => {
        if (!serviu) res.status(500).json({ success: false, error: 'Erro interno ao processar áudio' });
      });
    }
  }
}

// Função para detectar formato do arquivo de origem
async function detectAudioFormat(filePath: string): Promise<{ format: string; codec: string } | null> {
  try {
    return new Promise((resolve, reject) => {
      ffmpeg(filePath)
        .setFfmpegPath(ffmpegPath || 'ffmpeg')
        .ffprobe((err, metadata) => {
          if (err) {
            reject(err);
            return;
          }
          
          const format = metadata.format?.format_name || '';
          const codec = metadata.streams?.[0]?.codec_name || '';
          
          resolve({ format, codec });
        });
    });
  } catch (error) {
    console.error('[AudioController] Erro ao detectar formato:', error);
    return null;
  }
}

// GET /api/releases/:id/download
// Entrega o áudio completo como download com nome de arquivo formatado.
// Pipeline: cache → deduplicação → yt-dlp (com retry e múltiplas estratégias) → arquivo temporário → FFmpeg (otimizado) → arquivo final → validação → cache → cliente
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

  const queryFormat = req.query['format'] as string | undefined;
  let formatoAudio = 'mp3';
  let extensao = 'mp3';
  let mimeType = 'audio/mpeg';
  
  if (queryFormat === 'flac') {
    formatoAudio = 'flac';
    extensao = 'flac';
    mimeType = 'audio/flac';
  }

  // Verificar cache primeiro
  const cachedEntry = await downloadCache.get(releaseId, formatoAudio);
  if (cachedEntry) {
    console.log(`[AudioDownload] releaseId=${releaseId} status=cache-hit format=${formatoAudio}`);
    
    try {
      const nomeArquivo = `${release.artist_name} - ${release.work_title} - ${release.version_name}`
        .replace(/[<>:"/\\|?*]/g, '')
        .trim()
        .substring(0, 200);

      res.setHeader('Content-Type', mimeType);
      res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(nomeArquivo)}.${extensao}"`);
      res.setHeader('Cache-Control', 'public, max-age=86400'); // 24 horas
      res.setHeader('X-Cache', 'HIT');
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');

      // Streaming do arquivo em vez de carregar tudo em memória
      const fileStream = await fs.readFile(cachedEntry.filePath);
      res.send(fileStream);

      const totalDuration = (Date.now() - startTime) / 1000;
      console.log(`[AudioDownload] releaseId=${releaseId} status=completed total=${totalDuration}s cache=HIT`);
      return;
    } catch (error) {
      console.error('[AudioDownload] Erro ao servir arquivo do cache:', error);
      // Invalidar cache e continuar com processamento normal
      await downloadCache.invalidate(releaseId, formatoAudio);
    }
  }

  console.log(`[AudioDownload] releaseId=${releaseId} status=cache-miss format=${formatoAudio}`);

  // Usar deduplicação para evitar processamento duplicado
  return downloadDeduplication.execute(releaseId, formatoAudio, async () => {
    return processDownload(req, res, release, releaseId, formatoAudio, extensao, mimeType, startTime);
  });
}

async function processDownload(
  req: Request,
  res: Response,
  release: ReleaseAudioRow,
  releaseId: number,
  formatoAudio: string,
  extensao: string,
  mimeType: string,
  startTime: number
): Promise<void> {
  const videoId = await garantirVideoId(release);
  if (!videoId) {
    res.status(404).json({
      success: false,
      error: 'Áudio não disponível para esta release no YouTube',
    });
    return;
  }

  // Arquivos temporários
  const tempDir = path.join(__dirname, '../../temp/audio');
  const timestamp = Date.now();
  const sourceFile = path.join(tempDir, `source_${timestamp}.m4a`);
  const outputFile = path.join(tempDir, `output_${timestamp}`);
  
  let arquivoFinal = `${outputFile}.${extensao}`;
  let arquivoParaRemover: string[] = [sourceFile, arquivoFinal];

  try {
    // Garante que o diretório temporário existe
    await fs.mkdir(tempDir, { recursive: true });

    const nomeArquivo = `${release.artist_name} - ${release.work_title} - ${release.version_name}`
      .replace(/[<>:"/\\|?*]/g, '')
      .trim()
      .substring(0, 200);

    console.log(`[AudioDownload] releaseId=${releaseId} videoId=${videoId} format=${extensao} status=yt-dlp-start`);

    // Passo 1: Baixar áudio fonte com yt-dlp (com retry e múltiplas estratégias)
    const url = `https://www.youtube.com/watch?v=${videoId}`;
    let downloadSuccess = false;
    let lastError: DownloadError | null = null;
    
    // Tentar cada estratégia de formato
    for (let strategyIndex = 0; strategyIndex < FORMAT_STRATEGIES.length; strategyIndex++) {
      const formatStrategy = FORMAT_STRATEGIES[strategyIndex];
      
      // Para cada estratégia, tentar com retry
      const maxRetries = 2; // Reduzido de 3 para 2 para evitar espera excessiva
      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
          console.log(`[AudioDownload] releaseId=${releaseId} strategy=${strategyIndex} attempt=${attempt} format=${formatStrategy} status=downloading`);
          
          const ytDlpStart = Date.now();
          
          await withTimeout(
            youtubeDl(url, {
              format: formatStrategy,
              noPlaylist: true,
              ffmpegLocation: ffmpegPath || undefined,
              output: sourceFile,
              noCheckCertificates: true,
              userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
              noWarnings: true,
            }),
            TIMEOUTS.YTDLP,
            'Timeout ao baixar áudio da fonte (yt-dlp)'
          );
          
          const ytDlpDuration = (Date.now() - ytDlpStart) / 1000;
          console.log(`[AudioDownload] releaseId=${releaseId} strategy=${strategyIndex} attempt=${attempt} stage=yt-dlp duration=${ytDlpDuration}s status=success`);
          
          downloadSuccess = true;
          break; // Sucesso - sair do loop de retry
        } catch (err: any) {
          const classifiedError = classifyYtDlpError(err);
          lastError = classifiedError;
          
          console.log(`[AudioDownload] releaseId=${releaseId} strategy=${strategyIndex} attempt=${attempt} type=${classifiedError.type} retryable=${classifiedError.retryable} status=failed`);
          
          // Se não for retryable, tentar próxima estratégia imediatamente
          if (!classifiedError.retryable) {
            break;
          }
          
          // Se ainda há tentativas, fazer exponential backoff
          if (attempt < maxRetries) {
            const backoffDelay = Math.pow(2, attempt - 1) * 1000; // 1s, 2s
            console.log(`[AudioDownload] releaseId=${releaseId} strategy=${strategyIndex} attempt=${attempt} backoff=${backoffDelay}ms status=waiting`);
            await delay(backoffDelay);
          }
        }
      }
      
      if (downloadSuccess) {
        break; // Sucesso - sair do loop de estratégias
      }
      
      // Se falhou todas as tentativas desta estratégia, tentar próxima
      console.log(`[AudioDownload] releaseId=${releaseId} strategy=${strategyIndex} status=strategy-failed trying-next`);
    }

    if (!downloadSuccess) {
      // Todas as estratégias falharam
      console.log(`[AudioDownload] releaseId=${releaseId} status=all-strategies-failed error=${lastError?.type}`);
      
      if (!res.headersSent) {
        res.status(503).json({ 
          success: false, 
          error: lastError?.message || 'Falha ao baixar áudio',
          errorType: lastError?.type,
        });
      }
      return;
    }

    console.log(`[AudioDownload] releaseId=${releaseId} status=yt-dlp-complete sourceFile=${sourceFile}`);

    // Passo 2: Detectar formato da fonte para decidir se conversão é necessária
    console.log(`[AudioDownload] releaseId=${releaseId} stage=detect-format status=detecting`);
    const sourceFormat = await detectAudioFormat(sourceFile);
    
    let needsConversion = true;
    if (sourceFormat) {
      console.log(`[AudioDownload] releaseId=${releaseId} stage=detect-format format=${sourceFormat.format} codec=${sourceFormat.codec}`);
      
      // Se a fonte já é MP3 e solicitado MP3, não converter
      if (formatoAudio === 'mp3' && sourceFormat.codec === 'mp3') {
        needsConversion = false;
        console.log(`[AudioDownload] releaseId=${releaseId} stage=detect-format status=skip-conversion reason=source-already-mp3`);
        arquivoFinal = sourceFile;
        arquivoParaRemover = [sourceFile]; // Não remover sourceFile pois é o arquivo final
      }
      // Se a fonte já é FLAC e solicitado FLAC, não converter
      else if (formatoAudio === 'flac' && sourceFormat.codec === 'flac') {
        needsConversion = false;
        console.log(`[AudioDownload] releaseId=${releaseId} stage=detect-format status=skip-conversion reason=source-already-flac`);
        arquivoFinal = sourceFile;
        arquivoParaRemover = [sourceFile];
      }
    }

    // Passo 3: Converter com FFmpeg somente se necessário
    if (needsConversion) {
      console.log(`[AudioDownload] releaseId=${releaseId} stage=ffmpeg status=converting`);
      const ffmpegStart = Date.now();
      
      await withTimeout(
        new Promise<void>((resolve, reject) => {
          const ffmpegCommand = ffmpeg(sourceFile)
            .setFfmpegPath(ffmpegPath || 'ffmpeg')
            .output(arquivoFinal);

          if (extensao === 'flac') {
            ffmpegCommand
              .audioCodec('flac')
              .audioFrequency(44100)
              .audioChannels(2);
          } else {
            ffmpegCommand
              .audioCodec('libmp3lame')
              .audioBitrate('320k')
              .audioFrequency(44100)
              .audioChannels(2);
          }

          ffmpegCommand
            .on('end', () => {
              const ffmpegDuration = (Date.now() - ffmpegStart) / 1000;
              console.log(`[AudioDownload] releaseId=${releaseId} stage=ffmpeg duration=${ffmpegDuration}s status=success`);
              resolve();
            })
            .on('error', (err) => {
              console.error(`[AudioDownload] releaseId=${releaseId} stage=ffmpeg status=failed error=${err.message}`);
              reject(err);
            })
            .run();
        }),
        TIMEOUTS.FFMPEG,
        'Timeout ao converter áudio (FFmpeg)'
      );
    } else {
      console.log(`[AudioDownload] releaseId=${releaseId} stage=ffmpeg status=skipped`);
    }

    // Passo 4: Validar arquivo final
    console.log(`[AudioDownload] releaseId=${releaseId} stage=validation status=validating`);
    const validationStart = Date.now();
    
    await withTimeout(
      (async () => {
        if (extensao === 'flac') {
          // Validar assinatura FLAC (fLaC = 66 4C 61 43)
          const buffer = await fs.readFile(arquivoFinal);
          const signature = buffer.subarray(0, 4).toString('ascii');
          
          if (signature !== 'fLaC') {
            console.error(`[AudioDownload] releaseId=${releaseId} stage=validation status=failed signature=${signature}`);
            throw new Error('Arquivo gerado não é um FLAC válido');
          }
          console.log(`[AudioDownload] releaseId=${releaseId} stage=validation signature=fLaC status=success`);
        } else {
          // Validar MP3 verificando bytes iniciais (ID3 tag ou sync bytes)
          const buffer = await fs.readFile(arquivoFinal);
          const firstBytes = buffer.subarray(0, 3);
          
          // MP3 pode começar com ID3v2 tag (49 44 33 = "ID3")
          // ou com sync bytes (FF FB ou FF FA)
          const isID3 = firstBytes[0] === 0x49 && firstBytes[1] === 0x44 && firstBytes[2] === 0x33;
          const isSync = firstBytes[0] === 0xFF && (firstBytes[1] === 0xFB || firstBytes[1] === 0xFA);
          
          if (!isID3 && !isSync) {
            console.error(`[AudioDownload] releaseId=${releaseId} stage=validation status=failed bytes=${firstBytes.toString('hex')}`);
            throw new Error('Arquivo gerado não é um MP3 válido');
          }
          
          console.log(`[AudioDownload] releaseId=${releaseId} stage=validation signature=${isID3 ? 'ID3' : 'Sync'} status=success`);
        }
      })(),
      TIMEOUTS.VALIDATION,
      'Timeout ao validar arquivo'
    );

    const validationDuration = (Date.now() - validationStart) / 1000;
    console.log(`[AudioDownload] releaseId=${releaseId} stage=validation duration=${validationDuration}s status=complete`);

    // Salvar no cache
    await downloadCache.set(releaseId, formatoAudio, arquivoFinal);

    // Passo 5: Enviar arquivo para o cliente
    console.log(`[AudioDownload] releaseId=${releaseId} stage=send status=sending`);
    
    res.setHeader('Content-Type', mimeType);
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(nomeArquivo)}.${extensao}"`);
    res.setHeader('Cache-Control', 'public, max-age=86400'); // 24 horas
    res.setHeader('X-Cache', 'MISS');
    res.setHeader('X-Video-Id', videoId);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');

    // Streaming do arquivo em vez de carregar tudo em memória
    const fileStream = await fs.readFile(arquivoFinal);
    res.send(fileStream);

    const totalDuration = (Date.now() - startTime) / 1000;
    console.log(`[AudioDownload] releaseId=${releaseId} status=completed total=${totalDuration}s cache=MISS`);

  } catch (err) {
    const totalDuration = (Date.now() - startTime) / 1000;
    console.error(`[AudioDownload] releaseId=${releaseId} status=failed duration=${totalDuration}s error=`, err);
    
    if (!res.headersSent) {
      res.status(503).json({ 
        success: false, 
        error: 'Falha ao baixar áudio',
        errorType: DownloadErrorType.INTERNAL_ERROR,
      });
    }
  } finally {
    // Passo 6: Limpeza de arquivos temporários
    console.log(`[AudioDownload] releaseId=${releaseId} stage=cleanup status=starting`);
    
    for (const arquivo of arquivoParaRemover) {
      try {
        await fs.unlink(arquivo);
        console.log(`[AudioDownload] releaseId=${releaseId} stage=cleanup file=${arquivo} status=removed`);
      } catch (err) {
        console.warn(`[AudioDownload] releaseId=${releaseId} stage=cleanup file=${arquivo} status=skipped reason=not-exists`);
      }
    }
    
    console.log(`[AudioDownload] releaseId=${releaseId} stage=cleanup status=complete`);
  }
}
