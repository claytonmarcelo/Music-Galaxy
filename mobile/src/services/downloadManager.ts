// Gerenciador de Downloads com Persistência.
// Mantém a fila, o estado de progresso e o estado público
// compatível com os componentes de UI do projeto.

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';
import { Platform } from 'react-native';
import { Release } from '../types';
import { BASE_URL } from './api';

export interface DownloadItem {
  id: string;
  release: Release;
  url: string;
  status: 'pending' | 'downloading' | 'completed' | 'error';
  progress: number;
  filePath: string | null;
  fileSize: number;
  error: string | null;
  createdAt: number;
  completedAt: number | null;
}

// Detecta o formato pedido no endpoint de download (mp3 por padrão).
export function formatoDoDownload(url: string): 'mp3' | 'flac' {
  try {
    const formato = new URL(url, 'http://localhost').searchParams.get('format');
    return formato === 'flac' ? 'flac' : 'mp3';
  } catch {
    return 'mp3';
  }
}

// Nome de arquivo seguro para web, Android e iOS.
function nomeSeguro(base: string, extensao: string): string {
  const limpo = (base || 'download')
    .replace(/[\\/:*?"<>|]/g, '_')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 120);
  return `${limpo || 'download'}.${extensao}`;
}

export interface EstadoDownload {
  baixando: boolean;
  concluido: boolean;
  erro: string | null;
  progresso: number;
  caminhoLocal: string | null;
  tamanhoAtual: number;
  tamanhoTotal: number;
  // Nome amigável exibido na fila de downloads.
  titulo: string | null;
}

class DownloadManager {
  private downloads: Map<string, DownloadItem> = new Map();
  private queue: string[] = [];
  private isProcessing = false;
  private maxConcurrent = 1;
  private currentDownloads = 0;
  private estadosByUrl: Map<string, EstadoDownload> = new Map();
  private listeners: Map<string, Array<(estado: EstadoDownload) => void>> = new Map();
  private listenersGlobais: Set<() => void> = new Set();
  private downloadResumables: Map<string, any> = new Map();
  // Controladores de download da web (permitem cancelar o fetch de verdade).
  private abortControllers: Map<string, AbortController> = new Map();
  // Garante que a fila salva no aparelho seja carregada uma única vez.
  private inicializacao: Promise<void> | null = null;

  // Inicializar gerenciador (fila antiga + fila nova persistida).
  async initialize(): Promise<void> {
    if (!this.inicializacao) {
      this.inicializacao = (async () => {
        await this.loadFromStorage();
        await this.carregarFilaSalva();
      })();
    }
    return this.inicializacao;
  }

  // Carrega a fila nova (estados por URL) salva no aparelho.
  private async carregarFilaSalva(): Promise<void> {
    try {
      const bruto = await AsyncStorage.getItem('@musicgalaxy:filaDownloads');
      if (!bruto) return;

      const registros = JSON.parse(bruto) as Array<{ url: string; estado: EstadoDownload }>;
      registros.forEach(({ url, estado }) => {
        if (!url || !estado || this.estadosByUrl.has(url)) return;

        const restaurado: EstadoDownload = {
          ...this.criarEstadoPadrao(estado.titulo ?? null),
          ...estado,
          baixando: false,
        };

        // Downloads interrompidos pelo fechamento do app viram erro recuperável.
        if (estado.baixando) {
          restaurado.concluido = false;
          restaurado.erro = 'Download interrompido. Toque em tentar novamente.';
        }

        this.estadosByUrl.set(url, restaurado);
      });

      this.listenersGlobais.forEach((callback) => callback());
    } catch (erro) {
      console.error('Erro ao carregar a fila de downloads:', erro);
    }
  }

  // Salva a fila nova no aparelho para sobreviver ao fechamento do app.
  private async persistirFila(): Promise<void> {
    try {
      const registros = Array.from(this.estadosByUrl.entries()).map(([url, estado]) => ({
        url,
        estado,
      }));
      await AsyncStorage.setItem('@musicgalaxy:filaDownloads', JSON.stringify(registros));
    } catch (erro) {
      console.error('Erro ao salvar a fila de downloads:', erro);
    }
  }

  // Carregar downloads persistidos em storage.
  private async loadFromStorage(): Promise<void> {
    try {
      const data = await AsyncStorage.getItem('@musicgalaxy:downloads');
      if (data) {
        const parsed = JSON.parse(data) as DownloadItem[];
        this.downloads = new Map(parsed.map((item) => [item.id, item]));
        this.queue = parsed
          .filter((item) => item.status === 'pending')
          .map((item) => item.id);
      }
    } catch (error) {
      console.error('Erro ao carregar downloads:', error);
    }
  }

  // Salvar downloads no AsyncStorage.
  private async saveToStorage(): Promise<void> {
    try {
      const data = Array.from(this.downloads.values());
      await AsyncStorage.setItem('@musicgalaxy:downloads', JSON.stringify(data));
    } catch (error) {
      console.error('Erro ao salvar downloads:', error);
    }
  }

  // Requisita o estado público de um download por URL.
  obterEstado(url: string): EstadoDownload | null {
    const estado = this.estadosByUrl.get(url);
    return estado ? { ...estado } : null;
  }

  // Acompanha mudanças de progresso por URL.
  subscribe(url: string, callback: (estado: EstadoDownload) => void): () => void {
    const lista = this.listeners.get(url) ?? [];
    lista.push(callback);
    this.listeners.set(url, lista);

    return () => {
      const atual = this.listeners.get(url) ?? [];
      const filtrada = atual.filter((item) => item !== callback);
      if (filtrada.length > 0) {
        this.listeners.set(url, filtrada);
      } else {
        this.listeners.delete(url);
      }
    };
  }

  private notificar(url: string, estado: EstadoDownload): void {
    const lista = this.listeners.get(url) ?? [];
    lista.forEach((callback) => callback({ ...estado }));
    this.listenersGlobais.forEach((callback) => callback());
  }

  // Acompanha qualquer download (usado pela fila de downloads).
  assinarTodos(callback: () => void): () => void {
    this.listenersGlobais.add(callback);
    return () => {
      this.listenersGlobais.delete(callback);
    };
  }

  // Lista os estados atuais em memória, do mais recente para o mais antigo.
  listarEstados(): Array<{ url: string; estado: EstadoDownload }> {
    return Array.from(this.estadosByUrl.entries())
      .map(([url, estado]) => ({ url, estado: { ...estado } }))
      .reverse();
  }

  // Contagem resumida usada pelos distintivos e pela tela de downloads.
  obterContagem(): { total: number; baixando: number; concluidos: number; erros: number } {
    const estados = Array.from(this.estadosByUrl.values());
    return {
      total: estados.length,
      baixando: estados.filter((estado) => estado.baixando).length,
      concluidos: estados.filter((estado) => estado.concluido).length,
      erros: estados.filter((estado) => !estado.baixando && !estado.concluido && !!estado.erro).length,
    };
  }

  // Remove todos os downloads concluídos (arquivos e registros da fila).
  async limparConcluidos(): Promise<void> {
    const urls = Array.from(this.estadosByUrl.entries())
      .filter(([, estado]) => estado.concluido)
      .map(([url]) => url);
    for (const url of urls) {
      await this.deletar(url);
    }
  }

  // Remove os downloads que terminaram em erro.
  async limparErros(): Promise<void> {
    const urls = Array.from(this.estadosByUrl.entries())
      .filter(([, estado]) => !estado.baixando && !estado.concluido && !!estado.erro)
      .map(([url]) => url);
    for (const url of urls) {
      await this.deletar(url);
    }
  }

  private criarEstadoPadrao(titulo: string | null = null): EstadoDownload {
    return {
      baixando: false,
      concluido: false,
      erro: null,
      progresso: 0,
      caminhoLocal: null,
      tamanhoAtual: 0,
      tamanhoTotal: 0,
      titulo,
    };
  }

  // Adiciona um download usando a release original do usuário.
  // Regra 3: o arquivo sempre vem do endpoint do backend, que resolve a
  // fonte em sites abertos (nunca YouTube/Spotify/Deezer).
  async addDownload(release: Release): Promise<string> {
    const url = `${BASE_URL}/api/releases/${release.id}/download?format=mp3`;
    return this.baixar(url, release.version_name);
  }

  // Compatibilidade com o componente de UI antigo.
  async baixar(url: string, titulo: string): Promise<string> {
    if (!url) {
      throw new Error('URL de download não disponível');
    }

    const estadoAnterior = this.obterEstado(url);
    if (estadoAnterior?.concluido && estadoAnterior.caminhoLocal) {
      return estadoAnterior.caminhoLocal;
    }

    const estado = this.criarEstadoPadrao(titulo || null);
    estado.baixando = true;
    this.estadosByUrl.set(url, estado);
    this.notificar(url, estado);
    void this.persistirFila();

    // Tratamento para Web - usa fetch para rastrear progresso antes do download nativo
    if (Platform.OS === 'web' || typeof window !== 'undefined' && typeof document !== 'undefined') {
      const controlador = new AbortController();
      this.abortControllers.set(url, controlador);
      try {
        const response = await fetch(url, { signal: controlador.signal });
        if (!response.ok) {
          throw new Error(`Erro HTTP: ${response.status}`);
        }

        const contentLength = response.headers.get('Content-Length');
        const total = contentLength ? parseInt(contentLength, 10) : 0;
        const reader = response.body?.getReader();
        
        if (!reader) {
          throw new Error('Não foi possível ler o corpo da resposta');
        }

        let receivedLength = 0;
        const chunks: BlobPart[] = [];

        while (true) {
          const { done, value } = await reader.read();
          
          if (done) break;
          
          chunks.push(value);
          receivedLength += value.length;
          
          // Atualiza progresso
          const progresso = total > 0 ? receivedLength / total : 0;
          const estadoAtual = this.estadosByUrl.get(url) ?? this.criarEstadoPadrao(titulo);
          estadoAtual.baixando = true;
          estadoAtual.progresso = progresso;
          estadoAtual.tamanhoAtual = receivedLength;
          estadoAtual.tamanhoTotal = total;
          estadoAtual.erro = null;
          this.estadosByUrl.set(url, estadoAtual);
          this.notificar(url, estadoAtual);
        }

        // Combina todos os chunks em um Blob
        const blob = new Blob(chunks);
        const blobUrl = URL.createObjectURL(blob);

        // Cria link para download nativo
        const link = document.createElement('a');
        link.href = blobUrl;
        link.download = nomeSeguro(titulo, formatoDoDownload(url));
        link.target = '_blank';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        // Libera URL do blob após um pequeno delay
        setTimeout(() => URL.revokeObjectURL(blobUrl), 100);

        const estadoFinal: EstadoDownload = {
          baixando: false,
          concluido: true,
          erro: null,
          progresso: 1,
          caminhoLocal: url,
          tamanhoAtual: receivedLength,
          tamanhoTotal: total,
          titulo: titulo || null,
        };
        this.estadosByUrl.set(url, estadoFinal);
        this.notificar(url, estadoFinal);
        void this.persistirFila();
        return url;
      } catch (err) {
        const mensagem = err instanceof Error ? err.message : 'Erro ao baixar no navegador';
        console.error('Erro ao baixar no navegador:', err);

        // Cancelamento disparado pelo usuário: o estado já foi marcado em cancelar().
        if (err instanceof Error && err.name === 'AbortError') {
          void this.persistirFila();
          throw err;
        }

        const estadoErro = this.estadosByUrl.get(url) ?? this.criarEstadoPadrao(titulo);
        estadoErro.baixando = false;
        estadoErro.concluido = false;
        estadoErro.erro = mensagem;
        this.estadosByUrl.set(url, estadoErro);
        this.notificar(url, estadoErro);
        void this.persistirFila();

        throw err;
      } finally {
        this.abortControllers.delete(url);
      }
    }

    const fileName = nomeSeguro(titulo, formatoDoDownload(url));
    const cacheDirectory = (FileSystem as any).cacheDirectory ?? (FileSystem as any).documentDirectory ?? '';
    const fileUri = `${cacheDirectory}${fileName}`;

    try {
      const resumable = FileSystem.createDownloadResumable(
        url,
        fileUri,
        {},
        (downloadProgress) => {
          const total = downloadProgress.totalBytesExpectedToWrite || downloadProgress.totalBytesWritten || 0;
          const progresso = total > 0
            ? downloadProgress.totalBytesWritten / total
            : 0;

          const estadoAtual = this.estadosByUrl.get(url) ?? this.criarEstadoPadrao(titulo);
          estadoAtual.baixando = true;
          estadoAtual.progresso = progresso;
          estadoAtual.tamanhoAtual = downloadProgress.totalBytesWritten;
          estadoAtual.tamanhoTotal = total;
          estadoAtual.erro = null;
          this.estadosByUrl.set(url, estadoAtual);
          this.notificar(url, estadoAtual);
        }
      );

      this.downloadResumables.set(url, resumable);
      const result = await resumable.downloadAsync();

      const estadoFinal = this.estadosByUrl.get(url) ?? this.criarEstadoPadrao(titulo);
      estadoFinal.baixando = false;
      estadoFinal.concluido = true;
      estadoFinal.progresso = 1;
      const caminhoLocal = result?.uri ?? fileUri;
      estadoFinal.caminhoLocal = caminhoLocal;
      estadoFinal.tamanhoAtual = estadoFinal.tamanhoTotal || 0;
      estadoFinal.erro = null;
      this.estadosByUrl.set(url, estadoFinal);
      this.notificar(url, estadoFinal);
      void this.persistirFila();

      if (!caminhoLocal) {
        throw new Error('Download concluído, mas o arquivo local não foi persistido.');
      }

      return caminhoLocal;
    } catch (error) {
      const mensagem = error instanceof Error ? error.message : 'Erro desconhecido';
      const estadoErro = this.estadosByUrl.get(url) ?? this.criarEstadoPadrao(titulo);
      estadoErro.baixando = false;
      estadoErro.concluido = false;
      estadoErro.erro = mensagem;
      this.estadosByUrl.set(url, estadoErro);
      this.notificar(url, estadoErro);
      void this.persistirFila();
      throw error;
    } finally {
      this.downloadResumables.delete(url);
    }
  }

  // Cancelar download em andamento.
  async cancelar(url: string): Promise<void> {
    const estado = this.estadosByUrl.get(url);
    if (!estado || !estado.baixando) {
      return;
    }

    const controlador = this.abortControllers.get(url);
    if (controlador) {
      controlador.abort();
      this.abortControllers.delete(url);
    }

    const resumable = this.downloadResumables.get(url);
    if (resumable && typeof resumable.pauseAsync === 'function') {
      await resumable.pauseAsync();
    }

    estado.baixando = false;
    estado.concluido = false;
    estado.erro = 'Download cancelado.';
    this.estadosByUrl.set(url, estado);
    this.notificar(url, estado);
    void this.persistirFila();
  }

  // Remove um arquivo local já baixado.
  async deletar(url: string): Promise<void> {
    const estado = this.estadosByUrl.get(url);

    // Cancela um download em andamento antes de remover o registro.
    const controlador = this.abortControllers.get(url);
    if (controlador) {
      controlador.abort();
      this.abortControllers.delete(url);
    }

    // Na web o caminho é a própria URL do backend; não há arquivo local a apagar.
    if (estado?.caminhoLocal && Platform.OS !== 'web') {
      try {
        await FileSystem.deleteAsync(estado.caminhoLocal, { idempotent: true });
      } catch (error) {
        console.error('Erro ao deletar arquivo local:', error);
      }
    }

    this.estadosByUrl.delete(url);
    this.listeners.delete(url);
    this.downloadResumables.delete(url);
    this.listenersGlobais.forEach((callback) => callback());
    void this.persistirFila();
  }

  // Processar fila de downloads.
  private async processQueue(): Promise<void> {
    if (this.isProcessing || this.currentDownloads >= this.maxConcurrent) {
      return;
    }

    this.isProcessing = true;

    while (this.queue.length > 0 && this.currentDownloads < this.maxConcurrent) {
      const id = this.queue.shift();
      if (id) {
        this.currentDownloads++;
        this.processDownload(id).finally(() => {
          this.currentDownloads--;
        });
      }
    }

    this.isProcessing = false;
  }

  // Processar download individual.
  private async processDownload(id: string): Promise<void> {
    const downloadItem = this.downloads.get(id);
    if (!downloadItem) return;

    try {
      downloadItem.status = 'downloading';
      await this.saveToStorage();

      const fileName = `${downloadItem.release.artist_name} - ${downloadItem.release.work_title} - ${downloadItem.release.version_name}.mp3`;
      const cacheDirectory = (FileSystem as any).cacheDirectory ?? (FileSystem as any).documentDirectory ?? '';
      const fileUri = `${cacheDirectory}${fileName}`;
      const resumable = FileSystem.createDownloadResumable(
        downloadItem.url,
        fileUri,
        {},
        (downloadProgress) => {
          const total = downloadProgress.totalBytesExpectedToWrite || downloadProgress.totalBytesWritten || 0;
          const progresso = total > 0 ? downloadProgress.totalBytesWritten / total : 0;
          downloadItem.progress = progresso * 100;
          downloadItem.fileSize = total;
          this.saveToStorage();
        }
      );

      const result = await resumable.downloadAsync();

      downloadItem.status = 'completed';
      downloadItem.filePath = result?.uri || fileUri;
      downloadItem.progress = 100;
      downloadItem.completedAt = Date.now();
      downloadItem.error = null;
    } catch (error) {
      downloadItem.status = 'error';
      downloadItem.error = error instanceof Error ? error.message : 'Erro desconhecido';
    } finally {
      await this.saveToStorage();
    }
  }

  // Pausar download antigo, preservando compatibilidade.
  async pauseDownload(id: string): Promise<void> {
    const downloadItem = this.downloads.get(id);
    if (downloadItem && downloadItem.status === 'downloading') {
      downloadItem.status = 'pending';
      await this.saveToStorage();
    }
  }

  // Cancelar download antigo, preservando compatibilidade.
  async cancelDownloadLegacy(id: string): Promise<void> {
    const downloadItem = this.downloads.get(id);
    if (downloadItem) {
      if (downloadItem.filePath) {
        try {
          await FileSystem.deleteAsync(downloadItem.filePath);
        } catch (error) {
          console.error('Erro ao deletar arquivo:', error);
        }
      }
      this.downloads.delete(id);
      this.queue = this.queue.filter((item) => item !== id);
      await this.saveToStorage();
    }
  }

  // Retomar download antigo, preservando compatibilidade.
  async resumeDownload(id: string): Promise<void> {
    const downloadItem = this.downloads.get(id);
    if (downloadItem && downloadItem.status === 'pending') {
      this.queue.push(id);
      await this.saveToStorage();
      this.processQueue();
    }
  }

  // Obter todos os downloads.
  getAllDownloads(): DownloadItem[] {
    return Array.from(this.downloads.values()).sort((a, b) => b.createdAt - a.createdAt);
  }

  // Obter download por ID.
  getDownload(id: string): DownloadItem | undefined {
    return this.downloads.get(id);
  }

  // Obter downloads de uma release.
  getDownloadsByRelease(releaseId: number): DownloadItem[] {
    return this.getAllDownloads().filter((item) => item.release.id === releaseId);
  }

  // Limpar downloads concluídos.
  async clearCompleted(): Promise<void> {
    const completedIds = Array.from(this.downloads.entries())
      .filter(([_, item]) => item.status === 'completed')
      .map(([id]) => id);

    for (const id of completedIds) {
      const downloadItem = this.downloads.get(id);
      if (downloadItem?.filePath) {
        try {
          await FileSystem.deleteAsync(downloadItem.filePath);
        } catch (error) {
          console.error('Erro ao deletar arquivo:', error);
        }
      }
      this.downloads.delete(id);
    }

    await this.saveToStorage();
  }

  // Limpar downloads com erro.
  async clearErrors(): Promise<void> {
    const errorIds = Array.from(this.downloads.entries())
      .filter(([_, item]) => item.status === 'error')
      .map(([id]) => id);

    for (const id of errorIds) {
      this.downloads.delete(id);
    }

    await this.saveToStorage();
  }

  // Estatísticas do gerenciador.
  getStats(): {
    total: number;
    pending: number;
    downloading: number;
    completed: number;
    error: number;
    totalSize: number;
  } {
    const downloads = this.getAllDownloads();
    return {
      total: downloads.length,
      pending: downloads.filter((d) => d.status === 'pending').length,
      downloading: downloads.filter((d) => d.status === 'downloading').length,
      completed: downloads.filter((d) => d.status === 'completed').length,
      error: downloads.filter((d) => d.status === 'error').length,
      totalSize: downloads.reduce((sum, d) => sum + d.fileSize, 0),
    };
  }
}

// Instância singleton.
export const downloadManager = new DownloadManager();
