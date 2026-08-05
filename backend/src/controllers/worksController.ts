// Controller de obras musicais (works).
// Endpoints GET /api/works/:id e GET /api/works/:id/releases

import { Request, Response, NextFunction } from 'express';
import { RowDataPacket } from 'mysql2';
import pool from '../config/database';
import { ErroAplicacao } from '../middleware/errorHandler';
import { ReleaseCompleto } from '../types';

// GET /api/works/:id — detalhes de uma obra específica
export async function detalharWork(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const id = parseInt(req.params['id']!, 10);

    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT
         w.id,
         w.title,
         w.original_release_year,
         w.created_at,
         a.id      AS artist_id,
         a.name    AS artist_name,
         a.country AS artist_country
       FROM works w
       JOIN artists a ON w.artist_id = a.id
       WHERE w.id = ?`,
      [id]
    );

    if (rows.length === 0) {
      throw new ErroAplicacao('Obra não encontrada.', 404);
    }

    const row = rows[0]!;
    res.json({
      success: true,
      data: {
        id:                   row['id'],
        title:                row['title'],
        original_release_year: row['original_release_year'],
        created_at:           row['created_at'],
        artist: {
          id:      row['artist_id'],
          name:    row['artist_name'],
          country: row['artist_country'],
        },
      },
    });
  } catch (err) {
    next(err);
  }
}

// GET /api/works/:id/releases — todas as versões de uma obra
export async function listarReleasesDeWork(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const id     = parseInt(req.params['id']!, 10);
    const limit  = Math.min(parseInt(req.query['limit']  as string || '100', 10), 100);
    const offset = Math.max(parseInt(req.query['offset'] as string || '0',   10), 0);

    // Verifica se a obra existe
    const [worksRows] = await pool.execute<RowDataPacket[]>(
      `SELECT id, title FROM works WHERE id = ?`,
      [id]
    );
    if (worksRows.length === 0) {
      throw new ErroAplicacao('Obra não encontrada.', 404);
    }

    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT
         r.id,
         r.work_id,
         r.version_name,
         r.album_name,
         r.release_year,
         r.label,
         r.country,
         r.quality,
         r.cover_url,
         r.source_reference_url,
         r.audio_preview_url,
         r.streaming_url,
         r.download_url,
         rt.name        AS release_type,
         rt.category    AS release_type_category,
         ms.name        AS metadata_source,
         w.title        AS work_title,
         w.original_release_year,
         a.name         AS artist_name,
         a.country      AS artist_country
       FROM releases r
       JOIN works           w  ON r.work_id          = w.id
       JOIN artists         a  ON w.artist_id         = a.id
       JOIN release_types   rt ON r.release_type_id   = rt.id
       JOIN metadata_sources ms ON r.metadata_source_id = ms.id
       WHERE r.work_id = ?
       ORDER BY r.release_year ASC, r.version_name ASC
       LIMIT ? OFFSET ?`,
      [id, limit, offset]
    );

    const [countRows] = await pool.execute<RowDataPacket[]>(
      `SELECT COUNT(*) AS total FROM releases WHERE work_id = ?`,
      [id]
    );
    const total = (countRows[0]?.['total'] as number) ?? 0;

    const releases: ReleaseCompleto[] = (rows as any[]).map(row => ({
      id:                    row['id'],
      work_id:               row['work_id'],
      version_name:          row['version_name'],
      album_name:            row['album_name'],
      release_year:          row['release_year'],
      label:                 row['label'],
      country:               row['country'],
      quality:               row['quality'],
      cover_url:             row['cover_url'],
      source_reference_url:  row['source_reference_url'],
      audio_preview_url:     row['audio_preview_url'],
      streaming_url:        row['streaming_url'],
      download_url:         row['download_url'],
      release_type:          row['release_type'],
      release_type_category: row['release_type_category'],
      metadata_source:       row['metadata_source'],
      work_title:            row['work_title'],
      artist_name:           row['artist_name'],
      artist_country:        row['artist_country'],
      original_release_year: row['original_release_year'],
    }));

    res.json({
      success: true,
      data: {
        work: {
          id:    worksRows[0]!['id'],
          title: worksRows[0]!['title'],
        },
        results:  releases,
        total,
        limit,
        offset,
      },
    });
  } catch (err) {
    next(err);
  }
}


// GET /api/works/by-decade/:decade — obras de uma década específica
export async function listarWorksPorDecada(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const decada = parseInt(req.params['decade']!, 10);
    const limit  = Math.min(parseInt(req.query['limit']  as string || '100', 10), 100);
    const offset = Math.max(parseInt(req.query['offset'] as string || '0',   10), 0);

    // Valida a década (0000s, 1900s, 1910s, etc)
    if (isNaN(decada) || decada < 0 || decada % 10 !== 0) {
      throw new ErroAplicacao('Década deve ser um múltiplo de 10 (ex: 1990, 2000, 2010).', 400);
    }

    const anoInicio = decada;
    const anoFim = decada + 9;

    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT
         w.id,
         w.title,
         w.original_release_year,
         w.created_at,
         a.id      AS artist_id,
         a.name    AS artist_name,
         a.country AS artist_country
       FROM works w
       JOIN artists a ON w.artist_id = a.id
       WHERE w.original_release_year >= ? AND w.original_release_year <= ?
       ORDER BY w.original_release_year DESC, w.title ASC
       LIMIT ? OFFSET ?`,
      [anoInicio, anoFim, limit, offset]
    );

    const [countRows] = await pool.execute<RowDataPacket[]>(
      `SELECT COUNT(*) AS total FROM works 
       WHERE original_release_year >= ? AND original_release_year <= ?`,
      [anoInicio, anoFim]
    );
    const total = (countRows[0]?.['total'] as number) ?? 0;

    const works = (rows as any[]).map(row => ({
      id:                   row['id'],
      title:                row['title'],
      original_release_year: row['original_release_year'],
      created_at:           row['created_at'],
      artist: {
        id:      row['artist_id'],
        name:    row['artist_name'],
        country: row['artist_country'],
      },
    }));

    res.json({
      success: true,
      data: {
        decade: `${anoInicio}s`,
        results: works,
        total,
        limit,
        offset,
      },
    });
  } catch (err) {
    next(err);
  }
}
