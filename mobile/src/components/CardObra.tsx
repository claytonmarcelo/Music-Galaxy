// Componente CardObra — exibe uma obra musical com artista, capa e estatísticas.
// Visual de vidro fosco: fundo translúcido, contorno sutil e sombra suave,
// com as cores sempre resolvidas pelos tokens do tema ativo.

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
} from 'react-native';

import { Work } from '../types';
import { useTheme } from '../contexts/ThemeContext';

interface Props {
  obra: Work;
  onPress: (obra: Work) => void;
  mostraEstatisticas?: boolean;
}

export default function CardObra({
  obra,
  onPress,
  mostraEstatisticas = false,
}: Props): React.JSX.Element {
  const { colors } = useTheme();

  return (
    <TouchableOpacity
      style={[
        styles.card,
        {
          // Vidro fosco: fundo translúcido, contorno e sombra vindos do tema
          backgroundColor: colors.glassCard,
          borderColor: colors.glassBorder,
          borderLeftColor: colors.primary,
          shadowColor: colors.glassShadow,
        },
      ]}
      onPress={() => onPress(obra)}
      activeOpacity={0.7}
    >
      {/* Conteúdo principal */}
      <View style={styles.conteudo}>
        {/* Título da obra */}
        <Text style={[styles.tituloObra, { color: colors.text }]} numberOfLines={2}>
          {obra.title}
        </Text>

        {/* Artista */}
        <Text style={[styles.nomeArtista, { color: colors.primary }]} numberOfLines={1}>
          {obra.artist.name}
        </Text>

        {/* País do artista (se disponível) */}
        {obra.artist.country && (
          <Text style={[styles.paisArtista, { color: colors.textSecondary }]}>
            🌍 {obra.artist.country}
          </Text>
        )}

        {/* Ano de lançamento original */}
        <Text style={[styles.anoLancamento, { color: colors.textSecondary }]}>
          {obra.original_release_year || 'Ano desconhecido'}
        </Text>

        {/* Estatísticas (opcional) */}
        {mostraEstatisticas && (
          <View style={[styles.containerEstatisticas, { borderTopColor: colors.border }]}>
            <View style={styles.itemEstat}>
              <Text style={[styles.labelEstat, { color: colors.textSecondary }]}>Obras</Text>
              <Text style={[styles.valorEstat, { color: colors.primary }]}>1</Text>
            </View>
          </View>
        )}
      </View>

      {/* Seta indicadora */}
      <Text style={[styles.seta, { color: colors.primary }]}>→</Text>
    </TouchableOpacity>
  );
}

// ============================================================
// Estilos
// ============================================================

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    marginBottom: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderLeftWidth: 4,
    // Sombra suave de vidro (a cor vem do tema, aplicada em linha)
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 5,
  },

  conteudo: {
    flex: 1,
  },

  tituloObra: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 4,
  },

  nomeArtista: {
    fontSize: 13,
    fontWeight: '500',
    marginBottom: 2,
  },

  paisArtista: {
    fontSize: 12,
    marginBottom: 4,
  },

  anoLancamento: {
    fontSize: 12,
    fontWeight: '500',
  },

  containerEstatisticas: {
    flexDirection: 'row',
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
  },

  itemEstat: {
    marginRight: 16,
  },

  labelEstat: {
    fontSize: 11,
    marginBottom: 2,
  },

  valorEstat: {
    fontSize: 14,
    fontWeight: 'bold',
  },

  seta: {
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 12,
  },
});
