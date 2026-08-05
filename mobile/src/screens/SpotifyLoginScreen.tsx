// Modal de login do Spotify utilizando WebView.
// Permite ao usuário logar em sua conta sem sair do aplicativo,
// injetando CSS e JS para ocultar barras indesejadas e capturar o estado de login.

import React, { useState, useRef } from 'react';
import { View, Text, Modal, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { WebView } from 'react-native-webview';
import { useTheme } from '../contexts/ThemeContext';
import { MusicEmojis } from '../components/AnimatedIcon';

interface SpotifyLoginScreenProps {
  visible: boolean;
  onClose: () => void;
  onLoginSuccess: (token: string) => void;
}

export function SpotifyLoginScreen({ visible, onClose, onLoginSuccess }: SpotifyLoginScreenProps): React.JSX.Element {
  const { colors } = useTheme();
  const [loading, setLoading] = useState(true);
  const webViewRef = useRef<WebView>(null);

  // Script injetado para monitorar quando o login é bem sucedido
  // e enviar o token de volta ao React Native. Em um ambiente real, 
  // capturaríamos o redirecionamento OAuth.
  const INJECTED_JAVASCRIPT = `
    (function() {
      // Esconde cabeçalhos e rodapés do Spotify para parecer nativo
      var style = document.createElement('style');
      style.innerHTML = 'header, footer { display: none !important; }';
      document.head.appendChild(style);

      // Fica monitorando a URL para ver se retornou o token
      setInterval(() => {
        if (window.location.href.includes('access_token=')) {
          var token = window.location.href.split('access_token=')[1].split('&')[0];
          window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'LOGIN_SUCCESS', token: token }));
        }
      }, 1000);
    })();
    true; // note: this is required, or you'll sometimes get silent failures
  `;

  // Em produção, isso seria configurado no Dashboard do Spotify Developer
  const SPOTIFY_CLIENT_ID = 'SEU_CLIENT_ID_AQUI'; 
  const REDIRECT_URI = 'http://localhost/callback'; // Mock
  const AUTH_URL = `https://accounts.spotify.com/authorize?client_id=${SPOTIFY_CLIENT_ID}&response_type=token&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&scope=streaming%20user-read-email%20user-read-private`;

  const handleMessage = (event: any) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.type === 'LOGIN_SUCCESS' && data.token) {
        onLoginSuccess(data.token);
      }
    } catch (e) {
      // Ignora mensagens malformadas
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={[styles.header, { borderBottomColor: colors.border }]}>
          <Text style={[styles.title, { color: colors.text }]}>
            {MusicEmojis.spotify} Conectar ao Spotify
          </Text>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Text style={[styles.closeText, { color: colors.textSecondary }]}>Fechar</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.webviewContainer}>
          {loading && (
            <View style={styles.loader}>
              <ActivityIndicator size="large" color={colors.primary} />
            </View>
          )}
          <WebView
            ref={webViewRef}
            source={{ uri: AUTH_URL }}
            injectedJavaScript={INJECTED_JAVASCRIPT}
            onMessage={handleMessage}
            onLoadStart={() => setLoading(true)}
            onLoadEnd={() => setLoading(false)}
            incognito={true} // Evita salvar cookies se o usuário cancelar
          />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  closeButton: {
    padding: 8,
  },
  closeText: {
    fontSize: 16,
  },
  webviewContainer: {
    flex: 1,
    position: 'relative',
  },
  loader: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
});
