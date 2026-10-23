// Sistema de Animações Globais Premium
// Fornece configurações e presets para animações suaves e elegantes
// Suporta Web (sem useNativeDriver) e Mobile/Native (com useNativeDriver)

import { Animated, Platform } from 'react-native';

// Detectar se está em Web
const IS_WEB = Platform.OS === 'web';
// Em Web, não usar useNativeDriver (o módulo nativo de animação não existe e o
// React Native Web avisa e cai para animação em JS). Exportado para que os
// componentes usem animação nativa no Android/iOS sem gerar o aviso na web.
export const USE_NATIVE_DRIVER = !IS_WEB;

/**
 * Configurações de timing padrão para animações
 * Seguem princípios de design premium com velocidades suaves
 */
export const TIMINGS = {
  // Transições rápidas (micro-interações)
  rapida: 200,
  // Transições normais (padrão)
  normal: 300,
  // Transições lentas (destaque)
  lenta: 500,
  // Transições muito lentas (foco)
  muitoLenta: 800,
};

/**
 * Configurações de Easing para diferentes tipos de animação
 */
export const EASING = {
  // Saída rápida, entrada lenta (bouncy)
  bouncy: { tension: 65, friction: 11 },
  // Saída suave, entrada suave
  suave: { tension: 40, friction: 15 },
  // Saída muito suave (elegante)
  muitoSuave: { tension: 30, friction: 20 },
};

/**
 * Animação de fade in/out
 */
export const fadeInOut = (
  animValue: Animated.Value,
  isVisible: boolean,
  duration = TIMINGS.normal
) => {
  Animated.timing(animValue, {
    toValue: isVisible ? 1 : 0,
    duration,
    useNativeDriver: USE_NATIVE_DRIVER,
  }).start();
};

/**
 * Animação de escala com spring (entrada elegante)
 */
export const scaleSpring = (
  animValue: Animated.Value,
  isVisible: boolean,
  config = EASING.suave
) => {
  Animated.spring(animValue, {
    toValue: isVisible ? 1 : 0.7,
    useNativeDriver: USE_NATIVE_DRIVER,
    ...config,
  }).start();
};

/**
 * Animação de slide vertical
 */
export const slideVertical = (
  animValue: Animated.Value,
  isVisible: boolean,
  duration = TIMINGS.normal
) => {
  Animated.timing(animValue, {
    toValue: isVisible ? 0 : 50,
    duration,
    useNativeDriver: USE_NATIVE_DRIVER,
  }).start();
};

/**
 * Animação de slide horizontal
 */
export const slideHorizontal = (
  animValue: Animated.Value,
  isVisible: boolean,
  direction: 'left' | 'right' = 'left',
  duration = TIMINGS.normal
) => {
  const finalValue = isVisible ? 0 : (direction === 'left' ? -50 : 50);

  Animated.timing(animValue, {
    toValue: finalValue,
    duration,
    useNativeDriver: USE_NATIVE_DRIVER,
  }).start();
};

/**
 * Animação de pulsação (pulse/heartbeat)
 */
export const pulsar = (
  animValue: Animated.Value,
  shouldPulse: boolean,
  duration = 1000
) => {
  if (!shouldPulse) {
    animValue.setValue(1);
    return;
  }

  Animated.loop(
    Animated.sequence([
      Animated.timing(animValue, {
        toValue: 1.1,
        duration: duration / 2,
        useNativeDriver: USE_NATIVE_DRIVER,
      }),
      Animated.timing(animValue, {
        toValue: 1,
        duration: duration / 2,
        useNativeDriver: USE_NATIVE_DRIVER,
      }),
    ])
  ).start();
};

/**
 * Animação de girar (rotate)
 */
export const girar = (
  animValue: Animated.Value,
  shouldRotate: boolean,
  duration = 800
) => {
  if (!shouldRotate) {
    animValue.setValue(0);
    return;
  }

  Animated.loop(
    Animated.timing(animValue, {
      toValue: 1,
      duration,
      useNativeDriver: USE_NATIVE_DRIVER,
    })
  ).start();
};

/**
 * Interpola valor de rotação (0 a 1) para graus (0 a 360)
 */
export const interpolarRotacao = (animValue: Animated.Value): Animated.AnimatedInterpolation<string> => {
  return animValue.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });
};

/**
 * Interpola valor de escala (0 a 1) para (0.7 a 1)
 */
export const interpolarEscala = (animValue: Animated.Value): Animated.AnimatedInterpolation<number> => {
  return animValue.interpolate({
    inputRange: [0, 1],
    outputRange: [0.7, 1],
  });
};

/**
 * Animação sequencial com múltiplos valores
 */
export const sequencial = (
  animacoes: Array<Animated.CompositeAnimation>,
  aoTerminar?: () => void
) => {
  Animated.sequence(animacoes).start(aoTerminar);
};

/**
 * Animação paralela com múltiplos valores
 */
export const paralelo = (
  animacoes: Animated.CompositeAnimation[]
) => {
  Animated.parallel(animacoes).start();
};

/**
 * Delay antes de iniciar animação
 */
export const comDelay = (
  animacao: Animated.CompositeAnimation,
  delayMs: number
): Promise<void> => {
  return new Promise(resolve => {
    setTimeout(() => {
      animacao.start(() => resolve());
    }, delayMs);
  });
};

/**
 * Transição suave entre valores
 */
export const transicaoSuave = (
  animValue: Animated.Value,
  fromValue: number,
  toValue: number,
  duration = TIMINGS.normal
) => {
  animValue.setValue(fromValue);
  Animated.timing(animValue, {
    toValue,
    duration,
    useNativeDriver: USE_NATIVE_DRIVER,
  }).start();
};

/**
 * Bounce effect (efeito de pulo)
 */
export const bounce = (animValue: Animated.Value) => {
  Animated.sequence([
    Animated.spring(animValue, {
      toValue: -10,
      useNativeDriver: USE_NATIVE_DRIVER,
      tension: 100,
      friction: 10,
    }),
    Animated.spring(animValue, {
      toValue: 0,
      useNativeDriver: USE_NATIVE_DRIVER,
      tension: 100,
      friction: 10,
    }),
  ]).start();
};

/**
 * Shake effect (efeito de tremor)
 */
export const shake = (animValue: Animated.Value, intensity = 10) => {
  Animated.sequence([
    Animated.timing(animValue, { toValue: intensity, duration: 100, useNativeDriver: USE_NATIVE_DRIVER }),
    Animated.timing(animValue, { toValue: -intensity, duration: 100, useNativeDriver: USE_NATIVE_DRIVER }),
    Animated.timing(animValue, { toValue: intensity, duration: 100, useNativeDriver: USE_NATIVE_DRIVER }),
    Animated.timing(animValue, { toValue: 0, duration: 100, useNativeDriver: USE_NATIVE_DRIVER }),
  ]).start();
};
