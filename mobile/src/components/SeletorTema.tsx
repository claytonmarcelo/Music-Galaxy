// Seletor de tema em pílula segmentada.
// Substitui o grupo de botões soltos da tela de Ajustes por um controle
// único e coeso: a pílula de seleção desliza por baixo da opção ativa,
// mostrando o tema escolhido sem tirar o foco do resto da interface.
// As cores vêm sempre dos tokens do tema.

import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Animated, TouchableOpacity, LayoutChangeEvent } from 'react-native';
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

  // Largura medida do trilho: permite deslizar a pílula exatamente um item.
  const [largura, setLargura] = useState(0);
  const posicaoAnim = useRef(new Animated.Value(0)).current;

  const indiceAtivo = Math.max(
    0,
    OPCOES_TEMA.findIndex((opcao) => opcao.valor === valor)
  );

  // Espaço interno (padding horizontal) do trilho, descontado da largura útil.
  const ESPACO_INTERNO = 8;
  const larguraItem = largura > 0 ? (largura - ESPACO_INTERNO * 2) / OPCOES_TEMA.length : 0;

  // Move a pílula até a opção escolhida.
  useEffect(() => {
    Animated.spring(posicaoAnim, {
      toValue: indiceAtivo,
      tension: 70,
      friction: 13,
      useNativeDriver: USE_NATIVE_DRIVER,
    }).start();
  }, [indiceAtivo, posicaoAnim]);

  const medir = (evento: LayoutChangeEvent) => {
    setLargura(evento.nativeEvent.layout.width);
  };

  const deslocamentoPill = posicaoAnim.interpolate({
    inputRange: [0, 1, 2],
    outputRange: [0, larguraItem, larguraItem * 2],
  });

  return (
    <View
      style={[
        styles.trilho,
        { backgroundColor: colors.glassCard, borderColor: colors.glassBorder },
      ]}
      onLayout={medir}
      accessibilityRole="radiogroup"
    >
      {/* Pílula que desliza por baixo da opção ativa */}
      {larguraItem > 0 && (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.pilula,
            {
              width: larguraItem,
              backgroundColor: comAlfa(colors.primary, 0.16),
              borderColor: comAlfa(colors.primary, 0.3),
              transform: [{ translateX: deslocamentoPill }],
            },
          ]}
        />
      )}

      {OPCOES_TEMA.map((opcao) => {
        const selecionado = opcao.valor === valor;
        return (
          <TouchableOpacity
            key={opcao.valor}
            style={styles.opcao}
            onPress={() => onChange(opcao.valor)}
            activeOpacity={0.75}
            accessibilityRole="radio"
            accessibilityState={{ selected: selecionado }}
            accessibilityLabel={`Tema ${opcao.rotulo}: ${opcao.descricao}`}
          >
            <Icone
              nome={opcao.icone}
              tamanho={15}
              cor={selecionado ? colors.primary : colors.textSecondary}
            />
            <Text
              style={[
                styles.rotulo,
                { color: selecionado ? colors.text : colors.textSecondary },
                selecionado && styles.rotuloAtivo,
              ]}
              numberOfLines={1}
            >
              {opcao.rotulo}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  trilho: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 20,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  pilula: {
    position: 'absolute',
    top: 4,
    bottom: 4,
    left: 8,
    borderRadius: 16,
    borderWidth: 1,
  },
  opcao: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 9,
  },
  rotulo: {
    fontSize: 11.5,
    fontWeight: '600',
  },
  rotuloAtivo: {
    fontWeight: '700',
  },
});
