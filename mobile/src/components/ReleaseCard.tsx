// Componente de card para exibir uma versão (release) de uma música.
// Respeita a Regra 1: só exibe capa quando cover_url não for null.
// Exibe placeholder "Sem Capa" quando não há capa oficial disponível.
// Usa animações e tema dinâmico.
// Otimizado com memoização para evitar re-renders.

import React, { useState, memo, useCallback } from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  Platform,
} from 'react-native';
import { Release } from '../types';
import MusicPlayer from './MusicPlayer';
import { useTheme } from '../contexts/ThemeContext';
import { MusicEmojis } from './AnimatedIcon';
import AnimatedCard from './AnimatedCard';

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

function ReleaseCardComponent({ release, onPress }: Props): React.JSX.Element {
  const { colors } = useTheme();
  const corCategoria = CORES_CATEGORIA[release.release_type_category] ?? '#888';
  const [showPlayer, setShowPlayer] = useState(false);

  const handlePress = useCallback(() => {
    if (!showPlayer) {
      setShowPlayer(true);
    } else {
      onPress(release);
    }
  }, [showPlayer, onPress, release]);

  return (
    <AnimatedCard
      style={styles.container}
      animationType="slideUp"
      delay={0}
    >
      <TouchableOpacity
        style={styles.cardBody}
        onPress={handlePress}
        activeOpacity={0.92}
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
            <View style={[styles.capa, styles.semCapa, { backgroundColor: colors.border }]}>
              <Text style={[styles.semCapaIcone, { color: colors.textSecondary }]}>
                {MusicEmojis.quality}
              </Text>
              <Text style={[styles.semCapaTexto, { color: colors.textSecondary }]}>
                Sem Capa
              </Text>
            </View>
          )}
        </View>

        {/* Informações do release */}
        <View style={styles.info}>
          {/* Artista */}
          <Text style={[styles.artista, { color: colors.textSecondary }]} numberOfLines={1}>
            {release.artist_name}
          </Text>

          {/* Nome da versão */}
          <Text style={[styles.versao, { color: colors.text }]} numberOfLines={2}>
            {release.version_name}
          </Text>

          {/* Álbum (quando disponível) */}
          {release.album_name && (
            <Text style={[styles.album, { color: colors.textSecondary }]} numberOfLines={1}>
              {MusicEmojis.album} {release.album_name}
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
              <Text style={[styles.metaTexto, { color: colors.textSecondary }]}>
                {MusicEmojis.year} {release.release_year}
              </Text>
            )}

            {/* País */}
            {release.country && (
              <Text style={[styles.metaTexto, { color: colors.textSecondary }]}>
                {MusicEmojis.country} {release.country}
              </Text>
            )}

            {/* Qualidade */}
            {release.quality && (
              <Text style={[styles.metaTexto, { color: colors.textSecondary }]}>
                {MusicEmojis.flac} {release.quality}
              </Text>
            )}
          </View>

          {/* Gravadora e fonte */}
          <View style={styles.rodape}>
            {release.label && (
              <Text style={[styles.gravadora, { color: colors.textSecondary }]} numberOfLines={1}>
                {release.label}
              </Text>
            )}
            <Text style={[styles.fonte, { color: colors.textSecondary }]}>
              {release.metadata_source}
            </Text>
          </View>
        </View>
      </TouchableOpacity>

      {/* MusicPlayer - aparece quando expandido */}
      {showPlayer && (
        <MusicPlayer release={release} />
      )}
    </AnimatedCard>
  );
}

// Memoizar o componente para evitar re-renders desnecessários
export default memo(ReleaseCardComponent, (prevProps, nextProps) => {
  return (
    prevProps.release.id === nextProps.release.id &&
    prevProps.release.cover_url === nextProps.release.cover_url &&
    prevProps.release.version_name === nextProps.release.version_name &&
    prevProps.release.artist_name === nextProps.release.artist_name
  );
});

const styles = StyleSheet.create({
  container: {
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
  cardBody: {
    flexDirection: 'row',
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
    alignItems: 'center',
    justifyContent: 'center',
  },
  semCapaIcone: {
    fontSize: 28,
  },
  semCapaTexto: {
    fontSize: 10,
    marginTop: 4,
  },
  info: {
    flex: 1,
    padding: 10,
    justifyContent: 'space-between',
  },
  artista: {
    fontSize: 12,
    marginBottom: 2,
  },
  versao: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 4,
  },
  album: {
    fontSize: 11,
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
  },
  rodape: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  gravadora: {
    fontSize: 10,
    flex: 1,
  },
  fonte: {
    fontSize: 9,
  },
});
