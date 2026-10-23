// Testes do AudioValidator — assinatura real de arquivos e checagem de duração.
//
// A assinatura é lida dos primeiros bytes do arquivo (não do nome): é isso que
// impede um HTML de erro ou um MP3 renomeado de FLAC de ser aceito como áudio
// válido no pipeline de download.

import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';

import { AudioValidator } from '../../src/services/audioSource/audioValidator';

const validador = new AudioValidator();
let diretorio = '';

before(async () => {
  diretorio = await fs.mkdtemp(path.join(os.tmpdir(), 'musicgalaxy-audio-'));
});

after(async () => {
  await fs.rm(diretorio, { recursive: true, force: true });
});

async function criarArquivo(nome: string, conteudo: Buffer): Promise<string> {
  const caminho = path.join(diretorio, nome);
  await fs.writeFile(caminho, conteudo);
  return caminho;
}

test('reconhece a assinatura ID3 de MP3', async () => {
  const caminho = await criarArquivo('faixa.mp3', Buffer.concat([Buffer.from('ID3'), Buffer.alloc(9)]));
  const resultado = await validador.checkFileSignature(caminho);

  assert.deepEqual(resultado, { valid: true, format: 'mp3' });
});

test('reconhece a assinatura fLaC de FLAC', async () => {
  const caminho = await criarArquivo('faixa.flac', Buffer.from('fLaC00000000'));
  const resultado = await validador.checkFileSignature(caminho);

  assert.equal(resultado.valid, true);
  assert.equal(resultado.format, 'flac');
});

test('reconhece RIFF de WAV', async () => {
  const caminho = await criarArquivo('faixa.wav', Buffer.from('RIFF0000WAVE'));

  const resultado = await validador.checkFileSignature(caminho);

  assert.equal(resultado.valid, true);
  assert.equal(resultado.format, 'wav');
});

test('reconhece caixa ftyp de M4A', async () => {
  const caminho = await criarArquivo(
    'faixa.m4a',
    Buffer.from([0x00, 0x00, 0x00, 0x20, 0x66, 0x74, 0x79, 0x70, 0x4d, 0x34, 0x41, 0x20])
  );

  const resultado = await validador.checkFileSignature(caminho);

  assert.equal(resultado.valid, true);
  assert.equal(resultado.format, 'm4a');
});

test('rejeita conteúdo que não é áudio (ex.: HTML disfarçado)', async () => {
  const caminho = await criarArquivo('pagina.mp3', Buffer.from('<html>erro</html>'));

  const resultado = await validador.checkFileSignature(caminho);

  assert.equal(resultado.valid, false);
  assert.equal(resultado.format, 'unknown');
});

test('arquivo inexistente é inválido, sem lançar exceção', async () => {
  const resultado = await validador.checkFileSignature(path.join(diretorio, 'nao-existe.mp3'));

  assert.equal(resultado.valid, false);
  assert.equal(resultado.format, 'unknown');
});

test('checkDuration aceita diferença dentro da tolerância de 10%', () => {
  const resultado = validador.checkDuration(200, 205);

  assert.equal(resultado.compatible, true);
  assert.equal(resultado.difference, 5);
  assert.equal(resultado.tolerance, 20.5);
});

test('checkDuration rejeita diferença acima da tolerância', () => {
  const resultado = validador.checkDuration(200, 230);

  assert.equal(resultado.compatible, false);
  assert.equal(resultado.difference, 30);
});

test('checkDuration sem duração esperada não rejeita', () => {
  const resultado = validador.checkDuration(200);

  assert.equal(resultado.compatible, true);
  assert.equal(resultado.tolerance, 0);
});
