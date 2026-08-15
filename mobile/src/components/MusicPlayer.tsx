// Componente MusicPlayer — Controles de reprodução e download.
// Player universal: tenta stream completo, cai para preview iTunes/Deezer automaticamente.
// Download in-page com barra de progresso real (sem abrir nova janela).

import React, { useState, useCallback, useRef, memo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Modal,
  Pressable,
  Platform,
} from 'react-native';
import { useTheme } from '../contexts/ThemeContext';
import { MusicEmojis } from './AnimatedIcon';
import { Release } from '../types';
import { BASE_URL } from '../services/api';
import { SpotifyLoginScreen } from '../screens/SpotifyLoginScreen';

interface MusicPlayerProps {
  release: Release;
}

// Cache de áudios que já tocaram com sucesso — evita tentar URL com falha novamente
const urlsSucesso = new Map<number, string>();

function MusicPlayerComponent({ release }: MusicPlayerProps): React.JSX.Element {
  const { colors } = useTheme();
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [isDownloading, setIsDownloading] = useState(false);
  const [qualityModalVisible, setQualityModalVisible] = useState(false);
  const [spotifyLoginVisible, setSpotifyLoginVisible] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // URL base de stream do backend
  const streamUrl   = `${BASE_URL}/api/releases/${release.id}/stream`;
  const downloadUrl = `${BASE_URL}/api/releases/${release.id}/download`;

  // URLs de fallback que já vêm do banco
  const previewUrl  = release.audio_preview_url ?? release.streaming_url ?? null;

  // ──────────────────────────────────────────────
  // PLAYER — tenta stream; fallback para preview
  // ──────────────────────────────────────────────
  const tocarWeb = useCallback(async (url: string): Promise<boolean> => {
    return new Promise((resolve) => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = '';
      }
      const audio = document.createElement('audio');
      audio.crossOrigin = 'anonymous';
      audio.preload = 'auto';

      const cleanup = () => {
        audio.removeEventListener('canplaythrough', onOk);
        audio.removeEventListener('error', onErr);
      };

      const onOk = () => {
        cleanup();
        audioRef.current = audio;
        audio.play()
          .then(() => resolve(true))
          .catch(() => resolve(false));
      };

      const onErr = () => {
        cleanup();
        resolve(false);
      };

      audio.addEventListener('canplaythrough', onOk, { once: true });
      audio.addEventListener('error', onErr, { once: true });
      audio.src = url;
      audio.load();
    });
  }, []);

  const togglePlayback = useCallback(async () => {
    // Pausar se já está tocando
    if (isPlaying) {
      if (audioRef.current) {
        audioRef.current.pause();
      }
      setIsPlaying(false);
      return;
    }

    setIsLoading(true);
    try {
      // 1. Tentativa com URL em cache (já funcionou antes)
      const urlCache = urlsSucesso.get(release.id);
      if (urlCache) {
        const ok = await tocarWeb(urlCache);
        if (ok) {
          setIsPlaying(true);
          setIsLoading(false);

          audioRef.current?.addEventListener('ended', () => setIsPlaying(false), { once: true });
          audioRef.current?.addEventListener('error', () => setIsPlaying(false), { once: true });
          return;
        }
        urlsSucesso.delete(release.id);
      }

      // 2. Stream completo via backend
      let ok = await tocarWeb(streamUrl);
      if (ok) {
        urlsSucesso.set(release.id, streamUrl);
        setIsPlaying(true);
        audioRef.current?.addEventListener('ended', () => setIsPlaying(false), { once: true });
        audioRef.current?.addEventListener('error', () => setIsPlaying(false), { once: true });
        setIsLoading(false);
        return;
      }

      // 3. Fallback: preview do banco (iTunes/Deezer)
      if (previewUrl) {
        ok = await tocarWeb(previewUrl);
        if (ok) {
          urlsSucesso.set(release.id, previewUrl);
          setIsPlaying(true);
          audioRef.current?.addEventListener('ended', () => setIsPlaying(false), { once: true });
          audioRef.current?.addEventListener('error', () => setIsPlaying(false), { once: true });
          setIsLoading(false);
          return;
        }
      }

      // 4. Sem áudio disponível
      Alert.alert('Sem áudio', 'Nenhuma fonte de áudio disponível para esta versão.');
    } catch (err) {
      console.error('Erro no player:', err);
      Alert.alert('Erro', 'Não foi possível reproduzir a música.');
    } finally {
      setIsLoading(false);
    }
  }, [isPlaying, release.id, streamUrl, previewUrl, tocarWeb]);

  // ──────────────────────────────────────────────
  // DOWNLOAD IN-PAGE — sem abrir nova janela
  // ──────────────────────────────────────────────
  const iniciarDownload = useCallback(async (formato: 'mp3' | 'flac') => {
    setQualityModalVisible(false);
    if (isDownloading) return;

    setIsDownloading(true);
    setDownloadProgress(0);

    const url = `${downloadUrl}?format=${formato}`;
    const nomeArquivo = `${release.artist_name} - ${release.version_name}.${formato}`
      .replace(/[\\/:*?"<>|]/g, '_');

    try {
      if (Platform.OS === 'web') {
        // Web: fetch com progresso real via ReadableStream
        const resp = await fetch(url);
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);

        const contentLength = resp.headers.get('Content-Length');
        const total = contentLength ? parseInt(contentLength, 10) : 0;
        const reader = resp.body?.getReader();
        if (!reader) throw new Error('Stream não disponível');

        const chunks: Uint8Array[] = [];
        let baixado = 0;

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          if (value) {
            chunks.push(value);
            baixado += value.length;
            if (total > 0) {
              setDownloadProgress(Math.round((baixado / total) * 100));
            } else {
              // Sem Content-Length: progresso indeterminado
              setDownloadProgress(prev => Math.min(prev + 5, 90));
            }
          }
        }

        setDownloadProgress(100);

        // Monta Blob e dispara download via URL temporária
        const mimeType = formato === 'flac' ? 'audio/flac' : 'audio/mpeg';
        const blob = new Blob(chunks, { type: mimeType });
        const objectUrl = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = objectUrl;
        link.download = nomeArquivo;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(objectUrl);

        Alert.alert('Download concluído', `${nomeArquivo} salvo!`);
      } else {
        // React Native: usa expo-file-system/legacy
        const FileSystem = require('expo-file-system/legacy');
        const cacheDir = FileSystem.cacheDirectory ?? FileSystem.documentDirectory ?? '';
        const destino  = `${cacheDir}${nomeArquivo}`;

        const task = FileSystem.createDownloadResumable(
          url,
          destino,
          {},
          (prog: { totalBytesWritten: number; totalBytesExpectedToWrite: number }) => {
            const pct = prog.totalBytesExpectedToWrite > 0
              ? Math.round((prog.totalBytesWritten / prog.totalBytesExpectedToWrite) * 100)
              : 0;
            setDownloadProgress(pct);
          }
        );
        await task.downloadAsync();
        setDownloadProgress(100);
        Alert.alert('Download concluído', `${nomeArquivo} salvo!`);
      }
    } catch (err) {
      console.error('Erro no download:', err);
      Alert.alert('Erro no download', 'Não foi possível baixar o arquivo. Tente novamente.');
    } finally {
      setIsDownloading(false);
      setDownloadProgress(0);
    }
  }, [isDownloading, downloadUrl, release.artist_name, release.version_name]);

  return (
    <View style={[styles.container, { backgroundColor: colors.card }]}>
      {/* Informações da música */}
      <View style={styles.infoContainer}>
        <Text style={[styles.title, { color: colors.text }]} numberOfLines={1}>
          {release.work_title}
        </Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]} numberOfLines={1}>
          {release.artist_name} — {release.version_name}
        </Text>
        {release.quality && (
          <Text style={[styles.quality, { color: colors.success }]}>
            {MusicEmojis.quality} {release.quality}
          </Text>
        )}
      </View>

      {/* Controles: Play | Download */}
      <View style={styles.controls}>
        {/* Botão Play/Pause */}
        <TouchableOpacity
          style={[styles.controlButton, { backgroundColor: colors.button }]}
          onPress={togglePlayback}
          activeOpacity={0.8}
          disabled={isLoading}
        >
          <Text style={styles.controlButtonText}>
            {isLoading
              ? MusicEmojis.loading
              : isPlaying
                ? MusicEmojis.pause
                : MusicEmojis.play}
          </Text>
        </TouchableOpacity>

        {/* Botão Download */}
        <TouchableOpacity
          style={[styles.controlButton, { backgroundColor: colors.secondary }]}
          onPress={() => setQualityModalVisible(true)}
          disabled={isDownloading}
          activeOpacity={0.8}
        >
          <Text style={[styles.controlButtonText, { color: colors.text }]}>
            {isDownloading ? `${downloadProgress}%` : MusicEmojis.download}
          </Text>
        </TouchableOpacity>

        {/* Botão Spotify — opcional */}
        <TouchableOpacity
          style={[styles.spotifyBtn, { backgroundColor: '#1DB954' }]}
          onPress={() => setSpotifyLoginVisible(true)}
        >
          <Text style={styles.spotifyBtnText}>Spotify</Text>
        </TouchableOpacity>
      </View>

      {/* Barra de progresso do download */}
      {isDownloading && (
        <View style={styles.progressContainer}>
          <View style={[styles.progressBar, { backgroundColor: colors.border }]}>
            <View
              style={[
                styles.progressFill,
                { backgroundColor: colors.success, width: `${downloadProgress}%` },
              ]}
            />
          </View>
          <Text style={[styles.progressText, { color: colors.textSecondary }]}>
            Baixando... {downloadProgress}%
          </Text>
        </View>
      )}

      {/* Modal de qualidade */}
      <Modal
        visible={qualityModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setQualityModalVisible(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setQualityModalVisible(false)}>
          <View style={[styles.modalContent, { backgroundColor: colors.card }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>
              Qualidade do Download
            </Text>
            <TouchableOpacity
              style={[styles.qualityOption, { borderBottomColor: colors.border, borderBottomWidth: 1 }]}
              onPress={() => iniciarDownload('mp3')}
            >
              <Text style={[styles.qualityText, { color: colors.text }]}>
                {MusicEmojis.quality} MP3 (320 kbps)
              </Text>
              <Text style={[styles.qualitySub, { color: colors.textSecondary }]}>
                Excelente qualidade, menor tamanho.
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.qualityOption}
              onPress={() => iniciarDownload('flac')}
            >
              <Text style={[styles.qualityText, { color: colors.text }]}>
                {MusicEmojis.cd} FLAC (Lossless)
              </Text>
              <Text style={[styles.qualitySub, { color: colors.textSecondary }]}>
                Qualidade de estúdio, arquivo grande.
              </Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>

      {/* Modal Spotify */}
      <SpotifyLoginScreen
        visible={spotifyLoginVisible}
        onClose={() => setSpotifyLoginVisible(false)}
        onLoginSuccess={() => setSpotifyLoginVisible(false)}
      />
    </View>
  );
}

export default memo(MusicPlayerComponent);

const styles = StyleSheet.create({
  container: {
    borderRadius: 12,
    padding: 16,
    marginVertical: 8,
  },
  infoContainer: { marginBottom: 12 },
  title: { fontSize: 16, fontWeight: '600', marginBottom: 4 },
  subtitle: { fontSize: 14, marginBottom: 4 },
  quality: { fontSize: 12, fontWeight: '500' },
  controls: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  controlButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
  },
  controlButtonText: { fontSize: 24 },
  progressContainer: { marginTop: 12 },
  progressBar: { height: 4, borderRadius: 2, overflow: 'hidden', marginBottom: 4 },
  progressFill: { height: '100%' },
  progressText: { fontSize: 12, textAlign: 'center' },
  spotifyBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  spotifyBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 12 },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: { width: '80%', borderRadius: 12, padding: 20, elevation: 5 },
  modalTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 16, textAlign: 'center' },
  qualityOption: { paddingVertical: 16 },
  qualityText: { fontSize: 16, fontWeight: '600', marginBottom: 4 },
  qualitySub: { fontSize: 12 },
});
