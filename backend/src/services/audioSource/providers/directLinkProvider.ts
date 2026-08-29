// Direct Link Provider — Aceita URLs diretas de áudio fornecidas pelo usuário
// Permite download de áudio de qualquer URL pública (MP3, FLAC, etc)

import { BaseAudioSourceProvider } from '../baseProvider';
import {
  AudioIdentity,
  SearchResult,
  AudioCandidate,
  ProviderTimeouts,
} from '../types';
import axios from 'axios';

export class DirectLinkProvider extends BaseAudioSourceProvider {
  readonly providerId = 'direct-link';
  readonly timeouts: ProviderTimeouts = {
    search: 5000,       // 5 segundos (não usado, busca é direta)
    metadata: 10000,    // 10 segundos para metadados
    download: 600000,   // 10 minutos para download (arquivos grandes)
  };

  // User agent para evitar bloqueios
  private readonly USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

  // Extensões de áudio suportadas
  private readonly AUDIO_EXTENSIONS = [
    '.mp3', '.flac', '.wav', '.m4a', '.aac', '.ogg', '.wma', '.opus', '.webm'
  ];

  // Buscar não é aplicável para este provider (URL é fornecida diretamente)
  async search(identity: AudioIdentity): Promise<SearchResult> {
    console.warn(`[DirectLinkProvider] Search not applicable. Use direct URL instead.`);
    
    return {
      providerId: this.providerId,
      candidates: [],
      status: 'FAILED',
      error: 'DirectLinkProvider requires a direct URL. Use searchInUrl() method instead.',
      durationMs: 0,
    };
  }

  // Buscar candidato a partir de uma URL direta
  async searchInUrl(url: string): Promise<SearchResult> {
    const startTime = Date.now();

    try {
      console.log(`[DirectLinkProvider] Processing direct URL: ${url}`);

      // Validar URL
      if (!this.isValidAudioUrl(url)) {
        return {
          providerId: this.providerId,
          candidates: [],
          status: 'FAILED',
          error: 'Invalid audio URL. Supported formats: MP3, FLAC, WAV, M4A, AAC, OGG, WMA, Opus, WebM',
          durationMs: Date.now() - startTime,
        };
      }

      // Obter metadados via HEAD request
      const metadata = await this.getMetadata(url);
      
      if (!metadata) {
        return {
          providerId: this.providerId,
          candidates: [],
          status: 'FAILED',
          error: 'Failed to retrieve metadata. URL may be unavailable or blocked.',
          durationMs: Date.now() - startTime,
        };
      }

      console.log(`[DirectLinkProvider] URL processed successfully: ${metadata.format} ${metadata.metadata?.size}`);

      return {
        providerId: this.providerId,
        candidates: [metadata],
        status: 'SUCCESS',
        durationMs: Date.now() - startTime,
      };
    } catch (error: any) {
      const durationMs = Date.now() - startTime;
      console.error(`[DirectLinkProvider] Direct URL processing failed:`, error.message);

      let status: SearchResult['status'] = 'FAILED';
      if (error.code === 'ECONNABORTED' || error.message.includes('Timeout')) {
        status = 'TIMEOUT';
      } else if (error.response?.status === 403) {
        status = 'FORBIDDEN';
      } else if (error.response?.status === 404) {
        status = 'FAILED';
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

  // Validar se uma URL é um link de áudio válido
  private isValidAudioUrl(url: string): boolean {
    // Deve ser HTTP ou HTTPS
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      return false;
    }

    // Deve ter uma extensão de áudio válida
    const lowerUrl = url.toLowerCase();
    const hasValidExtension = this.AUDIO_EXTENSIONS.some(ext => 
      lowerUrl.includes(ext)
    );

    return hasValidExtension;
  }

  // Obter metadados de uma URL (HEAD request)
  async getMetadata(candidateId: string): Promise<AudioCandidate | null> {
    try {
      const url = candidateId;

      console.log(`[DirectLinkProvider] Getting metadata for: ${url}`);

      const response = await axios.head(url, {
        headers: {
          'User-Agent': this.USER_AGENT,
          'Accept': '*/*',
        },
        timeout: this.timeouts.metadata,
        maxRedirects: 5,
        validateStatus: (status) => status < 500, // Aceitar 4xx para verificar disponibilidade
      });

      // Se retornar 404 ou 403, não está disponível
      if (response.status === 404 || response.status === 403) {
        console.warn(`[DirectLinkProvider] URL not available: ${response.status}`);
        return null;
      }

      const contentType = (response.headers['content-type'] as string) || '';
      const contentLength = response.headers['content-length'] as string | undefined;
      const contentLengthNum = contentLength ? parseInt(contentLength) : undefined;

      // Extrair formato do content-type ou da URL
      const format = this.extractFormatFromType(contentType) || this.extractFormatFromUrl(url);

      // Extrair nome do arquivo da URL
      const fileName = this.extractFileName(url);

      return {
        providerId: this.providerId,
        sourceId: url,
        artist: '', // Será preenchido pelo exact match
        title: fileName || '', // Usa nome do arquivo como título inicial
        url,
        downloadUrl: url,
        format,
        metadata: {
          contentType,
          contentLength: contentLengthNum,
          size: contentLengthNum ? this.formatBytes(contentLengthNum) : undefined,
          fileName,
        },
      };
    } catch (error: any) {
      console.error(`[DirectLinkProvider] Metadata failed for ${candidateId}:`, error.message);
      return null;
    }
  }

  // Obter informações de download
  async getDownloadInfo(candidateId: string): Promise<{ url: string; format: string } | null> {
    const metadata = await this.getMetadata(candidateId);
    if (!metadata) return null;

    return {
      url: metadata.url || candidateId,
      format: metadata.format || 'mp3',
    };
  }

  // Verificar disponibilidade de uma URL
  async checkAvailability(candidateId: string): Promise<boolean> {
    try {
      const metadata = await this.getMetadata(candidateId);
      return metadata !== null;
    } catch {
      return false;
    }
  }

  // Extrair formato do MIME type
  private extractFormatFromType(mimeType: string): string | undefined {
    const typeMap: Record<string, string> = {
      'audio/mpeg': 'mp3',
      'audio/mp3': 'mp3',
      'audio/flac': 'flac',
      'audio/x-flac': 'flac',
      'audio/wav': 'wav',
      'audio/x-wav': 'wav',
      'audio/mp4': 'm4a',
      'audio/x-m4a': 'm4a',
      'audio/aac': 'aac',
      'audio/ogg': 'ogg',
      'audio/webm': 'webm',
      'audio/opus': 'opus',
      'audio/x-ms-wma': 'wma',
    };

    return typeMap[mimeType.toLowerCase()];
  }

  // Extrair formato da URL
  private extractFormatFromUrl(url: string): string | undefined {
    const lowerUrl = url.toLowerCase();
    
    for (const ext of this.AUDIO_EXTENSIONS) {
      if (lowerUrl.includes(ext)) {
        return ext.replace('.', '');
      }
    }

    return undefined;
  }

  // Extrair nome do arquivo da URL
  private extractFileName(url: string): string {
    try {
      const urlObj = new URL(url);
      const pathname = urlObj.pathname;
      const fileName = pathname.split('/').pop();
      
      if (fileName) {
        // Remover extensão
        return fileName.replace(/\.[^/.]+$/, '');
      }
      
      return '';
    } catch {
      return '';
    }
  }

  // Formatar bytes para legível
  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
  }
}
