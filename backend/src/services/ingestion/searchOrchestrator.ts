// Orquestrador de ingestão de dados musicais.
// Coordena a busca em múltiplas fontes externas, persiste os dados no banco,
// controla a concorrência e usa o cache para evitar chamadas repetidas.
//
// Fluxo:
//   1. Apaga o cache do termo (buscas idênticas nunca são reutilizadas)
//   2. Chama MusicBrainz e Discogs com fila de concorrência
//   3. Persiste os releases encontrados evitando duplicatas (via external_id)
//   4. Registra tudo no ingestion_log para auditoria com contadores reais

import pool from '../../config/database';
import { RowDataPacket, ResultSetHeader } from 'mysql2';
import { DadosReleaseExterno } from '../../types';
import { MusicBrainzAdapter } from '../sources/musicBrainzAdapter';
import { DiscogsAdapter } from '../sources/discogsAdapter';
import { limparCacheDoTermo, salvarNoCache, buscarIdFonte } from '../cache/externalApiCache';
import { registrarLogIngestion, emitirEvento } from '../logger/ingestionLogger';

// Controle de concorrência — máximo de fontes consultadas simultaneamente.
const MAX_CONCORRENCIA = 5;
let chamadosAtivos = 0;
const filaEspera: Array<() => void> = [];

function aguardarSlot(): Promise<void> {
  return new Promise(resolve => {
    if (chamadosAtivos < MAX_CONCORRENCIA) {
      chamadosAtivos++;
      resolve();
    } else {
      filaEspera.push(() => { chamadosAtivos++; resolve(); });
    }
  });
}

function liberarSlot(): void {
  chamadosAtivos--;
  const proximo = filaEspera.shift();
  if (proximo) proximo();
}

// Adapters das fontes externas
const musicBrainz = new MusicBrainzAdapter();
const discogs     = new DiscogsAdapter();

export interface ResultadoIngestion {
  worksCreated: number;
  releasesCreated: number;
  fromCache: boolean;
  fontesChamadas: string[];
}

// Ponto de entrada do orquestrador.
export async function ingerirPorTermo(termo: string): Promise<ResultadoIngestion> {
  const chaveCache    = `search:${termo.toLowerCase().trim()}`;
  const fontesChamadas: string[] = [];
  let worksCreated    = 0;
  let releasesCreated = 0;

  const idMusicBrainz = await buscarIdFonte('MusicBrainz');
  const idDiscogs     = await buscarIdFonte('Discogs');

  if (!idMusicBrainz || !idDiscogs) {
    throw new Error('Fontes de metadados não encontradas no banco. Execute o seed do schema.');
  }

  // Regra do usuário: buscas idênticas NUNCA reutilizam respostas antigas.
  // O cache do termo é sempre apagado antes da ingestão e as duas fontes são
  // consultadas a cada busca — o rate limiter enfileira (não rejeita), então
  // a consulta é segura mesmo em sequência.
  await limparCacheDoTermo(chaveCache);

  // Chama as duas fontes em paralelo, com controle de concorrência
  const promessas: Promise<{ fonte: string; idFonte: number; releases: DadosReleaseExterno[] }>[] = [
    chamarFonte('MusicBrainz', idMusicBrainz, chaveCache, () => musicBrainz.buscarPorTermo(termo)),
    chamarFonte('Discogs', idDiscogs, chaveCache, () => discogs.buscarPorTermo(termo)),
  ];

  const resultados = await Promise.allSettled(promessas);

  // Persiste por fonte para poder registrar contadores reais no log
  for (const resultado of resultados) {
    if (resultado.status === 'fulfilled') {
      const { fonte, idFonte, releases } = resultado.value;
      fontesChamadas.push(fonte);

      if (releases.length > 0) {
        const contadores = await persistirReleases(releases);
        worksCreated    += contadores.worksCreated;
        releasesCreated += contadores.releasesCreated;

        // Log com contadores reais — não estimativas
        await registrarLogIngestion({
          metadata_source_id: idFonte,
          request_type:       'search',
          request_query:      chaveCache,
          status:             'success',
          works_created:      contadores.worksCreated,
          releases_created:   contadores.releasesCreated,
        });
      }
    } else {
      console.error('[ORCHESTRATOR] Erro ao consultar fonte:', resultado.reason);
    }
  }

  emitirEvento('INGESTION_COMPLETED', { termo, worksCreated, releasesCreated });
  return { worksCreated, releasesCreated, fromCache: false, fontesChamadas };
}

// Executa a chamada a uma fonte com controle de concorrência e salva no cache.
async function chamarFonte(
  nomeFonte: string,
  idFonte: number,
  chaveCache: string,
  buscar: () => Promise<DadosReleaseExterno[]>
): Promise<{ fonte: string; idFonte: number; releases: DadosReleaseExterno[] }> {
  await aguardarSlot();

  try {
    const releases = await buscar();

    // Salva no cache para evitar nova chamada dentro do TTL
    await salvarNoCache(idFonte, chaveCache, JSON.stringify(releases), nomeFonte);

    return { fonte: nomeFonte, idFonte, releases };
  } catch (err) {
    const mensagemErro = err instanceof Error ? err.message : String(err);
    const statusLog = mensagemErro.includes('429') || mensagemErro.toLowerCase().includes('rate')
      ? 'rate_limited'
      : 'error';

    await registrarLogIngestion({
      metadata_source_id: idFonte,
      request_type:       'search',
      request_query:      chaveCache,
      status:             statusLog,
      error_message:      mensagemErro.substring(0, 500),
    });

    throw err;
  } finally {
    liberarSlot();
  }
}

// Persiste no banco todos os releases recebidos das fontes externas.
// Usa INSERT IGNORE para evitar duplicatas via constraint unique (external_id + source).
async function persistirReleases(
  releases: DadosReleaseExterno[]
): Promise<{ worksCreated: number; releasesCreated: number }> {
  let worksCreated    = 0;
  let releasesCreated = 0;

  for (const release of releases) {
    try {
      const idMetadataSource = await buscarIdFonte(release.metadata_source_name);
      if (!idMetadataSource) continue;

      // 1. Artista — como artists NÃO tem índice único em name, o INSERT IGNORE
      // antigo criava duplicatas a cada ingestão. Agora consulta primeiro e só
      // insere quando o artista ainda não existe.
      const [rowsArtista] = await pool.execute<RowDataPacket[]>(
        `SELECT id FROM artists WHERE name = ? LIMIT 1`,
        [release.artist_name]
      );
      let artistaId: number;
      if (rowsArtista.length > 0) {
        artistaId = rowsArtista[0]!['id'] as number;
      } else {
        const [resArtista] = await pool.execute<ResultSetHeader>(
          `INSERT INTO artists (name, country) VALUES (?, ?)`,
          [release.artist_name, release.artist_country ?? null]
        );
        artistaId = resArtista.insertId;
      }

      // 2. Obra (work) — mesma lógica: works não tem índice único em
      // (title, artist_id), então consulta antes de inserir para não criar
      // obras duplicadas a cada busca repetida.
      const [rowsWork] = await pool.execute<RowDataPacket[]>(
        `SELECT id FROM works WHERE title = ? AND artist_id = ? LIMIT 1`,
        [release.work_title, artistaId]
      );
      let workId: number;
      if (rowsWork.length > 0) {
        workId = rowsWork[0]!['id'] as number;
      } else {
        const [resWork] = await pool.execute<ResultSetHeader>(
          `INSERT INTO works (title, artist_id, original_release_year) VALUES (?, ?, ?)`,
          [release.work_title, artistaId, release.original_release_year ?? null]
        );
        workId = resWork.insertId;
        worksCreated++;
      }

      // 3. Tipo de release — busca pelo nome, fallback para 'Original Release'
      const [rowsTipo] = await pool.execute<RowDataPacket[]>(
        `SELECT id FROM release_types WHERE name = ? LIMIT 1`,
        [release.release_type_name]
      );
      let releaseTypeId: number;
      if (rowsTipo.length > 0) {
        releaseTypeId = rowsTipo[0]!['id'] as number;
      } else {
        const [rowsFallback] = await pool.execute<RowDataPacket[]>(
          `SELECT id FROM release_types WHERE name = 'Original Release' LIMIT 1`
        );
        if (rowsFallback.length === 0) continue;
        releaseTypeId = rowsFallback[0]!['id'] as number;
      }

      // 4. Release — INSERT IGNORE pela constraint unique (metadata_source_id, external_id)
      // Regra 3: a ingestão de METADADOS (MusicBrainz/Discogs) nunca grava URLs de áudio.
      // Áudio só entra no banco via descoberta em sites abertos (blogs/fóruns/links diretos),
      // feita sob demanda pelo SourceOrchestrator no momento do stream/download.
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
          release.album_name         ?? null,
          release.release_year       ?? null,
          release.label              ?? null,
          release.country            ?? null,
          release.quality            ?? null,
          release.cover_url          ?? null,  // Regra 1: null = sem capa oficial
          idMetadataSource,
          release.source_reference_url ?? null,
          release.external_id,
        ]
      );

      if (resRelease.affectedRows > 0) releasesCreated++;

    } catch (err) {
      console.error('[ORCHESTRATOR] Erro ao persistir release:', release.external_id, err);
    }
  }

  return { worksCreated, releasesCreated };
}
