// Deduplicação de Downloads Simultâneos — Evita processamento duplicado.
// Quando múltiplas requisições pedem a mesma música, apenas a primeira produz
// o arquivo; as demais aguardam e recebem o MESMO resultado.
//
// CONTRATO (correção do bug do 2º cliente pendurado): a operação produzida
// deve retornar DADOS (ex.: o caminho do arquivo em cache) e NUNCA escrever
// na Response. Quem chama é responsável por servir cada req/res individualmente
// a partir do resultado compartilhado.

interface InFlightDownload {
  promise: Promise<unknown>;
  timestamp: number;
}

class DownloadDeduplication {
  private inflight: Map<string, InFlightDownload> = new Map();
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor() {
    // Limpar downloads órfãos a cada 5 minutos. unref() evita que este timer
    // sozinho mantenha o processo Node vivo (importante em testes e scripts).
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, 5 * 60 * 1000);
    this.cleanupInterval.unref();
  }

  private getDownloadKey(releaseId: number, format: string): string {
    return `${releaseId}-${format}`;
  }

  // Indica se já existe um download em andamento para a mesma release/formato.
  isInFlight(releaseId: number, format: string): boolean {
    return this.inflight.has(this.getDownloadKey(releaseId, format));
  }

  // Aguarda o download em andamento terminar (sucesso ou falha, sem propagar erro).
  // Se o líder falhar, quem chamou tenta produzir por conta própria.
  async waitForInFlight(releaseId: number, format: string): Promise<void> {
    const existing = this.inflight.get(this.getDownloadKey(releaseId, format));
    if (existing) {
      try { await existing.promise; } catch { /* o líder já respondeu ao seu cliente */ }
    }
  }

  async execute<T>(
    releaseId: number,
    format: string,
    operation: () => Promise<T>
  ): Promise<T> {
    const key = this.getDownloadKey(releaseId, format);
    const existing = this.inflight.get(key);

    if (existing) {
      console.log(`[DownloadDeduplication] Reusing in-flight download: releaseId=${releaseId} format=${format}`);
      return existing.promise as Promise<T>;
    }

    const promise = operation();
    this.inflight.set(key, { promise, timestamp: Date.now() });

    try {
      const result = await promise;
      return result;
    } finally {
      this.inflight.delete(key);
    }
  }

  private cleanup(): void {
    const now = Date.now();
    const maxAge = 10 * 60 * 1000; // 10 minutos

    for (const [key, entry] of this.inflight.entries()) {
      if (now - entry.timestamp > maxAge) {
        console.log(`[DownloadDeduplication] Cleaning up stale in-flight download: ${key}`);
        this.inflight.delete(key);
      }
    }
  }

  getStats(): { inFlight: number } {
    return {
      inFlight: this.inflight.size,
    };
  }

  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    this.inflight.clear();
  }
}

export const downloadDeduplication = new DownloadDeduplication();
