// Controller de artistas (artists).
// Endpoints: GET /api/artists/:id e GET /api/artists/:id/works

import { Request, Response, NextFunction } from 'express';
import { RowDataPacket } from 'mysql2';
import pool from '../config/database';
import { ErroAplicacao } from '../middleware/errorHandler';

// GET /api/artists/:id — detalhes de um artista específico
export async function detalharArtista(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const id = parseInt(req.params['id']!, 10);

    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT
         id,
         name,
         country,
         created_at
       FROM artists
       WHERE id = ?`,
      [id]
    );

    if (rows.length === 0) {
      throw new ErroAplicacao('Artista não encontrado.', 404);
    }

    const row = rows[0]!;
    res.json({
      success: true,
      data: {
        id:         row['id'],
        name:       row['name'],
        country:    row['country'],
        created_at: row['created_at'],
      },
    });
  } catch (err) {
    next(err);
  }
}

// GET /api/artists/:id/works — todas as obras de um artista
export async function listarObrasArtista(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const id     = parseInt(req.params['id']!, 10);
    const limit  = Math.min(parseInt(req.query['limit']  as string || '100', 10), 100);
    const offset = Math.max(parseInt(req.query['offset'] as string || '0',   10), 0);

    // Verifica se o artista existe
    const [artistRows] = await pool.execute<RowDataPacket[]>(
      `SELECT id, name, country FROM artists WHERE id = ?`,
      [id]
    );
    if (artistRows.length === 0) {
      throw new ErroAplicacao('Artista não encontrado.', 404);
    }

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
       WHERE w.artist_id = ?
       ORDER BY w.original_release_year DESC, w.title ASC
       LIMIT ? OFFSET ?`,
      [id, limit, offset]
    );

    const [countRows] = await pool.execute<RowDataPacket[]>(
      `SELECT COUNT(*) AS total FROM works WHERE artist_id = ?`,
      [id]
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
        artist: {
          id:      artistRows[0]!['id'],
          name:    artistRows[0]!['name'],
          country: artistRows[0]!['country'],
        },
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
