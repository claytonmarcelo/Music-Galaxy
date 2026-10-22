// GlassCard — cartão de vidro fosco da identidade visual Aurora.
// Fundo translúcido, contorno sutil, brilho na borda superior e sombra
// suave. Usado em cartões, seções, modais e no player.

import React from 'react';
import { StyleSheet, View, ViewStyle, StyleProp } from 'react-native';
import { useTheme } from '../contexts/ThemeContext';

interface GlassCardProps {
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  forte?: boolean; // vidro mais opaco (modais, navegação)
  semBrilho?: boolean; // remove o fio de luz da borda superior
}

export default function GlassCard({ children, style, forte = false, semBrilho = false }: GlassCardProps): React.JSX.Element {
  const { colors } = useTheme();

  return (
    <View
      style={[
        styles.cartao,
        {
          backgroundColor: forte ? colors.glassCardForte : colors.glassCard,
          borderColor: colors.glassBorder,
          shadowColor: colors.glassShadow,
        },
        style,
      ]}
    >
      {!semBrilho && (
        <View
          pointerEvents="none"
          style={[styles.brilho, { backgroundColor: colors.glassHighlight }]}
        />
      )}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  cartao: {
    borderWidth: 1,
    borderRadius: 20,
    padding: 16,
    overflow: 'hidden',
    // Sombra suave de vidro (iOS) e elevação (Android)
    shadowOpacity: 0.28,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 5,
  },
  brilho: {
    position: 'absolute',
    top: 0,
    left: 20,
    right: 20,
    height: 1.5,
    borderRadius: 2,
    opacity: 0.6,
  },
});
