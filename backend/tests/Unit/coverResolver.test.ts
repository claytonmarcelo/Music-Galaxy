// Testes da Regra 1 — capa oficial da fonte consultada.
//
// O que se verifica aqui:
//   - a referência oficial é lida da URL gravada pela ingestão (MBID do
//     MusicBrainz e id numérico do Discogs);
//   - a imagem escolhida é sempre a capa (principal/frente), nunca a
//     contracapa ou o selo;
//   - quando a fonte não tem imagem, o resultado é null — nenhuma capa é
//     inventada e o aplicativo mostra "Sem capa".
//
// A camada HTTP é injetada: os testes não acessam a internet nem o token.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  escolherImagemCoverArt,
  escolherImagemDiscogs,
  extrairIdDiscogs,
  extrairMbidMusicBrainz,
  normalizarUrlDeCapa,
  resolverCapa,
  type Requisitar,
} from '../../src/services/covers/coverResolver';

// --- Leitura da referência oficial -----------------------------------------

test('extrai o MBID do lançamento a partir da URL do MusicBrainz', () => {
  assert.equal(
    extrairMbidMusicBrainz('https://musicbrainz.org/release/02B23593-AD18-4C8C-B30A-5C96B4796289'),
    '02b23593-ad18-4c8c-b30a-5c96b4796289'
  );
  assert.equal(
    extrairMbidMusicBrainz('https://musicbrainz.org/release-group/02b23593-ad18-4c8c-b30a-5c96b4796289'),
    null
  );
  assert.equal(extrairMbidMusicBrainz(null), null);
  assert.equal(extrairMbidMusicBrainz('https://exemplo.com/release/123'), null);
});

test('extrai o id numérico do lançamento a partir da URL do Discogs', () => {
  assert.equal(
    extrairIdDiscogs('https://www.discogs.com/release/1035041-Daft-Punk-One-More-Time'),
    '1035041'
  );
  assert.equal(
    extrairIdDiscogs('https://www.discogs.com/pt_BR/release/1035041-Daft-Punk-One-More-Time'),
    '1035041'
  );
  assert.equal(extrairIdDiscogs('https://www.discogs.com/artist/123-Daft-Punk'), null);
  assert.equal(extrairIdDiscogs(''), null);
});

// --- Escolha da imagem ------------------------------------------------------

test('prefere a capa principal do Discogs e ignora contracapa e selo', () => {
  assert.equal(
    escolherImagemDiscogs([
      { type: 'secondary', uri: 'https://i.discogs.com/contracapa.jpeg' },
      { type: 'primary', uri: 'https://i.discogs.com/capa.jpeg' },
    ]),
    'https://i.discogs.com/capa.jpeg'
  );

  // Sem imagem marcada como principal, usa a primeira que tem URL.
  assert.equal(
    escolherImagemDiscogs([
      { type: 'secondary', uri: 'https://i.discogs.com/encarte.jpeg' },
    ]),
    'https://i.discogs.com/encarte.jpeg'
  );

  assert.equal(escolherImagemDiscogs([]), null);
  assert.equal(escolherImagemDiscogs(undefined), null);
});

test('prefere a frente no Cover Art Archive e a miniatura de 500 px', () => {
  assert.equal(
    escolherImagemCoverArt([
      { front: false, image: 'https://coverartarchive.org/verso.jpg' },
      {
        front: true,
        image: 'https://coverartarchive.org/capa.jpg',
        thumbnails: { '500': 'https://coverartarchive.org/capa-500.jpg' },
      },
    ]),
    'https://coverartarchive.org/capa-500.jpg'
  );

  // Sem miniatura, usa a imagem original.
  assert.equal(
    escolherImagemCoverArt([{ front: true, image: 'https://coverartarchive.org/capa.jpg' }]),
    'https://coverartarchive.org/capa.jpg'
  );

  assert.equal(escolherImagemCoverArt([]), null);
  assert.equal(escolherImagemCoverArt(undefined), null);
});

// --- Resolução com camada HTTP falsa ---------------------------------------

test('resolve a capa do MusicBrainz pelo Cover Art Archive', async () => {
  const chamadas: string[] = [];
  const requisitar: Requisitar = async (url) => {
    chamadas.push(url);
    return {
      status: 200,
      json: {
        images: [
          {
            front: true,
            image: 'https://coverartarchive.org/release/abc/frente.jpg',
            thumbnails: { '500': 'https://coverartarchive.org/release/abc/frente-500.jpg' },
          },
        ],
      },
    };
  };

  const capa = await resolverCapa(
    'MusicBrainz',
    'https://musicbrainz.org/release/02b23593-ad18-4c8c-b30a-5c96b4796289',
    requisitar
  );

  assert.equal(capa, 'https://coverartarchive.org/release/abc/frente-500.jpg');
  assert.deepEqual(chamadas, [
    'https://coverartarchive.org/release/02b23593-ad18-4c8c-b30a-5c96b4796289',
  ]);
});

test('capa devolvida em http sobe para https sem trocar a imagem', async () => {
  // O Cover Art Archive entrega a miniatura em http; em página https o
  // navegador bloqueia a imagem e o Android recusa tráfego não criptografado.
  const requisitar: Requisitar = async () => ({
    status: 200,
    json: {
      images: [
        {
          front: true,
          thumbnails: { '500': 'http://coverartarchive.org/release/abc/frente-500.jpg' },
        },
      ],
    },
  });

  assert.equal(
    await resolverCapa(
      'MusicBrainz',
      'https://musicbrainz.org/release/02b23593-ad18-4c8c-b30a-5c96b4796289',
      requisitar
    ),
    'https://coverartarchive.org/release/abc/frente-500.jpg'
  );

  assert.equal(normalizarUrlDeCapa(null), null);
  assert.equal(
    normalizarUrlDeCapa('https://i.discogs.com/capa.jpeg'),
    'https://i.discogs.com/capa.jpeg'
  );
});

test('sem imagem no acervo, a capa fica nula — nada é inventado', async () => {
  const requisitar: Requisitar = async () => ({ status: 404 });

  assert.equal(
    await resolverCapa(
      'MusicBrainz',
      'https://musicbrainz.org/release/02b23593-ad18-4c8c-b30a-5c96b4796289',
      requisitar
    ),
    null
  );

  // Corpo 200 sem a lista de imagens também não produz capa.
  assert.equal(
    await resolverCapa(
      'MusicBrainz',
      'https://musicbrainz.org/release/02b23593-ad18-4c8c-b30a-5c96b4796289',
      async () => ({ status: 200, json: {} })
    ),
    null
  );
});

test('resolve a capa do Discogs pelo detalhe do lançamento', async () => {
  // O token real fica só no ambiente do servidor; aqui basta um valor de
  // teste para exercitar o caminho de resolução.
  const tokenAnterior = process.env['DISCOGS_TOKEN'];
  process.env['DISCOGS_TOKEN'] = 'token-de-teste';

  const requisitar: Requisitar = async () => ({
    status: 200,
    json: {
      images: [
        { type: 'secondary', uri: 'https://i.discogs.com/verso.jpeg' },
        { type: 'primary', uri: 'https://i.discogs.com/capa.jpeg' },
      ],
    },
  });

  try {
    const capa = await resolverCapa(
      'Discogs',
      'https://www.discogs.com/release/1035041-Daft-Punk-One-More-Time',
      requisitar
    );

    assert.equal(capa, 'https://i.discogs.com/capa.jpeg');
  } finally {
    if (tokenAnterior === undefined) delete process.env['DISCOGS_TOKEN'];
    else process.env['DISCOGS_TOKEN'] = tokenAnterior;
  }
});

test('sem token do Discogs, nenhuma consulta é feita e a capa fica nula', async () => {
  const tokenAnterior = process.env['DISCOGS_TOKEN'];
  delete process.env['DISCOGS_TOKEN'];

  let chamou = false;
  const requisitar: Requisitar = async () => {
    chamou = true;
    return { status: 200, json: { images: [{ type: 'primary', uri: 'x' }] } };
  };

  try {
    assert.equal(
      await resolverCapa(
        'Discogs',
        'https://www.discogs.com/release/1035041-Daft-Punk-One-More-Time',
        requisitar
      ),
      null
    );
    assert.equal(chamou, false);
  } finally {
    if (tokenAnterior === undefined) delete process.env['DISCOGS_TOKEN'];
    else process.env['DISCOGS_TOKEN'] = tokenAnterior;
  }
});

test('fonte desconhecida ou referência inválida não geram consulta', async () => {
  let chamou = false;
  const requisitar: Requisitar = async () => {
    chamou = true;
    return { status: 200, json: {} };
  };

  assert.equal(await resolverCapa('Outra Fonte', 'https://exemplo.com/release/1', requisitar), null);
  assert.equal(await resolverCapa('MusicBrainz', null, requisitar), null);
  assert.equal(await resolverCapa(null, 'https://musicbrainz.org/release/abc', requisitar), null);
  assert.equal(chamou, false);
});
