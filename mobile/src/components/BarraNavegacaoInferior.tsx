// Barra de navegação inferior — acesso direto às cinco áreas principais do app.
// Sempre visível abaixo do conteúdo, com a aba ativa destacada nas cores do tema.
// Segue a identidade visual de vidro fosco: painel translúcido com contorno superior.

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { useNavigation, useNavigationState } from '@react-navigation/native';
import type { NavigationProp } from '@react-navigation/native';
import { useTheme } from '../contexts/ThemeContext';
import { RootStackParamList } from '../types';
import { MusicEmojis } from './AnimatedIcon';

// Rotas principais exibidas na barra (telas registradas no navegador).
type RotaAba = 'Busca' | 'Biblioteca' | 'Explorar' | 'Favoritos' | 'Settings';

// Abas da barra: rota registrada no navegador, rótulo em pt-BR e ícone.
const ABAS: Array<{ rota: RotaAba; rotulo: string; icone: string }> = [
  { rota: 'Busca',      rotulo: 'Busca',     icone: MusicEmojis.search },
  { rota: 'Biblioteca', rotulo: 'Biblioteca', icone: MusicEmojis.library },
  { rota: 'Explorar',   rotulo: 'Explorar',  icone: MusicEmojis.explore },
  { rota: 'Favoritos',  rotulo: 'Favoritos', icone: MusicEmojis.favorite },
  { rota: 'Settings',   rotulo: 'Ajustes',   icone: MusicEmojis.settings },
];

export default function BarraNavegacaoInferior(): React.JSX.Element {
  const { colors } = useTheme();
  const navigation = useNavigation<NavigationProp<RootStackParamList>>();

  // Aba ativa: usa a rota atual; quando a tela é de detalhe (DetalheRelease,
  // DetalheWork etc.), considera a rota de origem mais recente na pilha.
  const rotaAtual = useNavigationState((state): RotaAba | undefined => {
    if (!state) return undefined;
    const rotasDeAba = new Set<string>(ABAS.map(aba => aba.rota));
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
          // Painel de vidro mais opaco, com contorno e sombra do tema
          backgroundColor: colors.glassCardForte,
          borderTopColor: colors.glassBorder,
          shadowColor: colors.glassShadow,
        },
      ]}
    >
      {ABAS.map(aba => {
        const ativa = rotaAtual === aba.rota;
        return (
          <TouchableOpacity
            key={aba.rota}
            style={styles.aba}
            onPress={() => navigation.navigate(aba.rota)}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel={aba.rotulo}
          >
            <Text
              style={[
                styles.icone,
                { color: ativa ? colors.primary : colors.textSecondary },
              ]}
            >
              {aba.icone}
            </Text>
            <Text
              style={[
                styles.rotulo,
                { color: ativa ? colors.primary : colors.textSecondary },
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
    justifyContent: 'space-around',
    alignItems: 'center',
    borderTopWidth: 1,
    paddingTop: 8,
    paddingBottom: Platform.OS === 'ios' ? 24 : 8,
    // Sombra suave de vidro (a cor vem do tema, aplicada em linha)
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 12,
  },
  aba: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 2,
  },
  icone: {
    fontSize: 20,
    marginBottom: 2,
  },
  rotulo: {
    fontSize: 11,
    fontWeight: '500',
  },
  rotuloAtiva: {
    fontWeight: '700',
  },
});
