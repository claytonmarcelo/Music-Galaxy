// Orquestrador de enriquecimento de áudio.
// Tenta obter a URL de prévia e o ID do YouTube em ordem de prioridade:
//   0. YouTube (áudio COMPLETO — busca o videoId para stream sob demanda)
//   1. Spotify (melhor preview de 30s, exige chaves no .env)
//   2. iTunes  (preview de 30s público, sem chaves)
//   3. Deezer  (preview de 30s público, sem chaves)
//
// O youtube_video_id é salvo separadamente no campo da release para que
// os endpoints /stream e /download possam servir o áudio completo.
// As demais fontes preenchem audio_preview_url como fallback quando
// o YouTube não estiver disponível.

import { YoutubeAdapter } from './youtubeAdapter';
import { SpotifyAdapter } from './spotifyAdapter';
import { ItunesAdapter } from './itunesAdapter';
import { DeezerAdapter } from './deezerAdapter';
import { DadosReleaseExterno } from '../../types';

// Instâncias únicas dos adapters (singleton por sessão)
const youtube = new YoutubeAdapter();
const spotify = new SpotifyAdapter();
const itunes  = new ItunesAdapter();
const deezer  = new DeezerAdapter();

// Cache em memória por sessão do processo Node.js.
// Chave: "artista|||titulo" em lowercase.
const cacheVideoId = new Map<string, string | null>();
const cachePreview = new Map<string, string | null>();

export async function enriquecerComAudio(releases: DadosReleaseExterno[]): Promise<void> {
  // Coleta obras únicas para minimizar chamadas externas
  const obrasParaBuscar = new Set<string>();

  for (const release of releases) {
    const chave = `${release.artist_name.toLowerCase().trim()}|||${release.work_title.toLowerCase().trim()}`;
    obrasParaBuscar.add(chave);
  }

  // Consulta fontes externas para cada obra ainda não cacheada
  for (const chave of obrasParaBuscar) {
    const [artista, titulo] = chave.split('|||');
    if (!artista || !titulo) {
      cacheVideoId.set(chave, null);
      cachePreview.set(chave, null);
      continue;
    }

    // --- FONTE 0: YouTube (áudio COMPLETO — busca videoId para stream sob demanda) ---
    if (!cacheVideoId.has(chave)) {
      const videoId = await youtube.buscarVideoId(artista, titulo);
      cacheVideoId.set(chave, videoId);
      if (videoId) {
        console.log(`[AudioEnricher] YouTube ✓ videoId="${videoId}" | "${artista} - ${titulo}"`);
      }
    }

    // --- Fontes de preview 30s (fallback quando YouTube indisponível) ---
    if (!cachePreview.has(chave)) {
      let urlPreview: string | null = null;

      // Spotify
      if (spotify.estaConfigurado) {
        urlPreview = await spotify.buscarPreviewAudio(artista, titulo);
        if (urlPreview) console.log(`[AudioEnricher] Spotify ✓ "${artista} - ${titulo}"`);
      }

      // iTunes
      if (!urlPreview) {
        urlPreview = await itunes.buscarPreviewAudio(artista, titulo);
        if (urlPreview) console.log(`[AudioEnricher] iTunes ✓ "${artista} - ${titulo}"`);
      }

      // Deezer
      if (!urlPreview) {
        urlPreview = await deezer.buscarPreviewAudio(artista, titulo);
        if (urlPreview) console.log(`[AudioEnricher] Deezer ✓ "${artista} - ${titulo}"`);
      }

      if (!urlPreview) {
        console.warn(`[AudioEnricher] Sem preview disponível para: "${artista} - ${titulo}"`);
      }

      cachePreview.set(chave, urlPreview);
    }
  }

  // Propaga os dados encontrados para todas as releases correspondentes
  for (const release of releases) {
    const chave = `${release.artist_name.toLowerCase().trim()}|||${release.work_title.toLowerCase().trim()}`;

    // Salva o videoId do YouTube (campo novo na release)
    const videoId = cacheVideoId.get(chave);
    if (videoId) {
      (release as any).youtube_video_id = videoId;
    }

    // Salva as URLs de preview como fallback
    const urlPreview = cachePreview.get(chave);
    if (urlPreview) {
      release.audio_preview_url = urlPreview;
      release.streaming_url     = urlPreview;
      release.download_url      = urlPreview;
    }
  }
}
