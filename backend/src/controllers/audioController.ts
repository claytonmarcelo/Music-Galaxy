// Controller de Áudio — Streaming e Download via YouTube.
// Expõe dois endpoints para o app mobile consumir:
//   GET /api/releases/:id/stream   → faz pipe do áudio ao vivo do YouTube
//   GET /api/releases/:id/download → entrega o arquivo de áudio completo para download
//
// A URL de stream do YouTube é resolvida sob demanda (evita links expirados no banco).

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

const youtube = new YoutubeAdapter();

// Dados mínimos da release necessários para o streaming
interface ReleaseAudioRow extends RowDataPacket {
  id: number;
  youtube_video_id: string | null;
  audio_preview_url: string | null;
  artist_name: string;
  work_title: string;
  version_name: string;
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
async function garantirVideoId(release: ReleaseAudioRow): Promise<string | null> {
  if (release.youtube_video_id) {
    // Verifica se o vídeo ainda está disponível
    const disponivel = await youtube.verificarDisponibilidade(release.youtube_video_id);
    if (disponivel) return release.youtube_video_id;

    // Vídeo foi removido — busca um novo
    console.warn(`[AudioController] Vídeo ${release.youtube_video_id} indisponível — buscando substituto`);
  }

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

// GET /api/releases/:id/download
// Entrega o áudio completo como download com nome de arquivo formatado.
// Pipeline: yt-dlp → arquivo temporário → FFmpeg → arquivo final → validação → cliente
export async function downloadAudio(req: Request, res: Response): Promise<void> {
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
  
  let arquivoFinal = '';
  let arquivoParaRemover: string[] = [sourceFile];

  try {
    // Garante que o diretório temporário existe
    await fs.mkdir(tempDir, { recursive: true });

    const queryFormat = req.query['format'] as string | undefined;
    let formatoAudio = 'mp3';
    let extensao = 'mp3';
    let mimeType = 'audio/mpeg';
    
    if (queryFormat === 'flac') {
      formatoAudio = 'flac';
      extensao = 'flac';
      mimeType = 'audio/flac';
    }

    arquivoFinal = `${outputFile}.${extensao}`;
    arquivoParaRemover.push(arquivoFinal);

    const nomeArquivo = `${release.artist_name} - ${release.work_title} - ${release.version_name}`
      .replace(/[<>:"/\\|?*]/g, '')
      .trim()
      .substring(0, 200);

    console.log(`[AudioController] Download - Iniciando pipeline para videoId: ${videoId}, formato: ${extensao}`);

    // Passo 1: Baixar áudio fonte com yt-dlp
    const url = `https://www.youtube.com/watch?v=${videoId}`;
    console.log(`[AudioController] Download - Baixando áudio fonte com yt-dlp`);
    
    await youtubeDl(url, {
      format: 'bestaudio[ext=m4a]/bestaudio/best',
      noPlaylist: true,
      ffmpegLocation: ffmpegPath || undefined,
      output: sourceFile,
    });

    console.log(`[AudioController] Download - Áudio fonte baixado: ${sourceFile}`);

    // Passo 2: Converter com FFmpeg
    console.log(`[AudioController] Download - Convertendo para ${extensao} com FFmpeg`);
    
    await new Promise<void>((resolve, reject) => {
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
          console.log(`[AudioController] Download - Conversão concluída: ${arquivoFinal}`);
          resolve();
        })
        .on('error', (err) => {
          console.error('[AudioController] Download - Erro na conversão FFmpeg:', err);
          reject(err);
        })
        .run();
    });

    // Passo 3: Validar arquivo final
    console.log(`[AudioController] Download - Validando arquivo ${extensao}`);
    
    if (extensao === 'flac') {
      // Validar assinatura FLAC (fLaC = 66 4C 61 43)
      const buffer = await fs.readFile(arquivoFinal);
      const signature = buffer.subarray(0, 4).toString('ascii');
      
      if (signature !== 'fLaC') {
        console.error(`[AudioController] Download - Arquivo não é FLAC válido. Assinatura: ${signature}`);
        throw new Error('Arquivo gerado não é um FLAC válido');
      }
      console.log(`[AudioController] Download - Assinatura FLAC validada: ${signature}`);
    } else {
      // Validar MP3 verificando bytes iniciais (ID3 tag ou sync bytes)
      const buffer = await fs.readFile(arquivoFinal);
      const firstBytes = buffer.subarray(0, 3);
      
      // MP3 pode começar com ID3v2 tag (49 44 33 = "ID3")
      // ou com sync bytes (FF FB ou FF FA)
      const isID3 = firstBytes[0] === 0x49 && firstBytes[1] === 0x44 && firstBytes[2] === 0x33;
      const isSync = firstBytes[0] === 0xFF && (firstBytes[1] === 0xFB || firstBytes[1] === 0xFA);
      
      if (!isID3 && !isSync) {
        console.error(`[AudioController] Download - Arquivo não é MP3 válido. Bytes: ${firstBytes.toString('hex')}`);
        throw new Error('Arquivo gerado não é um MP3 válido');
      }
      
      console.log(`[AudioController] Download - Assinatura MP3 validada: ${isID3 ? 'ID3' : 'Sync bytes'}`);
    }

    // Passo 4: Enviar arquivo para o cliente
    console.log(`[AudioController] Download - Enviando arquivo para o cliente`);
    
    res.setHeader('Content-Type', mimeType);
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(nomeArquivo)}.${extensao}"`);
    res.setHeader('Cache-Control', 'no-cache, no-store');
    res.setHeader('X-Video-Id', videoId);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');

    const fileStream = await fs.readFile(arquivoFinal);
    res.send(fileStream);

  } catch (err) {
    console.error('[AudioController] Download - Erro no pipeline:', err);
    if (!res.headersSent) {
      res.status(503).json({ success: false, error: 'Falha ao baixar áudio' });
    }
  } finally {
    // Passo 5: Limpeza de arquivos temporários
    console.log(`[AudioController] Download - Limpando arquivos temporários`);
    
    for (const arquivo of arquivoParaRemover) {
      try {
        await fs.unlink(arquivo);
        console.log(`[AudioController] Download - Removido: ${arquivo}`);
      } catch (err) {
        console.warn(`[AudioController] Download - Não foi possível remover ${arquivo}:`, err);
      }
    }
  }
}
