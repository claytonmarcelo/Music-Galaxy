// Controller de releases (versões específicas de uma obra).
// Endpoint GET /api/releases/:id

import { Request, Response, NextFunction } from 'express';
import { RowDataPacket } from 'mysql2';
import pool from '../config/database';
import { ErroAplicacao } from '../middleware/errorHandler';
import { baseUrlDaRequisicao, urlsDeMidia, ANO_EFETIVO_SQL } from '../utils/urls';

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
         r.audio_source_url,
         r.audio_source_provider,
         r.audio_source_page_url,
         r.created_at,
         rt.name        AS release_type,
         rt.category    AS release_type_category,
         ms.name        AS metadata_source,
         ms.base_url    AS metadata_source_url,
         w.id           AS work_id,
         w.title        AS work_title,
         w.original_release_year,
         ${ANO_EFETIVO_SQL} AS effective_year,
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
    const idRelease = row['id'] as number;
    const midia = urlsDeMidia(baseUrlDaRequisicao(req), idRelease);

    res.json({
      success: true,
      data: {
        id:            idRelease,
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
        // URLs de mídia são sempre construídas pelo backend (Regra 3).
        streaming_url: midia.streaming_url,
        download_url:  midia.download_url,
        audio_source_url: row['audio_source_url'],
        audio_source_provider: row['audio_source_provider'],
        audio_source_page_url: row['audio_source_page_url'],
        work: {
          id:                   row['work_id'],
          title:                row['work_title'],
          original_release_year: row['original_release_year'],
          effective_year:       row['effective_year'],
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
    const baseUrl = baseUrlDaRequisicao(req);

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
         r.audio_source_url,
         r.audio_source_provider,
         r.audio_source_page_url,
         rt.name        AS release_type,
         rt.category    AS release_type_category,
         ms.name        AS metadata_source,
         w.title        AS work_title,
         w.original_release_year,
         ${ANO_EFETIVO_SQL} AS effective_year,
         a.id           AS artist_id,
         a.name         AS artist_name,
         a.country      AS artist_country
       FROM releases r
       JOIN works           w  ON r.work_id          = w.id
       JOIN artists         a  ON w.artist_id         = a.id
       JOIN release_types   rt ON r.release_type_id   = rt.id
       JOIN metadata_sources ms ON r.metadata_source_id = ms.id
       -- Regra do usuário: só exibir versões que já têm fonte de áudio aberta
       WHERE r.audio_source_url IS NOT NULL
       ORDER BY r.created_at DESC
       LIMIT ? OFFSET ?`,
      [limit, offset]
    );

    const [countRows] = await pool.execute<RowDataPacket[]>(
      // Contagem alinhada ao filtro acima, para a paginação bater
      `SELECT COUNT(*) AS total FROM releases WHERE audio_source_url IS NOT NULL`
    );
    const total = (countRows[0]?.['total'] as number) ?? 0;

    const releases = (rows as RowDataPacket[]).map(row => {
      const idRelease = row['id'] as number;
      const midia = urlsDeMidia(baseUrl, idRelease);
      return {
        id:                    idRelease,
        work_id:               row['work_id'] as number,
        version_name:          row['version_name'] as string,
        album_name:            row['album_name'] as string | null,
        release_year:          row['release_year'] as number | null,
        label:                 row['label'] as string | null,
        country:               row['country'] as string | null,
        quality:               row['quality'] as string | null,
        cover_url:             row['cover_url'] as string | null,
        release_type:          row['release_type'] as string,
        release_type_category: row['release_type_category'] as string,
        metadata_source:       row['metadata_source'] as string,
        source_reference_url:  row['source_reference_url'] as string | null,
        audio_source_url:      row['audio_source_url'] as string,
        audio_source_provider: row['audio_source_provider'] as string | null,
        audio_source_page_url: row['audio_source_page_url'] as string | null,
        streaming_url:         midia.streaming_url,
        download_url:          midia.download_url,
        work_title:            row['work_title'] as string,
        artist_id:             row['artist_id'] as number,
        artist_name:           row['artist_name'] as string,
        artist_country:        row['artist_country'] as string | null,
        original_release_year: row['original_release_year'] as number | null,
        effective_year:        row['effective_year'] as number | null,
      };
    });

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
