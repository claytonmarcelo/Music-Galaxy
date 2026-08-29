// Tipos para o sistema de AudioSourceProvider
// Define a interface abstrata para fontes de áudio e os tipos de dados utilizados

// Identidade musical para busca
export interface AudioIdentity {
  artist: string;
  title: string;
  album?: string;
  version?: string;
  duration?: number; // em segundos
  isrc?: string;
  catalogNumber?: string;
}

// Candidato encontrado por um provider
export interface AudioCandidate {
  providerId: string;
  sourceId: string; // ID interno do provider (ex: video ID do YouTube)
  artist: string;
  title: string;
  album?: string;
  version?: string;
  duration?: number;
  format?: string;
  quality?: string;
  bitrate?: number;
  sampleRate?: number;
  bitDepth?: number;
  channels?: number;
  url?: string;
  downloadUrl?: string;
  streamUrl?: string;
  metadata: Record<string, any>;
}

// Resultado da busca de um provider
export interface SearchResult {
  providerId: string;
  candidates: AudioCandidate[];
  status: 'SUCCESS' | 'FAILED' | 'TIMEOUT' | 'RATE_LIMITED' | 'FORBIDDEN';
  error?: string;
  durationMs: number;
}

// Classificação de correspondência
export enum MatchClassification {
  EXACT_MATCH = 'EXACT_MATCH',
  PROBABLE_MATCH = 'PROBABLE_MATCH',
  REJECTED = 'REJECTED',
}

// Pontuação de um candidato
export interface CandidateScore {
  candidate: AudioCandidate;
  classification: MatchClassification;
  score: number; // 0-100
  reasons: string[];
}

// Configuração de timeout por operação
export interface ProviderTimeouts {
  search: number; // em ms
  metadata: number; // em ms
  download: number; // em ms
}

// Interface abstrata para providers de áudio
export interface IAudioSourceProvider {
  // Identificador único do provider
  readonly providerId: string;
  
  // Configurações de timeout
  readonly timeouts: ProviderTimeouts;
  
  // Buscar candidatos com base na identidade musical
  search(identity: AudioIdentity): Promise<SearchResult>;
  
  // Obter metadados detalhados de um candidato
  getMetadata(candidateId: string): Promise<AudioCandidate | null>;
  
  // Obter informações de download
  getDownloadInfo(candidateId: string): Promise<{ url: string; format: string } | null>;
  
  // Verificar disponibilidade de um candidato
  checkAvailability(candidateId: string): Promise<boolean>;
}

// Erro classificado do provider
export interface ProviderError {
  providerId: string;
  operation: 'search' | 'metadata' | 'download' | 'availability';
  type: 'UNAVAILABLE' | 'TIMEOUT' | 'RATE_LIMITED' | 'FORBIDDEN' | 'EXTRACTION_FAILED' | 'INTERNAL_ERROR';
  message: string;
  retryable: boolean;
}
