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

// Middleware de erros — deve ser o último middleware registrado no Express.
export function middlewareErros(
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  // Determina o código HTTP adequado
  const status = err instanceof ErroAplicacao ? err.statusHttp : 500;

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
    error: err.message || 'Erro interno do servidor',
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
