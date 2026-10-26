// Testes da distinção entre "a fonte oficial não tem" e "a fonte oficial não
// respondeu" (Regra 7 e o pedido do dono: o projeto tem que achar a música que
// o usuário pedir, e quando não acha precisa dizer a verdade sobre o motivo).
//
// Medido em 26/10/2026 nesta máquina: o MusicBrainz devolve HTTP 503 ("The
// MusicBrainz web server is currently busy") em 2 de cada 6 chamadas. Como o
// catch da busca por artista engolia qualquer erro, um artista real que estava
// indisponível virava "nenhuma versão encontrada" na tela — e sem nenhuma linha
// no log de ingestão para contar o que aconteceu.
//
// A camada HTTP é falsa: cada URL devolve o que o teste manda, e uma delas pode
// recusar. Nenhum acesso à rede acontece aqui.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { MusicBrainzAdapter } from '../../src/services/sources/musicBrainzAdapter';

// Resposta de um artista que passou no piso de catálogo e na igualdade de nome.
const RESPOSTA_ARTISTA_COM_CATALOGO = JSON.stringify({
  artists: [{ id: 'artista-1', name: 'Mambolado', score: 100, country: 'Brazil' }],
});

// Página de disco com uma faixa — o bastante para a discografia devolver algo.
const PAGINA_DISCO = JSON.stringify({
  'release-count': 40,
  releases: [
    {
      id: 'release-1',
      title: 'Sereno',
      date: '2016-01-01',
      country: 'BR',
      'release-group': { id: 'grupo-1', 'primary-type': 'Album' },
      media: [
        {
          format: 'CD',
          tracks: [
            {
              number: '1',
              title: 'Sereno',
              recording: { id: 'grava-1', title: 'Sereno', 'first-release-date': '2016' },
            },
          ],
        },
      ],
    },
  ],
});

const GRAVACOES_VAZIAS = JSON.stringify({ recordings: [] });

interface OpcoesHttp {
  artista?: () => Promise<string>;
  gravacao?: () => Promise<string>;
  disco?: () => Promise<string>;
}

// Adapter com HTTP falso que pode falhar em cada chamada, separadamente.
function criarAdapter(opcoes: OpcoesHttp): MusicBrainzAdapter {
  const indisponivel = () => Promise.reject(new Error('MusicBrainz respondeu com status 503'));

  return new MusicBrainzAdapter(async (url) => {
    if (url.includes('/artist?')) return opcoes.artista ? opcoes.artista() : RESPOSTA_ARTISTA_COM_CATALOGO;
    if (url.includes('/recording?')) return opcoes.gravacao ? opcoes.gravacao() : GRAVACOES_VAZIAS;
    return opcoes.disco ? opcoes.disco() : PAGINA_DISCO;
  });
}

test('fonte indisponível não vira "essa música não existe"', async () => {
  // A chamada que reconhece o artista falha (503) e a busca por gravação
  // responde vazia. O resultado de antes era `[]`, lido como acervo vazio.
  const adapter = criarAdapter({ artista: () => Promise.reject(new Error('MusicBrainz respondeu com status 503')) });

  await assert.rejects(
    () => adapter.buscarPorTermo('mambolado'),
    /503/,
    'uma fonte que não respondeu precisa subir como erro, não como vazio'
  );
});

test('a busca por gravação continua salvando o termo quando a discografia falha', async () => {
  // A discografia morre, mas a gravação responde com algo: o usuário recebe o
  // que a fonte realmente entregou, sem erro e sem inventação.
  const gravacaoComResultado = JSON.stringify({
    recordings: [
      {
        id: 'grava-9',
        title: 'Sereno',
        'artist-credit': [{ name: 'Mambolado', artist: { id: 'artista-9', name: 'Mambolado', country: 'BR' } }],
        releases: [
          {
            id: 'release-9',
            title: 'Sereno',
            date: '2016-05-05',
            country: 'BR',
            'release-group': { id: 'grupo-9', 'primary-type': 'Album' },
            'artist-credit': [{ name: 'Mambolado' }],
          },
        ],
      },
    ],
  });

  const adapter = criarAdapter({
    artista: () => Promise.reject(new Error('MusicBrainz respondeu com status 503')),
    gravacao: () => Promise.resolve(gravacaoComResultado),
  });

  const releases = await adapter.buscarPorTermo('mambolado');
  assert.ok(releases.length > 0, 'a alternativa que respondeu não pode ser descartada');
});

test('fonte que respondeu vazia continua sendo vazia, não erro', async () => {
  // Caso honesto: a discografia não passou no piso (nada de erro de transporte)
  // e a gravação devolve zero itens. Isso é "não existe no catálogo aberto" e
  // precisa continuar terminando em lista vazia — senão toda busca sem resultado
  // viraria falha do serviço.
  const adapter = criarAdapter({
    artista: () => Promise.resolve(JSON.stringify({ artists: [] })),
    gravacao: () => Promise.resolve(GRAVACOES_VAZIAS),
  });

  assert.deepEqual(await adapter.buscarPorTermo('zzzo termo inexistente zzz'), []);
});
