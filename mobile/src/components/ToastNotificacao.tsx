// Toast de notificação — avisos breves no topo da tela.
// Vidro fosco, ícone de linha por tipo e uma barra que mostra o tempo
// restante de exibição. Respeita a área segura do aparelho.

import React, { useCallback, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { USE_NATIVE_DRIVER } from '../utils/animacoes';
import { useTheme } from '../contexts/ThemeContext';
import Icone, { NomeIcone } from './Icone';
import { comAlfa } from '../utils/cores';

export type TipoToast = 'sucesso' | 'erro' | 'aviso' | 'info';

interface Props {
  visivel: boolean;
  tipo: TipoToast;
  mensagem: string;
  duracao?: number; // ms (0 = infinito)
  onFechar?: () => void;
}

// Ícones de linha por tipo de aviso.
const ICONE_TIPO: Record<TipoToast, NomeIcone> = {
  sucesso: 'sucessoCirculo',
  erro: 'erro',
  aviso: 'aviso',
  info: 'info',
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
  const insets = useSafeAreaInsets();

  const deslocamentoAnim = useRef(new Animated.Value(-24)).current;
  const opacidadeAnim = useRef(new Animated.Value(0)).current;
  const progressoAnim = useRef(new Animated.Value(1)).current;

  // Guarda o callback de fechamento em uma ref: assim a animação não depende
  // da identidade da função recebida por prop e não reinicia sozinha.
  const onFecharRef = useRef(onFechar);
  useEffect(() => {
    onFecharRef.current = onFechar;
  }, [onFechar]);

  const fecharToast = useCallback(() => {
    Animated.parallel([
      Animated.timing(deslocamentoAnim, {
        toValue: -24,
        duration: 220,
        useNativeDriver: USE_NATIVE_DRIVER,
      }),
      Animated.timing(opacidadeAnim, {
        toValue: 0,
        duration: 220,
        useNativeDriver: USE_NATIVE_DRIVER,
      }),
    ]).start(() => {
      onFecharRef.current?.();
    });
  }, [deslocamentoAnim, opacidadeAnim]);

  useEffect(() => {
    if (!visivel) return;

    // Entrada suave vinda de cima.
    deslocamentoAnim.setValue(-24);
    Animated.parallel([
      Animated.spring(deslocamentoAnim, {
        toValue: 0,
        useNativeDriver: USE_NATIVE_DRIVER,
        tension: 70,
        friction: 12,
      }),
      Animated.timing(opacidadeAnim, {
        toValue: 1,
        duration: 220,
        useNativeDriver: USE_NATIVE_DRIVER,
      }),
    ]).start();

    // Barra de tempo: some junto com a duração do aviso.
    if (duracao > 0) {
      progressoAnim.setValue(1);
      Animated.timing(progressoAnim, {
        toValue: 0,
        duration: duracao,
        useNativeDriver: false,
      }).start();

      const temporizador = setTimeout(() => {
        fecharToast();
      }, duracao);

      return () => clearTimeout(temporizador);
    }
  }, [visivel, duracao, deslocamentoAnim, opacidadeAnim, progressoAnim, fecharToast]);

  if (!visivel) return <View />;

  const corDestaque = colors[COR_TIPO[tipo]];

  return (
    <Animated.View
      pointerEvents="box-none"
      style={[
        styles.container,
        {
          top: insets.top + 10,
          transform: [{ translateY: deslocamentoAnim }],
          opacity: opacidadeAnim,
        },
      ]}
    >
      <View
        style={[
          styles.toast,
          {
            backgroundColor: colors.glassCardForte,
            borderColor: comAlfa(corDestaque, 0.28),
            shadowColor: colors.glassShadow,
          },
        ]}
      >
        <View
          style={[
            styles.iconeCirculo,
            {
              backgroundColor: comAlfa(corDestaque, 0.16),
              borderColor: comAlfa(corDestaque, 0.32),
            },
          ]}
        >
          <Icone nome={ICONE_TIPO[tipo]} tamanho={18} cor={corDestaque} />
        </View>

        <Text style={[styles.mensagem, { color: colors.text }]} numberOfLines={3}>
          {mensagem}
        </Text>

        {duracao > 0 && (
          <View style={[styles.trilho, { backgroundColor: colors.glassBorder }]}>
            <Animated.View
              style={[
                styles.preenchimento,
                {
                  backgroundColor: corDestaque,
                  width: progressoAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: ['0%', '100%'],
                  }),
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
    left: 16,
    right: 16,
    zIndex: 9999,
  },

  toast: {
    borderRadius: 20,
    borderWidth: 1,
    paddingVertical: 12,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.28,
    shadowRadius: 20,
    elevation: 10,
    overflow: 'hidden',
  },

  iconeCirculo: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },

  mensagem: {
    flex: 1,
    fontSize: 13,
    fontWeight: '500',
    lineHeight: 18,
  },

  trilho: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 2,
  },

  preenchimento: {
    height: '100%',
  },
});
