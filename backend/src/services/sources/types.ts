// Tipos compartilhados entre todos os adapters de fontes externas.
// Define o contrato que MusicBrainz, Discogs e futuras fontes devem seguir.

import { DadosReleaseExterno } from '../../types';

// Contrato de um adapter de fonte externa.
// Todo adapter deve implementar esta interface.
export interface AdapterFonteExterna {
  // Nome da fonte — deve corresponder exatamente ao valor na tabela metadata_sources.
  readonly nomeFonte: string;

  // Busca versões de uma obra musical pelo termo de pesquisa.
  // Retorna array de releases prontos para ingestão no banco.
  buscarPorTermo(termo: string): Promise<DadosReleaseExterno[]>;
}

// Crédito de artista do MusicBrainz (aparece em gravações, faixas e releases).
export interface MusicBrainzArtistCredit {
  name?: string;
  joinphrase?: string;
  artist: {
    id: string;
    name: string;
    'sort-name': string;
    type?: string;
    country?: string;
    area?: { name: string };
  };
}

// Estrutura bruta de um recording/release do MusicBrainz (simplificada).
export interface MusicBrainzRecording {
  id: string;
  title: string;
  'artist-credit'?: MusicBrainzArtistCredit[];
  releases?: MusicBrainzRelease[];
}

// Faixa de um release (só vem preenchida quando o browse pede `inc=recordings`).
export interface MusicBrainzFaixa {
  id?: string;
  number?: string;
  title: string;
  length?: number | null;
  'artist-credit'?: MusicBrainzArtistCredit[];
  recording?: {
    id: string;
    title: string;
    length?: number | null;
    'first-release-date'?: string;
    'artist-credit'?: MusicBrainzArtistCredit[];
  };
}

export interface MusicBrainzMidia {
  format?: string;
  'track-count'?: number;
  tracks?: MusicBrainzFaixa[];
}

export interface MusicBrainzRelease {
  id: string;
  title: string;
  status?: string;
  date?: string;
  country?: string;
  'artist-credit'?: MusicBrainzArtistCredit[];
  'label-info'?: Array<{
    label?: { name: string };
  }>;
  'release-group'?: {
    id: string;
    'primary-type'?: string;
    'secondary-types'?: string[];
  };
  media?: MusicBrainzMidia[];
}

export interface MusicBrainzRespostaBusca {
  recordings?: MusicBrainzRecording[];
  count?: number;
  offset?: number;
}

// Artista encontrado na busca por nome (usado para montar a discografia).
export interface MusicBrainzArtista {
  id: string;
  name: string;
  score?: number;
  type?: string;
  country?: string;
  area?: { name?: string };
}

export interface MusicBrainzRespostaArtista {
  artists?: MusicBrainzArtista[];
}

// Lista de releases de um artista (browse), com o total do catálogo.
export interface MusicBrainzRespostaReleases {
  releases?: MusicBrainzRelease[];
  'release-count'?: number;
}

// Estrutura bruta de um resultado do Discogs (simplificada).
export interface DiscogsResultado {
  id: number;
  title: string;
  type: string;
  year?: number;
  country?: string;
  label?: string[];
  format?: string[];
  catno?: string;
  genre?: string[];
  style?: string[];
  thumb?: string;
  cover_image?: string;
  resource_url?: string;
  uri?: string;
  master_id?: number;
  master_url?: string;
}

export interface DiscogsRespostaBusca {
  results: DiscogsResultado[];
  pagination: {
    page: number;
    pages: number;
    per_page: number;
    items: number;
  };
}
