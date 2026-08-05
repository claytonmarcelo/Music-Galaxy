// Serviço de comunicação com a API do Music Galaxy.
// Centraliza todas as chamadas HTTP, trata erros e aplica cancelamento
// via AbortController para evitar requisições duplicadas.

import { Platform } from 'react-native';
import { RespostaBusca, Release, Work, RespostaWork, RespostaReleasesDeWork, Artista, RespostaArtista, RespostaObrasArtista } from '../types';

// ============================================================
// Resolução dinâmica da URL base conforme ambiente de execução
// ============================================================
// - Browser web (localhost:8081):  backend está em localhost:3001
// - Emulador Android:              10.0.2.2 mapeia para o host da máquina
// - Dispositivo físico / Expo Go:  usar o IP da máquina na rede local
//
// IP local da máquina: 192.168.0.153 — atualizar se mudar de rede.
// ============================================================
function resolverBaseUrl(): string {
  // No browser (web), a API está no mesmo host
  if (typeof window !== 'undefined' && typeof document !== 'undefined') {
    // Estamos no browser — backend no mesmo host, porta 3001
    const protocolo = window.location.protocol;
    const host      = window.location.hostname;
    return `${protocolo}//${host}:3001`;
  }

  // React Native nativo
  if (Platform.OS === 'android') {
    // Emulador Android: 10.0.2.2 = host da máquina
    // Dispositivo físico: IP real da máquina
    return __DEV__
      ? 'http://10.0.2.2:3001'         // emulador Android Studio
      : 'http://192.168.0.153:3001';   // dispositivo físico / Expo Go
  }

  // iOS (simulador ou Expo Go)
  return 'http://localhost:3001';
}

export const BASE_URL    = resolverBaseUrl();
const TIMEOUT_MS  = 15000;

// Exportar a URL base para ser usada por outros módulos
export const API_BASE_URL = BASE_URL;

// Realiza uma requisição com timeout e suporte a AbortController.
async function requisicaoComTimeout<T>(
  url: string,
  sinal?: AbortSignal
): Promise<T> {
  const controller = new AbortController();
  const timer      = setTimeout(() => controller.abort(), TIMEOUT_MS);

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

// Combina múltiplos AbortSignals — aborta quando qualquer um for ativado.
function anySignal(signals: AbortSignal[]): AbortSignal {
  const controller = new AbortController();
  for (const sinal of signals) {
    if (sinal.aborted) { controller.abort(); return controller.signal; }
    sinal.addEventListener('abort', () => controller.abort(), { once: true });
  }
  return controller.signal;
}

// ============================================================
// Endpoints da API
// ============================================================

// Busca músicas pelo termo — endpoint principal do app.
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

// Health check — verifica se o servidor está respondendo.
export async function verificarSaude(): Promise<boolean> {
  try {
    const resp = await fetch(`${BASE_URL}/health`, { method: 'GET' });
    return resp.ok;
  } catch {
    return false;
  }
}

// ============================================================
// Endpoints de Obra (Work)
// ============================================================

// Busca detalhes de uma obra específica.
export async function buscarWork(
  workId: number,
  sinal?: AbortSignal
): Promise<RespostaWork> {
  const url = `${BASE_URL}/api/works/${workId}`;
  return requisicaoComTimeout<RespostaWork>(url, sinal);
}

// Busca todas as versões/releases de uma obra específica.
export async function buscarReleasesDeWork(
  workId: number,
  opcoes?: { limit?: number; offset?: number; sinal?: AbortSignal }
): Promise<RespostaReleasesDeWork> {
  const { limit = 100, offset = 0, sinal } = opcoes ?? {};
  const url = `${BASE_URL}/api/works/${workId}/releases?limit=${limit}&offset=${offset}`;
  return requisicaoComTimeout<RespostaReleasesDeWork>(url, sinal);
}

// ============================================================
// Endpoints de Artista (Artist)
// ============================================================

// Busca detalhes de um artista específico.
export async function buscarArtista(
  artistaId: number,
  sinal?: AbortSignal
): Promise<RespostaArtista> {
  const url = `${BASE_URL}/api/artists/${artistaId}`;
  return requisicaoComTimeout<RespostaArtista>(url, sinal);
}

// Busca todas as obras de um artista.
export async function buscarObrasArtista(
  artistaId: number,
  opcoes?: { limit?: number; offset?: number; sinal?: AbortSignal }
): Promise<RespostaObrasArtista> {
  const { limit = 100, offset = 0, sinal } = opcoes ?? {};
  const url = `${BASE_URL}/api/artists/${artistaId}/works?limit=${limit}&offset=${offset}`;
  return requisicaoComTimeout<RespostaObrasArtista>(url, sinal);
}

// ============================================================
// Endpoints de Ingestão (Admin)
// ============================================================

// Força ingestão manual de um termo (endpoint administrativo).
export async function forcarIngestao(
  termo: string,
  sinal?: AbortSignal
): Promise<{ success: boolean; data?: any; error?: string }> {
  const url = `${BASE_URL}/api/search/ingest`;
  
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({ q: termo }),
      signal: sinal,
    });

    if (!response.ok) {
      const corpo = await response.json().catch(() => ({})) as any;
      return {
        success: false,
        error: corpo?.error || `Erro HTTP ${response.status}`,
      };
    }

    return response.json();
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Erro desconhecido',
    };
  }
}
