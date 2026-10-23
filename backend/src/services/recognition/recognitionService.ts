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
import { estimarDuracaoSegundos, validarAmostra } from './audioPayload';
import {
  RecognitionError,
  RecognitionProvider,
  RecognitionResult,
} from './types';

// Janela útil de duração para o serviço externo (segundos).
export const DURACAO_MINIMA_SEGUNDOS = 2;
export const DURACAO_MAXIMA_SEGUNDOS = 30;

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

  // 2. Provedor configurado.
  const provedor = criarProvedor();

  if (!provedor.disponivel) {
    throw new RecognitionError(
      'provider_error',
      'O reconhecimento sonoro não está configurado neste servidor.',
      503
    );
  }

  // 3. Diagnóstico de duração: trecho fora da janela útil não é analisado,
  //    e o motivo é informado em vez de devolver "sem correspondência".
  const duracao = estimarDuracaoSegundos(audio);
  if (duracao < DURACAO_MINIMA_SEGUNDOS) {
    throw new RecognitionError(
      'provider_error',
      'A amostra de áudio é curta demais para ser analisada. Grave um trecho com pelo menos 2 segundos.',
      400
    );
  }
  if (duracao > DURACAO_MAXIMA_SEGUNDOS) {
    throw new RecognitionError(
      'provider_error',
      'A amostra de áudio é longa demais. Grave um trecho de até 30 segundos.',
      400
    );
  }

  // 4. Chamada ao provedor — o áudio vive apenas na memória do processo.
  return provedor.reconhecer(audio, formato);
}
