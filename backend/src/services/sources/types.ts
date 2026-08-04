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

// Estrutura bruta de um recording/release do MusicBrainz (simplificada).
export interface MusicBrainzRecording {
  id: string;
  title: string;
  'artist-credit'?: Array<{
    artist: {
      id: string;
      name: string;
      'sort-name': string;
      area?: { name: string };
    };
  }>;
  releases?: MusicBrainzRelease[];
}

export interface MusicBrainzRelease {
  id: string;
  title: string;
  status?: string;
  date?: string;
  country?: string;
  'label-info'?: Array<{
    label?: { name: string };
  }>;
  'release-group'?: {
    id: string;
    'primary-type'?: string;
    'secondary-types'?: string[];
  };
  media?: Array<{
    format?: string;
    'track-count'?: number;
  }>;
}

export interface MusicBrainzRespostaBusca {
  recordings?: MusicBrainzRecording[];
  count?: number;
  offset?: number;
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
