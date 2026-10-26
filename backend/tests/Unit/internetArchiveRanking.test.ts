// Testes da escolha de item do Internet Archive (Regra 7).
//
// A busca do archive.org devolve os itens pela relevância dela, e essa ordem é
// dominada por homônimos. Estes testes usam a lista real respondida em
// 26/10/2026 para a consulta de "Skank" e verificam que o provedor passa a
// abrir primeiro os itens do artista pedido — sem gastar requisição a mais,
// porque título, criador e identificador já vêm na resposta da busca.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  ordenarPorAfantidade,
  pontuarDocumento,
  type DocumentoBusca,
} from '../../src/services/audioSource/providers/internetArchiveProvider';

const skank = { artist: 'Skank', title: 'Saideira' };

// Trecho da resposta real da advancedsearch para a consulta de "Skank".
const itensDaBusca: DocumentoBusca[] = [
  {
    identifier: '9TheDangerousBet',
    title: 'Mournful Skank - The Dangerous Bet',
    creator: 'Mournful Skank',
  },
  { identifier: 'zarbsong-2008-organ-pad-skank', title: 'Zarbsong - Organ Pad Skank', creator: 'Zarbsong' },
  { identifier: 'skank-o-samba-pocone-cd_202605', title: 'Skank - O Samba Poconé (CD)', creator: 'VanderLuizVLDM' },
  { identifier: '18-skank-obeijo-e-a-reza-demo', title: 'Skank - Calango (1994)', creator: 'Album' },
  { identifier: '2000-skank-maquinarama', title: 'Maquinarama', creator: 'Skank' },
];

test('coloca os discos do artista pedido antes dos homônimos', () => {
  const ordenados = ordenarPorAfantidade(itensDaBusca, skank);
  const tresPrimeiros = ordenados.slice(0, 3).map((d) => String(d.identifier));

  assert.ok(tresPrimeiros.includes('2000-skank-maquinarama'), 'o álbum com o artista no creator deve entrar');
  assert.ok(
    tresPrimeiros.includes('skank-o-samba-pocone-cd_202605') ||
      tresPrimeiros.includes('18-skank-obeijo-e-a-reza-demo'),
    'um item que se apresenta como "Skank - <álbum>" deve entrar'
  );
  assert.equal(ordenados.at(-1)!.identifier, 'zarbsong-2008-organ-pad-skank');
});

test('prefere o item cujo nome já declara a faixa pedida', () => {
  const itens: DocumentoBusca[] = [
    { identifier: 'skank-calango', title: 'Skank - Calango (1994)' },
    { identifier: 'skank-saideira-single', title: 'Skank - Saideira' },
  ];

  assert.equal(ordenarPorAfantidade(itens, skank)[0]!.identifier, 'skank-saideira-single');
});

test('enxerga a faixa também dentro do identificador do upload', () => {
  // "18-skank-obeijo-e-a-reza-demo" é o arquivo de uma faixa do Calango: o
  // identificador diz o nome da música, mas o título do item diz só o álbum.
  const identidade = { artist: 'Skank', title: 'O Beijo e a Reza' };
  const comFaixa = pontuarDocumento(
    { identifier: '18-skank-obeijo-e-a-reza-demo', title: 'Skank - Calango (1994)', creator: 'Album' },
    identidade
  );
  const semFaixa = pontuarDocumento(
    { identifier: 'skank-o-samba-pocone-cd_202605', title: 'Skank - O Samba Poconé (CD)', creator: 'VanderLuizVLDM' },
    identidade
  );

  assert.ok(comFaixa > semFaixa, `a faixa citada no identificador deve pontuar mais (${comFaixa} > ${semFaixa})`);
});

test('credencial certa no campo creator vale mais que a palavra solta no título', () => {
  const creditoExato = pontuarDocumento(
    { identifier: '2000-skank-maquinarama', title: 'Maquinarama', creator: 'Skank' },
    skank
  );
  const homonimo = pontuarDocumento(
    { identifier: '9TheDangerousBet', title: 'Mournful Skank - The Dangerous Bet', creator: 'Mournful Skank' },
    skank
  );

  assert.ok(creditoExato > homonimo, `artista do item deve pontuar mais que o homônimo (${creditoExato} > ${homonimo})`);
});

test('emparelha mantendo a ordem que a API respondeu', () => {
  const itens: DocumentoBusca[] = [
    { identifier: 'um', title: 'Trilha do filme Um' },
    { identifier: 'dois', title: 'Trilha do filme Dois' },
  ];

  assert.deepEqual(
    ordenarPorAfantidade(itens, skank).map((d) => d.identifier),
    ['um', 'dois']
  );
});
