// Seletor de tema do aplicativo.
// Escolha entre os três modos de aparência (claro, escuro e automático).
//
// Desenho atual: cada opção é um cartão de vidro com selo circular, título e
// explicação curta — a mesma linguagem dos cartões de qualidade de download
// logo abaixo na tela de Ajustes. O selo da opção escolhida ganha a cor
// principal e um leve destaque, o que deixa a escolha evidente também para
// quem tem dificuldade de ler textos pequenos. Todas as cores vêm dos tokens
// do tema.

import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, TouchableOpacity } from 'react-native';
import { useTheme } from '../contexts/ThemeContext';
import Icone, { NomeIcone } from './Icone';
import { comAlfa } from '../utils/cores';
import { USE_NATIVE_DRIVER } from '../utils/animacoes';

export type Tema = 'light' | 'dark' | 'auto';

interface OpcaoTema {
  valor: Tema;
  rotulo: string;
  icone: NomeIcone;
  descricao: string;
}

export const OPCOES_TEMA: OpcaoTema[] = [
  { valor: 'light', rotulo: 'Claro', icone: 'sol', descricao: 'Sempre claro' },
  { valor: 'dark', rotulo: 'Escuro', icone: 'lua', descricao: 'Sempre escuro' },
  { valor: 'auto', rotulo: 'Sistema', icone: 'sistema', descricao: 'Segue o aparelho' },
];

interface Props {
  valor: Tema;
  onChange: (tema: Tema) => void;
}

export default function SeletorTema({ valor, onChange }: Props): React.JSX.Element {
  const { colors } = useTheme();

  return (
    <View style={styles.linha} accessibilityRole="radiogroup">
      {OPCOES_TEMA.map((opcao) => (
        <CartaoTema
          key={opcao.valor}
          opcao={opcao}
          selecionado={opcao.valor === valor}
          onPress={() => onChange(opcao.valor)}
        />
      ))}
    </View>
  );
}

// Um cartão por opção de tema.
function CartaoTema({
  opcao,
  selecionado,
  onPress,
}: {
  opcao: OpcaoTema;
  selecionado: boolean;
  onPress: () => void;
}): React.JSX.Element {
  const { colors } = useTheme();

  // Entrada suave do selo quando a opção é escolhida.
  const destaqueAnim = useRef(new Animated.Value(selecionado ? 1 : 0)).current;

  useEffect(() => {
    Animated.spring(destaqueAnim, {
      toValue: selecionado ? 1 : 0,
      stiffness: 200,
      damping: 16,
      mass: 0.7,
      useNativeDriver: USE_NATIVE_DRIVER,
    }).start();
  }, [destaqueAnim, selecionado]);

  const escala = destaqueAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.92, 1],
  });

  return (
    <TouchableOpacity
      style={[
        styles.cartao,
        {
          backgroundColor: selecionado ? comAlfa(colors.primary, 0.12) : colors.glassCard,
          borderColor: selecionado ? comAlfa(colors.primary, 0.45) : colors.glassBorder,
        },
      ]}
      onPress={onPress}
      activeOpacity={0.75}
      accessibilityRole="radio"
      accessibilityState={{ selected: selecionado }}
      accessibilityLabel={`Tema ${opcao.rotulo}: ${opcao.descricao}`}
    >
      <Animated.View
        style={[
          styles.selo,
          {
            backgroundColor: selecionado
              ? colors.primary
              : comAlfa(colors.textSecondary, 0.12),
            transform: [{ scale: escala }],
          },
        ]}
      >
        <Icone
          nome={opcao.icone}
          tamanho={17}
          cor={selecionado ? colors.buttonText : colors.textSecondary}
        />
      </Animated.View>

      <Text
        style={[
          styles.rotulo,
          { color: colors.text },
          selecionado && styles.rotuloSelecionado,
        ]}
        numberOfLines={1}
      >
        {opcao.rotulo}
      </Text>

      <Text
        style={[styles.descricao, { color: colors.textSecondary }]}
        numberOfLines={2}
      >
        {opcao.descricao}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  linha: {
    flexDirection: 'row',
    gap: 8,
  },
  cartao: {
    flex: 1,
    borderRadius: 18,
    borderWidth: 1,
    paddingVertical: 12,
    paddingHorizontal: 8,
    alignItems: 'center',
    gap: 6,
    minHeight: 118,
  },
  selo: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rotulo: {
    fontSize: 12.5,
    fontWeight: '600',
  },
  rotuloSelecionado: {
    fontWeight: '800',
  },
  descricao: {
    fontSize: 10,
    lineHeight: 14,
    textAlign: 'center',
  },
});
