// Classe base abstrata para providers de áudio
// Fornece funcionalidades comuns para todas as implementações

import { IAudioSourceProvider, AudioIdentity, SearchResult, AudioCandidate, ProviderTimeouts } from './types';

export abstract class BaseAudioSourceProvider implements IAudioSourceProvider {
  abstract readonly providerId: string;
  abstract readonly timeouts: ProviderTimeouts;

  // Normalizar string para comparação (remove acentos, lowercase, etc)
  protected normalizeString(str: string): string {
    return str
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // Remove acentos
      .replace(/[^\w\s-]/g, '') // Remove caracteres especiais
      .replace(/\s+/g, ' ') // Normaliza espaços
      .trim();
  }

  // Normalizar identidade musical para busca
  protected normalizeIdentity(identity: AudioIdentity): AudioIdentity {
    return {
      ...identity,
      artist: this.normalizeString(identity.artist),
      title: this.normalizeString(identity.title),
      album: identity.album ? this.normalizeString(identity.album) : undefined,
      version: identity.version ? this.normalizeString(identity.version) : undefined,
    };
  }

  // Verificar se duas strings são similares (para correspondência aproximada)
  protected isSimilar(str1: string, str2: string, threshold: number = 0.8): boolean {
    const s1 = this.normalizeString(str1);
    const s2 = this.normalizeString(str2);
    
    if (s1 === s2) return true;
    
    // Distância de Levenshtein simplificada
    const longer = s1.length > s2.length ? s1 : s2;
    const shorter = s1.length > s2.length ? s2 : s1;
    
    if (longer.length === 0) return true;
    if (shorter.length === 0) return false;
    
    const similarity = (longer.length - this.levenshteinDistance(longer, shorter)) / longer.length;
    return similarity >= threshold;
  }

  // Distância de Levenshtein
  private levenshteinDistance(str1: string, str2: string): number {
    const m = str1.length;
    const n = str2.length;
    const dp: number[][] = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0));

    for (let i = 0; i <= m; i++) dp[i][0] = i;
    for (let j = 0; j <= n; j++) dp[0][j] = j;

    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        if (str1[i - 1] === str2[j - 1]) {
          dp[i][j] = dp[i - 1][j - 1];
        } else {
          dp[i][j] = 1 + Math.min(
            dp[i - 1][j],
            dp[i][j - 1],
            dp[i - 1][j - 1]
          );
        }
      }
    }

    return dp[m][n];
  }

  // Comparar durações (em segundos) com margem de tolerância
  protected isDurationCompatible(d1?: number, d2?: number, tolerance: number = 5): boolean {
    if (!d1 || !d2) return true; // Se não tem duração, não pode rejeitar por isso
    const diff = Math.abs(d1 - d2);
    return diff <= tolerance;
  }

  // Wrapper com timeout para operações assíncronas
  protected async withTimeout<T>(
    promise: Promise<T>,
    timeoutMs: number,
    operation: string
  ): Promise<T> {
    return Promise.race([
      promise,
      new Promise<T>((_, reject) =>
        setTimeout(() => reject(new Error(`Timeout: ${operation}`)), timeoutMs)
      )
    ]);
  }

  // Métodos abstratos que devem ser implementados pelas subclasses
  abstract search(identity: AudioIdentity): Promise<SearchResult>;
  abstract getMetadata(candidateId: string): Promise<AudioCandidate | null>;
  abstract getDownloadInfo(candidateId: string): Promise<{ url: string; format: string } | null>;
  abstract checkAvailability(candidateId: string): Promise<boolean>;
}
