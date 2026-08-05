// Componente de controles de player de áudio.
// Exibe botões play/pause, slider de progresso, tempo e duração.
// Design premium com glassmorphism, animações e micro-interações.

import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Platform,
  Animated,
} from 'react-native';
import SliderModule from '@react-native-community/slider';
import { playerAudio, EstadoPlayer } from '../services/playerAudio';
import { useModal } from '../contexts/ModalContext';
import { TIMINGS, EASING } from '../utils/animacoes';

interface Props {
  url: string;
  titulo: string;
  artista: string;
}

const Slider = SliderModule as unknown as React.ComponentType<any>;

export default function PlayerControls({ url, titulo, artista }: Props): React.JSX.Element {
  const [estado, setEstado] = useState<EstadoPlayer>(playerAudio.obterEstado());
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const { toastErro, toastInfo } = useModal();

  // Animações
  const playButtonScaleAnim = useRef(new Animated.Value(1)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const fadeInAnim = useRef(new Animated.Value(0)).current;

  // Inscreve para mudanças de estado do player
  useEffect(() => {
    const unsubscribe = playerAudio.subscribe((novoEstado) => {
      setEstado(novoEstado);
    });

    // Anima entrada
    Animated.timing(fadeInAnim, {
      toValue: 1,
      duration: TIMINGS.normal,
      useNativeDriver: true,
    }).start();

    return () => unsubscribe();
  }, [fadeInAnim]);

  // Limpa quando unmount
  useEffect(() => {
    return () => {
      playerAudio.descarregar();
    };
  }, []);

  // Anima pulse quando tocando
  useEffect(() => {
    if (estado.tocando) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.1,
            duration: 800,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 800,
            useNativeDriver: true,
          }),
        ])
      ).start();
    } else {
      pulseAnim.setValue(1);
    }
  }, [estado.tocando, pulseAnim]);

  const handlePlayPause = async () => {
    try {
      if (!url) {
        const mensagem = 'Nenhuma URL de áudio original disponível para esta release.';
        setErro(mensagem);
        toastErro(mensagem);
        return;
      }

      // Anima botão ao clicar
      Animated.sequence([
        Animated.spring(playButtonScaleAnim, {
          toValue: 0.9,
          useNativeDriver: true,
          ...EASING.suave,
        }),
        Animated.spring(playButtonScaleAnim, {
          toValue: 1,
          useNativeDriver: true,
          ...EASING.suave,
        }),
      ]).start();

      setCarregando(true);
      setErro(null);

      if (estado.tocando) {
        await playerAudio.pausar();
        toastInfo('Reprodução pausada');
      } else if (estado.pausado) {
        await playerAudio.retomar();
        toastInfo('Reprodução retomada');
      } else {
        await playerAudio.tocar(url);
        toastInfo('Reproduzindo...');
      }
    } catch (err) {
      const mensagem = err instanceof Error ? err.message : 'Erro ao controlar reprodução';
      setErro(mensagem);
      toastErro(mensagem);
    } finally {
      setCarregando(false);
    }
  };

  const handleStop = async () => {
    try {
      setCarregando(true);
      await playerAudio.parar();
      toastInfo('Reprodução parada');
    } catch (err) {
      const mensagem = err instanceof Error ? err.message : 'Erro ao parar reprodução';
      console.error('Erro ao parar:', err);
      toastErro(mensagem);
    } finally {
      setCarregando(false);
    }
  };

  const handleSliderChange = async (valor: number) => {
    try {
      const posicaoMs = valor * (estado.duracao || 1);
      await playerAudio.buscar(posicaoMs);
    } catch (err) {
      console.error('Erro ao buscar posição:', err);
    }
  };

  const formatarTempo = (ms: number): string => {
    if (ms <= 0 || !ms) return '0:00';
    const segundos = Math.floor(ms / 1000);
    const minutos = Math.floor(segundos / 60);
    const segs = segundos % 60;
    return `${minutos}:${segs.toString().padStart(2, '0')}`;
  };

  const progresso = estado.duracao ? estado.tempo / estado.duracao : 0;

  return (
    <Animated.View
      style={[
        styles.container,
        {
          opacity: fadeInAnim,
        },
      ]}
    >
      {/* Info do áudio */}
      <View style={styles.info}>
        <Text style={styles.titulo} numberOfLines={1}>
          ♫ {titulo}
        </Text>
        <Text style={styles.artista} numberOfLines={1}>
          {artista}
        </Text>
      </View>

      {/* Barra de progresso premium */}
      <View style={styles.progressoContainer}>
        <Slider
          style={styles.slider}
          minimumValue={0}
          maximumValue={1}
          value={progresso}
          onValueChange={handleSliderChange}
          minimumTrackTintColor="#1DB954"
          maximumTrackTintColor="#2A2A4A"
          thumbTintColor="#1DB954"
          disabled={!estado.duracao}
        />
        <View style={styles.tempoContainer}>
          <Text style={styles.tempoTexto}>
            {formatarTempo(estado.tempo)}
          </Text>
          <Text style={styles.tempoTexto}>
            {formatarTempo(estado.duracao)}
          </Text>
        </View>
      </View>

      {/* Controles com animações */}
      <View style={styles.controlesContainer}>
        {/* Botão Play/Pause com pulse */}
        <Animated.View
          style={{
            transform: [
              { scale: playButtonScaleAnim },
              { scale: pulseAnim },
            ],
          }}
        >
          <TouchableOpacity
            style={[
              styles.botao,
              styles.botaoPlay,
              estado.tocando && styles.botaoPlayAtivo,
            ]}
            onPress={handlePlayPause}
            disabled={carregando}
            activeOpacity={0.7}
            accessibilityLabel={estado.tocando ? 'Pausar reprodução' : 'Iniciar reprodução'}
          >
            {carregando ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Text style={styles.botaoTexto}>
                {estado.tocando ? '⏸' : '▶️'}
              </Text>
            )}
          </TouchableOpacity>
        </Animated.View>

        {/* Botão Stop */}
        <TouchableOpacity
          style={[styles.botao, styles.botaoStop]}
          onPress={handleStop}
          disabled={carregando}
          activeOpacity={0.7}
          accessibilityLabel="Parar reprodução"
        >
          <Text style={styles.botaoTexto}>⏹</Text>
        </TouchableOpacity>
      </View>

      {/* Mensagem de erro */}
      {erro && (
        <View style={styles.erroContainer}>
          <Text style={styles.erroIcone}>⚠️</Text>
          <Text style={styles.erroTexto}>{erro}</Text>
        </View>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#12121F',
    borderRadius: 16,
    padding: 20,
    marginHorizontal: 16,
    marginVertical: 12,
    borderWidth: 1,
    borderColor: '#1DB95420',
    ...Platform.select({
      ios: {
        shadowColor: '#1DB954',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.15,
        shadowRadius: 12,
      },
      android: {
        elevation: 6,
      },
    }),
  },

  info: {
    marginBottom: 16,
  },

  titulo: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 4,
    letterSpacing: 0.3,
  },

  artista: {
    fontSize: 13,
    color: '#8080A0',
    fontWeight: '500',
  },

  progressoContainer: {
    marginVertical: 14,
  },

  slider: {
    width: '100%',
    height: 6,
    borderRadius: 3,
  },

  tempoContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },

  tempoTexto: {
    fontSize: 11,
    color: '#606080',
    fontWeight: '600',
  },

  controlesContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 20,
    marginTop: 16,
  },

  botao: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
      },
      android: {
        elevation: 5,
      },
    }),
  },

  botaoPlay: {
    backgroundColor: '#1DB954',
  },

  botaoPlayAtivo: {
    backgroundColor: '#1DB954',
    borderWidth: 2,
    borderColor: '#1DB95480',
  },

  botaoStop: {
    backgroundColor: '#FF6B3520',
    borderWidth: 2,
    borderColor: '#FF6B35',
  },

  botaoTexto: {
    fontSize: 24,
    fontWeight: '700',
  },

  erroContainer: {
    backgroundColor: '#FF6B3520',
    borderRadius: 10,
    padding: 12,
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    borderLeftWidth: 3,
    borderLeftColor: '#FF6B35',
  },

  erroIcone: {
    fontSize: 18,
    marginRight: 8,
  },

  erroTexto: {
    fontSize: 12,
    color: '#FF6B35',
    fontWeight: '600',
    flex: 1,
  },
});
