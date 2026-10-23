// Componente de progresso de download.
// Exibe barra de progresso animada, percentual, tamanho e botões de controle.
// Visual premium com vidro fosco, animações suaves e feedback visual,
// sempre com as cores resolvidas pelos tokens do tema ativo.

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
import { useTheme } from '../contexts/ThemeContext';
import { TIMINGS, EASING, USE_NATIVE_DRIVER } from '../utils/animacoes';

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
  const { colors } = useTheme();
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
      useNativeDriver: USE_NATIVE_DRIVER,
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
        toastSucesso('Download concluído! O arquivo foi salvo.');
        
        // Anima checkmark
        Animated.spring(scaleCheckmarkAnim, {
          toValue: 1,
          useNativeDriver: USE_NATIVE_DRIVER,
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
      'Remover download',
      'Tem certeza de que deseja remover este arquivo?',
      async () => {
        try {
          await downloadManager.deletar(url);
          setEstado(null);
          toastSucesso('Arquivo removido');
        } catch (err) {
          toastErro('Não foi possível remover o arquivo.');
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
            // Painel em vidro mais opaco, com contorno e sombra do tema
            backgroundColor: colors.glassCardForte,
            borderColor: colors.glassBorder,
            shadowColor: colors.glassShadow,
          },
        ]}
      >
        <View style={styles.infoDownload}>
          <Text style={[styles.titulo, { color: colors.text }]} numberOfLines={1}>
            💾 {titulo}
          </Text>
          <Text style={[styles.artista, { color: colors.textSecondary }]} numberOfLines={1}>
            {artista}
          </Text>
        </View>
        <TouchableOpacity
          style={[
            styles.botaoBaixar,
            { backgroundColor: colors.button, shadowColor: colors.glassShadow },
          ]}
          onPress={handleIniciarDownload}
          activeOpacity={0.7}
        >
          <Text style={[styles.botaoTexto, { color: colors.buttonText }]}>⬇️ Baixar</Text>
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
            // Painel em vidro mais opaco, com contorno e sombra do tema
            backgroundColor: colors.glassCardForte,
            borderColor: colors.glassBorder,
            shadowColor: colors.glassShadow,
          },
        ]}
      >
        <View style={styles.infoDownload}>
          <Text style={[styles.titulo, { color: colors.text }]} numberOfLines={1}>
            💾 {titulo}
          </Text>
          <Text style={[styles.artista, { color: colors.textSecondary }]} numberOfLines={1}>
            {artista}
          </Text>
        </View>

        {/* Barra de progresso animada */}
        <View style={styles.progressoContainer}>
          <View style={[styles.barraFundo, { backgroundColor: colors.border }]}>
            <Animated.View
              style={[
                styles.barraProgresso,
                { width: progressWidth, backgroundColor: colors.primary },
              ]}
            />
          </View>
          <View style={styles.detalhesProgresso}>
            <Text style={[styles.percentual, { color: colors.primary }]}>{percentual}%</Text>
            <Text style={[styles.tamanho, { color: colors.textSecondary }]}>
              {formatarTamanho(estado.tamanhoAtual)} / {formatarTamanho(estado.tamanhoTotal)}
            </Text>
          </View>
        </View>

        {/* Botões de controle */}
        <TouchableOpacity
          style={[
            styles.botaoCancelar,
            { backgroundColor: colors.glassCard, borderColor: colors.error },
          ]}
          onPress={handleCancelar}
          activeOpacity={0.7}
        >
          <Text style={[styles.botaoCancelarTexto, { color: colors.error }]}>✕ Cancelar</Text>
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
            // Painel em vidro mais opaco, com contorno e sombra do tema
            backgroundColor: colors.glassCardForte,
            borderColor: colors.glassBorder,
            shadowColor: colors.glassShadow,
          },
        ]}
      >
        <View style={styles.infoDownload}>
          <Text style={[styles.titulo, { color: colors.text }]} numberOfLines={1}>
            💾 {titulo}
          </Text>
          <Text style={[styles.artista, { color: colors.textSecondary }]} numberOfLines={1}>
            {artista}
          </Text>
        </View>

        <View style={[styles.concluido, { backgroundColor: colors.glassCard, borderColor: colors.success }]}>
          <Animated.View
            style={[
              styles.checkmarkContainer,
              {
                backgroundColor: colors.success,
                transform: [{ scale: scaleCheckmarkAnim }],
              },
            ]}
          >
            <Text style={[styles.checkmark, { color: colors.buttonText }]}>✓</Text>
          </Animated.View>
          <Text style={[styles.concluidoTexto, { color: colors.success }]}>Baixado</Text>
          <Text style={[styles.tamanhoFinal, { color: colors.textSecondary }]}>
            {formatarTamanho(estado.tamanhoTotal)}
          </Text>
        </View>

        <TouchableOpacity
          style={[
            styles.botaoDeletar,
            { backgroundColor: colors.secondary, borderColor: colors.border },
          ]}
          onPress={handleDeletar}
          activeOpacity={0.7}
        >
          <Text style={[styles.botaoDeletarTexto, { color: colors.textSecondary }]}>🗑 Remover</Text>
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
            // Painel em vidro mais opaco, com contorno e sombra do tema
            backgroundColor: colors.glassCardForte,
            borderColor: colors.glassBorder,
            shadowColor: colors.glassShadow,
          },
        ]}
      >
        <View style={styles.infoDownload}>
          <Text style={[styles.titulo, { color: colors.text }]} numberOfLines={1}>
            💾 {titulo}
          </Text>
          <Text style={[styles.artista, { color: colors.textSecondary }]} numberOfLines={1}>
            {artista}
          </Text>
        </View>

        <View style={[styles.erroBox, { backgroundColor: colors.glassCard, borderLeftColor: colors.error }]}>
          <Text style={styles.erroIcone}>⚠️</Text>
          <Text style={[styles.erroTexto, { color: colors.error }]}>{estado.erro}</Text>
        </View>

        <TouchableOpacity
          style={[
            styles.botaoBaixar,
            { backgroundColor: colors.button, shadowColor: colors.glassShadow },
          ]}
          onPress={handleIniciarDownload}
          activeOpacity={0.7}
        >
          <Text style={[styles.botaoTexto, { color: colors.buttonText }]}>⬇️ Tentar novamente</Text>
        </TouchableOpacity>
      </Animated.View>
    );
  }

  return null;
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 16,
    padding: 20,
    marginHorizontal: 16,
    marginVertical: 12,
    borderWidth: 1,
    // Contorno e sombra de vidro: as cores vêm do tema, aplicadas em linha
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

  infoDownload: {
    marginBottom: 16,
  },

  titulo: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 4,
    letterSpacing: 0.3,
  },

  artista: {
    fontSize: 13,
    fontWeight: '500',
  },

  progressoContainer: {
    marginVertical: 14,
  },

  barraFundo: {
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 10,
  },

  barraProgresso: {
    height: '100%',
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
  },

  tamanho: {
    fontSize: 12,
    fontWeight: '500',
  },

  tamanhoFinal: {
    fontSize: 12,
    marginTop: 6,
  },

  concluido: {
    borderRadius: 12,
    padding: 16,
    marginVertical: 14,
    alignItems: 'center',
    borderWidth: 1,
  },

  checkmarkContainer: {
    width: 52,
    height: 52,
    borderRadius: 26,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },

  checkmark: {
    fontSize: 28,
    fontWeight: '700',
  },

  concluidoTexto: {
    fontSize: 15,
    fontWeight: '700',
  },

  erroBox: {
    borderRadius: 12,
    padding: 14,
    marginVertical: 14,
    borderLeftWidth: 3,
    flexDirection: 'row',
    alignItems: 'center',
  },

  erroIcone: {
    fontSize: 18,
    marginRight: 10,
  },

  erroTexto: {
    fontSize: 12,
    fontWeight: '600',
    flex: 1,
  },

  botaoBaixar: {
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
    alignItems: 'center',
    marginTop: 10,
    ...Platform.select({
      ios: {
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
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
    alignItems: 'center',
    marginTop: 10,
    borderWidth: 1,
  },

  botaoDeletar: {
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
    alignItems: 'center',
    marginTop: 10,
    borderWidth: 1,
  },

  botaoTexto: {
    fontSize: 13,
    fontWeight: '700',
  },

  botaoCancelarTexto: {
    fontSize: 13,
    fontWeight: '700',
  },

  botaoDeletarTexto: {
    fontSize: 13,
    fontWeight: '700',
  },
});
