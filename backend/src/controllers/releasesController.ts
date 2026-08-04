// Controller de releases (versões específicas de uma obra).
// Endpoint GET /api/releases/:id

import { Request, Response, NextFunction } from 'express';
import { RowDataPacket } from 'mysql2';
import pool from '../config/database';
import { ErroAplicacao } from '../middleware/errorHandler';

// GET /api/releases/:id — detalhes de uma versão específica
export async function detalharRelease(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const id = parseInt(req.params['id']!, 10);

    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT
         r.id,
         r.version_name,
         r.album_name,
         r.release_year,
         r.label,
         r.country,
         r.quality,
         r.cover_url,
         r.source_reference_url,
         r.external_id,
         r.created_at,
         rt.name        AS release_type,
         rt.category    AS release_type_category,
         ms.name        AS metadata_source,
         ms.base_url    AS metadata_source_url,
         w.id           AS work_id,
         w.title        AS work_title,
         w.original_release_year,
         a.id           AS artist_id,
         a.name         AS artist_name,
         a.country      AS artist_country
       FROM releases r
       JOIN works           w  ON r.work_id          = w.id
       JOIN artists         a  ON w.artist_id         = a.id
       JOIN release_types   rt ON r.release_type_id   = rt.id
       JOIN metadata_sources ms ON r.metadata_source_id = ms.id
       WHERE r.id = ?`,
      [id]
    );

    if (rows.length === 0) {
      throw new ErroAplicacao('Release não encontrado.', 404);
    }

    const row = rows[0]!;

    res.json({
      success: true,
      data: {
        id:            row['id'],
        version_name:  row['version_name'],
        album_name:    row['album_name'],
        release_year:  row['release_year'],
        label:         row['label'],
        country:       row['country'],
        quality:       row['quality'],
        cover_url:     row['cover_url'],        // null = sem capa oficial (Regra 1)
        release_type:  row['release_type'],
        release_type_category: row['release_type_category'],
        metadata_source: row['metadata_source'],
        source_reference_url: row['source_reference_url'],
        external_id:   row['external_id'],
        created_at:    row['created_at'],
        work: {
          id:                   row['work_id'],
          title:                row['work_title'],
          original_release_year: row['original_release_year'],
        },
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


// GET /api/releases/by-date — releases recentes ordenados por data
export async function listarReleasesPorData(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const limit  = Math.min(parseInt(req.query['limit']  as string || '100', 10), 100);
    const offset = Math.max(parseInt(req.query['offset'] as string || '0',   10), 0);

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
       ORDER BY r.created_at DESC
       LIMIT ? OFFSET ?`,
      [limit, offset]
    );

    const [countRows] = await pool.execute<RowDataPacket[]>(
      `SELECT COUNT(*) AS total FROM releases`
    );
    const total = (countRows[0]?.['total'] as number) ?? 0;

    const releases = (rows as any[]).map(row => ({
      id:                    row['id'],
      work_id:               row['work_id'],
      version_name:          row['version_name'],
      album_name:            row['album_name'],
      release_year:          row['release_year'],
      label:                 row['label'],
      country:               row['country'],
      quality:               row['quality'],
      cover_url:             row['cover_url'],
      release_type:          row['release_type'],
      release_type_category: row['release_type_category'],
      metadata_source:       row['metadata_source'],
      source_reference_url:  row['source_reference_url'],
      work_title:            row['work_title'],
      artist_name:           row['artist_name'],
      artist_country:        row['artist_country'],
      original_release_year: row['original_release_year'],
    }));

    res.json({
      success: true,
      data: {
        results: releases,
        total,
        limit,
        offset,
      },
    });
  } catch (err) {
    next(err);
  }
}
