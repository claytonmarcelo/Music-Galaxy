// Source Orchestrator — Coordena múltiplos providers de áudio
// Executa busca paralela, aplica exact match, ranking e fallback

import { IAudioSourceProvider, AudioIdentity, SearchResult, AudioCandidate, CandidateScore, ProviderError } from './types';
import { ExactMatchEngine } from './exactMatchEngine';
import { SourceRanker } from './sourceRanker';

export interface OrchestratorConfig {
  enableParallelSearch: boolean;
  maxConcurrentProviders: number;
  requireExactMatch: boolean;
  enableFallback: boolean;
}

export interface DiscoveryResult {
  requestId: string;
  identity: AudioIdentity;
  bestCandidate: CandidateScore | null;
  allCandidates: CandidateScore[];
  providersConsulted: string[];
  providersFailed: ProviderError[];
  durationMs: number;
  fromCache: boolean;
}

export class SourceOrchestrator {
  private providers: Map<string, IAudioSourceProvider> = new Map();
  private exactMatchEngine: ExactMatchEngine;
  private sourceRanker: SourceRanker;
  private config: OrchestratorConfig;

  constructor(config: Partial<OrchestratorConfig> = {}) {
    this.exactMatchEngine = new ExactMatchEngine();
    this.sourceRanker = new SourceRanker();
    this.config = {
      enableParallelSearch: config.enableParallelSearch ?? true,
      maxConcurrentProviders: config.maxConcurrentProviders ?? 3,
      requireExactMatch: config.requireExactMatch ?? true,
      enableFallback: config.enableFallback ?? true,
    };
  }

  // Registrar um provider
  registerProvider(provider: IAudioSourceProvider): void {
    this.providers.set(provider.providerId, provider);
    console.log(`[SourceOrchestrator] Registered provider: ${provider.providerId}`);
  }

  // Remover um provider
  unregisterProvider(providerId: string): void {
    this.providers.delete(providerId);
    console.log(`[SourceOrchestrator] Unregistered provider: ${providerId}`);
  }

  // Obter todos os providers registrados
  getProviders(): IAudioSourceProvider[] {
    return Array.from(this.providers.values());
  }

  // Gerar ID único para requisição
  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
  }

  // Executa a busca de um provider com timeout próprio — um provider lento
  // nunca segura a descoberta inteira.
  private async executarBuscaComTimeout(
    provider: IAudioSourceProvider,
    identity: AudioIdentity
  ): Promise<SearchResult> {
    const timeoutMs = provider.timeouts.search + 2000;
    let timer: NodeJS.Timeout | undefined;

    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(
        () => reject(new Error(`Timeout de busca (${timeoutMs}ms)`)),
        timeoutMs
      );
    });

    try {
      return await Promise.race([provider.search(identity), timeout]);
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  // Executar busca em um único provider
  private async searchProvider(
    provider: IAudioSourceProvider,
    identity: AudioIdentity
  ): Promise<SearchResult> {
    const startTime = Date.now();
    console.log(`[SourceOrchestrator] Searching provider: ${provider.providerId}`);

    try {
      const result = await this.executarBuscaComTimeout(provider, identity);
      const durationMs = Date.now() - startTime;
      
      console.log(
        `[SourceOrchestrator] Provider ${provider.providerId} completed: ` +
        `status=${result.status} candidates=${result.candidates.length} durationMs=${durationMs}`
      );
      
      return result;
    } catch (error) {
      const durationMs = Date.now() - startTime;
      const mensagem = error instanceof Error ? error.message : 'Falha desconhecida no provider';
      const ehTimeout = mensagem.includes('Timeout');
      console.error(`[SourceOrchestrator] Provider ${provider.providerId} failed:`, mensagem);

      return {
        providerId: provider.providerId,
        candidates: [],
        status: ehTimeout ? 'TIMEOUT' : 'FAILED',
        error: mensagem,
        durationMs,
      };
    }
  }

  // Executar busca paralela respeitando o limite de concorrência configurado
  private async parallelSearch(
    providers: IAudioSourceProvider[],
    identity: AudioIdentity
  ): Promise<SearchResult[]> {
    const results: SearchResult[] = new Array(providers.length);
    const limite = Math.max(1, Math.min(this.config.maxConcurrentProviders, providers.length));
    let proximo = 0;

    const trabalhadores = Array.from({ length: limite }, async () => {
      while (true) {
        const indice = proximo;
        proximo += 1;
        if (indice >= providers.length) return;

        const provider = providers[indice];
        if (!provider) return;
        results[indice] = await this.searchProvider(provider, identity);
      }
    });

    await Promise.all(trabalhadores);
    return results;
  }

  // Executar busca sequencial em múltiplos providers
  private async sequentialSearch(
    providers: IAudioSourceProvider[],
    identity: AudioIdentity
  ): Promise<SearchResult[]> {
    const results: SearchResult[] = [];
    
    for (const provider of providers) {
      const result = await this.searchProvider(provider, identity);
      results.push(result);
      
      // Se encontrou candidatos suficientes, parar
      const totalCandidates = results.reduce((sum, r) => sum + r.candidates.length, 0);
      if (totalCandidates >= 10) {
        console.log(`[SourceOrchestrator] Found sufficient candidates, stopping sequential search`);
        break;
      }
    }
    
    return results;
  }

  // Descobrir melhor fonte para uma identidade musical
  async discover(identity: AudioIdentity): Promise<DiscoveryResult> {
    const requestId = this.generateRequestId();
    const startTime = Date.now();
    
    console.log(`[SourceOrchestrator] Starting discovery: requestId=${requestId} identity="${identity.artist} - ${identity.title}"`);

    // Verificar cache primeiro
    const cacheKey = `${identity.artist}-${identity.title}-${identity.version || 'original'}-${identity.duration || 0}`;
    const cachedResult = await this.checkCache(cacheKey);
    
    if (cachedResult) {
      console.log(`[SourceOrchestrator] Cache HIT: requestId=${requestId}`);
      return {
        requestId,
        identity,
        bestCandidate: cachedResult.bestCandidate,
        allCandidates: cachedResult.allCandidates,
        providersConsulted: cachedResult.providersConsulted,
        providersFailed: [],
        durationMs: Date.now() - startTime,
        fromCache: true,
      };
    }

    console.log(`[SourceOrchestrator] Cache MISS: requestId=${requestId}`);

    // Obter providers disponíveis
    const providers = this.getProviders();
    if (providers.length === 0) {
      console.error(`[SourceOrchestrator] No providers registered`);
      return {
        requestId,
        identity,
        bestCandidate: null,
        allCandidates: [],
        providersConsulted: [],
        providersFailed: [],
        durationMs: Date.now() - startTime,
        fromCache: false,
      };
    }

    // Executar busca (paralela ou sequencial)
    const searchResults = this.config.enableParallelSearch
      ? await this.parallelSearch(providers, identity)
      : await this.sequentialSearch(providers, identity);

    // Coletar todos os candidatos
    const allCandidates: AudioCandidate[] = [];
    const providersConsulted: string[] = [];
    const providersFailed: ProviderError[] = [];

    for (const result of searchResults) {
      providersConsulted.push(result.providerId);
      
      if (result.status === 'SUCCESS') {
        allCandidates.push(...result.candidates);
      } else {
        providersFailed.push({
          providerId: result.providerId,
          operation: 'search',
          type: this.mapSearchStatusToErrorType(result.status),
          message: result.error || 'Unknown error',
          retryable: result.status === 'TIMEOUT' || result.status === 'RATE_LIMITED',
        });
      }
    }

    console.log(
      `[SourceOrchestrator] Search completed: requestId=${requestId} ` +
      `providers=${providersConsulted.length} candidates=${allCandidates.length} failed=${providersFailed.length}`
    );

    // Pontuar candidatos com exact match
    const scoredCandidates = this.exactMatchEngine.scoreCandidates(identity, allCandidates);
    
    console.log(
      `[SourceOrchestrator] Scoring completed: requestId=${requestId} ` +
      `exact=${scoredCandidates.filter(s => s.classification === 'EXACT_MATCH').length} ` +
      `probable=${scoredCandidates.filter(s => s.classification === 'PROBABLE_MATCH').length} ` +
      `rejected=${scoredCandidates.filter(s => s.classification === 'REJECTED').length}`
    );

    // Rankear candidatos
    const rankedCandidates = this.sourceRanker.rankCandidates(scoredCandidates);

    // Selecionar melhor candidato
    let bestCandidate: CandidateScore | null = null;
    
    if (this.config.requireExactMatch) {
      // Apenas EXACT_MATCH
      const exactMatches = this.exactMatchEngine.filterExactMatches(rankedCandidates);
      bestCandidate = exactMatches.length > 0 ? exactMatches[0] : null;
    } else {
      // EXACT_MATCH ou PROBABLE_MATCH com pontuação alta
      bestCandidate = this.sourceRanker.selectBestCandidate(rankedCandidates);
    }

    if (bestCandidate) {
      console.log(
        `[SourceOrchestrator] Best candidate selected: requestId=${requestId} ` +
        `provider=${bestCandidate.candidate.providerId} sourceId=${bestCandidate.candidate.sourceId} ` +
        `score=${bestCandidate.score.toFixed(1)} classification=${bestCandidate.classification}`
      );
    } else {
      console.warn(`[SourceOrchestrator] No acceptable candidate found: requestId=${requestId}`);
    }

    const result: DiscoveryResult = {
      requestId,
      identity,
      bestCandidate,
      allCandidates: rankedCandidates,
      providersConsulted,
      providersFailed,
      durationMs: Date.now() - startTime,
      fromCache: false,
    };

    // Salvar no cache
    if (bestCandidate) {
      await this.saveCache(cacheKey, result);
    }

    return result;
  }

  // Mapear status de busca para tipo de erro
  private mapSearchStatusToErrorType(status: SearchResult['status']): ProviderError['type'] {
    switch (status) {
      case 'TIMEOUT':
        return 'TIMEOUT';
      case 'RATE_LIMITED':
        return 'RATE_LIMITED';
      case 'FORBIDDEN':
        return 'FORBIDDEN';
      case 'FAILED':
        return 'UNAVAILABLE';
      default:
        return 'INTERNAL_ERROR';
    }
  }

  // Verificar cache de descoberta
  // Cache de memória com TTL — evita re-crawlear a web a cada requisição.
  // (A persistência principal continua sendo releases.audio_source_url.)
  private readonly cacheDescoberta = new Map<string, { resultado: DiscoveryResult; expiraEm: number }>();
  private readonly TTL_CACHE_MS = 60 * 60 * 1000; // 1 hora
  private readonly TAMANHO_MAX_CACHE = 500;

  private async checkCache(key: string): Promise<DiscoveryResult | null> {
    const entrada = this.cacheDescoberta.get(key);
    if (!entrada) return null;

    if (Date.now() > entrada.expiraEm) {
      this.cacheDescoberta.delete(key);
      return null;
    }

    // Resultado negativo não é reusado — permite tentar a descoberta de novo
    if (!entrada.resultado.bestCandidate) return null;

    return entrada.resultado;
  }

  // Salvar resultado no cache
  private async saveCache(key: string, result: DiscoveryResult): Promise<void> {
    // Controle simples de tamanho: remove entradas mais antigas que expiraram
    if (this.cacheDescoberta.size >= this.TAMANHO_MAX_CACHE) {
      const agora = Date.now();
      for (const [k, v] of this.cacheDescoberta.entries()) {
        if (v.expiraEm <= agora) this.cacheDescoberta.delete(k);
      }
      if (this.cacheDescoberta.size >= this.TAMANHO_MAX_CACHE) {
        const maisAntiga = this.cacheDescoberta.keys().next().value;
        if (maisAntiga) this.cacheDescoberta.delete(maisAntiga);
      }
    }

    this.cacheDescoberta.set(key, { resultado: result, expiraEm: Date.now() + this.TTL_CACHE_MS });
    console.log(`[SourceOrchestrator] Cache salvo: key=${key}`);
  }

  // Limpar cache
  async clearCache(): Promise<void> {
    this.cacheDescoberta.clear();
    console.log(`[SourceOrchestrator] Cache limpo`);
  }

  // Obter estatísticas
  getStats(): {
    providersCount: number;
    config: OrchestratorConfig;
  } {
    return {
      providersCount: this.providers.size,
      config: this.config,
    };
  }
}
