// Validação da amostra de áudio recebida pelo endpoint de reconhecimento.
//
// O aplicativo envia o trecho capturado pelo microfone em base64. Antes de
// qualquer chamada externa, o backend confere o tamanho, o formato real do
// arquivo (pelos bytes de assinatura) e a duração aproximada. Isso evita
// enviar lixo para o serviço de reconhecimento e dá um diagnóstico técnico
// claro quando a conversão do áudio falha.
//
// O áudio NUNCA é gravado em disco nem no MariaDB: ele existe apenas na
// memória do processo durante a requisição.

import { FormatoAudio } from './types';

// Limites da amostra. O provedor externo analisa trechos de poucos segundos;
// 2 MB cobrem com folga uma captura de 12 segundos em qualidade alta.
export const TAMANHO_MAX_AUDIO_BYTES = 2 * 1024 * 1024;
export const TAMANHO_MIN_AUDIO_BYTES = 1024;

// Limite do texto base64 antes da decodificação (base64 cresce ~33%).
export const TAMANHO_MAX_BASE64 = Math.ceil(TAMANHO_MAX_AUDIO_BYTES * 1.4);

// Formatos aceitos pelo serviço de reconhecimento.
// A lista é a fonte única: o validador e o adaptador do provedor usam
// estas mesmas entradas.
export const FORMATOS_ACEITOS: FormatoAudio[] = [
  'mp3',
  'm4a',
  'wav',
  'flac',
  'ogg',
  'webm',
  'aac',
];

/**
 * Remove o prefixo de data URI e valida o alfabeto base64.
 * Devolve `null` quando o texto não é base64 válido.
 */
function limparBase64(valor: string): string | null {
  // O aplicativo pode enviar "data:audio/mp3;base64,XXXX".
  const semPrefixo = valor.startsWith('data:')
    ? valor.slice(valor.indexOf(',') + 1)
    : valor;

  const limpo = semPrefixo.replace(/\s+/g, '');

  if (limpo.length === 0) return null;
  if (limpo.length % 4 !== 0) return null;
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(limpo)) return null;

  return limpo;
}

/**
 * Identifica o formato real do arquivo pelos bytes de assinatura.
 * Devolve `null` quando o conteúdo não parece ser áudio suportado.
 */
export function detectarFormato(audio: Buffer): FormatoAudio | null {
  if (audio.length < 4) return null;

  // MP4/M4A: o box "ftyp" começa no byte 4.
  if (audio.subarray(4, 8).toString('ascii') === 'ftyp') return 'm4a';

  // Matroska/WebM: assinatura EBML 0x1A45DFA3.
  if (
    audio[0] === 0x1a &&
    audio[1] === 0x45 &&
    audio[2] === 0xdf &&
    audio[3] === 0xa3
  ) {
    return 'webm';
  }

  // FLAC: cabeçalho "fLaC".
  if (audio.subarray(0, 4).toString('ascii') === 'fLaC') return 'flac';

  // OGG: cabeçalho "OggS".
  if (audio.subarray(0, 4).toString('ascii') === 'OggS') return 'ogg';

  // WAV: "RIFF" no início e "WAVE" no byte 8.
  if (
    audio.subarray(0, 4).toString('ascii') === 'RIFF' &&
    audio.subarray(8, 12).toString('ascii') === 'WAVE'
  ) {
    return 'wav';
  }

  // AAC (ADTS): syncword de 12 bits com camada 00.
  if (audio[0] === 0xff && (audio[1] & 0xf6) === 0xf0) return 'aac';

  // MP3: "ID3" ou frame sync MPEG com camada diferente de 00.
  if (audio.subarray(0, 3).toString('ascii') === 'ID3') return 'mp3';
  if (audio[0] === 0xff && (audio[1] & 0xe0) === 0xe0 && (audio[1] & 0x06) !== 0x00) {
    return 'mp3';
  }

  return null;
}

/** Resultado da validação da amostra recebida. */
export interface AmostraValida {
  audio: Buffer;
  formato: FormatoAudio;
}

/**
 * Converte o base64 recebido em áudio e confirma o formato.
 *
 * Lança `Error` com mensagem em português quando a amostra é inválida —
 * o controlador transforma em resposta 400 com o motivo real.
 */
export function validarAmostra(audioBase64: string): AmostraValida {
  if (typeof audioBase64 !== 'string' || audioBase64.trim().length === 0) {
    throw new Error('É necessário enviar a amostra de áudio capturada.');
  }

  if (audioBase64.length > TAMANHO_MAX_BASE64) {
    throw new Error('A amostra de áudio é grande demais. Grave um trecho mais curto.');
  }

  const limpo = limparBase64(audioBase64);
  if (!limpo) {
    throw new Error('A amostra de áudio enviada está corrompida ou em formato inválido.');
  }

  const audio = Buffer.from(limpo, 'base64');

  if (audio.length < TAMANHO_MIN_AUDIO_BYTES) {
    throw new Error('A amostra de áudio é curta demais para ser analisada.');
  }

  if (audio.length > TAMANHO_MAX_AUDIO_BYTES) {
    throw new Error('A amostra de áudio é grande demais. Grave um trecho mais curto.');
  }

  const formato = detectarFormato(audio);
  if (!formato) {
    throw new Error(
      'O formato do áudio capturado não é compatível. Grave novamente em MP3, M4A, WAV ou AAC.'
    );
  }

  return { audio, formato };
}
