// Tela principal de busca musical.
// Implementa debounce de 600ms para evitar chamadas desnecessárias à API
// enquanto o usuário digita. Cancela requisições pendentes com AbortController
// quando o termo muda ou o componente é desmontado.

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
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { buscarMusicas } from '../services/api';
import { Release, RootStackParamList, RespostaBusca } from '../types';
import ReleaseCard from '../components/ReleaseCard';

type NavProp = NativeStackNavigationProp<RootStackParamList, 'Busca'>;

// Intervalo de debounce: aguarda o usuário parar de digitar antes de buscar
const DEBOUNCE_MS = 600;

// Quantidade de itens por página para paginação infinita
const ITENS_POR_PAGINA = 30;

export default function BuscaScreen(): React.JSX.Element {
  const navigation = useNavigation<NavProp>();

  const [termo, setTermo]           = useState('');
  const [releases, setReleases]     = useState<Release[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro]             = useState<string | null>(null);
  const [total, setTotal]           = useState(0);
  const [offset, setOffset]         = useState(0);
  const [fromCache, setFromCache]   = useState(false);

  // Referência para o timer de debounce — cancelado quando o termo muda
  const timerDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Referência para o AbortController — cancela requisições ao mudar o termo
  const abortController = useRef<AbortController | null>(null);

  // Limpa recursos ao desmontar o componente
  useEffect(() => {
    return () => {
      timerDebounce.current && clearTimeout(timerDebounce.current);
      abortController.current?.abort();
    };
  }, []);

  // Executa a busca na API com debounce.
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

    // Cancela requisição anterior se ainda estiver em andamento
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
        // Acumula resultados para paginação infinita, substitui para nova busca
        setReleases(prev => acumular ? [...prev, ...resultado.data.results] : resultado.data.results);
        setTotal(resultado.data.total);
        setFromCache(resultado.data.fromCache);
      }
    } catch (err: unknown) {
      // Ignora cancelamento por AbortController — não é um erro real
      if (err instanceof Error && err.name === 'AbortError') return;
      const mensagem = err instanceof Error ? err.message : 'Erro ao buscar músicas.';
      setErro(mensagem);
    } finally {
      setCarregando(false);
    }
  }, []);

  // Reage às mudanças no campo de busca com debounce
  const aoMudarTermo = useCallback((novoTermo: string) => {
    setTermo(novoTermo);
    setOffset(0);

    // Cancela debounce anterior
    timerDebounce.current && clearTimeout(timerDebounce.current);

    if (!novoTermo.trim()) {
      setReleases([]);
      setTotal(0);
      setErro(null);
      setCarregando(false);
      return;
    }

    // Agenda a busca após o debounce
    timerDebounce.current = setTimeout(() => {
      executarBusca(novoTermo, 0, false);
    }, DEBOUNCE_MS);
  }, [executarBusca]);

  // Carrega mais resultados ao chegar no fim da lista (paginação infinita)
  const carregarMais = useCallback(() => {
    if (carregando || releases.length >= total) return;
    const novoOffset = offset + ITENS_POR_PAGINA;
    setOffset(novoOffset);
    executarBusca(termo, novoOffset, true);
  }, [carregando, releases.length, total, offset, termo, executarBusca]);

  // Limpa o campo de busca
  const limparBusca = useCallback(() => {
    timerDebounce.current && clearTimeout(timerDebounce.current);
    abortController.current?.abort();
    setTermo('');
    setReleases([]);
    setTotal(0);
    setErro(null);
    setOffset(0);
  }, []);

  // Renderiza cada card de release na lista
  const renderItem = useCallback(({ item }: ListRenderItemInfo<Release>) => (
    <ReleaseCard
      release={item}
      onPress={() => navigation.navigate('DetalheRelease', { release: item })}
    />
  ), [navigation]);

  // Chave única para cada item da FlatList
  const keyExtractor = useCallback((item: Release) => String(item.id), []);

  // Rodapé da lista: spinner de carregamento ou mensagem de fim
  const ListFooter = useCallback(() => {
    if (carregando && releases.length > 0) {
      return <ActivityIndicator size="small" color="#1DB954" style={styles.spinner} />;
    }
    if (!carregando && releases.length >= total && total > 0) {
      return (
        <Text style={styles.fimLista}>
          {total} versão{total !== 1 ? 'ões' : ''} encontrada{total !== 1 ? 's' : ''}
        </Text>
      );
    }
    return null;
  }, [carregando, releases.length, total]);

  // Cabeçalho da lista: informação sobre fonte dos dados
  const ListHeader = useCallback(() => {
    if (releases.length === 0) return null;
    return (
      <View style={styles.headerLista}>
        <Text style={styles.headerTexto}>
          {total} resultado{total !== 1 ? 's' : ''}
          {fromCache ? ' · do banco local' : ' · buscado agora'}
        </Text>
      </View>
    );
  }, [releases.length, total, fromCache]);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0F0F1A" />

      {/* Cabeçalho */}
      <View style={styles.header}>
        <Text style={styles.titulo}>Music Galaxy</Text>
        <Text style={styles.subtitulo}>Busque versões e lançamentos</Text>
      </View>

      {/* Campo de busca */}
      <View style={styles.campoBuscaContainer}>
        <View style={styles.campoBusca}>
          <Text style={styles.iconeBusca}>🔍</Text>
          <TextInput
            style={styles.input}
            value={termo}
            onChangeText={aoMudarTermo}
            placeholder="Artista, música ou álbum..."
            placeholderTextColor="#555580"
            returnKeyType="search"
            autoCapitalize="none"
            autoCorrect={false}
            clearButtonMode="while-editing"
            accessibilityLabel="Campo de busca musical"
            accessibilityHint="Digite o nome de um artista, música ou álbum"
          />
          {termo.length > 0 && (
            <TouchableOpacity onPress={limparBusca} accessibilityLabel="Limpar busca">
              <Text style={styles.botaoLimpar}>✕</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Estado: carregando (primeira busca) */}
      {carregando && releases.length === 0 && (
        <View style={styles.estadoCentro}>
          <ActivityIndicator size="large" color="#1DB954" />
          <Text style={styles.estadoTexto}>Buscando versões...</Text>
        </View>
      )}

      {/* Estado: erro */}
      {erro && !carregando && (
        <View style={styles.estadoCentro}>
          <Text style={styles.erroIcone}>⚠️</Text>
          <Text style={styles.erroTexto}>{erro}</Text>
          <TouchableOpacity
            style={styles.botaoTentar}
            onPress={() => executarBusca(termo, 0, false)}
          >
            <Text style={styles.botaoTentarTexto}>Tentar novamente</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Estado: sem resultados */}
      {!carregando && !erro && termo.trim().length > 0 && releases.length === 0 && (
        <View style={styles.estadoCentro}>
          <Text style={styles.estadoIcone}>🎵</Text>
          <Text style={styles.estadoTexto}>Nenhuma versão encontrada</Text>
          <Text style={styles.estadoDica}>Tente outros termos de busca</Text>
        </View>
      )}

      {/* Estado: tela inicial sem busca */}
      {!carregando && !erro && termo.trim().length === 0 && (
        <View style={styles.estadoCentro}>
          <Text style={styles.estadoIcone}>🌌</Text>
          <Text style={styles.estadoTexto}>Explore o universo musical</Text>
          <Text style={styles.estadoDica}>
            Busque um artista ou música para ver todas as versões disponíveis
          </Text>
        </View>
      )}

      {/* Lista de resultados */}
      {releases.length > 0 && (
        <FlatList
          data={releases}
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
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F0F1A',
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 50,
    paddingBottom: 16,
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
  campoBuscaContainer: {
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  campoBusca: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1A1A2E',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#2A2A4A',
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
