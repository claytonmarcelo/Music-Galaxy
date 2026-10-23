// Cartão de vidro fosco minimalista.
// Superfície translúcida de cantos amplos, contorno de 1 px, fio de luz
// na borda superior e sombra muito suave — a base de toda a interface.

import React from 'react';
import { StyleSheet, View, ViewStyle, StyleProp } from 'react-native';
import { useTheme } from '../contexts/ThemeContext';

interface GlassCardProps {
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  forte?: boolean; // vidro mais opaco (modais, navegação, player)
  semBrilho?: boolean; // remove o fio de luz da borda superior
}

export default function GlassCard({
  children,
  style,
  forte = false,
  semBrilho = false,
}: GlassCardProps): React.JSX.Element {
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
    borderRadius: 26,
    padding: 18,
    overflow: 'hidden',
    shadowOpacity: 0.2,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
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
