// Componente de card para exibir uma versão (release) de uma música.
// Respeita a Regra 1: só exibe capa quando cover_url não for null.
// Exibe placeholder "Sem Capa" quando não há capa oficial disponível.

import React from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  Platform,
} from 'react-native';
import { Release } from '../types';

interface Props {
  release: Release;
  onPress: (release: Release) => void;
}

// Mapeamento de cores por categoria de tipo de release
const CORES_CATEGORIA: Record<string, string> = {
  release_format: '#1DB954',
  mix_edit:       '#1E90FF',
  instrumental:   '#9B59B6',
  playback:       '#E67E22',
};

export default function ReleaseCard({ release, onPress }: Props): React.JSX.Element {
  const corCategoria = CORES_CATEGORIA[release.release_type_category] ?? '#888';

  return (
    <TouchableOpacity
      style={styles.container}
      onPress={() => onPress(release)}
      activeOpacity={0.75}
      accessibilityRole="button"
      accessibilityLabel={`${release.artist_name} - ${release.version_name}, ${release.release_type}`}
    >
      {/* Capa da música — Regra 1: só exibe se cover_url não for null */}
      <View style={styles.capaContainer}>
        {release.cover_url ? (
          <Image
            source={{ uri: release.cover_url }}
            style={styles.capa}
            resizeMode="cover"
            accessibilityLabel={`Capa de ${release.version_name}`}
          />
        ) : (
          // Placeholder quando não há capa oficial disponível
          <View style={[styles.capa, styles.semCapa]}>
            <Text style={styles.semCapaIcone}>♪</Text>
            <Text style={styles.semCapaTexto}>Sem Capa</Text>
          </View>
        )}
      </View>

      {/* Informações do release */}
      <View style={styles.info}>
        {/* Artista */}
        <Text style={styles.artista} numberOfLines={1}>
          {release.artist_name}
        </Text>

        {/* Nome da versão */}
        <Text style={styles.versao} numberOfLines={2}>
          {release.version_name}
        </Text>

        {/* Álbum (quando disponível) */}
        {release.album_name && (
          <Text style={styles.album} numberOfLines={1}>
            📀 {release.album_name}
          </Text>
        )}

        {/* Linha de metadados: tipo, ano, país */}
        <View style={styles.metadados}>
          {/* Badge de tipo de release */}
          <View style={[styles.badge, { backgroundColor: corCategoria }]}>
            <Text style={styles.badgeTexto} numberOfLines={1}>
              {release.release_type}
            </Text>
          </View>

          {/* Ano de lançamento */}
          {release.release_year && (
            <Text style={styles.metaTexto}>{release.release_year}</Text>
          )}

          {/* País */}
          {release.country && (
            <Text style={styles.metaTexto}>{release.country}</Text>
          )}

          {/* Qualidade */}
          {release.quality && (
            <Text style={styles.metaTexto}>{release.quality}</Text>
          )}
        </View>

        {/* Gravadora e fonte */}
        <View style={styles.rodape}>
          {release.label && (
            <Text style={styles.gravadora} numberOfLines={1}>
              {release.label}
            </Text>
          )}
          <Text style={styles.fonte}>{release.metadata_source}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: '#1A1A2E',
    borderRadius: 12,
    marginHorizontal: 16,
    marginVertical: 6,
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 4,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  capaContainer: {
    width: 100,
    height: 100,
  },
  capa: {
    width: 100,
    height: 100,
  },
  semCapa: {
    backgroundColor: '#2C2C54',
    alignItems: 'center',
    justifyContent: 'center',
  },
  semCapaIcone: {
    fontSize: 28,
    color: '#555580',
  },
  semCapaTexto: {
    fontSize: 10,
    color: '#555580',
    marginTop: 4,
  },
  info: {
    flex: 1,
    padding: 10,
    justifyContent: 'space-between',
  },
  artista: {
    fontSize: 12,
    color: '#A0A0C0',
    marginBottom: 2,
  },
  versao: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  album: {
    fontSize: 11,
    color: '#8080A0',
    marginBottom: 4,
  },
  metadados: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 4,
    marginBottom: 4,
  },
  badge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    maxWidth: 130,
  },
  badgeTexto: {
    fontSize: 10,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  metaTexto: {
    fontSize: 11,
    color: '#A0A0C0',
  },
  rodape: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  gravadora: {
    fontSize: 10,
    color: '#707090',
    flex: 1,
  },
  fonte: {
    fontSize: 9,
    color: '#505070',
  },
});
