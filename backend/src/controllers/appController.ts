// Controlador da versão publicada do aplicativo.
//
// A rota é usada pelo aplicativo para saber se existe uma versão nova
// disponível para download. Não exige autenticação e não devolve nada
// além de número de versão, endereço de download e notas do dono.

import { Request, Response } from 'express';
import { versaoPublicada } from '../services/appVersion';

/** GET /api/app/versao — devolve a versão que o servidor está publicando. */
export function publicarVersao(_req: Request, res: Response): void {
  res.json({
    success: true,
    data: versaoPublicada(),
  });
}
