// Tela de detalhes de um artista.
// Exibe informações do artista e todas suas obras musicais,
// com o visual de vidro fosco: cabeçalho e cartões translúcidos.

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  ActivityIndicator,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';

import { RootStackParamList, Artista, Work } from '../types';
import { buscarArtista, buscarObrasArtista } from '../services/api';
import { useModal } from '../contexts/ModalContext';
import { useTheme } from '../contexts/ThemeContext';
import AuroraBackground from '../components/AuroraBackground';
import GlassCard from '../components/GlassCard';

type Props = NativeStackScreenProps<RootStackParamList, 'DetalheArtista'>;

export default function DetalheArtistaScreen({ route, navigation }: Props): React.JSX.Element {
  const { artistaId } = route.params;
  const { abrirErro } = useModal();
  const { colors } = useTheme();

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
      abrirErro(
        'Não foi possível carregar',
        'Não foi possível carregar as informações deste artista. Verifique sua conexão e tente novamente.\n\nDetalhe: ' + mensagem
      );
    }
  }, [artistaId, abrirErro]);

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
        abrirErro(
          'Não foi possível carregar',
          'Não foi possível carregar as obras deste artista. Verifique sua conexão e tente novamente.\n\nDetalhe: ' + mensagem
        );
      } finally {
        setCarregando(false);
        setAtualizando(false);
      }
    },
    [artistaId, abrirErro]
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
      <AuroraBackground>
        <View style={styles.containerCentrado}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.textoCentrado, { color: colors.textSecondary }]}>Carregando artista...</Text>
        </View>
      </AuroraBackground>
    );
  }

  if (erro && !artista) {
    return (
      <AuroraBackground>
        <View style={styles.containerCentrado}>
          <Text style={[styles.textoErro, { color: colors.error }]}>Erro ao carregar: {erro}</Text>
          <TouchableOpacity
            style={[styles.botaoTentar, { backgroundColor: colors.button }]}
            onPress={() => {
              carregarArtista();
              carregarObras(0, false);
            }}
          >
            <Text style={[styles.textoButton, { color: colors.buttonText }]}>Tentar novamente</Text>
          </TouchableOpacity>
        </View>
      </AuroraBackground>
    );
  }

  // Renderiza uma obra na lista, em cartão de vidro
  const renderObra = (obra: Work): React.JSX.Element => (
    <TouchableOpacity
      style={[
        styles.cardObra,
        { backgroundColor: colors.glassCard, borderColor: colors.glassBorder },
      ]}
      onPress={() => handleSelecionarObra(obra)}
      activeOpacity={0.7}
    >
      <View style={styles.conteudoCard}>
        <Text style={[styles.tituloObra, { color: colors.text }]} numberOfLines={2}>
          {obra.title}
        </Text>
        <Text style={[styles.anoObra, { color: colors.textSecondary }]}>
          {obra.original_release_year || 'Ano desconhecido'}
        </Text>
      </View>
      <Text style={[styles.seta, { color: colors.primary }]}>→</Text>
    </TouchableOpacity>
  );

  // Renderiza cabeçalho do artista em cartão de vidro
  const renderCabecalho = (): React.JSX.Element => (
    <GlassCard style={styles.secaoCabecalho}>
      <Text style={[styles.nomeArtista, { color: colors.text }]}>{artista?.name || 'Artista'}</Text>
      {artista?.country && (
        <Text style={[styles.paisArtista, { color: colors.textSecondary }]}>🌍 {artista.country}</Text>
      )}
      <Text style={[styles.totalObras, { color: colors.primary }]}>
        {obras.length} obra{obras.length !== 1 ? 's' : ''} encontrada{obras.length !== 1 ? 's' : ''}
      </Text>
    </GlassCard>
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
      <GlassCard forte style={styles.headerBox}>
        <TouchableOpacity
          style={styles.botaoVoltar}
          onPress={() => navigation.goBack()}
        >
          <Text style={[styles.textoVoltar, { color: colors.primary }]}>← Voltar</Text>
        </TouchableOpacity>
        <Text style={[styles.tituloHeader, { color: colors.text }]}>Artista</Text>
      </GlassCard>

      {/* Conteúdo */}
      <ScrollView
        style={styles.conteudo}
        refreshControl={
          <RefreshControl
            refreshing={atualizando}
            onRefresh={handleAtualizacao}
            tintColor={colors.primary}
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
            <Text style={[styles.textoSemDados, { color: colors.textSecondary }]}>Nenhuma obra encontrada</Text>
          </View>
        )}

        {renderRodape()}

        {/* Espaço extra no final */}
        <View style={{ height: 20 }} />
      </ScrollView>
    </AuroraBackground>
  );
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

  nomeArtista: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 8,
  },

  paisArtista: {
    fontSize: 14,
    marginBottom: 12,
  },

  totalObras: {
    fontSize: 14,
    fontWeight: '600',
  },

  cardObra: {
    borderRadius: 16,
    marginBottom: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
  },

  conteudoCard: {
    flex: 1,
  },

  tituloObra: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 4,
  },

  anoObra: {
    fontSize: 13,
  },

  seta: {
    fontSize: 16,
    fontWeight: 'bold',
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
    fontSize: 16,
    marginBottom: 16,
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
    borderWidth: 1,
  },

  textoCarregarMais: {
    fontWeight: 'bold',
    fontSize: 14,
  },
});
