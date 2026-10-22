// Tela de Biblioteca — estatísticas, favoritos e histórico de buscas.
// Usa contextos de Favoritos e Histórico para exibir dados persistidos localmente.
// Segue a identidade visual de vidro fosco: fundo com luzes suaves e cartões translúcidos.

import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  FlatList,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';

import { RootStackParamList, Release } from '../types';
import { useFavoritos } from '../contexts/FavoritosContext';
import { useHistorico } from '../contexts/HistoricoContext';
import { useTheme } from '../contexts/ThemeContext';
import { useModal } from '../contexts/ModalContext';
import AuroraBackground from '../components/AuroraBackground';
import GlassCard from '../components/GlassCard';

type Props = NativeStackScreenProps<RootStackParamList, 'Biblioteca'>;

type AbaAtiva = 'estatisticas' | 'favoritos' | 'historico';

export default function TelaBiblioteca({ navigation }: Props): React.JSX.Element {
  const { favoritos, removerFavorito } = useFavoritos();
  const { historico, limparHistorico } = useHistorico();
  const { colors } = useTheme();
  const { abrirConfirmacao } = useModal();
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

  // Navega para detalhes da versão
  const handleSelecionarRelease = (release: Release): void => {
    navigation.push('DetalheRelease', { release });
  };

  // Remove favorito com confirmação no modal global
  const handleRemoverFavorito = (releaseId: number): void => {
    abrirConfirmacao(
      'Remover dos favoritos?',
      'Deseja remover esta versão dos favoritos?',
      () => removerFavorito(releaseId)
    );
  };

  // Limpa histórico com confirmação no modal global
  const handleLimparHistorico = (): void => {
    abrirConfirmacao(
      'Limpar histórico?',
      'Deseja limpar todo o histórico de buscas?',
      () => limparHistorico()
    );
  };

  // Renderiza card de estatística
  const renderStatCard = (label: string, valor: number | string): React.JSX.Element => (
    <GlassCard style={[styles.cardStat, { borderLeftColor: colors.primary }]}>
      <Text style={[styles.valorStat, { color: colors.primary }]}>{valor}</Text>
      <Text style={[styles.labelStat, { color: colors.textSecondary }]}>{label}</Text>
    </GlassCard>
  );

  // Renderiza aba de estatísticas
  const renderEstatisticas = (): React.JSX.Element => (
    <View style={styles.conteudoAba}>
      <Text style={[styles.tituloSecao, { color: colors.text }]}>Resumo da Biblioteca</Text>

      <View style={styles.gridStats}>
        {renderStatCard('Favoritos', stats.totalFavoritos)}
        {renderStatCard('Artistas', stats.artistasUnicos)}
        {renderStatCard('Obras', stats.obrasUnicas)}
        {renderStatCard('Tipos', stats.tiposRelease.size)}
      </View>

      {stats.totalFavoritos > 0 && (
        <>
          <Text style={[styles.tituloSecao, { color: colors.text }]}>Tipos de versão favoritos</Text>
          <View style={styles.containerTipos}>
            {Array.from(stats.tiposRelease).map((tipo, idx) => (
              <View key={idx} style={[styles.badgeTipo, { backgroundColor: colors.primary }]}>
                <Text style={[styles.textoTipo, { color: colors.buttonText }]}>{tipo}</Text>
              </View>
            ))}
          </View>
        </>
      )}

      {stats.totalFavoritos === 0 && (
        <View style={styles.containerVazio}>
          <Text style={[styles.textoVazio, { color: colors.textSecondary }]}>
            Você não tem favoritos ainda.{'\n'}Comece adicionando versões!
          </Text>
        </View>
      )}
    </View>
  );

  // Renderiza card de versão favorita
  const renderCardRelease = (release: Release): React.JSX.Element => (
    <GlassCard style={[styles.cardRelease, { borderLeftColor: colors.primary }]}>
      <TouchableOpacity
        style={styles.conteudoCardRelease}
        onPress={() => handleSelecionarRelease(release)}
        activeOpacity={0.7}
      >
        <View style={styles.infoRelease}>
          <Text style={[styles.tituloRelease, { color: colors.text }]} numberOfLines={2}>
            {release.version_name}
          </Text>
          <Text style={[styles.obreaArtista, { color: colors.textSecondary }]} numberOfLines={1}>
            {release.work_title} • {release.artist_name}
          </Text>
          <Text style={[styles.tipoRelease, { color: colors.primary }]}>{release.release_type}</Text>
        </View>
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.botaoRemover, { backgroundColor: colors.accent }]}
        onPress={() => handleRemoverFavorito(release.id)}
      >
        <Text style={[styles.textoRemover, { color: colors.error }]}>✕</Text>
      </TouchableOpacity>
    </GlassCard>
  );

  // Renderiza aba de favoritos
  const renderFavoritos = (): React.JSX.Element => (
    <View style={styles.conteudoAba}>
      <Text style={[styles.tituloSecao, { color: colors.text }]}>
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
          <Text style={[styles.textoVazio, { color: colors.textSecondary }]}>
            Nenhum favorito ainda.{'\n'}Toque no ♡ em uma versão para adicionar!
          </Text>
        </View>
      )}
    </View>
  );

  // Renderiza aba de histórico
  const renderHistorico = (): React.JSX.Element => (
    <View style={styles.conteudoAba}>
      <View style={styles.headerHistorico}>
        <Text style={[styles.tituloSecao, { color: colors.text }]}>
          Histórico de Buscas ({historico.length})
        </Text>
        {historico.length > 0 && (
          <TouchableOpacity
            style={[styles.botaoLimpar, { backgroundColor: colors.button }]}
            onPress={handleLimparHistorico}
          >
            <Text style={[styles.textoLimpar, { color: colors.buttonText }]}>Limpar</Text>
          </TouchableOpacity>
        )}
      </View>

      {historico.length > 0 ? (
        <GlassCard style={styles.listaHistorico}>
          {historico.map((item, idx) => (
            <View
              key={idx}
              style={[styles.itemHistorico, { borderBottomColor: colors.glassBorder }]}
            >
              <Text style={[styles.textoHistorico, { color: colors.text }]}>{item.termo}</Text>
              <Text style={[styles.dataHistorico, { color: colors.textSecondary }]}>
                {formatarData(new Date(item.timestamp))}
              </Text>
            </View>
          ))}
        </GlassCard>
      ) : (
        <View style={styles.containerVazio}>
          <Text style={[styles.textoVazio, { color: colors.textSecondary }]}>
            Histórico vazio.{'\n'}Suas buscas aparecerão aqui.
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
        <Text style={[styles.tituloHeader, { color: colors.text }]}>Biblioteca</Text>
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
            abaAtiva === 'estatisticas' && { borderBottomColor: colors.primary },
          ]}
          onPress={() => setAbaAtiva('estatisticas')}
        >
          <Text
            style={[
              styles.textoAba,
              { color: abaAtiva === 'estatisticas' ? colors.primary : colors.textSecondary },
            ]}
          >
            📊 Estatísticas
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.aba,
            abaAtiva === 'favoritos' && { borderBottomColor: colors.primary },
          ]}
          onPress={() => setAbaAtiva('favoritos')}
        >
          <Text
            style={[
              styles.textoAba,
              { color: abaAtiva === 'favoritos' ? colors.primary : colors.textSecondary },
            ]}
          >
            ♡ Favoritos ({favoritos.length})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.aba,
            abaAtiva === 'historico' && { borderBottomColor: colors.primary },
          ]}
          onPress={() => setAbaAtiva('historico')}
        >
          <Text
            style={[
              styles.textoAba,
              { color: abaAtiva === 'historico' ? colors.primary : colors.textSecondary },
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
    </AuroraBackground>
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
  },

  containerAbas: {
    flexDirection: 'row',
    borderBottomWidth: 1,
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

  textoAba: {
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
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
    marginBottom: 12,
    borderLeftWidth: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },

  valorStat: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 4,
  },

  labelStat: {
    fontSize: 13,
    textAlign: 'center',
  },

  containerTipos: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 20,
  },

  badgeTipo: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginRight: 8,
    marginBottom: 8,
  },

  textoTipo: {
    fontSize: 12,
    fontWeight: 'bold',
  },

  cardRelease: {
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    padding: 0,
    paddingRight: 8,
    borderLeftWidth: 4,
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
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
  },

  obreaArtista: {
    fontSize: 12,
    marginBottom: 4,
  },

  tipoRelease: {
    fontSize: 11,
    fontWeight: 'bold',
  },

  botaoRemover: {
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 16,
  },

  textoRemover: {
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
    borderRadius: 8,
  },

  textoLimpar: {
    fontSize: 12,
    fontWeight: 'bold',
  },

  listaHistorico: {
    padding: 0,
  },

  itemHistorico: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },

  textoHistorico: {
    fontSize: 14,
    fontWeight: '500',
  },

  dataHistorico: {
    fontSize: 12,
  },

  containerVazio: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 48,
  },

  textoVazio: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
});
