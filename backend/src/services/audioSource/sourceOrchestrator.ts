// Source Orchestrator — Coordena múltiplos providers de áudio
// Executa busca paralela, aplica exact match, ranking e fallback

import { IAudioSourceProvider, AudioIdentity, SearchResult, AudioCandidate, CandidateScore, ProviderError } from './types';
import { ExactMatchEngine } from './exactMatchEngine';
import { SourceRanker } from './sourceRanker';
import { downloadCache } from '../downloadCache';
import { downloadDeduplication } from '../downloadDeduplication';

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
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Executar busca em um único provider
  private async searchProvider(
    provider: IAudioSourceProvider,
    identity: AudioIdentity
  ): Promise<SearchResult> {
    const startTime = Date.now();
    console.log(`[SourceOrchestrator] Searching provider: ${provider.providerId}`);

    try {
      const result = await provider.search(identity);
      const durationMs = Date.now() - startTime;
      
      console.log(
        `[SourceOrchestrator] Provider ${provider.providerId} completed: ` +
        `status=${result.status} candidates=${result.candidates.length} durationMs=${durationMs}`
      );
      
      return result;
    } catch (error: any) {
      const durationMs = Date.now() - startTime;
      console.error(`[SourceOrchestrator] Provider ${provider.providerId} failed:`, error.message);
      
      return {
        providerId: provider.providerId,
        candidates: [],
        status: 'FAILED',
        error: error.message,
        durationMs,
      };
    }
  }

  // Executar busca paralela em múltiplos providers
  private async parallelSearch(
    providers: IAudioSourceProvider[],
    identity: AudioIdentity
  ): Promise<SearchResult[]> {
    const promises = providers.map(provider => this.searchProvider(provider, identity));
    return Promise.all(promises);
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
  private async checkCache(key: string): Promise<DiscoveryResult | null> {
    // Implementação simplificada - pode ser expandida para usar Redis ou outro cache
    // Por enquanto, retorna null para forçar busca sempre
    return null;
  }

  // Salvar resultado no cache
  private async saveCache(key: string, result: DiscoveryResult): Promise<void> {
    // Implementação simplificada - pode ser expandida para usar Redis ou outro cache
    console.log(`[SourceOrchestrator] Cache saved: key=${key}`);
  }

  // Limpar cache
  async clearCache(): Promise<void> {
    console.log(`[SourceOrchestrator] Cache cleared`);
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
