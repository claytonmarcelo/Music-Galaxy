// Contrato do reconhecimento sonoro do Music Galaxy.
//
// Este arquivo define o contrato lógico compartilhado entre o backend e o
// aplicativo. Nenhuma credencial, endereço interno ou detalhe do provedor
// entra neste contrato: o aplicativo recebe apenas o desfecho da
// identificação e os metadados que o provedor realmente entregou.
//
// O campo `confidence` só existe quando o provedor fornece uma medida
// documentada — nunca é um número estimado pelo Music Galaxy.

import { ErroAplicacao } from '../../middleware/errorHandler';

/**
 * Desfecho possível de uma tentativa de reconhecimento.
 *
 * - `matched`: o provedor identificou a faixa.
 * - `no_match`: o áudio foi analisado, mas nenhuma faixa correspondeu.
 * - `permission_denied`: o usuário não autorizou o microfone.
 * - `microphone_unavailable`: não há microfone utilizável no aparelho.
 * - `network_error`: falha de rede ou tempo esgotado na comunicação.
 * - `provider_error`: o serviço de reconhecimento respondeu com erro.
 * - `invalid_request`: a amostra enviada não passou na validação do servidor.
 * - `cancelled`: o usuário interrompeu a tentativa.
 *
 * `invalid_request` é diferente de `provider_error`: um pedido fora do
 * contrato (campo ausente, base64 corrompido, formato não aceito) não diz
 * nada sobre a saúde do provedor. Antes, os dois casos chegavam ao
 * aplicativo como `provider_error` e o painel anunciava "serviço
 * indisponível" por causa de uma amostra inválida.
 */
export type RecognitionStatus =
  | 'matched'
  | 'no_match'
  | 'permission_denied'
  | 'microphone_unavailable'
  | 'network_error'
  | 'provider_error'
  | 'invalid_request'
  | 'cancelled';

/** Formatos de áudio aceitos na análise. */
export type FormatoAudio = 'mp3' | 'm4a' | 'wav' | 'flac' | 'ogg' | 'webm' | 'aac';

/** Resultado normalizado de um reconhecimento. */
export interface RecognitionResult {
  status: RecognitionStatus;
  title?: string;
  artist?: string;
  album?: string;
  releaseYear?: number;
  provider?: string;
  confidence?: number;
}

/**
 * Adaptador de um serviço de reconhecimento.
 *
 * Cada implementação concreta (API externa ou SDK nativo) recebe o áudio já
 * decodificado e devolve o contrato normalizado. O serviço escolhe o
 * adaptador e trata os erros, sem que o controlador precise conhecer o
 * provedor escolhido.
 */
export interface RecognitionProvider {
  /** Identificador do provedor, usado na resposta pública. */
  readonly nome: string;
  /** Indica se o provedor está configurado e pode ser usado agora. */
  readonly disponivel: boolean;
  /** Analisa a amostra e devolve o resultado normalizado. */
  reconhecer(audio: Buffer, formato: FormatoAudio): Promise<RecognitionResult>;
}

/**
 * Erro de negócio do reconhecimento.
 *
 * Carrega o status normalizado e a mensagem em português para o aplicativo,
 * sem vazar credenciais nem resposta bruta do provedor.
 */
export class RecognitionError extends ErroAplicacao {
  public readonly status: RecognitionStatus;

  constructor(
    status: RecognitionStatus,
    mensagem: string,
    statusHttp: number = 503
  ) {
    super(mensagem, statusHttp, { status });
    this.name = 'RecognitionError';
    this.status = status;
  }
}
