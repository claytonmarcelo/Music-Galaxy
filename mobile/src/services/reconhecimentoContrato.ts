// Contrato puro do reconhecimento sonoro no aplicativo.
//
// Este arquivo concentra as regras que não dependem do React Native:
// validação do status recebido do servidor, tradução de códigos HTTP em
// mensagens e a montagem do texto de busca a partir do que o serviço
// realmente identificou.
//
// Por ser puro, ele pode ser testado fora do aparelho (ver `mobile/tests`),
// sem emulador e sem navegador.

import { RecognitionResult, RecognitionStatus } from '../types';

/**
 * Status válidos do contrato compartilhado com o backend.
 *
 * Serve para rejeitar qualquer coisa inesperada que venha na resposta do
 * servidor, em vez de salvar um estado quebrado na interface.
 */
export const STATUS_VALIDOS: RecognitionStatus[] = [
  'matched',
  'no_match',
  'permission_denied',
  'microphone_unavailable',
  'network_error',
  'provider_error',
  'invalid_request',
  'cancelled',
];

/** Confere se o status recebido pertence ao contrato conhecido. */
export function statusValido(valor: unknown): valor is RecognitionStatus {
  return typeof valor === 'string' && STATUS_VALIDOS.includes(valor as RecognitionStatus);
}

/**
 * Deduz o status a partir do código HTTP quando o corpo não traz um status
 * válido. Mantém a resposta do aplicativo coerente com o contrato.
 */
export function statusPeloCodigoHttp(codigo: number): RecognitionStatus {
  if (codigo === 408 || codigo === 504) return 'network_error';
  // 400 é recusa do pedido (amostra ausente, corrompida ou em formato não
  // aceito) — não é o serviço fora do ar. Sem esta distinção, o painel
  // anunciava "serviço indisponível" por causa de uma amostra inválida.
  if (codigo === 400) return 'invalid_request';
  return 'provider_error';
}

/** Lê a mensagem de erro do corpo da resposta, com um texto padrão. */
export function mensagemDoCorpo(corpo: unknown, padrao: string): string {
  if (corpo && typeof corpo === 'object') {
    const registro = corpo as { error?: unknown; message?: unknown };
    if (typeof registro.error === 'string' && registro.error.trim()) return registro.error;
    if (typeof registro.message === 'string' && registro.message.trim()) return registro.message;
  }
  return padrao;
}

/**
 * Diz o que aconteceu quando a requisição foi interrompida no meio.
 *
 * O navegador e o React Native entregam **o mesmo erro** (`AbortError`)
 * quando o usuário cancela e quando o tempo de espera se esgota. Só o sinal
 * do usuário separa os dois casos. Tratar tudo como "cancelado" esconderia
 * um servidor mudo atrás de uma frase que sugere uma ação do usuário.
 */
export function descreverInterrupcao(sinalDoUsuarioAbortado: boolean): {
  status: RecognitionStatus;
  mensagem: string;
} {
  if (sinalDoUsuarioAbortado) {
    return { status: 'cancelled', mensagem: 'Identificação cancelada.' };
  }

  return {
    status: 'network_error',
    mensagem: 'O servidor demorou demais para responder. Tente novamente.',
  };
}

/**
 * Monta o texto de busca a partir do que o serviço realmente identificou.
 *
 * Regras de honestidade: só entram título e artista devolvidos pelo
 * serviço. Sem título (por exemplo, quando a resposta veio sem
 * correspondência), o texto fica vazio — o aplicativo nunca preenche o
 * campo com uma sugestão inventada.
 */
export function montarTermoBusca(resultado: RecognitionResult | null): string {
  if (!resultado) return '';

  const partes = [resultado.title, resultado.artist].filter(
    (parte): parte is string => typeof parte === 'string' && parte.trim().length > 0
  );

  return partes.join(' ').trim();
}
