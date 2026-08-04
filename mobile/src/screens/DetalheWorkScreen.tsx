// Tela de detalhes de uma obra musical (Work).
// Exibe a obra conceitual com TODAS as versões/releases agrupadas por tipo.
// Implementa Regra 2: nunca ocultar ou substituir versões.
// Incluir animações parallax na capa e design premium.

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
  Platform,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';

import { RootStackParamList, Release, RespostaReleasesDeWork } from '../types';
import { buscarReleasesDeWork } from '../services/api';
import { useModal } from '../contexts/ModalContext';
import ReleaseCard from '../components/ReleaseCard';
import { TIMINGS, EASING } from '../utils/animacoes';

type Props = NativeStackScreenProps<RootStackParamList, 'DetalheWork'>;

// Agrupador de releases por tipo de categoria (release_format, mix_edit, instrumental, playback)
interface GrupoReleases {
  categoria: string;
  releases: Release[];
}

export default function DetalheWorkScreen({ route, navigation }: Props): React.JSX.Element {
  const { workId } = route.params;
  const { toastErro } = useModal();

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
      useNativeDriver: true,
    }).start();
  }, [fadeInAnim]);

  // Carrega releases da obra
  const carregarReleases = useCallback(
    async (offset = 0, adicionar = false): Promise<void> => {
      try {
        if (offset === 0) setCarregando(true);
        const resposta = await buscarReleasesDeWork(workId, { limit: LIMIT, offset });

        if (!resposta.success) {
          throw new Error('Erro ao carregar releases');
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
      <View style={styles.containerCentrado}>
        <ActivityIndicator size="large" color="#1DB954" />
        <Text style={styles.textoCentrado}>Carregando obra...</Text>
      </View>
    );
  }

  if (erro && releases.length === 0) {
    return (
      <View style={styles.containerCentrado}>
        <Text style={styles.textoErro}>⚠️ Erro ao carregar</Text>
        <Text style={styles.textoErroMsg}>{erro}</Text>
        <TouchableOpacity
          style={styles.botaoTentar}
          onPress={() => carregarReleases(0, false)}
          activeOpacity={0.7}
        >
          <Text style={styles.textoButton}>Tentar Novamente</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Renderiza um grupo de releases
  const renderGrupo = (grupo: GrupoReleases, index: number): React.JSX.Element => (
    <Animated.View
      key={index}
      style={[
        styles.secaoGrupo,
        {
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
        },
      ]}
    >
      <Text style={styles.tituloGrupo}>
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
    </Animated.View>
  );

  // Renderiza o cabeçalho da obra com animação
  const renderCabecalho = (): React.JSX.Element => (
    <Animated.View
      style={[
        styles.secaoCabecalho,
        {
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
        },
      ]}
    >
      <Text style={styles.tituloObra}>{workInfo?.title || 'Obra'}</Text>
      <Text style={styles.totalReleases}>
        {releases.length} versão{releases.length !== 1 ? 'ões' : ''} encontrada{releases.length !== 1 ? 's' : ''}
      </Text>
    </Animated.View>
  );

  // Renderiza rodapé de paginação
  const renderRodape = (): React.JSX.Element | null => {
    if (!temMais) return null;

    return (
      <View style={styles.containerCarregarMais}>
        <TouchableOpacity
          style={styles.botaoCarregarMais}
          onPress={carregarMais}
          disabled={atualizando}
          activeOpacity={0.7}
        >
          {atualizando ? (
            <ActivityIndicator size="small" color="#1DB954" />
          ) : (
            <Text style={styles.textoCarregarMais}>Carregar Mais</Text>
          )}
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* Cabeçalho */}
      <Animated.View
        style={[
          styles.headerBox,
          {
            opacity: fadeInAnim,
          },
        ]}
      >
        <TouchableOpacity
          style={styles.botaoVoltar}
          onPress={() => navigation.goBack()}
          activeOpacity={0.7}
        >
          <Text style={styles.textoVoltar}>← Voltar</Text>
        </TouchableOpacity>
        <Text style={styles.tituloHeader}>Obra Completa</Text>
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
            tintColor="#1DB954"
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
            <Text style={styles.textoSemDados}>Nenhuma versão encontrada</Text>
          </View>
        )}

        {renderRodape()}

        {/* Espaço extra no final */}
        <View style={{ height: 20 }} />
      </Animated.ScrollView>
    </View>
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
  container: {
    flex: 1,
    backgroundColor: '#0F0F1A',
  },

  headerBox: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#1A1A2E',
    borderBottomWidth: 1,
    borderBottomColor: '#2E2E4E',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.15,
        shadowRadius: 4,
      },
      android: {
        elevation: 3,
      },
    }),
  },

  botaoVoltar: {
    padding: 8,
  },

  textoVoltar: {
    color: '#1DB954',
    fontSize: 14,
    fontWeight: 'bold',
  },

  tituloHeader: {
    flex: 1,
    textAlign: 'center',
    color: '#FFFFFF',
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
    paddingBottom: 16,
    borderBottomWidth: 2,
    borderBottomColor: '#1DB954',
  },

  tituloObra: {
    color: '#FFFFFF',
    fontSize: 26,
    fontWeight: '800',
    marginBottom: 8,
    letterSpacing: 0.5,
  },

  totalReleases: {
    color: '#8080A0',
    fontSize: 14,
    fontWeight: '500',
  },

  secaoGrupo: {
    marginBottom: 24,
    backgroundColor: '#12121F',
    borderRadius: 16,
    padding: 16,
    borderLeftWidth: 3,
    borderLeftColor: '#1DB954',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 8,
      },
      android: {
        elevation: 4,
      },
    }),
  },

  tituloGrupo: {
    color: '#1DB954',
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
    backgroundColor: '#0F0F1A',
  },

  textoCentrado: {
    color: '#8080A0',
    fontSize: 14,
    marginTop: 12,
  },

  textoErro: {
    color: '#FF6B35',
    fontSize: 32,
    marginBottom: 8,
  },

  textoErroMsg: {
    color: '#8080A0',
    fontSize: 14,
    marginBottom: 20,
    textAlign: 'center',
  },

  botaoTentar: {
    backgroundColor: '#1DB954',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    ...Platform.select({
      ios: {
        shadowColor: '#1DB954',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
      },
      android: {
        elevation: 4,
      },
    }),
  },

  textoButton: {
    color: '#FFFFFF',
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
    color: '#8080A0',
    fontSize: 16,
  },

  containerCarregarMais: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 20,
  },

  botaoCarregarMais: {
    backgroundColor: '#1A1A2E',
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#1DB954',
    ...Platform.select({
      ios: {
        shadowColor: '#1DB954',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
      android: {
        elevation: 2,
      },
    }),
  },

  textoCarregarMais: {
    color: '#1DB954',
    fontWeight: 'bold',
    fontSize: 14,
  },
});
