// Limite de requisições da rota de reconhecimento sonoro.
//
// Fica em um middleware próprio (e não dentro do roteador) porque ele precisa
// ser montado ANTES do parser de corpo de 3 MB: quando o limite é aplicado
// depois, o servidor ainda recebe e decodifica o corpo inteiro da amostra
// antes de recusar — trabalho desperdiçado e vetor de pressão de memória.
//
// Cada tentativa consome uma requisição do serviço externo de reconhecimento,
// por isso o limite é bem mais restrito que o limite geral da API.

import rateLimit, { RateLimitRequestHandler } from 'express-rate-limit';

// Janela padrão do limite de reconhecimento (15 minutos).
const JANELA_PADRAO_MS = 900000;

// Máximo padrão de tentativas por janela (20).
const MAXIMO_PADRAO = 20;

/**
 * Lê um número positivo do ambiente; usa o padrão quando o valor é inválido.
 *
 * A validação de arranque fica em `index.ts` (validarAmbiente): aqui o
 * fallback apenas evita que uma configuração quebrada derrube o servidor.
 */
function lerNumero(chave: string, padrao: number): number {
  const bruto = process.env[chave];

  if (bruto === undefined || bruto.trim() === '') return padrao;

  const valor = Number(bruto);
  if (!Number.isFinite(valor) || valor <= 0) return padrao;

  return valor;
}

/**
 * Cria o limitador da rota de reconhecimento.
 *
 * Uma instância por aplicação: o contador de tentativas pertence ao servidor
 * criado, não a um estado global compartilhado entre instâncias.
 *
 * A resposta de recusa sai no mesmo padrão da API, com o status normalizado
 * `provider_error` para que o aplicativo aplique o mesmo tratamento de
 * "serviço indisponível" que usa nas demais falhas.
 */
export function criarLimiteReconhecimento(): RateLimitRequestHandler {
  return rateLimit({
    windowMs: lerNumero('RECOGNITION_RATE_LIMIT_WINDOW_MS', JANELA_PADRAO_MS),
    max: lerNumero('RECOGNITION_RATE_LIMIT_MAX_REQUESTS', MAXIMO_PADRAO),
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      success: false,
      error:
        'Muitas tentativas de reconhecimento. Aguarde alguns minutos antes de tentar de novo.',
      data: { status: 'provider_error' },
    },
  });
}
