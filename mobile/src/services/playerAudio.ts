// Serviço de reprodução de áudio para o Music Galaxy.
// Gerencia playback de faixas musicais com suporte a:
// - expo-av (React Native: iOS, Android)
// - HTML5 Audio (Web: browser)
// Mantém estado de reprodução (tocando, pausado, parado).

import { Platform } from 'react-native';
let ExpoAudio: any;

// Importa expo-av apenas em ambiente React Native
if (Platform.OS !== 'web') {
  try {
    ExpoAudio = require('expo-av').Audio;
  } catch (e) {
    console.warn('expo-av não disponível');
  }
}

export interface EstadoPlayer {
  tocando: boolean;
  pausado: boolean;
  tempo: number;
  duracao: number;
  urlAtual: string | null;
}

class PlayerAudio {
  private som: any = null;
  private audioWeb: HTMLAudioElement | null = null;
  private listeners: Array<(estado: EstadoPlayer) => void> = [];
  private intervaloAtualizacao: ReturnType<typeof setInterval> | null = null;
  private estado: EstadoPlayer = {
    tocando: false,
    pausado: false,
    tempo: 0,
    duracao: 0,
    urlAtual: null,
  };
  private isWeb = Platform.OS === 'web';

  constructor() {
    // Configura modo de áudio apenas em React Native
    if (!this.isWeb && ExpoAudio?.setAudioModeAsync) {
      ExpoAudio.setAudioModeAsync({
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
      if (this.isWeb) {
        // Implementação Web com HTML5 Audio
        if (!this.audioWeb) {
          // Cria elemento de áudio nativo do HTML5
          if (typeof document !== 'undefined') {
            this.audioWeb = document.createElement('audio');
          } else {
            throw new Error('HTML5 Audio não disponível neste navegador');
          }

          this.audioWeb.addEventListener('timeupdate', () => {
            this.estado.tempo = (this.audioWeb?.currentTime ?? 0) * 1000;
            this.notificarListeners();
          });
          this.audioWeb.addEventListener('loadedmetadata', () => {
            this.estado.duracao = (this.audioWeb?.duration ?? 0) * 1000;
            this.notificarListeners();
          });
          this.audioWeb.addEventListener('ended', () => {
            this.estado.tocando = false;
            this.estado.pausado = false;
            this.estado.tempo = 0;
            this.pararIntervaloAtualizacao();
            this.notificarListeners();
          });
          this.audioWeb.addEventListener('error', (e) => {
            console.error('Erro ao carregar áudio web:', e);
            throw new Error(`Não foi possível carregar o áudio: ${url}`);
          });
        }

        if (this.estado.urlAtual !== url) {
          this.audioWeb.src = url;
          this.audioWeb.load();
          this.estado.urlAtual = url;
        }

        this.audioWeb.play().catch((err: any) => {
          console.error('Erro ao reproduzir áudio web:', err);
          throw new Error('Não foi possível reproduzir o áudio');
        });

        this.estado.tocando = true;
        this.estado.pausado = false;
        this.estado.tempo = 0;
        this.iniciarIntervaloAtualizacao();
        this.notificarListeners();
      } else {
        // Implementação React Native com expo-av
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
          const { sound } = await ExpoAudio.Sound.createAsync(
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
      }
    } catch (err) {
      console.error('Erro ao tocar áudio:', err);
      throw new Error(`Erro ao reproduzir áudio: ${err instanceof Error ? err.message : 'desconhecido'}`);
    }
  }

  // Pausa a reprodução
  async pausar(): Promise<void> {
    try {
      if (this.isWeb) {
        if (this.audioWeb && this.estado.tocando) {
          this.audioWeb.pause();
          this.estado.tocando = false;
          this.estado.pausado = true;
          this.pararIntervaloAtualizacao();
          this.notificarListeners();
        }
      } else {
        if (this.som && this.estado.tocando) {
          await this.som.pauseAsync();
          this.estado.tocando = false;
          this.estado.pausado = true;
          this.pararIntervaloAtualizacao();
          this.notificarListeners();
        }
      }
    } catch (err) {
      console.error('Erro ao pausar áudio:', err);
      throw err;
    }
  }

  // Retoma a reprodução
  async retomar(): Promise<void> {
    try {
      if (this.isWeb) {
        if (this.audioWeb && this.estado.pausado) {
          this.audioWeb.play();
          this.estado.tocando = true;
          this.estado.pausado = false;
          this.iniciarIntervaloAtualizacao();
          this.notificarListeners();
        }
      } else {
        if (this.som && this.estado.pausado) {
          await this.som.playAsync();
          this.estado.tocando = true;
          this.estado.pausado = false;
          this.iniciarIntervaloAtualizacao();
          this.notificarListeners();
        }
      }
    } catch (err) {
      console.error('Erro ao retomar áudio:', err);
      throw err;
    }
  }

  // Para completamente a reprodução
  async parar(): Promise<void> {
    try {
      if (this.isWeb) {
        if (this.audioWeb) {
          this.audioWeb.pause();
          this.audioWeb.currentTime = 0;
          this.estado.tocando = false;
          this.estado.pausado = false;
          this.estado.tempo = 0;
          this.pararIntervaloAtualizacao();
          this.notificarListeners();
        }
      } else {
        if (this.som) {
          await this.som.stopAsync();
          this.estado.tocando = false;
          this.estado.pausado = false;
          this.estado.tempo = 0;
          this.pararIntervaloAtualizacao();
          this.notificarListeners();
        }
      }
    } catch (err) {
      console.error('Erro ao parar áudio:', err);
      throw err;
    }
  }

  // Pula para uma posição específica (em ms)
  async buscar(posicaoMs: number): Promise<void> {
    try {
      if (this.isWeb) {
        if (this.audioWeb) {
          this.audioWeb.currentTime = posicaoMs / 1000;
          this.estado.tempo = posicaoMs;
          this.notificarListeners();
        }
      } else {
        if (this.som) {
          await this.som.setPositionAsync(posicaoMs);
          this.estado.tempo = posicaoMs;
          this.notificarListeners();
        }
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
      if (this.isWeb) {
        if (this.audioWeb) {
          this.audioWeb.pause();
          this.audioWeb.src = '';
          this.audioWeb = null;
        }
      } else {
        if (this.som) {
          await this.som.unloadAsync();
          this.som = null;
        }
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
