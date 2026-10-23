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
import { traduzirTipoRelease } from '../utils/tiposRelease';

interface Props {
  release: Release;
  onPress: (release: Release) => void;
}

// Cores de destaque por categoria de tipo de versão, resolvidas a partir
// dos tokens do tema ativo (nada de cores fixas em hexadecimal).
function corDaCategoria(
  cores: ReturnType<typeof useTheme>['colors'],
  categoria?: string
): string {
  switch (categoria) {
    case 'release_format':
      return cores.success;          // formato de lançamento — verde
    case 'mix_edit':
      return cores.auroraSecundaria; // edições e mixes — ciano
    case 'instrumental':
      return cores.auroraPrimaria;   // instrumentais — violeta
    case 'playback':
      return cores.warning;          // playback — âmbar
    default:
      return cores.textSecondary;    // categoria desconhecida
  }
}

// Traduz o tipo de versão para exibição em português.
// Tipos desconhecidos são exibidos exatamente como vieram da fonte.
function ReleaseCardComponent({ release, onPress }: Props): React.JSX.Element {
  const { colors } = useTheme();
  const corCategoria = corDaCategoria(colors, release.release_type_category);
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
            {/* Badge de tipo de versão (release), traduzido para exibição */}
            <View style={[styles.badge, { backgroundColor: corCategoria }]}>
              <Text style={[styles.badgeTexto, { color: colors.buttonText }]} numberOfLines={1}>
                {traduzirTipoRelease(release.release_type)}
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
    borderRadius: 16,
    marginHorizontal: 20,
    marginVertical: 8,
    overflow: 'hidden',
    // Contorno e sombra de vidro: a borda e a cor da sombra vêm do
    // AnimatedCard, que resolve os tokens do tema ativo.
    borderWidth: 1,
    ...Platform.select({
      ios: {
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.25,
        shadowRadius: 12,
      },
      android: {
        elevation: 5,
      },
    }),
  },
  cardBody: {
    flexDirection: 'row',
  },
  capaContainer: {
    width: 104,
    height: 104,
  },
  capa: {
    width: 104,
    height: 104,
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
    marginTop: 6,
  },
  info: {
    flex: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    justifyContent: 'space-between',
    // Respiro mínimo entre as linhas de informação, mesmo quando o
    // conteúdo é curto e o space-between distribui o restante.
    gap: 4,
  },
  artista: {
    fontSize: 12,
  },
  versao: {
    fontSize: 15,
    fontWeight: '700',
    lineHeight: 19,
  },
  album: {
    fontSize: 11,
  },
  metadados: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 2,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    maxWidth: 130,
  },
  badgeTexto: {
    fontSize: 10,
    fontWeight: '600',
    // A cor do texto do badge vem do tema (colors.buttonText) em linha
  },
  metaTexto: {
    fontSize: 11,
  },
  rodape: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
    marginTop: 2,
  },
  gravadora: {
    fontSize: 10,
    flex: 1,
  },
  fonte: {
    fontSize: 9,
  },
});
