// Cartão animado de vidro fosco.
// Entrada suave (fade + deslocamento/escala) e leve compressão ao toque.
// A superfície usa os tokens de vidro do tema e mantém o fio de luz no topo.

import React, { useRef, useEffect, memo } from 'react';
import {
  View,
  StyleSheet,
  Animated,
  ViewStyle,
} from 'react-native';
import { useTheme } from '../contexts/ThemeContext';
import { USE_NATIVE_DRIVER } from '../utils/animacoes';

interface AnimatedCardProps {
  children: React.ReactNode;
  style?: ViewStyle;
  onPress?: () => void;
  delay?: number;
  animationType?: 'fadeIn' | 'slideUp' | 'scale' | 'rotate';
}

function AnimatedCardComponent({
  children,
  style,
  onPress,
  delay = 0,
  animationType = 'fadeIn',
}: AnimatedCardProps): React.JSX.Element {
  const { colors } = useTheme();
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(24)).current;
  const scaleAnim = useRef(new Animated.Value(0.96)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;
  const pressScale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const animacoes = {
      fadeIn: () =>
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 420,
          delay,
          useNativeDriver: USE_NATIVE_DRIVER,
        }),
      slideUp: () =>
        Animated.parallel([
          Animated.timing(fadeAnim, {
            toValue: 1,
            duration: 420,
            delay,
            useNativeDriver: USE_NATIVE_DRIVER,
          }),
          Animated.timing(slideAnim, {
            toValue: 0,
            duration: 460,
            delay,
            useNativeDriver: USE_NATIVE_DRIVER,
          }),
        ]),
      scale: () =>
        Animated.parallel([
          Animated.timing(fadeAnim, {
            toValue: 1,
            duration: 320,
            delay,
            useNativeDriver: USE_NATIVE_DRIVER,
          }),
          Animated.spring(scaleAnim, {
            toValue: 1,
            delay,
            useNativeDriver: USE_NATIVE_DRIVER,
            tension: 45,
            friction: 14,
          }),
        ]),
      rotate: () =>
        Animated.parallel([
          Animated.timing(fadeAnim, {
            toValue: 1,
            duration: 420,
            delay,
            useNativeDriver: USE_NATIVE_DRIVER,
          }),
          Animated.timing(rotateAnim, {
            toValue: 1,
            duration: 460,
            delay,
            useNativeDriver: USE_NATIVE_DRIVER,
          }),
        ]),
    };

    animacoes[animationType]().start();
  }, [delay, animationType, fadeAnim, slideAnim, scaleAnim, rotateAnim]);

  const aoPressionar = () => {
    Animated.spring(pressScale, {
      toValue: 0.985,
      useNativeDriver: USE_NATIVE_DRIVER,
      tension: 80,
      friction: 14,
    }).start();
  };

  const aoSoltar = () => {
    Animated.spring(pressScale, {
      toValue: 1,
      useNativeDriver: USE_NATIVE_DRIVER,
      tension: 80,
      friction: 14,
    }).start();
  };

  const transformar = () => {
    switch (animationType) {
      case 'slideUp':
        return [{ translateY: slideAnim }];
      case 'scale':
        return [{ scale: scaleAnim }];
      case 'rotate':
        return [
          {
            rotate: rotateAnim.interpolate({
              inputRange: [0, 1],
              outputRange: ['-4deg', '0deg'],
            }),
          },
        ];
      default:
        return [];
    }
  };

  const cartao = (
    <Animated.View
      style={[
        styles.card,
        {
          backgroundColor: colors.glassCard,
          borderColor: colors.glassBorder,
          shadowColor: colors.glassShadow,
          opacity: fadeAnim,
          transform: [...transformar(), { scale: pressScale }],
        },
        style,
      ]}
      onTouchStart={onPress ? aoPressionar : undefined}
      onTouchEnd={onPress ? aoSoltar : undefined}
    >
      <View
        pointerEvents="none"
        style={[styles.brilho, { backgroundColor: colors.glassHighlight }]}
      />
      {children}
    </Animated.View>
  );

  return cartao;
}

export default memo(AnimatedCardComponent);

const styles = StyleSheet.create({
  card: {
    borderRadius: 26,
    padding: 16,
    borderWidth: 1,
    overflow: 'hidden',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 18,
    elevation: 4,
  },
  brilho: {
    position: 'absolute',
    top: 0,
    left: 28,
    right: 28,
    height: 1,
    opacity: 0.55,
  },
});
