// Componente CardArtista — exibe um artista com país e contador de obras.

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';

import { Artista } from '../types';

interface Props {
  artista: Artista;
  numeroObras?: number;
  onPress: (artista: Artista) => void;
}

export default function CardArtista({
  artista,
  numeroObras = 0,
  onPress,
}: Props): React.JSX.Element {
  return (
    <TouchableOpacity
      style={styles.card}
      onPress={() => onPress(artista)}
      activeOpacity={0.7}
    >
      {/* Avatar / Ícone */}
      <View style={styles.avatar}>
        <Text style={styles.textoAvatar}>
          {artista.name.charAt(0).toUpperCase()}
        </Text>
      </View>

      {/* Conteúdo */}
      <View style={styles.conteudo}>
        {/* Nome do artista */}
        <Text style={styles.nomeArtista} numberOfLines={1}>
          {artista.name}
        </Text>

        {/* País */}
        {artista.country && (
          <Text style={styles.paisArtista}>
            🌍 {artista.country}
          </Text>
        )}

        {/* Número de obras */}
        <Text style={styles.numeroObras}>
          {numeroObras} obra{numeroObras !== 1 ? 's' : ''}
        </Text>
      </View>

      {/* Seta */}
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

  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FF6B35',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },

  textoAvatar: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: 'bold',
  },

  conteudo: {
    flex: 1,
  },

  nomeArtista: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 4,
  },

  paisArtista: {
    color: '#AAAAAA',
    fontSize: 12,
    marginBottom: 4,
  },

  numeroObras: {
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
});
