// Serviço de reconhecimento sonoro — comunicação com POST /api/recognize.
//
// O aplicativo envia a amostra capturada pelo microfone em base64 e recebe o
// resultado normalizado do backend. Nenhuma credencial do serviço de
// reconhecimento existe no aplicativo: a chave fica só no servidor.
//
// A captura de áudio acontece fora deste arquivo (hooks/useReconhecimentoSonoro).
// Aqui há apenas o transporte e a tradução de erros em mensagens que o
// usuário entende.

import { BASE_URL } from './api';
import { RecognitionResult, RecognitionStatus, RespostaReconhecimento } from '../types';

// O servidor pode demorar até 20s com o serviço externo, então a espera no
// aplicativo é maior que a das buscas normais.
const TIMEOUT_MS = 45000;

/** Erro de reconhecimento com o status normalizado e uma mensagem utilizável. */
export class ErroReconhecimento extends Error {
  public readonly status: RecognitionStatus;

  constructor(status: RecognitionStatus, mensagem: string) {
    super(mensagem);
    this.name = 'ErroReconhecimento';
    this.status = status;
  }
}

// Status válidos do contrato — usada para validar o que veio do servidor.
const STATUS_VALIDOS: RecognitionStatus[] = [
  'matched',
  'no_match',
  'permission_denied',
  'microphone_unavailable',
  'network_error',
  'provider_error',
  'cancelled',
];

/** Confere se o status recebido pertence ao contrato conhecido. */
function statusValido(valor: unknown): valor is RecognitionStatus {
  return typeof valor === 'string' && STATUS_VALIDOS.includes(valor as RecognitionStatus);
}

/**
 * Deduz o status a partir do código HTTP quando o corpo não traz um status
 * válido. Mantém a resposta do aplicativo coerente com o contrato.
 */
function statusPeloCodigoHttp(codigo: number): RecognitionStatus {
  if (codigo === 408 || codigo === 504) return 'network_error';
  if (codigo === 503) return 'provider_error';
  return 'provider_error';
}

/** Lê a mensagem de erro do corpo da resposta, com um texto padrão. */
function mensagemDoCorpo(corpo: unknown, padrao: string): string {
  if (corpo && typeof corpo === 'object') {
    const registro = corpo as { error?: unknown; message?: unknown };
    if (typeof registro.error === 'string' && registro.error.trim()) return registro.error;
    if (typeof registro.message === 'string' && registro.message.trim()) return registro.message;
  }
  return padrao;
}

/**
 * Envia a amostra de áudio ao backend e devolve o resultado.
 *
 * @param audioBase64 Áudio capturado em base64.
 * @param sinal Cancelamento (usado quando o usuário desiste da identificação).
 * @throws ErroReconhecimento quando o serviço não conseguiu identificar.
 */
export async function reconhecerMusica(
  audioBase64: string,
  sinal?: AbortSignal
): Promise<RecognitionResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  const sinaisCombinados = sinal
    ? combinarSinais(sinal, controller.signal)
    : controller.signal;

  try {
    const resposta = await fetch(`${BASE_URL}/api/recognize`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({ audio_base64: audioBase64 }),
      signal: sinaisCombinados,
    });

    const texto = await resposta.text();
    let corpo: RespostaReconhecimento | undefined;

    try {
      corpo = texto ? (JSON.parse(texto) as RespostaReconhecimento) : undefined;
    } catch {
      corpo = undefined;
    }

    if (!resposta.ok) {
      const statusBruto = corpo?.data?.status;
      const status = statusValido(statusBruto) ? statusBruto : statusPeloCodigoHttp(resposta.status);

      const mensagem = mensagemDoCorpo(
        corpo,
        resposta.status === 429
          ? 'Muitas tentativas de reconhecimento. Aguarde alguns minutos antes de tentar de novo.'
          : 'Não foi possível identificar a música agora.',
      );

      throw new ErroReconhecimento(status, mensagem);
    }

    if (!corpo || !corpo.success || !corpo.data) {
      throw new ErroReconhecimento(
        'provider_error',
        'O servidor respondeu de forma inesperada ao reconhecimento.'
      );
    }

    return corpo.data;
  } catch (erro) {
    if (erro instanceof ErroReconhecimento) throw erro;

    // Cancelamento pedido pelo usuário — não é falha.
    if (erro instanceof Error && (erro.name === 'AbortError' || sinal?.aborted)) {
      throw new ErroReconhecimento('cancelled', 'Identificação cancelada.');
    }

    if (erro instanceof Error && erro.name === 'AbortError') {
      throw new ErroReconhecimento(
        'network_error',
        'O servidor demorou demais para responder. Tente novamente.'
      );
    }

    throw new ErroReconhecimento(
      'network_error',
      'Não foi possível conectar ao servidor. Verifique a internet e o endereço em Ajustes.'
    );
  } finally {
    clearTimeout(timer);
  }
}

/** Combina dois sinais de cancelamento em um só. */
function combinarSinais(primeiro: AbortSignal, segundo: AbortSignal): AbortSignal {
  const controller = new AbortController();

  const abortar = () => controller.abort();
  if (primeiro.aborted || segundo.aborted) {
    controller.abort();
    return controller.signal;
  }

  primeiro.addEventListener('abort', abortar, { once: true });
  segundo.addEventListener('abort', abortar, { once: true });

  return controller.signal;
}
