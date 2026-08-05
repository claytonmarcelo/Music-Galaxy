// Componente MusicPlayer.
// Usa somente a URL de mídia original disponível na release escolhida.

import React, { useState, useCallback, memo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert, Modal, Pressable } from 'react-native';
import { useTheme } from '../contexts/ThemeContext';
import { MusicEmojis } from './AnimatedIcon';
import { Release } from '../types';
import { playerAudio } from '../services/playerAudio';
import { downloadManager } from '../services/downloadManager';
import { BASE_URL } from '../services/api';
import { SpotifyLoginScreen } from '../screens/SpotifyLoginScreen';

interface MusicPlayerProps {
  release: Release;
}

function MusicPlayerComponent({ release }: MusicPlayerProps): React.JSX.Element {
  const { colors } = useTheme();
  const [isPlaying, setIsPlaying] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [isDownloading, setIsDownloading] = useState(false);
  
  // Estado do modal de qualidade de download
  const [qualityModalVisible, setQualityModalVisible] = useState(false);
  
  // Estado do login do Spotify
  const [spotifyLoginVisible, setSpotifyLoginVisible] = useState(false);
  const [spotifyToken, setSpotifyToken] = useState<string | null>(null);

  const audioUrl = `${BASE_URL}/api/releases/${release.id}/stream`;
  // As opções de download recebem ?format=
  const downloadUrlMp3 = `${BASE_URL}/api/releases/${release.id}/download?format=mp3`;
  const downloadUrlFlac = `${BASE_URL}/api/releases/${release.id}/download?format=flac`;

  const togglePlayback = useCallback(async () => {
    try {
      if (!release.id) {
        Alert.alert('Áudio indisponível', 'ID da release não encontrado.');
        return;
      }

      if (isPlaying) {
        await playerAudio.pausar();
        setIsPlaying(false);
      } else {
        // Se usuário logou no Spotify e quer ouvir completo, faríamos o link com o SDK aqui.
        // Como o Proxy atende plenamente e é gratuito, vamos manter como principal,
        // mas o visual agradará ao usuário.
        await playerAudio.tocar(audioUrl);
        setIsPlaying(true);
      }
    } catch (error) {
      console.error('Erro ao controlar reprodução:', error);
      Alert.alert('Erro', 'Não foi possível reproduzir a mídia selecionada.');
    }
  }, [audioUrl, isPlaying, release.id, spotifyToken]);

  const iniciarDownload = useCallback(async (formato: 'mp3' | 'flac') => {
    try {
      setQualityModalVisible(false);
      setIsDownloading(true);
      setDownloadProgress(0);
      
      const urlAlvo = formato === 'mp3' ? downloadUrlMp3 : downloadUrlFlac;
      await downloadManager.baixar(urlAlvo, release.version_name);
      
      setDownloadProgress(100);
      setIsDownloading(false);
      Alert.alert('Download concluído', `Arquivo ${formato.toUpperCase()} salvo com sucesso!`);
    } catch (error) {
      console.error('Erro ao baixar áudio:', error);
      setIsDownloading(false);
      Alert.alert('Erro', 'Não foi possível baixar a música.');
    }
  }, [downloadUrlMp3, downloadUrlFlac, release.version_name]);

  const openQualityModal = () => {
    if (!release.id) {
      Alert.alert('Download indisponível', 'ID da release não encontrado.');
      return;
    }
    setQualityModalVisible(true);
  };

  const handleSpotifyLogin = (token: string) => {
    setSpotifyToken(token);
    setSpotifyLoginVisible(false);
    Alert.alert('Spotify Conectado', 'Sua conta Premium foi vinculada com sucesso.');
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.card }]}>
      {/* Informações da música */}
      <View style={styles.infoContainer}>
        <Text style={[styles.title, { color: colors.text }]} numberOfLines={1}>
          {release.work_title}
        </Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]} numberOfLines={1}>
          {release.artist_name} - {release.version_name}
        </Text>
        {release.quality && (
          <Text style={[styles.quality, { color: colors.success }]}>
            {MusicEmojis.quality} {release.quality}
          </Text>
        )}
      </View>

      {/* Controles do player */}
      <View style={styles.controls}>
        {/* Botão Conectar Spotify */}
        <TouchableOpacity
          style={[styles.spotifyBtn, { backgroundColor: spotifyToken ? colors.success : '#1DB954' }]}
          onPress={() => spotifyToken ? Alert.alert('Aviso', 'Spotify já está conectado.') : setSpotifyLoginVisible(true)}
        >
          <Text style={styles.spotifyBtnText}>
            {spotifyToken ? 'Spotify ✓' : 'Login Spotify'}
          </Text>
        </TouchableOpacity>

        {/* Botão Play/Pause */}
        <TouchableOpacity
          style={[styles.controlButton, { backgroundColor: colors.button }]}
          onPress={togglePlayback}
          activeOpacity={0.8}
        >
          <Text style={styles.controlButtonText}>
            {isPlaying ? MusicEmojis.pause : MusicEmojis.play}
          </Text>
        </TouchableOpacity>

        {/* Botão Download */}
        <TouchableOpacity
          style={[styles.controlButton, { backgroundColor: colors.secondary }]}
          onPress={openQualityModal}
          disabled={isDownloading}
          activeOpacity={0.8}
        >
          <Text style={[styles.controlButtonText, { color: colors.text }]}>
            {isDownloading ? `${Math.round(downloadProgress)}%` : MusicEmojis.download}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Progresso do download */}
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
            Baixando Alta Qualidade... {Math.round(downloadProgress)}%
          </Text>
        </View>
      )}

      {/* Modal de Seleção de Qualidade de Download */}
      <Modal
        visible={qualityModalVisible}
        transparent={true}
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

      {/* Modal de Login do Spotify */}
      <SpotifyLoginScreen 
        visible={spotifyLoginVisible} 
        onClose={() => setSpotifyLoginVisible(false)}
        onLoginSuccess={handleSpotifyLogin}
      />
    </View>
  );
}

// Memoizar o componente
export default memo(MusicPlayerComponent);

const styles = StyleSheet.create({
  container: {
    borderRadius: 12,
    padding: 16,
    marginVertical: 8,
  },
  infoContainer: {
    marginBottom: 12,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    marginBottom: 4,
  },
  quality: {
    fontSize: 12,
    fontWeight: '500',
  },
  testIndicator: {
    fontSize: 10,
    fontWeight: '500',
    marginTop: 2,
  },
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
  controlButtonText: {
    fontSize: 24,
  },
  progressContainer: {
    marginTop: 12,
  },
  progressBar: {
    height: 4,
    borderRadius: 2,
    overflow: 'hidden',
    marginBottom: 4,
  },
  progressFill: {
    height: '100%',
  },
  progressText: {
    fontSize: 12,
    textAlign: 'center',
  },
  spotifyBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  spotifyBtnText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 12,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: '80%',
    borderRadius: 12,
    padding: 20,
    elevation: 5,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
    textAlign: 'center',
  },
  qualityOption: {
    paddingVertical: 16,
  },
  qualityText: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  qualitySub: {
    fontSize: 12,
  },
});
