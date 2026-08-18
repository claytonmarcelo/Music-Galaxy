// Cache de Downloads — Evita processamento repetido do mesmo áudio.
// Armazena arquivos MP3 e FLAC já processados para entrega rápida.

import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';

interface CacheEntry {
  filePath: string;
  format: string;
  size: number;
  createdAt: number;
  expiresAt: number;
}

class DownloadCache {
  private cacheDir: string;
  private maxAge: number; // em milissegundos
  private entries: Map<string, CacheEntry> = new Map();

  constructor() {
    this.cacheDir = path.join(__dirname, '../../temp/cache/audio');
    this.maxAge = 24 * 60 * 60 * 1000; // 24 horas
    this.initialize();
  }

  private async initialize(): Promise<void> {
    try {
      await fs.mkdir(this.cacheDir, { recursive: true });
      await this.loadEntries();
    } catch (error) {
      console.error('[DownloadCache] Erro ao inicializar cache:', error);
    }
  }

  private getCacheKey(releaseId: number, format: string): string {
    return crypto.createHash('md5').update(`${releaseId}-${format}`).digest('hex');
  }

  private async loadEntries(): Promise<void> {
    try {
      const indexPath = path.join(this.cacheDir, 'index.json');
      const data = await fs.readFile(indexPath, 'utf-8');
      const entries = JSON.parse(data) as Record<string, CacheEntry>;
      
      // Limpar entradas expiradas
      const now = Date.now();
      for (const [key, entry] of Object.entries(entries)) {
        if (entry.expiresAt > now) {
          this.entries.set(key, entry);
        } else {
          // Remover arquivo expirado
          try {
            await fs.unlink(entry.filePath);
          } catch {
            // Arquivo já não existe
          }
        }
      }
    } catch {
      // Índice não existe ou inválido — cache vazio
      this.entries.clear();
    }
  }

  private async saveEntries(): Promise<void> {
    try {
      const indexPath = path.join(this.cacheDir, 'index.json');
      const entriesObj = Object.fromEntries(this.entries);
      await fs.writeFile(indexPath, JSON.stringify(entriesObj), 'utf-8');
    } catch (error) {
      console.error('[DownloadCache] Erro ao salvar índice:', error);
    }
  }

  async get(releaseId: number, format: string): Promise<CacheEntry | null> {
    const key = this.getCacheKey(releaseId, format);
    const entry = this.entries.get(key);

    if (!entry) {
      return null;
    }

    // Verificar se expirou
    if (Date.now() > entry.expiresAt) {
      await this.invalidate(releaseId, format);
      return null;
    }

    // Verificar se o arquivo ainda existe
    try {
      await fs.access(entry.filePath);
      return entry;
    } catch {
      // Arquivo não existe — invalidar entrada
      await this.invalidate(releaseId, format);
      return null;
    }
  }

  async set(releaseId: number, format: string, filePath: string): Promise<void> {
    try {
      const stats = await fs.stat(filePath);
      const key = this.getCacheKey(releaseId, format);
      
      const entry: CacheEntry = {
        filePath,
        format,
        size: stats.size,
        createdAt: Date.now(),
        expiresAt: Date.now() + this.maxAge,
      };

      this.entries.set(key, entry);
      await this.saveEntries();
      
      console.log(`[DownloadCache] Cache set: releaseId=${releaseId} format=${format} size=${stats.size}`);
    } catch (error) {
      console.error('[DownloadCache] Erro ao adicionar entrada:', error);
    }
  }

  async invalidate(releaseId: number, format: string): Promise<void> {
    const key = this.getCacheKey(releaseId, format);
    const entry = this.entries.get(key);

    if (entry) {
      try {
        await fs.unlink(entry.filePath);
      } catch {
        // Arquivo já não existe
      }
      
      this.entries.delete(key);
      await this.saveEntries();
    }
  }

  async clearExpired(): Promise<void> {
    const now = Date.now();
    const expiredKeys: string[] = [];

    for (const [key, entry] of this.entries.entries()) {
      if (entry.expiresAt <= now) {
        expiredKeys.push(key);
        try {
          await fs.unlink(entry.filePath);
        } catch {
          // Arquivo já não existe
        }
      }
    }

    for (const key of expiredKeys) {
      this.entries.delete(key);
    }

    if (expiredKeys.length > 0) {
      await this.saveEntries();
      console.log(`[DownloadCache] Limpos ${expiredKeys.length} arquivos expirados`);
    }
  }

  async clearAll(): Promise<void> {
    for (const entry of this.entries.values()) {
      try {
        await fs.unlink(entry.filePath);
      } catch {
        // Arquivo já não existe
      }
    }

    this.entries.clear();
    await this.saveEntries();
    console.log('[DownloadCache] Cache limpo completamente');
  }

  getStats(): { entries: number; totalSize: number } {
    let totalSize = 0;
    for (const entry of this.entries.values()) {
      totalSize += entry.size;
    }

    return {
      entries: this.entries.size,
      totalSize,
    };
  }
}

export const downloadCache = new DownloadCache();
