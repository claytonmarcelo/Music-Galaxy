// YouTube Provider — Implementação concreta para YouTube
// Usa yt-dlp para buscar e obter informações de áudio do YouTube

import { BaseAudioSourceProvider } from '../baseProvider';
import {
  AudioIdentity,
  SearchResult,
  AudioCandidate,
  ProviderTimeouts,
  ProviderError,
} from '../types';
import { youtubeDl } from 'youtube-dl-exec';
import ffmpegPath from 'ffmpeg-static';
import ffmpeg from 'fluent-ffmpeg';

export class YouTubeProvider extends BaseAudioSourceProvider {
  readonly providerId = 'youtube';
  readonly timeouts: ProviderTimeouts = {
    search: 30000,      // 30 segundos para busca
    metadata: 15000,    // 15 segundos para metadados
    download: 300000,   // 5 minutos para download (será usado pelo orquestrador)
  };

  // Buscar vídeos no YouTube
  async search(identity: AudioIdentity): Promise<SearchResult> {
    const startTime = Date.now();
    const normalizedIdentity = this.normalizeIdentity(identity);

    try {
      console.log(`[YouTubeProvider] Searching: artist="${normalizedIdentity.artist}" title="${normalizedIdentity.title}"`);

      // Construir query de busca
      const query = `${normalizedIdentity.artist} ${normalizedIdentity.title}`;
      
      // Usar yt-dlp para buscar
      const output = await this.withTimeout(
        youtubeDl(`ytsearch10:${query}`, {
          dumpJson: true,
          noWarnings: true,
          noCheckCertificates: true,
          userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        }),
        this.timeouts.search,
        'YouTube search timeout'
      );

 const results = Array.isArray(output) ? output : [output];
      
      const candidates: AudioCandidate[] = results
        .filter((video: any) => video && typeof video === 'object' && video.id && video.title)
        .map((video: any) => this.parseVideoToCandidate(video, identity));

      console.log(`[YouTubeProvider] Search completed: ${candidates.length} candidates found`);

      return {
        providerId: this.providerId,
        candidates,
        status: 'SUCCESS',
        durationMs: Date.now() - startTime,
      };
    } catch (error: any) {
      const durationMs = Date.now() - startTime;
      console.error(`[YouTubeProvider] Search failed:`, error.message);

      // Classificar erro
      let status: SearchResult['status'] = 'FAILED';
      if (error.message.includes('Timeout')) {
        status = 'TIMEOUT';
      } else if (error.message.includes('HTTP Error 429')) {
        status = 'RATE_LIMITED';
      } else if (error.message.includes('HTTP Error 403')) {
        status = 'FORBIDDEN';
      }

      return {
        providerId: this.providerId,
        candidates: [],
        status,
        error: error.message,
        durationMs,
      };
    }
  }

  // Converter resultado do yt-dlp para AudioCandidate
  private parseVideoToCandidate(video: any, identity: AudioIdentity): AudioCandidate {
    return {
      providerId: this.providerId,
      sourceId: video.id,
      artist: video.uploader || video.channel || '',
      title: video.title || '',
      album: video.album || undefined,
      version: this.extractVersionFromTitle(video.title),
      duration: video.duration,
      format: video.ext || undefined,
      quality: video.format || video.quality || undefined,
      bitrate: video.bitrate || video.abr || undefined,
      sampleRate: video.asr || undefined,
      url: video.webpage_url || video.url || undefined,
      metadata: {
        viewCount: video.view_count,
        uploadDate: video.upload_date,
        thumbnail: video.thumbnail,
      },
    };
  }

  // Extrair versão do título (Remix, Live, etc)
  private extractVersionFromTitle(title: string): string | undefined {
    const versionPatterns = [
      /\(.*Remix.*\)/i,
      /\(.*Extended.*\)/i,
      /\(.*Radio Edit.*\)/i,
      /\(.*Live.*\)/i,
      /\(.*Instrumental.*\)/i,
      /\(.*Acapella.*\)/i,
      /\(.*Club Mix.*\)/i,
      /\(.*Dub.*\)/i,
      /- Remix/i,
      /- Extended/i,
      /- Radio Edit/i,
      /- Live/i,
      /- Instrumental/i,
    ];

    for (const pattern of versionPatterns) {
      const match = title.match(pattern);
      if (match) {
        return match[0].replace(/[()]/g, '').trim();
      }
    }

    return undefined;
  }

  // Obter metadados detalhados de um vídeo
  async getMetadata(candidateId: string): Promise<AudioCandidate | null> {
    try {
      console.log(`[YouTubeProvider] Getting metadata for: ${candidateId}`);

      const output = await this.withTimeout(
        youtubeDl(`https://www.youtube.com/watch?v=${candidateId}`, {
          dumpJson: true,
          noWarnings: true,
          noCheckCertificates: true,
        }),
        this.timeouts.metadata,
        'YouTube metadata timeout'
      );

      if (!output || typeof output !== 'object' || !('id' in output)) {
        return null;
      }

      const video = output as any;
      return this.parseVideoToCandidate(video, {
        artist: video.uploader || '',
        title: video.title || '',
      });
    } catch (error: any) {
      console.error(`[YouTubeProvider] Metadata failed for ${candidateId}:`, error.message);
      return null;
    }
  }

  // Obter informações de download
  async getDownloadInfo(candidateId: string): Promise<{ url: string; format: string } | null> {
    try {
      console.log(`[YouTubeProvider] Getting download info for: ${candidateId}`);

      const url = `https://www.youtube.com/watch?v=${candidateId}`;
      
      // Obter formatos disponíveis
      const output = await this.withTimeout(
        youtubeDl(url, {
          listFormats: true,
          noWarnings: true,
          noCheckCertificates: true,
        }),
        this.timeouts.metadata,
        'YouTube format list timeout'
      );

      // Analisar formatos e selecionar o melhor
      // Para simplificar, retornamos a URL e deixamos o orquestrador decidir o formato
      return {
        url,
        format: 'bestaudio', // Será resolvido pelo yt-dlp durante download
      };
    } catch (error: any) {
      console.error(`[YouTubeProvider] Download info failed for ${candidateId}:`, error.message);
      return null;
    }
  }

  // Verificar disponibilidade de um vídeo
  async checkAvailability(candidateId: string): Promise<boolean> {
    try {
      console.log(`[YouTubeProvider] Checking availability for: ${candidateId}`);

      const output = await this.withTimeout(
        youtubeDl(`https://www.youtube.com/watch?v=${candidateId}`, {
          dumpSingleJson: true,
          noWarnings: true,
          noCheckCertificates: true,
          skipDownload: true,
        }),
        this.timeouts.metadata,
        'YouTube availability check timeout'
      );

      if (!output || typeof output !== 'object' || !('id' in output)) {
        return false;
      }

      const video = output as any;
      return !!(video.id && !video.live);
    } catch (error: any) {
      console.error(`[YouTubeProvider] Availability check failed for ${candidateId}:`, error.message);
      return false;
    }
  }

  // Obter duração real do arquivo usando ffprobe
  async getRealDuration(candidateId: string): Promise<number | null> {
    try {
      // Primeiro baixar apenas os primeiros segundos para verificar duração
      const tempDir = require('path').join(__dirname, '../../../temp/audio');
      const tempFile = require('path').join(tempDir, `duration_check_${candidateId}.m4a`);

      await this.withTimeout(
        youtubeDl(`https://www.youtube.com/watch?v=${candidateId}`, {
          format: 'bestaudio[ext=m4a]',
          noPlaylist: true,
          ffmpegLocation: ffmpegPath || undefined,
          output: tempFile,
          noWarnings: true,
          noCheckCertificates: true,
          downloadSections: '*0-30', // Baixar apenas os primeiros 30 segundos
        }),
        60000, // 1 minuto
        'YouTube duration check download timeout'
      );

      // Usar ffprobe para obter duração
      return new Promise((resolve, reject) => {
        ffmpeg(tempFile)
          .setFfmpegPath(ffmpegPath || 'ffmpeg')
          .ffprobe((err, metadata) => {
            // Limpar arquivo temporário
            require('fs').unlink(tempFile, () => {});

            if (err) {
              reject(err);
              return;
            }

            const duration = metadata.format?.duration;
            resolve(duration ? Math.round(duration) : null);
          });
      });
    } catch (error) {
      console.error(`[YouTubeProvider] Real duration check failed for ${candidateId}:`, error);
      return null;
    }
  }
}
