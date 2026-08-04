// Componente CardObra — exibe uma obra musical com artista, capa e estatísticas.

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
} from 'react-native';

import { Work } from '../types';

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
  return (
    <TouchableOpacity
      style={styles.card}
      onPress={() => onPress(obra)}
      activeOpacity={0.7}
    >
      {/* Conteúdo principal */}
      <View style={styles.conteudo}>
        {/* Título da obra */}
        <Text style={styles.tituloObra} numberOfLines={2}>
          {obra.title}
        </Text>

        {/* Artista */}
        <Text style={styles.nomeArtista} numberOfLines={1}>
          {obra.artist.name}
        </Text>

        {/* País do artista (se disponível) */}
        {obra.artist.country && (
          <Text style={styles.paisArtista}>
            🌍 {obra.artist.country}
          </Text>
        )}

        {/* Ano de lançamento original */}
        <Text style={styles.anoLancamento}>
          {obra.original_release_year || 'Ano desconhecido'}
        </Text>

        {/* Estatísticas (opcional) */}
        {mostraEstatisticas && (
          <View style={styles.containerEstatisticas}>
            <View style={styles.itemEstat}>
              <Text style={styles.labelEstat}>Obras</Text>
              <Text style={styles.valorEstat}>1</Text>
            </View>
          </View>
        )}
      </View>

      {/* Seta indicadora */}
      <Text style={styles.seta}>→</Text>
    </TouchableOpacity>
  );
}

// ============================================================
// Estilos
// ============================================================

const styles = StyleSheet.create({
  card: {
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

  conteudo: {
    flex: 1,
  },

  tituloObra: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 4,
  },

  nomeArtista: {
    color: '#FF6B35',
    fontSize: 13,
    fontWeight: '500',
    marginBottom: 2,
  },

  paisArtista: {
    color: '#AAAAAA',
    fontSize: 12,
    marginBottom: 4,
  },

  anoLancamento: {
    color: '#AAAAAA',
    fontSize: 12,
    fontWeight: '500',
  },

  containerEstatisticas: {
    flexDirection: 'row',
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#2E2E4E',
  },

  itemEstat: {
    marginRight: 16,
  },

  labelEstat: {
    color: '#AAAAAA',
    fontSize: 11,
    marginBottom: 2,
  },

  valorEstat: {
    color: '#FF6B35',
    fontSize: 14,
    fontWeight: 'bold',
  },

  seta: {
    color: '#FF6B35',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 12,
  },
});
