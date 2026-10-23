// Controller do reconhecimento sonoro.
// Endpoint POST /api/recognize
//
// Recebe uma amostra de áudio capturada pelo microfone (em base64), envia ao
// serviço de reconhecimento configurado no servidor e devolve o resultado
// normalizado. O áudio não é gravado em disco nem no MariaDB.

import { Request, Response, NextFunction } from 'express';

import {
  reconhecerMusica,
} from '../services/recognition/recognitionService';
import { RecognitionError } from '../services/recognition/types';

// Corpo aceito pela rota.
interface CorpoReconhecimento {
  audio_base64?: unknown;
}

/**
 * POST /api/recognize — identifica a música captada pelo microfone.
 */
export async function reconhecerMusicaNoAudio(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const corpo = (req.body || {}) as CorpoReconhecimento;

    if (typeof corpo.audio_base64 !== 'string') {
      return next(
        new RecognitionError(
          'provider_error',
          'Envie a amostra de áudio no campo "audio_base64".',
          400
        )
      );
    }

    const resultado = await reconhecerMusica(corpo.audio_base64);

    // "sem correspondência" é uma resposta válida do serviço, não um erro.
    res.json({
      success: true,
      data: resultado,
    });
  } catch (err) {
    if (err instanceof RecognitionError) {
      return next(err);
    }

    // Erro de validação da amostra (tamanho, base64 ou formato) — a mensagem
    // já é técnica e útil para o usuário final.
    if (err instanceof Error) {
      return next(new RecognitionError('provider_error', err.message, 400));
    }

    next(err);
  }
}
