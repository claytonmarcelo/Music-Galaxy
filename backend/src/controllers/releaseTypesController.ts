// Controller de tipos de release (catálogo de release_types).
// Endpoint GET /api/release-types

import { Request, Response, NextFunction } from 'express';
import { RowDataPacket } from 'mysql2';
import pool from '../config/database';

// GET /api/release-types — lista todos os tipos cadastrados
export async function listarReleaseTypes(
  _req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT id, name, category FROM release_types ORDER BY category ASC, name ASC`
    );

    const tipos = (rows as any[]).map(row => ({
      id:       row['id'],
      name:     row['name'],
      category: row['category'],
    }));

    res.json({
      success: true,
      data: {
        total:  tipos.length,
        types:  tipos,
      },
    });
  } catch (err) {
    next(err);
  }
}
