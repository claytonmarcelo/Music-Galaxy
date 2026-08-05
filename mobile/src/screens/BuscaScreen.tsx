// Tela principal de busca musical.
// Implementa debounce de 600ms, histórico, favoritos, filtros e design premium com animações.

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  TextInput,
  FlatList,
  Text,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  StatusBar,
  ListRenderItemInfo,
  Platform,
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { buscarMusicas } from '../services/api';
import { Release, RootStackParamList, RespostaBusca } from '../types';
import ReleaseCard from '../components/ReleaseCard';
import { useFavoritos } from '../contexts/FavoritosContext';
import { useHistorico } from '../contexts/HistoricoContext';
import { useModal } from '../contexts/ModalContext';
import { useTheme } from '../contexts/ThemeContext';
import FiltrosModal, { Filtros } from '../components/FiltrosModal';
import { ItemHistorico } from '../contexts/HistoricoContext';
import { TIMINGS, EASING, fadeInOut, slideVertical } from '../utils/animacoes';
import { MusicEmojis } from '../components/AnimatedIcon';
import CustomButton from '../components/CustomButton';

type NavProp = NativeStackNavigationProp<RootStackParamList, 'Busca'>;

const DEBOUNCE_MS = 600;
const ITENS_POR_PAGINA = 30;

export default function BuscaScreen(): React.JSX.Element {
  const navigation = useNavigation<NavProp>();
  const { favoritos } = useFavoritos();
  const { historico, adicionarBusca, removerBusca } = useHistorico();
  const { abrirErro, toastSucesso, toastErro } = useModal();
  const { colors, isDark, toggleTheme } = useTheme();

  const [termo, setTermo]           = useState('');
  const [releases, setReleases]     = useState<Release[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro]             = useState<string | null>(null);
  const [total, setTotal]           = useState(0);
  const [offset, setOffset]         = useState(0);
  const [fromCache, setFromCache]   = useState(false);
  const [focoInput, setFocoInput]   = useState(false);
  const [mostrarFiltros, setMostrarFiltros] = useState(false);
  const [filtros, setFiltros]       = useState<Filtros>({});

  // Animações
  const scaleHeaderAnim = useRef(new Animated.Value(1)).current;
  const fadeListaAnim = useRef(new Animated.Value(0)).current;
  const slideEstadoAnim = useRef(new Animated.Value(20)).current;
  const opacidadeEstadoAnim = useRef(new Animated.Value(0)).current;

  const timerDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortController = useRef<AbortController | null>(null);

  useEffect(() => {
    return () => {
      timerDebounce.current && clearTimeout(timerDebounce.current);
      abortController.current?.abort();
    };
  }, []);

  // Anima entrada da lista quando há resultados
  useEffect(() => {
    const resultadosFiltrados = releases.filter(r => {
      let resultado = true;
      if (filtros.categoria) {
        resultado = resultado && r.release_type_category === filtros.categoria;
      }
      if (filtros.anoMin !== undefined && filtros.anoMax !== undefined) {
        if (r.release_year) {
          resultado = resultado && r.release_year >= filtros.anoMin && r.release_year <= filtros.anoMax;
        }
      }
      return resultado;
    });

    if (resultadosFiltrados.length > 0) {
      Animated.timing(fadeListaAnim, {
        toValue: 1,
        duration: TIMINGS.normal,
        useNativeDriver: true,
      }).start();
    } else {
      fadeListaAnim.setValue(0);
    }
  }, [releases, filtros]);

  // Anima estados vazios
  useEffect(() => {
    if (releases.length === 0 && !carregando && termo.length > 0) {
      Animated.parallel([
        Animated.timing(slideEstadoAnim, {
          toValue: 0,
          duration: TIMINGS.normal,
          useNativeDriver: true,
        }),
        Animated.timing(opacidadeEstadoAnim, {
          toValue: 1,
          duration: TIMINGS.normal,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [releases.length, carregando, termo]);

  const executarBusca = useCallback(async (
    termoBusca: string,
    paginaOffset: number,
    acumular: boolean
  ) => {
    if (!termoBusca.trim()) {
      setReleases([]);
      setTotal(0);
      setErro(null);
      return;
    }

    abortController.current?.abort();
    abortController.current = new AbortController();

    setCarregando(true);
    setErro(null);

    try {
      const resultado: RespostaBusca = await buscarMusicas(termoBusca.trim(), {
        limit:  ITENS_POR_PAGINA,
        offset: paginaOffset,
        sinal:  abortController.current.signal,
      });

      if (resultado.success) {
        setReleases(prev => acumular ? [...prev, ...resultado.data.results] : resultado.data.results);
        setTotal(resultado.data.total);
        setFromCache(resultado.data.fromCache);
        
        if (!acumular && termoBusca.trim()) {
          adicionarBusca(termoBusca.trim());
          toastSucesso(`Encontradas ${resultado.data.results.length} versão(ões)!`);
        }
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') return;
      const mensagem = err instanceof Error ? err.message : 'Erro ao buscar músicas.';
      setErro(mensagem);
      toastErro(mensagem);
    } finally {
      setCarregando(false);
    }
  }, [adicionarBusca, toastSucesso, toastErro]);

  const aoMudarTermo = useCallback((novoTermo: string) => {
    setTermo(novoTermo);
    setOffset(0);

    // Anima header ao focar no input
    if (novoTermo.length > 0) {
      Animated.spring(scaleHeaderAnim, {
        toValue: 0.95,
        useNativeDriver: true,
        ...EASING.suave,
      }).start();
    } else {
      Animated.spring(scaleHeaderAnim, {
        toValue: 1,
        useNativeDriver: true,
        ...EASING.suave,
      }).start();
    }

    timerDebounce.current && clearTimeout(timerDebounce.current);

    if (!novoTermo.trim()) {
      setReleases([]);
      setTotal(0);
      setErro(null);
      setCarregando(false);
      return;
    }

    timerDebounce.current = setTimeout(() => {
      executarBusca(novoTermo, 0, false);
    }, DEBOUNCE_MS);
  }, [executarBusca, scaleHeaderAnim]);

  const carregarMais = useCallback(() => {
    if (carregando || releases.length >= total) return;
    const novoOffset = offset + ITENS_POR_PAGINA;
    setOffset(novoOffset);
    executarBusca(termo, novoOffset, true);
  }, [carregando, releases.length, total, offset, termo, executarBusca]);

  const limparBusca = useCallback(() => {
    timerDebounce.current && clearTimeout(timerDebounce.current);
    abortController.current?.abort();
    setTermo('');
    setReleases([]);
    setTotal(0);
    setErro(null);
    setOffset(0);
    setFocoInput(false);

    // Reset animations
    Animated.spring(scaleHeaderAnim, {
      toValue: 1,
      useNativeDriver: true,
      ...EASING.suave,
    }).start();
  }, [scaleHeaderAnim]);

  const selecionarSugestao = useCallback((termoSugerido: string) => {
    setTermo(termoSugerido);
    setFocoInput(false);
    setOffset(0);
    executarBusca(termoSugerido, 0, false);
  }, [executarBusca]);

  const removerSugestao = useCallback(async (termoRemover: string, e: any) => {
    e.stopPropagation();
    await removerBusca(termoRemover);
    toastSucesso(`"${termoRemover}" removido do histórico`);
  }, [removerBusca, toastSucesso]);

  const aplicarFiltros = useCallback((novosFiltros: Filtros) => {
    setFiltros(novosFiltros);
    toastSucesso('Filtros aplicados!');
  }, [toastSucesso]);

  const limparFiltros = useCallback(() => {
    setFiltros({});
    toastSucesso('Filtros removidos');
  }, [toastSucesso]);

  const releasesFiltrados = useCallback(() => {
    let resultado = releases;

    if (filtros.categoria) {
      resultado = resultado.filter(r => r.release_type_category === filtros.categoria);
    }

    if (filtros.anoMin !== undefined && filtros.anoMax !== undefined) {
      resultado = resultado.filter(r => {
        if (!r.release_year) return false;
        return r.release_year >= filtros.anoMin! && r.release_year <= filtros.anoMax!;
      });
    }

    return resultado;
  }, [releases, filtros]);

  const contadorFiltros = Object.values(filtros).filter(v => v !== undefined).length;

  const renderItem = useCallback(({ item }: ListRenderItemInfo<Release>) => (
    <ReleaseCard
      release={item}
      onPress={() => navigation.navigate('DetalheRelease', { release: item })}
    />
  ), [navigation]);

  const keyExtractor = useCallback((item: Release) => String(item.id), []);

  const ListFooter = useCallback(() => {
    if (carregando && releases.length > 0) {
      return <ActivityIndicator size="small" color="#1DB954" style={styles.spinner} />;
    }
    if (!carregando && releasesFiltrados().length >= total && total > 0) {
      return (
        <Text style={styles.fimLista}>
          {releasesFiltrados().length} de {total} versão{total !== 1 ? 'ões' : ''}
        </Text>
      );
    }
    return null;
  }, [carregando, releases.length, releasesFiltrados, total]);

  const ListHeader = useCallback(() => {
    if (releases.length === 0) return null;
    return (
      <Animated.View
        style={[
          styles.headerLista,
          {
            opacity: fadeListaAnim,
          },
        ]}
      >
        <Text style={styles.headerTexto}>
          {releasesFiltrados().length} resultado{releasesFiltrados().length !== 1 ? 's' : ''}
          {fromCache ? ' · do banco local' : ' · buscado agora'}
        </Text>
      </Animated.View>
    );
  }, [releases.length, releasesFiltrados, fromCache, fadeListaAnim]);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top', 'left', 'right']}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={colors.background} />

      {/* Cabeçalho com animação */}
      <Animated.View
        style={[
          styles.header,
          {
            transform: [{ scale: scaleHeaderAnim }],
          },
        ]}
      >
        <View style={styles.tituloContainer}>
          <Text style={[styles.titulo, { color: colors.text }]}>Music Galaxy</Text>
          <Text style={[styles.subtitulo, { color: colors.textSecondary }]}>Busque versões e lançamentos</Text>
        </View>
        <TouchableOpacity
          style={styles.botaoFavoritos}
          onPress={() => navigation.navigate('Favoritos')}
          activeOpacity={0.7}
          accessibilityLabel="Ver favoritos"
        >
          <Text style={styles.botaoFavoritosTexto}>{MusicEmojis.favorite}</Text>
          {favoritos.length > 0 && (
            <View style={styles.badgeContador}>
              <Text style={styles.badgeContadorTexto}>
                {favoritos.length > 99 ? '99+' : favoritos.length}
              </Text>
            </View>
          )}
        </TouchableOpacity>
      </Animated.View>

      {/* Campo de busca e filtros */}
      <View style={styles.campoBuscaContainer}>
        <View style={[styles.campoBusca, { backgroundColor: colors.input }, focoInput && styles.campoBuscaFocado]}>
          <Text style={styles.iconeBusca}>{MusicEmojis.search}</Text>
          <TextInput
            style={[styles.input, { color: colors.text }]}
            value={termo}
            onChangeText={aoMudarTermo}
            onFocus={() => setFocoInput(true)}
            onBlur={() => setTimeout(() => setFocoInput(false), 200)}
            placeholder="Artista, música ou álbum..."
            placeholderTextColor={colors.textSecondary}
            returnKeyType="search"
            autoCapitalize="none"
            autoCorrect={false}
            clearButtonMode="while-editing"
            accessibilityLabel="Campo de busca musical"
          />
          {termo.length > 0 && (
            <TouchableOpacity
              onPress={limparBusca}
              activeOpacity={0.7}
              accessibilityLabel="Limpar busca"
            >
              <Text style={styles.botaoLimpar}>✕</Text>
            </TouchableOpacity>
          )}
        </View>
        
        <TouchableOpacity
          style={[
            styles.botaoFiltros,
            contadorFiltros > 0 && styles.botaoFiltrosAtivo,
          ]}
          onPress={() => setMostrarFiltros(true)}
          activeOpacity={0.7}
          accessibilityLabel="Abrir filtros"
        >
          <Text style={styles.botaoFiltrosTexto}>⚙️</Text>
          {contadorFiltros > 0 && (
            <View style={styles.badgeFiltros}>
              <Text style={styles.badgeFiltrosTexto}>{contadorFiltros}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {/* Sugestões do histórico com animação */}
      {focoInput && termo.trim().length === 0 && historico.length > 0 && (
        <Animated.View style={[styles.sugestoesContainer, { opacity: fadeListaAnim }]}>
          <View style={styles.sugestoesCabecalho}>
            <Text style={styles.sugestoesTitulo}>🕐 Buscas Recentes</Text>
          </View>
          {historico.slice(0, 8).map((item: ItemHistorico) => (
            <TouchableOpacity
              key={item.termo}
              style={styles.sugestaoItem}
              onPress={() => selecionarSugestao(item.termo)}
              activeOpacity={0.6}
            >
              <Text style={styles.sugestaoTexto} numberOfLines={1}>
                {item.termo}
              </Text>
              <TouchableOpacity
                style={styles.botaoRemoverSugestao}
                onPress={(e) => removerSugestao(item.termo, e)}
                activeOpacity={0.7}
              >
                <Text style={styles.botaoRemoverTexto}>✕</Text>
              </TouchableOpacity>
            </TouchableOpacity>
          ))}
        </Animated.View>
      )}

      {/* Estados com animações */}
      {carregando && releases.length === 0 && (
        <Animated.View
          style={[
            styles.estadoCentro,
            {
              opacity: opacidadeEstadoAnim,
            },
          ]}
        >
          <ActivityIndicator size="large" color="#1DB954" />
          <Text style={styles.estadoTexto}>Buscando versões...</Text>
        </Animated.View>
      )}

      {erro && !carregando && (
        <Animated.View
          style={[
            styles.estadoCentro,
            {
              opacity: opacidadeEstadoAnim,
              transform: [{ translateY: slideEstadoAnim }],
            },
          ]}
        >
          <Text style={styles.erroIcone}>⚠️</Text>
          <Text style={styles.erroTexto}>{erro}</Text>
          <TouchableOpacity
            style={styles.botaoTentar}
            onPress={() => executarBusca(termo, 0, false)}
            activeOpacity={0.7}
          >
            <Text style={styles.botaoTentarTexto}>Tentar novamente</Text>
          </TouchableOpacity>
        </Animated.View>
      )}

      {!carregando && !erro && termo.trim().length > 0 && releasesFiltrados().length === 0 && releases.length > 0 && (
        <Animated.View
          style={[
            styles.estadoCentro,
            {
              opacity: opacidadeEstadoAnim,
              transform: [{ translateY: slideEstadoAnim }],
            },
          ]}
        >
          <Text style={styles.estadoIcone}>🔍</Text>
          <Text style={styles.estadoTexto}>Nenhum resultado com esses filtros</Text>
          <TouchableOpacity
            style={styles.botaoTentar}
            onPress={limparFiltros}
            activeOpacity={0.7}
          >
            <Text style={styles.botaoTentarTexto}>Limpar filtros</Text>
          </TouchableOpacity>
        </Animated.View>
      )}

      {!carregando && !erro && termo.trim().length > 0 && releases.length === 0 && (
        <Animated.View
          style={[
            styles.estadoCentro,
            {
              opacity: opacidadeEstadoAnim,
              transform: [{ translateY: slideEstadoAnim }],
            },
          ]}
        >
          <Text style={styles.estadoIcone}>🎵</Text>
          <Text style={styles.estadoTexto}>Nenhuma versão encontrada</Text>
          <Text style={styles.estadoDica}>Tente outros termos de busca</Text>
        </Animated.View>
      )}

      {!carregando && !erro && termo.trim().length === 0 && (
        <Animated.View
          style={[
            styles.estadoCentro,
            {
              opacity: opacidadeEstadoAnim,
              transform: [{ translateY: slideEstadoAnim }],
            },
          ]}
        >
          <Text style={styles.estadoIcone}>🌌</Text>
          <Text style={styles.estadoTexto}>Explore o universo musical</Text>
          <Text style={styles.estadoDica}>
            Busque um artista ou música para ver todas as versões disponíveis
          </Text>
        </Animated.View>
      )}

      {/* Lista com animação */}
      {releasesFiltrados().length > 0 && (
        <Animated.View
          style={[
            { flex: 1 },
            {
              opacity: fadeListaAnim,
            },
          ]}
        >
          <FlatList
            data={releasesFiltrados()}
            renderItem={renderItem}
            keyExtractor={keyExtractor}
            ListHeaderComponent={ListHeader}
            ListFooterComponent={ListFooter}
            onEndReached={carregarMais}
            onEndReachedThreshold={0.3}
            contentContainerStyle={styles.lista}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            removeClippedSubviews={true}
            maxToRenderPerBatch={10}
            windowSize={5}
          />
        </Animated.View>
      )}

      <FiltrosModal
        visivel={mostrarFiltros}
        filtrosAtuais={filtros}
        onFechar={() => setMostrarFiltros(false)}
        onAplicar={aplicarFiltros}
        onLimpar={limparFiltros}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F0F1A',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'web' ? 50 : 16,
    paddingBottom: 16,
  },
  tituloContainer: {
    flex: 1,
  },
  titulo: {
    fontSize: 28,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  subtitulo: {
    fontSize: 14,
    color: '#8080A0',
    marginTop: 2,
  },
  botaoFavoritos: {
    position: 'relative',
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  botaoFavoritosTexto: {
    fontSize: 28,
  },
  badgeContador: {
    position: 'absolute',
    top: 0,
    right: 0,
    backgroundColor: '#FF6B6B',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  badgeContadorTexto: {
    fontSize: 10,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  campoBuscaContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  campoBusca: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1A1A2E',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#2A2A4A',
  },
  campoBuscaFocado: {
    borderColor: '#1DB954',
    backgroundColor: '#1F1F35',
    ...Platform.select({
      ios: {
        shadowColor: '#1DB954',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
      },
      android: {
        elevation: 6,
      },
    }),
  },
  iconeBusca: {
    fontSize: 16,
    marginRight: 8,
  },
  input: {
    flex: 1,
    fontSize: 15,
    color: '#FFFFFF',
    paddingVertical: 0,
  },
  botaoLimpar: {
    fontSize: 14,
    color: '#555580',
    paddingLeft: 8,
  },
  botaoFiltros: {
    position: 'relative',
    width: 44,
    height: 44,
    backgroundColor: '#1A1A2E',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#2A2A4A',
  },
  botaoFiltrosAtivo: {
    backgroundColor: 'rgba(29, 185, 84, 0.15)',
    borderColor: '#1DB954',
  },
  botaoFiltrosTexto: {
    fontSize: 20,
  },
  badgeFiltros: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: '#1DB954',
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  badgeFiltrosTexto: {
    fontSize: 10,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  sugestoesContainer: {
    marginHorizontal: 16,
    marginBottom: 12,
    backgroundColor: '#1A1A2E',
    borderRadius: 12,
    overflow: 'hidden',
  },
  sugestoesCabecalho: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#2A2A4A',
  },
  sugestoesTitulo: {
    fontSize: 12,
    color: '#8080A0',
    fontWeight: '600',
  },
  sugestaoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1F1F32',
  },
  sugestaoTexto: {
    flex: 1,
    fontSize: 14,
    color: '#FFFFFF',
  },
  botaoRemoverSugestao: {
    paddingLeft: 12,
  },
  botaoRemoverTexto: {
    fontSize: 16,
    color: '#555580',
  },
  lista: {
    paddingBottom: 20,
  },
  headerLista: {
    paddingHorizontal: 20,
    paddingVertical: 8,
  },
  headerTexto: {
    fontSize: 12,
    color: '#606080',
  },
  estadoCentro: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
  },
  estadoIcone: {
    fontSize: 48,
    marginBottom: 16,
  },
  estadoTexto: {
    fontSize: 16,
    color: '#8080A0',
    textAlign: 'center',
    marginBottom: 8,
  },
  estadoDica: {
    fontSize: 13,
    color: '#505070',
    textAlign: 'center',
    lineHeight: 20,
  },
  erroIcone: {
    fontSize: 40,
    marginBottom: 12,
  },
  erroTexto: {
    fontSize: 14,
    color: '#FF6B6B',
    textAlign: 'center',
    marginBottom: 16,
  },
  botaoTentar: {
    backgroundColor: '#1DB954',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  botaoTentarTexto: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 14,
  },
  spinner: {
    paddingVertical: 16,
  },
  fimLista: {
    textAlign: 'center',
    fontSize: 12,
    color: '#505070',
    paddingVertical: 16,
  },
});
