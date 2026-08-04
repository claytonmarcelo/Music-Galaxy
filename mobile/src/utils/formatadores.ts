// Utilitários de formatação para o Music Galaxy.
// Formatadores para datas, durações, categorias e outros valores.

// Formata uma data relativa (ex: "2h atrás", "3d atrás")
export function formatarDataRelativa(data: Date): string {
  const agora = new Date();
  const diferenca = agora.getTime() - data.getTime();

  const minutos = Math.floor(diferenca / 60000);
  const horas = Math.floor(diferenca / 3600000);
  const dias = Math.floor(diferenca / 86400000);
  const semanas = Math.floor(diferenca / 604800000);
  const meses = Math.floor(diferenca / 2592000000);
  const anos = Math.floor(diferenca / 31536000000);

  if (diferenca < 0) return 'No futuro';
  if (minutos < 1) return 'Agora';
  if (minutos < 60) return `${minutos}min atrás`;
  if (horas < 24) return `${horas}h atrás`;
  if (dias < 7) return `${dias}d atrás`;
  if (semanas < 4) return `${semanas}sem atrás`;
  if (meses < 12) return `${meses}mês atrás`;
  if (anos < 10) return `${anos}ano atrás`;

  return data.toLocaleDateString('pt-BR');
}

// Formata uma data no formato brasileiro (DD/MM/YYYY)
export function formatarDataBR(data: Date): string {
  return data.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

// Formata uma data completa com hora
export function formatarDataCompleta(data: Date): string {
  return data.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// Traduz categoria de release_type para português
export function traduzirCategoriaRelease(categoria: string): string {
  const traducoes: Record<string, string> = {
    release_format: 'Formato de Lançamento',
    mix_edit: 'Edição / Remix',
    instrumental: 'Instrumental',
    playback: 'Playback',
  };

  return traducoes[categoria] || categoria;
}

// Formata nome de release_type para display humanizado
export function humanizarReleaseType(tipo: string): string {
  // Converte snake_case para Title Case
  return tipo
    .split('_')
    .map(palavra => palavra.charAt(0).toUpperCase() + palavra.slice(1).toLowerCase())
    .join(' ');
}

// Formata ano de lançamento
export function formatarAno(ano: number | null | undefined): string {
  if (!ano) return 'Ano desconhecido';
  return `${ano}`;
}

// Formata país com emoji apropriado
export function formatarPais(pais: string | null | undefined): string {
  if (!pais) return '🌍 País desconhecido';

  const paisEmoji: Record<string, string> = {
    'US': '🇺🇸',
    'GB': '🇬🇧',
    'BR': '🇧🇷',
    'FR': '🇫🇷',
    'DE': '🇩🇪',
    'JP': '🇯🇵',
    'CA': '🇨🇦',
    'AU': '🇦🇺',
    'NZ': '🇳🇿',
    'SG': '🇸🇬',
  };

  const emoji = paisEmoji[pais.toUpperCase()] || '🌍';
  return `${emoji} ${pais}`;
}

// Formata gravadora/label
export function formatarGravadora(gravadora: string | null | undefined): string {
  if (!gravadora) return 'Label desconhecida';
  return gravadora;
}

// Formata qualidade de áudio
export function formatarQualidade(qualidade: string | null | undefined): string {
  if (!qualidade) return 'Qualidade não especificada';

  const qualidadeFormatada: Record<string, string> = {
    '320kbps': '320 kbps (MP3 Premium)',
    '192kbps': '192 kbps (MP3)',
    '128kbps': '128 kbps (MP3 Básico)',
    'flac': 'FLAC (Lossless)',
    'wav': 'WAV (Lossless)',
    'aac': 'AAC',
    'ogg': 'OGG Vorbis',
  };

  return qualidadeFormatada[qualidade.toLowerCase()] || qualidade;
}

// Trunca texto com reticências
export function truncarTexto(texto: string, maxCaracteres: number = 50): string {
  if (texto.length <= maxCaracteres) return texto;
  return texto.substring(0, maxCaracteres) + '...';
}

// Conta obras únicas em um array de releases
export function contarObrasUnicas(releases: Array<{ work_title: string }>): number {
  const obras = new Set(releases.map(r => r.work_title));
  return obras.size;
}

// Conta artistas únicos em um array de releases
export function contarArtistasUnicos(releases: Array<{ artist_name: string }>): number {
  const artistas = new Set(releases.map(r => r.artist_name));
  return artistas.size;
}

// Agrupa releases por decade
export function agruparPorDecada(
  releases: Array<{ release_year: number | null }>
): Record<string, number> {
  const grupos: Record<string, number> = {};

  releases.forEach(rel => {
    if (!rel.release_year) {
      grupos['Desconhecido'] = (grupos['Desconhecido'] || 0) + 1;
      return;
    }

    const decada = Math.floor(rel.release_year / 10) * 10;
    const label = `${decada}s`;
    grupos[label] = (grupos[label] || 0) + 1;
  });

  return grupos;
}

// Formata número com separador de milhar
export function formatarNumero(numero: number): string {
  return numero.toLocaleString('pt-BR');
}

// Gera resumo de estatísticas para display
export function gerarResumoEstatisticas(data: {
  totalFavoritos: number;
  artistasUnicos: number;
  obrasUnicas: number;
  tiposRelease: Set<string>;
}): string {
  return `${data.totalFavoritos} favoritos • ${data.artistasUnicos} artistas • ${data.obrasUnicas} obras`;
}

// Formata URL de referência para display
export function formatarURLReferencia(url: string | null | undefined): string {
  if (!url) return 'Sem referência';
  try {
    const urlObj = new URL(url);
    return urlObj.hostname;
  } catch {
    return 'Link';
  }
}
