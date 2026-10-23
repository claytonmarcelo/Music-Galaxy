// Botão compacto de alternância entre o tema claro e o escuro.
// Fica no cabeçalho da busca, ao lado dos atalhos de fila e favoritos.
//
// Desenho atual: o botão mantém a mesma forma dos outros atalhos do
// cabeçalho, mas traz um disco interno na cor principal onde o sol e a lua
// trocam de lugar com um giro suave. É o mesmo selo circular usado no
// rodapé e no seletor de Ajustes, então o controle de tema tem a mesma
// identidade visual em qualquer tela. Nenhuma cor é fixa: tudo vem dos
// tokens do tema.

import React, { useEffect, useRef } from 'react';
import { StyleSheet, TouchableOpacity, Animated } from 'react-native';
import { useTheme } from '../contexts/ThemeContext';
import Icone from './Icone';
import { comAlfa } from '../utils/cores';
import { USE_NATIVE_DRIVER } from '../utils/animacoes';

interface Props {
  onAlternar: () => void;
}

export default function BotaoTema({ onAlternar }: Props): React.JSX.Element {
  const { colors, isDark } = useTheme();

  // 0 = tema claro, 1 = tema escuro. O valor dirige o giro e o变故.
  const trocaAnim = useRef(new Animated.Value(isDark ? 1 : 0)).current;

  useEffect(() => {
    Animated.spring(trocaAnim, {
      toValue: isDark ? 1 : 0,
      stiffness: 180,
      damping: 17,
      mass: 0.8,
      useNativeDriver: USE_NATIVE_DRIVER,
    }).start();
  }, [isDark, trocaAnim]);

  const opacidadeSol = trocaAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 0],
  });

  const opacidadeLua = trocaAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 1],
  });

  const rotacao = trocaAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '180deg'],
  });

  const escala = trocaAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 0.82],
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
      <Animated.View
        style={[
          styles.disco,
          {
            backgroundColor: comAlfa(colors.primary, 0.14),
            borderColor: comAlfa(colors.primary, 0.24),
            transform: [{ rotate: rotacao }, { scale: escala }],
          },
        ]}
      >
        <Animated.View style={[styles.icone, { opacity: opacidadeSol }]}>
          <Icone nome="sol" tamanho={17} cor={colors.primary} />
        </Animated.View>
        <Animated.View style={[styles.icone, { opacity: opacidadeLua }]}>
          <Icone nome="lua" tamanho={17} cor={colors.primary} />
        </Animated.View>
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
  disco: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  icone: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
