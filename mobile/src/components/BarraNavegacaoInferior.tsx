// Barra de navegação inferior — cápsula de vidro flutuante com as cinco
// áreas principais do app. A barra fica centralizada, com largura máxima
// para não esticar em tablets e navegador, e respeita a área segura do
// aparelho para nunca cobrir os gestos ou botões do sistema.
//
// Desenho atual: a aba ativa é marcada por uma bolha circular que desliza
// por baixo do ícone, e o rótulo acompanha a hierarquia do tema. É a mesma
// linguagem visual usada no botão de tema do cabeçalho e no seletor de
// Ajustes — por isso o rodapé não parece mais uma fileira de botões soltos.

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated, LayoutChangeEvent } from 'react-native';
import { useNavigation, useNavigationState } from '@react-navigation/native';
import type { NavigationProp } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../contexts/ThemeContext';
import { RootStackParamList } from '../types';
import Icone, { NomeIcone } from './Icone';
import { comAlfa } from '../utils/cores';
import { USE_NATIVE_DRIVER } from '../utils/animacoes';

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
const LARGURA_MAXIMA = 560;

// Diâmetro da bolha que marca a aba ativa (círculo atrás do ícone).
const TAMANHO_BOLHA = 40;

// Respiro mínimo entre a cápsula e a borda de baixo do aparelho.
const RESPIRO_MINIMO = 14;

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

  // Largura medida da fileira de abas: permite posicionar a bolha exatamente
  // no centro do ícone da aba ativa.
  const [larguraLinha, setLarguraLinha] = useState(0);
  const posicaoAnim = useRef(new Animated.Value(0)).current;

  const indiceAtivo = Math.max(
    0,
    ABAS.findIndex((aba) => aba.rota === rotaAtual)
  );

  // Move a bolha até a aba escolhida.
  useEffect(() => {
    Animated.spring(posicaoAnim, {
      toValue: indiceAtivo,
      stiffness: 190,
      damping: 18,
      mass: 0.8,
      useNativeDriver: USE_NATIVE_DRIVER,
    }).start();
  }, [indiceAtivo, posicaoAnim]);

  const medirLinha = (evento: LayoutChangeEvent) => {
    setLarguraLinha(evento.nativeEvent.layout.width);
  };

  // Cada aba ocupa a mesma fração da fileira; a bolha fica centrada nela.
  const larguraItem = larguraLinha > 0 ? larguraLinha / ABAS.length : 0;

  const deslocamentoBolha = useMemo(
    () =>
      posicaoAnim.interpolate({
        inputRange: ABAS.map((_, indice) => indice),
        outputRange: ABAS.map(
          (_, indice) => indice * larguraItem + (larguraItem - TAMANHO_BOLHA) / 2
        ),
      }),
    [larguraItem, posicaoAnim]
  );

  // No Android com navegação por gestos a área segura inferior varia de
  // aparelho para aparelho; o mínimo evita que a cápsula encoste na borda.
  const respiroInferior = Math.max(insets.bottom, RESPIRO_MINIMO);

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

        <View style={styles.linha} onLayout={medirLinha}>
          {/* Bolha que desliza por baixo do ícone da aba ativa */}
          {larguraItem > 0 && (
            <Animated.View
              pointerEvents="none"
              style={[
                styles.bolha,
                {
                  backgroundColor: comAlfa(colors.primary, 0.16),
                  borderColor: comAlfa(colors.primary, 0.3),
                  shadowColor: colors.glassShadow,
                  transform: [{ translateX: deslocamentoBolha }],
                },
              ]}
            />
          )}

          {ABAS.map((aba) => {
            const ativa = rotaAtual === aba.rota;
            return (
              <TouchableOpacity
                key={aba.rota}
                style={styles.aba}
                onPress={() => navigation.navigate(aba.rota)}
                activeOpacity={0.7}
                accessibilityRole="tab"
                accessibilityLabel={aba.rotulo}
                accessibilityState={{ selected: ativa }}
              >
                <View style={styles.iconeArea}>
                  <Icone
                    nome={aba.icone}
                    tamanho={20}
                    cor={ativa ? colors.primary : colors.textSecondary}
                  />
                </View>
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
    </View>
  );
}

const styles = StyleSheet.create({
  area: {
    width: '100%',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  trilho: {
    width: '100%',
    maxWidth: LARGURA_MAXIMA,
    borderRadius: 30,
    borderWidth: 1,
    paddingHorizontal: 6,
    paddingVertical: 8,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.28,
    shadowRadius: 18,
    elevation: 14,
  },
  fioDeLuz: {
    position: 'absolute',
    top: 0,
    left: 30,
    right: 30,
    height: 1,
    opacity: 0.6,
    borderRadius: 1,
  },
  linha: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  bolha: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: TAMANHO_BOLHA,
    height: TAMANHO_BOLHA,
    borderRadius: TAMANHO_BOLHA / 2,
    borderWidth: 1,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 4,
  },
  aba: {
    flex: 1,
    alignItems: 'center',
    gap: 3,
  },
  iconeArea: {
    width: TAMANHO_BOLHA,
    height: TAMANHO_BOLHA,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rotulo: {
    fontSize: 10.5,
    fontWeight: '500',
    letterSpacing: 0.1,
    lineHeight: 14,
  },
  rotuloAtiva: {
    fontWeight: '700',
  },
});
