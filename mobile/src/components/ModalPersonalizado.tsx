// Modal Personalizado — substitui todos os Alert.alert nativos do app.
// Visual de vidro fosco alinhado à identidade Aurora, com animação suave
// de entrada, ícone por tipo de situação e botões estilizados.

import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  Animated,
} from 'react-native';
import { USE_NATIVE_DRIVER } from '../utils/animacoes';
import { useTheme } from '../contexts/ThemeContext';

export type TipoModal = 'sucesso' | 'erro' | 'aviso' | 'info' | 'confirmacao';

export interface BotaoModal {
  texto: string;
  onPress: () => void;
  estilo?: 'primario' | 'secundario' | 'destrutivo';
}

interface Props {
  visivel: boolean;
  tipo: TipoModal;
  titulo: string;
  mensagem: string;
  botoes: BotaoModal[];
  onFechar?: () => void;
  icone?: string;
}

// Ícones por tipo de situação (as cores vêm do tema).
const ICONE_TIPO: Record<TipoModal, string> = {
  sucesso: '✓',
  erro: '✕',
  aviso: '⚠',
  info: 'ℹ',
  confirmacao: '?',
};

// Cada tipo aponta para um token de cor do tema.
type ChaveCor = 'success' | 'error' | 'warning' | 'primary';

const COR_TIPO: Record<TipoModal, ChaveCor> = {
  sucesso: 'success',
  erro: 'error',
  aviso: 'warning',
  info: 'primary',
  confirmacao: 'primary',
};

export default function ModalPersonalizado({
  visivel,
  tipo,
  titulo,
  mensagem,
  botoes,
  onFechar,
  icone,
}: Props): React.JSX.Element {
  const { colors } = useTheme();

  // Animações de entrada
  const scaleAnim = useRef(new Animated.Value(0.7)).current;
  const opacidadeAnim = useRef(new Animated.Value(0)).current;
  const translateYAnim = useRef(new Animated.Value(20)).current;

  useEffect(() => {
    if (visivel) {
      // Inicia animação de entrada
      Animated.parallel([
        Animated.spring(scaleAnim, {
          toValue: 1,
          useNativeDriver: USE_NATIVE_DRIVER,
          tension: 65,
          friction: 11,
        }),
        Animated.timing(opacidadeAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: USE_NATIVE_DRIVER,
        }),
        Animated.timing(translateYAnim, {
          toValue: 0,
          duration: 400,
          useNativeDriver: USE_NATIVE_DRIVER,
        }),
      ]).start();
    } else {
      // Reset para a próxima abertura
      scaleAnim.setValue(0.7);
      opacidadeAnim.setValue(0);
      translateYAnim.setValue(20);
    }
  }, [visivel, scaleAnim, opacidadeAnim, translateYAnim]);

  const corDestaque = colors[COR_TIPO[tipo]];
  const iconeExibicao = icone || ICONE_TIPO[tipo];

  return (
    <Modal
      visible={visivel}
      transparent
      animationType="fade"
      onRequestClose={onFechar}
    >
      {/* Véu escuro translúcido atrás do modal */}
      <View style={[styles.overlay, { backgroundColor: colors.backdrop }]}>
        {/* Container do modal com animações */}
        <Animated.View
          style={[
            styles.containerAnimado,
            {
              transform: [
                { scale: scaleAnim },
                { translateY: translateYAnim },
              ],
              opacity: opacidadeAnim,
            },
          ]}
        >
          {/* Cartão de vidro principal */}
          <View
            style={[
              styles.card,
              {
                backgroundColor: colors.glassCardForte,
                borderColor: colors.glassBorder,
                shadowColor: colors.glassShadow,
              },
            ]}
          >
            {/* Fio de luz na borda superior do vidro */}
            <View
              pointerEvents="none"
              style={[styles.brilho, { backgroundColor: colors.glassHighlight }]}
            />

            {/* Ícone com fundo translúcido do tipo */}
            <View
              style={[
                styles.iconeContainer,
                { backgroundColor: `${corDestaque}22`, borderColor: `${corDestaque}55` },
              ]}
            >
              <Text style={[styles.icone, { color: corDestaque }]}>
                {iconeExibicao}
              </Text>
            </View>

            {/* Título */}
            <Text style={[styles.titulo, { color: colors.text }]}>{titulo}</Text>

            {/* Mensagem */}
            <Text style={[styles.mensagem, { color: colors.textSecondary }]}>
              {mensagem}
            </Text>

            {/* Divisor visual */}
            <View style={[styles.divisor, { backgroundColor: colors.glassBorder }]} />

            {/* Botões */}
            <View style={styles.containerBotoes}>
              {botoes.map((botao, index) => (
                <TouchableOpacity
                  key={index}
                  style={[
                    styles.botao,
                    botao.estilo === 'primario' && [
                      styles.botaoPrimario,
                      { backgroundColor: corDestaque },
                    ],
                    botao.estilo === 'secundario' && [
                      styles.botaoSecundario,
                      {
                        backgroundColor: colors.glassCard,
                        borderColor: colors.glassBorder,
                      },
                    ],
                    botao.estilo === 'destrutivo' && [
                      styles.botaoDestrutivo,
                      {
                        backgroundColor: `${colors.error}22`,
                        borderColor: colors.error,
                      },
                    ],
                    botoes.length > 1 && index === 0 && { marginRight: 8 },
                  ]}
                  onPress={() => {
                    botao.onPress();
                    onFechar?.();
                  }}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      styles.textoBotao,
                      { color: colors.buttonText },
                      botao.estilo === 'secundario' && { color: colors.text },
                      botao.estilo === 'destrutivo' && { color: colors.error },
                    ]}
                  >
                    {botao.texto}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },

  containerAnimado: {
    width: '85%',
    maxWidth: 380,
  },

  card: {
    borderRadius: 24,
    borderWidth: 1,
    padding: 24,
    overflow: 'hidden',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 12,
  },

  brilho: {
    position: 'absolute',
    top: 0,
    left: 24,
    right: 24,
    height: 1.5,
    borderRadius: 2,
    opacity: 0.6,
  },

  iconeContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'center',
    marginBottom: 16,
  },

  icone: {
    fontSize: 36,
    fontWeight: '700',
  },

  titulo: {
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 8,
  },

  mensagem: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 16,
  },

  divisor: {
    height: 1,
    marginBottom: 16,
  },

  containerBotoes: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },

  botao: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    minWidth: 100,
    justifyContent: 'center',
    alignItems: 'center',
    flex: 1,
  },

  botaoPrimario: {},

  botaoSecundario: {
    borderWidth: 1,
  },

  botaoDestrutivo: {
    borderWidth: 1,
  },

  textoBotao: {
    fontSize: 13,
    fontWeight: '700',
  },
});
