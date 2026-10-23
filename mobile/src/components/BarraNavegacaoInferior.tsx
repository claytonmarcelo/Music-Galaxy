// Barra de navegação inferior — pílula de vidro flutuante com as cinco
// áreas principais do app. A aba ativa ganha um realce translúcido e o
// ícone de linha na cor de destaque do tema.

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { useNavigation, useNavigationState } from '@react-navigation/native';
import type { NavigationProp } from '@react-navigation/native';
import { useTheme } from '../contexts/ThemeContext';
import { RootStackParamList } from '../types';
import Icone, { NomeIcone } from './Icone';

// Rotas principais exibidas na barra (telas registradas no navegador).
type RotaAba = 'Busca' | 'Biblioteca' | 'Explorar' | 'Favoritos' | 'Settings';

// Abas da barra: rota registrada, rótulo em pt-BR e ícone de linha.
const ABAS: Array<{ rota: RotaAba; rotulo: string; icone: NomeIcone }> = [
  { rota: 'Busca', rotulo: 'Busca', icone: 'busca' },
  { rota: 'Biblioteca', rotulo: 'Biblioteca', icone: 'biblioteca' },
  { rota: 'Explorar', rotulo: 'Explorar', icone: 'explorar' },
  { rota: 'Favoritos', rotulo: 'Favoritos', icone: 'favorito' },
  { rota: 'Settings', rotulo: 'Ajustes', icone: 'ajustes' },
];

export default function BarraNavegacaoInferior(): React.JSX.Element {
  const { colors } = useTheme();
  const navigation = useNavigation<NavigationProp<RootStackParamList>>();

  // Aba ativa: usa a rota atual; telas de detalhe mantêm a aba de origem.
  const rotaAtual = useNavigationState((state): RotaAba | undefined => {
    if (!state) return undefined;
    const rotasDeAba = new Set<string>(ABAS.map((aba) => aba.rota));
    for (let i = state.index; i >= 0; i -= 1) {
      const nome = state.routes[i]?.name;
      if (nome && rotasDeAba.has(nome)) {
        return nome as RotaAba;
      }
    }
    return undefined;
  });

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: colors.glassCardForte,
          borderColor: colors.glassBorder,
          shadowColor: colors.glassShadow,
        },
      ]}
    >
      {ABAS.map((aba) => {
        const ativa = rotaAtual === aba.rota;
        return (
          <TouchableOpacity
            key={aba.rota}
            style={[
              styles.aba,
              ativa && {
                backgroundColor: colors.glassCard,
                borderColor: colors.glassBorder,
              },
            ]}
            onPress={() => navigation.navigate(aba.rota)}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel={aba.rotulo}
            accessibilityState={{ selected: ativa }}
          >
            <Icone
              nome={aba.icone}
              tamanho={19}
              cor={ativa ? colors.primary : colors.textSecondary}
            />
            <Text
              style={[
                styles.rotulo,
                { color: ativa ? colors.text : colors.textSecondary },
                ativa && styles.rotuloAtiva,
              ]}
            >
              {aba.rotulo}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginTop: 6,
    marginBottom: Platform.OS === 'ios' ? 18 : 8,
    paddingVertical: 6,
    paddingHorizontal: 6,
    borderRadius: 30,
    borderWidth: 1,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.28,
    shadowRadius: 20,
    elevation: 14,
  },
  aba: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'transparent',
    gap: 3,
  },
  rotulo: {
    fontSize: 10,
    fontWeight: '500',
    letterSpacing: 0.2,
  },
  rotuloAtiva: {
    fontWeight: '700',
  },
});
