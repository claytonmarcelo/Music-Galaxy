// Tela de boas-vindas do Music Galaxy.
// Abertura do aplicativo com o mascote animado, o nome do projeto e uma
// frase curta sobre a proposta. Fica visível por 3 segundos e entrega o
// lugar para o fluxo de navegação, com um botão "Pular" para quem já sabe
// usar o aplicativo. O movimento respeita a preferência do sistema por
// animações reduzidas.

import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  Animated,
  AccessibilityInfo,
  TouchableOpacity,
  Easing,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../contexts/ThemeContext';
import { comAlfa } from '../utils/cores';
import { TIMINGS, USE_NATIVE_DRIVER } from '../utils/animacoes';
import Icone from '../components/Icone';
import FundoAtmosfera from '../components/FundoAtmosfera';

// Mascote do Music Galaxy — robô DJ com fones e vinil.
const MASCOTE = require('../../assets/mascote.png');

// Duração da apresentação antes de seguir para o aplicativo.
const DURACAO_MS = 3000;

// Intervalo entre o preenchimento de cada ponto do indicador.
const INTERVALO_PONTO_MS = DURACAO_MS / 3;

interface Props {
  onConcluir: () => void;
}

export default function TelaBoasVindas({ onConcluir }: Props): React.JSX.Element {
  const { colors } = useTheme();

  // Animações do mascote (flutuação) e da entrada do conteúdo.
  const flutuarAnim = useRef(new Animated.Value(0)).current;
  const escalaAnim = useRef(new Animated.Value(0)).current;
  const opacidadeTextoAnim = useRef(new Animated.Value(0)).current;

  // Quantidade de pontos já preenchidos no indicador de progresso.
  const [pontoAtivo, setPontoAtivo] = useState(0);

  // Quando o sistema pede menos movimento, o mascote aparece parado.
  const [movimentoReduzido, setMovimentoReduzido] = useState(false);

  // Encerramento automático: três segundos depois a tela se fecha.
  useEffect(() => {
    const timer = setTimeout(onConcluir, DURACAO_MS);
    return () => clearTimeout(timer);
  }, [onConcluir]);

  // Acompanha a preferência de animação reduzida do sistema.
  useEffect(() => {
    let ativo = true;

    void AccessibilityInfo.isReduceMotionEnabled().then((reduzido) => {
      if (ativo) setMovimentoReduzido(reduzido);
    });

    const assinatura = AccessibilityInfo.addEventListener(
      'reduceMotionChanged',
      (reduzido) => setMovimentoReduzido(reduzido)
    );

    return () => {
      ativo = false;
      assinatura.remove();
    };
  }, []);

  // Flutuação contínua do mascote (suspensa quando o movimento é reduzido).
  useEffect(() => {
    if (movimentoReduzido) {
      flutuarAnim.setValue(0);
      return;
    }

    const animacao = Animated.loop(
      Animated.sequence([
        Animated.timing(flutuarAnim, {
          toValue: 1,
          duration: 1400,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: USE_NATIVE_DRIVER,
        }),
        Animated.timing(flutuarAnim, {
          toValue: 0,
          duration: 1400,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: USE_NATIVE_DRIVER,
        }),
      ])
    );

    animacao.start();
    return () => animacao.stop();
  }, [flutuarAnim, movimentoReduzido]);

  // Entrada do conteúdo: mascote cresce e o texto aparece em seguida.
  useEffect(() => {
    Animated.sequence([
      Animated.spring(escalaAnim, {
        toValue: 1,
        tension: 60,
        friction: 11,
        useNativeDriver: USE_NATIVE_DRIVER,
      }),
      Animated.timing(opacidadeTextoAnim, {
        toValue: 1,
        duration: TIMINGS.normal,
        useNativeDriver: USE_NATIVE_DRIVER,
      }),
    ]).start();
  }, [escalaAnim, opacidadeTextoAnim]);

  // Preenche os pontos do indicador no ritmo da contagem de três segundos.
  useEffect(() => {
    const timers = [
      setTimeout(() => setPontoAtivo(1), INTERVALO_PONTO_MS),
      setTimeout(() => setPontoAtivo(2), INTERVALO_PONTO_MS * 2),
      setTimeout(() => setPontoAtivo(3), INTERVALO_PONTO_MS * 3),
    ];
    return () => timers.forEach((timer) => clearTimeout(timer));
  }, []);

  // Deslocamento vertical do mascote, derivado da animação de flutuação.
  const deslocamentoY = flutuarAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [-7, 7],
  });

  return (
    <FundoAtmosfera>
      <View style={styles.container}>
        <SafeAreaView style={styles.conteudo} edges={['top', 'bottom', 'left', 'right']}>
          <Animated.View
            style={[
              styles.mascoteMoldura,
              {
                backgroundColor: colors.glassCard,
                borderColor: colors.glassBorder,
                shadowColor: colors.glassShadow,
                opacity: escalaAnim,
                transform: [
                  { scale: escalaAnim },
                  { translateY: deslocamentoY },
                ],
              },
            ]}
          >
            <Image
              source={MASCOTE}
              style={styles.mascote}
              resizeMode="cover"
              accessibilityLabel="Mascote do Music Galaxy segurando um disco de vinil"
            />
          </Animated.View>

          <Animated.View style={[styles.textos, { opacity: opacidadeTextoAnim }]}>
            <View style={styles.etiquetaBloco}>
              <View style={[styles.ponto, { backgroundColor: colors.primary }]} />
              <Text style={[styles.etiqueta, { color: colors.textSecondary }]}>
                BEM-VINDO
              </Text>
            </View>

            <Text style={[styles.titulo, { color: colors.text }]}>Music Galaxy</Text>

            <Text style={[styles.subtitulo, { color: colors.textSecondary }]}>
              Todas as versões de uma obra, com o áudio das fontes abertas da web.
            </Text>
          </Animated.View>

          <Animated.View style={[styles.rodape, { opacity: opacidadeTextoAnim }]}>
            <View style={styles.pontos}>
              {[1, 2, 3].map((numero) => (
                <View
                  key={numero}
                  style={[
                    styles.pontoProgresso,
                    {
                      backgroundColor:
                        numero <= pontoAtivo ? colors.primary : comAlfa(colors.textSecondary, 0.25),
                    },
                  ]}
                />
              ))}
            </View>

            <TouchableOpacity
              onPress={onConcluir}
              activeOpacity={0.75}
              accessibilityRole="button"
              accessibilityLabel="Pular a apresentação e abrir o aplicativo"
              style={styles.pular}
            >
              <Icone nome="avancar" tamanho={14} cor={colors.textSecondary} />
              <Text style={[styles.pularTexto, { color: colors.textSecondary }]}>Pular</Text>
            </TouchableOpacity>
          </Animated.View>
        </SafeAreaView>
      </View>
    </FundoAtmosfera>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  conteudo: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  mascoteMoldura: {
    width: 168,
    height: 168,
    borderRadius: 56,
    borderWidth: 1,
    overflow: 'hidden',
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.3,
    shadowRadius: 26,
    elevation: 12,
  },
  mascote: {
    width: '100%',
    height: '100%',
  },
  textos: {
    alignItems: 'center',
    marginTop: 28,
  },
  etiquetaBloco: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  ponto: {
    width: 5,
    height: 5,
    borderRadius: 3,
  },
  etiqueta: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 2.4,
  },
  titulo: {
    fontSize: 32,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  subtitulo: {
    fontSize: 13.5,
    lineHeight: 20,
    textAlign: 'center',
    marginTop: 10,
    maxWidth: 300,
  },
  rodape: {
    position: 'absolute',
    bottom: 26,
    alignItems: 'center',
    gap: 14,
  },
  pontos: {
    flexDirection: 'row',
    gap: 7,
  },
  pontoProgresso: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  pular: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
  },
  pularTexto: {
    fontSize: 11.5,
    fontWeight: '600',
  },
});
