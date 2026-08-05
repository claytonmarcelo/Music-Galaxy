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

const youtube = new YoutubeAdapter();

// Dados mínimos da release necessários para o streaming
interface ReleaseAudioRow extends RowDataPacket {
  id: number;
  youtube_video_id: string | null;
  artist_name: string;
  work_title: string;
  version_name: string;
}

// Busca os dados de áudio da release, incluindo o youtube_video_id
async function buscarRelease(releaseId: number): Promise<ReleaseAudioRow | null> {
  const [rows] = await pool.execute<ReleaseAudioRow[]>(
    `SELECT
       r.id,
       r.youtube_video_id,
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

  const videoId = await garantirVideoId(release);
  if (!videoId) {
    res.status(404).json({
      success: false,
      error: 'Áudio não disponível para esta release no YouTube',
    });
    return;
  }

  try {
    // Cabeçalhos para streaming de áudio
    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Transfer-Encoding', 'chunked');
    res.setHeader('Accept-Ranges', 'bytes');
    res.setHeader('Cache-Control', 'no-cache, no-store');
    res.setHeader('X-Video-Id', videoId);

    const stream = youtube.obterStreamAudio(videoId);

    // Encerra a resposta se o cliente desconectar
    req.on('close', () => {
      stream.destroy();
    });

    stream.on('error', (err: Error) => {
      console.error(`[AudioController] Erro no stream do vídeo ${videoId}:`, err.message);
      if (!res.headersSent) {
        res.status(500).json({ success: false, error: 'Falha ao obter stream de áudio' });
      }
    });

    stream.pipe(res);
  } catch (err) {
    console.error('[AudioController] Erro ao iniciar stream:', err);
    if (!res.headersSent) {
      res.status(500).json({ success: false, error: 'Erro interno ao processar áudio' });
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
    let extensao = 'mp3'; // Padrão se for original sem conversão
    
    if (queryFormat === 'flac') {
      qualidade = 'flac';
      extensao = 'flac';
    } else if (queryFormat === 'mp3') {
      qualidade = 'mp3_320';
      extensao = 'mp3';
    }

    // Nome do arquivo sanitizado para evitar caracteres inválidos no sistema de arquivos
    const nomeArquivo = `${release.artist_name} - ${release.work_title} - ${release.version_name}`
      .replace(/[<>:"/\\|?*]/g, '')
      .trim()
      .substring(0, 200);

    // O YouTube envia o stream
    const rawStream = youtube.obterStreamAudio(videoId);
    // Transcodificador ajusta para a qualidade escolhida
    const finalStream = transcoder.transcodificar(rawStream, qualidade);

    let mimeType = 'audio/mpeg';
    if (extensao === 'flac') mimeType = 'audio/flac';

    res.setHeader('Content-Type', mimeType);
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(nomeArquivo)}.${extensao}"`);
    res.setHeader('Cache-Control', 'no-cache, no-store');
    res.setHeader('X-Video-Id', videoId);
    // Desativa Transfer-Encoding: chunked explícito se quisermos tentar fechar conexões, 
    // mas o express faz automático quando fazemos pipe()
    
    req.on('close', () => {
      rawStream.destroy();
    });

    rawStream.on('error', (err: Error) => {
      console.error(`[AudioController] Erro no stream do vídeo ${videoId}:`, err.message);
      if (!res.headersSent) {
        res.status(500).json({ success: false, error: 'Falha ao baixar áudio' });
      }
    });

    finalStream.pipe(res);
  } catch (err) {
    console.error('[AudioController] Erro ao iniciar download:', err);
    if (!res.headersSent) {
      res.status(500).json({ success: false, error: 'Erro interno ao processar download' });
    }
  }
}
