// Componente de progresso de download.
// Exibe barra de progresso animada, percentual, tamanho e botões de controle.
// Design premium com animações suaves e feedback visual.

import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Platform,
  Animated,
} from 'react-native';
import { downloadManager, EstadoDownload } from '../services/downloadManager';
import { useModal } from '../contexts/ModalContext';
import { TIMINGS, EASING } from '../utils/animacoes';

interface Props {
  url: string;
  titulo: string;
  artista: string;
  onDownloadConcluido?: (caminhoLocal: string) => void;
}

export default function DownloadProgress({
  url,
  titulo,
  artista,
  onDownloadConcluido,
}: Props): React.JSX.Element | null {
  const [estado, setEstado] = useState<EstadoDownload | null>(
    downloadManager.obterEstado(url)
  );
  const [iniciarDownload, setIniciarDownload] = useState(false);
  const { abrirConfirmacao, toastErro, toastSucesso } = useModal();

  // Animações
  const fadeInAnim = useRef(new Animated.Value(0)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;
  const scaleCheckmarkAnim = useRef(new Animated.Value(0)).current;

  // Inscreve para atualizações de progresso
  useEffect(() => {
    if (!iniciarDownload && !estado?.baixando && !estado?.concluido) {
      return;
    }

    // Anima entrada
    Animated.timing(fadeInAnim, {
      toValue: 1,
      duration: TIMINGS.normal,
      useNativeDriver: true,
    }).start();

    const unsubscribe = downloadManager.subscribe(url, (novoEstado) => {
      setEstado(novoEstado);

      // Anima progresso
      if (novoEstado.baixando) {
        const progresso = novoEstado.progresso ?? 0;
        Animated.timing(progressAnim, {
          toValue: progresso,
          duration: 300,
          useNativeDriver: false,
        }).start();
      }

      // Notifica quando concluído
      if (novoEstado.concluido && novoEstado.caminhoLocal) {
        toastSucesso('Download concluído!');
        
        // Anima checkmark
        Animated.spring(scaleCheckmarkAnim, {
          toValue: 1,
          useNativeDriver: true,
          ...EASING.suave,
        }).start();

        if (onDownloadConcluido) {
          onDownloadConcluido(novoEstado.caminhoLocal);
        }
      }
    });

    return () => unsubscribe();
  }, [url, iniciarDownload, onDownloadConcluido, fadeInAnim, progressAnim, scaleCheckmarkAnim, toastSucesso]);

  const handleIniciarDownload = async () => {
    try {
      setIniciarDownload(true);
      const caminhoLocal = await downloadManager.baixar(url, titulo);
      if (onDownloadConcluido) {
        onDownloadConcluido(caminhoLocal);
      }
    } catch (err) {
      const mensagem = err instanceof Error ? err.message : 'Erro ao baixar';
      toastErro(mensagem);
      setIniciarDownload(false);
    }
  };

  const handleCancelar = async () => {
    try {
      await downloadManager.cancelar(url);
      setIniciarDownload(false);
      toastSucesso('Download cancelado');
    } catch (err) {
      console.error('Erro ao cancelar:', err);
    }
  };

  const handleDeletar = () => {
    abrirConfirmacao(
      'Remover Download',
      'Tem certeza que deseja remover este arquivo?',
      async () => {
        try {
          await downloadManager.deletar(url);
          setEstado(null);
          toastSucesso('Arquivo removido');
        } catch (err) {
          toastErro('Não foi possível deletar o arquivo');
        }
      }
    );
  };

  const formatarTamanho = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
  };

  const percentual = Math.round((estado?.progresso ?? 0) * 100);

  // Se não iniciou e não há download prévio, mostra botão para iniciar
  if (!estado && !iniciarDownload) {
    return (
      <Animated.View
        style={[
          styles.container,
          {
            opacity: fadeInAnim,
          },
        ]}
      >
        <View style={styles.infoDownload}>
          <Text style={styles.titulo} numberOfLines={1}>
            💾 {titulo}
          </Text>
          <Text style={styles.artista} numberOfLines={1}>
            {artista}
          </Text>
        </View>
        <TouchableOpacity
          style={styles.botaoBaixar}
          onPress={handleIniciarDownload}
          activeOpacity={0.7}
        >
          <Text style={styles.botaoTexto}>⬇️ Baixar</Text>
        </TouchableOpacity>
      </Animated.View>
    );
  }

  // Enquanto está baixando
  if (estado?.baixando) {
    const progressWidth = progressAnim.interpolate({
      inputRange: [0, 1],
      outputRange: ['0%', '100%'],
    });

    return (
      <Animated.View
        style={[
          styles.container,
          {
            opacity: fadeInAnim,
          },
        ]}
      >
        <View style={styles.infoDownload}>
          <Text style={styles.titulo} numberOfLines={1}>
            💾 {titulo}
          </Text>
          <Text style={styles.artista} numberOfLines={1}>
            {artista}
          </Text>
        </View>

        {/* Barra de progresso animada */}
        <View style={styles.progressoContainer}>
          <View style={styles.barraFundo}>
            <Animated.View
              style={[
                styles.barraProgresso,
                { width: progressWidth },
              ]}
            />
          </View>
          <View style={styles.detalhesProgresso}>
            <Text style={styles.percentual}>{percentual}%</Text>
            <Text style={styles.tamanho}>
              {formatarTamanho(estado.tamanhoAtual)} / {formatarTamanho(estado.tamanhoTotal)}
            </Text>
          </View>
        </View>

        {/* Botões de controle */}
        <TouchableOpacity
          style={styles.botaoCancelar}
          onPress={handleCancelar}
          activeOpacity={0.7}
        >
          <Text style={styles.botaoCancelarTexto}>✕ Cancelar</Text>
        </TouchableOpacity>
      </Animated.View>
    );
  }

  // Download concluído
  if (estado?.concluido && estado.caminhoLocal) {
    return (
      <Animated.View
        style={[
          styles.container,
          {
            opacity: fadeInAnim,
          },
        ]}
      >
        <View style={styles.infoDownload}>
          <Text style={styles.titulo} numberOfLines={1}>
            💾 {titulo}
          </Text>
          <Text style={styles.artista} numberOfLines={1}>
            {artista}
          </Text>
        </View>

        <View style={styles.concluido}>
          <Animated.View
            style={[
              styles.checkmarkContainer,
              {
                transform: [{ scale: scaleCheckmarkAnim }],
              },
            ]}
          >
            <Text style={styles.checkmark}>✓</Text>
          </Animated.View>
          <Text style={styles.concluidoTexto}>Baixado</Text>
          <Text style={styles.tamanhoFinal}>
            {formatarTamanho(estado.tamanhoTotal)}
          </Text>
        </View>

        <TouchableOpacity
          style={styles.botaoDeletar}
          onPress={handleDeletar}
          activeOpacity={0.7}
        >
          <Text style={styles.botaoDeletarTexto}>🗑 Remover</Text>
        </TouchableOpacity>
      </Animated.View>
    );
  }

  // Erro
  if (estado?.erro) {
    return (
      <Animated.View
        style={[
          styles.container,
          {
            opacity: fadeInAnim,
          },
        ]}
      >
        <View style={styles.infoDownload}>
          <Text style={styles.titulo} numberOfLines={1}>
            💾 {titulo}
          </Text>
          <Text style={styles.artista} numberOfLines={1}>
            {artista}
          </Text>
        </View>

        <View style={styles.erroBox}>
          <Text style={styles.erroIcone}>⚠️</Text>
          <Text style={styles.erroTexto}>{estado.erro}</Text>
        </View>

        <TouchableOpacity
          style={styles.botaoBaixar}
          onPress={handleIniciarDownload}
          activeOpacity={0.7}
        >
          <Text style={styles.botaoTexto}>⬇️ Tentar Novamente</Text>
        </TouchableOpacity>
      </Animated.View>
    );
  }

  return null;
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#12121F',
    borderRadius: 16,
    padding: 20,
    marginHorizontal: 16,
    marginVertical: 12,
    borderWidth: 1,
    borderColor: '#1DB95420',
    ...Platform.select({
      ios: {
        shadowColor: '#1DB954',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.12,
        shadowRadius: 10,
      },
      android: {
        elevation: 5,
      },
    }),
  },

  infoDownload: {
    marginBottom: 16,
  },

  titulo: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 4,
    letterSpacing: 0.3,
  },

  artista: {
    fontSize: 13,
    color: '#8080A0',
    fontWeight: '500',
  },

  progressoContainer: {
    marginVertical: 14,
  },

  barraFundo: {
    height: 8,
    backgroundColor: '#2A2A4A',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 10,
  },

  barraProgresso: {
    height: '100%',
    backgroundColor: '#1DB954',
    borderRadius: 4,
  },

  detalhesProgresso: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },

  percentual: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1DB954',
  },

  tamanho: {
    fontSize: 12,
    color: '#606080',
    fontWeight: '500',
  },

  tamanhoFinal: {
    fontSize: 12,
    color: '#8080A0',
    marginTop: 6,
  },

  concluido: {
    backgroundColor: '#1DB95420',
    borderRadius: 12,
    padding: 16,
    marginVertical: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#1DB954',
  },

  checkmarkContainer: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#1DB954',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },

  checkmark: {
    fontSize: 28,
    color: '#FFFFFF',
    fontWeight: '700',
  },

  concluidoTexto: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1DB954',
  },

  erroBox: {
    backgroundColor: '#FF6B3520',
    borderRadius: 12,
    padding: 14,
    marginVertical: 14,
    borderLeftWidth: 3,
    borderLeftColor: '#FF6B35',
    flexDirection: 'row',
    alignItems: 'center',
  },

  erroIcone: {
    fontSize: 18,
    marginRight: 10,
  },

  erroTexto: {
    fontSize: 12,
    color: '#FF6B35',
    fontWeight: '600',
    flex: 1,
  },

  botaoBaixar: {
    backgroundColor: '#1DB954',
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
    alignItems: 'center',
    marginTop: 10,
    ...Platform.select({
      ios: {
        shadowColor: '#1DB954',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
      },
      android: {
        elevation: 4,
      },
    }),
  },

  botaoCancelar: {
    backgroundColor: '#FF6B3520',
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
    alignItems: 'center',
    marginTop: 10,
    borderWidth: 1,
    borderColor: '#FF6B35',
  },

  botaoDeletar: {
    backgroundColor: '#2E2E4E',
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
    alignItems: 'center',
    marginTop: 10,
    borderWidth: 1,
    borderColor: '#3E3E5E',
  },

  botaoTexto: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },

  botaoCancelarTexto: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FF6B35',
  },

  botaoDeletarTexto: {
    fontSize: 13,
    fontWeight: '700',
    color: '#8080A0',
  },
});
