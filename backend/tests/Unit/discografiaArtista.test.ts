// Testes da varredura de discografia pelo MusicBrainz (Regra 2 — todas as
// versões de uma obra).
//
// O motivo está nos números medidos em 26/10/2026: com uma única chamada de 50
// prensagens e teto de 10 discos, um artista com dezenas de álbuns entrava no
// catálogo pela metade. A varredura agora anda em páginas de 100 prensagens até
// juntar 30 discos distintos; a busca real por "tim maia" trouxe 23 discos e 336
// versões em 11,4 s.
//
// A camada HTTP é falsa: as páginas são geradas aqui e cada URL fica registrada,
// o que permite conferir quantas páginas foram pedidas sem depender da internet.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { MusicBrainzAdapter } from '../../src/services/sources/musicBrainzAdapter';

const RESPOSTA_ARTISTA = JSON.stringify({
  artists: [{ id: 'artista-1', name: 'Tim Maia', score: 100, country: 'Brazil' }],
});

// Um disco com uma faixa, em volta de um release-group próprio.
function gerarDisco(indice: number) {
  return {
    id: `release-${indice}`,
    title: `Disco ${indice}`,
    date: `197${indice % 10}-01-01`,
    country: 'BR',
    'release-group': { id: `grupo-${indice}`, 'primary-type': 'Album' },
    media: [
      {
        format: 'CD',
        tracks: [
          {
            number: '1',
            title: `Faixa ${indice}`,
            recording: { id: `grava-${indice}`, title: `Faixa ${indice}`, 'first-release-date': '1970' },
          },
        ],
      },
    ],
  };
}

// Prensagens de uma página. `prensagensPorDisco` maior que 1 reproduz o caso do
// álbum reeditado mil vezes: muitas linhas que são um disco só.
function gerarPrensagens(quantidade: number, indiceInicial: number, prensagensPorDisco = 1): unknown[] {
  const prensagens = [];
  for (let i = 0; i < quantidade; i++) {
    const disco = gerarDisco(Math.floor(i / prensagensPorDisco) + indiceInicial);
    // Prensagens do MESMO disco mudam só o id do release.
    prensagens.push({ ...disco, id: `release-${indiceInicial}-${i}` });
  }
  return prensagens;
}

// Página do browse de releases. O total é o do catálogo inteiro: o MusicBrainz
// repete a contagem em toda página e é ela que diz se existe próxima página.
function gerarPagina(releases: unknown[], total: number): string {
  return JSON.stringify({ 'release-count': total, releases });
}

interface Chamadas {
  urls: string[];
}

// Adapter com HTTP falso que devolve a página correspondente ao offset pedido.
function criarAdapter(paginas: Map<string, string>, totalDoCatalogo: number): [MusicBrainzAdapter, Chamadas] {
  const chamadas: Chamadas = { urls: [] };

  const adapter = new MusicBrainzAdapter(async (url) => {
    chamadas.urls.push(url);

    if (url.includes('/artist?')) return RESPOSTA_ARTISTA;
    if (url.includes('/recording?')) return JSON.stringify({ recordings: [] });

    // Chamada de contagem (limit=1), feita antes de qualquer varredura.
    if (url.includes('limit=1&')) return JSON.stringify({ 'release-count': totalDoCatalogo, releases: [] });

    const offset = new URL(url).searchParams.get('offset') ?? '0';
    // Página não preparada devolve lista vazia em vez de estourar: a exceção
    // seria engolida pelo try/catch do adapter e a asserção de discos é que
    // mostra o que faltou.
    return paginas.get(offset) ?? gerarPagina([], totalDoCatalogo);
  });

  return [adapter, chamadas];
}

function contarDiscos(releases: Array<{ album_name?: string | null }>): number {
  return new Set(releases.map((r) => r.album_name)).size;
}

test('a varredura passa do teto antigo de 10 discos', async () => {
  // Uma página com 30 discos distintos preenche a cota numa chamada só.
  const paginas = new Map([['0', gerarPagina(gerarPrensagens(30, 0), 30)]]);
  const [adapter, chamadas] = criarAdapter(paginas, 30);

  const releases = await adapter.buscarPorTermo('Tim Maia');

  assert.equal(contarDiscos(releases), 30, 'a cota de 30 discos não foi atendida');
  assert.equal(releases.length, 30, 'cada disco deveria entrar com a sua única faixa');

  // Com a cota preenchida na primeira página, a segunda não é pedida:
  // uma chamada de contagem + uma de disco.
  assert.equal(
    chamadas.urls.filter((u) => u.includes('/release?artist')).length,
    2,
    'a varredura pediu páginas além do necessário'
  );
});

test('percorre a página seguinte quando a primeira só traz reedições', async () => {
  // 100 prensagens que são reedições de 10 discos: sem andar para a próxima
  // página, o catálogo pararia em 10 discos.
  const soReedicoes = new Map([
    ['0', gerarPagina(gerarPrensagens(100, 0, 10), 200)],
    ['100', gerarPagina([], 200)],
  ]);
  const [adapterPoucos, chamadasPoucos] = criarAdapter(soReedicoes, 200);

  const poucosDiscos = await adapterPoucos.buscarPorTermo('Tim Maia');

  assert.equal(contarDiscos(poucosDiscos), 10, 'reedições deveriam contar como um disco só');
  assert.ok(
    chamadasPoucos.urls.some((u) => u.includes('offset=100')),
    'a varredura parou na primeira página mesmo sem preencher a cota de discos'
  );

  // A segunda página traz discos novos até fechar a cota de 30.
  const duasPaginas = new Map([
    ['0', gerarPagina(gerarPrensagens(100, 0, 10), 200)],
    ['100', gerarPagina(gerarPrensagens(100, 10, 4), 200)],
  ]);
  const [adapterCheio] = criarAdapter(duasPaginas, 200);

  assert.equal(contarDiscos(await adapterCheio.buscarPorTermo('Tim Maia')), 30, 'as duas páginas não fecharam a cota');
});

test('catálogo pequeno demais continua sendo tratado como título de música', async () => {
  // Menos de 20 prensagens não é discografia de artista: a busca por gravação é
  // quem assume. Sem o piso, "One More Time" montaria o catálogo do artista
  // homônimo de oito releases no lugar da música.
  const paginas = new Map([['0', gerarPagina(gerarPrensagens(8, 0), 8)]]);
  const [adapter, chamadas] = criarAdapter(paginas, 8);

  const releases = await adapter.buscarPorTermo('Tim Maia');

  assert.equal(releases.length, 0);
  assert.ok(chamadas.urls.some((u) => u.includes('/recording?')), 'a busca por gravação não assumiu o termo');
  assert.ok(
    !chamadas.urls.some((u) => u.includes('/release?artist') && u.includes('limit=100')),
    'a varredura de discos rodou para um catálogo que não passou no piso'
  );
});
