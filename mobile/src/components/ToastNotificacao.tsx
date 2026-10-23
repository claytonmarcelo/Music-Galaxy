// Toast de notificação — avisos elegantes no topo da tela.
// Visual de vidro fosco alinhado à identidade Aurora, com animação de
// entrada/saída e barra de progresso indicando o tempo de exibição.

import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Platform,
} from 'react-native';
import { USE_NATIVE_DRIVER } from '../utils/animacoes';
import { useTheme } from '../contexts/ThemeContext';

export type TipoToast = 'sucesso' | 'erro' | 'aviso' | 'info';

interface Props {
  visivel: boolean;
  tipo: TipoToast;
  mensagem: string;
  duracao?: number; // ms (0 = infinito)
  onFechar?: () => void;
}

// Ícones por tipo (as cores vêm do tema).
const ICONE_TIPO: Record<TipoToast, string> = {
  sucesso: '✓',
  erro: '✕',
  aviso: '⚠',
  info: 'ℹ',
};

// Cada tipo aponta para um token de cor do tema.
type ChaveCor = 'success' | 'error' | 'warning' | 'primary';

const COR_TIPO: Record<TipoToast, ChaveCor> = {
  sucesso: 'success',
  erro: 'error',
  aviso: 'warning',
  info: 'primary',
};

export default function ToastNotificacao({
  visivel,
  tipo,
  mensagem,
  duracao = 3000,
  onFechar,
}: Props): React.JSX.Element {
  const { colors } = useTheme();
  const translateYAnim = useRef(new Animated.Value(-100)).current;
  const opacidadeAnim = useRef(new Animated.Value(0)).current;

  const fecharToast = () => {
    Animated.parallel([
      Animated.timing(translateYAnim, {
        toValue: -100,
        duration: 300,
        useNativeDriver: USE_NATIVE_DRIVER,
      }),
      Animated.timing(opacidadeAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: USE_NATIVE_DRIVER,
      }),
    ]).start(() => {
      onFechar?.();
    });
  };

  useEffect(() => {
    if (visivel) {
      // Animação de entrada
      Animated.parallel([
        Animated.spring(translateYAnim, {
          toValue: 0,
          useNativeDriver: USE_NATIVE_DRIVER,
          tension: 65,
          friction: 11,
        }),
        Animated.timing(opacidadeAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: USE_NATIVE_DRIVER,
        }),
      ]).start();

      // Auto-fechar se a duração for maior que zero
      if (duracao > 0) {
        const timeout = setTimeout(() => {
          fecharToast();
        }, duracao);

        return () => clearTimeout(timeout);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visivel, duracao, translateYAnim, opacidadeAnim]);

  if (!visivel) return <View />;

  const corDestaque = colors[COR_TIPO[tipo]];

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
      <View
        style={[
          styles.toast,
          {
            backgroundColor: colors.glassCardForte,
            borderLeftColor: corDestaque,
            borderColor: colors.glassBorder,
            shadowColor: colors.glassShadow,
          },
        ]}
      >
        {/* Ícone */}
        <View style={[styles.iconeContainer, { backgroundColor: `${corDestaque}22` }]}>
          <Text style={[styles.icone, { color: corDestaque }]}>
            {ICONE_TIPO[tipo]}
          </Text>
        </View>

        {/* Mensagem */}
        <Text style={[styles.mensagem, { color: colors.text }]} numberOfLines={2}>
          {mensagem}
        </Text>

        {/* Barra de progresso (se tem duração) */}
        {duracao > 0 && (
          <View style={[styles.barraProgresso, { backgroundColor: colors.glassBorder }]}>
            <Animated.View
              style={[
                styles.barraPreenchida,
                {
                  backgroundColor: corDestaque,
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
    borderRadius: 16,
    borderWidth: 1,
    borderLeftWidth: 4,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
    overflow: 'hidden',
  },

  iconeContainer: {
    width: 40,
    height: 40,
    borderRadius: 12,
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
    fontWeight: '500',
    lineHeight: 18,
  },

  barraProgresso: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 2,
  },

  barraPreenchida: {
    height: '100%',
  },
});
