// Testes de integração da relevância da busca (Regra 2 + Regra 7 + pedido do
// dono: "a busca não é exata quando se põe o nome do artista, banda, música").
//
// A expressão de relevância é SQL executado no MariaDB real, sobre linhas de
// amostra montadas com UNION ALL — nada é escrito no banco. As linhas são as
// situações medidas em 26/10/2026: "queen" abrindo com "Hairspray Queen" do
// Nirvana e "one" casando "Alcione" porque o LIKE `%one%` também casa um
// pedaço de palavra.

import { after, test } from 'node:test';
import assert from 'node:assert/strict';

import { RowDataPacket } from 'mysql2';
import pool from '../../src/config/database';
import { montarCriterioBusca } from '../../src/controllers/searchController';

interface Amostra {
  artista: string;
  obra: string;
  versao: string;
  album: string;
}

// Os campos que a expressão usa, trocados pelos nomes da tabela de amostra.
const COLUNAS: Array<[string, string]> = [
  ['a.name', 's.artista'],
  ['w.title', 's.obra'],
  ['r.version_name', 's.versao'],
  ['r.album_name', 's.album'],
];

function comColunasDeAmostra(texto: string): string {
  return COLUNAS.reduce((atual, [de, para]) => atual.split(de).join(para), texto);
}

// Executa o critério da busca sobre as amostras e devolve os artistas na ordem
// que o banco responde — a mesma ordem que chega ao aplicativo.
async function ordenarAmostras(termo: string, amostras: Amostra[]): Promise<string[]> {
  const criterio = montarCriterioBusca(termo);
  assert.ok(criterio, `o termo ${JSON.stringify(termo)} não gerou critério de busca`);

  const linhas = amostras
    .map(() => 'SELECT ? AS artista, ? AS obra, ? AS versao, ? AS album')
    .join(' UNION ALL ');

  const paramsDasLinhas = amostras.flatMap((a) => [a.artista, a.obra, a.versao, a.album]);

  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT s.artista FROM (${linhas}) s
     WHERE ${comColunasDeAmostra(criterio!.clausula)}
     ORDER BY (${comColunasDeAmostra(criterio!.relevancia)}) DESC, s.artista ASC, s.obra ASC`,
    [...paramsDasLinhas, ...criterio!.paramsClausula, ...criterio!.paramsRelevancia]
  );

  return rows.map((row) => row['artista'] as string);
}

after(async () => {
  await pool.end();
});

test('o nome exato do artista vem antes de qualquer faixa que só cita a palavra', async () => {
  const ordem = await ordenarAmostras('queen', [
    { artista: 'Nirvana',     obra: 'Hairspray Queen',    versao: 'Hairspray Queen',    album: 'Never Mind the Bollocks' },
    { artista: 'Queen',       obra: 'Bohemian Rhapsody',  versao: 'Bohemian Rhapsody',  album: 'A Night at the Opera' },
    { artista: 'Bernice Queen', obra: 'My Party',         versao: 'My Party',           album: 'Rhino Hi-Five' },
  ]);

  assert.equal(ordem[0], 'Queen', 'a busca por nome de banda não abriu com a banda');
  assert.equal(ordem.length, 3, 'o recall diminuiu: versões que citam a palavra deixaram de aparecer');
});

test('a faixa pedida por inteiro vem antes da que tem a palavra dentro de outra', async () => {
  const ordem = await ordenarAmostras('one', [
    { artista: 'Adele',    obra: 'Someone Like You', versao: 'Someone Like You', album: '21' },
    { artista: 'Alcione',  obra: 'A La Carta',       versao: 'A La Carta',       album: 'Alcione' },
    { artista: 'Daft Punk', obra: 'One More Time',   versao: 'One More Time',    album: 'Discovery' },
  ]);

  assert.equal(ordem[0], 'Daft Punk', 'o casamento por pedaço de palavra passou na frente do exato');
  assert.ok(ordem.includes('Alcione'), 'Regra 2 quebrada: versão que menciona o termo foi escondida');
});

test('o título exato da música vence o artista que só contém o termo', async () => {
  const ordem = await ordenarAmostras('one more time', [
    { artista: 'Coverflow Band', obra: 'More Than One Time', versao: 'More Than One Time', album: 'Tributo' },
    { artista: 'Daft Punk',      obra: 'One More Time',      versao: 'One More Time',      album: 'Discovery' },
  ]);

  assert.equal(ordem[0], 'Daft Punk', 'a música exata não ficou atrás de um título parecido');
});

test('digitar sem acento ou com caixa diferente continua sendo busca exata', async () => {
  const ordem = await ordenarAmostras('legiao urbana', [
    { artista: 'Urbana',       obra: 'Legião',         versao: 'Legião',         album: 'Extremo' },
    { artista: 'Legião Urbana', obra: 'Pais e Filhos', versao: 'Pais e Filhos',  album: 'As Quatro Estações' },
  ]);

  assert.equal(ordem[0], 'Legião Urbana', 'a igualdade sem acento não foi tratada como casamento parcial');
});

test('a expressão de relevância tem um parâmetro para cada marcador', async () => {
  // A ordem dos ? precisa bater com o array de parâmetros, senão o MySQL
  // responde com erro de binding ou, pior, compara com o valor errado.
  for (const termo of ['queen', 'one more time', 'legião urbana', 'skank saideira']) {
    const criterio = montarCriterioBusca(termo);
    assert.ok(criterio, `sem critério para ${termo}`);

    const marcadores = (criterio.relevancia.match(/\?/g) ?? []).length;
    assert.equal(
      marcadores,
      criterio.paramsRelevancia.length,
      `relevância de ${JSON.stringify(termo)} tem ${marcadores} ? e ${criterio.paramsRelevancia.length} parâmetros`
    );

    const marcadoresNoWhere = (criterio.clausula.match(/\?/g) ?? []).length;
    assert.equal(marcadoresNoWhere, criterio.paramsClausula.length, `WHERE de ${termo} desalinhado`);
  }
});

test('termo sem palavra pesquisável não gera consulta', async () => {
  assert.equal(montarCriterioBusca(''), null);
  assert.equal(montarCriterioBusca('a b'), null);
});

test('pontuação digitada não vira operador de expressão regular', async () => {
  // Os caracteres abaixo são operadores de regex. Sem escape, a consulta subiria
  // com erro do banco no meio da busca do usuário.
  for (const termo of ['(x)', 'a+b', 'x|y', 'a.b']) {
    const ordem = await ordenarAmostras(termo, [
      { artista: 'Banda_teste', obra: `(x)` + termo, versao: `(x)${termo}`, album: 'Ao vivo' },
      { artista: 'Banda_teste', obra: termo, versao: termo, album: 'Ao vivo' },
    ]);
    assert.ok(Array.isArray(ordem), `termo ${JSON.stringify(termo)} não produziu lista`);
  }
});
