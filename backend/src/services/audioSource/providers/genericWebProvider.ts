// Generic Web Provider — Busca links de áudio em páginas HTML
// Implementa crawling básico para encontrar áudio em sites, blogs, homepages, etc

import { BaseAudioSourceProvider } from '../baseProvider';
import {
  AudioIdentity,
  SearchResult,
  AudioCandidate,
  ProviderTimeouts,
} from '../types';
import axios from 'axios';
import * as cheerio from 'cheerio';

export class GenericWebProvider extends BaseAudioSourceProvider {
  readonly providerId = 'generic-web';
  readonly timeouts: ProviderTimeouts = {
    search: 15000,      // 15 segundos para busca
    metadata: 10000,    // 10 segundos para metadados
    download: 300000,   // 5 minutos para download
  };

  // Extensões de áudio suportadas
  private readonly AUDIO_EXTENSIONS = [
    '.mp3', '.flac', '.wav', '.m4a', '.aac', '.ogg', '.wma', '.opus', '.webm'
  ];

  // User agent para evitar bloqueios
  private readonly USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

  // Buscar candidatos em uma página HTML
  async search(identity: AudioIdentity): Promise<SearchResult> {
    const startTime = Date.now();
    const normalizedIdentity = this.normalizeIdentity(identity);

    try {
      console.log(`[GenericWebProvider] Searching: artist="${normalizedIdentity.artist}" title="${normalizedIdentity.title}"`);

      // Construir query de busca para Google/Bing (limitado por termos de serviço)
      // Na prática, isso seria implementado com uma API de busca real
      // Por enquanto, vamos simular com uma busca genérica
      
      // NOTA: Implementação real de web scraping de motores de busca viola termos de serviço
      // Esta é uma implementação conceitual que aceita URLs diretas ou usa fontes específicas
      
      console.warn(`[GenericWebProvider] Web scraping de motores de busca não implementado por questões de ToS`);
      
      return {
        providerId: this.providerId,
        candidates: [],
        status: 'FAILED',
        error: 'Web scraping de motores de busca não implementado por questões de ToS. Use DirectLinkProvider para URLs diretas.',
        durationMs: Date.now() - startTime,
      };
    } catch (error: any) {
      const durationMs = Date.now() - startTime;
      console.error(`[GenericWebProvider] Search failed:`, error.message);

      let status: SearchResult['status'] = 'FAILED';
      if (error.message.includes('Timeout')) {
        status = 'TIMEOUT';
      } else if (error.code === 'ECONNREFUSED') {
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

  // Buscar links de áudio em uma URL específica (página HTML)
  async searchInUrl(url: string): Promise<SearchResult> {
    const startTime = Date.now();

    try {
      console.log(`[GenericWebProvider] Searching in URL: ${url}`);

      // Fazer requisição HTTP para obter o HTML
      const response = await this.withTimeout(
        axios.get(url, {
          headers: {
            'User-Agent': this.USER_AGENT,
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
          },
          timeout: this.timeouts.search,
        }),
        this.timeouts.search,
        'GenericWebProvider HTTP request timeout'
      );

      const html = response.data;
      const $ = cheerio.load(html);

      const candidates: AudioCandidate[] = [];

      // Buscar links de áudio em tags <a>
      $('a[href]').each((_, element) => {
        const href = $(element).attr('href');
        if (!href) return;

        // Verificar se é um link de áudio
        const isAudioLink = this.AUDIO_EXTENSIONS.some(ext => 
          href.toLowerCase().includes(ext)
        );

        if (isAudioLink && this.isValidAudioUrl(href)) {
          // Resolver URL relativa
          const absoluteUrl = this.resolveUrl(href, url);

          candidates.push({
            providerId: this.providerId,
            sourceId: this.generateSourceId(absoluteUrl),
            artist: '', // Será preenchido pelo exact match
            title: '', // Será preenchido pelo exact match
            url: absoluteUrl,
            downloadUrl: absoluteUrl,
            metadata: {
              sourceUrl: url,
              linkText: $(element).text().trim(),
            },
          });
        }
      });

      // Buscar tags <audio> com src
      $('audio[src]').each((_, element) => {
        const src = $(element).attr('src');
        if (!src) return;

        if (this.isValidAudioUrl(src)) {
          const absoluteUrl = this.resolveUrl(src, url);

          candidates.push({
            providerId: this.providerId,
            sourceId: this.generateSourceId(absoluteUrl),
            artist: '',
            title: '',
            url: absoluteUrl,
            downloadUrl: absoluteUrl,
            metadata: {
              sourceUrl: url,
              tag: 'audio',
            },
          });
        }
      });

      // Buscar tags <source> dentro de <audio> ou <video>
      $('source[src]').each((_, element) => {
        const src = $(element).attr('src');
        const type = $(element).attr('type');
        
        if (!src) return;

        // Verificar se é um tipo de áudio
        const isAudioType = type?.startsWith('audio/');
        
        if (isAudioType || this.AUDIO_EXTENSIONS.some(ext => src.toLowerCase().includes(ext))) {
          const absoluteUrl = this.resolveUrl(src, url);

          candidates.push({
            providerId: this.providerId,
            sourceId: this.generateSourceId(absoluteUrl),
            artist: '',
            title: '',
            url: absoluteUrl,
            downloadUrl: absoluteUrl,
            format: this.extractFormatFromType(type) || this.extractFormatFromUrl(src),
            metadata: {
              sourceUrl: url,
              tag: 'source',
              mimeType: type,
            },
          });
        }
      });

      console.log(`[GenericWebProvider] Found ${candidates.length} audio links in ${url}`);

      return {
        providerId: this.providerId,
        candidates,
        status: 'SUCCESS',
        durationMs: Date.now() - startTime,
      };
    } catch (error: any) {
      const durationMs = Date.now() - startTime;
      console.error(`[GenericWebProvider] Search in URL failed:`, error.message);

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
    // Ignorar links que não são HTTP/HTTPS
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      return false;
    }

    // Ignorar links com parâmetros de tracking ou redirecionamento suspeito
    if (url.includes('redirect') || url.includes('track') || url.includes('affiliate')) {
      return false;
    }

    return true;
  }

  // Resolver URL relativa para absoluta
  private resolveUrl(url: string, baseUrl: string): string {
    try {
      return new URL(url, baseUrl).href;
    } catch {
      return url;
    }
  }

  // Gerar ID de source a partir da URL
  private generateSourceId(url: string): string {
    // Usar hash simples da URL como ID
    let hash = 0;
    for (let i = 0; i < url.length; i++) {
      const char = url.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(36);
  }

  // Extrair formato do MIME type
  private extractFormatFromType(mimeType?: string): string | undefined {
    if (!mimeType) return undefined;
    
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

  // Obter metadados de um candidato (HEAD request para verificar disponibilidade)
  async getMetadata(candidateId: string): Promise<AudioCandidate | null> {
    try {
      // Para este provider, candidateId é a URL do áudio
      const url = candidateId;

      console.log(`[GenericWebProvider] Getting metadata for: ${url}`);

      const response = await axios.head(url, {
        headers: {
          'User-Agent': this.USER_AGENT,
        },
        timeout: this.timeouts.metadata,
        maxRedirects: 5,
      });

      const contentType = (response.headers['content-type'] as string) || '';
      const contentLength = response.headers['content-length'] as string | undefined;
      const contentLengthNum = contentLength ? parseInt(contentLength) : undefined;

      // Extrair formato do content-type
      const format = this.extractFormatFromType(contentType) || this.extractFormatFromUrl(url);

      return {
        providerId: this.providerId,
        sourceId: candidateId,
        artist: '',
        title: '',
        url,
        downloadUrl: url,
        format,
        metadata: {
          contentType,
          contentLength: contentLengthNum,
          size: contentLengthNum ? this.formatBytes(contentLengthNum) : undefined,
        },
      };
    } catch (error: any) {
      console.error(`[GenericWebProvider] Metadata failed for ${candidateId}:`, error.message);
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

  // Verificar disponibilidade de um candidato
  async checkAvailability(candidateId: string): Promise<boolean> {
    try {
      const metadata = await this.getMetadata(candidateId);
      return metadata !== null;
    } catch {
      return false;
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
