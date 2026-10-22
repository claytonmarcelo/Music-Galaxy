// Componente de controles de player de áudio.
// Exibe botões play/pause, slider de progresso, tempo e duração.
// Visual premium com vidro fosco, animações e micro-interações.

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
import { useTheme } from '../contexts/ThemeContext';
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
  const { colors } = useTheme();
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
        const mensagem = 'Nenhuma fonte de áudio disponível para esta versão.';
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
          // Painel do player em vidro mais opaco, com contorno e sombra do tema
          backgroundColor: colors.glassCardForte,
          borderColor: colors.glassBorder,
          shadowColor: colors.glassShadow,
        },
      ]}
    >
      {/* Info do áudio */}
      <View style={styles.info}>
        <Text style={[styles.titulo, { color: colors.text }]} numberOfLines={1}>
          ♫ {titulo}
        </Text>
        <Text style={[styles.artista, { color: colors.textSecondary }]} numberOfLines={1}>
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
          minimumTrackTintColor={colors.primary}
          maximumTrackTintColor={colors.border}
          thumbTintColor={colors.primary}
          disabled={!estado.duracao}
        />
        <View style={styles.tempoContainer}>
          <Text style={[styles.tempoTexto, { color: colors.textSecondary }]}>
            {formatarTempo(estado.tempo)}
          </Text>
          <Text style={[styles.tempoTexto, { color: colors.textSecondary }]}>
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
              { backgroundColor: colors.primary },
              estado.tocando && [styles.botaoPlayAtivo, { borderColor: colors.accent }],
            ]}
            onPress={handlePlayPause}
            disabled={carregando}
            activeOpacity={0.7}
            accessibilityLabel={estado.tocando ? 'Pausar reprodução' : 'Iniciar reprodução'}
          >
            {carregando ? (
              <ActivityIndicator size="small" color={colors.buttonText} />
            ) : (
              <Text style={[styles.botaoTexto, { color: colors.buttonText }]}>
                {estado.tocando ? '⏸' : '▶️'}
              </Text>
            )}
          </TouchableOpacity>
        </Animated.View>

        {/* Botão Stop */}
        <TouchableOpacity
          style={[
            styles.botao,
            styles.botaoStop,
            { backgroundColor: colors.glassCard, borderColor: colors.error },
          ]}
          onPress={handleStop}
          disabled={carregando}
          activeOpacity={0.7}
          accessibilityLabel="Parar reprodução"
        >
          <Text style={[styles.botaoTexto, { color: colors.error }]}>⏹</Text>
        </TouchableOpacity>
      </View>

      {/* Mensagem de erro */}
      {erro && (
        <View style={[styles.erroContainer, { backgroundColor: colors.glassCard, borderLeftColor: colors.error }]}>
          <Text style={styles.erroIcone}>⚠️</Text>
          <Text style={[styles.erroTexto, { color: colors.error }]}>{erro}</Text>
        </View>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 16,
    padding: 20,
    marginHorizontal: 16,
    marginVertical: 12,
    borderWidth: 1,
    // Contorno e sombra de vidro: as cores vêm do tema, aplicadas em linha
    ...Platform.select({
      ios: {
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.25,
        shadowRadius: 12,
      },
      android: {
        elevation: 5,
      },
    }),
  },

  info: {
    marginBottom: 16,
  },

  titulo: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 4,
    letterSpacing: 0.3,
  },

  artista: {
    fontSize: 13,
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
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
      },
      android: {
        elevation: 5,
      },
    }),
  },

  botaoPlayAtivo: {
    borderWidth: 2,
  },

  botaoStop: {
    borderWidth: 2,
  },

  botaoTexto: {
    fontSize: 24,
    fontWeight: '700',
  },

  erroContainer: {
    borderRadius: 10,
    padding: 12,
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    borderLeftWidth: 3,
  },

  erroIcone: {
    fontSize: 18,
    marginRight: 8,
  },

  erroTexto: {
    fontSize: 12,
    fontWeight: '600',
    flex: 1,
  },
});
