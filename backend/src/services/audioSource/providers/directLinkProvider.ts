// Direct Link Provider — Resolve e valida URLs diretas de áudio fornecidas
// pelo usuário/painel (Regra 3: blogs, fóruns e sites abertos do mundo inteiro).
//
// Diferente do GenericWebProvider, este provider NÃO descobre músicas — ele é o
// RESOLVEDOR: recebe uma URL direta (ou uma página que hospeda o áudio), valida
// contra o guard anti-SSRF e a lista negra de plataformas, e devolve um
// candidato pronto para o pipeline de stream/download.

import { BaseAudioSourceProvider } from '../baseProvider';
import {
  AudioIdentity,
  SearchResult,
  AudioCandidate,
  ProviderTimeouts,
} from '../types';
import axios from 'axios';
import {
  USER_AGENT,
  AUDIO_EXTENSIONS,
  auditarUrl,
  criarBeforeRedirect,
  interpretarNomeDeArquivo,
} from '../webAudio';

export class DirectLinkProvider extends BaseAudioSourceProvider {
  readonly providerId = 'direct-link';
  readonly timeouts: ProviderTimeouts = {
    search: 10000,      // 10 segundos para validar uma URL direta
    metadata: 10000,    // 10 segundos para metadados
    download: 600000,   // 10 minutos para download (arquivos grandes)
  };

  // Este provider não faz descoberta — ele resolve URLs fornecidas.
  // Retorna SUCCESS com zero candidatos para não poluir o ranking do orquestrador
  // com falsos fracassos (comportamento esperado, não um erro).
  async search(identity: AudioIdentity): Promise<SearchResult> {
    return {
      providerId: this.providerId,
      candidates: [],
      status: 'SUCCESS',
      durationMs: 0,
    };
  }

  // Valida uma URL direta de áudio e a converte em candidato
  async searchInUrl(url: string): Promise<SearchResult> {
    const startTime = Date.now();

    try {
      console.log(`[DirectLinkProvider] Validando URL direta: ${url}`);

      // Guard de segurança (Regra 3 + anti-SSRF) antes de qualquer rede
      const auditada = await auditarUrl(url);
      if (!auditada.ok) {
        return {
          providerId: this.providerId,
          candidates: [],
          status: 'FORBIDDEN',
          error: `URL rejeitada pelo guard de segurança: ${auditada.motivo}`,
          durationMs: Date.now() - startTime,
        };
      }

      const metadata = await this.getMetadata(url);

      if (!metadata) {
        return {
          providerId: this.providerId,
          candidates: [],
          status: 'FAILED',
          error: 'Não foi possível acessar a URL. Ela pode estar fora do ar ou bloqueada.',
          durationMs: Date.now() - startTime,
        };
      }

      console.log(`[DirectLinkProvider] URL validada: ${metadata.format ?? 'desconhecido'} ${metadata.metadata?.size ?? ''}`);

      return {
        providerId: this.providerId,
        candidates: [metadata],
        status: 'SUCCESS',
        durationMs: Date.now() - startTime,
      };
    } catch (error: any) {
      const durationMs = Date.now() - startTime;
      console.error(`[DirectLinkProvider] Falha ao validar URL:`, error.message);

      let status: SearchResult['status'] = 'FAILED';
      if (error.code === 'ECONNABORTED' || error.message?.includes('Timeout')) {
        status = 'TIMEOUT';
      } else if (error.response?.status === 403) {
        status = 'FORBIDDEN';
      }

      return { providerId: this.providerId, candidates: [], status, error: error.message, durationMs };
    }
  }

  // Metadados via HEAD — candidateId é a URL direta do arquivo
  async getMetadata(candidateId: string): Promise<AudioCandidate | null> {
    try {
      const auditada = await auditarUrl(candidateId);
      if (!auditada.ok) {
        console.warn(`[DirectLinkProvider] Guard rejeitou a URL: ${auditada.motivo}`);
        return null;
      }

      const resposta = await axios.head(candidateId, {
        headers: { 'User-Agent': USER_AGENT, Accept: '*/*' },
        timeout: this.timeouts.metadata,
        maxRedirects: 3,
        beforeRedirect: criarBeforeRedirect(),
        validateStatus: (status) => status < 500,
      });

      if (resposta.status === 404 || resposta.status === 403) {
        console.warn(`[DirectLinkProvider] URL indisponível: HTTP ${resposta.status}`);
        return null;
      }

      const contentType = String(resposta.headers['content-type'] ?? '');
      const contentLength = resposta.headers['content-length']
        ? parseInt(String(resposta.headers['content-length']), 10)
        : undefined;

      const formato = this.extrairFormatoDoMime(contentType) ?? this.extrairFormatoDaUrl(candidateId);
      const nomeArquivo = this.extrairNomeDoArquivo(candidateId);

      // Interpreta "Artista - Título (Versão)" para o Exact Match Engine pontuar
      const interpretado = interpretarNomeDeArquivo(nomeArquivo);

      // Só aceita se parecer áudio (extensão ou content-type audio/*)
      const ehAudio = contentType.toLowerCase().startsWith('audio') || !!formato;
      if (!ehAudio) {
        console.warn(`[DirectLinkProvider] URL não parece áudio: content-type="${contentType}"`);
        return null;
      }

      return {
        providerId: this.providerId,
        sourceId: candidateId,
        artist: interpretado.artist ?? '',
        title: interpretado.title ?? nomeArquivo,
        version: interpretado.version,
        url: candidateId,
        downloadUrl: candidateId,
        streamUrl: candidateId,
        format: formato,
        metadata: {
          contentType,
          contentLength,
          size: contentLength ? formatBytes(contentLength) : undefined,
          fileName: nomeArquivo,
        },
      };
    } catch (error: any) {
      console.error(`[DirectLinkProvider] Metadata falhou para ${candidateId}: ${error.message}`);
      return null;
    }
  }

  async getDownloadInfo(candidateId: string): Promise<{ url: string; format: string } | null> {
    const metadata = await this.getMetadata(candidateId);
    if (!metadata) return null;
    return { url: metadata.url || candidateId, format: metadata.format || 'mp3' };
  }

  async checkAvailability(candidateId: string): Promise<boolean> {
    const metadata = await this.getMetadata(candidateId);
    return metadata !== null;
  }

  private extrairFormatoDoMime(mimeType: string): string | undefined {
    const mapa: Record<string, string> = {
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
    const base = mimeType.toLowerCase().split(';')[0].trim();
    return mapa[base];
  }

  private extrairFormatoDaUrl(url: string): string | undefined {
    try {
      const caminho = new URL(url).pathname.toLowerCase();
      const ext = AUDIO_EXTENSIONS.find((e) => caminho.endsWith(e));
      return ext ? ext.replace('.', '') : undefined;
    } catch {
      return undefined;
    }
  }

  private extrairNomeDoArquivo(url: string): string {
    try {
      const caminho = new URL(url).pathname;
      const nome = caminho.split('/').pop() ?? '';
      return decodeURIComponent(nome);
    } catch {
      return '';
    }
  }
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const unidades = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + unidades[i];
}
