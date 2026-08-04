// Serviço de gerenciamento de downloads de músicas.
// Usa expo-file-system para baixar e armazenar arquivos localmente.
// Rastreia progresso, erros e arquivo armazenados.
// Em Web, funciona de forma simulada/desabilitada.

import * as FileSystem from 'expo-file-system';
import { Platform } from 'react-native';

export interface EstadoDownload {
  url: string;
  nomeArquivo: string;
  progresso: number; // 0-1
  baixando: boolean;
  concluido: boolean;
  tamanhoTotal: number;
  tamanhoAtual: number;
  erro: string | null;
  caminhoLocal: string | null;
}

interface ListenerDownload {
  (estado: EstadoDownload): void;
}

class DownloadManager {
  private downloads: Map<string, EstadoDownload> = new Map();
  private listeners: Map<string, ListenerDownload[]> = new Map();
  private diretorioMusicas: string = '';
  private emWeb: boolean = Platform.OS === 'web';

  constructor() {
    // Em Web, não usar FileSystem
    if (!this.emWeb) {
      this.diretorioMusicas = (FileSystem.documentDirectory || '') + 'music_galaxy/';
      this.garantirDiretorio();
    }
  }

  // Garante que o diretório de armazenamento existe (apenas em mobile)
  private async garantirDiretorio(): Promise<void> {
    if (this.emWeb) return; // Pular em Web

    try {
      const info = await FileSystem.getInfoAsync(this.diretorioMusicas);
      if (!info.exists) {
        await FileSystem.makeDirectoryAsync(this.diretorioMusicas, { intermediates: true });
      }
    } catch (err) {
      console.error('Erro ao criar diretório:', err);
    }
  }

  // Gera nome de arquivo a partir da URL
  private gerarNomeArquivo(url: string, titulo: string): string {
    // Remove caracteres inválidos do título
    const tituloLimpo = titulo
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '_')
      .replace(/_+/g, '_')
      .slice(0, 30);

    const extensao = url.endsWith('.mp3') ? '.mp3' : '.m4a';
    const timestamp = Date.now();

    return `${tituloLimpo}_${timestamp}${extensao}`;
  }

  // Inscreve listener para mudanças de progresso
  subscribe(url: string, callback: ListenerDownload): () => void {
    if (!this.listeners.has(url)) {
      this.listeners.set(url, []);
    }
    this.listeners.get(url)!.push(callback);

    // Retorna função para desinscrever
    return () => {
      const listeners = this.listeners.get(url);
      if (listeners) {
        this.listeners.set(
          url,
          listeners.filter(l => l !== callback)
        );
      }
    };
  }

  // Notifica todos os listeners de uma URL
  private notificarListeners(url: string): void {
    const estado = this.downloads.get(url);
    if (estado) {
      const listeners = this.listeners.get(url) || [];
      listeners.forEach(listener => listener(estado));
    }
  }

  // Inicia um download
  async baixar(url: string, titulo: string): Promise<string> {
    // Em Web, simular sucesso (não baixar de verdade)
    if (this.emWeb) {
      console.warn('Downloads desabilitados em Web (expo-file-system não disponível)');
      
      const nomeArquivo = this.gerarNomeArquivo(url, titulo);
      const estado: EstadoDownload = {
        url,
        nomeArquivo,
        progresso: 1,
        baixando: false,
        concluido: true,
        tamanhoTotal: 0,
        tamanhoAtual: 0,
        erro: null,
        caminhoLocal: `web://${nomeArquivo}`,
      };
      
      this.downloads.set(url, estado);
      this.notificarListeners(url);
      
      return `web://${nomeArquivo}`;
    }

    try {
      // Se já está baixando, retorna o mesmo
      if (this.downloads.has(url) && this.downloads.get(url)!.baixando) {
        throw new Error('Este arquivo já está sendo baixado');
      }

      // Se já foi baixado, retorna o caminho
      if (this.downloads.has(url) && this.downloads.get(url)!.concluido) {
        const caminhoLocal = this.downloads.get(url)!.caminhoLocal;
        if (caminhoLocal) return caminhoLocal;
      }

      const nomeArquivo = this.gerarNomeArquivo(url, titulo);
      const caminhoLocal = this.diretorioMusicas + nomeArquivo;

      // Inicializa estado
      const estado: EstadoDownload = {
        url,
        nomeArquivo,
        progresso: 0,
        baixando: true,
        concluido: false,
        tamanhoTotal: 0,
        tamanhoAtual: 0,
        erro: null,
        caminhoLocal,
      };

      this.downloads.set(url, estado);
      this.notificarListeners(url);

      // Nota: expo-file-system não suporta callbacks de progresso
      // Baixamos sem rastreamento de progresso por enquanto
      const resultado = await FileSystem.downloadAsync(url, caminhoLocal);

      if (resultado.status === 200) {
        estado.baixando = false;
        estado.concluido = true;
        estado.progresso = 1;
        estado.erro = null;
        this.notificarListeners(url);
        return caminhoLocal;
      } else {
        throw new Error(`Erro de download: status ${resultado.status}`);
      }
    } catch (err) {
      const mensagem = err instanceof Error ? err.message : 'Erro desconhecido';
      const estado = this.downloads.get(url);
      
      if (estado) {
        estado.baixando = false;
        estado.concluido = false;
        estado.erro = mensagem;
        this.notificarListeners(url);
      }

      throw new Error(`Erro ao baixar: ${mensagem}`);
    }
  }

  // Cancela um download em progresso
  async cancelar(url: string): Promise<void> {
    const estado = this.downloads.get(url);
    
    if (estado && estado.baixando) {
      if (this.emWeb) {
        // Em Web, apenas marcar como cancelado
        estado.baixando = false;
        estado.erro = 'Download cancelado pelo usuário';
        this.notificarListeners(url);
      } else if (estado.caminhoLocal) {
        try {
          // Tenta deletar arquivo parcial
          await FileSystem.deleteAsync(estado.caminhoLocal, { idempotent: true });
          estado.baixando = false;
          estado.progresso = 0;
          estado.erro = 'Download cancelado pelo usuário';
          this.notificarListeners(url);
        } catch (err) {
          console.error('Erro ao cancelar download:', err);
        }
      }
    }
  }

  // Retorna estado atual de um download
  obterEstado(url: string): EstadoDownload | null {
    return this.downloads.get(url) || null;
  }

  // Lista todos os downloads
  listarDownloads(): EstadoDownload[] {
    return Array.from(this.downloads.values());
  }

  // Deleta um arquivo baixado
  async deletar(url: string): Promise<void> {
    const estado = this.downloads.get(url);
    
    if (estado && estado.caminhoLocal && !estado.caminhoLocal.startsWith('web://')) {
      try {
        await FileSystem.deleteAsync(estado.caminhoLocal, { idempotent: true });
        this.downloads.delete(url);
        this.listeners.delete(url);
      } catch (err) {
        console.error('Erro ao deletar arquivo:', err);
      }
    } else if (estado && estado.caminhoLocal?.startsWith('web://')) {
      // Em Web, apenas remover do mapa
      this.downloads.delete(url);
      this.listeners.delete(url);
    }
  }

  // Verifica se um arquivo já foi baixado
  jaFoiBaixado(url: string): boolean {
    const estado = this.downloads.get(url);
    return !!(estado && estado.concluido && estado.caminhoLocal);
  }

  // Retorna o caminho local do arquivo baixado
  obterCaminhoLocal(url: string): string | null {
    const estado = this.downloads.get(url);
    return (estado && estado.concluido && estado.caminhoLocal) ? estado.caminhoLocal : null;
  }

  // Limpa todos os downloads antigos (se necessário)
  async limparAntigos(diasRetencao: number = 30): Promise<void> {
    if (this.emWeb) return; // Pular em Web

    try {
      const info = await FileSystem.getInfoAsync(this.diretorioMusicas);
      if (!info.exists) return;

      const arquivos = await FileSystem.readDirectoryAsync(this.diretorioMusicas);
      const agora = Date.now();
      const diasMs = diasRetencao * 24 * 60 * 60 * 1000;

      for (const arquivo of arquivos) {
        try {
          const caminhoCompleto = this.diretorioMusicas + arquivo;
          const fileInfo = await FileSystem.getInfoAsync(caminhoCompleto);
          
          // A API expo-file-system não retorna modificationTime, então usamos criação
          // Se o arquivo existe e é mais velho que diasRetencao, deleta
          if (fileInfo.exists && 'isDirectory' in fileInfo && !fileInfo.isDirectory) {
            // Nota: Expo não fornece modificationTime, então pulamos limpeza de antigos por agora
            // Implementar quando a API for disponibilizada
          }
        } catch (err) {
          console.error(`Erro ao limpar ${arquivo}:`, err);
        }
      }
    } catch (err) {
      console.error('Erro ao limpar downloads antigos:', err);
    }
  }
}

// Exporta instância singleton
export const downloadManager = new DownloadManager();
