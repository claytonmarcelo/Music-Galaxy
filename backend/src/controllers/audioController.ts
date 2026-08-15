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

  try {
    const queryFormat = req.query['format'] as string | undefined;
    let qualidade: QualidadeAudio = 'original';
    let extensao = 'mp3';
    
    if (queryFormat === 'flac') {
      qualidade = 'flac';
      extensao = 'flac';
    } else if (queryFormat === 'mp3') {
      qualidade = 'mp3_320';
      extensao = 'mp3';
    }

    const nomeArquivo = `${release.artist_name} - ${release.work_title} - ${release.version_name}`
      .replace(/[<>:"/\\|?*]/g, '')
      .trim()
      .substring(0, 200);

    let mimeType = 'audio/mpeg';
    if (extensao === 'flac') mimeType = 'audio/flac';

    res.setHeader('Content-Type', mimeType);
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(nomeArquivo)}.${extensao}"`);
    res.setHeader('Cache-Control', 'no-cache, no-store');
    res.setHeader('X-Video-Id', videoId);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');

    // Usa yt-dlp para download (ytdl-core está falhando com 403)
    console.log(`[AudioController] Download - Usando yt-dlp para videoId: ${videoId}, formato: ${extensao}`);
    const url = `https://www.youtube.com/watch?v=${videoId}`;
    
    const result = await youtubeDl(url, {
      format: 'bestaudio[ext=m4a]/bestaudio',
      extractAudio: true,
      audioFormat: extensao === 'flac' ? 'flac' : 'mp3',
      audioQuality: 0,
      noPlaylist: true,
      ffmpegLocation: ffmpegPath || undefined,
      output: '-',
    });

    console.log(`[AudioController] Download - yt-dlp iniciado com sucesso`);
    
    // youtube-dl-exec retorna um buffer/string para output '-'
    // Precisamos converter para stream para enviar ao cliente
    const buffer = Buffer.from(result as string);
    res.send(buffer);
  } catch (err) {
    console.error('[AudioController] Download - Erro ao iniciar yt-dlp:', err);
    if (!res.headersSent) {
      res.status(503).json({ success: false, error: 'Falha ao baixar áudio' });
    }
  }
}
