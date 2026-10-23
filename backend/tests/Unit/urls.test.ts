// Testes dos utilitários de URL da API.
// Garantem que o app recebe sempre os endpoints do backend (Regra 3) e nunca
// as colunas legadas de plataformas, que foram zeradas mas seguem no schema.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { urlsDeMidia } from '../../src/utils/urls';

test('urlsDeMidia aponta stream e download para a própria API', () => {
  const urls = urlsDeMidia('http://127.0.0.1:3001', 40);

  assert.equal(urls.streaming_url, 'http://127.0.0.1:3001/api/releases/40/stream');
  assert.equal(urls.download_url, 'http://127.0.0.1:3001/api/releases/40/download');
});

test('urlsDeMidia não reutiliza preview nem URL de plataforma', () => {
  const urls = urlsDeMidia('https://api.exemplo.org', 7);

  assert.ok(urls.streaming_url.startsWith('https://api.exemplo.org/api/'));
  assert.ok(urls.download_url.startsWith('https://api.exemplo.org/api/'));
  assert.ok(!urls.streaming_url.includes('youtube'));
  assert.ok(!urls.download_url.includes('spotify'));
});
