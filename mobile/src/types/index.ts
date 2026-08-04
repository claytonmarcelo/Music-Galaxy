// Tipos TypeScript do app mobile Music Galaxy.
// Espelham os contratos de resposta da API backend.

// ============================================================
// Entidade principal: Release com dados enriquecidos
// ============================================================

export interface Release {
  id: number;
  work_id: number;
  version_name: string;
  album_name: string | null;
  release_year: number | null;
  label: string | null;
  country: string | null;
  quality: string | null;
  // null = sem capa oficial disponível (Regra 1: nunca inventar capa)
  cover_url: string | null;
  release_type: string;
  release_type_category: 'release_format' | 'mix_edit' | 'instrumental' | 'playback';
  metadata_source: string;
  source_reference_url: string | null;
  work_title: string;
  artist_name: string;
  artist_country: string | null;
  original_release_year: number | null;
}

// ============================================================
// Resposta paginada da API de busca
// ============================================================

export interface RespostaBusca {
  success: boolean;
  data: {
    results: Release[];
    total: number;
    page: number;
    per_page: number;
    fromCache: boolean;
  };
}

export interface RespostaErro {
  success: false;
  error: string;
  message?: string;
}

// ============================================================
// Parâmetros de navegação
// ============================================================

export type RootStackParamList = {
  Busca: undefined;
  DetalheRelease: { release: Release };
};
