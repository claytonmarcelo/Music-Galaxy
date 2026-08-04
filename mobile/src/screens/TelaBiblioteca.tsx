// Tela de Biblioteca — estatísticas, favoritos e histórico de buscas.
// Usa contextos de Favoritos e Histórico para exibir dados persistidos localmente.

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';

import { RootStackParamList, Release } from '../types';
import { useFavoritos } from '../contexts/FavoritosContext';
import { useHistorico } from '../contexts/HistoricoContext';

type Props = NativeStackScreenProps<RootStackParamList, 'Biblioteca'>;

type AbaAtiva = 'estatisticas' | 'favoritos' | 'historico';

export default function TelaBiblioteca({ navigation }: Props): React.JSX.Element {
  const { favoritos, removerFavorito } = useFavoritos();
  const { historico, limparHistorico } = useHistorico();
  const [abaAtiva, setAbaAtiva] = useState<AbaAtiva>('estatisticas');

  // Calcula estatísticas dos favoritos
  const calcularEstatisticas = () => {
    if (favoritos.length === 0) {
      return {
        totalFavoritos: 0,
        artistasUnicos: 0,
        obrasUnicas: 0,
        tiposRelease: new Set<string>(),
      };
    }

    const artistasUnicos = new Set(favoritos.map(f => f.artist_name));
    const obrasUnicas = new Set(favoritos.map(f => f.work_title));
    const tiposRelease = new Set(favoritos.map(f => f.release_type));

    return {
      totalFavoritos: favoritos.length,
      artistasUnicos: artistasUnicos.size,
      obrasUnicas: obrasUnicas.size,
      tiposRelease,
    };
  };

  const stats = calcularEstatisticas();

  // Navega para detalhes do release
  const handleSelecionarRelease = (release: Release): void => {
    navigation.push('DetalheRelease', { release });
  };

  // Remove favorito com confirmação
  const handleRemoverFavorito = (releaseId: number): void => {
    Alert.alert(
      'Remover Favorito',
      'Tem certeza que deseja remover este release dos favoritos?',
      [
        { text: 'Cancelar', onPress: () => {}, style: 'cancel' },
        {
          text: 'Remover',
          onPress: () => removerFavorito(releaseId),
          style: 'destructive',
        },
      ]
    );
  };

  // Limpa histórico com confirmação
  const handleLimparHistorico = (): void => {
    Alert.alert(
      'Limpar Histórico',
      'Tem certeza que deseja limpar todo o histórico de buscas?',
      [
        { text: 'Cancelar', onPress: () => {}, style: 'cancel' },
        {
          text: 'Limpar',
          onPress: () => limparHistorico(),
          style: 'destructive',
        },
      ]
    );
  };

  // Renderiza card de estatística
  const renderStatCard = (label: string, valor: number | string): React.JSX.Element => (
    <View style={styles.cardStat}>
      <Text style={styles.valorStat}>{valor}</Text>
      <Text style={styles.labelStat}>{label}</Text>
    </View>
  );

  // Renderiza aba de estatísticas
  const renderEstatisticas = (): React.JSX.Element => (
    <View style={styles.conteudoAba}>
      <Text style={styles.tituloSecao}>Resumo da Biblioteca</Text>

      <View style={styles.gridStats}>
        {renderStatCard('Favoritos', stats.totalFavoritos)}
        {renderStatCard('Artistas', stats.artistasUnicos)}
        {renderStatCard('Obras', stats.obrasUnicas)}
        {renderStatCard('Tipos', stats.tiposRelease.size)}
      </View>

      {stats.totalFavoritos > 0 && (
        <>
          <Text style={styles.tituloSecao}>Tipos de Release Favoritos</Text>
          <View style={styles.containerTipos}>
            {Array.from(stats.tiposRelease).map((tipo, idx) => (
              <View key={idx} style={styles.badgeTipo}>
                <Text style={styles.textoTipo}>{tipo}</Text>
              </View>
            ))}
          </View>
        </>
      )}

      {stats.totalFavoritos === 0 && (
        <View style={styles.containerVazio}>
          <Text style={styles.textoVazio}>
            Você não tem favoritos ainda.{'\n'}Comece adicionando releases!
          </Text>
        </View>
      )}
    </View>
  );

  // Renderiza card de release
  const renderCardRelease = (release: Release): React.JSX.Element => (
    <View style={styles.cardRelease}>
      <TouchableOpacity
        style={styles.conteudoCardRelease}
        onPress={() => handleSelecionarRelease(release)}
        activeOpacity={0.7}
      >
        <View style={styles.infoRelease}>
          <Text style={styles.tituloRelease} numberOfLines={2}>
            {release.version_name}
          </Text>
          <Text style={styles.obreaArtista} numberOfLines={1}>
            {release.work_title} • {release.artist_name}
          </Text>
          <Text style={styles.tipoRelease}>{release.release_type}</Text>
        </View>
      </TouchableOpacity>
      <TouchableOpacity
        style={styles.botaoRemover}
        onPress={() => handleRemoverFavorito(release.id)}
      >
        <Text style={styles.textoRemover}>✕</Text>
      </TouchableOpacity>
    </View>
  );

  // Renderiza aba de favoritos
  const renderFavoritos = (): React.JSX.Element => (
    <View style={styles.conteudoAba}>
      <Text style={styles.tituloSecao}>
        Favoritos ({favoritos.length})
      </Text>

      {favoritos.length > 0 ? (
        <FlatList
          scrollEnabled={false}
          data={favoritos}
          keyExtractor={rel => `fav-${rel.id}`}
          renderItem={({ item }) => renderCardRelease(item)}
        />
      ) : (
        <View style={styles.containerVazio}>
          <Text style={styles.textoVazio}>
            Nenhum favorito ainda.{'\n'}Toque no ♡ em um release para adicionar!
          </Text>
        </View>
      )}
    </View>
  );

  // Renderiza aba de histórico
  const renderHistorico = (): React.JSX.Element => (
    <View style={styles.conteudoAba}>
      <View style={styles.headerHistorico}>
        <Text style={styles.tituloSecao}>
          Histórico de Buscas ({historico.length})
        </Text>
        {historico.length > 0 && (
          <TouchableOpacity
            style={styles.botaoLimpar}
            onPress={handleLimparHistorico}
          >
            <Text style={styles.textoLimpar}>Limpar</Text>
          </TouchableOpacity>
        )}
      </View>

      {historico.length > 0 ? (
        <View style={styles.listaHistorico}>
          {historico.map((item, idx) => (
            <View key={idx} style={styles.itemHistorico}>
              <Text style={styles.textoHistorico}>{item.termo}</Text>
              <Text style={styles.dataHistorico}>
                {formatarData(new Date(item.timestamp))}
              </Text>
            </View>
          ))}
        </View>
      ) : (
        <View style={styles.containerVazio}>
          <Text style={styles.textoVazio}>
            Histórico vazio.{'\n'}Suas buscas aparecerão aqui.
          </Text>
        </View>
      )}
    </View>
  );

  return (
    <View style={styles.container}>
      {/* Cabeçalho */}
      <View style={styles.headerBox}>
        <Text style={styles.tituloHeader}>Biblioteca</Text>
      </View>

      {/* Abas */}
      <View style={styles.containerAbas}>
        <TouchableOpacity
          style={[styles.aba, abaAtiva === 'estatisticas' && styles.abaAtiva]}
          onPress={() => setAbaAtiva('estatisticas')}
        >
          <Text
            style={[
              styles.textoAba,
              abaAtiva === 'estatisticas' && styles.textoAbaAtiva,
            ]}
          >
            📊 Estatísticas
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.aba, abaAtiva === 'favoritos' && styles.abaAtiva]}
          onPress={() => setAbaAtiva('favoritos')}
        >
          <Text
            style={[
              styles.textoAba,
              abaAtiva === 'favoritos' && styles.textoAbaAtiva,
            ]}
          >
            ♡ Favoritos ({favoritos.length})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.aba, abaAtiva === 'historico' && styles.abaAtiva]}
          onPress={() => setAbaAtiva('historico')}
        >
          <Text
            style={[
              styles.textoAba,
              abaAtiva === 'historico' && styles.textoAbaAtiva,
            ]}
          >
            🕐 Histórico
          </Text>
        </TouchableOpacity>
      </View>

      {/* Conteúdo */}
      <ScrollView style={styles.conteudo}>
        {abaAtiva === 'estatisticas' && renderEstatisticas()}
        {abaAtiva === 'favoritos' && renderFavoritos()}
        {abaAtiva === 'historico' && renderHistorico()}
      </ScrollView>
    </View>
  );
}

// ============================================================
// Funções Auxiliares
// ============================================================

function formatarData(data: Date): string {
  const agora = new Date();
  const diferenca = agora.getTime() - data.getTime();
  const minutos = Math.floor(diferenca / 60000);
  const horas = Math.floor(diferenca / 3600000);
  const dias = Math.floor(diferenca / 86400000);

  if (minutos < 1) return 'Agora';
  if (minutos < 60) return `${minutos}m atrás`;
  if (horas < 24) return `${horas}h atrás`;
  if (dias < 7) return `${dias}d atrás`;

  return data.toLocaleDateString('pt-BR');
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
    paddingHorizontal: 8,
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
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
  },

  textoAbaAtiva: {
    color: '#FF6B35',
  },

  conteudo: {
    flex: 1,
    paddingHorizontal: 12,
    paddingTop: 16,
  },

  conteudoAba: {
    paddingBottom: 20,
  },

  tituloSecao: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 16,
  },

  gridStats: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 20,
  },

  cardStat: {
    width: '48%',
    backgroundColor: '#1A1A2E',
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#FF6B35',
    justifyContent: 'center',
    alignItems: 'center',
  },

  valorStat: {
    color: '#FF6B35',
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 4,
  },

  labelStat: {
    color: '#AAAAAA',
    fontSize: 13,
    textAlign: 'center',
  },

  containerTipos: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 20,
  },

  badgeTipo: {
    backgroundColor: '#FF6B35',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginRight: 8,
    marginBottom: 8,
  },

  textoTipo: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: 'bold',
  },

  cardRelease: {
    backgroundColor: '#1A1A2E',
    borderRadius: 8,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    paddingRight: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#FF6B35',
  },

  conteudoCardRelease: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },

  infoRelease: {
    flex: 1,
  },

  tituloRelease: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
  },

  obreaArtista: {
    color: '#AAAAAA',
    fontSize: 12,
    marginBottom: 4,
  },

  tipoRelease: {
    color: '#FF6B35',
    fontSize: 11,
    fontWeight: 'bold',
  },

  botaoRemover: {
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FF6B3520',
    borderRadius: 16,
  },

  textoRemover: {
    color: '#FF6B35',
    fontSize: 16,
    fontWeight: 'bold',
  },

  headerHistorico: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },

  botaoLimpar: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#FF6B35',
    borderRadius: 4,
  },

  textoLimpar: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: 'bold',
  },

  listaHistorico: {
    backgroundColor: '#1A1A2E',
    borderRadius: 8,
    overflow: 'hidden',
  },

  itemHistorico: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#2E2E4E',
  },

  textoHistorico: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '500',
  },

  dataHistorico: {
    color: '#AAAAAA',
    fontSize: 12,
  },

  containerVazio: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 48,
  },

  textoVazio: {
    color: '#AAAAAA',
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
});
