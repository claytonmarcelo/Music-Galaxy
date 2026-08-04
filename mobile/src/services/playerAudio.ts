// Serviço de reprodução de áudio para o Music Galaxy.
// Gerencia playback de faixas musicais usando expo-av.
// Mantém estado de reprodução (tocando, pausado, parado).

import { Audio } from 'expo-av';

export interface EstadoPlayer {
  tocando: boolean;
  pausado: boolean;
  tempo: number;
  duracao: number;
  urlAtual: string | null;
}

class PlayerAudio {
  private som: Audio.Sound | null = null;
  private listeners: Array<(estado: EstadoPlayer) => void> = [];
  private intervaloAtualizacao: ReturnType<typeof setInterval> | null = null;
  private estado: EstadoPlayer = {
    tocando: false,
    pausado: false,
    tempo: 0,
    duracao: 0,
    urlAtual: null,
  };

  constructor() {
    // Configura modo de áudio do app
    Audio.setAudioModeAsync({
      playsInSilentModeIOS: true,
      shouldDuckAndroid: true,
      staysActiveInBackground: true,
    }).catch((err: unknown) => {
      if (err instanceof Error) {
        console.error('Erro ao configurar modo de áudio:', err.message);
      } else {
        console.error('Erro ao configurar modo de áudio:', err);
      }
    });
  }

  // Inscreve listener para mudanças de estado
  subscribe(callback: (estado: EstadoPlayer) => void): () => void {
    this.listeners.push(callback);
    return () => {
      this.listeners = this.listeners.filter(l => l !== callback);
    };
  }

  // Notifica todos os listeners com o estado atual
  private notificarListeners(): void {
    this.listeners.forEach(listener => listener(this.estado));
  }

  // Inicia atualização periódica do tempo de reprodução
  private iniciarIntervaloAtualizacao(): void {
    if (this.intervaloAtualizacao) clearInterval(this.intervaloAtualizacao);

    this.intervaloAtualizacao = setInterval(async () => {
      if (this.som && this.estado.tocando) {
        try {
          const status = await this.som.getStatusAsync();
          if (status.isLoaded) {
            this.estado.tempo = status.positionMillis;
            this.notificarListeners();
          }
        } catch (err) {
          console.error('Erro ao atualizar tempo:', err);
        }
      }
    }, 500); // Atualiza a cada 500ms
  }

  // Para atualização periódica
  private pararIntervaloAtualizacao(): void {
    if (this.intervaloAtualizacao) {
      clearInterval(this.intervaloAtualizacao);
      this.intervaloAtualizacao = null;
    }
  }

  // Carrega e toca uma faixa
  async tocar(url: string): Promise<void> {
    try {
      // Se há um som carregado diferente, descarre primeiro
      if (this.som && this.estado.urlAtual !== url) {
        await this.som.unloadAsync();
        this.som = null;
      }

      // Se é a mesma URL e está pausada, retoma
      if (this.som && this.estado.urlAtual === url && this.estado.pausado) {
        await this.som.playAsync();
        this.estado.tocando = true;
        this.estado.pausado = false;
        this.iniciarIntervaloAtualizacao();
        this.notificarListeners();
        return;
      }

      // Carrega novo som
      if (!this.som || this.estado.urlAtual !== url) {
        const { sound } = await Audio.Sound.createAsync(
          { uri: url },
          { shouldPlay: true },
          this.aoMudarStatus.bind(this)
        );
        this.som = sound;
        this.estado.urlAtual = url;
        this.estado.tocando = true;
        this.estado.pausado = false;
        this.estado.tempo = 0;

        // Obtém duração
        const status = await this.som.getStatusAsync();
        if (status.isLoaded) {
          this.estado.duracao = status.durationMillis || 0;
        }

        this.iniciarIntervaloAtualizacao();
        this.notificarListeners();
      }
    } catch (err) {
      console.error('Erro ao tocar áudio:', err);
      throw new Error(`Erro ao reproduzir áudio: ${err instanceof Error ? err.message : 'desconhecido'}`);
    }
  }

  // Pausa a reprodução
  async pausar(): Promise<void> {
    try {
      if (this.som && this.estado.tocando) {
        await this.som.pauseAsync();
        this.estado.tocando = false;
        this.estado.pausado = true;
        this.pararIntervaloAtualizacao();
        this.notificarListeners();
      }
    } catch (err) {
      console.error('Erro ao pausar áudio:', err);
      throw err;
    }
  }

  // Retoma a reprodução
  async retomar(): Promise<void> {
    try {
      if (this.som && this.estado.pausado) {
        await this.som.playAsync();
        this.estado.tocando = true;
        this.estado.pausado = false;
        this.iniciarIntervaloAtualizacao();
        this.notificarListeners();
      }
    } catch (err) {
      console.error('Erro ao retomar áudio:', err);
      throw err;
    }
  }

  // Para completamente a reprodução
  async parar(): Promise<void> {
    try {
      if (this.som) {
        await this.som.stopAsync();
        this.estado.tocando = false;
        this.estado.pausado = false;
        this.estado.tempo = 0;
        this.pararIntervaloAtualizacao();
        this.notificarListeners();
      }
    } catch (err) {
      console.error('Erro ao parar áudio:', err);
      throw err;
    }
  }

  // Pula para uma posição específica (em ms)
  async buscar(posicaoMs: number): Promise<void> {
    try {
      if (this.som) {
        await this.som.setPositionAsync(posicaoMs);
        this.estado.tempo = posicaoMs;
        this.notificarListeners();
      }
    } catch (err) {
      console.error('Erro ao buscar posição:', err);
      throw err;
    }
  }

  // Callback chamado quando o status do áudio muda
  private async aoMudarStatus(status: any): Promise<void> {
    if (!status.isLoaded) return;

    if (status.didJustFinish) {
      this.estado.tocando = false;
      this.estado.pausado = false;
      this.estado.tempo = 0;
      this.pararIntervaloAtualizacao();
      this.notificarListeners();
    }
  }

  // Retorna o estado atual
  obterEstado(): EstadoPlayer {
    return { ...this.estado };
  }

  // Descarre o som e limpa recursos
  async descarregar(): Promise<void> {
    try {
      this.pararIntervaloAtualizacao();
      if (this.som) {
        await this.som.unloadAsync();
        this.som = null;
      }
      this.estado = {
        tocando: false,
        pausado: false,
        tempo: 0,
        duracao: 0,
        urlAtual: null,
      };
      this.notificarListeners();
    } catch (err) {
      console.error('Erro ao descarregar áudio:', err);
    }
  }
}

// Exporta instância singleton
export const playerAudio = new PlayerAudio();
