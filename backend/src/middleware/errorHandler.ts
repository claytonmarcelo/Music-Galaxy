// Middleware central de tratamento de erros.
// Captura qualquer erro não tratado na aplicação e retorna resposta padronizada.
// Nunca deixa o servidor travar por um erro não capturado.

import { Request, Response, NextFunction } from 'express';

// Classe de erro personalizada para erros esperados da aplicação.
export class ErroAplicacao extends Error {
  public statusHttp: number;
  // Dados extras e públicos do erro (por exemplo o status do reconhecimento).
  // Nunca credenciais, endereço interno ou corpo bruto de um serviço externo.
  public detalhe?: Record<string, unknown>;

  constructor(
    mensagem: string,
    statusHttp: number = 500,
    detalhe?: Record<string, unknown>
  ) {
    super(mensagem);
    this.name = 'ErroAplicacao';
    this.statusHttp = statusHttp;
    this.detalhe = detalhe;
  }
}

/**
 * Erros do parser de corpo (body-parser) chegam com `type` e `status` próprios.
 *
 * Sem este tratamento, um corpo grande demais responderia 500 e um JSON
 * inválido também — e o texto em inglês do Express ("request entity too
 * large") vazaria para o aplicativo. Aqui a resposta sai no padrão da API,
 * com código e mensagem em português.
 */
function erroDoParserDeCorpo(
  erro: Error & { type?: string; status?: number; statusCode?: number },
  caminho: string
): { status: number; mensagem: string } | null {
  if (erro.type === 'entity.too.large') {
    return caminho.includes('/recognize')
      ? {
          status: 413,
          mensagem:
            'A amostra de áudio enviada é grande demais. Grave um trecho mais curto.',
        }
      : {
          status: 413,
          mensagem: 'O corpo da requisição é grande demais.',
        };
  }

  if (erro.type === 'entity.parse.failed') {
    return {
      status: 400,
      mensagem: 'O corpo da requisição não é um JSON válido.',
    };
  }

  return null;
}

// Middleware de erros — deve ser o último middleware registrado no Express.
export function middlewareErros(
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  // Determina o código HTTP adequado
  const erroDoParser = erroDoParserDeCorpo(
    err as Error & { type?: string; status?: number; statusCode?: number },
    req.path
  );
  const status = erroDoParser
    ? erroDoParser.status
    : err instanceof ErroAplicacao
      ? err.statusHttp
      : 500;

  // Log detalhado apenas em desenvolvimento
  if (process.env.NODE_ENV !== 'production') {
    console.error(`[ERRO] ${req.method} ${req.path} →`, err.message);
    if (err.stack) console.error(err.stack);
  } else {
    console.error(`[ERRO] ${req.method} ${req.path} → ${status}: ${err.message}`);
  }

  const resposta: {
    success: boolean;
    error: string;
    data?: Record<string, unknown>;
  } = {
    success: false,
    error: erroDoParser
      ? erroDoParser.mensagem
      : err.message || 'Erro interno do servidor',
  };

  // Detalhe público opcional (ex.: status do reconhecimento sonoro).
  if (err instanceof ErroAplicacao && err.detalhe) {
    resposta.data = err.detalhe;
  }

  res.status(status).json(resposta);
}

// Wrapper para controllers assíncronos — evita repetir try/catch em cada rota.
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<void>
) {
  return (req: Request, res: Response, next: NextFunction): void => {
    fn(req, res, next).catch(next);
  };
}
