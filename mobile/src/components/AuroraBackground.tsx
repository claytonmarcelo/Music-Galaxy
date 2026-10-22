// Fundo Aurora — identidade visual do aplicativo.
// Simula o céu de aurora boreal com círculos de luz translúcidos sobrepostos,
// usando apenas recursos nativos do React Native, sem dependências extras.
// As luzes ficam atrás de todo o conteúdo e são somente decorativas.

import React from 'react';
import { StyleSheet, View, ViewStyle, StyleProp } from 'react-native';
import { useTheme } from '../contexts/ThemeContext';

interface LuzAuroraProps {
  cor: string;
  estilo: object;
  opacidade: number; // opacidade ajustada conforme o tema (claro/escuro)
}

// Uma luz da aurora: halo grande e difuso + núcleo menor e mais intenso.
function LuzAurora({ cor, estilo, opacidade }: LuzAuroraProps): React.JSX.Element {
  return (
    <View pointerEvents="none" style={[styles.luz, estilo]}>
      <View
        style={[
          styles.halo,
          { backgroundColor: cor, opacity: opacidade },
        ]}
      />
      <View
        style={[
          styles.nucleo,
          { backgroundColor: cor, opacity: Math.min(0.55, opacidade * 1.6) },
        ]}
      />
    </View>
  );
}

interface AuroraBackgroundProps {
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}

export default function AuroraBackground({ children, style }: AuroraBackgroundProps): React.JSX.Element {
  const { colors, isDark } = useTheme();

  // No tema claro as luzes ficam mais suaves para manter a leitura.
  const opacidadeBase = isDark ? 0.26 : 0.14;

  return (
    <View style={[styles.base, { backgroundColor: colors.background }, style]}>
      <View pointerEvents="none" style={StyleSheet.absoluteFill}>
        <LuzAurora
          cor={colors.auroraPrimaria}
          estilo={styles.luzVioleta}
          opacidade={opacidadeBase}
        />
        <LuzAurora
          cor={colors.auroraSecundaria}
          estilo={styles.luzCiano}
          opacidade={opacidadeBase * 0.9}
        />
        <LuzAurora
          cor={colors.auroraTerciaria}
          estilo={styles.luzRosa}
          opacidade={opacidadeBase * 0.85}
        />
        <LuzAurora
          cor={colors.auroraQuaternaria}
          estilo={styles.luzVerde}
          opacidade={opacidadeBase * 0.75}
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
  luz: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  halo: {
    position: 'absolute',
    borderRadius: 999,
    width: 320,
    height: 320,
  },
  nucleo: {
    borderRadius: 999,
    width: 120,
    height: 120,
  },
  luzVioleta: {
    top: -90,
    left: -110,
  },
  luzCiano: {
    top: 110,
    right: -130,
  },
  luzRosa: {
    bottom: -110,
    left: -80,
  },
  luzVerde: {
    bottom: 40,
    right: -90,
  },
});
