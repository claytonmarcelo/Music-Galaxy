// Leitura da duração real da amostra de áudio.
//
// Por que existe: o reconhecimento precisa saber se o trecho tem pelo menos
// 2 segundos e no máximo 30 — a janela útil do serviço externo. A estimativa
// anterior dividia o tamanho do arquivo por uma taxa fixa de 128 kbps, o que
// errava por mais de dez vezes em arquivos PCM (WAV) e em arquivos sem
// perda (FLAC): um trecho legítimo de 12 segundos era recusado como "longo
// demais" só porque o arquivo tinha mais bits por segundo do que o guessing.
//
// Aqui a duração é lida do próprio arquivo, quando o formato carrega essa
// informação: cabeçalho do WAV (taxa de bytes), bloco STREAMINFO do FLAC
// (amostras totais) e átomo mvhd do M4A (escala de tempo). Quando o formato
// não traz a duração, a leitura é marcada como aproximada e o serviço
// aplica uma janela tolerante — nunca uma recusa por estimativa errada.

import { FormatoAudio } from './types';

/** Resultado da leitura de duração. */
export interface DuracaoAmostra {
  /** Duração em segundos, arredondada. */
  segundos: number;
  /** Verdadeiro quando a duração veio do próprio arquivo (não é estimativa). */
  exata: boolean;
}

/** Taxa_bits por segundo usada só como último recurso (formato sem cabeçalho). */
const TAXA_ASSUMIDA_KBPS = 128;

/**
 * Lê a duração de um arquivo WAV (RIFF).
 *
 * Percorre os blocos do RIFF até achar "fmt " (taxa de bytes por segundo) e
 * "data" (quantidade de bytes de áudio). A divisão dá a duração exata.
 */
function duracaoWav(audio: Buffer): number | null {
  if (audio.length < 12) return null;
  if (audio.subarray(0, 4).toString('ascii') !== 'RIFF') return null;
  if (audio.subarray(8, 12).toString('ascii') !== 'WAVE') return null;

  let taxaDeBytes = 0;
  let tamanhoDados = 0;
  let posicao = 12;

  while (posicao + 8 <= audio.length) {
    const identificador = audio.subarray(posicao, posicao + 4).toString('ascii');
    const tamanho = audio.readUInt32LE(posicao + 4);

    if (identificador === 'fmt ' && posicao + 8 + 16 <= audio.length) {
      taxaDeBytes = audio.readUInt32LE(posicao + 8 + 8);
    }

    if (identificador === 'data') {
      tamanhoDados = Math.min(tamanho, audio.length - (posicao + 8));
      break;
    }

    // Blocos RIFF são alinhados em pares de bytes.
    posicao += 8 + tamanho + (tamanho % 2);
  }

  if (!taxaDeBytes || !tamanhoDados) return null;

  return tamanhoDados / taxaDeBytes;
}

/**
 * Lê a duração de um arquivo FLAC.
 *
 * O primeiro bloco de metadados é o STREAMINFO, que traz a taxa de
 * amostragem e o total de amostras do arquivo.
 */
function duracaoFlac(audio: Buffer): number | null {
  if (audio.length < 4 + 4 + 34) return null;
  if (audio.subarray(0, 4).toString('ascii') !== 'fLaC') return null;

  // O primeiro bloco de metadados é o STREAMINFO (tipo 0).
  const posicao = 4;
  const tipo = audio[posicao] & 0x7f;
  if (tipo !== 0) return null;

  const streamInfo = posicao + 4;
  if (streamInfo + 34 > audio.length) return null;

  const taxaAmostragem =
    (audio[streamInfo + 10] << 12) |
    (audio[streamInfo + 11] << 4) |
    (audio[streamInfo + 12] >> 4);

  const totalAmostras =
    (audio[streamInfo + 13] & 0x0f) * 4294967296 +
    audio[streamInfo + 14] * 16777216 +
    audio[streamInfo + 15] * 65536 +
    audio[streamInfo + 16] * 256 +
    audio[streamInfo + 17];

  if (!taxaAmostragem || !totalAmostras) return null;

  return totalAmostras / taxaAmostragem;
}

/**
 * Lê a duração de um arquivo M4A/M4B (ISO BMFF).
 *
 * Procura o átomo "moov" e, dentro dele, o "mvhd", que traz a escala de
 * tempo e a duração em unidades dessa escala.
 */
function duracaoM4a(audio: Buffer): number | null {
  // Percorre os átomos de primeiro nível procurando o "moov".
  let posicao = 0;
  let moovInicio = -1;
  let moovTamanho = 0;

  while (posicao + 8 <= audio.length) {
    const tamanho = audio.readUInt32BE(posicao);
    const tipo = audio.subarray(posicao + 4, posicao + 8).toString('ascii');

    if (tipo === 'moov') {
      moovInicio = posicao + 8;
      moovTamanho = tamanho - 8;
      break;
    }

    if (tamanho <= 1) break;
    posicao += tamanho;
  }

  if (moovInicio < 0 || moovTamanho <= 0) return null;

  // Procura o "mvhd" dentro do "moov".
  let interno = moovInicio;
  const limite = Math.min(moovInicio + moovTamanho, audio.length);

  while (interno + 8 <= limite) {
    const tamanho = audio.readUInt32BE(interno);
    const tipo = audio.subarray(interno + 4, interno + 8).toString('ascii');

    if (tipo === 'mvhd') {
      const versao = audio[interno + 8];
      const base = interno + 12;

      if (versao === 1) {
        if (base + 28 > audio.length) return null;
        const escala = audio.readUInt32BE(base + 16);
        const duracao = Number(audio.readBigUInt64BE(base + 20));
        if (!escala || !duracao) return null;
        return duracao / escala;
      }

      if (base + 16 > audio.length) return null;
      const escala = audio.readUInt32BE(base + 8);
      const duracao = audio.readUInt32BE(base + 12);
      if (!escala || !duracao) return null;
      return duracao / escala;
    }

    if (tamanho <= 1) break;
    interno += tamanho;
  }

  return null;
}

/** Taxas de bits (kbps) dos quadros MPEG Layer III. */
const TAXAS_MPEG1_CAMADA3 = [
  0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320,
];
const TAXAS_MPEG2_CAMADA3 = [
  0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160,
];

/**
 * Lê a taxa de bits do primeiro quadro de um arquivo MP3.
 *
 * A taxa vem do próprio cabeçalho do quadro, o que torna a duração
 * calculada muito mais fiel do que a estimativa por tamanho. Em arquivos
 * VBR o valor é aproximado — por isso a leitura é marcada como aproximada.
 */
function taxaDeBitsMp3(audio: Buffer): number | null {
  // O cabeçalho ID3v2 no começo do arquivo precisa ser pulado.
  let posicao = 0;
  if (audio.subarray(0, 3).toString('ascii') === 'ID3' && audio.length > 10) {
    const tamanho =
      ((audio[6] & 0x7f) << 21) |
      ((audio[7] & 0x7f) << 14) |
      ((audio[8] & 0x7f) << 7) |
      (audio[9] & 0x7f);
    posicao = 10 + tamanho;
  }

  // Procura o primeiro quadro (sincronização 11 bits).
  while (posicao + 4 <= audio.length) {
    if (audio[posicao] === 0xff && (audio[posicao + 1] & 0xe0) === 0xe0) {
      const versao = (audio[posicao + 1] >> 3) & 0x03;
      const camada = (audio[posicao + 1] >> 1) & 0x03;
      const indiceTaxa = (audio[posicao + 2] >> 4) & 0x0f;

      // Só Layer III (camada 01) é usada nesta leitura.
      if (camada !== 1 || indiceTaxa === 0 || indiceTaxa === 15) return null;

      const tabela = versao === 3 ? TAXAS_MPEG1_CAMADA3 : TAXAS_MPEG2_CAMADA3;
      const kbps = tabela[indiceTaxa];
      return kbps ? kbps : null;
    }

    posicao += 1;
  }

  return null;
}

/**
 * Calcula a duração da amostra.
 *
 * @param audio Conteúdo bruto do arquivo.
 * @param formato Formato detectado pelos bytes de assinatura.
 */
export function lerDuracaoAmostra(
  audio: Buffer,
  formato: FormatoAudio
): DuracaoAmostra {
  let segundos: number | null = null;
  let exata = false;

  if (formato === 'wav') {
    segundos = duracaoWav(audio);
    exata = segundos !== null;
  } else if (formato === 'flac') {
    segundos = duracaoFlac(audio);
    exata = segundos !== null;
  } else if (formato === 'm4a') {
    segundos = duracaoM4a(audio);
    exata = segundos !== null;
  } else if (formato === 'mp3') {
    const kbps = taxaDeBitsMp3(audio);
    if (kbps) {
      // O cabeçalho ID3 não é áudio: entra fora da conta.
      let inicio = 0;
      if (audio.subarray(0, 3).toString('ascii') === 'ID3' && audio.length > 10) {
        const tamanho =
          ((audio[6] & 0x7f) << 21) |
          ((audio[7] & 0x7f) << 14) |
          ((audio[8] & 0x7f) << 7) |
          (audio[9] & 0x7f);
        inicio = 10 + tamanho;
      }
      segundos = ((audio.length - inicio) * 8) / (kbps * 1000);
    }
  }

  if (segundos === null || !Number.isFinite(segundos) || segundos < 0) {
    // Último recurso: estimativa por tamanho com taxa fixa.
    segundos = (audio.length * 8) / (TAXA_ASSUMIDA_KBPS * 1000);
    exata = false;
  }

  return { segundos: Math.round(segundos), exata };
}
