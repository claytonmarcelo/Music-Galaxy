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
import { nomeOficialOuNulo } from '../sources/nomesOficiais';

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

// ============================================================
// Exclusividade das ingestões
// ============================================================
// 1. Por termo: o controller dispara a ingestão em toda busca normal, e o
//    usuário pode enviar o mesmo termo duas vezes (duplo toque, duas abas,
//    paginação). Sem esta trava, cada envio abria uma consulta nova ao
//    MusicBrainz e ao Discogs ao mesmo tempo — chamadas repetidas e trabalho
//    dobrado de gravação. Quem chega enquanto a ingestão do termo está em
//    curso espera e recebe o mesmo resultado.
const ingestacoesEmCurso = new Map<string, Promise<ResultadoIngestion>>();

// 2. Na gravação: artista e obra são criados com "SELECT e depois INSERT"
//    (as tabelas não têm índice único em nome/título). Duas ingestões de
//    termos diferentes podiam passar pelo mesmo teste ao mesmo tempo e criar
//    linhas repetidas de artista. A gravação passa a ser uma de cada vez —
//    o custo é baixo porque a espera real está nas fontes externas.
let cadeiaGravacao: Promise<unknown> = Promise.resolve();

function gravarComExclusividade<T>(tarefa: () => Promise<T>): Promise<T> {
  const proxima = cadeiaGravacao.then(tarefa, tarefa);
  cadeiaGravacao = proxima.catch(() => undefined);
  return proxima;
}

export interface ResultadoIngestion {
  worksCreated: number;
  releasesCreated: number;
  fromCache: boolean;
  fontesChamadas: string[];
}

// Ponto de entrada do orquestrador.
//
// Uma ingestão por termo por vez: chamadas concorrentes do mesmo termo
// compartilham a execução em curso e recebem o mesmo resultado.
export function ingerirPorTermo(termo: string): Promise<ResultadoIngestion> {
  const chave = termo.toLowerCase().trim();

  const emCurso = ingestacoesEmCurso.get(chave);
  if (emCurso) return emCurso;

  const execucao = executarIngestao(termo).finally(() => {
    ingestacoesEmCurso.delete(chave);
  });

  ingestacoesEmCurso.set(chave, execucao);
  return execucao;
}

// Existe uma ingestão deste termo acontecendo agora?
//
// A tela de busca precisa desse sinal: numa busca nova, as primeiras respostas
// costumam vir sem nenhuma versão com áudio porque o trabalho ainda está em
// curso — consultar MusicBrainz e Discogs, gravar as obras e descobrir o áudio
// em sites abertos. Sem isto, o aplicativo mostra "Nenhuma versão encontrada"
// para algo que ainda está sendo feito.
export function haIngestaoEmCurso(termo: string): boolean {
  return ingestacoesEmCurso.has(termo.toLowerCase().trim());
}

async function executarIngestao(termo: string): Promise<ResultadoIngestion> {
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
        // Gravação serializada (ver `gravarComExclusividade`): evita que
        // duas ingestões criem o mesmo artista/obra em paralelo.
        const contadores = await gravarComExclusividade(() => persistirReleases(releases));
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
      // Regra 8 (última barreira antes do banco): nome de artista, de música e
      // de versão precisam existir como a fonte oficial publicou. Registro sem
      // nome não é gravado — melhor faltar no catálogo do que exibir um nome
      // inexistente. Aqui nada é abreviado, capitalizado ou completado.
      const nomeArtista = nomeOficialOuNulo(release.artist_name);
      const tituloObra = nomeOficialOuNulo(release.work_title);
      const nomeVersao = nomeOficialOuNulo(release.version_name);
      if (!nomeArtista || !tituloObra || !nomeVersao) {
        console.warn(
          '[ORCHESTRATOR] Release descartado por nome ausente (Regra 8):',
          release.external_id
        );
        continue;
      }

      const idMetadataSource = await buscarIdFonte(release.metadata_source_name);
      if (!idMetadataSource) continue;

      // 1. Artista — como artists NÃO tem índice único em name, o INSERT IGNORE
      // antigo criava duplicatas a cada ingestão. Agora consulta primeiro e só
      // insere quando o artista ainda não existe.
      const [rowsArtista] = await pool.execute<RowDataPacket[]>(
        `SELECT id FROM artists WHERE name = ? LIMIT 1`,
        [nomeArtista]
      );
      let artistaId: number;
      if (rowsArtista.length > 0) {
        artistaId = rowsArtista[0]!['id'] as number;
      } else {
        const [resArtista] = await pool.execute<ResultSetHeader>(
          `INSERT INTO artists (name, country) VALUES (?, ?)`,
          [nomeArtista, release.artist_country ?? null]
        );
        artistaId = resArtista.insertId;
      }

      // 2. Obra (work) — mesma lógica: works não tem índice único em
      // (title, artist_id), então consulta antes de inserir para não criar
      // obras duplicadas a cada busca repetida.
      const [rowsWork] = await pool.execute<RowDataPacket[]>(
        `SELECT id FROM works WHERE title = ? AND artist_id = ? LIMIT 1`,
        [tituloObra, artistaId]
      );
      let workId: number;
      if (rowsWork.length > 0) {
        workId = rowsWork[0]!['id'] as number;
      } else {
        const [resWork] = await pool.execute<ResultSetHeader>(
          `INSERT INTO works (title, artist_id, original_release_year) VALUES (?, ?, ?)`,
          [tituloObra, artistaId, release.original_release_year ?? null]
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
          nomeVersao,
          nomeOficialOuNulo(release.album_name),
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
