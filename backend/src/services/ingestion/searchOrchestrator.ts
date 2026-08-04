// Orquestrador de ingestão de dados musicais.
// Coordena a busca em múltiplas fontes externas, persiste os dados no banco,
// controla a concorrência e usa o cache para evitar chamadas repetidas.
//
// Fluxo:
//   1. Verifica se há cache válido no banco para o termo
//   2. Se não há cache, chama MusicBrainz e Discogs com fila de concorrência
//   3. Persiste os releases encontrados evitando duplicatas (via external_id)
//   4. Registra tudo no ingestion_log para auditoria

import pool from '../../config/database';
import { RowDataPacket, ResultSetHeader } from 'mysql2';
import { DadosReleaseExterno } from '../../types';
import { MusicBrainzAdapter } from '../sources/musicBrainzAdapter';
import { DiscogsAdapter } from '../sources/discogsAdapter';
import { buscarDoCache, salvarNoCache, buscarIdFonte } from '../cache/externalApiCache';
import { registrarLogIngestion, emitirEvento } from '../logger/ingestionLogger';

// Controle de concorrência — máximo de fontes consultadas simultaneamente.
// Garante que o sistema nunca dispare dezenas de chamadas ao mesmo tempo.
const MAX_CONCORRENCIA = 5;
let chamadosAtivos = 0;
const filaEspera: Array<() => void> = [];

// Aguarda liberação de slot na fila de concorrência.
function aguardarSlot(): Promise<void> {
  return new Promise(resolve => {
    if (chamadosAtivos < MAX_CONCORRENCIA) {
      chamadosAtivos++;
      resolve();
    } else {
      filaEspera.push(() => {
        chamadosAtivos++;
        resolve();
      });
    }
  });
}

// Libera um slot na fila de concorrência ao terminar uma chamada.
function liberarSlot(): void {
  chamadosAtivos--;
  const proximo = filaEspera.shift();
  if (proximo) proximo();
}

// Adapters das fontes externas
const musicBrainz = new MusicBrainzAdapter();
const discogs = new DiscogsAdapter();

// Resultado da ingestão — retornado para o controller saber o que aconteceu.
export interface ResultadoIngestion {
  worksCreated: number;
  releasesCreated: number;
  fromCache: boolean;
  fontesChamadas: string[];
}

// Ponto de entrada principal do orquestrador.
// Busca dados externos para o termo, persiste no banco e retorna o resultado.
export async function ingerirPorTermo(termo: string): Promise<ResultadoIngestion> {
  const chaveCache = `search:${termo.toLowerCase().trim()}`;
  const fontesChamadas: string[] = [];
  let worksCreated = 0;
  let releasesCreated = 0;

  // IDs das fontes na tabela metadata_sources (populadas pelo seed do schema)
  const idMusicBrainz = await buscarIdFonte('MusicBrainz');
  const idDiscogs     = await buscarIdFonte('Discogs');

  if (!idMusicBrainz || !idDiscogs) {
    throw new Error('Fontes de metadados não encontradas no banco. Execute o seed do schema.');
  }

  // Verifica cache do MusicBrainz
  const cacheMB = await buscarDoCache(idMusicBrainz, chaveCache);
  // Verifica cache do Discogs
  const cacheDiscogs = await buscarDoCache(idDiscogs, chaveCache);

  // Se ambas as fontes estão em cache, não precisamos chamar APIs externas
  if (cacheMB !== null && cacheDiscogs !== null) {
    emitirEvento('INGESTION_CACHE_HIT', { termo, fontes: ['MusicBrainz', 'Discogs'] });
    return { worksCreated: 0, releasesCreated: 0, fromCache: true, fontesChamadas: [] };
  }

  // Chama as fontes que não estão em cache, com controle de concorrência
  const promessas: Promise<{ fonte: string; releases: DadosReleaseExterno[] }>[] = [];

  if (cacheMB === null) {
    promessas.push(
      chamarFonte('MusicBrainz', idMusicBrainz, chaveCache, () =>
        musicBrainz.buscarPorTermo(termo)
      )
    );
  }

  if (cacheDiscogs === null) {
    promessas.push(
      chamarFonte('Discogs', idDiscogs, chaveCache, () =>
        discogs.buscarPorTermo(termo)
      )
    );
  }

  // Executa em paralelo, respeitando a fila de concorrência
  const resultados = await Promise.allSettled(promessas);

  const todosReleases: DadosReleaseExterno[] = [];

  for (const resultado of resultados) {
    if (resultado.status === 'fulfilled') {
      fontesChamadas.push(resultado.value.fonte);
      todosReleases.push(...resultado.value.releases);
    } else {
      console.error('[ORCHESTRATOR] Erro ao consultar fonte:', resultado.reason);
    }
  }

  // Persiste todos os releases encontrados, evitando duplicatas
  if (todosReleases.length > 0) {
    const contadores = await persistirReleases(todosReleases);
    worksCreated = contadores.worksCreated;
    releasesCreated = contadores.releasesCreated;
  }

  return {
    worksCreated,
    releasesCreated,
    fromCache: false,
    fontesChamadas,
  };
}

// Executa a chamada a uma fonte com controle de concorrência e salva no cache.
async function chamarFonte(
  nomeFonte: string,
  idFonte: number,
  chaveCache: string,
  buscar: () => Promise<DadosReleaseExterno[]>
): Promise<{ fonte: string; releases: DadosReleaseExterno[] }> {
  await aguardarSlot();

  try {
    const releases = await buscar();

    // Salva resposta no cache para evitar nova chamada dentro do TTL
    await salvarNoCache(idFonte, chaveCache, JSON.stringify(releases), nomeFonte);

    // Registra sucesso no log de ingestão
    await registrarLogIngestion({
      metadata_source_id: idFonte,
      request_type: 'search',
      request_query: chaveCache,
      status: 'success',
      releases_created: releases.length,
    });

    return { fonte: nomeFonte, releases };
  } catch (err) {
    const mensagemErro = err instanceof Error ? err.message : String(err);
    const statusLog = mensagemErro.includes('429') || mensagemErro.includes('rate')
      ? 'rate_limited'
      : 'error';

    await registrarLogIngestion({
      metadata_source_id: idFonte,
      request_type: 'search',
      request_query: chaveCache,
      status: statusLog,
      error_message: mensagemErro.substring(0, 500),
    });

    throw err;
  } finally {
    liberarSlot();
  }
}

// Persiste no banco todos os releases recebidos das fontes externas.
// Garante que artists, works e releases não sejam duplicados.
async function persistirReleases(
  releases: DadosReleaseExterno[]
): Promise<{ worksCreated: number; releasesCreated: number }> {
  let worksCreated = 0;
  let releasesCreated = 0;

  for (const release of releases) {
    try {
      const idMetadataSource = await buscarIdFonte(release.metadata_source_name);
      if (!idMetadataSource) continue;

      // 1. Garantir artista existe (INSERT IGNORE para não duplicar)
      const [resArtista] = await pool.execute<ResultSetHeader>(
        `INSERT IGNORE INTO artists (name, country) VALUES (?, ?)`,
        [release.artist_name, release.artist_country ?? null]
      );

      // Busca o ID do artista (pode já ter existido)
      const [rowsArtista] = await pool.execute<RowDataPacket[]>(
        `SELECT id FROM artists WHERE name = ? LIMIT 1`,
        [release.artist_name]
      );
      if (rowsArtista.length === 0) continue;
      const artistaId = rowsArtista[0]!['id'] as number;

      // 2. Garantir obra (work) existe
      const [resWork] = await pool.execute<ResultSetHeader>(
        `INSERT IGNORE INTO works (title, artist_id, original_release_year) VALUES (?, ?, ?)`,
        [release.work_title, artistaId, release.original_release_year ?? null]
      );

      if (resWork.affectedRows > 0) worksCreated++;

      const [rowsWork] = await pool.execute<RowDataPacket[]>(
        `SELECT id FROM works WHERE title = ? AND artist_id = ? LIMIT 1`,
        [release.work_title, artistaId]
      );
      if (rowsWork.length === 0) continue;
      const workId = rowsWork[0]!['id'] as number;

      // 3. Determinar release_type_id — busca pelo nome, fallback para 'Original Release'
      const [rowsTipo] = await pool.execute<RowDataPacket[]>(
        `SELECT id FROM release_types WHERE name = ? LIMIT 1`,
        [release.release_type_name]
      );

      let releaseTypeId: number;
      if (rowsTipo.length > 0) {
        releaseTypeId = rowsTipo[0]!['id'] as number;
      } else {
        // Tipo não encontrado no catálogo — usa 'Original Release' como fallback
        const [rowsFallback] = await pool.execute<RowDataPacket[]>(
          `SELECT id FROM release_types WHERE name = 'Original Release' LIMIT 1`
        );
        if (rowsFallback.length === 0) continue;
        releaseTypeId = rowsFallback[0]!['id'] as number;
      }

      // 4. Inserir release — ignora se já existe (external_id + source = unique key)
      const [resRelease] = await pool.execute<ResultSetHeader>(
        `INSERT IGNORE INTO releases
           (work_id, release_type_id, version_name, album_name, release_year,
            label, country, quality, cover_url, metadata_source_id,
            source_reference_url, external_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          workId,
          releaseTypeId,
          release.version_name,
          release.album_name ?? null,
          release.release_year ?? null,
          release.label ?? null,
          release.country ?? null,
          release.quality ?? null,
          release.cover_url ?? null,     // Regra 1: null = sem capa oficial disponível
          idMetadataSource,
          release.source_reference_url ?? null,
          release.external_id,
        ]
      );

      if (resRelease.affectedRows > 0) releasesCreated++;

    } catch (err) {
      // Erros individuais de persistência não interrompem o loop — registra e continua
      console.error('[ORCHESTRATOR] Erro ao persistir release:', release.external_id, err);
    }
  }

  emitirEvento('INGESTION_COMPLETED', { worksCreated, releasesCreated });
  return { worksCreated, releasesCreated };
}
