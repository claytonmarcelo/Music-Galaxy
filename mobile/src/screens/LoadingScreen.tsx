// Tela de Carregamento Premium - Splash screen com animação customizada
// Spinner elegante com breathing animation e mensagens dinâmicas

import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Platform,
} from 'react-native';
import { TIMINGS, EASING } from '../utils/animacoes';

interface Props {
  mensagem?: string;
  segundos?: number; // tempo aproximado de carregamento
  mostrarLogo?: boolean;
}

export default function LoadingScreen({
  mensagem = 'Carregando...',
  segundos = 3,
  mostrarLogo = true,
}: Props): React.JSX.Element {
  // Animações
  const spinnerRotateAnim = useRef(new Animated.Value(0)).current;
  const spinnerOpacityAnim = useRef(new Animated.Value(0.3)).current;
  const logoScaleAnim = useRef(new Animated.Value(0.8)).current;
  const messagemOpacityAnim = useRef(new Animated.Value(0)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Rotação infinita do spinner
    const spinnerLoop = Animated.loop(
      Animated.timing(spinnerRotateAnim, {
        toValue: 1,
        duration: 2000,
        useNativeDriver: true,
      })
    );

    // Breathing effect (opacity pulsante)
    const breathingLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(spinnerOpacityAnim, {
          toValue: 1,
          duration: 1200,
          useNativeDriver: true,
        }),
        Animated.timing(spinnerOpacityAnim, {
          toValue: 0.3,
          duration: 1200,
          useNativeDriver: true,
        }),
      ])
    );

    // Animação do logo
    Animated.spring(logoScaleAnim, {
      toValue: 1,
      useNativeDriver: true,
      ...EASING.suave,
    }).start();

    // Fade in da mensagem
    Animated.timing(messagemOpacityAnim, {
      toValue: 1,
      duration: TIMINGS.normal,
      useNativeDriver: true,
    }).start();

    // Barra de progresso (se houver tempo estimado)
    if (segundos > 0) {
      Animated.timing(progressAnim, {
        toValue: 1,
        duration: segundos * 1000 * 0.8, // 80% do tempo (os últimos 20% ficam indeterminados)
        useNativeDriver: false,
      }).start();
    }

    spinnerLoop.start();
    breathingLoop.start();

    return () => {
      spinnerLoop.stop();
      breathingLoop.stop();
    };
  }, [spinnerRotateAnim, spinnerOpacityAnim, logoScaleAnim, messagemOpacityAnim, progressAnim, segundos]);

  // Interpolação de rotação (0-1 para 0-360deg)
  const spinnerRotate = spinnerRotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  // Interpolação de progresso
  const progressWidth = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  return (
    <View style={styles.container}>
      {/* Logo/Ícone com animação de escala */}
      {mostrarLogo && (
        <Animated.View
          style={[
            styles.logoContainer,
            {
              transform: [{ scale: logoScaleAnim }],
            },
          ]}
        >
          <Text style={styles.logo}>🎵</Text>
        </Animated.View>
      )}

      {/* Spinner animado */}
      <Animated.View
        style={[
          styles.spinnerContainer,
          {
            opacity: spinnerOpacityAnim,
          },
        ]}
      >
        <Animated.View
          style={[
            styles.spinner,
            {
              transform: [{ rotate: spinnerRotate }],
            },
          ]}
        >
          {/* Segmentos do spinner */}
          <View style={[styles.spinnerSegmento, styles.seg1]} />
          <View style={[styles.spinnerSegmento, styles.seg2]} />
          <View style={[styles.spinnerSegmento, styles.seg3]} />
          <View style={[styles.spinnerSegmento, styles.seg4]} />
        </Animated.View>
      </Animated.View>

      {/* Mensagem com fade in */}
      <Animated.View
        style={[
          styles.messagemContainer,
          {
            opacity: messagemOpacityAnim,
          },
        ]}
      >
        <Text style={styles.mensagem}>{mensagem}</Text>
      </Animated.View>

      {/* Barra de progresso (se aplicável) */}
      {segundos > 0 && (
        <View style={styles.progressoContainer}>
          <Animated.View
            style={[
              styles.progressoBar,
              {
                width: progressWidth,
              },
            ]}
          />
        </View>
      )}

      {/* Texto inspirador */}
      <Text style={styles.textoInsirador}>Music Galaxy</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F0F1A',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },

  logoContainer: {
    marginBottom: 40,
  },

  logo: {
    fontSize: 72,
    fontWeight: '800',
  },

  spinnerContainer: {
    marginBottom: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },

  spinner: {
    width: 80,
    height: 80,
    justifyContent: 'center',
    alignItems: 'center',
  },

  spinnerSegmento: {
    position: 'absolute',
    width: 12,
    height: 12,
    borderRadius: 6,
  },

  seg1: {
    backgroundColor: '#1DB954',
    top: 0,
    alignSelf: 'center',
  },

  seg2: {
    backgroundColor: '#1DB95480',
    right: 0,
    alignSelf: 'center',
  },

  seg3: {
    backgroundColor: '#1DB95440',
    bottom: 0,
    alignSelf: 'center',
  },

  seg4: {
    backgroundColor: '#1DB95420',
    left: 0,
    alignSelf: 'center',
  },

  messagemContainer: {
    marginBottom: 32,
  },

  mensagem: {
    fontSize: 16,
    color: '#8080A0',
    textAlign: 'center',
    fontWeight: '500',
    letterSpacing: 0.3,
  },

  progressoContainer: {
    width: '100%',
    height: 3,
    backgroundColor: '#1A1A2E',
    borderRadius: 2,
    marginBottom: 40,
    overflow: 'hidden',
  },

  progressoBar: {
    height: '100%',
    backgroundColor: '#1DB954',
    borderRadius: 2,
  },

  textoInsirador: {
    position: 'absolute',
    bottom: 40,
    fontSize: 14,
    color: '#505070',
    fontWeight: '600',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
});
