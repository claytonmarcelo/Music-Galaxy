// Testes do reconhecimento sonoro do Music Galaxy.
//
// Cobrem a validação real da amostra de áudio (tamanho, base64 e formato
// pelos bytes de assinatura), a normalização da resposta do serviço externo e
// a proteção da credencial. Nenhum teste chama o serviço externo: a rede
// nunca é usada como prova.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  detectarFormato,
  TAMANHO_MAX_AUDIO_BYTES,
  validarAmostra,
} from '../../src/services/recognition/audioPayload';
import { lerDuracaoAmostra } from '../../src/services/recognition/duracaoAmostra';
import { normalizarRespostaAudD } from '../../src/services/recognition/auddProvider';
import {
  criarProvedor,
  provedorDisponivel,
  reconhecerMusica,
} from '../../src/services/recognition/recognitionService';
import { RecognitionError } from '../../src/services/recognition/types';

// ============================================================
// Auxiliares
// ============================================================

/** Cria um WAV PCM válido (16 bits) com a duração pedida. */
function criarWav(segundos = 3, taxa = 8000, canais = 1): Buffer {
  const bytesPorAmostra = 2 * canais;
  const amostras = Math.floor(taxa * segundos);
  const dados = Buffer.alloc(amostras * bytesPorAmostra);

  for (let i = 0; i < amostras; i++) {
    const valor = Math.round(Math.sin((2 * Math.PI * 440 * i) / taxa) * 12000);
    for (let canal = 0; canal < canais; canal++) {
      dados.writeInt16LE(valor, i * bytesPorAmostra + canal * 2);
    }
  }

  const cabecalho = Buffer.alloc(44);
  cabecalho.write('RIFF', 0);
  cabecalho.writeUInt32LE(36 + dados.length, 4);
  cabecalho.write('WAVE', 8);
  cabecalho.write('fmt ', 12);
  cabecalho.writeUInt32LE(16, 16);
  cabecalho.writeUInt16LE(1, 20);
  cabecalho.writeUInt16LE(canais, 22);
  cabecalho.writeUInt32LE(taxa, 24);
  cabecalho.writeUInt32LE(taxa * bytesPorAmostra, 28);
  cabecalho.writeUInt16LE(bytesPorAmostra, 32);
  cabecalho.writeUInt16LE(16, 34);
  cabecalho.write('data', 36);
  cabecalho.writeUInt32LE(dados.length, 40);

  return Buffer.concat([cabecalho, dados]);
}

/** Cria um FLAC mínimo com STREAMINFO coerente (taxa × amostras). */
function criarFlac(segundos: number, taxa = 44100): Buffer {
  const totalAmostras = Math.floor(taxa * segundos);

  const streamInfo = Buffer.alloc(34);
  // Taxa de amostragem (20 bits) nos bytes 10 a 12.
  streamInfo[10] = (taxa >> 12) & 0xff;
  streamInfo[11] = (taxa >> 4) & 0xff;
  streamInfo[12] = (taxa & 0x0f) << 4;
  // Total de amostras (36 bits): nibble baixo do byte 13 + bytes 14 a 17.
  streamInfo[13] = Math.floor(totalAmostras / 4294967296) & 0x0f;
  streamInfo[14] = (totalAmostras >>> 24) & 0xff;
  streamInfo[15] = (totalAmostras >>> 16) & 0xff;
  streamInfo[16] = (totalAmostras >>> 8) & 0xff;
  streamInfo[17] = totalAmostras & 0xff;

  // Cabeçalho do bloco: último bloco (0x80), tipo STREAMINFO (0), 34 bytes.
  const bloco = Buffer.from([0x80, 0x00, 0x00, 0x22]);

  return Buffer.concat([
    Buffer.from('fLaC', 'ascii'),
    bloco,
    streamInfo,
    Buffer.alloc(64),
  ]);
}

/** Cria um M4A mínimo com "ftyp" + "moov"/"mvhd" (versão 0). */
function criarM4a(segundos: number, escala = 1000): Buffer {
  const mvhd = Buffer.alloc(28);
  mvhd.writeUInt32BE(28, 0);
  mvhd.write('mvhd', 4, 'ascii');
  mvhd[8] = 0; // versão 0
  mvhd.writeUInt32BE(escala, 12 + 8);
  mvhd.writeUInt32BE(Math.round(segundos * escala), 12 + 12);

  const moov = Buffer.alloc(8);
  moov.writeUInt32BE(8 + mvhd.length, 0);
  moov.write('moov', 4, 'ascii');

  const ftyp = Buffer.alloc(16);
  ftyp.writeUInt32BE(16, 0);
  ftyp.write('ftyp', 4, 'ascii');
  ftyp.write('M4A ', 8, 'ascii');

  return Buffer.concat([ftyp, moov, mvhd]);
}

/** Cria um MP3 fictício com um quadro MPEG1 Layer III de 128 kbps. */
function criarMp3(segundos: number, kbps = 128): Buffer {
  const bytes = Math.round((segundos * kbps * 1000) / 8);
  const audio = Buffer.alloc(bytes);

  // Sincronização 11 bits, MPEG1 (versão 3), Layer III (camada 1),
  // bitrate index 9 = 128 kbps.
  audio[0] = 0xff;
  audio[1] = 0xfb;
  audio[2] = 0x90;
  audio[3] = 0x00;

  return audio;
}

// ============================================================
// Detecção de formato pelos bytes de assinatura
// ============================================================

test('detectarFormato identifica os formatos aceitos', () => {
  assert.equal(detectarFormato(Buffer.from('ID3\x03\x00\x00', 'ascii')), 'mp3');
  assert.equal(detectarFormato(Buffer.from([0xff, 0xfb, 0x90, 0x00])), 'mp3');
  assert.equal(detectarFormato(criarWav(1)), 'wav');
  assert.equal(detectarFormato(Buffer.from('fLaC\x00\x00', 'ascii')), 'flac');
  assert.equal(detectarFormato(Buffer.from('OggS\x00\x00', 'ascii')), 'ogg');
  assert.equal(
    detectarFormato(Buffer.concat([Buffer.alloc(4), Buffer.from('ftypM4A ', 'ascii')])),
    'm4a'
  );
  assert.equal(
    detectarFormato(Buffer.from([0x1a, 0x45, 0xdf, 0xa3, 0x01, 0x02])),
    'webm'
  );
  assert.equal(detectarFormato(Buffer.from([0xff, 0xf1, 0x50, 0x80])), 'aac');
});

test('detectarFormato devolve null para conteúdo que não é áudio', () => {
  assert.equal(detectarFormato(Buffer.from('isto é um texto', 'utf8')), null);
  assert.equal(detectarFormato(Buffer.alloc(2)), null);
});

// ============================================================
// Validação da amostra
// ============================================================

test('validarAmostra aceita um WAV válido enviado em base64', () => {
  const audio = criarWav(3);
  const resultado = validarAmostra(audio.toString('base64'));

  assert.equal(resultado.formato, 'wav');
  assert.equal(resultado.audio.length, audio.length);
});
test('validarAmostra aceita o prefixo de data URI', () => {
  const audio = criarWav(3);
  const resultado = validarAmostra(`data:audio/wav;base64,${audio.toString('base64')}`);

  assert.equal(resultado.formato, 'wav');
});

test('validarAmostra recusa amostra vazia ou base64 corrompido', () => {
  assert.throws(() => validarAmostra(''), /amostra de áudio/i);
  assert.throws(() => validarAmostra('   '), /amostra de áudio/i);
  assert.throws(() => validarAmostra('@@@nao-e-base64@@@'), /corrompida|inválido/i);
  assert.throws(() => validarAmostra('abcde'), /corrompida|inválido/i);
});

test('validarAmostra recusa conteúdo que não é áudio', () => {
  const texto = Buffer.from('x'.repeat(4096), 'utf8').toString('base64');

  assert.throws(() => validarAmostra(texto), /formato do áudio/i);
});

test('validarAmostra recusa amostra curta demais', () => {
  const minimo = Buffer.from([0xff, 0xfb, 0x90, 0x00, 0x00, 0x00]).toString('base64');

  assert.throws(() => validarAmostra(minimo), /curta demais/i);
});

test('validarAmostra recusa amostra maior que o limite', () => {
  const gigante = 'A'.repeat(Math.ceil(TAMANHO_MAX_AUDIO_BYTES * 1.5));

  assert.throws(() => validarAmostra(gigante), /grande demais/i);
});

// ============================================================
// Leitura da duração da amostra
// ============================================================
//
// A leitura veio do próprio arquivo. A estimativa antiga (tamanho ÷ 128 kbps)
// recusava como "longa demais" amostras legítimas de WAV e FLAC — os testes
// abaixo cobrem exatamente esse caso, com a duração real conhecida.

test('lerDuracaoAmostra lê a duração exata de um WAV', () => {
  const resultado = lerDuracaoAmostra(criarWav(3), 'wav');

  assert.equal(resultado.segundos, 3);
  assert.equal(resultado.exata, true);
});

test('lerDuracaoAmostra aceita WAV de alta qualidade de 12 segundos', () => {
  // 44,1 kHz, mono, 16 bits: 1.058.400 bytes. A regra antiga (128 kbps)
  // diria 66 segundos e recusaria a amostra; o cabeçalho diz 12.
  const audio = criarWav(12, 44100);
  assert.ok(audio.length > 1024 * 1024, 'o arquivo precisa passar de 1 MB');

  const resultado = lerDuracaoAmostra(audio, 'wav');

  assert.equal(resultado.segundos, 12);
  assert.equal(resultado.exata, true);
});

test('lerDuracaoAmostra lê a duração exata de um FLAC', () => {
  const resultado = lerDuracaoAmostra(criarFlac(8), 'flac');

  assert.equal(resultado.segundos, 8);
  assert.equal(resultado.exata, true);
});

test('lerDuracaoAmostra lê a duração exata de um M4A', () => {
  const resultado = lerDuracaoAmostra(criarM4a(12), 'm4a');

  assert.equal(resultado.segundos, 12);
  assert.equal(resultado.exata, true);
});

test('lerDuracaoAmostra lê a taxa do quadro de um MP3', () => {
  const resultado = lerDuracaoAmostra(criarMp3(3), 'mp3');

  assert.equal(resultado.segundos, 3);
  // VBR: o primeiro quadro não garante a taxa média do arquivo.
  assert.equal(resultado.exata, false);
});

test('lerDuracaoAmostra marca a estimativa como aproximada quando não há cabeçalho', () => {
  const resultado = lerDuracaoAmostra(Buffer.alloc(16 * 1024), 'ogg');

  assert.equal(resultado.segundos, 1);
  assert.equal(resultado.exata, false);
});

test('reconhecerMusica recusa amostra acima da janela máxima', async () => {
  const tokenAnterior = process.env['AUDD_TOKEN'];
  // A janela é conferida antes de qualquer chamada externa: o token fictício
  // só libera o passo do provedor para que a duração seja avaliada.
  process.env['AUDD_TOKEN'] = 'token-de-teste';

  try {
    await assert.rejects(
      () => reconhecerMusica(criarWav(35).toString('base64')),
      (erro: unknown) => {
        assert.ok(erro instanceof RecognitionError);
        assert.equal(erro.statusHttp, 400);
        assert.match(erro.message, /longa demais/i);
        return true;
      }
    );
  } finally {
    if (tokenAnterior === undefined) {
      delete process.env['AUDD_TOKEN'];
    } else {
      process.env['AUDD_TOKEN'] = tokenAnterior;
    }
  }
});

// ============================================================
// Normalização da resposta do serviço externo
// ============================================================

test('normalizarRespostaAudD converte a resposta bem-sucedida no contrato', () => {
  const resultado = normalizarRespostaAudD({
    status: 'success',
    result: {
      title: 'One More Time',
      artist: 'Daft Punk',
      album: 'Discovery',
      releaseDate: '2001-03-07',
      score: 0.98,
    },
  });

  assert.equal(resultado.status, 'matched');
  assert.equal(resultado.title, 'One More Time');
  assert.equal(resultado.artist, 'Daft Punk');
  assert.equal(resultado.album, 'Discovery');
  assert.equal(resultado.releaseYear, 2001);
  assert.equal(resultado.provider, 'audd');
  assert.equal(resultado.confidence, 98);
});

test('normalizarRespostaAudD não inventa metadados ausentes', () => {
  const resultado = normalizarRespostaAudD({
    status: 'success',
    result: { title: 'Trilha Sem Artista' },
  });

  assert.equal(resultado.status, 'matched');
  assert.equal(resultado.title, 'Trilha Sem Artista');
  assert.equal(resultado.artist, undefined);
  assert.equal(resultado.album, undefined);
  assert.equal(resultado.releaseYear, undefined);
  assert.equal(resultado.confidence, undefined);
});

test('normalizarRespostaAudD devolve sem correspondência quando falta o título', () => {
  const resultado = normalizarRespostaAudD({
    status: 'success',
    result: { artist: 'Artista Desconhecido' },
  });

  assert.equal(resultado.status, 'no_match');
  assert.equal(resultado.title, undefined);
});

test('normalizarRespostaAudD ignora pontuação fora da faixa documentada', () => {
  const resultado = normalizarRespostaAudD({
    status: 'success',
    result: { title: 'Faixa', score: 7.5 },
  });

  assert.equal(resultado.confidence, undefined);
});

// ============================================================
// Escolha e proteção do provedor
// ============================================================

test('provedor padrão fica indisponível sem credencial configurada', () => {
  const tokenAnterior = process.env['AUDD_TOKEN'];
  delete process.env['AUDD_TOKEN'];

  try {
    assert.equal(provedorDisponivel(), false);
    assert.equal(criarProvedor().disponivel, false);
  } finally {
    if (tokenAnterior !== undefined) process.env['AUDD_TOKEN'] = tokenAnterior;
  }
});

test('provedor padrão fica disponível quando há credencial', () => {
  const tokenAnterior = process.env['AUDD_TOKEN'];
  process.env['AUDD_TOKEN'] = 'token-de-teste';

  try {
    assert.equal(provedorDisponivel(), true);
    assert.equal(criarProvedor().nome, 'audd');
  } finally {
    if (tokenAnterior === undefined) {
      delete process.env['AUDD_TOKEN'];
    } else {
      process.env['AUDD_TOKEN'] = tokenAnterior;
    }
  }
});

test('provedor desconhecido configurado no ambiente vira erro de negócio', () => {
  const anterior = process.env['RECOGNITION_PROVIDER'];
  process.env['RECOGNITION_PROVIDER'] = 'inexistente';

  try {
    assert.throws(() => criarProvedor(), RecognitionError);
    assert.equal(provedorDisponivel(), false);
  } finally {
    if (anterior === undefined) {
      delete process.env['RECOGNITION_PROVIDER'];
    } else {
      process.env['RECOGNITION_PROVIDER'] = anterior;
    }
  }
});

test('reconhecerMusica falha com segurança quando não há credencial', async () => {
  const tokenAnterior = process.env['AUDD_TOKEN'];
  delete process.env['AUDD_TOKEN'];

  try {
    await assert.rejects(
      () => reconhecerMusica(criarWav(3).toString('base64')),
      (erro: unknown) => {
        assert.ok(erro instanceof RecognitionError);
        assert.equal(erro.status, 'provider_error');
        assert.equal(erro.statusHttp, 503);
        assert.ok(!erro.message.includes('token'), 'mensagem não pode citar a credencial');
        return true;
      }
    );
  } finally {
    if (tokenAnterior !== undefined) process.env['AUDD_TOKEN'] = tokenAnterior;
  }
});
