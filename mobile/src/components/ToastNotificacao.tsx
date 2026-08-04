// Toast Notificação Premium - Notificações elegantes no topo da tela
// Substituem console.log e avisos simples com design gourmet

import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Platform,
} from 'react-native';

export type TipoToast = 'sucesso' | 'erro' | 'aviso' | 'info';

interface Props {
  visivel: boolean;
  tipo: TipoToast;
  mensagem: string;
  duracao?: number; // ms (0 = infinito)
  onFechar?: () => void;
}

const CONFIG_TIPO: Record<TipoToast, {
  cor: string;
  corFundo: string;
  icone: string;
}> = {
  sucesso: {
    cor: '#1DB954',
    corFundo: '#1DB95420',
    icone: '✓',
  },
  erro: {
    cor: '#FF6B35',
    corFundo: '#FF6B3520',
    icone: '✕',
  },
  aviso: {
    cor: '#FFB627',
    corFundo: '#FFB62720',
    icone: '⚠',
  },
  info: {
    cor: '#00D9FF',
    corFundo: '#00D9FF20',
    icone: 'ℹ',
  },
};

export default function ToastNotificacao({
  visivel,
  tipo,
  mensagem,
  duracao = 3000,
  onFechar,
}: Props): React.JSX.Element {
  const translateYAnim = useRef(new Animated.Value(-100)).current;
  const opacidadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visivel) {
      // Animação de entrada
      Animated.parallel([
        Animated.spring(translateYAnim, {
          toValue: 0,
          useNativeDriver: true,
          tension: 65,
          friction: 11,
        }),
        Animated.timing(opacidadeAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();

      // Auto-fechar se duracao > 0
      if (duracao > 0) {
        const timeout = setTimeout(() => {
          fecharToast();
        }, duracao);

        return () => clearTimeout(timeout);
      }
    }
  }, [visivel, duracao, translateYAnim, opacidadeAnim]);

  const fecharToast = () => {
    Animated.parallel([
      Animated.timing(translateYAnim, {
        toValue: -100,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(opacidadeAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start(() => {
      onFechar?.();
    });
  };

  if (!visivel) return <View />;

  const config = CONFIG_TIPO[tipo];

  return (
    <Animated.View
      style={[
        styles.container,
        {
          transform: [{ translateY: translateYAnim }],
          opacity: opacidadeAnim,
        },
      ]}
    >
      <View style={[styles.toast, { borderLeftColor: config.cor }]}>
        {/* Ícone */}
        <View style={[styles.iconeContainer, { backgroundColor: config.corFundo }]}>
          <Text style={[styles.icone, { color: config.cor }]}>
            {config.icone}
          </Text>
        </View>

        {/* Mensagem */}
        <Text style={styles.mensagem} numberOfLines={2}>
          {mensagem}
        </Text>

        {/* Barra de progresso (se tem duração) */}
        {duracao > 0 && (
          <View style={styles.barraProgresso}>
            <Animated.View
              style={[
                styles.barraPreenchida,
                {
                  backgroundColor: config.cor,
                  width: '100%',
                },
              ]}
            />
          </View>
        )}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 50 : 20,
    left: 16,
    right: 16,
    zIndex: 9999,
  },

  toast: {
    backgroundColor: '#1A1A2E',
    borderRadius: 12,
    borderLeftWidth: 4,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
      },
      android: {
        elevation: 8,
      },
    }),
  },

  iconeContainer: {
    width: 40,
    height: 40,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: 40,
  },

  icone: {
    fontSize: 18,
    fontWeight: '700',
  },

  mensagem: {
    flex: 1,
    fontSize: 13,
    color: '#FFFFFF',
    fontWeight: '500',
    lineHeight: 18,
  },

  barraProgresso: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 2,
    backgroundColor: '#2E2E4E',
    borderBottomLeftRadius: 12,
    borderBottomRightRadius: 12,
    overflow: 'hidden',
  },

  barraPreenchida: {
    height: '100%',
  },
});
