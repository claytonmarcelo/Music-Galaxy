// Adaptador do serviço externo de reconhecimento (AudD).
//
// O contrato foi verificado contra a API real em 2026-10-23:
//   - endpoint: POST https://api.audd.io/
//   - credencial no campo de formulário `api_token` (o campo `token` é ignorado)
//   - o áudio vai no campo `file` (binário) ou no corpo binário puro
//   - a resposta traz `status` ("success"/"error") e, no sucesso, `result`
//   - códigos de erro: 900 credencial inválida, 600 campo `file` inválido,
//     300 sem correspondência, 400 arquivo grande demais, 500 áudio inválido,
//     700 nenhum arquivo enviado
//
// A credencial vive apenas no backend (variável de ambiente AUDD_TOKEN).
// Ela nunca é devolvida ao aplicativo nem registrada em log.

import axios from 'axios';
import { FORMATOS_ACEITOS } from './audioPayload';
import { FormatoAudio, RecognitionError, RecognitionResult } from './types';

// Endpoint público do serviço de reconhecimento.
const URL_RECONHECIMENTO = 'https://api.audd.io/';

// Tempo máximo de espera pelo serviço externo.
const TIMEOUT_MS = 20000;

// Limite de tamanho da resposta (o serviço devolve JSON pequeno).
const TAMANHO_MAX_RESPOSTA = 512 * 1024;

// Tipo MIME enviado para cada formato suportado.
// A lista de formatos aceitos é a mesma do validador (`audioPayload.ts`):
// uma única fonte, para que a validação da amostra e o envio ao serviço
// externo nunca divirjam.
const MIME_POR_FORMATO: Record<FormatoAudio, string> = {
  mp3: 'audio/mpeg',
  m4a: 'audio/mp4',
  wav: 'audio/wav',
  flac: 'audio/flac',
  ogg: 'audio/ogg',
  webm: 'audio/webm',
  aac: 'audio/aac',
};

// Resposta do serviço externo (apenas os campos que o Music Galaxy usa).
interface RespostaAudD {
  status?: string;
  result?: {
    title?: string;
    artist?: string;
    album?: string;
    releaseDate?: string;
    duration?: number;
    score?: number;
  };
  error?: {
    error_code?: number;
    error_message?: string;
  };
}

/** Erros do serviço externo que significam "não há correspondência". */
const CODIGO_SEM_CORRESPONDENCIA = 300;

/** Erros do serviço externo que significam "credencial inválida". */
const CODIGO_CREDENCIAL_INVALIDA = 900;

/**
 * Extrai o ano de lançamento de uma data no formato "AAAA-MM-DD"
 * ou de um texto que comece com quatro dígitos.
 */
function extrairAno(valor: string | undefined): number | undefined {
  if (!valor) return undefined;

  const match = valor.match(/(\d{4})/);
  if (!match) return undefined;

  const ano = Number(match[1]);
  if (!Number.isFinite(ano) || ano < 1800 || ano > 2200) return undefined;

  return ano;
}

/**
 * Converte a pontuação do serviço (0 a 1) em percentual inteiro.
 *
 * A pontuação só existe quando o provedor a envia de verdade — o Music
 * Galaxy nunca estima confiança.
 */
function converterConfianca(score: number | undefined): number | undefined {
  if (typeof score !== 'number' || !Number.isFinite(score)) return undefined;
  if (score <= 0 || score > 1) return undefined;

  return Math.round(score * 100);
}

/**
 * Converte a resposta do serviço no contrato normalizado do Music Galaxy.
 *
 * Sem título não há identificação: o resultado vira "sem correspondência"
 * em vez de devolver metadados inventados.
 */
export function normalizarRespostaAudD(
  resposta: RespostaAudD
): RecognitionResult {
  const resultado = resposta.result;
  const titulo = resultado?.title?.trim();

  if (!titulo) {
    return { status: 'no_match', provider: 'audd' };
  }

  const normalizado: RecognitionResult = {
    status: 'matched',
    title: titulo,
    provider: 'audd',
  };

  const artista = resultado?.artist?.trim();
  if (artista) normalizado.artist = artista;

  const album = resultado?.album?.trim();
  if (album) normalizado.album = album;

  const ano = extrairAno(resultado?.releaseDate);
  if (ano !== undefined) normalizado.releaseYear = ano;

  const confianca = converterConfianca(resultado?.score);
  if (confianca !== undefined) normalizado.confidence = confianca;

  return normalizado;
}

/** Adaptador concreto do serviço externo AudD. */
export class AudDProvider {
  public readonly nome = 'audd';

  private readonly token: string;

  constructor(token: string) {
    this.token = token;
  }

  /** O provedor só está disponível quando há credencial configurada. */
  public get disponivel(): boolean {
    return this.token.trim().length > 0;
  }

  /**
   * Envia a amostra ao serviço externo e devolve o resultado normalizado.
   *
   * A credencial vai no corpo do formulário (nunca na URL) e a resposta bruta
   * do serviço é transformada antes de chegar ao aplicativo.
   */
  public async reconhecer(
    audio: Buffer,
    formato: FormatoAudio
  ): Promise<RecognitionResult> {
    if (!this.disponivel) {
      throw new RecognitionError(
        'provider_error',
        'O reconhecimento sonoro não está configurado neste servidor.',
        503
      );
    }

    if (!FORMATOS_ACEITOS.includes(formato)) {
      throw new RecognitionError(
        'provider_error',
        `O formato capturado (${formato}) não é aceito pelo serviço de reconhecimento.`,
        400
      );
    }

    const dados = new FormData();
    dados.append('api_token', this.token);
    dados.append(
      'file',
      new Blob([new Uint8Array(audio)], { type: MIME_POR_FORMATO[formato] }),
      `amostra.${formato}`
    );

    let resposta: RespostaAudD;

    try {
      const retorno = await axios.post<RespostaAudD>(URL_RECONHECIMENTO, dados, {
        timeout: TIMEOUT_MS,
        maxContentLength: TAMANHO_MAX_RESPOSTA,
        maxBodyLength: audio.length + 1024,
        headers: { Accept: 'application/json' },
      });
      resposta = retorno.data;
    } catch (erro) {
      throw this.tratarFalhaDeRede(erro);
    }

    return this.tratarResposta(resposta);
  }

  /** Converte a resposta do serviço em resultado ou erro de negócio. */
  private tratarResposta(resposta: RespostaAudD): RecognitionResult {
    if (resposta.status === 'success') {
      return normalizarRespostaAudD(resposta);
    }

    const codigo = resposta.error?.error_code;

    if (codigo === CODIGO_SEM_CORRESPONDENCIA) {
      return { status: 'no_match', provider: this.nome };
    }

    if (codigo === CODIGO_CREDENCIAL_INVALIDA) {
      // A mensagem original do serviço pode citar a credencial: ela não é
      // repassada ao aplicativo nem registrada.
      throw new RecognitionError(
        'provider_error',
        'O serviço de reconhecimento está indisponível. A credencial configurada no servidor não é válida.',
        503
      );
    }

    if (codigo === 400) {
      throw new RecognitionError(
        'provider_error',
        'A amostra de áudio é grande demais para o serviço de reconhecimento.',
        413
      );
    }

    if (codigo === 500) {
      throw new RecognitionError(
        'provider_error',
        'O serviço de reconhecimento não conseguiu analisar o áudio enviado.',
        502
      );
    }

    throw new RecognitionError(
      'provider_error',
      'O serviço de reconhecimento não respondeu como esperado.',
      502
    );
  }

  /** Converte falha de rede ou tempo esgotado em erro de negócio. */
  private tratarFalhaDeRede(erro: unknown): RecognitionError {
    const ehTimeout =
      axios.isAxiosError(erro) && (erro.code === 'ECONNABORTED' || erro.code === 'ETIMEDOUT');

    if (ehTimeout) {
      return new RecognitionError(
        'network_error',
        'O serviço de reconhecimento demorou demais para responder. Tente novamente.',
        504
      );
    }

    if (axios.isAxiosError(erro) && erro.response) {
      // Resposta HTTP de erro do serviço: vira indisponibilidade, sem vazar
      // o corpo bruto da resposta.
      return new RecognitionError(
        'provider_error',
        'O serviço de reconhecimento recusou a requisição.',
        502
      );
    }

    return new RecognitionError(
      'network_error',
      'Não foi possível conectar ao serviço de reconhecimento. Verifique a internet.',
      503
    );
  }
}
