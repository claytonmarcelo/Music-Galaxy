// Botão compacto de alternância entre o tema claro e o escuro.
// Fica no cabeçalho da busca, ao lado dos atalhos de fila e favoritos.
// O ícone gira ao trocar de tema, o que dá a sensação de um interruptor
// físico sem inventar cores fora dos tokens do projeto.

import React, { useEffect, useRef } from 'react';
import { StyleSheet, TouchableOpacity, Animated } from 'react-native';
import { useTheme } from '../contexts/ThemeContext';
import Icone from './Icone';
import { USE_NATIVE_DRIVER } from '../utils/animacoes';

interface Props {
  onAlternar: () => void;
}

export default function BotaoTema({ onAlternar }: Props): React.JSX.Element {
  const { colors, isDark } = useTheme();

  // Gira o ícone 180° a cada troca de tema.
  const giroAnim = useRef(new Animated.Value(isDark ? 1 : 0)).current;

  useEffect(() => {
    Animated.timing(giroAnim, {
      toValue: isDark ? 1 : 0,
      duration: 320,
      useNativeDriver: USE_NATIVE_DRIVER,
    }).start();
  }, [isDark, giroAnim]);

  const rotacao = giroAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '180deg'],
  });

  return (
    <TouchableOpacity
      style={[
        styles.botao,
        { backgroundColor: colors.glassCard, borderColor: colors.glassBorder },
      ]}
      onPress={onAlternar}
      activeOpacity={0.75}
      accessibilityRole="switch"
      accessibilityState={{ checked: isDark }}
      accessibilityLabel={
        isDark ? 'Mudar para o tema claro' : 'Mudar para o tema escuro'
      }
    >
      <Animated.View style={{ transform: [{ rotate: rotacao }] }}>
        <Icone nome={isDark ? 'lua' : 'sol'} tamanho={18} cor={colors.text} />
      </Animated.View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  botao: {
    width: 44,
    height: 44,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
