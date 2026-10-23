// Sistema de cache de respostas de APIs externas usando MariaDB.
// Evita chamadas repetidas às mesmas fontes, respeita os limites de taxa
// (rate limits) de MusicBrainz e Discogs, e acelera as respostas para
// buscas já realizadas anteriormente.

import pool from '../../config/database';
import { ResultSetHeader, RowDataPacket } from 'mysql2';

// TTL padrão de cache por fonte (em segundos)
const TTL_MUSICBRAINZ = 60 * 60 * 24 * 7; // 7 dias
const TTL_DISCOGS     = 60 * 60 * 24 * 3; // 3 dias

// Retorna o TTL adequado para cada fonte pelo nome.
function obterTtlPorFonte(nomeSource: string): number {
  const nome = nomeSource.toLowerCase();
  if (nome.includes('discogs')) return TTL_DISCOGS;
  return TTL_MUSICBRAINZ;
}

// Consulta o cache — retorna o corpo da resposta se ainda válido, ou null se expirado/inexistente.
export async function buscarDoCache(
  metadataSourceId: number,
  requestKey: string
): Promise<string | null> {
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT response_body FROM external_api_cache
     WHERE metadata_source_id = ? AND request_key = ? AND expires_at > NOW()`,
    [metadataSourceId, requestKey]
  );

  if (rows.length === 0) return null;
  return rows[0]['response_body'] as string;
}

// Armazena (ou atualiza) uma resposta no cache com TTL calculado automaticamente.
export async function salvarNoCache(
  metadataSourceId: number,
  requestKey: string,
  responseBody: string,
  nomeSource: string
): Promise<void> {
  const ttlSegundos = obterTtlPorFonte(nomeSource);

  // INSERT OR UPDATE — atualiza a entrada se já existir para a mesma chave+fonte.
  await pool.execute(
    `INSERT INTO external_api_cache (metadata_source_id, request_key, response_body, fetched_at, expires_at)
     VALUES (?, ?, ?, NOW(), DATE_ADD(NOW(), INTERVAL ? SECOND))
     ON DUPLICATE KEY UPDATE
       response_body = VALUES(response_body),
       fetched_at    = NOW(),
       expires_at    = DATE_ADD(NOW(), INTERVAL ? SECOND)`,
    [metadataSourceId, requestKey, responseBody, ttlSegundos, ttlSegundos]
  );
}

// Remove TODAS as entradas de cache de um termo (request_key), independente
// da fonte. Regra do usuário: buscas idênticas nunca reutilizam respostas
// antigas — o cache do termo é sempre apagado antes de uma nova ingestão.
export async function limparCacheDoTermo(requestKey: string): Promise<number> {
  const [resultado] = await pool.execute<ResultSetHeader>(
    `DELETE FROM external_api_cache WHERE request_key = ?`,
    [requestKey]
  );
  return resultado.affectedRows ?? 0;
}

// Remove entradas de cache expiradas — pode ser chamado periodicamente.
export async function limparCacheExpirado(): Promise<number> {
  const [resultado] = await pool.execute<ResultSetHeader>(
    `DELETE FROM external_api_cache WHERE expires_at < NOW()`
  );
  return resultado.affectedRows ?? 0;
}

// Busca o ID de uma fonte de metadados pelo nome.
// Os IDs são fixos após o seed, mas esta função torna o código mais robusto.
export async function buscarIdFonte(nomeSource: string): Promise<number | null> {
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT id FROM metadata_sources WHERE name = ?`,
    [nomeSource]
  );
  if (rows.length === 0) return null;
  return rows[0]['id'] as number;
}
