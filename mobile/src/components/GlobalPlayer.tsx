// Player Global Visível.
// Exibe a mídia real associada à release selecionada pelo usuário.

import React, { useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Image,
  Animated,
  Platform,
} from 'react-native';
import { usePlayer } from '../contexts/PlayerContext';
import { useTheme } from '../contexts/ThemeContext';
import { MusicEmojis } from './AnimatedIcon';
import { formatTime } from '../utils/helpers';

export default function GlobalPlayer(): React.JSX.Element | null {
  const { playerState, play, pause, resume, next, previous } = usePlayer();
  const { colors } = useTheme();
  const slideAnim = React.useRef(new Animated.Value(100)).current;

  // Animação de entrada quando tem música tocando
  useEffect(() => {
    if (playerState.currentRelease) {
      Animated.spring(slideAnim, {
        toValue: 0,
        useNativeDriver: false,
        damping: 20,
        stiffness: 100,
      }).start();
    } else {
      Animated.spring(slideAnim, {
        toValue: 100,
        useNativeDriver: false,
      }).start();
    }
  }, [playerState.currentRelease]);

  if (!playerState.currentRelease) {
    return null;
  }

  const currentReleaseWithUrl = {
    ...playerState.currentRelease,
    streaming_url: playerState.currentRelease.streaming_url ?? playerState.currentRelease.audio_preview_url ?? null,
  };

  const handlePlayPause = () => {
    if (playerState.isPlaying) {
      pause();
    } else {
      resume();
    }
  };

  const progress = playerState.duration > 0 
    ? (playerState.position / playerState.duration) * 100 
    : 0;

  return (
    <Animated.View
      style={[
        styles.container,
        {
          backgroundColor: colors.card,
          borderTopColor: colors.border,
          transform: [{ translateY: slideAnim }],
        },
      ]}
    >
      {/* Informações da música */}
      <View style={styles.infoContainer}>
        {/* Capa */}
        {currentReleaseWithUrl.cover_url ? (
          <Image
            source={{ uri: currentReleaseWithUrl.cover_url }}
            style={styles.cover}
          />
        ) : (
          <View style={[styles.cover, styles.noCover]}>
            <Text style={styles.noCoverText}>{MusicEmojis.quality}</Text>
          </View>
        )}

        {/* Título e Artista */}
        <View style={styles.textContainer}>
          <Text style={[styles.title, { color: colors.text }]} numberOfLines={1}>
            {currentReleaseWithUrl.work_title}
          </Text>
          <Text style={[styles.artist, { color: colors.textSecondary }]} numberOfLines={1}>
            {currentReleaseWithUrl.artist_name}
          </Text>
        </View>

        {/* Controles */}
        <View style={styles.controls}>
          <TouchableOpacity onPress={previous} style={styles.controlButton}>
            <Text style={[styles.controlText, { color: colors.icon }]}>
              {MusicEmojis.previous}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={handlePlayPause}
            style={[styles.playButton, { backgroundColor: colors.button }]}
          >
            <Text style={styles.playButtonText}>
              {playerState.isPlaying ? MusicEmojis.pause : MusicEmojis.play}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={next} style={styles.controlButton}>
            <Text style={[styles.controlText, { color: colors.icon }]}>
              {MusicEmojis.next}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Barra de progresso */}
      <View style={styles.progressContainer}>
        <View style={[styles.progressBar, { backgroundColor: colors.border }]}>
          <View
            style={[
              styles.progressFill,
              { backgroundColor: colors.button, width: `${progress}%` },
            ]}
          />
        </View>
        <View style={styles.timeContainer}>
          <Text style={[styles.timeText, { color: colors.textSecondary }]}>
            {formatTime(playerState.position)}
          </Text>
          <Text style={[styles.timeText, { color: colors.textSecondary }]}>
            {formatTime(playerState.duration)}
          </Text>
        </View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    borderTopWidth: 1,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
      android: {
        elevation: 8,
      },
    }),
  },
  infoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
  },
  cover: {
    width: 48,
    height: 48,
    borderRadius: 8,
    marginRight: 12,
  },
  noCover: {
    backgroundColor: '#2C2C54',
    justifyContent: 'center',
    alignItems: 'center',
  },
  noCoverText: {
    fontSize: 20,
  },
  textContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  title: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 2,
  },
  artist: {
    fontSize: 12,
  },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  controlButton: {
    padding: 8,
  },
  controlText: {
    fontSize: 20,
  },
  playButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  playButtonText: {
    fontSize: 20,
  },
  progressContainer: {
    paddingHorizontal: 12,
    paddingBottom: 8,
  },
  progressBar: {
    height: 2,
    borderRadius: 1,
    overflow: 'hidden',
    marginBottom: 4,
  },
  progressFill: {
    height: '100%',
  },
  timeContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  timeText: {
    fontSize: 10,
  },
});
