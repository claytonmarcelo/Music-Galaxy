// Serviço de comunicação com a API do Music Galaxy.
// Centraliza todas as chamadas HTTP, trata erros e aplica cancelamento
// via AbortController para evitar requisições duplicadas.
//
// O endereço do servidor agora é configurável pelo usuário na tela de
// Ajustes (ver services/apiConfig.ts). Ao iniciar o aplicativo, o endereço
// salvo é carregado; sem configuração em produção, o app funciona offline.

import { RespostaBusca, Release, Work, RespostaWork, RespostaReleasesDeWork, Artista, RespostaArtista, RespostaObrasArtista, ResultadoIngestao } from '../types';
import { urlBasePadrao, obterUrlSalva, normalizarUrlServidor, definirUrlServidor, testarConexaoServidor } from './apiConfig';

// ============================================================
// Endereço base atual da API
// ============================================================
// É uma variável viva: começa com o padrão do ambiente e é atualizada
// quando a configuração salva é carregada ou quando o usuário muda o
// endereço na tela de Ajustes. Os consumidores sempre enxergam o valor
// mais recente.
let BASE_URL = urlBasePadrao();

export { BASE_URL };

// Promessa única de inicialização — evita carregar a configuração salva
// mais de uma vez por execução do aplicativo.
let promessaInicializacao: Promise<void> | null = null;

// Carrega o endereço salvo pelo usuário (AsyncStorage) e aplica em BASE_URL.
export async function inicializarApiConfig(): Promise<void> {
  if (!promessaInicializacao) {
    promessaInicializacao = (async () => {
      const salva = await obterUrlSalva();
      if (salva) {
        BASE_URL = normalizarUrlServidor(salva);
      }
    })().catch((erro) => {
      console.error('Erro ao inicializar configuração da API:', erro);
    });
  }
  return promessaInicializacao;
}

// Garante que a configuração salva já foi aplicada antes de uma requisição.
async function garantirConfiguracao(): Promise<void> {
  if (!promessaInicializacao) {
    await inicializarApiConfig();
  }
  await promessaInicializacao;
}

// Salva um novo endereço de servidor e já aplica nas próximas chamadas.
// Retorna o endereço normalizado que ficou gravado.
export async function configurarServidor(entrada: string): Promise<string> {
  const url = await definirUrlServidor(entrada);
  BASE_URL = url || urlBasePadrao();
  return BASE_URL;
}

// Remove a configuração do usuário e volta ao padrão do ambiente.
export async function restaurarServidorPadrao(): Promise<string> {
  const { limparUrlServidor } = await import('./apiConfig');
  await limparUrlServidor();
  BASE_URL = urlBasePadrao();
  return BASE_URL;
}

// Testa a conexão com um endereço informado (usado na tela de Ajustes).
export { testarConexaoServidor };

// Tempo máximo de espera por resposta. Buscas em termos ainda não ingeridos
// esperam o backend consultar as fontes externas (MusicBrainz/Discogs, com
// rate limit), então 45s evita cortar uma busca legítima pela metade.
const TIMEOUT_MS = 45000;

// Extrai a mensagem de erro de uma resposta HTTP sem confiar no formato do
// corpo: o backend devolve `{ error }`, mas proxies e servidores fora da API
// podem devolver HTML ou JSON em outro formato. Nunca propaga detalhes crus.
async function mensagemDeErroDaResposta(response: Response): Promise<string> {
  const fallback = `Erro HTTP ${response.status}`;
  try {
    const corpo: unknown = await response.json();
    if (corpo && typeof corpo === 'object') {
      const registro = corpo as { error?: unknown; message?: unknown };
      if (typeof registro.error === 'string' && registro.error.trim()) {
        return registro.error;
      }
      if (typeof registro.message === 'string' && registro.message.trim()) {
        return registro.message;
      }
    }
  } catch {
    // Corpo não era JSON — usa a mensagem padrão.
  }
  return fallback;
}

// Realiza uma requisição com timeout e suporte a AbortController.
async function requisicaoComTimeout<T>(
  url: string,
  sinal?: AbortSignal
): Promise<T> {
  await garantirConfiguracao();

  // Se não há servidor configurado em produção, falha com mensagem clara
  // para o usuário configurar na tela de Ajustes.
  if (!BASE_URL) {
    throw new Error('Servidor não configurado. Informe o endereço da API na tela de Ajustes.');
  }

  const controller = new AbortController();
  const timer      = setTimeout(() => controller.abort(), TIMEOUT_MS);

  const sinaisCombinados = sinal
    ? anySignal([sinal, controller.signal])
    : controller.signal;

  try {
    const response = await fetch(`${BASE_URL}${url}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Accept':        'application/json',
      },
      signal: sinaisCombinados,
    });

    clearTimeout(timer);

    if (!response.ok) {
      throw new Error(await mensagemDeErroDaResposta(response));
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
  const url = `/api/search?q=${encodeURIComponent(termo)}&limit=${limit}&offset=${offset}`;
  return requisicaoComTimeout<RespostaBusca>(url, sinal);
}

// Busca detalhes de um release específico.
export async function buscarRelease(
  id: number,
  sinal?: AbortSignal
): Promise<{ success: boolean; data: Release }> {
  const url = `/api/releases/${id}`;
  return requisicaoComTimeout(url, sinal);
}

// Health check — verifica se o servidor está respondendo.
export async function verificarSaude(): Promise<boolean> {
  await garantirConfiguracao();
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
  const url = `/api/works/${workId}`;
  return requisicaoComTimeout<RespostaWork>(url, sinal);
}

// Busca todas as versões/releases de uma obra específica.
export async function buscarReleasesDeWork(
  workId: number,
  opcoes?: { limit?: number; offset?: number; sinal?: AbortSignal }
): Promise<RespostaReleasesDeWork> {
  const { limit = 100, offset = 0, sinal } = opcoes ?? {};
  const url = `/api/works/${workId}/releases?limit=${limit}&offset=${offset}`;
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
  const url = `/api/artists/${artistaId}`;
  return requisicaoComTimeout<RespostaArtista>(url, sinal);
}

// Busca todas as obras de um artista.
export async function buscarObrasArtista(
  artistaId: number,
  opcoes?: { limit?: number; offset?: number; sinal?: AbortSignal }
): Promise<RespostaObrasArtista> {
  const { limit = 100, offset = 0, sinal } = opcoes ?? {};
  const url = `/api/artists/${artistaId}/works?limit=${limit}&offset=${offset}`;
  return requisicaoComTimeout<RespostaObrasArtista>(url, sinal);
}

// ============================================================
// Endpoints de Ingestão (Admin)
// ============================================================

// Força ingestão manual de um termo (endpoint administrativo).
export async function forcarIngestao(
  termo: string,
  sinal?: AbortSignal
): Promise<{ success: boolean; data?: ResultadoIngestao; error?: string }> {
  await garantirConfiguracao();

  if (!BASE_URL) {
    return {
      success: false,
      error: 'Servidor não configurado. Informe o endereço da API na tela de Ajustes.',
    };
  }

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
      return {
        success: false,
        error: await mensagemDeErroDaResposta(response),
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
