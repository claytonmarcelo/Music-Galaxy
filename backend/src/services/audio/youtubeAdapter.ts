// Adapter para o YouTube.
// Usa @distube/ytdl-core para buscar vídeos no YouTube e retornar stream de áudio completo.
// O ID do vídeo é salvo no banco — a URL de stream é resolvida sob demanda (não expira no banco).

import ytdl from '@distube/ytdl-core';
import ytSearch from 'yt-search';

// Termos adicionados na busca para priorizar áudio oficial
const SUFIXOS_BUSCA = ['official audio', 'audio oficial', 'full song', 'música completa'];

export class YoutubeAdapter {
  readonly nomeFonte = 'YouTube';

  // Busca o ID do vídeo mais relevante no YouTube para o artista e título.
  async buscarVideoId(artista: string, titulo: string): Promise<string | null> {
    for (const sufixo of SUFIXOS_BUSCA) {
      try {
        const termo = `${artista} ${titulo} ${sufixo}`;
        const resultados = await ytSearch(termo);

        if (resultados && resultados.videos.length > 0) {
          // Prefere vídeos de duração acima de 2 minutos (evita teasers/clipes curtos)
          for (const video of resultados.videos) {
            const duracao = video.duration.seconds;
            if (duracao >= 120) {
              console.log(`[YouTube] Encontrado: "${video.title}" (${duracao}s) para "${artista} - ${titulo}"`);
              return video.videoId;
            }
          }
          // Se nenhum passou do filtro, usa o primeiro resultado mesmo assim
          const primeiro = resultados.videos[0];
          if (primeiro?.videoId) {
            console.log(`[YouTube] Fallback sem filtro de duração: "${primeiro.title}" para "${artista} - ${titulo}"`);
            return primeiro.videoId;
          }
        }
      } catch (err) {
        console.warn(`[YouTube] Tentativa com sufixo "${sufixo}" falhou:`, err instanceof Error ? err.message : String(err));
        // Tenta o próximo sufixo
      }
    }

    console.warn(`[YouTube] Nenhum resultado encontrado para: "${artista} - ${titulo}"`);
    return null;
  }

  // Obtém o stream de áudio de um vídeo do YouTube em alta qualidade.
  // Retorna um readable stream de áudio — deve ser piped diretamente na resposta HTTP.
  obterStreamAudio(videoId: string): ReturnType<typeof ytdl> {
    const url = `https://www.youtube.com/watch?v=${videoId}`;
    return ytdl(url, {
      filter: 'audioonly',
      quality: 'highestaudio',
      requestOptions: {
        headers: {
          // Cabeçalho necessário para simular um navegador e evitar bloqueios
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
        },
      },
    });
  }

  // Verifica se um videoId ainda é válido e está disponível.
  async verificarDisponibilidade(videoId: string): Promise<boolean> {
    try {
      const url = `https://www.youtube.com/watch?v=${videoId}`;
      const info = await ytdl.getBasicInfo(url);
      return !!info.videoDetails.title;
    } catch {
      return false;
    }
  }
}
