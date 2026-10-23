// Controller de busca musical.
// Implementa o endpoint principal GET /api/search?q={termo}.
// Consulta o banco local primeiro; se não houver dados suficientes
// ou o cache tiver expirado, dispara a ingestão das fontes externas
// antes de responder — tudo de forma transparente para o cliente.

import { Request, Response, NextFunction } from 'express';
import { RowDataPacket } from 'mysql2';
import pool from '../config/database';
import { ingerirPorTermo } from '../services/ingestion/searchOrchestrator';
import { resolverFonte, DadosReleaseParaAudio } from './audioController';
import { RespostaPaginada, ReleaseCompleto } from '../types';
import { ErroAplicacao } from '../middleware/errorHandler';

// Quantidade mínima de releases no banco local para considerar que o termo
// já foi ingerido antes. Abaixo disso, força nova ingestão.
const MIN_RELEASES_LOCAL = 1;

// Intervalo entre resoluções de áudio na fila em segundo plano.
// A descoberta consulta sites abertos (motor de busca) e precisa de ritmo
// suave para não disparar proteções anti-bot das fontes.
const INTERVALO_ENTRE_RESOLUCOES = 8000;

// Fila em memória de releases aguardando descoberta de fonte de áudio.
// Regra do usuário: o app só exibe versões que têm áudio. As releases sem
// fonte ficam fora da resposta, mas são resolvidas aqui em segundo plano,
// uma a uma, para aparecerem nas próximas buscas.
interface ItemFilaResolucao {
  id: number;
  version_name: string;
  work_title: string;
  artist_name: string;
}

const filaResolucao: ItemFilaResolucao[] = [];
let processandoFila = false;

// Coloca na fila as releases sem áudio encontradas numa busca.
// Recebe apenas as que já vêm sem fonte do banco — não é preciso revalidar.
function enfileirarResolucoes(releases: ItemFilaResolucao[]): void {
  let novas = 0;
  for (const r of releases) {
    if (filaResolucao.some((item) => item.id === r.id)) continue;
    filaResolucao.push({
      id:           r.id,
      version_name: r.version_name,
      work_title:   r.work_title,
      artist_name:  r.artist_name,
    });
    novas += 1;
  }
  if (novas > 0) void processarFilaResolucao();
}

// Processa a fila em série (uma resolução por vez, com intervalo).
async function processarFilaResolucao(): Promise<void> {
  if (processandoFila) return;
  processandoFila = true;
  try {
    while (filaResolucao.length > 0) {
      const item = filaResolucao.shift()!;
      try {
        // Re-checa no banco: se a fonte já foi salva por outro fluxo, pula
        const [linhas] = await pool.execute<RowDataPacket[]>(
          `SELECT audio_source_url FROM releases WHERE id = ? LIMIT 1`,
          [item.id]
        );
        if (linhas[0]?.['audio_source_url']) continue;

        const dados: DadosReleaseParaAudio = {
          id:                   item.id,
          audio_source_url:     null,
          audio_source_provider: null,
          audio_source_page_url: null,
          version_name:         item.version_name,
          work_title:           item.work_title,
          artist_name:          item.artist_name,
        };
        await resolverFonte(dados);
      } catch (erro) {
        console.error(
          `[SEARCH] Falha ao resolver áudio da release ${item.id}:`,
          erro instanceof Error ? erro.message : erro
        );
      }
      // Espaçamento para respeitar as fontes abertas consultadas
      await new Promise((resolve) => setTimeout(resolve, INTERVALO_ENTRE_RESOLUCOES));
    }
  } finally {
    processandoFila = false;
  }
}

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
// Quando `somenteComAudio` é true (Regra 7), o filtro acontece no SQL — antes
// ele era aplicado só depois do LIMIT, então uma versão com áudio que caísse
// além da primeira página nunca aparecia e a página vinha vazia.
async function buscarReleasesLocal(
  termo: string,
  limit: number,
  offset: number,
  baseUrl: string = 'http://localhost:3001',
  somenteComAudio: boolean = false
): Promise<{ releases: ReleaseCompleto[]; total: number }> {
  // Divide o termo em palavras individuais (mínimo 2 caracteres cada)
  // para suportar buscas como "Daft Punk One More Time"
  const palavras = termo.trim().split(/\s+/).filter(p => p.length >= 2);
  if (palavras.length === 0) return { releases: [], total: 0 };

  const { clausula, params } = montarWhereBusca(palavras);
  const filtroAudio = somenteComAudio ? ' AND r.audio_source_url IS NOT NULL' : '';

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
       r.audio_preview_url,
       r.audio_source_url,
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
     WHERE ${clausula}${filtroAudio}
     ORDER BY a.name ASC, w.title ASC, r.release_year ASC
     LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );

  // Contagem total para paginação — mesma condição da consulta principal
  const [countRows] = await pool.execute<RowDataPacket[]>(
    `SELECT COUNT(*) AS total
     FROM releases r
     JOIN works          w  ON r.work_id        = w.id
     JOIN artists        a  ON w.artist_id       = a.id
     WHERE ${clausula}${filtroAudio}`,
    params
  );

  const total = (countRows[0]?.['total'] as number) ?? 0;

  const releases: ReleaseCompleto[] = (rows as any[]).map(row => {
    const id = row['id'];
    return {
      id:                   id,
      work_id:              row['work_id'],
      version_name:         row['version_name'],
      album_name:           row['album_name'],
      release_year:         row['release_year'],
      label:                row['label'],
      country:              row['country'],
      quality:              row['quality'],
      cover_url:            row['cover_url'],      // null = sem capa oficial (Regra 1)
      source_reference_url: row['source_reference_url'],
      audio_preview_url:    row['audio_preview_url'],
      // Sempre aponta para os endpoints do backend (stream completo / download).
      // Os campos streaming_url/download_url do banco podem conter previews de 30s
      // (dados legados) e não devem ser usados como link de reprodução ou download.
      streaming_url:        `${baseUrl}/api/releases/${id}/stream`,
      download_url:         `${baseUrl}/api/releases/${id}/download`,
      audio_source_url:     row['audio_source_url'] ?? null,
      release_type:         row['release_type'],
      release_type_category: row['release_type_category'],
      metadata_source:      row['metadata_source'],
      work_title:           row['work_title'],
      artist_name:          row['artist_name'],
      artist_country:       row['artist_country'],
      original_release_year: row['original_release_year'],
    };
  });

  return { releases, total };
}

// Busca as releases do termo que ainda NÃO têm fonte de áudio (Regra 7).
// Devolve a contagem total (para a resposta) e uma amostra limitada para a
// fila de resolução em segundo plano — nunca milhares de itens de uma vez.
async function buscarPendentesAudio(
  termo: string,
  limiteFila: number
): Promise<{ total: number; itens: ItemFilaResolucao[] }> {
  const palavras = termo.trim().split(/\s+/).filter(p => p.length >= 2);
  if (palavras.length === 0) return { total: 0, itens: [] };

  const { clausula, params } = montarWhereBusca(palavras);

  const [countRows] = await pool.execute<RowDataPacket[]>(
    `SELECT COUNT(*) AS total
     FROM releases r
     JOIN works   w ON r.work_id  = w.id
     JOIN artists a ON w.artist_id = a.id
     WHERE ${clausula} AND r.audio_source_url IS NULL`,
    params
  );
  const total = (countRows[0]?.['total'] as number) ?? 0;

  if (total === 0) return { total: 0, itens: [] };

  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT r.id, r.version_name, w.title AS work_title, a.name AS artist_name
     FROM releases r
     JOIN works   w ON r.work_id  = w.id
     JOIN artists a ON w.artist_id = a.id
     WHERE ${clausula} AND r.audio_source_url IS NULL
     ORDER BY a.name ASC, w.title ASC, r.release_year ASC
     LIMIT ?`,
    [...params, limiteFila]
  );

  const itens: ItemFilaResolucao[] = rows.map(row => ({
    id:           row['id'] as number,
    version_name: row['version_name'] as string,
    work_title:   row['work_title'] as string,
    artist_name:  row['artist_name'] as string,
  }));

  return { total, itens };
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

    const host = req.get('host') || 'localhost:3001';
    const protocol = req.protocol || 'http';
    const baseUrl = `${protocol}://${host}`;

    // Tenta busca local primeiro (já filtrada pela Regra 7 no SQL)
    const local = await buscarReleasesLocal(termo, limit, offset, baseUrl, true);

    // Regra do usuário: só exibir versões que têm áudio. As demais saem da
    // resposta, mas entram na fila de resolução em segundo plano.
    const pendentesLocal = await buscarPendentesAudio(termo, 200);
    enfileirarResolucoes(pendentesLocal.itens);

    // Se há dados locais suficientes, responde direto (do banco local = "cache" natural)
    if (local.total + pendentesLocal.total >= MIN_RELEASES_LOCAL) {
      // Regra do usuário: nunca reutilizar buscas idênticas. Mesmo com dados
      // locais, dispara uma ingestão NOVA em segundo plano (limpa o cache do
      // termo e consulta as fontes externas de novo). A resposta sai rápida
      // do banco local; a atualização fica pronta para as próximas buscas.
      void ingerirPorTermo(termo).catch((erro) => {
        console.error(
          '[SEARCH] Ingestão em segundo plano falhou:',
          erro instanceof Error ? erro.message : erro
        );
      });

      const resposta: RespostaPaginada<ReleaseCompleto> = {
        success: true,
        data: {
          results:         local.releases,
          total:           local.total,
          page,
          per_page:        limit,
          fromCache:       true,
          pendentes_audio: pendentesLocal.total,
        },
      };
      res.json(resposta);
      return;
    }

    // Sem dados locais — dispara ingestão das fontes externas.
    // Falha de fonte externa não derruba a busca: respondemos com o que existe.
    try {
      await ingerirPorTermo(termo);
    } catch (erro) {
      console.error(
        '[SEARCH] Ingestão falhou, respondendo só com dados locais:',
        erro instanceof Error ? erro.message : erro
      );
    }

    // Após a ingestão, consulta o banco novamente (com o mesmo filtro da Regra 7)
    const posIngestion = await buscarReleasesLocal(termo, limit, offset, baseUrl, true);

    // Mesma regra: sem áudio, sem exibição. E o que sobrou entra na fila.
    const pendentesPos = await buscarPendentesAudio(termo, 200);
    enfileirarResolucoes(pendentesPos.itens);

    const resposta: RespostaPaginada<ReleaseCompleto> = {
      success: true,
      data: {
        results:         posIngestion.releases,
        total:           posIngestion.total,
        page,
        per_page:        limit,
        fromCache:       false,
        pendentes_audio: pendentesPos.total,
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
