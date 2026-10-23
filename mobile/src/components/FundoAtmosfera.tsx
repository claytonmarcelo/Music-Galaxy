// Fundo atmosférico do aplicativo.
// Desenha o degradê taupe quente e os brilhos de vinho/cobre em camadas
// nativas do React Native — sem dependências extras. Os brilhos são
// concêntricos para simular luz difusa e ficam atrás de todo o conteúdo.

import React from 'react';
import { StyleSheet, View, ViewStyle, StyleProp } from 'react-native';
import { useTheme } from '../contexts/ThemeContext';
import { misturarCores } from '../utils/cores';

// Quantidade de faixas do degradê vertical (suficiente para ser suave).
const FAIXAS = 22;

// Muitas camadas concêntricas com pouca opacidade: o degrau entre uma
// camada e outra fica imperceptível e o brilho parece difuso.
const CAMADAS_BRILHO = Array.from({ length: 20 }, (_, indice) => 1 - indice * 0.04);

interface BrilhoProps {
  cor: string;
  tamanho: number;
  opacidade: number;
  estilo: StyleProp<ViewStyle>;
}

// Halo difuso: vários círculos sobrepostos com opacidades crescentes.
function Brilho({ cor, tamanho, opacidade, estilo }: BrilhoProps): React.JSX.Element {
  return (
    <View
      pointerEvents="none"
      style={[{ position: 'absolute', width: tamanho, height: tamanho }, estilo]}
    >
      {CAMADAS_BRILHO.map((escala, indice) => {
        const medida = tamanho * escala;
        return (
          <View
            key={indice}
            style={{
              position: 'absolute',
              width: medida,
              height: medida,
              borderRadius: medida / 2,
              top: (tamanho - medida) / 2,
              left: (tamanho - medida) / 2,
              backgroundColor: cor,
              opacity: opacidade * (0.018 + indice * 0.003),
            }}
          />
        );
      })}
    </View>
  );
}

interface FundoAtmosferaProps {
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}

export default function FundoAtmosfera({
  children,
  style,
}: FundoAtmosferaProps): React.JSX.Element {
  const { colors, isDark } = useTheme();

  // No tema claro os brilhos ficam mais discretos para preservar a leitura.
  const intensidade = isDark ? 1 : 0.62;

  // Faixas do degradê vertical, interpoladas entre os tokens do tema.
  const faixas = Array.from({ length: FAIXAS }, (_, indice) =>
    misturarCores(colors.gradienteTopo, colors.gradienteBase, indice / (FAIXAS - 1))
  );

  return (
    <View style={[styles.base, { backgroundColor: colors.gradienteBase }, style]}>
      {/* A camada dos brilhos é recortada pela própria tela: sem isso, os
          halos absolutos (700 px, deslocados para fora) enlarguecem a área
          rolável do aplicativo e o navegador desloca a tela inteira quando
          um botão recebe o foco. */}
      <View pointerEvents="none" style={styles.camadaFundo}>
        {/* Degradê vertical principal */}
        <View style={styles.degrade}>
          {faixas.map((cor, indice) => (
            <View key={indice} style={[styles.faixa, { backgroundColor: cor }]} />
          ))}
        </View>

        {/* Brilho vinho no alto, à direita */}
        <Brilho
          cor={colors.luzPrimaria}
          tamanho={700}
          opacidade={0.5 * intensidade}
          estilo={styles.brilhoVinho}
        />

        {/* Halo cobre rosado à esquerda */}
        <Brilho
          cor={colors.luzSecundaria}
          tamanho={560}
          opacidade={0.3 * intensidade}
          estilo={styles.brilhoCobre}
        />

        {/* Ameixa profunda no rodapé */}
        <Brilho
          cor={colors.luzTerciaria}
          tamanho={640}
          opacidade={0.42 * intensidade}
          estilo={styles.brilhoAmeixa}
        />

        {/* Âmbar quente no canto inferior esquerdo */}
        <Brilho
          cor={colors.luzQuaternaria}
          tamanho={440}
          opacidade={0.26 * intensidade}
          estilo={styles.brilhoAmbar}
        />

        {/* Véu suave para dar profundidade às bordas */}
        <View
          style={[
            StyleSheet.absoluteFill,
            { backgroundColor: colors.glassShadow, opacity: isDark ? 0.12 : 0.04 },
          ]}
        />
      </View>

      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    flex: 1,
    overflow: 'hidden',
  },
  camadaFundo: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    overflow: 'hidden',
  },
  degrade: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'column',
  },
  faixa: {
    flex: 1,
  },
  brilhoVinho: {
    top: -320,
    right: -260,
  },
  brilhoCobre: {
    top: 80,
    left: -300,
  },
  brilhoAmeixa: {
    bottom: -320,
    right: -220,
  },
  brilhoAmbar: {
    bottom: -160,
    left: -160,
  },
});
