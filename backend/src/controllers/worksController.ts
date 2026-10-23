// Controller de obras musicais (works).
// Endpoints GET /api/works/:id, GET /api/works/:id/releases e
// GET /api/works/by-decade/:decade.
//
// O ano efetivo da obra usa `original_release_year` quando existe e, caso
// contrário, o menor ano conhecido entre as versões (ANO_EFETIVO_SQL). Sem
// esse fallback, as obras cujo metadado veio sem ano ficavam invisíveis na
// exploração por década, mesmo tendo versões com áudio.

import { Request, Response, NextFunction } from 'express';
import { RowDataPacket } from 'mysql2';
import pool from '../config/database';
import { ErroAplicacao } from '../middleware/errorHandler';
import { ReleaseCompleto } from '../types';
import { ANO_EFETIVO_SQL, baseUrlDaRequisicao, urlsDeMidia } from '../utils/urls';

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
         ${ANO_EFETIVO_SQL} AS effective_year,
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
        id:                    row['id'],
        title:                 row['title'],
        original_release_year: row['effective_year'],
        effective_year:        row['effective_year'],
        created_at:            row['created_at'],
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

// GET /api/works/:id/releases — todas as versões COM ÁUDIO de uma obra
export async function listarReleasesDeWork(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const id     = parseInt(req.params['id']!, 10);
    const limit  = Math.min(parseInt(req.query['limit']  as string || '100', 10), 100);
    const offset = Math.max(parseInt(req.query['offset'] as string || '0',   10), 0);
    const baseUrl = baseUrlDaRequisicao(req);

    // Dados da obra (inclui o artista para a tela de detalhes poder navegar)
    const [worksRows] = await pool.execute<RowDataPacket[]>(
      `SELECT
         w.id,
         w.title,
         ${ANO_EFETIVO_SQL} AS effective_year,
         a.id      AS artist_id,
         a.name    AS artist_name,
         a.country AS artist_country
       FROM works w
       JOIN artists a ON w.artist_id = a.id
       WHERE w.id = ?`,
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
         r.audio_source_url,
         r.audio_source_provider,
         r.audio_source_page_url,
         rt.name        AS release_type,
         rt.category    AS release_type_category,
         ms.name        AS metadata_source,
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
       -- Regra do usuário: sem fonte de áudio, a versão não aparece no app
       WHERE r.work_id = ? AND r.audio_source_url IS NOT NULL
       ORDER BY r.release_year ASC, r.version_name ASC
       LIMIT ? OFFSET ?`,
      [id, limit, offset]
    );

    const [countRows] = await pool.execute<RowDataPacket[]>(
      `SELECT COUNT(*) AS total FROM releases
       WHERE work_id = ? AND audio_source_url IS NOT NULL`,
      [id]
    );
    const total = (countRows[0]?.['total'] as number) ?? 0;

    const releases: ReleaseCompleto[] = rows.map(row => {
      const releaseId = row['id'] as number;
      const midia = urlsDeMidia(baseUrl, releaseId);
      return {
        id:                    releaseId,
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
        audio_preview_url:     row['audio_preview_url'] as string | null,
        // Mesmo contrato da busca: URLs do backend, nunca colunas legadas.
        streaming_url:         midia.streaming_url,
        download_url:          midia.download_url,
        audio_source_url:      row['audio_source_url'] as string | null,
        audio_source_provider: row['audio_source_provider'] as string | null,
        audio_source_page_url: row['audio_source_page_url'] as string | null,
        work_title:            row['work_title'] as string,
        artist_id:             row['artist_id'] as number,
        artist_name:           row['artist_name'] as string,
        artist_country:        row['artist_country'] as string | null,
        original_release_year: row['original_release_year'] as number | null,
      };
    });

    const work = worksRows[0]!;
    res.json({
      success: true,
      data: {
        work: {
          id:                    work['id'],
          title:                 work['title'],
          original_release_year: work['effective_year'],
          effective_year:        work['effective_year'],
          artist: {
            id:      work['artist_id'],
            name:    work['artist_name'],
            country: work['artist_country'],
          },
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

    // Valida a década (1900, 1910, 1920...) — nunca aceita valores soltos.
    if (isNaN(decada) || decada < 1900 || decada > 2100 || decada % 10 !== 0) {
      throw new ErroAplicacao('Década inválida. Use um múltiplo de 10 entre 1900 e 2100 (ex.: 1990).', 400);
    }

    const anoInicio = decada;
    const anoFim = decada + 9;

    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT
         w.id,
         w.title,
         ${ANO_EFETIVO_SQL} AS effective_year,
         w.created_at,
         a.id      AS artist_id,
         a.name    AS artist_name,
         a.country AS artist_country
       FROM works w
       JOIN artists a ON w.artist_id = a.id
       WHERE ${ANO_EFETIVO_SQL} BETWEEN ? AND ?
         -- Regra do usuário: obra só aparece se tiver ao menos uma versão
         -- com fonte de áudio aberta resolvida
         AND EXISTS (
           SELECT 1 FROM releases r2
           WHERE r2.work_id = w.id AND r2.audio_source_url IS NOT NULL
         )
       ORDER BY effective_year DESC, w.title ASC
       LIMIT ? OFFSET ?`,
      [anoInicio, anoFim, limit, offset]
    );

    const [countRows] = await pool.execute<RowDataPacket[]>(
      `SELECT COUNT(*) AS total FROM works w
       WHERE ${ANO_EFETIVO_SQL} BETWEEN ? AND ?
         AND EXISTS (
           SELECT 1 FROM releases r2
           WHERE r2.work_id = w.id AND r2.audio_source_url IS NOT NULL
         )`,
      [anoInicio, anoFim]
    );
    const total = (countRows[0]?.['total'] as number) ?? 0;

    const works = rows.map(row => ({
      id:                    row['id'] as number,
      title:                 row['title'] as string,
      original_release_year: row['effective_year'] as number | null,
      created_at:            row['created_at'] as Date,
      artist: {
        id:      row['artist_id'] as number,
        name:    row['artist_name'] as string,
        country: row['artist_country'] as string | null,
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
