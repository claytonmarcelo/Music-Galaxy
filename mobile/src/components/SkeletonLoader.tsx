// Componente Skeleton Loader
// Exibe placeholders animados durante o carregamento de conteúdo

import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated } from 'react-native';
import { useTheme } from '../contexts/ThemeContext';

interface SkeletonProps {
  width?: number | string;
  height?: number;
  style?: any;
}

export function Skeleton({ width = '100%', height = 20, style }: SkeletonProps): React.JSX.Element {
  const { colors } = useTheme();
  const opacityAnim = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(opacityAnim, {
          toValue: 0.7,
          duration: 800,
          useNativeDriver: false,
        }),
        Animated.timing(opacityAnim, {
          toValue: 0.3,
          duration: 800,
          useNativeDriver: false,
        }),
      ])
    );
    animation.start();
    return () => animation.stop();
  }, []);

  return (
    <Animated.View
      style={[
        styles.skeleton,
        {
          width,
          height,
          backgroundColor: colors.border,
          opacity: opacityAnim,
        },
        style,
      ]}
    />
  );
}

export function ReleaseCardSkeleton(): React.JSX.Element {
  const { colors } = useTheme();
  return (
    <View style={[styles.card, { backgroundColor: colors.card }]}>
      <Skeleton width={100} height={100} style={styles.cover} />
      <View style={styles.info}>
        <Skeleton width="80%" height={16} style={styles.title} />
        <Skeleton width="60%" height={14} style={styles.subtitle} />
        <Skeleton width="40%" height={12} style={styles.meta} />
        <View style={styles.badges}>
          <Skeleton width={60} height={20} />
          <Skeleton width={40} height={20} />
        </View>
      </View>
    </View>
  );
}

export function PlayerSkeleton(): React.JSX.Element {
  const { colors } = useTheme();
  return (
    <View style={[styles.playerContainer, { backgroundColor: colors.card }]}>
      <Skeleton width={48} height={48} style={styles.playerCover} />
      <View style={styles.playerInfo}>
        <Skeleton width="70%" height={16} />
        <Skeleton width="50%" height={14} />
      </View>
      <View style={styles.playerControls}>
        <Skeleton width={44} height={44} style={styles.playerButton} />
        <Skeleton width={44} height={44} style={styles.playerButton} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  skeleton: {
    borderRadius: 4,
  },
  card: {
    flexDirection: 'row',
    borderRadius: 12,
    marginHorizontal: 16,
    marginVertical: 6,
    padding: 10,
  },
  cover: {
    borderRadius: 8,
  },
  info: {
    flex: 1,
    marginLeft: 10,
  },
  title: {
    marginBottom: 4,
  },
  subtitle: {
    marginBottom: 4,
  },
  meta: {
    marginBottom: 8,
  },
  badges: {
    flexDirection: 'row',
    gap: 8,
  },
  playerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0, 0, 0, 0.1)',
  },
  playerCover: {
    borderRadius: 8,
    marginRight: 12,
  },
  playerInfo: {
    flex: 1,
  },
  playerControls: {
    flexDirection: 'row',
    gap: 8,
  },
  playerButton: {
    borderRadius: 22,
  },
});
