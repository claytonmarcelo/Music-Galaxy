// Serviço de comunicação com a API do Music Galaxy.
// Centraliza todas as chamadas HTTP, trata erros e aplica debounce/cancelamento
// para evitar requisições duplicadas durante a digitação do usuário.

import { RespostaBusca, Release } from '../types';

// URL base da API — aponta para o IP da máquina na rede local.
// 192.168.0.153 é o IP atual detectado — ajuste se mudar de rede.
// Emulador Android usa 10.0.2.2, dispositivo físico usa IP da máquina.
const BASE_URL = __DEV__
  ? 'http://192.168.0.153:3001'  // IP da máquina na rede Wi-Fi local
  : 'http://192.168.0.153:3001';

const TIMEOUT_MS = 15000;

// Realiza uma requisição com timeout e suporte a AbortController.
async function requisicaoComTimeout<T>(
  url: string,
  sinal?: AbortSignal
): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  // Combina o sinal externo (cancelamento pelo componente) com o timeout interno
  const sinaisCombinados = sinal
    ? anySignal([sinal, controller.signal])
    : controller.signal;

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Accept':        'application/json',
      },
      signal: sinaisCombinados,
    });

    clearTimeout(timer);

    if (!response.ok) {
      const corpo = await response.json().catch(() => ({})) as any;
      throw new Error(corpo?.error || `Erro HTTP ${response.status}`);
    }

    return response.json() as Promise<T>;
  } catch (err) {
    clearTimeout(timer);
    throw err;
  }
}

// Combina múltiplos AbortSignals — aborta quando qualquer um deles for ativado.
function anySignal(signals: AbortSignal[]): AbortSignal {
  const controller = new AbortController();

  for (const sinal of signals) {
    if (sinal.aborted) {
      controller.abort();
      return controller.signal;
    }
    sinal.addEventListener('abort', () => controller.abort(), { once: true });
  }

  return controller.signal;
}

// ============================================================
// Endpoints da API
// ============================================================

// Busca músicas pelo termo — endpoint principal do app.
// Recebe sinal de AbortController para cancelar se o usuário
// apagar o texto ou trocar de tela durante a requisição.
export async function buscarMusicas(
  termo: string,
  opcoes?: { limit?: number; offset?: number; sinal?: AbortSignal }
): Promise<RespostaBusca> {
  const { limit = 50, offset = 0, sinal } = opcoes ?? {};
  const url = `${BASE_URL}/api/search?q=${encodeURIComponent(termo)}&limit=${limit}&offset=${offset}`;
  return requisicaoComTimeout<RespostaBusca>(url, sinal);
}

// Busca detalhes de um release específico.
export async function buscarRelease(
  id: number,
  sinal?: AbortSignal
): Promise<{ success: boolean; data: Release }> {
  const url = `${BASE_URL}/api/releases/${id}`;
  return requisicaoComTimeout(url, sinal);
}

// Health check da API — verifica se o servidor está respondendo.
export async function verificarSaude(): Promise<boolean> {
  try {
    const resp = await fetch(`${BASE_URL}/health`, { method: 'GET' });
    return resp.ok;
  } catch {
    return false;
  }
}
