// Testes do contrato de reconhecimento sonoro no aplicativo.
//
// O que estes testes provam:
//   - o aplicativo só aceita status que existem no contrato compartilhado
//     com o backend;
//   - códigos HTTP são traduzidos em situações reconhecíveis pela interface;
//   - a mensagem exibida ao usuário vem do servidor quando ela existe;
//   - o texto de busca é montado apenas com o que o serviço identificou
//     (nunca com título ou artista inventados).
//
// Não há dependência do React Native aqui: o contrato é puro e roda no
// Node, sem emulador e sem navegador.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  STATUS_VALIDOS,
  descreverInterrupcao,
  mensagemDoCorpo,
  montarTermoBusca,
  statusPeloCodigoHttp,
  statusValido,
} from '../src/services/reconhecimentoContrato';

// ============================================================
// Validação do status recebido do servidor
// ============================================================

test('aceita todos os status do contrato compartilhado', () => {
  for (const status of STATUS_VALIDOS) {
    assert.equal(statusValido(status), true, `o status ${status} deveria ser aceito`);
  }

  assert.equal(STATUS_VALIDOS.length, 8);
});

test('recusa status fora do contrato', () => {
  assert.equal(statusValido('reconhecido'), false);
  assert.equal(statusValido(''), false);
  assert.equal(statusValido(42), false);
  assert.equal(statusValido(null), false);
  assert.equal(statusValido(undefined), false);
});

// ============================================================
// Tradução de códigos HTTP
// ============================================================

test('traduz códigos HTTP em situações do contrato', () => {
  assert.equal(statusPeloCodigoHttp(408), 'network_error');
  assert.equal(statusPeloCodigoHttp(504), 'network_error');
  assert.equal(statusPeloCodigoHttp(503), 'provider_error');
  assert.equal(statusPeloCodigoHttp(502), 'provider_error');
  assert.equal(statusPeloCodigoHttp(429), 'provider_error');
  // 400 é recusa do pedido, não indisponibilidade do serviço.
  assert.equal(statusPeloCodigoHttp(400), 'invalid_request');
});

// ============================================================
// Mensagem apresentada ao usuário
// ============================================================

test('usa a mensagem do servidor quando ela existe', () => {
  assert.equal(
    mensagemDoCorpo({ error: 'O serviço de reconhecimento está indisponível.' }, 'padrão'),
    'O serviço de reconhecimento está indisponível.'
  );
});

test('usa o campo message quando não há error', () => {
  assert.equal(
    mensagemDoCorpo({ message: 'Envie a amostra no campo correto.' }, 'padrão'),
    'Envie a amostra no campo correto.'
  );
});

test('usa o texto padrão quando o corpo não traz mensagem', () => {
  assert.equal(mensagemDoCorpo({}, 'padrão'), 'padrão');
  assert.equal(mensagemDoCorpo(null, 'padrão'), 'padrão');
  assert.equal(mensagemDoCorpo({ error: '   ' }, 'padrão'), 'padrão');
});

// ============================================================
// Integração entre o resultado reconhecido e o campo de busca
// ============================================================

test('monta o termo de busca com título e artista', () => {
  const termo = montarTermoBusca({
    status: 'matched',
    title: 'One More Time',
    artist: 'Daft Punk',
    album: 'Discovery',
    confidence: 94,
  });

  assert.equal(termo, 'One More Time Daft Punk');
});

test('usa apenas o título quando o serviço não devolve artista', () => {
  const termo = montarTermoBusca({ status: 'matched', title: 'Solaris' });

  assert.equal(termo, 'Solaris');
});

test('usa apenas o artista quando o serviço não devolve título', () => {
  const termo = montarTermoBusca({ status: 'matched', artist: 'Moby' });

  assert.equal(termo, 'Moby');
});

test('não inventa termo quando não há título identificado', () => {
  assert.equal(montarTermoBusca({ status: 'no_match' }), '');
  assert.equal(montarTermoBusca(null), '');
});

test('ignora álbum e confiança no texto de busca', () => {
  const termo = montarTermoBusca({
    status: 'matched',
    title: 'Get Lucky',
    artist: 'Daft Punk',
    album: 'Random Access Memories',
    releaseYear: 2013,
    confidence: 88,
  });

  assert.equal(termo, 'Get Lucky Daft Punk');
  assert.equal(termo.includes('Random Access Memories'), false);
  assert.equal(termo.includes('88'), false);
});

// ============================================================
// Interrupção da requisição (cancelamento × tempo esgotado)
// ============================================================

test('cancelamento do usuário vira o status cancelled', () => {
  const interrupcao = descreverInterrupcao(true);

  assert.equal(interrupcao.status, 'cancelled');
  assert.match(interrupcao.mensagem, /cancelada/i);
});

test('tempo esgotado vira network_error, nunca cancelled', () => {
  const interrupcao = descreverInterrupcao(false);

  assert.equal(interrupcao.status, 'network_error');
  assert.match(interrupcao.mensagem, /demorou demais/i);
});
