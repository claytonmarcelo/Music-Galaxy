// Gerenciador de Downloads com Persistência.
// Mantém a fila, o estado de progresso e o estado público
// compatível com os componentes de UI do projeto.

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';
import { Platform } from 'react-native';

// Detecta o formato pedido no endpoint de download (mp3 por padrão).
export function formatoDoDownload(url: string): 'mp3' | 'flac' {
  try {
    const formato = new URL(url, 'http://localhost').searchParams.get('format');
    return formato === 'flac' ? 'flac' : 'mp3';
  } catch {
    return 'mp3';
  }
}

// Extrai o ID da versão de uma URL de download do backend.
// Retorna null para qualquer endereço que não seja desse endpoint.
export function releaseIdDoDownload(url: string): number | null {
  try {
    const caminho = new URL(url, 'http://localhost').pathname;
    const correspondencia = /^\/api\/releases\/(\d+)\/download$/.exec(caminho);
    if (!correspondencia) return null;

    const id = Number(correspondencia[1]);
    return Number.isInteger(id) && id > 0 ? id : null;
  } catch {
    return null;
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
  private estadosByUrl: Map<string, EstadoDownload> = new Map();
  private listeners: Map<string, Array<(estado: EstadoDownload) => void>> = new Map();
  private listenersGlobais: Set<() => void> = new Set();
  private downloadResumables: Map<string, FileSystem.DownloadResumable> = new Map();
  // Controladores de download da web (permitem cancelar o fetch de verdade).
  private abortControllers: Map<string, AbortController> = new Map();
  // Garante que a fila salva no aparelho seja carregada uma única vez.
  private inicializacao: Promise<void> | null = null;

  // Inicializar gerenciador com a fila persistida no aparelho.
  async initialize(): Promise<void> {
    if (!this.inicializacao) {
      this.inicializacao = this.carregarFilaSalva();
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

  // Requisita o estado público de um download por URL.
  obterEstado(url: string): EstadoDownload | null {
    const estado = this.estadosByUrl.get(url);
    return estado ? { ...estado } : null;
  }

  // Caminho local confiável de uma versão já baixada.
  // Só devolve o arquivo quando o download terminou de fato e o arquivo
  // ainda existe no aparelho — nunca usa um arquivo pela metade. Na web
  // não existe caminho local, então a reprodução continua pelo servidor.
  async obterArquivoLocal(releaseId: number): Promise<string | null> {
    if (Platform.OS === 'web') return null;

    for (const [url, estado] of this.estadosByUrl.entries()) {
      if (!estado.concluido || !estado.caminhoLocal) continue;
      if (!estado.caminhoLocal.startsWith('file://')) continue;
      if (releaseIdDoDownload(url) !== releaseId) continue;

      try {
        const informacoes = await FileSystem.getInfoAsync(estado.caminhoLocal);
        if (informacoes.exists) return estado.caminhoLocal;
      } catch (erro) {
        console.error('Erro ao verificar o arquivo local:', erro);
      }
    }

    return null;
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

  // Baixa uma versão a partir do endpoint do backend.
  // Regra 3: o arquivo sempre vem do endpoint do backend, que resolve a
  // fonte em sites abertos (nunca YouTube/Spotify/Deezer).
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
    // No web, os diretórios do expo-file-system são nulos; o fallback vazio
    // mantém o download do navegador funcionando (Blob + link de download).
    const cacheDirectory = FileSystem.cacheDirectory ?? FileSystem.documentDirectory ?? '';
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
}

// Instância singleton.
export const downloadManager = new DownloadManager();
