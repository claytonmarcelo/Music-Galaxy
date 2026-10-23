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
  // Campos de mídia legados (Regra 3): sempre null — o áudio agora vem
  // exclusivamente de fontes web abertas via /api/releases/:id/stream|download
  audio_preview_url: string | null;
  streaming_url: string | null;
  download_url: string | null;
  // Fonte de áudio aberta salva pelo orquestrador (blog/fórum/link direto, Regra 3)
  audio_source_url?: string | null;
  audio_source_provider?: string | null;
  audio_source_page_url?: string | null;
  work_title: string;
  // Opcional porque favoritos antigos salvos no aparelho podem não ter o campo.
  artist_id?: number;
  artist_name: string;
  artist_country: string | null;
  original_release_year: number | null;
  // Ano efetivo calculado pelo backend (obra ou versão mais antiga)
  effective_year?: number | null;
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
    // Versões do termo que ainda não têm fonte de áudio: ficam fora de
    // `results` enquanto a resolução em segundo plano procura a fonte
    pendentes_audio?: number;
  };
}

export interface RespostaErro {
  success: false;
  error: string;
  message?: string;
}

// ============================================================
// Obra Musical (conceitual, independente de versões)
// ============================================================

export interface Work {
  id: number;
  title: string;
  original_release_year: number | null;
  effective_year?: number | null;
  created_at: string;
  artist: {
    id: number;
    name: string;
    country: string | null;
  };
}

// Resposta do endpoint GET /api/works/:id
export interface RespostaWork {
  success: boolean;
  data: Work;
}

// Resposta do endpoint GET /api/works/:id/releases
export interface RespostaReleasesDeWork {
  success: boolean;
  data: {
    work: {
      id: number;
      title: string;
      original_release_year: number | null;
      effective_year?: number | null;
      artist: {
        id: number;
        name: string;
        country: string | null;
      };
    };
    results: Release[];
    total: number;
    limit: number;
    offset: number;
  };
}

// ============================================================
// Artista com seus dados básicos
// ============================================================

export interface Artista {
  id: number;
  name: string;
  country: string | null;
  created_at: string;
}

// Resposta do endpoint GET /api/artists/:id
export interface RespostaArtista {
  success: boolean;
  data: Artista;
}

// Resposta do endpoint GET /api/artists/:id/works
export interface RespostaObrasArtista {
  success: boolean;
  data: {
    artist: Artista;
    results: Work[];
    total: number;
    limit: number;
    offset: number;
  };
}

// ============================================================
// Ingestão manual (endpoint administrativo)
// ============================================================

export interface ResultadoIngestao {
  works_created?: number;
  releases_created?: number;
  metadata_source?: string;
  timestamp?: string;
}

// ============================================================
// Reconhecimento sonoro
// ============================================================
// Contrato espelhado do backend (POST /api/recognize). O campo
// `confidence` só aparece quando o serviço de reconhecimento devolveu uma
// medida documentada — o aplicativo nunca estima confiança.

export type RecognitionStatus =
  | 'matched'
  | 'no_match'
  | 'permission_denied'
  | 'microphone_unavailable'
  | 'network_error'
  | 'provider_error'
  | 'cancelled';

export interface RecognitionResult {
  status: RecognitionStatus;
  title?: string;
  artist?: string;
  album?: string;
  releaseYear?: number;
  provider?: string;
  confidence?: number;
}

export interface RespostaReconhecimento {
  success: boolean;
  error?: string;
  data?: RecognitionResult;
}

// ============================================================
// Parâmetros de navegação
// ============================================================

export type RootStackParamList = {
  // Telas principais (abas da barra de navegação inferior)
  Busca: undefined;
  Biblioteca: undefined;
  Explorar: undefined;
  Favoritos: undefined;
  Settings: undefined;

  // Fila de downloads (acessível pelo cabeçalho da busca e por Ajustes)
  FilaDownloads: undefined;

  // Manual de uso do aplicativo (aberto pelos Ajustes)
  Manual: undefined;

  // Playlist local (aberta pela Biblioteca)
  DetalhePlaylist: { playlistId: string };

  // Telas de detalhe (compartilhadas por múltiplas stacks)
  DetalheRelease: { release: Release };
  DetalheWork: { workId: number };
  DetalheArtista: { artistaId: number };

  // Admin
  AdminIngestao: undefined;
};
