// Modal personalizado — substitui todas as caixas nativas do sistema.
// Vidro fosco, ícone de linha por tipo de situação e botões em pílula
// coerentes com o restante do aplicativo. As cores vêm do tema.

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
import Icone, { NomeIcone } from './Icone';
import { comAlfa } from '../utils/cores';

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
}

// Ícones de linha por tipo de situação.
const ICONE_TIPO: Record<TipoModal, NomeIcone> = {
  sucesso: 'sucessoCirculo',
  erro: 'erro',
  aviso: 'aviso',
  info: 'info',
  confirmacao: 'ajuda',
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
}: Props): React.JSX.Element {
  const { colors } = useTheme();

  // Animações de entrada: o cartão cresce suavemente a partir do centro.
  const escalaAnim = useRef(new Animated.Value(0.92)).current;
  const opacidadeAnim = useRef(new Animated.Value(0)).current;
  const deslocamentoAnim = useRef(new Animated.Value(16)).current;

  useEffect(() => {
    if (visivel) {
      Animated.parallel([
        Animated.spring(escalaAnim, {
          toValue: 1,
          useNativeDriver: USE_NATIVE_DRIVER,
          tension: 70,
          friction: 12,
        }),
        Animated.timing(opacidadeAnim, {
          toValue: 1,
          duration: 220,
          useNativeDriver: USE_NATIVE_DRIVER,
        }),
        Animated.timing(deslocamentoAnim, {
          toValue: 0,
          duration: 260,
          useNativeDriver: USE_NATIVE_DRIVER,
        }),
      ]).start();
    } else {
      escalaAnim.setValue(0.92);
      opacidadeAnim.setValue(0);
      deslocamentoAnim.setValue(16);
    }
  }, [visivel, escalaAnim, opacidadeAnim, deslocamentoAnim]);

  const corDestaque = colors[COR_TIPO[tipo]];

  return (
    <Modal
      visible={visivel}
      transparent
      animationType="fade"
      onRequestClose={onFechar}
      statusBarTranslucent
    >
      {/* Véu escuro atrás do cartão */}
      <View style={[styles.veu, { backgroundColor: colors.backdrop }]}>
        <Animated.View
          style={[
            styles.containerAnimado,
            {
              opacity: opacidadeAnim,
              transform: [
                { scale: escalaAnim },
                { translateY: deslocamentoAnim },
              ],
            },
          ]}
        >
          <View
            style={[
              styles.cartao,
              {
                backgroundColor: colors.glassCardForte,
                borderColor: colors.glassBorder,
                shadowColor: colors.glassShadow,
              },
            ]}
          >
            {/* Fio de luz na borda superior */}
            <View
              pointerEvents="none"
              style={[styles.brilho, { backgroundColor: colors.glassHighlight }]}
            />

            {/* Ícone com halo translúcido do tipo */}
            <View
              style={[
                styles.iconeCirculo,
                {
                  backgroundColor: comAlfa(corDestaque, 0.14),
                  borderColor: comAlfa(corDestaque, 0.34),
                },
              ]}
            >
              <Icone nome={ICONE_TIPO[tipo]} tamanho={30} cor={corDestaque} />
            </View>

            <Text style={[styles.titulo, { color: colors.text }]}>{titulo}</Text>

            <Text style={[styles.mensagem, { color: colors.textSecondary }]}>
              {mensagem}
            </Text>

            <View style={[styles.divisor, { backgroundColor: colors.glassBorder }]} />

            <View style={styles.containerBotoes}>
              {botoes.map((botao, indice) => {
                const destrutivo = botao.estilo === 'destrutivo';
                const secundario = botao.estilo === 'secundario';

                return (
                  <TouchableOpacity
                    key={`${botao.texto}-${indice}`}
                    style={[
                      styles.botao,
                      {
                        backgroundColor: destrutivo
                          ? comAlfa(colors.error, 0.14)
                          : secundario
                            ? colors.glassCard
                            : colors.button,
                        borderColor: destrutivo
                          ? comAlfa(colors.error, 0.4)
                          : secundario
                            ? colors.glassBorder
                            : 'transparent',
                        borderWidth: secundario || destrutivo ? 1 : 0,
                      },
                    ]}
                    onPress={() => {
                      botao.onPress();
                      onFechar?.();
                    }}
                    activeOpacity={0.82}
                    accessibilityRole="button"
                    accessibilityLabel={botao.texto}
                  >
                    <Text
                      style={[
                        styles.textoBotao,
                        {
                          color: destrutivo
                            ? colors.error
                            : secundario
                              ? colors.text
                              : colors.buttonText,
                        },
                      ]}
                    >
                      {botao.texto}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  veu: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },

  containerAnimado: {
    width: '100%',
    maxWidth: 372,
  },

  cartao: {
    borderRadius: 28,
    borderWidth: 1,
    paddingHorizontal: 24,
    paddingTop: 26,
    paddingBottom: 22,
    overflow: 'hidden',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.32,
    shadowRadius: 28,
    elevation: 16,
  },

  brilho: {
    position: 'absolute',
    top: 0,
    left: 26,
    right: 26,
    height: 1,
    opacity: 0.7,
  },

  iconeCirculo: {
    width: 62,
    height: 62,
    borderRadius: 31,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'center',
    marginBottom: 18,
  },

  titulo: {
    fontSize: 19,
    fontWeight: '700',
    letterSpacing: 0.2,
    textAlign: 'center',
    marginBottom: 8,
  },

  mensagem: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 21,
    marginBottom: 20,
  },

  divisor: {
    height: 1,
    marginBottom: 18,
  },

  containerBotoes: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 10,
  },

  botao: {
    flex: 1,
    minHeight: 48,
    paddingHorizontal: 16,
    borderRadius: 999,
    justifyContent: 'center',
    alignItems: 'center',
  },

  textoBotao: {
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
});
