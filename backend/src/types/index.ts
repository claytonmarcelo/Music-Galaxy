// Tipos centrais do Music Galaxy.
// Refletem exatamente o schema do banco de dados e os contratos da API.

// ============================================================
// Entidades do banco de dados
// ============================================================

export interface Artist {
  id: number;
  name: string;
  country: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface Work {
  id: number;
  title: string;
  artist_id: number;
  original_release_year: number | null;
  created_at: Date;
  updated_at: Date;
}

export interface ReleaseType {
  id: number;
  name: string;
  category: 'release_format' | 'mix_edit' | 'instrumental' | 'playback';
}

export interface MetadataSource {
  id: number;
  name: string;
  base_url: string | null;
  created_at: Date;
}

export interface Release {
  id: number;
  work_id: number;
  release_type_id: number;
  version_name: string;
  album_name: string | null;
  release_year: number | null;
  label: string | null;
  country: string | null;
  quality: string | null;
  cover_url: string | null;
  metadata_source_id: number;
  source_reference_url: string | null;
  external_id: string | null;
  created_at: Date;
  updated_at: Date;
}

// ============================================================
// Resposta da API — release enriquecido com dados das tabelas relacionadas
// ============================================================

export interface ReleaseCompleto {
  id: number;
  work_id: number;
  version_name: string;
  album_name: string | null;
  release_year: number | null;
  label: string | null;
  country: string | null;
  quality: string | null;
  // Regra 1: cover_url é null quando não há capa oficial disponível na fonte
  cover_url: string | null;
  release_type: string;
  release_type_category: string;
  metadata_source: string;
  source_reference_url: string | null;
  // Fonte de áudio aberta resolvida (Regra 3). null = versão ainda sem áudio;
  // nesse caso a busca NÃO a exibe no app (regra do usuário).
  audio_source_url: string | null;
  // URLs de mídia - null quando não disponível
  audio_preview_url: string | null;
  streaming_url: string | null;
  download_url: string | null;
  // Dados da obra
  work_title: string;
  artist_name: string;
  artist_country: string | null;
  original_release_year: number | null;
}

// ============================================================
// Formato padrão de resposta da API
// ============================================================

export interface RespostaApi<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface RespostaPaginada<T> {
  success: boolean;
  data: {
    results: T[];
    total: number;
    page: number;
    per_page: number;
    fromCache: boolean;
    // Quantidade de versões do termo que ainda estão SEM fonte de áudio
    // resolvida. Elas ficam fora de `results` (regra do usuário) enquanto a
    // resolução em segundo plano procura a fonte em sites abertos.
    pendentes_audio?: number;
  };
}

// ============================================================
// Tipos para o sistema de ingestão de fontes externas
// ============================================================

export interface DadosReleaseExterno {
  artist_name: string;
  work_title: string;
  artist_country?: string | null;
  original_release_year?: number | null;
  version_name: string;
  album_name?: string | null;
  release_year?: number | null;
  label?: string | null;
  country?: string | null;
  quality?: string | null;
  // Regra 1: só preencher quando a fonte realmente disponibiliza a capa oficial
  cover_url?: string | null;
  release_type_name: string;
  source_reference_url?: string | null;
  external_id: string;
  metadata_source_name: string;
  // URLs de mídia - null quando não disponível
  audio_preview_url?: string | null;
  streaming_url?: string | null;
  download_url?: string | null;
}

// ============================================================
// Tipos para o cache de API externa
// ============================================================

export interface EntradaCache {
  id: number;
  metadata_source_id: number;
  request_key: string;
  response_body: string;
  fetched_at: Date;
  expires_at: Date;
}

// ============================================================
// Tipos para o log de ingestão
// ============================================================

export type TipoRequisicaoIngestion = 'search' | 'work_detail' | 'release_detail' | 'cover_art';
export type StatusIngestion = 'success' | 'not_found' | 'error' | 'rate_limited';

export interface ParametrosLogIngestion {
  metadata_source_id: number;
  request_type: TipoRequisicaoIngestion;
  request_query: string;
  status: StatusIngestion;
  error_message?: string;
  works_created?: number;
  releases_created?: number;
}
