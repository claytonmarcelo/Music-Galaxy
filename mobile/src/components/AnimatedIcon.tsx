// Ícone Animado com Emojis Personalizados
// Ícones estilizados com animações e emojis personalizados

import React, { useRef, useEffect } from 'react';
import { Animated, StyleSheet, Text, ViewStyle } from 'react-native';
import { useTheme } from '../contexts/ThemeContext';

interface AnimatedIconProps {
  emoji: string;
  size?: number;
  style?: ViewStyle;
  animate?: boolean;
  animationType?: 'pulse' | 'bounce' | 'rotate' | 'scale';
  color?: string;
}

export default function AnimatedIcon({
  emoji,
  size = 24,
  style,
  animate = true,
  animationType = 'pulse',
  color,
}: AnimatedIconProps): React.JSX.Element {
  const { colors } = useTheme();
  const animValue = useRef(new Animated.Value(1)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!animate) return;

    const animations = {
      pulse: () => {
        Animated.loop(
          Animated.sequence([
            Animated.timing(animValue, {
              toValue: 1.2,
              duration: 800,
              useNativeDriver: false,
            }),
            Animated.timing(animValue, {
              toValue: 1,
              duration: 800,
              useNativeDriver: false,
            }),
          ])
        ).start();
      },
      bounce: () => {
        Animated.loop(
          Animated.sequence([
            Animated.spring(animValue, {
              toValue: 0.8,
              useNativeDriver: false,
            }),
            Animated.spring(animValue, {
              toValue: 1.2,
              useNativeDriver: false,
            }),
            Animated.spring(animValue, {
              toValue: 1,
              useNativeDriver: false,
            }),
          ])
        ).start();
      },
      rotate: () => {
        Animated.loop(
          Animated.timing(rotateAnim, {
            toValue: 1,
            duration: 2000,
            useNativeDriver: false,
          })
        ).start();
      },
      scale: () => {
        Animated.loop(
          Animated.sequence([
            Animated.timing(animValue, {
              toValue: 1.3,
              duration: 500,
              useNativeDriver: false,
            }),
            Animated.timing(animValue, {
              toValue: 0.7,
              duration: 500,
              useNativeDriver: false,
            }),
            Animated.timing(animValue, {
              toValue: 1,
              duration: 500,
              useNativeDriver: false,
            }),
          ])
        ).start();
      },
    };

    animations[animationType]();
  }, [animate, animationType]);

  const transformStyle = animationType === 'rotate'
    ? { transform: [{ rotate: rotateAnim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] }) }] }
    : { transform: [{ scale: animValue }] };

  return (
    <Animated.View style={[styles.container, transformStyle, style]}>
      <Text style={[styles.emoji, { fontSize: size, color: color || colors.icon }]}>
        {emoji}
      </Text>
    </Animated.View>
  );
}

// Biblioteca de emojis personalizados para o Music Galaxy
export const MusicEmojis = {
  // Controles de player
  play: '▶️',
  pause: '⏸️',
  stop: '⏹️',
  next: '⏭️',
  previous: '⏮️',
  shuffle: '🔀',
  repeat: '🔁',
  repeatOne: '🔂',
  
  // Qualidade de áudio
  quality: '🎵',
  flac: '💎',
  mp3: '🎧',
  lossless: '✨',
  
  // Ações
  download: '⬇️',
  upload: '⬆️',
  share: '📤',
  favorite: '❤️',
  favoriteFilled: '💖',
  search: '🔍',
  filter: '🎚️',
  sort: '📊',
  
  // Categorias
  album: '💿',
  single: '🎵',
  ep: '📀',
  compilation: '📚',
  live: '🎤',
  remix: '🎹',
  instrumental: '🎻',
  playback: '🎼',
  
  // Estado
  loading: '⏳',
  success: '✅',
  error: '❌',
  warning: '⚠️',
  info: 'ℹ️',
  
  // Interface
  menu: '☰',
  settings: '⚙️',
  profile: '👤',
  library: '📚',
  explore: '🌍',
  trending: '🔥',
  new: '🆕',
  
  // Música
  artist: '🎤',
  work: '🎼',
  release: '💿',
  genre: '🎸',
  year: '📅',
  country: '🌎',
  
  // Feedback
  like: '👍',
  dislike: '👎',
  star: '⭐',
  starFilled: '🌟',
  heart: '❤️',
  
  // Tema
  sun: '☀️',
  moon: '🌙',
  auto: '🌓',
};

const styles = StyleSheet.create({
  container: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  emoji: {
    textAlign: 'center',
  },
});
