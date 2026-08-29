// Source Ranker — Classificação de fontes de áudio
// Ordena candidatos por qualidade, disponibilidade e correspondência

import { AudioCandidate, CandidateScore } from './types';

export interface RankingCriteria {
  exactMatch: boolean; // Prioridade absoluta
  qualityScore: number; // 0-100, baseado em codec, bitrate, etc
  formatPreference: number; // Preferência por formato (FLAC > MP3 > outros)
  availability: number; // 0-100, estabilidade da fonte
  speed: number; // 0-100, velocidade de download
}

export class SourceRanker {
  // Preferência de formatos (maior = melhor)
  private readonly FORMAT_PREFERENCE = {
    flac: 100,
    wav: 90,
    alac: 85,
    m4a: 70,
    mp3: 65,
    webm: 50,
    opus: 45,
    aac: 40,
    ogg: 35,
  };

  // Calcular pontuação de qualidade de um candidato
  private calculateQualityScore(candidate: AudioCandidate): number {
    let score = 0;

    // Codec/Formato
    const formatScore = this.FORMAT_PREFERENCE[candidate.format?.toLowerCase() as keyof typeof this.FORMAT_PREFERENCE] || 30;
    score += formatScore * 0.4;

    // Bitrate (para MP3 e similares)
    if (candidate.bitrate) {
      if (candidate.bitrate >= 320) score += 30;
      else if (candidate.bitrate >= 256) score += 25;
      else if (candidate.bitrate >= 192) score += 20;
      else if (candidate.bitrate >= 128) score += 15;
      else score += 10;
    }

    // Sample rate (para lossless)
    if (candidate.sampleRate) {
      if (candidate.sampleRate >= 96000) score += 15;
      else if (candidate.sampleRate >= 48000) score += 12;
      else if (candidate.sampleRate >= 44100) score += 10;
      else score += 5;
    }

    // Bit depth (para lossless)
    if (candidate.bitDepth) {
      if (candidate.bitDepth >= 24) score += 10;
      else if (candidate.bitDepth >= 16) score += 7;
      else score += 3;
    }

    // Canais (stereo > mono)
    if (candidate.channels === 2) score += 5;
    else if (candidate.channels === 1) score += 2;

    // Qualidade declarada
    if (candidate.quality) {
      const qualityLower = candidate.quality.toLowerCase();
      if (qualityLower.includes('lossless') || qualityLower.includes('flac')) score += 15;
      else if (qualityLower.includes('high') || qualityLower.includes('320')) score += 10;
      else if (qualityLower.includes('medium') || qualityLower.includes('192')) score += 5;
    }

    return Math.min(score, 100);
  }

  // Calcular critérios de ranking para um candidato
  private calculateRankingCriteria(
    scoredCandidate: CandidateScore
  ): RankingCriteria {
    const candidate = scoredCandidate.candidate;

    return {
      exactMatch: scoredCandidate.classification === 'EXACT_MATCH',
      qualityScore: this.calculateQualityScore(candidate),
      formatPreference: this.FORMAT_PREFERENCE[candidate.format?.toLowerCase() as keyof typeof this.FORMAT_PREFERENCE] || 30,
      availability: 80, // Valor padrão, pode ser ajustado com histórico
      speed: 70, // Valor padrão, pode ser ajustado com medição
    };
  }

  // Calcular pontuação final de ranking (0-100)
  private calculateFinalRankingScore(criteria: RankingCriteria): number {
    let score = 0;

    // Exact match é prioridade absoluta
    if (criteria.exactMatch) {
      score += 50;
    } else {
      score += 10; // Penalidade severa para não-exact match
    }

    // Qualidade tem peso significativo
    score += criteria.qualityScore * 0.3;

    // Preferência de formato
    score += criteria.formatPreference * 0.15;

    // Disponibilidade
    score += criteria.availability * 0.05;

    // Velocidade
    score += criteria.speed * 0.05;

    return Math.min(score, 100);
  }

  // Rankear candidatos pontuados
  rankCandidates(scoredCandidates: CandidateScore[]): CandidateScore[] {
    // Adicionar pontuação de ranking a cada candidato
    const ranked = scoredCandidates.map(scored => {
      const criteria = this.calculateRankingCriteria(scored);
      const rankingScore = this.calculateFinalRankingScore(criteria);
      
      return {
        ...scored,
        // Adicionar rankingScore como metadado
        candidate: {
          ...scored.candidate,
          metadata: {
            ...scored.candidate.metadata,
            rankingScore,
            exactMatch: criteria.exactMatch,
            qualityScore: criteria.qualityScore,
          },
        },
      };
    });

    // Ordenar por: 1) exact match, 2) ranking score, 3) exact match score
    return ranked.sort((a, b) => {
      const aExact = a.candidate.metadata?.exactMatch ? 1 : 0;
      const bExact = b.candidate.metadata?.exactMatch ? 1 : 0;
      
      if (aExact !== bExact) return bExact - aExact;
      
      const aRanking = a.candidate.metadata?.rankingScore || 0;
      const bRanking = b.candidate.metadata?.rankingScore || 0;
      
      if (Math.abs(aRanking - bRanking) > 1) return bRanking - aRanking;
      
      return b.score - a.score;
    });
  }

  // Selecionar o melhor candidato
  selectBestCandidate(scoredCandidates: CandidateScore[]): CandidateScore | null {
    if (scoredCandidates.length === 0) return null;

    const ranked = this.rankCandidates(scoredCandidates);
    const best = ranked[0];

    // Só retornar se for EXACT_MATCH ou PROBABLE_MATCH com pontuação alta
    if (best.classification === 'EXACT_MATCH') {
      return best;
    }

    if (best.classification === 'PROBABLE_MATCH' && best.score >= 75) {
      return best;
    }

    return null;
  }
}
