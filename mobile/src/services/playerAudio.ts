// Serviço de reprodução de áudio para o Music Galaxy.
// Gerencia playback de faixas musicais com suporte a:
// - expo-audio (React Native: iOS, Android) — módulo oficial do SDK 57
// - HTML5 Audio (Web: browser)
// Mantém estado de reprodução (tocando, pausado, parado).

import { Platform } from 'react-native';
import type { AudioPlayer, AudioStatus } from 'expo-audio';

// Módulo expo-audio carregado apenas em ambiente React Native (nunca no web)
let ExpoAudio: typeof import('expo-audio') | null = null;
if (Platform.OS !== 'web') {
  try {
    ExpoAudio = require('expo-audio');
  } catch (e) {
    console.warn('expo-audio não disponível');
  }
}

export interface EstadoPlayer {
  tocando: boolean;
  pausado: boolean;
  tempo: number;      // milissegundos
  duracao: number;    // milissegundos
  urlAtual: string | null;
}

class PlayerAudio {
  private som: AudioPlayer | null = null;
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
    // Configura o modo de áudio global apenas em React Native:
    // toca em modo silencioso no iOS e faz "ducking" (abaixa outros sons) no Android
    if (!this.isWeb && ExpoAudio?.setAudioModeAsync) {
      ExpoAudio.setAudioModeAsync({
        playsInSilentMode: true,
        shouldPlayInBackground: true,
        interruptionMode: 'duckOthers',
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

  // Inicia atualização periódica do tempo (usada apenas na Web, que não emite status)
  private iniciarIntervaloAtualizacao(): void {
    if (this.intervaloAtualizacao) clearInterval(this.intervaloAtualizacao);
    this.intervaloAtualizacao = setInterval(() => {
      if (this.audioWeb && this.estado.tocando) {
        this.estado.tempo = (this.audioWeb.currentTime ?? 0) * 1000;
        this.notificarListeners();
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

  // Configura o listener de status do player nativo:
  // o expo-audio emite playbackStatusUpdate a cada 500ms (padrão),
  // então não precisamos de intervalo manual para atualizar tempo/duração/fim.
  private observarPlayerNativo(player: AudioPlayer): void {
    player.addListener('playbackStatusUpdate', (status: AudioStatus) => {
      // Só espelha estado quando a faixa realmente carregou
      if (status.isLoaded) {
        this.estado.tempo = status.currentTime * 1000;
        this.estado.duracao = status.duration * 1000;
      }
      if (status.didJustFinish) {
        this.estado.tocando = false;
        this.estado.pausado = false;
        this.estado.tempo = 0;
      }
      this.notificarListeners();
    });
  }

  // Carrega e toca uma faixa
  async tocar(url: string): Promise<void> {
    try {
      if (this.isWeb) {
        // Implementação Web com HTML5 Audio
        // Recria elemento sempre que a URL muda para evitar estado corrompido
        if (!this.audioWeb || this.estado.urlAtual !== url) {
          if (this.audioWeb) {
            this.audioWeb.pause();
            this.audioWeb.src = '';
          }
          if (typeof document === 'undefined') {
            throw new Error('HTML5 Audio não disponível neste navegador');
          }
          this.audioWeb = document.createElement('audio');
          this.audioWeb.crossOrigin = 'anonymous';
          this.audioWeb.preload = 'auto';

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

          this.audioWeb.src = url;
          this.estado.urlAtual = url;
        }

        await this.audioWeb.play();

        this.estado.tocando = true;
        this.estado.pausado = false;
        this.iniciarIntervaloAtualizacao();
        this.notificarListeners();
      } else {
        // Implementação React Native com expo-audio
        // Se há um player carregado com outra URL, descarta primeiro
        if (this.som && this.estado.urlAtual !== url) {
          this.som.remove();
          this.som = null;
        }

        // Se é a mesma URL e está pausada, retoma
        if (this.som && this.estado.urlAtual === url && this.estado.pausado) {
          this.som.play();
          this.estado.tocando = true;
          this.estado.pausado = false;
          this.notificarListeners();
          return;
        }

        // Cria novo player para a URL
        if (!this.som || this.estado.urlAtual !== url) {
          if (!ExpoAudio) {
            throw new Error('expo-audio não disponível neste ambiente');
          }
          const player = ExpoAudio.createAudioPlayer({ uri: url });
          this.observarPlayerNativo(player);
          player.play();

          this.som = player;
          this.estado.urlAtual = url;
          this.estado.tocando = true;
          this.estado.pausado = false;
          this.estado.tempo = 0;
          this.notificarListeners();
        }
      }
    } catch (err) {
      console.error('Erro ao tocar áudio:', err);

      const nomeErro = (err as { name?: string }).name;
      const mensagemTecnica = err instanceof Error ? err.message : String(err);

      // Política de autoplay do navegador: o play() só é liberado após um
      // gesto real do usuário. O texto técnico em inglês não deve aparecer
      // na interface, então trocamos por uma orientação em português.
      const bloqueioAutoplay = this.isWeb && (
        nomeErro === 'NotAllowedError' ||
        /user didn't interact|user gesture|not allowed/i.test(mensagemTecnica)
      );

      if (bloqueioAutoplay) {
        throw new Error('O navegador bloqueou o áudio. Toque em Reproduzir novamente.');
      }

      // Erros de mídia do navegador (stream 404, formato não suportado etc.)
      // viram mensagem amigável em pt-BR, sem expor o texto técnico do HTML5 Audio.
      const erroDeMidiaWeb = this.isWeb && (
        nomeErro === 'NotSupportedError' ||
        /supported source|no supported|failed to load/i.test(mensagemTecnica) ||
        Boolean(this.audioWeb?.error)
      );

      if (erroDeMidiaWeb) {
        throw new Error('Nenhuma fonte de áudio aberta disponível para esta versão.');
      }

      throw new Error(`Erro ao reproduzir áudio: ${mensagemTecnica}`);
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
          this.som.pause();
          this.estado.tocando = false;
          this.estado.pausado = true;
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
          // O play() da web devolve uma Promise: aguardar garante que um
          // bloqueio do navegador seja tratado em vez de virar rejeição solta.
          await this.audioWeb.play();
          this.estado.tocando = true;
          this.estado.pausado = false;
          this.iniciarIntervaloAtualizacao();
          this.notificarListeners();
        }
      } else {
        if (this.som && this.estado.pausado) {
          this.som.play();
          this.estado.tocando = true;
          this.estado.pausado = false;
          this.notificarListeners();
        }
      }
    } catch (err) {
      console.error('Erro ao retomar áudio:', err);
      throw err;
    }
  }

  // Para completamente a reprodução (pausa e volta ao início)
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
          this.som.pause();
          try {
            await this.som.seekTo(0);
          } catch {
            // Se não foi possível voltar ao início, descarta o player:
            // o próximo tocar() cria um novo do zero
            this.som.remove();
            this.som = null;
          }
          this.estado.tocando = false;
          this.estado.pausado = false;
          this.estado.tempo = 0;
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
          // expo-audio trabalha em segundos
          await this.som.seekTo(posicaoMs / 1000);
          this.estado.tempo = posicaoMs;
          this.notificarListeners();
        }
      }
    } catch (err) {
      console.error('Erro ao buscar posição:', err);
      throw err;
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
          this.som.remove();
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
