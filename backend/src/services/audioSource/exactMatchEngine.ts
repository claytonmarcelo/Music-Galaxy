// Exact Match Engine — Pontuação e classificação de candidatos
// Determina se um candidato realmente corresponde à música solicitada

import { AudioIdentity, AudioCandidate, MatchClassification, CandidateScore } from './types';

export class ExactMatchEngine {
  // Pontuação mínima para EXACT_MATCH
  private readonly EXACT_MATCH_THRESHOLD = 90;
  
  // Pontuação mínima para PROBABLE_MATCH
  private readonly PROBABLE_MATCH_THRESHOLD = 60;

  // Pontuação máxima possível
  private readonly MAX_SCORE = 100;

  // Pesos dos critérios
  private readonly WEIGHTS = {
    artist: 35,      // Artista é o critério mais importante
    title: 30,       // Título é muito importante
    duration: 15,    // Duração é importante
    version: 10,     // Versão é importante quando especificada
    album: 10,       // Álbum é menos crítico
  };

  // Normalizar string para comparação
  private normalize(str: string): string {
    return str
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^\w\s-]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  // Calcular similaridade entre duas strings (0-1)
  private calculateSimilarity(str1: string, str2: string): number {
    const s1 = this.normalize(str1);
    const s2 = this.normalize(str2);

    if (s1 === s2) return 1;
    if (!s1 || !s2) return 0;

    const longer = s1.length > s2.length ? s1 : s2;
    const shorter = s1.length > s2.length ? s2 : s1;

    if (longer.length === 0) return 1;
    if (shorter.length === 0) return 0;

    const distance = this.levenshteinDistance(longer, shorter);
    return (longer.length - distance) / longer.length;
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

  // Verificar compatibilidade de duração
  private checkDurationCompatibility(
    expectedDuration?: number,
   实际Duration?: number,
    tolerance: number = 5
  ): { compatible: boolean; score: number; reason: string } {
    if (!expectedDuration || !实际Duration) {
      return { compatible: true, score: this.WEIGHTS.duration, reason: 'Duração não especificada' };
    }

    const diff = Math.abs(expectedDuration - 实际Duration);
    const compatible = diff <= tolerance;

    if (compatible) {
      // Pontuação proporcional à precisão
      const precision = 1 - (diff / tolerance);
      const score = this.WEIGHTS.duration * precision;
      return { compatible, score, reason: `Duração compatível (${diff}s de diferença)` };
    }

    return { compatible: false, score: 0, reason: `Duração incompatível (${diff}s de diferença)` };
  }

  // Verificar se a versão corresponde
  private checkVersionCompatibility(
    expectedVersion?: string,
    candidateVersion?: string
  ): { compatible: boolean; score: number; reason: string } {
    if (!expectedVersion) {
      // Se não especificou versão, qualquer versão é aceitável
      return { compatible: true, score: this.WEIGHTS.version, reason: 'Versão não especificada' };
    }

    if (!candidateVersion) {
      return { compatible: false, score: 0, reason: 'Versão não informada pelo candidato' };
    }

    const normalizedExpected = this.normalize(expectedVersion);
    const normalizedCandidate = this.normalize(candidateVersion);

    if (normalizedExpected === normalizedCandidate) {
      return { compatible: true, score: this.WEIGHTS.version, reason: 'Versão corresponde exatamente' };
    }

    // Verificar se é uma variação aceitável
    const similarity = this.calculateSimilarity(expectedVersion, candidateVersion);
    if (similarity >= 0.8) {
      const score = this.WEIGHTS.version * similarity;
      return { compatible: true, score, reason: 'Versão similar' };
    }

    return { compatible: false, score: 0, reason: 'Versão não corresponde' };
  }

  // Verificar se o álbum corresponde
  private checkAlbumCompatibility(
    expectedAlbum?: string,
    candidateAlbum?: string
  ): { compatible: boolean; score: number; reason: string } {
    if (!expectedAlbum) {
      return { compatible: true, score: this.WEIGHTS.album, reason: 'Álbum não especificado' };
    }

    if (!candidateAlbum) {
      // Se não tem álbum no candidato, não pode verificar
      return { compatible: true, score: this.WEIGHTS.album * 0.5, reason: 'Álbum não informado pelo candidato' };
    }

    const similarity = this.calculateSimilarity(expectedAlbum, candidateAlbum);
    if (similarity >= 0.7) {
      const score = this.WEIGHTS.album * similarity;
      return { compatible: true, score, reason: `Álbum similar (${(similarity * 100).toFixed(0)}%)` };
    }

    return { compatible: false, score: 0, reason: 'Álbum não corresponde' };
  }

  // Aplicar regras de rejeição
  private applyRejectionRules(
    identity: AudioIdentity,
    candidate: AudioCandidate
  ): { rejected: boolean; reason: string } {
    const reasons: string[] = [];

    // Regra 1: Artista diferente
    const artistSimilarity = this.calculateSimilarity(identity.artist, candidate.artist);
    if (artistSimilarity < 0.5) {
      reasons.push('Artista muito diferente');
    }

    // Regra 2: Título muito diferente
    const titleSimilarity = this.calculateSimilarity(identity.title, candidate.title);
    if (titleSimilarity < 0.5) {
      reasons.push('Título muito diferente');
    }

    // Regra 3: Versão explícita incompatível
    if (identity.version && candidate.version) {
      const normalizedExpected = this.normalize(identity.version);
      const normalizedCandidate = this.normalize(candidate.version);

      // Rejeitar cover quando foi solicitada versão original
      if (normalizedExpected.includes('original') && 
          (normalizedCandidate.includes('cover') || 
           normalizedCandidate.includes('tribute') ||
           normalizedCandidate.includes('karaoke'))) {
        reasons.push('Cover/tribute quando foi solicitada versão original');
      }

      // Rejeitar remix quando foi solicitada versão original
      if (normalizedExpected.includes('original') && 
          (normalizedCandidate.includes('remix') || 
           normalizedCandidate.includes('edit') ||
           normalizedCandidate.includes('mix'))) {
        reasons.push('Remix/edit quando foi solicitada versão original');
      }

      // Rejeitar live quando foi solicitada versão de estúdio
      if (!normalizedExpected.includes('live') && normalizedCandidate.includes('live')) {
        reasons.push('Versão live quando foi solicitada versão de estúdio');
      }

      // Rejeitar instrumental quando foi solicitada versão vocal
      if (!normalizedExpected.includes('instrumental') && 
          !normalizedExpected.includes('acapella') &&
          (normalizedCandidate.includes('instrumental') || 
           normalizedCandidate.includes('acapella'))) {
        reasons.push('Instrumental/acapella quando foi solicitada versão completa');
      }
    }

    // Regra 4: Duração muito incompatível
    if (identity.duration && candidate.duration) {
      const diff = Math.abs(identity.duration - candidate.duration);
      const tolerance = Math.max(5, identity.duration * 0.1); // 10% ou 5 segundos, o que for maior
      if (diff > tolerance) {
        reasons.push(`Duração muito incompatível (${diff}s de diferença)`);
      }
    }

    // Regra 5: Indicadores de conteúdo incompleto
    const titleLower = this.normalize(candidate.title);
    if (titleLower.includes('preview') || 
        titleLower.includes('sample') || 
        titleLower.includes('snippet') ||
        titleLower.includes('trailer')) {
      reasons.push('Indicador de preview/sample no título');
    }

    if (reasons.length > 0) {
      return { rejected: true, reason: reasons.join('; ') };
    }

    return { rejected: false, reason: '' };
  }

  // Calcular pontuação de um candidato
  scoreCandidate(identity: AudioIdentity, candidate: AudioCandidate): CandidateScore {
    const reasons: string[] = [];
    let totalScore = 0;

    // Aplicar regras de rejeição primeiro
    const rejection = this.applyRejectionRules(identity, candidate);
    if (rejection.rejected) {
      return {
        candidate,
        classification: MatchClassification.REJECTED,
        score: 0,
        reasons: [rejection.reason],
      };
    }

    // Pontuação do artista
    const artistSimilarity = this.calculateSimilarity(identity.artist, candidate.artist);
    const artistScore = this.WEIGHTS.artist * artistSimilarity;
    totalScore += artistScore;
    reasons.push(`Artista: ${(artistSimilarity * 100).toFixed(0)}%`);

    // Pontuação do título
    const titleSimilarity = this.calculateSimilarity(identity.title, candidate.title);
    const titleScore = this.WEIGHTS.title * titleSimilarity;
    totalScore += titleScore;
    reasons.push(`Título: ${(titleSimilarity * 100).toFixed(0)}%`);

    // Pontuação da duração
    const durationCheck = this.checkDurationCompatibility(identity.duration, candidate.duration);
    totalScore += durationCheck.score;
    reasons.push(durationCheck.reason);

    // Pontuação da versão
    const versionCheck = this.checkVersionCompatibility(identity.version, candidate.version);
    totalScore += versionCheck.score;
    reasons.push(versionCheck.reason);

    // Pontuação do álbum
    const albumCheck = this.checkAlbumCompatibility(identity.album, candidate.album);
    totalScore += albumCheck.score;
    reasons.push(albumCheck.reason);

    // Normalizar para 0-100
    const finalScore = Math.min(totalScore, this.MAX_SCORE);

    // Classificar
    let classification: MatchClassification;
    if (finalScore >= this.EXACT_MATCH_THRESHOLD) {
      classification = MatchClassification.EXACT_MATCH;
    } else if (finalScore >= this.PROBABLE_MATCH_THRESHOLD) {
      classification = MatchClassification.PROBABLE_MATCH;
    } else {
      classification = MatchClassification.REJECTED;
    }

    return {
      candidate,
      classification,
      score: finalScore,
      reasons,
    };
  }

  // Classificar múltiplos candidatos
  scoreCandidates(identity: AudioIdentity, candidates: AudioCandidate[]): CandidateScore[] {
    return candidates.map(candidate => this.scoreCandidate(identity, candidate));
  }

  // Filtrar apenas EXACT_MATCH
  filterExactMatches(scores: CandidateScore[]): CandidateScore[] {
    return scores.filter(s => s.classification === MatchClassification.EXACT_MATCH);
  }

  // Filtrar EXACT_MATCH e PROBABLE_MATCH
  filterAcceptableMatches(scores: CandidateScore[]): CandidateScore[] {
    return scores.filter(s => s.classification !== MatchClassification.REJECTED);
  }

  // Ordenar por pontuação (maior primeiro)
  sortByScore(scores: CandidateScore[]): CandidateScore[] {
    return [...scores].sort((a, b) => b.score - a.score);
  }
}
