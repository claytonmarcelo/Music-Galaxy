// Componente MusicPlayer — Controles de reprodução e download.
// Player universal (Regra 3): reproduz o stream completo servido pelo backend,
// que resolve a fonte exclusivamente em sites abertos (blogs, fóruns, links diretos).
// Nunca usa YouTube / Spotify / Deezer ou qualquer plataforma de música.
// - Web: HTML5 Audio
// - iOS/Android: expo-av (Sound.createAsync)
// Download in-page com barra de progresso real (sem abrir nova janela).

import React, { useState, useCallback, useRef, useEffect, memo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  Pressable,
  Platform,
} from 'react-native';
import { useTheme } from '../contexts/ThemeContext';
import { useModal } from '../contexts/ModalContext';
import { MusicEmojis } from './AnimatedIcon';
import { Release } from '../types';
import { BASE_URL } from '../services/api';

// Importa expo-av apenas em ambiente React Native (nunca no web)
let ExpoAudio: any;
if (Platform.OS !== 'web') {
  try {
    ExpoAudio = require('expo-av').Audio;
  } catch {
    console.warn('expo-av não disponível');
  }
}

interface MusicPlayerProps {
  release: Release;
}

function MusicPlayerComponent({ release }: MusicPlayerProps): React.JSX.Element {
  const { colors } = useTheme();
  // Sistema global de modais e toasts no lugar do Alert nativo
  const { abrirErro, toastSucesso } = useModal();
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [isDownloading, setIsDownloading] = useState(false);
  const [qualityModalVisible, setQualityModalVisible] = useState(false);

  // Referências de playback por plataforma
  const audioRef = useRef<HTMLAudioElement | null>(null);   // Web
  const soundRef = useRef<any>(null);                        // expo-av (nativo)

  // URL de stream do backend — única fonte de playback (Regra 3)
  const streamUrl   = `${BASE_URL}/api/releases/${release.id}/stream`;
  const downloadUrl = `${BASE_URL}/api/releases/${release.id}/download`;

  // Libera o áudio ao desmontar o componente — evita som tocando em background
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = '';
        audioRef.current = null;
      }
      if (soundRef.current) {
        soundRef.current.unloadAsync().catch(() => {});
        soundRef.current = null;
      }
    };
  }, []);

  // ──────────────────────────────────────────────
  // PLAYER WEB — HTML5 Audio
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
          .then(() => {
            audio.addEventListener('ended', () => setIsPlaying(false), { once: true });
            audio.addEventListener('error', () => setIsPlaying(false), { once: true });
            resolve(true);
          })
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

  // ──────────────────────────────────────────────
  // PLAYER NATIVO — expo-av (iOS/Android)
  // ──────────────────────────────────────────────
  const tocarNativo = useCallback(async (url: string): Promise<boolean> => {
    if (!ExpoAudio?.Sound) return false;

    try {
      // Descarta som anterior antes de criar novo
      if (soundRef.current) {
        await soundRef.current.unloadAsync().catch(() => {});
        soundRef.current = null;
      }

      // Toca em modo silencioso no iOS e ducking no Android
      await ExpoAudio.setAudioModeAsync({
        playsInSilentModeIOS: true,
        shouldDuckAndroid: true,
        staysActiveInBackground: false,
      });

      // createAsync retorna a instância real do Sound (com pauseAsync/playAsync)
      const { sound, status } = await ExpoAudio.Sound.createAsync(
        { uri: url },
        { shouldPlay: true },
        // Listener de status: termina quando a faixa acaba
        (st: any) => {
          if (st.isLoaded && st.didJustFinish) {
            setIsPlaying(false);
          }
        }
      );

      if (!status.isLoaded) {
        await sound.unloadAsync().catch(() => {});
        return false;
      }

      soundRef.current = sound;
      return true;
    } catch (err) {
      console.error('Erro no player nativo:', err);
      return false;
    }
  }, []);

  // Pausar playback atual em qualquer plataforma
  const pausarPlayback = useCallback(async () => {
    if (audioRef.current) {
      audioRef.current.pause();
    }
    if (soundRef.current?.pauseAsync) {
      await soundRef.current.pauseAsync().catch(() => {});
    }
    setIsPlaying(false);
  }, []);

  // Retomar playback nativo pausado (web retoma via tocarWeb com nova URL)
  const retomarNativo = useCallback(async (): Promise<boolean> => {
    if (soundRef.current?.playAsync) {
      try {
        await soundRef.current.playAsync();
        return true;
      } catch {
        return false;
      }
    }
    return false;
  }, []);

  const togglePlayback = useCallback(async () => {
    // Pausar se já está tocando
    if (isPlaying) {
      await pausarPlayback();
      return;
    }

    // Retomar se ainda há instância de som carregada
    const retomou = await retomarNativo();
    if (retomou) {
      setIsPlaying(true);
      return;
    }

    setIsLoading(true);
    try {
      // Regra 3: o único caminho de playback é o stream do backend,
      // que resolve a fonte em sites abertos (blog/fórum/link direto).
      const ok = Platform.OS === 'web'
        ? await tocarWeb(streamUrl)
        : await tocarNativo(streamUrl);

      if (ok) {
        setIsPlaying(true);
        return;
      }

      abrirErro(
        'Não foi possível reproduzir',
        'Nenhuma fonte de áudio aberta disponível para esta versão.'
      );
    } catch (err) {
      console.error('Erro no player:', err);
      abrirErro(
        'Não foi possível reproduzir',
        'Não foi possível reproduzir o áudio desta versão. Verifique sua conexão e tente novamente.'
      );
    } finally {
      setIsLoading(false);
    }
  }, [isPlaying, streamUrl, tocarWeb, tocarNativo, pausarPlayback, retomarNativo, abrirErro]);

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

        toastSucesso('Download concluído! O arquivo foi salvo.');
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
        toastSucesso('Download concluído! O arquivo foi salvo.');
      }
    } catch (err) {
      console.error('Erro no download:', err);
      abrirErro(
        'Erro no download',
        'Não foi possível baixar o arquivo. Verifique sua conexão e tente novamente.'
      );
    } finally {
      setIsDownloading(false);
      setDownloadProgress(0);
    }
  }, [isDownloading, downloadUrl, release.artist_name, release.version_name, abrirErro, toastSucesso]);

  return (
    <View
      style={[
        styles.container,
        {
          // Painel do player em vidro mais opaco, com contorno e sombra do tema
          backgroundColor: colors.glassCardForte,
          borderColor: colors.glassBorder,
          shadowColor: colors.glassShadow,
        },
      ]}
    >
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
        <Pressable
          style={[styles.modalOverlay, { backgroundColor: colors.backdrop }]}
          onPress={() => setQualityModalVisible(false)}
        >
          <View
            style={[
              styles.modalContent,
              {
                // Conteúdo do modal em vidro mais opaco, com contorno e sombra
                backgroundColor: colors.glassCardForte,
                borderColor: colors.glassBorder,
                shadowColor: colors.glassShadow,
              },
            ]}
          >
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
    </View>
  );
}

export default memo(MusicPlayerComponent);

const styles = StyleSheet.create({
  container: {
    borderRadius: 16,
    padding: 16,
    marginVertical: 8,
    borderWidth: 1,
    // Sombra suave de vidro (a cor vem do tema, aplicada em linha)
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 5,
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
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    // O véu escuro translúcido vem do tema (colors.backdrop), aplicado em linha
  },
  modalContent: {
    width: '80%',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    // Sombra suave de vidro (a cor vem do tema, aplicada em linha)
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 5,
  },
  modalTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 16, textAlign: 'center' },
  qualityOption: { paddingVertical: 16 },
  qualityText: { fontSize: 16, fontWeight: '600', marginBottom: 4 },
  qualitySub: { fontSize: 12 },
});
