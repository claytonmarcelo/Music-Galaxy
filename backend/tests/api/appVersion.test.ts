// Testes do endpoint de versão publicada do aplicativo.
//
// O servidor é a fonte de verdade sobre a última versão disponível. O teste
// sobe a aplicação Express em uma porta efêmera e confere o contrato
// publicado, inclusive a proteção contra URLs e versões malformadas no
// ambiente — nada pode fazer o aplicativo abrir um endereço perigoso.

import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import type { Server } from 'node:http';
import { once } from 'node:events';

import { criarApp } from '../../src/app';
import { versaoPublicada } from '../../src/services/appVersion';

interface RespostaVersao {
  success: boolean;
  data: {
    versao: string;
    url: string;
    notas: string | null;
    obrigatoria: boolean;
  };
}

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
});

async function obterVersao(): Promise<{ status: number; corpo: RespostaVersao }> {
  const resposta = await fetch(`${baseUrl}/api/app/versao`);
  const corpo = (await resposta.json()) as RespostaVersao;
  return { status: resposta.status, corpo };
}

test('GET /api/app/versao devolve o contrato de versão publicada', async () => {
  const { status, corpo } = await obterVersao();

  assert.equal(status, 200);
  assert.equal(corpo.success, true);
  assert.equal(typeof corpo.data.versao, 'string');
  assert.match(corpo.data.versao, /^\d+(\.\d+){0,2}$/);
  assert.equal(typeof corpo.data.url, 'string');
  assert.match(corpo.data.url, /^https?:\/\//);
  assert.equal(typeof corpo.data.obrigatoria, 'boolean');
  assert.ok(corpo.data.notas === null || typeof corpo.data.notas === 'string');
});

test('a rota devolve exatamente o que o serviço publica', async () => {
  const { corpo } = await obterVersao();
  const publicado = versaoPublicada();

  assert.deepEqual(corpo.data, publicado);
});

test('versão fora do formato no ambiente cai no padrão seguro', () => {
  const original = process.env['APP_VERSAO_PUBLICADA'];
  try {
    process.env['APP_VERSAO_PUBLICADA'] = 'versao-de-teste';
    assert.equal(versaoPublicada().versao, '1.0.0');
  } finally {
    if (original === undefined) {
      delete process.env['APP_VERSAO_PUBLICADA'];
    } else {
      process.env['APP_VERSAO_PUBLICADA'] = original;
    }
  }
});

test('endereço fora de http/https no ambiente cai no padrão seguro', () => {
  const original = process.env['APP_URL_DOWNLOAD'];
  try {
    process.env['APP_URL_DOWNLOAD'] = 'javascript:alert(1)';
    assert.match(versaoPublicada().url, /^https:\/\//);

    process.env['APP_URL_DOWNLOAD'] = 'ftp://exemplo.com/apk';
    assert.match(versaoPublicada().url, /^https:\/\//);
  } finally {
    if (original === undefined) {
      delete process.env['APP_URL_DOWNLOAD'];
    } else {
      process.env['APP_URL_DOWNLOAD'] = original;
    }
  }
});
