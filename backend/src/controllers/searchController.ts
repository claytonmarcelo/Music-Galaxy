// Controller de busca musical.
// Implementa o endpoint principal GET /api/search?q={termo}.
// Consulta o banco local primeiro; se não houver dados suficientes
// ou o cache tiver expirado, dispara a ingestão das fontes externas
// antes de responder — tudo de forma transparente para o cliente.

import { Request, Response, NextFunction } from 'express';
import { RowDataPacket } from 'mysql2';
import pool from '../config/database';
import { ingerirPorTermo } from '../services/ingestion/searchOrchestrator';
import { RespostaPaginada, ReleaseCompleto } from '../types';
import { ErroAplicacao } from '../middleware/errorHandler';

// Quantidade mínima de releases no banco local para considerar que o termo
// já foi ingerido antes. Abaixo disso, força nova ingestão.
const MIN_RELEASES_LOCAL = 1;

// Monta cláusula WHERE dinâmica por palavras do termo de busca.
// Cada palavra vira um LIKE independente, combinados com AND para
// garantir que todos os termos estejam presentes em algum campo do registro.
function montarWhereBusca(palavras: string[]): { clausula: string; params: string[] } {
  const blocos: string[] = [];
  const params: string[] = [];

  for (const palavra of palavras) {
    const p = `%${palavra}%`;
    // Cada palavra deve aparecer em pelo menos um dos campos pesquisáveis
    blocos.push(`(w.title LIKE ? OR a.name LIKE ? OR r.version_name LIKE ? OR r.album_name LIKE ?)`);
    params.push(p, p, p, p);
  }

  return {
    clausula: blocos.length > 0 ? blocos.join(' AND ') : '1=1',
    params,
  };
}

// Busca releases no banco local com todos os dados relacionados.
async function buscarReleasesLocal(
  termo: string,
  limit: number,
  offset: number
): Promise<{ releases: ReleaseCompleto[]; total: number }> {
  // Divide o termo em palavras individuais (mínimo 2 caracteres cada)
  // para suportar buscas como "Daft Punk One More Time"
  const palavras = termo.trim().split(/\s+/).filter(p => p.length >= 2);
  if (palavras.length === 0) return { releases: [], total: 0 };

  const { clausula, params } = montarWhereBusca(palavras);

  // Consulta principal — JOIN entre todas as tabelas relacionadas
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
     JOIN works          w  ON r.work_id          = w.id
     JOIN artists        a  ON w.artist_id         = a.id
     JOIN release_types  rt ON r.release_type_id   = rt.id
     JOIN metadata_sources ms ON r.metadata_source_id = ms.id
     WHERE ${clausula}
     ORDER BY a.name ASC, w.title ASC, r.release_year ASC
     LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );

  // Contagem total para paginação
  const [countRows] = await pool.execute<RowDataPacket[]>(
    `SELECT COUNT(*) AS total
     FROM releases r
     JOIN works          w  ON r.work_id        = w.id
     JOIN artists        a  ON w.artist_id       = a.id
     JOIN release_types  rt ON r.release_type_id = rt.id
     WHERE ${clausula}`,
    params
  );

  const total = (countRows[0]?.['total'] as number) ?? 0;

  const releases: ReleaseCompleto[] = (rows as any[]).map(row => ({
    id:                   row['id'],
    work_id:              row['work_id'],
    version_name:         row['version_name'],
    album_name:           row['album_name'],
    release_year:         row['release_year'],
    label:                row['label'],
    country:              row['country'],
    quality:              row['quality'],
    cover_url:            row['cover_url'],      // null = sem capa oficial (Regra 1)
    release_type:         row['release_type'],
    release_type_category: row['release_type_category'],
    metadata_source:      row['metadata_source'],
    source_reference_url: row['source_reference_url'],
    work_title:           row['work_title'],
    artist_name:          row['artist_name'],
    artist_country:       row['artist_country'],
    original_release_year: row['original_release_year'],
  }));

  return { releases, total };
}

// Handler do GET /api/search?q={termo}
export async function buscarMusicas(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const termo  = (req.query['q'] as string).trim();
    const limit  = Math.min(parseInt(req.query['limit']  as string || '50', 10), 100);
    const offset = Math.max(parseInt(req.query['offset'] as string || '0',  10), 0);
    const page   = Math.floor(offset / limit) + 1;

    // Tenta busca local primeiro
    const local = await buscarReleasesLocal(termo, limit, offset);

    // Se há dados locais suficientes, responde direto (do banco local = "cache" natural)
    if (local.total >= MIN_RELEASES_LOCAL) {
      const resposta: RespostaPaginada<ReleaseCompleto> = {
        success: true,
        data: {
          results:    local.releases,
          total:      local.total,
          page,
          per_page:   limit,
          fromCache:  true,
        },
      };
      res.json(resposta);
      return;
    }

    // Sem dados locais — dispara ingestão das fontes externas
    await ingerirPorTermo(termo);

    // Após a ingestão, consulta o banco novamente
    const posIngestion = await buscarReleasesLocal(termo, limit, offset);

    const resposta: RespostaPaginada<ReleaseCompleto> = {
      success: true,
      data: {
        results:   posIngestion.releases,
        total:     posIngestion.total,
        page,
        per_page:  limit,
        fromCache: false,
      },
    };
    res.json(resposta);
  } catch (err) {
    next(err);
  }
}

// Handler do POST /api/search/ingest
// Uso interno: força resincronização manual de um termo (manutenção/admin).
export async function forcarIngestion(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { q } = req.body as { q?: string };

    if (!q || typeof q !== 'string' || q.trim().length === 0) {
      throw new ErroAplicacao('Campo "q" é obrigatório no body.', 400);
    }

    const resultado = await ingerirPorTermo(q.trim());

    res.json({
      success: true,
      data: {
        termo:           q.trim(),
        worksCreated:    resultado.worksCreated,
        releasesCreated: resultado.releasesCreated,
        fontesChamadas:  resultado.fontesChamadas,
        fromCache:       resultado.fromCache,
      },
    });
  } catch (err) {
    next(err);
  }
}
