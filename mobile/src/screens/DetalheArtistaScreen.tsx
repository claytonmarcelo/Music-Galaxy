// Tela de detalhes de um artista.
// Exibe informações do artista e todas suas obras musicais.

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  ActivityIndicator,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  Alert,
  RefreshControl,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';

import { RootStackParamList, Artista, Work } from '../types';
import { buscarArtista, buscarObrasArtista } from '../services/api';

type Props = NativeStackScreenProps<RootStackParamList, 'DetalheArtista'>;

export default function DetalheArtistaScreen({ route, navigation }: Props): React.JSX.Element {
  const { artistaId } = route.params;

  // Estados
  const [carregando, setCarregando] = useState(true);
  const [atualizando, setAtualizando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [artista, setArtista] = useState<Artista | null>(null);
  const [obras, setObras] = useState<Work[]>([]);
  const [pagina, setPagina] = useState(0);
  const [temMais, setTemMais] = useState(true);

  const LIMIT = 50;

  // Carrega informações do artista
  const carregarArtista = useCallback(async (): Promise<void> => {
    try {
      const resposta = await buscarArtista(artistaId);

      if (!resposta.success) {
        throw new Error('Erro ao carregar artista');
      }

      setArtista(resposta.data);
      setErro(null);
    } catch (err) {
      const mensagem = err instanceof Error ? err.message : 'Erro desconhecido';
      setErro(mensagem);
      Alert.alert('Erro', mensagem);
    }
  }, [artistaId]);

  // Carrega obras do artista
  const carregarObras = useCallback(
    async (offset = 0, adicionar = false): Promise<void> => {
      try {
        if (offset === 0) setCarregando(true);
        const resposta = await buscarObrasArtista(artistaId, { limit: LIMIT, offset });

        if (!resposta.success) {
          throw new Error('Erro ao carregar obras');
        }

        const { results, total } = resposta.data;

        if (adicionar) {
          setObras(prev => [...prev, ...results]);
        } else {
          setObras(results);
        }

        // Verifica se há mais resultados
        setTemMais(offset + LIMIT < total);
        setPagina(Math.floor(offset / LIMIT) + 1);

        setErro(null);
      } catch (err) {
        const mensagem = err instanceof Error ? err.message : 'Erro desconhecido';
        setErro(mensagem);
        Alert.alert('Erro', mensagem);
      } finally {
        setCarregando(false);
        setAtualizando(false);
      }
    },
    [artistaId]
  );

  // Carregamento inicial
  useEffect(() => {
    carregarArtista();
    carregarObras(0, false);
  }, [artistaId]);

  // Carrega mais obras (paginação infinita)
  const carregarMais = useCallback((): void => {
    if (!temMais || atualizando || carregando) return;
    setAtualizando(true);
    carregarObras(pagina * LIMIT, true);
  }, [pagina, temMais, atualizando, carregando, carregarObras]);

  // Atualiza a lista (pull-to-refresh)
  const handleAtualizacao = useCallback(async (): Promise<void> => {
    setAtualizando(true);
    await carregarArtista();
    await carregarObras(0, false);
  }, [carregarArtista, carregarObras]);

  // Navega para detalhes da obra
  const handleSelecionarObra = (obra: Work): void => {
    navigation.push('DetalheWork', { workId: obra.id });
  };

  // Renderers
  if (carregando) {
    return (
      <View style={styles.containerCentrado}>
        <ActivityIndicator size="large" color="#FF6B35" />
        <Text style={styles.textoCentrado}>Carregando artista...</Text>
      </View>
    );
  }

  if (erro && !artista) {
    return (
      <View style={styles.containerCentrado}>
        <Text style={styles.textoErro}>Erro ao carregar: {erro}</Text>
        <TouchableOpacity
          style={styles.botaoTentar}
          onPress={() => {
            carregarArtista();
            carregarObras(0, false);
          }}
        >
          <Text style={styles.textoButton}>Tentar Novamente</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Renderiza uma obra na lista
  const renderObra = (obra: Work): React.JSX.Element => (
    <TouchableOpacity
      style={styles.cardObra}
      onPress={() => handleSelecionarObra(obra)}
      activeOpacity={0.7}
    >
      <View style={styles.conteudoCard}>
        <Text style={styles.tituloObra} numberOfLines={2}>
          {obra.title}
        </Text>
        <Text style={styles.anoObra}>
          {obra.original_release_year || 'Ano desconhecido'}
        </Text>
      </View>
      <Text style={styles.seta}>→</Text>
    </TouchableOpacity>
  );

  // Renderiza cabeçalho do artista
  const renderCabecalho = (): React.JSX.Element => (
    <View style={styles.secaoCabecalho}>
      <Text style={styles.nomeArtista}>{artista?.name || 'Artista'}</Text>
      {artista?.country && (
        <Text style={styles.paisArtista}>🌍 {artista.country}</Text>
      )}
      <Text style={styles.totalObras}>
        {obras.length} obra{obras.length !== 1 ? 's' : ''} encontrada{obras.length !== 1 ? 's' : ''}
      </Text>
    </View>
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
        >
          {atualizando ? (
            <ActivityIndicator size="small" color="#FF6B35" />
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
      <View style={styles.headerBox}>
        <TouchableOpacity
          style={styles.botaoVoltar}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.textoVoltar}>← Voltar</Text>
        </TouchableOpacity>
        <Text style={styles.tituloHeader}>Artista</Text>
      </View>

      {/* Conteúdo */}
      <ScrollView
        style={styles.conteudo}
        refreshControl={
          <RefreshControl
            refreshing={atualizando}
            onRefresh={handleAtualizacao}
            tintColor="#FF6B35"
          />
        }
      >
        {renderCabecalho()}

        {/* Lista de obras */}
        {obras.length > 0 ? (
          <FlatList
            scrollEnabled={false}
            data={obras}
            keyExtractor={obra => `work-${obra.id}`}
            renderItem={({ item }) => renderObra(item)}
          />
        ) : (
          <View style={styles.containerSemDados}>
            <Text style={styles.textoSemDados}>Nenhuma obra encontrada</Text>
          </View>
        )}

        {renderRodape()}

        {/* Espaço extra no final */}
        <View style={{ height: 20 }} />
      </ScrollView>
    </View>
  );
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
  },

  botaoVoltar: {
    padding: 8,
  },

  textoVoltar: {
    color: '#FF6B35',
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
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#2E2E4E',
  },

  nomeArtista: {
    color: '#FFFFFF',
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 8,
  },

  paisArtista: {
    color: '#AAAAAA',
    fontSize: 14,
    marginBottom: 12,
  },

  totalObras: {
    color: '#FF6B35',
    fontSize: 14,
    fontWeight: '600',
  },

  cardObra: {
    backgroundColor: '#1A1A2E',
    borderRadius: 8,
    marginBottom: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    borderLeftWidth: 4,
    borderLeftColor: '#FF6B35',
  },

  conteudoCard: {
    flex: 1,
  },

  tituloObra: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 4,
  },

  anoObra: {
    color: '#AAAAAA',
    fontSize: 13,
  },

  seta: {
    color: '#FF6B35',
    fontSize: 16,
    fontWeight: 'bold',
  },

  containerCentrado: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0F0F1A',
  },

  textoCentrado: {
    color: '#AAAAAA',
    fontSize: 14,
    marginTop: 12,
  },

  textoErro: {
    color: '#FF6B35',
    fontSize: 16,
    marginBottom: 16,
    textAlign: 'center',
  },

  botaoTentar: {
    backgroundColor: '#FF6B35',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 6,
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

  textoSemDados: {
    color: '#AAAAAA',
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
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#FF6B35',
  },

  textoCarregarMais: {
    color: '#FF6B35',
    fontWeight: 'bold',
    fontSize: 14,
  },
});
