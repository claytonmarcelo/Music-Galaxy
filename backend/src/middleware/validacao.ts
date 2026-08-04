// Middleware de validação de parâmetros de entrada da API.
// Evita que dados inválidos cheguem até os controllers ou o banco.

import { Request, Response, NextFunction } from 'express';
import { ErroAplicacao } from './errorHandler';

// Valida o parâmetro de busca `q` — obrigatório, mínimo 1 caractere, máximo 200.
export function validarParametroBusca(
  req: Request,
  _res: Response,
  next: NextFunction
): void {
  const { q } = req.query;

  if (!q || typeof q !== 'string' || q.trim().length === 0) {
    return next(new ErroAplicacao('Parâmetro de busca "q" é obrigatório.', 400));
  }

  if (q.trim().length > 200) {
    return next(new ErroAplicacao('Parâmetro "q" não pode exceder 200 caracteres.', 400));
  }

  next();
}

// Valida parâmetros numéricos de paginação (limit e offset).
export function validarPaginacao(
  req: Request,
  _res: Response,
  next: NextFunction
): void {
  const { limit, offset } = req.query;

  if (limit !== undefined) {
    const limitNum = parseInt(limit as string, 10);
    if (isNaN(limitNum) || limitNum < 1 || limitNum > 100) {
      return next(new ErroAplicacao('"limit" deve ser um número entre 1 e 100.', 400));
    }
  }

  if (offset !== undefined) {
    const offsetNum = parseInt(offset as string, 10);
    if (isNaN(offsetNum) || offsetNum < 0) {
      return next(new ErroAplicacao('"offset" deve ser um número não negativo.', 400));
    }
  }

  next();
}

// Valida parâmetro de ID numérico em rotas como /api/works/:id.
export function validarParamId(
  req: Request,
  _res: Response,
  next: NextFunction
): void {
  const id = parseInt(req.params['id'] as string, 10);

  if (isNaN(id) || id < 1) {
    return next(new ErroAplicacao('ID inválido — deve ser um número inteiro positivo.', 400));
  }

  next();
}
