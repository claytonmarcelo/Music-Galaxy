// Tela de Exploração — versões recentes e obras por década.
// Funciona como uma vitrine de descoberta para encontrar conteúdo novo.
// Segue a identidade visual de vidro fosco: fundo com luzes suaves e cartões translúcidos.

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';

import { RootStackParamList, Release, Work } from '../types';
import { BASE_URL } from '../services/api';
import { useTheme } from '../contexts/ThemeContext';
import { useModal } from '../contexts/ModalContext';
import AuroraBackground from '../components/AuroraBackground';
import GlassCard from '../components/GlassCard';

type Props = NativeStackScreenProps<RootStackParamList, 'Explorar'>;

type SecaoAtiva = 'recentes' | 'decadas';

// Interface local para resposta de versões recentes
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
  const { colors } = useTheme();
  const { abrirErro } = useModal();
  const [secaoAtiva, setSecaoAtiva] = useState<SecaoAtiva>('recentes');
  const [carregandoRecentes, setCarregandoRecentes] = useState(true);
  const [releasesRecentes, setReleasesRecentes] = useState<Release[]>([]);
  const [erroRecentes, setErroRecentes] = useState<string | null>(null);

  const [decadaSelecionada, setDecadaSelecionada] = useState(2020);
  const [carregandoDecada, setCarregandoDecada] = useState(false);
  const [obrasDecada, setObrasDecada] = useState<Work[]>([]);
  const [erroDecada, setErroDecada] = useState<string | null>(null);

  // Carrega versões recentes na primeira renderização
  useEffect(() => {
    carregarReleasesRecentes();
  }, []);

  // Carrega obras da década quando a seleção muda
  useEffect(() => {
    if (secaoAtiva === 'decadas') {
      carregarObrasPorDecada(decadaSelecionada);
    }
  }, [decadaSelecionada]);

  // Carrega versões recentes
  const carregarReleasesRecentes = useCallback(async (): Promise<void> => {
    try {
      setCarregandoRecentes(true);
      setErroRecentes(null);

      const response = await fetch(`${BASE_URL}/api/releases/by-date?limit=50&offset=0`);

      if (!response.ok) {
        throw new Error('Erro ao carregar versões recentes');
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
      abrirErro('Não foi possível carregar', mensagem);
    } finally {
      setCarregandoRecentes(false);
    }
  }, [abrirErro]);

  // Carrega obras de uma década específica
  const carregarObrasPorDecada = useCallback(async (decada: number): Promise<void> => {
    try {
      setCarregandoDecada(true);
      setErroDecada(null);

      const response = await fetch(
        `${BASE_URL}/api/works/by-decade/${decada}?limit=50&offset=0`
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
      abrirErro('Não foi possível carregar', mensagem);
    } finally {
      setCarregandoDecada(false);
    }
  }, [abrirErro]);

  // Navega para detalhes da versão
  const handleSelecionarRelease = (release: Release): void => {
    navigation.push('DetalheRelease', { release });
  };

  // Navega para detalhes da obra
  const handleSelecionarObra = (obra: Work): void => {
    navigation.push('DetalheWork', { workId: obra.id });
  };

  // Renderiza card de versão
  const renderReleaseCard = (release: Release): React.JSX.Element => (
    <TouchableOpacity
      onPress={() => handleSelecionarRelease(release)}
      activeOpacity={0.7}
    >
      <GlassCard style={[styles.cardRelease, { borderLeftColor: colors.primary }]}>
        <View style={styles.conteudoCardRelease}>
          <Text style={[styles.versionName, { color: colors.text }]} numberOfLines={2}>
            {release.version_name}
          </Text>
          <Text style={[styles.workArtist, { color: colors.textSecondary }]} numberOfLines={1}>
            {release.work_title} • {release.artist_name}
          </Text>
          <Text style={[styles.releaseInfo, { color: colors.primary }]}>
            {release.release_year || '?'} • {release.release_type}
          </Text>
        </View>
        <Text style={[styles.seta, { color: colors.primary }]}>→</Text>
      </GlassCard>
    </TouchableOpacity>
  );

  // Renderiza card de obra
  const renderObraCard = (obra: Work): React.JSX.Element => (
    <TouchableOpacity
      onPress={() => handleSelecionarObra(obra)}
      activeOpacity={0.7}
    >
      <GlassCard style={[styles.cardObra, { borderLeftColor: colors.primary }]}>
        <View style={styles.conteudoCardObra}>
          <Text style={[styles.tituloObra, { color: colors.text }]} numberOfLines={2}>
            {obra.title}
          </Text>
          <Text style={[styles.artistaObra, { color: colors.textSecondary }]} numberOfLines={1}>
            {obra.artist.name}
          </Text>
          <Text style={[styles.anoObra, { color: colors.primary }]}>
            {obra.original_release_year || 'Ano desconhecido'}
          </Text>
        </View>
        <Text style={[styles.seta, { color: colors.primary }]}>→</Text>
      </GlassCard>
    </TouchableOpacity>
  );

  // Renderiza botão de década
  const renderBotaoDecada = (decada: number): React.JSX.Element => {
    const selecionado = decadaSelecionada === decada;
    return (
      <TouchableOpacity
        style={[
          styles.botaoDecada,
          {
            backgroundColor: selecionado ? colors.primary : colors.glassCard,
            borderColor: selecionado ? colors.primary : colors.glassBorder,
          },
        ]}
        onPress={() => setDecadaSelecionada(decada)}
      >
        <Text
          style={[
            styles.textoDecada,
            { color: selecionado ? colors.buttonText : colors.textSecondary },
          ]}
        >
          {decada}s
        </Text>
      </TouchableOpacity>
    );
  };

  // Renderiza seção de recentes
  const renderRecentes = (): React.JSX.Element => (
    <View style={styles.conteudoSecao}>
      <Text style={[styles.tituloSecao, { color: colors.text }]}>🎵 Versões recentes</Text>

      {carregandoRecentes ? (
        <View style={styles.containerCarregando}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : erroRecentes ? (
        <View style={styles.containerErro}>
          <Text style={[styles.textoErro, { color: colors.error }]}>{erroRecentes}</Text>
          <TouchableOpacity
            style={[styles.botaoTentar, { backgroundColor: colors.button }]}
            onPress={carregarReleasesRecentes}
          >
            <Text style={[styles.textoButton, { color: colors.buttonText }]}>Tentar novamente</Text>
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
          <Text style={[styles.textoVazio, { color: colors.textSecondary }]}>
            Nenhuma versão encontrada
          </Text>
        </View>
      )}
    </View>
  );

  // Renderiza seção de décadas
  const renderDecadas = (): React.JSX.Element => (
    <View style={styles.conteudoSecao}>
      <Text style={[styles.tituloSecao, { color: colors.text }]}>📅 Explorar por Década</Text>

      <View style={styles.containerDecadas}>
        {DECADAS.map(decada => renderBotaoDecada(decada))}
      </View>

      {carregandoDecada ? (
        <View style={styles.containerCarregando}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : erroDecada ? (
        <View style={styles.containerErro}>
          <Text style={[styles.textoErro, { color: colors.error }]}>{erroDecada}</Text>
        </View>
      ) : obrasDecada.length > 0 ? (
        <>
          <Text style={[styles.subtitulo, { color: colors.textSecondary }]}>
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
          <Text style={[styles.textoVazio, { color: colors.textSecondary }]}>
            Nenhuma obra encontrada na década de {decadaSelecionada}
          </Text>
        </View>
      )}
    </View>
  );

  return (
    <AuroraBackground style={styles.container}>
      {/* Cabeçalho em vidro forte */}
      <View
        style={[
          styles.headerBox,
          { backgroundColor: colors.glassCardForte, borderBottomColor: colors.glassBorder },
        ]}
      >
        <Text style={[styles.tituloHeader, { color: colors.text }]}>Explorar</Text>
        <Text style={[styles.subtituloHeader, { color: colors.textSecondary }]}>
          Descubra novo conteúdo
        </Text>
      </View>

      {/* Abas */}
      <View
        style={[
          styles.containerAbas,
          { backgroundColor: colors.glassCardForte, borderBottomColor: colors.glassBorder },
        ]}
      >
        <TouchableOpacity
          style={[
            styles.aba,
            secaoAtiva === 'recentes' && { borderBottomColor: colors.primary },
          ]}
          onPress={() => setSecaoAtiva('recentes')}
        >
          <Text
            style={[
              styles.textoAba,
              { color: secaoAtiva === 'recentes' ? colors.primary : colors.textSecondary },
            ]}
          >
            Recentes
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.aba,
            secaoAtiva === 'decadas' && { borderBottomColor: colors.primary },
          ]}
          onPress={() => setSecaoAtiva('decadas')}
        >
          <Text
            style={[
              styles.textoAba,
              { color: secaoAtiva === 'decadas' ? colors.primary : colors.textSecondary },
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
    </AuroraBackground>
  );
}

// ============================================================
// Estilos
// As cores vêm do tema (useTheme) e são aplicadas nos componentes;
// aqui ficam apenas os valores de layout.
// ============================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },

  headerBox: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },

  tituloHeader: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 4,
  },

  subtituloHeader: {
    fontSize: 13,
  },

  containerAbas: {
    flexDirection: 'row',
    borderBottomWidth: 1,
  },

  aba: {
    flex: 1,
    paddingVertical: 12,
    justifyContent: 'center',
    alignItems: 'center',
    borderBottomWidth: 3,
    borderBottomColor: 'transparent',
  },

  textoAba: {
    fontSize: 14,
    fontWeight: '600',
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
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
  },

  subtitulo: {
    fontSize: 13,
    marginBottom: 12,
  },

  cardRelease: {
    marginBottom: 12,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    borderLeftWidth: 4,
  },

  conteudoCardRelease: {
    flex: 1,
  },

  versionName: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 4,
  },

  workArtist: {
    fontSize: 13,
    marginBottom: 4,
  },

  releaseInfo: {
    fontSize: 12,
    fontWeight: 'bold',
  },

  cardObra: {
    marginBottom: 12,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    borderLeftWidth: 4,
  },

  conteudoCardObra: {
    flex: 1,
  },

  tituloObra: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 4,
  },

  artistaObra: {
    fontSize: 13,
    marginBottom: 4,
  },

  anoObra: {
    fontSize: 12,
    fontWeight: 'bold',
  },

  seta: {
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
    borderRadius: 16,
    paddingVertical: 12,
    marginBottom: 8,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
  },

  textoDecada: {
    fontSize: 16,
    fontWeight: 'bold',
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
    fontSize: 14,
    marginBottom: 16,
    textAlign: 'center',
  },

  botaoTentar: {
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 12,
  },

  textoButton: {
    fontWeight: 'bold',
    fontSize: 13,
  },

  containerVazio: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 48,
  },

  textoVazio: {
    fontSize: 14,
  },
});
