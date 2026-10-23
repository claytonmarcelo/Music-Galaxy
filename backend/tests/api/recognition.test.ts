// Testes de integração do endpoint de reconhecimento sonoro.
//
// Sobem a aplicação Express em uma porta efêmera e exercitam o contrato
// HTTP real. O provedor externo não é chamado: sem credencial no ambiente,
// a rota responde 503 — que é exatamente o desfecho honesto para um
// servidor sem Recognition Provider configurado.
//
// O que estes testes provam:
//   - a rota aceita um corpo maior que o limite geral de 10kb (a amostra em
//     base64 passa do limite) e NÃO responde 413;
//   - amostras inválidas são recusadas com 400 e mensagem em português;
//   - sem credencial, a resposta é 503 com o status normalizado;
//   - a credencial configurada no servidor nunca aparece na resposta.

import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import type { Server } from 'node:http';
import { once } from 'node:events';

import { criarApp } from '../../src/app';

// ============================================================
// Tipos das respostas consumidas
// ============================================================

interface RespostaErro {
  success: boolean;
  error?: string;
  data?: { status?: string };
}

interface RespostaReconhecimento {
  success: boolean;
  error?: string;
  data: {
    status: string;
    title?: string;
    artist?: string;
    album?: string;
    releaseYear?: number;
    provider?: string;
    confidence?: number;
  };
}

// ============================================================
// Infraestrutura dos testes
// ============================================================

let servidor: Server | undefined;
let baseUrl = '';
let tokenAnterior: string | undefined;

before(async () => {
  // O teste garante o estado "sem credencial" sem depender do .env da máquina.
  tokenAnterior = process.env['AUDD_TOKEN'];
  delete process.env['AUDD_TOKEN'];

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

  if (tokenAnterior === undefined) {
    delete process.env['AUDD_TOKEN'];
  } else {
    process.env['AUDD_TOKEN'] = tokenAnterior;
  }
});

async function postarJson<T>(
  caminho: string,
  dados: unknown
): Promise<{ status: number; corpo: T; texto: string }> {
  const resposta = await fetch(`${baseUrl}${caminho}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(dados),
  });

  const texto = await resposta.text();
  const corpo = JSON.parse(texto) as T;

  return { status: resposta.status, corpo, texto };
}

/** Cria um WAV PCM válido (16 bits, mono, 8 kHz). */
function criarWav(segundos = 3): Buffer {
  const taxa = 8000;
  const amostras = Math.floor(taxa * segundos);
  const dados = Buffer.alloc(amostras * 2);

  for (let i = 0; i < amostras; i++) {
    const valor = Math.round(Math.sin((2 * Math.PI * 440 * i) / taxa) * 12000);
    dados.writeInt16LE(valor, i * 2);
  }

  const cabecalho = Buffer.alloc(44);
  cabecalho.write('RIFF', 0);
  cabecalho.writeUInt32LE(36 + dados.length, 4);
  cabecalho.write('WAVE', 8);
  cabecalho.write('fmt ', 12);
  cabecalho.writeUInt32LE(16, 16);
  cabecalho.writeUInt16LE(1, 20);
  cabecalho.writeUInt16LE(1, 22);
  cabecalho.writeUInt32LE(taxa, 24);
  cabecalho.writeUInt32LE(taxa * 2, 28);
  cabecalho.writeUInt16LE(2, 32);
  cabecalho.writeUInt16LE(16, 34);
  cabecalho.write('data', 36);
  cabecalho.writeUInt32LE(dados.length, 40);

  return Buffer.concat([cabecalho, dados]);
}

// ============================================================
// Validação do corpo
// ============================================================

test('POST /api/recognize sem corpo devolve 400 com mensagem clara', async () => {
  const { status, corpo } = await postarJson<RespostaErro>('/api/recognize', {});

  assert.equal(status, 400);
  assert.equal(corpo.success, false);
  assert.match(corpo.error ?? '', /audio_base64/i);
});

test('POST /api/recognize com base64 corrompido devolve 400', async () => {
  const { status, corpo } = await postarJson<RespostaErro>('/api/recognize', {
    audio_base64: '@@@nao-e-base64@@@',
  });

  assert.equal(status, 400);
  assert.equal(corpo.success, false);
  assert.match(corpo.error ?? '', /corrompida|inválido/i);
});

test('POST /api/recognize com conteúdo que não é áudio devolve 400', async () => {
  const texto = Buffer.from('x'.repeat(4096), 'utf8').toString('base64');
  const { status, corpo } = await postarJson<RespostaErro>('/api/recognize', {
    audio_base64: texto,
  });

  assert.equal(status, 400);
  assert.match(corpo.error ?? '', /formato do áudio/i);
});

// ============================================================
// Amostra válida, serviço sem credencial
// ============================================================

test('POST /api/recognize aceita amostra maior que o limite geral e responde 503 sem credencial', async () => {
  const audio = criarWav(3);
  const base64 = audio.toString('base64');

  // A prova de que o parser específico da rota funciona: a amostra em base64
  // passa de 10kb e a resposta NÃO é 413.
  assert.ok(base64.length > 10 * 1024, 'a amostra precisa passar do limite geral');

  const { status, corpo, texto } = await postarJson<RespostaReconhecimento>(
    '/api/recognize',
    { audio_base64: base64 }
  );

  assert.notEqual(status, 413);
  assert.equal(status, 503);
  assert.equal(corpo.success, false);
  assert.equal(corpo.data?.status, 'provider_error');
  assert.match(corpo.error ?? '', /não está configurado/i);

  // A credencial nunca aparece na resposta nem na mensagem de erro.
  assert.ok(!texto.toLowerCase().includes('api_token'));
  assert.ok(!texto.toLowerCase().includes('audd_token'));
});

// ============================================================
// Limite de requisições da rota
// ============================================================

test('POST /api/recognize respeita o limite de requisições da rota', async () => {
  const base64 = criarWav(3).toString('base64');
  let bloqueadas = 0;

  // O limite padrão da rota é de 20 tentativas por janela de 15 minutos.
  for (let i = 0; i < 30; i++) {
    const { status } = await postarJson<RespostaErro>('/api/recognize', {
      audio_base64: base64,
    });

    if (status === 429) bloqueadas++;
  }

  assert.ok(bloqueadas > 0, 'a rota precisa recusar tentativas acima do limite');
});
