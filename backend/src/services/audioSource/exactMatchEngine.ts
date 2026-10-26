// Exact Match Engine — Pontuação e classificação de candidatos
// Determina se um candidato realmente corresponde à música solicitada

import { AudioIdentity, AudioCandidate, MatchClassification, CandidateScore } from './types';

export class ExactMatchEngine {
  // Pontuação mínima para EXACT_MATCH
  private readonly EXACT_MATCH_THRESHOLD = 90;

  // Marcadores de versões alternativas. Um lançamento original NUNCA pode
  // receber áudio de uma dessas variantes (Regra 2 + integridade da versão).
  private readonly MARCADORES_VERSAO: ReadonlyArray<{ nome: string; padrao: RegExp }> = [
    { nome: 'live', padrao: /\blive\b/ },
    { nome: 'remix', padrao: /\bremix(es|ed)?\b|\brmx\b/ },
    { nome: 'instrumental', padrao: /\binstrumental\b/ },
    { nome: 'acapella', padrao: /\bacapella\b|\ba cappella\b/ },
    { nome: 'cover', padrao: /\bcover\b/ },
    { nome: 'tribute', padrao: /\btribute\b/ },
    { nome: 'karaoke', padrao: /\bkaraoke\b/ },
    { nome: 'demo', padrao: /\bdemo\b/ },
    { nome: 'bootleg', padrao: /\bbootleg\b/ },
    { nome: 'mashup', padrao: /\bmashup\b/ },
    { nome: 'medley', padrao: /\bmedley\b/ },
    { nome: 'megamix', padrao: /\bmega\s?mix\b/ },
    { nome: 'acoustic', padrao: /\bacoustic\b|\bunplugged\b/ },
    { nome: 'edit', padrao: /\bedit(ed)?\b/ },
    { nome: 'dub', padrao: /\bdub\b/ },
    { nome: 'vip', padrao: /\bvip\b/ },
    { nome: 'extended', padrao: /\bextended\b/ },
    { nome: 'rework', padrao: /\brework(ed)?\b/ },
    { nome: 'sped up', padrao: /\bsped up\b|\bspeed up\b/ },
    { nome: 'slowed', padrao: /\bslowed\b/ },
    { nome: 'intro', padrao: /\bintro\b/ },
    { nome: 'outro', padrao: /\boutro\b/ },
  ];

  // Rótulos que representam a versão "de fábrica" da música, não uma variante.
  private versaoNeutra(versao?: string): boolean {
    if (!versao) return true;
    const v = this.normalize(versao);
    if (!v) return true;
    return /^(original|album|single|main|standard|explicit)( version)?$/.test(v)
      || /^original mix$/.test(v)
      || /^(digital )?remaster(ed)?( \d{4})?$/.test(v)
      || /^album edit$/.test(v);
  }

  // Detecta marcadores de variante em um texto já normalizado.
  private detectarMarcadores(texto?: string): string[] {
    if (!texto) return [];
    const normalizado = this.normalize(texto);
    return this.MARCADORES_VERSAO
      .filter(({ padrao }) => padrao.test(normalizado))
      .map(({ nome }) => nome);
  }

  // Texto que descreve a versão do candidato: o campo version e o que sobra
  // do título depois de remover artista e título da música procurada.
  private evidenciaDeVersao(identity: AudioIdentity, candidate: AudioCandidate): string {
    const titulo = this.normalize(candidate.title);
    const tituloBase = this.normalize(identity.title);
    const artistaBase = this.normalize(identity.artist);

    let sobra = titulo;
    if (artistaBase) sobra = sobra.split(artistaBase).join(' ');
    if (tituloBase) sobra = sobra.split(tituloBase).join(' ');

    return `${candidate.version ?? ''} ${sobra}`.trim();
  }

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

  // Separa os artistas de um crédito compartilhado: "A & B", "A feat. B",
  // "A vs. B", "A, B", "A and B". A ficha oficial de uma colaboração lista todos
  // os artistas, mas o catálogo guarda o artista principal como entidade
  // (Regra 8) — o arquivo pode chegar com o crédito inteiro sem por isso ser
  // outra música.
  //
  // O ponto-e-vírgula e a barra entram porque o Internet Archive grava o campo
  // creator como lista e a uni assim: medido em 26/10/2026, o MP3 de "Saideira"
  // chega com artista "Skank;Skank" — sem separador, a similaridade de artista
  // era 50% e a faixa morria em PROBABLE_MATCH 82,5 (o corte de correspondência
  // exata é 90), exatamente quando o catálogo já tinha encontrado o arquivo.
  private separarCreditos(artista: string): string[] {
    return artista
      .split(/\s*(?:&|\band\b|\bfeat\.?|\bfeaturing\b|\bft\.?|\bvs\.?|\bversus\b|\bx\b|\bmeets\b|\bwith\b|,|;|\/|\+)\s*/i)
      .map((parte) => this.normalize(parte))
      .filter((parte) => parte.length >= 2);
  }

  // Similaridade de artista que entende crédito compartilhado: o artista pedido
  // aparecer entre os creditados vale igualdade. Medido em 23/10/2026: 154
  // versões de "Lean On" presas em PROBABLE_MATCH 84,3 porque o MP3 se chama
  // "Major Lazer & DJ Snake - Lean On" e o catálogo guarda "Major Lazer".
  private similaridadeDeArtista(artistaPedida: string, artistaCandidato: string): number {
    const direta = this.calculateSimilarity(artistaPedida, artistaCandidato);
    if (direta >= 0.999) return 1;

    const pedida = this.normalize(artistaPedida);
    const candidato = this.normalize(artistaCandidato);
    if (!pedida || !candidato) return direta;

    const creditosDoCandidato = this.separarCreditos(artistaCandidato);
    const creditosDaPedida = this.separarCreditos(artistaPedida);

    const estaCreditado =
      creditosDoCandidato.includes(pedida) || creditosDaPedida.includes(candidato);

    return estaCreditado ? 1 : direta;
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
   candidateDuration?: number,
    tolerance: number = 5
  ): { compatible: boolean; score: number; reason: string } {
    if (!expectedDuration || !candidateDuration) {
      return { compatible: true, score: this.WEIGHTS.duration, reason: 'Duração não especificada' };
    }

    const diff = Math.abs(expectedDuration - candidateDuration);
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

    // Regra 1: Artista diferente. Crédito compartilhado de colaboração não é
    // artista diferente; um nome que não aparece em nenhum crédito continua
    // sendo rejeitado.
    const artistSimilarity = this.similaridadeDeArtista(identity.artist, candidate.artist);
    if (artistSimilarity < 0.5) {
      reasons.push('Artista muito diferente');
    }

    // Regra 2: Título muito diferente
    const titleSimilarity = this.calculateSimilarity(identity.title, candidate.title);
    if (titleSimilarity < 0.5) {
      reasons.push('Título muito diferente');
    }

    // Regra 3: integridade da versão.
    // Compara os marcadores presentes na identidade pedida com os do candidato
    // (campo version + sobra do título). Qualquer variante não solicitada é
    // rejeitada — um lançamento original nunca recebe live/remix/instrumental.
    const marcadoresEsperados = this.detectarMarcadores(identity.version);
    const marcadoresCandidato = this.detectarMarcadores(
      this.evidenciaDeVersao(identity, candidate)
    );
    const naoEsperados = marcadoresCandidato.filter(
      (marcador) => !marcadoresEsperados.includes(marcador)
    );
    if (naoEsperados.length > 0) {
      reasons.push(`Versão alternativa não solicitada: ${naoEsperados.join(', ')}`);
    }

    // Quando a versão pedida é uma variante real (ex.: Instrumental), o
    // candidato precisa comprovar que também é aquela variante.
    if (!this.versaoNeutra(identity.version) && marcadoresCandidato.length === 0) {
      reasons.push('Versão solicitada não identificada no candidato');
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
    const artistSimilarity = this.similaridadeDeArtista(identity.artist, candidate.artist);
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
