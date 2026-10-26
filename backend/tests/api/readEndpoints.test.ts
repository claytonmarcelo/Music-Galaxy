// Testes de integração da API — sobem a aplicação Express em uma porta
// efêmera e consultam o MariaDB real (porta 3307). Não usam mocks: cada
// asserção da Regra 7 é conferida contra o banco e contra a resposta HTTP.
//
// Cobre: saúde, catálogo, paginação, filtro de áudio antes do LIMIT,
// contrato de detalhes (stream/download do backend), navegação obra/artista
// e o guard anti-SSRF do endpoint de registro de fonte.

import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import type { Server } from 'node:http';
import { once } from 'node:events';

import { RowDataPacket } from 'mysql2';
import { criarApp } from '../../src/app';
import pool from '../../src/config/database';

// ============================================================
// Tipos das respostas consumidas
// ============================================================

interface RespostaErro {
  success: boolean;
  error?: string;
}

interface RespostaTipos {
  success: boolean;
  data: { total: number; types: Array<{ id: number; name: string; category: string }> };
}

interface ReleaseListado {
  id: number;
  work_id: number;
  version_name: string;
  audio_source_url: string;
  streaming_url: string;
  download_url: string;
  artist_id: number;
  artist_name: string;
  effective_year: number | null;
}

interface RespostaReleasesPorData {
  success: boolean;
  data: { results: ReleaseListado[]; total: number; limit: number; offset: number };
}

interface ReleaseDetalhado {
  id: number;
  streaming_url: string;
  download_url: string;
  audio_source_url: string | null;
  cover_url: string | null;
  work: { id: number; title: string; original_release_year: number | null; effective_year: number | null };
  artist: { id: number; name: string; country: string | null };
}

interface RespostaRelease {
  success: boolean;
  data: ReleaseDetalhado;
}

interface ObraListada {
  id: number;
  title: string;
  original_release_year: number | null;
  effective_year?: number | null;
  artist: { id: number; name: string; country: string | null };
}

interface RespostaReleasesDeWork {
  success: boolean;
  data: {
    work: {
      id: number;
      title: string;
      original_release_year: number | null;
      effective_year?: number | null;
      artist: { id: number; name: string; country: string | null };
    };
    results: ReleaseListado[];
    total: number;
    limit: number;
    offset: number;
  };
}

interface RespostaObras {
  success: boolean;
  data: {
    results: ObraListada[];
    total: number;
    limit: number;
    offset: number;
    decade?: string;
    artist?: { id: number; name: string; country: string | null };
  };
}

interface RespostaArtista {
  success: boolean;
  data: { id: number; name: string; country: string | null };
}

// ============================================================
// Infraestrutura dos testes
// ============================================================

let servidor: Server | undefined;
let baseUrl = '';

before(async () => {
  servidor = criarApp().listen(0, '127.0.0.1');
  await once(servidor, 'listening');

  const endereco = servidor.address();
  assert.ok(endereco && typeof endereco === 'object', 'servidor sem endereço');
  baseUrl = `http://127.0.0.1:${endereco.port}`;
});

after(async () => {
  if (servidor) {
    await new Promise<void>((resolve, reject) => {
      servidor?.close((erro) => (erro ? reject(erro) : resolve()));
    });
  }
  await pool.end();
});

async function obterJson<T>(caminho: string): Promise<{ status: number; corpo: T }> {
  const resposta = await fetch(`${baseUrl}${caminho}`);
  const corpo = (await resposta.json()) as T;
  return { status: resposta.status, corpo };
}

async function postarJson<T>(caminho: string, dados: unknown): Promise<{ status: number; corpo: T }> {
  const resposta = await fetch(`${baseUrl}${caminho}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(dados),
  });
  const corpo = (await resposta.json()) as T;
  return { status: resposta.status, corpo };
}

async function contar(sql: string, parametros: Array<string | number> = []): Promise<number> {
  const [linhas] = await pool.execute<RowDataPacket[]>(sql, parametros);
  return Number(linhas[0]?.['total'] ?? 0);
}

// ============================================================
// Saúde e catálogo
// ============================================================

test('GET /health responde sem consultar o banco', async () => {
  const { status, corpo } = await obterJson<{ status: string; timestamp: string }>('/health');

  assert.equal(status, 200);
  assert.equal(corpo.status, 'ok');
  assert.ok(!Number.isNaN(Date.parse(corpo.timestamp)));
});

test('GET /api/release-types devolve o catálogo completo com o total correto', async () => {
  const totalBanco = await contar('SELECT COUNT(*) AS total FROM release_types');
  const { status, corpo } = await obterJson<RespostaTipos>('/api/release-types');

  assert.equal(status, 200);
  assert.equal(corpo.success, true);
  assert.equal(corpo.data.total, totalBanco);
  assert.equal(corpo.data.total, 99);
  assert.equal(corpo.data.types.length, totalBanco);
  for (const tipo of corpo.data.types) {
    assert.equal(typeof tipo.id, 'number');
    assert.equal(typeof tipo.name, 'string');
    assert.equal(typeof tipo.category, 'string');
  }
});

// ============================================================
// Validação de parâmetros
// ============================================================

test('GET /api/search sem q responde 400', async () => {
  const { status, corpo } = await obterJson<RespostaErro>('/api/search');

  assert.equal(status, 400);
  assert.equal(corpo.success, false);
  assert.match(corpo.error ?? '', /obrigatório/i);
});

test('GET /api/search com q acima de 200 caracteres responde 400', async () => {
  const termo = 'a'.repeat(201);
  const { status } = await obterJson<RespostaErro>(`/api/search?q=${termo}`);

  assert.equal(status, 400);
});

test('paginação inválida responde 400 antes de consultar o banco', async () => {
  const limiteZero = await obterJson<RespostaErro>('/api/releases/by-date?limit=0');
  const limiteAlto = await obterJson<RespostaErro>('/api/releases/by-date?limit=101');
  const offsetNegativo = await obterJson<RespostaErro>('/api/releases/by-date?offset=-1');

  assert.equal(limiteZero.status, 400);
  assert.equal(limiteAlto.status, 400);
  assert.equal(offsetNegativo.status, 400);
});

test('ID não numérico responde 400', async () => {
  const { status } = await obterJson<RespostaErro>('/api/releases/abc');

  assert.equal(status, 400);
});

test('década inválida responde 400', async () => {
  const { status, corpo } = await obterJson<RespostaErro>('/api/works/by-decade/2055');

  assert.equal(status, 400);
  assert.match(corpo.error ?? '', /Década inválida/i);
});

test('recurso inexistente responde 404 com mensagem clara', async () => {
  const release = await obterJson<RespostaErro>('/api/releases/99999999');
  const work = await obterJson<RespostaErro>('/api/works/99999999');
  const artista = await obterJson<RespostaErro>('/api/artists/99999999');

  assert.equal(release.status, 404);
  assert.equal(work.status, 404);
  assert.equal(artista.status, 404);
});

// ============================================================
// Regra 7 — só versões com áudio, filtro antes do LIMIT
// ============================================================

test('GET /api/releases/by-date devolve somente versões com áudio', async () => {
  const totalBanco = await contar(
    'SELECT COUNT(*) AS total FROM releases WHERE audio_source_url IS NOT NULL'
  );
  const { status, corpo } = await obterJson<RespostaReleasesPorData>('/api/releases/by-date?limit=10');

  assert.equal(status, 200);
  assert.equal(corpo.success, true);
  assert.equal(corpo.data.total, totalBanco);
  assert.ok(corpo.data.results.length > 0, 'banco sem versões com áudio para testar');
  assert.ok(corpo.data.results.length <= 10);

  for (const release of corpo.data.results) {
    assert.ok(release.audio_source_url, `release ${release.id} sem áudio vazou na resposta`);
    assert.equal(release.streaming_url, `${baseUrl}/api/releases/${release.id}/stream`);
    assert.equal(release.download_url, `${baseUrl}/api/releases/${release.id}/download`);
  }
});

test('paginação de /releases/by-date não repete versões entre páginas', async () => {
  const pagina1 = await obterJson<RespostaReleasesPorData>('/api/releases/by-date?limit=2&offset=0');
  const pagina2 = await obterJson<RespostaReleasesPorData>('/api/releases/by-date?limit=2&offset=2');

  assert.equal(pagina1.status, 200);
  assert.equal(pagina2.status, 200);
  assert.equal(pagina1.corpo.data.total, pagina2.corpo.data.total);

  const ids1 = pagina1.corpo.data.results.map((r) => r.id);
  const ids2 = pagina2.corpo.data.results.map((r) => r.id);
  const repetidos = ids1.filter((id) => ids2.includes(id));

  assert.deepEqual(repetidos, []);
  for (const release of [...pagina1.corpo.data.results, ...pagina2.corpo.data.results]) {
    assert.ok(release.audio_source_url);
  }
});

test('GET /api/works/:id/releases filtra no SQL e devolve o contrato de navegação', async () => {
  const [linhas] = await pool.execute<RowDataPacket[]>(
    `SELECT work_id FROM releases
      WHERE audio_source_url IS NOT NULL
      GROUP BY work_id
      ORDER BY COUNT(*) DESC
      LIMIT 1`
  );
  const workId = Number(linhas[0]?.['work_id'] ?? 0);
  assert.ok(workId > 0, 'banco sem obra com áudio para testar');

  const totalBanco = await contar(
    `SELECT COUNT(*) AS total FROM releases
      WHERE work_id = ? AND audio_source_url IS NOT NULL`,
    [workId]
  );

  const { status, corpo } = await obterJson<RespostaReleasesDeWork>(
    `/api/works/${workId}/releases?limit=100`
  );

  assert.equal(status, 200);
  assert.equal(corpo.data.work.id, workId);
  assert.equal(corpo.data.total, totalBanco);
  assert.equal(corpo.data.results.length, Math.min(totalBanco, 100));
  assert.equal(typeof corpo.data.work.artist.id, 'number');
  assert.equal(typeof corpo.data.work.artist.name, 'string');

  for (const release of corpo.data.results) {
    assert.equal(release.work_id, workId);
    assert.ok(release.audio_source_url, `release ${release.id} sem áudio na obra ${workId}`);
  }
});

// ============================================================
// Detalhes, obra e artista
// ============================================================

test('GET /api/releases/:id devolve mídia do backend e metadados da fonte aberta', async () => {
  const [linhas] = await pool.execute<RowDataPacket[]>(
    `SELECT id FROM releases WHERE audio_source_url IS NOT NULL ORDER BY id ASC LIMIT 1`
  );
  const releaseId = Number(linhas[0]?.['id'] ?? 0);
  assert.ok(releaseId > 0, 'banco sem versão com áudio para testar');

  const { status, corpo } = await obterJson<RespostaRelease>(`/api/releases/${releaseId}`);

  assert.equal(status, 200);
  assert.equal(corpo.data.id, releaseId);
  assert.equal(corpo.data.streaming_url, `${baseUrl}/api/releases/${releaseId}/stream`);
  assert.equal(corpo.data.download_url, `${baseUrl}/api/releases/${releaseId}/download`);
  assert.ok(corpo.data.audio_source_url, 'fonte aberta não veio no detalhe');
  assert.ok(corpo.data.work.id > 0);
  assert.ok(corpo.data.artist.id > 0);
});

test('GET /api/artists/:id/works só lista obras com ao menos uma versão com áudio', async () => {
  const [linhas] = await pool.execute<RowDataPacket[]>(
    `SELECT a.id, a.name,
            (SELECT COUNT(*) FROM works w
              WHERE w.artist_id = a.id
                AND EXISTS (SELECT 1 FROM releases r
                             WHERE r.work_id = w.id AND r.audio_source_url IS NOT NULL)) AS total
       FROM artists a
      WHERE EXISTS (SELECT 1 FROM works w2
                     JOIN releases r2 ON r2.work_id = w2.id
                    WHERE w2.artist_id = a.id AND r2.audio_source_url IS NOT NULL)
      ORDER BY total DESC
      LIMIT 1`
  );
  const artistaId = Number(linhas[0]?.['id'] ?? 0);
  const totalBanco = Number(linhas[0]?.['total'] ?? 0);
  assert.ok(artistaId > 0, 'banco sem artista com obra e áudio para testar');

  const artista = await obterJson<RespostaArtista>(`/api/artists/${artistaId}`);
  const obras = await obterJson<RespostaObras>(`/api/artists/${artistaId}/works?limit=100`);

  assert.equal(artista.status, 200);
  assert.equal(obras.status, 200);
  assert.equal(obras.corpo.data.artist?.id, artistaId);
  assert.equal(obras.corpo.data.total, totalBanco);
  assert.equal(obras.corpo.data.results.length, Math.min(totalBanco, 100));

  for (const obra of obras.corpo.data.results) {
    const comAudio = await contar(
      `SELECT COUNT(*) AS total FROM releases
        WHERE work_id = ? AND audio_source_url IS NOT NULL`,
      [obra.id]
    );
    assert.ok(comAudio > 0, `obra ${obra.id} sem áudio vazou na listagem do artista`);
  }
});

test('GET /api/works/by-decade/:decade só lista obras com áudio e total consistente', async () => {
  const [linhas] = await pool.execute<RowDataPacket[]>(
    `SELECT FLOOR(COALESCE(
              w.original_release_year,
              (SELECT MIN(r.release_year) FROM releases r
                WHERE r.work_id = w.id AND r.release_year IS NOT NULL)
            ) / 10) * 10 AS decada
       FROM works w
      WHERE EXISTS (SELECT 1 FROM releases r2
                     WHERE r2.work_id = w.id AND r2.audio_source_url IS NOT NULL)
      ORDER BY decada DESC
      LIMIT 1`
  );
  const decada = Number(linhas[0]?.['decada'] ?? 0);
  assert.ok(decada >= 1900, 'banco sem obra com áudio e ano para testar');

  const totalBanco = await contar(
    `SELECT COUNT(*) AS total
       FROM works w
      WHERE FLOOR(COALESCE(
              w.original_release_year,
              (SELECT MIN(r.release_year) FROM releases r
                WHERE r.work_id = w.id AND r.release_year IS NOT NULL)
            ) / 10) * 10 = ?
        AND EXISTS (SELECT 1 FROM releases r2
                     WHERE r2.work_id = w.id AND r2.audio_source_url IS NOT NULL)`,
    [decada]
  );

  const { status, corpo } = await obterJson<RespostaObras>(
    `/api/works/by-decade/${decada}?limit=100`
  );

  assert.equal(status, 200);
  assert.equal(corpo.data.total, totalBanco);
  assert.equal(corpo.data.decade, `${decada}s`);
  assert.equal(corpo.data.results.length, Math.min(totalBanco, 100));

  for (const obra of corpo.data.results) {
    const comAudio = await contar(
      `SELECT COUNT(*) AS total FROM releases
        WHERE work_id = ? AND audio_source_url IS NOT NULL`,
      [obra.id]
    );
    assert.ok(comAudio > 0, `obra ${obra.id} sem áudio na década ${decada}`);
  }
});

// ============================================================
// Segurança — guard anti-SSRF no registro de fonte
// ============================================================

test('POST /audio-source rejeita IP privado e plataforma proibida sem alterar o banco', async () => {
  const [linhas] = await pool.execute<RowDataPacket[]>(
    `SELECT id, audio_source_url FROM releases
      WHERE audio_source_url IS NOT NULL ORDER BY id ASC LIMIT 1`
  );
  const releaseId = Number(linhas[0]?.['id'] ?? 0);
  const fonteOriginal = String(linhas[0]?.['audio_source_url'] ?? '');
  assert.ok(releaseId > 0 && fonteOriginal, 'banco sem versão com áudio para testar');

  const loopback = await postarJson<RespostaErro>(
    `/api/releases/${releaseId}/audio-source`,
    { url: 'http://127.0.0.1/arquivo.mp3' }
  );
  const youtube = await postarJson<RespostaErro>(
    `/api/releases/${releaseId}/audio-source`,
    { url: 'https://www.youtube.com/watch?v=abc123' }
  );

  assert.equal(loopback.status, 400);
  assert.equal(youtube.status, 400);

  const [depois] = await pool.execute<RowDataPacket[]>(
    `SELECT audio_source_url FROM releases WHERE id = ?`,
    [releaseId]
  );
  assert.equal(depois[0]?.['audio_source_url'], fonteOriginal);
});

// ============================================================
// Contratos da tela de busca
// ============================================================

// A atualização automática da tela depende de dois campos: `pendentes_audio`
// conta quantas versões aguardam fonte de áudio e `ingestao_em_curso` diz se o
// servidor ainda está montando o catálogo do termo. Sem eles, uma lista vazia
// durante um trabalho em curso é exibida como "Nenhuma versão encontrada".
test('GET /api/search?leve=1 devolve os campos que a tela usa para esperar', async () => {
  const { status, corpo } = await obterJson<{
    success: boolean;
    data: {
      results: unknown[];
      total: number;
      fromCache?: boolean;
      pendentes_audio?: number;
      ingestao_em_curso?: boolean;
    };
  }>('/api/search?q=zz-musicgalaxy-teste-inexistente&leve=1');

  assert.equal(status, 200);
  assert.equal(corpo.success, true);

  // leve=1 não consulta MusicBrainz nem Discogs: a resposta vem só do banco,
  // sem ingestão deste termo em curso.
  assert.equal(corpo.data.fromCache, true);
  assert.equal(typeof corpo.data.pendentes_audio, 'number');
  assert.equal(typeof corpo.data.ingestao_em_curso, 'boolean');
  assert.equal(corpo.data.ingestao_em_curso, false);
});
