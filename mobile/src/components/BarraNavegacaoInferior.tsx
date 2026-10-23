// Barra de navegação inferior — cápsula de vidro flutuante com as cinco
// áreas principais do app. A barra fica centralizada, com largura máxima
// para não esticar em tablets e navegador, e respeita a área segura do
// aparelho para nunca cobrir os gestos ou botões do sistema.

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useNavigation, useNavigationState } from '@react-navigation/native';
import type { NavigationProp } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../contexts/ThemeContext';
import { RootStackParamList } from '../types';
import Icone, { NomeIcone } from './Icone';
import { comAlfa } from '../utils/cores';

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

// Largura máxima da cápsula: mantém o ritmo visual em telas grandes sem
// esticar os botões de ponta a ponta.
const LARGURA_MAXIMA = 520;

export default function BarraNavegacaoInferior(): React.JSX.Element {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
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

  // No Android com navegação por gestos a área segura inferior varia de
  // aparelho para aparelho; o mínimo de 10 px mantém o respiro no web/iOS.
  const respiroInferior = Math.max(insets.bottom, 10);

  return (
    <View
      pointerEvents="box-none"
      style={[styles.area, { paddingBottom: respiroInferior }]}
    >
      <View
        style={[
          styles.trilho,
          {
            backgroundColor: colors.glassCardForte,
            borderColor: colors.glassBorder,
            shadowColor: colors.glassShadow,
          },
        ]}
      >
        {/* Fio de luz no topo da cápsula: reforça o vidro sem pesar. */}
        <View
          pointerEvents="none"
          style={[styles.fioDeLuz, { backgroundColor: colors.glassHighlight }]}
        />

        {ABAS.map((aba) => {
          const ativa = rotaAtual === aba.rota;
          return (
            <TouchableOpacity
              key={aba.rota}
              style={[
                styles.aba,
                ativa && {
                  backgroundColor: comAlfa(colors.primary, 0.14),
                  borderColor: comAlfa(colors.primary, 0.26),
                },
              ]}
              onPress={() => navigation.navigate(aba.rota)}
              activeOpacity={0.72}
              accessibilityRole="tab"
              accessibilityLabel={aba.rotulo}
              accessibilityState={{ selected: ativa }}
            >
              <Icone
                nome={aba.icone}
                tamanho={18}
                cor={ativa ? colors.primary : colors.textSecondary}
              />
              <Text
                style={[
                  styles.rotulo,
                  { color: ativa ? colors.text : colors.textSecondary },
                  ativa && styles.rotuloAtiva,
                ]}
                numberOfLines={1}
              >
                {aba.rotulo}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  area: {
    width: '100%',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingTop: 2,
  },
  trilho: {
    width: '100%',
    maxWidth: LARGURA_MAXIMA,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 4,
    paddingVertical: 4,
    borderRadius: 22,
    borderWidth: 1,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.26,
    shadowRadius: 16,
    elevation: 12,
  },
  fioDeLuz: {
    position: 'absolute',
    top: 0,
    left: 26,
    right: 26,
    height: 1,
    opacity: 0.55,
    borderRadius: 1,
  },
  aba: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: 'transparent',
    gap: 1,
  },
  rotulo: {
    fontSize: 9,
    fontWeight: '500',
    letterSpacing: 0.15,
    lineHeight: 12,
  },
  rotuloAtiva: {
    fontWeight: '700',
  },
});
