// Testes da Regra 8 — nomes oficiais de músicas, artistas e bandas.
// O nome que chega ao banco tem de ser o que a fonte oficial publica: mesma
// grafia, mesmos acentos e mesmas maiúsculas/minúsculas. Nada de abreviar,
// "corrigir" por conta própria ou colar o tipo de lançamento no fim do nome.
//
// Os dois adapters rodam com uma camada HTTP falsa: os testes não dependem da
// internet e verificam exatamente o que seria gravado no banco.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { limparNomeOficial, nomeOficialOuNulo } from '../../src/services/sources/nomesOficiais';
import { MusicBrainzAdapter } from '../../src/services/sources/musicBrainzAdapter';
import { DiscogsAdapter } from '../../src/services/sources/discogsAdapter';

// --- Guarda de nome ---------------------------------------------------------

test('limparNomeOficial preserva a grafia oficial do nome', () => {
  assert.equal(limparNomeOficial('AC/DC'), 'AC/DC');
  assert.equal(limparNomeOficial('deadmau5'), 'deadmau5');
  assert.equal(limparNomeOficial('Björk'), 'Björk');
  assert.equal(limparNomeOficial("Guns N' Roses"), "Guns N' Roses");
  assert.equal(limparNomeOficial('Sgt. Pepper’s Lonely Hearts Club Band'), 'Sgt. Pepper’s Lonely Hearts Club Band');
});

test('limparNomeOficial só ajusta espaços em branco', () => {
  assert.equal(limparNomeOficial('  Daft\u00a0Punk \t One   More Time '), 'Daft Punk One More Time');
  assert.equal(limparNomeOficial('   '), '');
  assert.equal(limparNomeOficial(null), '');
  assert.equal(limparNomeOficial(undefined), '');
});

test('nomeOficialOuNulo descarta nome vazio', () => {
  assert.equal(nomeOficialOuNulo('  '), null);
  assert.equal(nomeOficialOuNulo(null), null);
  assert.equal(nomeOficialOuNulo(' The Beatles '), 'The Beatles');
});

// --- MusicBrainz ------------------------------------------------------------

// Resposta falsa da busca de artista e do browse de discos.
const RESPOSTA_ARTISTA = JSON.stringify({
  artists: [{ id: 'artista-1', name: 'The Beatles', score: 100 }],
});

const RESPOSTA_DISCOS = JSON.stringify({
  'release-count': 30,
  releases: [
    {
      id: 'release-1',
      title: 'Live at the BBC',
      date: '1994-11-30',
      country: 'GB',
      'release-group': { id: 'grupo-1', 'primary-type': 'Album', 'secondary-types': ['Live', 'Compilation'] },
      media: [
        {
          format: 'CD',
          tracks: [
            {
              number: '1',
              title: 'Beatles Greeting',
              recording: { id: 'grava-1', title: 'Beatles Greeting', 'first-release-date': '1994' },
            },
            {
              number: '2',
              title: '  Björk  –  Jóga  ',
              recording: { id: 'grava-2', title: '  Björk  –  Jóga  ', 'first-release-date': '1997' },
            },
          ],
        },
      ],
    },
  ],
});

test('MusicBrainz não cola o tipo de lançamento no nome da versão', async () => {
  const adapter = new MusicBrainzAdapter(async (url) =>
    url.includes('/artist?') ? RESPOSTA_ARTISTA : RESPOSTA_DISCOS
  );

  const releases = await adapter.buscarPorTermo('The Beatles');
  assert.equal(releases.length, 2);

  const primeira = releases[0]!;
  assert.equal(primeira.artist_name, 'The Beatles');
  assert.equal(primeira.version_name, 'Beatles Greeting');
  assert.equal(primeira.album_name, 'Live at the BBC');
  // O tipo continua existindo — no campo próprio, não no nome.
  assert.equal(primeira.release_type_name, 'Live Album');

  const segunda = releases[1]!;
  assert.equal(segunda.version_name, 'Björk – Jóga');
  assert.equal(segunda.work_title, 'Björk – Jóga');

  for (const release of releases) {
    assert.doesNotMatch(release.version_name, /\((Compilation|Live|Remix|Promo|Remastered)[^)]*\)/);
  }
});

test('MusicBrainz mantém o título oficial na busca por gravação', async () => {
  const respostaGravacao = JSON.stringify({
    recordings: [
      {
        id: 'grava-3',
        title: 'One More Time',
        'artist-credit': [
          {
            name: 'Daft Punk',
            artist: { id: 'artista-2', name: 'Daft Punk', 'sort-name': 'Daft Punk', area: { name: 'France' } },
          },
        ],
        releases: [
          {
            id: 'release-2',
            title: 'Discovery',
            date: '2001-03-12',
            country: 'FR',
            'release-group': { id: 'grupo-2', 'primary-type': 'Album', 'secondary-types': ['Compilation'] },
            media: [{ format: 'CD' }],
          },
        ],
      },
    ],
  });

  const adapter = new MusicBrainzAdapter(async (url) =>
    url.includes('/artist?') ? JSON.stringify({ artists: [] }) : respostaGravacao
  );

  const releases = await adapter.buscarPorTermo('daft punk one more time');
  assert.equal(releases.length, 1);

  const release = releases[0]!;
  assert.equal(release.artist_name, 'Daft Punk');
  assert.equal(release.version_name, 'One More Time');
  assert.equal(release.album_name, 'Discovery');
  assert.equal(release.release_type_name, 'Compilation');
});

// --- Discogs ----------------------------------------------------------------

test('Discogs não cola marcador de formato no nome da versão', async () => {
  const resposta = JSON.stringify({
    results: [
      {
        id: 999,
        title: 'Daft Punk - One More Time',
        type: 'release',
        year: 2000,
        country: 'US',
        label: ['Virgin (2)'],
        format: ['CD', 'Compilation', 'Remastered'],
        uri: '/release/999',
      },
    ],
    pagination: { page: 1, pages: 1, per_page: 50, items: 1 },
  });

  const adapter = new DiscogsAdapter(async () => resposta);
  const releases = await adapter.buscarPorTermo('daft punk');

  assert.equal(releases.length, 1);
  const release = releases[0]!;
  assert.equal(release.artist_name, 'Daft Punk');
  assert.equal(release.version_name, 'One More Time');
  assert.equal(release.album_name, 'One More Time');
  // "Compilation" e "Remastered" definem o tipo, o nome fica intacto.
  assert.equal(release.release_type_name, 'Compilation');
  // O numeral "(2)" é desambiguação interna do Discogs, não nome oficial.
  assert.equal(release.label, 'Virgin');
});

test('Discogs descarta resultado sem artista ou sem título', async () => {
  const resposta = JSON.stringify({
    results: [
      { id: 1, title: 'Título sem artista', type: 'release', format: ['CD'] },
      { id: 2, title: 'Artista -   ', type: 'release', format: ['CD'] },
    ],
    pagination: { page: 1, pages: 1, per_page: 50, items: 2 },
  });

  const adapter = new DiscogsAdapter(async () => resposta);
  const releases = await adapter.buscarPorTermo('sem nome');

  assert.equal(releases.length, 0);
});
