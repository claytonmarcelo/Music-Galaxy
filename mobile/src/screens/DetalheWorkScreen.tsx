// Tela de detalhes de uma obra musical (Work).
// Exibe a obra conceitual com TODAS as versões/releases agrupadas por tipo.
// Implementa Regra 2: nunca ocultar ou substituir versões.
// Visual de vidro fosco: cabeçalho e seções translúcidas sobre o fundo decorativo.

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  ActivityIndicator,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  RefreshControl,
  Animated,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';

import { RootStackParamList, Release, RespostaReleasesDeWork } from '../types';
import { buscarReleasesDeWork } from '../services/api';
import { useModal } from '../contexts/ModalContext';
import { useTheme } from '../contexts/ThemeContext';
import ReleaseCard from '../components/ReleaseCard';
import AuroraBackground from '../components/AuroraBackground';
import GlassCard from '../components/GlassCard';
import { TIMINGS, USE_NATIVE_DRIVER } from '../utils/animacoes';

type Props = NativeStackScreenProps<RootStackParamList, 'DetalheWork'>;

// Agrupador de releases por tipo de categoria (release_format, mix_edit, instrumental, playback)
interface GrupoReleases {
  categoria: string;
  releases: Release[];
}

export default function DetalheWorkScreen({ route, navigation }: Props): React.JSX.Element {
  const { workId } = route.params;
  const { toastErro } = useModal();
  const { colors } = useTheme();

  // Estados
  const [carregando, setCarregando] = useState(true);
  const [atualizando, setAtualizando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [releases, setReleases] = useState<Release[]>([]);
  const [workInfo, setWorkInfo] = useState<{ id: number; title: string } | null>(null);
  const [gruposReleases, setGruposReleases] = useState<GrupoReleases[]>([]);
  const [pagina, setPagina] = useState(0);
  const [temMais, setTemMais] = useState(true);

  // Animações
  const scrollY = useRef(new Animated.Value(0)).current;
  const fadeInAnim = useRef(new Animated.Value(0)).current;

  const LIMIT = 50;

  // Anima entrada na montagem
  useEffect(() => {
    Animated.timing(fadeInAnim, {
      toValue: 1,
      duration: TIMINGS.normal,
      useNativeDriver: USE_NATIVE_DRIVER,
    }).start();
  }, [fadeInAnim]);

  // Carrega releases da obra
  const carregarReleases = useCallback(
    async (offset = 0, adicionar = false): Promise<void> => {
      try {
        if (offset === 0) setCarregando(true);
        const resposta = await buscarReleasesDeWork(workId, { limit: LIMIT, offset });

        if (!resposta.success) {
          throw new Error('Erro ao carregar versões');
        }

        const { results, total, work } = resposta.data;

        setWorkInfo(work);

        if (adicionar) {
          setReleases(prev => [...prev, ...results]);
        } else {
          setReleases(results);
        }

        // Verifica se há mais resultados
        setTemMais(offset + LIMIT < total);
        setPagina(Math.floor(offset / LIMIT) + 1);

        // Agrupa releases por categoria
        const grupos = agruparPorCategoria(adicionar ? [...releases, ...results] : results);
        setGruposReleases(grupos);

        setErro(null);
      } catch (err) {
        const mensagem = err instanceof Error ? err.message : 'Erro desconhecido';
        setErro(mensagem);
        toastErro(mensagem);
      } finally {
        setCarregando(false);
        setAtualizando(false);
      }
    },
    [workId, releases, toastErro]
  );

  // Agrupa releases por categoria
  const agruparPorCategoria = (rels: Release[]): GrupoReleases[] => {
    const mapa = new Map<string, Release[]>();

    rels.forEach(rel => {
      const cat = rel.release_type_category || 'Outros';
      if (!mapa.has(cat)) {
        mapa.set(cat, []);
      }
      mapa.get(cat)!.push(rel);
    });

    return Array.from(mapa.entries()).map(([categoria, rels]) => ({
      categoria,
      releases: rels,
    }));
  };

  // Carregamento inicial
  useEffect(() => {
    carregarReleases(0, false);
  }, [workId]);

  // Carrega mais releases (paginação infinita)
  const carregarMais = useCallback((): void => {
    if (!temMais || atualizando || carregando) return;
    setAtualizando(true);
    carregarReleases(pagina * LIMIT, true);
  }, [pagina, temMais, atualizando, carregando, carregarReleases]);

  // Atualiza a lista (pull-to-refresh)
  const handleAtualizacao = useCallback(async (): Promise<void> => {
    setAtualizando(true);
    await carregarReleases(0, false);
  }, [carregarReleases]);

  // Navega para detalhes do release
  const handleSelecionarRelease = (release: Release): void => {
    navigation.push('DetalheRelease', { release });
  };

  // Renderers
  if (carregando) {
    return (
      <AuroraBackground>
        <View style={styles.containerCentrado}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.textoCentrado, { color: colors.textSecondary }]}>Carregando obra...</Text>
        </View>
      </AuroraBackground>
    );
  }

  if (erro && releases.length === 0) {
    return (
      <AuroraBackground>
        <View style={styles.containerCentrado}>
          <Text style={[styles.textoErro, { color: colors.error }]}>⚠️ Erro ao carregar</Text>
          <Text style={[styles.textoErroMsg, { color: colors.textSecondary }]}>{erro}</Text>
          <TouchableOpacity
            style={[styles.botaoTentar, { backgroundColor: colors.button }]}
            onPress={() => carregarReleases(0, false)}
            activeOpacity={0.7}
          >
            <Text style={[styles.textoButton, { color: colors.buttonText }]}>Tentar novamente</Text>
          </TouchableOpacity>
        </View>
      </AuroraBackground>
    );
  }

  // Renderiza um grupo de releases
  const renderGrupo = (grupo: GrupoReleases, index: number): React.JSX.Element => (
    <Animated.View
      key={index}
      style={{
        opacity: fadeInAnim,
        transform: [
          {
            translateY: scrollY.interpolate({
              inputRange: [0, 200],
              outputRange: [0, 20],
              extrapolate: 'clamp',
            }),
          },
        ],
      }}
    >
      <GlassCard style={styles.secaoGrupo}>
        <Text style={[styles.tituloGrupo, { color: colors.primary }]}>
          {traduzirCategoria(grupo.categoria)} ({grupo.releases.length})
        </Text>
        <FlatList
          scrollEnabled={false}
          data={grupo.releases}
          keyExtractor={rel => `rel-${rel.id}`}
          renderItem={({ item }) => (
            <ReleaseCard
              release={item}
              onPress={handleSelecionarRelease}
            />
          )}
        />
      </GlassCard>
    </Animated.View>
  );

  // Renderiza o cabeçalho da obra em cartão de vidro
  const renderCabecalho = (): React.JSX.Element => (
    <Animated.View
      style={{
        opacity: fadeInAnim,
        transform: [
          {
            scale: scrollY.interpolate({
              inputRange: [-100, 0],
              outputRange: [1.1, 1],
              extrapolate: 'clamp',
            }),
          },
        ],
      }}
    >
      <GlassCard style={styles.secaoCabecalho}>
        <Text style={[styles.tituloObra, { color: colors.text }]}>{workInfo?.title || 'Obra'}</Text>
        <Text style={[styles.totalReleases, { color: colors.textSecondary }]}>
          {releases.length} {releases.length === 1 ? 'versão encontrada' : 'versões encontradas'}
        </Text>
      </GlassCard>
    </Animated.View>
  );

  // Renderiza rodapé de paginação
  const renderRodape = (): React.JSX.Element | null => {
    if (!temMais) return null;

    return (
      <View style={styles.containerCarregarMais}>
        <TouchableOpacity
          style={[
            styles.botaoCarregarMais,
            { backgroundColor: colors.card, borderColor: colors.primary },
          ]}
          onPress={carregarMais}
          disabled={atualizando}
          activeOpacity={0.7}
        >
          {atualizando ? (
            <ActivityIndicator size="small" color={colors.primary} />
          ) : (
            <Text style={[styles.textoCarregarMais, { color: colors.primary }]}>Carregar mais</Text>
          )}
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <AuroraBackground>
      {/* Barra superior de vidro */}
      <Animated.View
        style={{
          opacity: fadeInAnim,
        }}
      >
        <GlassCard forte style={styles.headerBox}>
          <TouchableOpacity
            style={styles.botaoVoltar}
            onPress={() => navigation.goBack()}
            activeOpacity={0.7}
          >
            <Text style={[styles.textoVoltar, { color: colors.primary }]}>← Voltar</Text>
          </TouchableOpacity>
          <Text style={[styles.tituloHeader, { color: colors.text }]}>Obra Completa</Text>
        </GlassCard>
      </Animated.View>

      {/* Conteúdo */}
      <Animated.ScrollView
        style={styles.conteudo}
        scrollEventThrottle={16}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: false }
        )}
        refreshControl={
          <RefreshControl
            refreshing={atualizando}
            onRefresh={handleAtualizacao}
            tintColor={colors.primary}
          />
        }
      >
        {renderCabecalho()}

        {/* Renderiza cada grupo de releases */}
        {gruposReleases.length > 0 ? (
          gruposReleases.map((grupo, idx) => renderGrupo(grupo, idx))
        ) : (
          <View style={styles.containerSemDados}>
            <Text style={styles.icone}>🎵</Text>
            <Text style={[styles.textoSemDados, { color: colors.textSecondary }]}>Nenhuma versão encontrada</Text>
          </View>
        )}

        {renderRodape()}

        {/* Espaço extra no final */}
        <View style={{ height: 20 }} />
      </Animated.ScrollView>
    </AuroraBackground>
  );
}

// ============================================================
// Funções Auxiliares
// ============================================================

// Traduz categoria de release_type para português
function traduzirCategoria(categoria: string): string {
  const traducoes: Record<string, string> = {
    release_format: 'Formatos de Lançamento',
    mix_edit: 'Edições e Remixes',
    instrumental: 'Instrumentais',
    playback: 'Playbacks',
  };
  return traducoes[categoria] || categoria;
}

// ============================================================
// Estilos
// ============================================================

const styles = StyleSheet.create({
  headerBox: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginTop: 8,
    paddingHorizontal: 8,
    paddingVertical: 12,
    borderRadius: 20,
  },

  botaoVoltar: {
    padding: 8,
  },

  textoVoltar: {
    fontSize: 14,
    fontWeight: 'bold',
  },

  tituloHeader: {
    flex: 1,
    textAlign: 'center',
    fontSize: 16,
    fontWeight: 'bold',
    marginRight: 40,
  },

  conteudo: {
    flex: 1,
    paddingHorizontal: 12,
    paddingTop: 16,
  },

  secaoCabecalho: {
    marginBottom: 24,
    borderRadius: 16,
  },

  tituloObra: {
    fontSize: 26,
    fontWeight: '800',
    marginBottom: 8,
    letterSpacing: 0.5,
  },

  totalReleases: {
    fontSize: 14,
    fontWeight: '500',
  },

  secaoGrupo: {
    marginBottom: 24,
    borderRadius: 16,
  },

  tituloGrupo: {
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },

  containerCentrado: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },

  textoCentrado: {
    fontSize: 14,
    marginTop: 12,
  },

  textoErro: {
    fontSize: 32,
    marginBottom: 8,
  },

  textoErroMsg: {
    fontSize: 14,
    marginBottom: 20,
    textAlign: 'center',
  },

  botaoTentar: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },

  textoButton: {
    fontWeight: 'bold',
    fontSize: 14,
  },

  containerSemDados: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 48,
  },

  icone: {
    fontSize: 48,
    marginBottom: 12,
  },

  textoSemDados: {
    fontSize: 16,
  },

  containerCarregarMais: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 20,
  },

  botaoCarregarMais: {
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 2,
  },

  textoCarregarMais: {
    fontWeight: 'bold',
    fontSize: 14,
  },
});
