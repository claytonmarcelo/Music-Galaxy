// Tela de Exploração — releases recentes, obras por década.
// Funciona como um discovery interface para encontrar novo conteúdo.

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  Alert,
  RefreshControl,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';

import { RootStackParamList, Release, Work } from '../types';
import { API_BASE_URL } from '../services/api';

type Props = NativeStackScreenProps<RootStackParamList, 'Explorar'>;

type SecaoAtiva = 'recentes' | 'decadas';

// Interface local para resposta de releases recentes
interface RespostaReleasesRecentes {
  success: boolean;
  data: {
    results: Release[];
    total: number;
    limit: number;
    offset: number;
  };
}

// Interface local para resposta de obras por década
interface RespostaObrasPorDecada {
  success: boolean;
  data: {
    decade: string;
    results: Work[];
    total: number;
    limit: number;
    offset: number;
  };
}

const DECADAS = [1960, 1970, 1980, 1990, 2000, 2010, 2020];

export default function TelaExplorar({ navigation }: Props): React.JSX.Element {
  const [secaoAtiva, setSecaoAtiva] = useState<SecaoAtiva>('recentes');
  const [carregandoRecentes, setCarregandoRecentes] = useState(true);
  const [releasesRecentes, setReleasesRecentes] = useState<Release[]>([]);
  const [erroRecentes, setErroRecentes] = useState<string | null>(null);

  const [decadaSelecionada, setDecadaSelecionada] = useState(2020);
  const [carregandoDecada, setCarregandoDecada] = useState(false);
  const [obrasDecada, setObrasDecada] = useState<Work[]>([]);
  const [erroDecada, setErroDecada] = useState<string | null>(null);

  // Carrega releases recentes na primeira renderização
  useEffect(() => {
    carregarReleasesRecentes();
  }, []);

  // Carrega obras da década quando a seleção muda
  useEffect(() => {
    if (secaoAtiva === 'decadas') {
      carregarObrasPorDecada(decadaSelecionada);
    }
  }, [decadaSelecionada]);

  // Carrega releases recentes
  const carregarReleasesRecentes = useCallback(async (): Promise<void> => {
    try {
      setCarregandoRecentes(true);
      setErroRecentes(null);

      const response = await fetch(`${API_BASE_URL}/api/releases/by-date?limit=50&offset=0`);

      if (!response.ok) {
        throw new Error('Erro ao carregar releases recentes');
      }

      const data: RespostaReleasesRecentes = await response.json();

      if (data.success) {
        setReleasesRecentes(data.data.results);
      } else {
        throw new Error('Resposta inválida da API');
      }
    } catch (err) {
      const mensagem = err instanceof Error ? err.message : 'Erro desconhecido';
      setErroRecentes(mensagem);
      Alert.alert('Erro', mensagem);
    } finally {
      setCarregandoRecentes(false);
    }
  }, []);

  // Carrega obras de uma década específica
  const carregarObrasPorDecada = useCallback(async (decada: number): Promise<void> => {
    try {
      setCarregandoDecada(true);
      setErroDecada(null);

      const response = await fetch(
        `${API_BASE_URL}/api/works/by-decade/${decada}?limit=50&offset=0`
      );

      if (!response.ok) {
        throw new Error('Erro ao carregar obras');
      }

      const data: RespostaObrasPorDecada = await response.json();

      if (data.success) {
        setObrasDecada(data.data.results);
      } else {
        throw new Error('Resposta inválida da API');
      }
    } catch (err) {
      const mensagem = err instanceof Error ? err.message : 'Erro desconhecido';
      setErroDecada(mensagem);
      Alert.alert('Erro', mensagem);
    } finally {
      setCarregandoDecada(false);
    }
  }, []);

  // Navega para detalhes do release
  const handleSelecionarRelease = (release: Release): void => {
    navigation.push('DetalheRelease', { release });
  };

  // Navega para detalhes da obra
  const handleSelecionarObra = (obra: Work): void => {
    navigation.push('DetalheWork', { workId: obra.id });
  };

  // Renderiza card de release
  const renderReleaseCard = (release: Release): React.JSX.Element => (
    <TouchableOpacity
      style={styles.cardRelease}
      onPress={() => handleSelecionarRelease(release)}
      activeOpacity={0.7}
    >
      <View style={styles.conteudoCardRelease}>
        <Text style={styles.versionName} numberOfLines={2}>
          {release.version_name}
        </Text>
        <Text style={styles.workArtist} numberOfLines={1}>
          {release.work_title} • {release.artist_name}
        </Text>
        <Text style={styles.releaseInfo}>
          {release.release_year || '?'} • {release.release_type}
        </Text>
      </View>
      <Text style={styles.seta}>→</Text>
    </TouchableOpacity>
  );

  // Renderiza card de obra
  const renderObraCard = (obra: Work): React.JSX.Element => (
    <TouchableOpacity
      style={styles.cardObra}
      onPress={() => handleSelecionarObra(obra)}
      activeOpacity={0.7}
    >
      <View style={styles.conteudoCardObra}>
        <Text style={styles.tituloObra} numberOfLines={2}>
          {obra.title}
        </Text>
        <Text style={styles.artistaObra} numberOfLines={1}>
          {obra.artist.name}
        </Text>
        <Text style={styles.anoObra}>
          {obra.original_release_year || 'Ano desconhecido'}
        </Text>
      </View>
      <Text style={styles.seta}>→</Text>
    </TouchableOpacity>
  );

  // Renderiza botão de década
  const renderBotaoDecada = (decada: number): React.JSX.Element => (
    <TouchableOpacity
      style={[
        styles.botaoDecada,
        decadaSelecionada === decada && styles.botaoDecadaSelecionado,
      ]}
      onPress={() => setDecadaSelecionada(decada)}
    >
      <Text
        style={[
          styles.textoDecada,
          decadaSelecionada === decada && styles.textoDecadaSelecionado,
        ]}
      >
        {decada}s
      </Text>
    </TouchableOpacity>
  );

  // Renderiza seção de recentes
  const renderRecentes = (): React.JSX.Element => (
    <View style={styles.conteudoSecao}>
      <Text style={styles.tituloSecao}>🎵 Releases Recentes</Text>

      {carregandoRecentes ? (
        <View style={styles.containerCarregando}>
          <ActivityIndicator size="large" color="#FF6B35" />
        </View>
      ) : erroRecentes ? (
        <View style={styles.containerErro}>
          <Text style={styles.textoErro}>{erroRecentes}</Text>
          <TouchableOpacity
            style={styles.botaoTentar}
            onPress={carregarReleasesRecentes}
          >
            <Text style={styles.textoButton}>Tentar Novamente</Text>
          </TouchableOpacity>
        </View>
      ) : releasesRecentes.length > 0 ? (
        <FlatList
          scrollEnabled={false}
          data={releasesRecentes}
          keyExtractor={rel => `recente-${rel.id}`}
          renderItem={({ item }) => renderReleaseCard(item)}
        />
      ) : (
        <View style={styles.containerVazio}>
          <Text style={styles.textoVazio}>Nenhum release encontrado</Text>
        </View>
      )}
    </View>
  );

  // Renderiza seção de décadas
  const renderDecadas = (): React.JSX.Element => (
    <View style={styles.conteudoSecao}>
      <Text style={styles.tituloSecao}>📅 Explorar por Década</Text>

      <View style={styles.containerDecadas}>
        {DECADAS.map(decada => renderBotaoDecada(decada))}
      </View>

      {carregandoDecada ? (
        <View style={styles.containerCarregando}>
          <ActivityIndicator size="large" color="#FF6B35" />
        </View>
      ) : erroDecada ? (
        <View style={styles.containerErro}>
          <Text style={styles.textoErro}>{erroDecada}</Text>
        </View>
      ) : obrasDecada.length > 0 ? (
        <>
          <Text style={styles.subtitulo}>
            {obrasDecada.length} obra{obrasDecada.length !== 1 ? 's' : ''} dos anos {decadaSelecionada}
          </Text>
          <FlatList
            scrollEnabled={false}
            data={obrasDecada}
            keyExtractor={obra => `decada-${obra.id}`}
            renderItem={({ item }) => renderObraCard(item)}
          />
        </>
      ) : (
        <View style={styles.containerVazio}>
          <Text style={styles.textoVazio}>
            Nenhuma obra encontrada na década de {decadaSelecionada}
          </Text>
        </View>
      )}
    </View>
  );

  return (
    <View style={styles.container}>
      {/* Cabeçalho */}
      <View style={styles.headerBox}>
        <Text style={styles.tituloHeader}>Explorar</Text>
        <Text style={styles.subtituloHeader}>Descubra novo conteúdo</Text>
      </View>

      {/* Abas */}
      <View style={styles.containerAbas}>
        <TouchableOpacity
          style={[styles.aba, secaoAtiva === 'recentes' && styles.abaAtiva]}
          onPress={() => setSecaoAtiva('recentes')}
        >
          <Text
            style={[
              styles.textoAba,
              secaoAtiva === 'recentes' && styles.textoAbaAtiva,
            ]}
          >
            Recentes
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.aba, secaoAtiva === 'decadas' && styles.abaAtiva]}
          onPress={() => setSecaoAtiva('decadas')}
        >
          <Text
            style={[
              styles.textoAba,
              secaoAtiva === 'decadas' && styles.textoAbaAtiva,
            ]}
          >
            Por Década
          </Text>
        </TouchableOpacity>
      </View>

      {/* Conteúdo */}
      <ScrollView style={styles.conteudo}>
        {secaoAtiva === 'recentes' && renderRecentes()}
        {secaoAtiva === 'decadas' && renderDecadas()}

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
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#1A1A2E',
    borderBottomWidth: 1,
    borderBottomColor: '#2E2E4E',
  },

  tituloHeader: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 4,
  },

  subtituloHeader: {
    color: '#AAAAAA',
    fontSize: 13,
  },

  containerAbas: {
    flexDirection: 'row',
    backgroundColor: '#1A1A2E',
    borderBottomWidth: 1,
    borderBottomColor: '#2E2E4E',
  },

  aba: {
    flex: 1,
    paddingVertical: 12,
    justifyContent: 'center',
    alignItems: 'center',
    borderBottomWidth: 3,
    borderBottomColor: 'transparent',
  },

  abaAtiva: {
    borderBottomColor: '#FF6B35',
  },

  textoAba: {
    color: '#AAAAAA',
    fontSize: 14,
    fontWeight: '600',
  },

  textoAbaAtiva: {
    color: '#FF6B35',
  },

  conteudo: {
    flex: 1,
    paddingHorizontal: 12,
    paddingTop: 16,
  },

  conteudoSecao: {
    paddingBottom: 20,
  },

  tituloSecao: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
  },

  subtitulo: {
    color: '#AAAAAA',
    fontSize: 13,
    marginBottom: 12,
  },

  cardRelease: {
    backgroundColor: '#1A1A2E',
    borderRadius: 8,
    marginBottom: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    borderLeftWidth: 4,
    borderLeftColor: '#FF6B35',
  },

  conteudoCardRelease: {
    flex: 1,
  },

  versionName: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 4,
  },

  workArtist: {
    color: '#AAAAAA',
    fontSize: 13,
    marginBottom: 4,
  },

  releaseInfo: {
    color: '#FF6B35',
    fontSize: 12,
    fontWeight: 'bold',
  },

  cardObra: {
    backgroundColor: '#1A1A2E',
    borderRadius: 8,
    marginBottom: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    borderLeftWidth: 4,
    borderLeftColor: '#FF6B35',
  },

  conteudoCardObra: {
    flex: 1,
  },

  tituloObra: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 4,
  },

  artistaObra: {
    color: '#AAAAAA',
    fontSize: 13,
    marginBottom: 4,
  },

  anoObra: {
    color: '#FF6B35',
    fontSize: 12,
    fontWeight: 'bold',
  },

  seta: {
    color: '#FF6B35',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 12,
  },

  containerDecadas: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 20,
    justifyContent: 'space-between',
  },

  botaoDecada: {
    width: '48%',
    backgroundColor: '#1A1A2E',
    borderRadius: 8,
    paddingVertical: 12,
    marginBottom: 8,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#2E2E4E',
  },

  botaoDecadaSelecionado: {
    backgroundColor: '#FF6B35',
    borderColor: '#FF6B35',
  },

  textoDecada: {
    color: '#AAAAAA',
    fontSize: 16,
    fontWeight: 'bold',
  },

  textoDecadaSelecionado: {
    color: '#FFFFFF',
  },

  containerCarregando: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },

  containerErro: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },

  textoErro: {
    color: '#FF6B35',
    fontSize: 14,
    marginBottom: 16,
    textAlign: 'center',
  },

  botaoTentar: {
    backgroundColor: '#FF6B35',
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 6,
  },

  textoButton: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 13,
  },

  containerVazio: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 48,
  },

  textoVazio: {
    color: '#AAAAAA',
    fontSize: 14,
  },
});
