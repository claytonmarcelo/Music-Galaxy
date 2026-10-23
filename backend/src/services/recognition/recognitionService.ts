// Serviço de reconhecimento sonoro do Music Galaxy.
//
// Ponto único de entrada da funcionalidade: valida a amostra, escolhe o
// adaptador do provedor configurado e devolve o contrato normalizado.
//
// Decisões de projeto:
//   - O áudio nunca é gravado em disco nem no MariaDB.
//   - A credencial do provedor fica somente no backend (variável de ambiente).
//   - O provedor é escolhido por configuração, o que permite trocar a
//     tecnologia (por exemplo um módulo nativo) sem alterar o controlador
//     nem o aplicativo.

import { AudDProvider } from './auddProvider';
import { validarAmostra } from './audioPayload';
import { lerDuracaoAmostra } from './duracaoAmostra';
import {
  RecognitionError,
  RecognitionProvider,
  RecognitionResult,
} from './types';

// Janela útil de duração para o serviço externo (segundos).
export const DURACAO_MINIMA_SEGUNDOS = 2;
export const DURACAO_MAXIMA_SEGUNDOS = 30;

// Janela tolerante para as amostras cuja duração não pode ser lida do
// próprio arquivo (formato sem cabeçalho de duração). Sem essa tolerância,
// uma estimativa por tamanho recusaria trechos legítimos: um MP3 de 320 kbps
// tem o dobro de bits por segundo da taxa assumida e cairia fora da janela.
export const DURACAO_MINIMA_APROXIMADA_SEGUNDOS = 2;
export const DURACAO_MAXIMA_APROXIMADA_SEGUNDOS = 45;

/**
 * Lê a credencial do provedor do ambiente.
 *
 * O valor nunca é devolvido ao aplicativo nem registrado em log.
 */
function lerTokenAudd(): string {
  return (process.env['AUDD_TOKEN'] || '').trim();
}

/**
 * Cria o adaptador correspondente à configuração do servidor.
 *
 * `RECOGNITION_PROVIDER` decide o provedor; hoje existe apenas o adaptador
 * por API externa. Um provedor nativo entraria aqui sem alterar o resto do
 * fluxo.
 */
export function criarProvedor(): RecognitionProvider {
  const escolhido = (process.env['RECOGNITION_PROVIDER'] || 'audd').trim().toLowerCase();

  switch (escolhido) {
    case 'audd':
      return new AudDProvider(lerTokenAudd());
    default:
      throw new RecognitionError(
        'provider_error',
        'O provedor de reconhecimento configurado no servidor não existe.',
        500
      );
  }
}

/**
 * Indica se há um provedor pronto para uso agora.
 * Usado para responder com clareza quando a credencial não foi configurada.
 */
export function provedorDisponivel(): boolean {
  try {
    return criarProvedor().disponivel;
  } catch {
    return false;
  }
}

/**
 * Reconhece a amostra enviada pelo aplicativo.
 *
 * @param audioBase64 Áudio capturado em base64.
 * @returns Resultado normalizado no contrato compartilhado.
 * @throws RecognitionError com mensagem em português quando a amostra é
 *         inválida ou o serviço não consegue responder.
 */
export async function reconhecerMusica(audioBase64: string): Promise<RecognitionResult> {
  // 1. Validação real da amostra (tamanho e formato pelos bytes de arquivo).
  const { audio, formato } = validarAmostra(audioBase64);

  // 2. Diagnóstico de duração: trecho fora da janela útil não é analisado,
  //    e o motivo é informado em vez de devolver "sem correspondência".
  //    A duração é lida do próprio arquivo quando o formato permite; quando
  //    só há estimativa, a janela é tolerante para não recusar amostras
  //    legítimas por causa de uma taxa de bits presumida.
  //
  //    A validação do pedido vem antes da checagem de configuração: um
  //    trecho inválido é erro do cliente (400) e deve ser dito com precisão
  //    mesmo num servidor sem credencial — do mesmo jeito que a amostra
  //    corrompida já é recusada antes desse ponto.
  const duracao = lerDuracaoAmostra(audio, formato);
  const minima = duracao.exata
    ? DURACAO_MINIMA_SEGUNDOS
    : DURACAO_MINIMA_APROXIMADA_SEGUNDOS;
  const maxima = duracao.exata
    ? DURACAO_MAXIMA_SEGUNDOS
    : DURACAO_MAXIMA_APROXIMADA_SEGUNDOS;

  if (duracao.segundos < minima) {
    throw new RecognitionError(
      'provider_error',
      'A amostra de áudio é curta demais para ser analisada. Grave um trecho com pelo menos 2 segundos.',
      400
    );
  }
  if (duracao.segundos > maxima) {
    throw new RecognitionError(
      'provider_error',
      'A amostra de áudio é longa demais. Grave um trecho de até 30 segundos.',
      400
    );
  }

  // 3. Provedor configurado. Sem credencial, a resposta é 503 — o aplicativo
  //    explica isso ao usuário e a busca por texto continua funcionando.
  const provedor = criarProvedor();

  if (!provedor.disponivel) {
    throw new RecognitionError(
      'provider_error',
      'O reconhecimento sonoro não está configurado neste servidor.',
      503
    );
  }

  // 4. Chamada ao provedor — o áudio vive apenas na memória do processo.
  return provedor.reconhecer(audio, formato);
}
