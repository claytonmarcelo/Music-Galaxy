// Modal Personalizado Premium - Substitui todos os Alerts nativos
// Design gourmet com animações suaves, botões estilizados e icones coerentes

import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  Platform,
  Animated,
  Dimensions,
} from 'react-native';

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

// Configuração de cores e ícones por tipo
const CONFIGURACAO_TIPO: Record<TipoModal, {
  cor: string;
  icone: string;
  corFundo: string;
}> = {
  sucesso: {
    cor: '#1DB954',
    icone: '✓',
    corFundo: '#1DB95420',
  },
  erro: {
    cor: '#FF6B35',
    icone: '✕',
    corFundo: '#FF6B3520',
  },
  aviso: {
    cor: '#FFB627',
    icone: '⚠',
    corFundo: '#FFB62720',
  },
  info: {
    cor: '#00D9FF',
    icone: 'ℹ',
    corFundo: '#00D9FF20',
  },
  confirmacao: {
    cor: '#1DB954',
    icone: '?',
    corFundo: '#1DB95420',
  },
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
  // Animações
  const scaleAnim = useRef(new Animated.Value(0.7)).current;
  const opacidadeAnim = useRef(new Animated.Value(0)).current;
  const translateYAnim = useRef(new Animated.Value(20)).current;

  useEffect(() => {
    if (visivel) {
      // Inicia animação de entrada
      Animated.parallel([
        Animated.spring(scaleAnim, {
          toValue: 1,
          useNativeDriver: true,
          tension: 65,
          friction: 11,
        }),
        Animated.timing(opacidadeAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(translateYAnim, {
          toValue: 0,
          duration: 400,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      // Reset para próxima abertura
      scaleAnim.setValue(0.7);
      opacidadeAnim.setValue(0);
      translateYAnim.setValue(20);
    }
  }, [visivel, scaleAnim, opacidadeAnim, translateYAnim]);

  const config = CONFIGURACAO_TIPO[tipo];
  const iconeExibicao = icone || config.icone;

  return (
    <Modal
      visible={visivel}
      transparent
      animationType="fade"
      onRequestClose={onFechar}
    >
      {/* Fundo escuro com blur effect */}
      <View style={styles.overlay}>
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
          {/* Card principal */}
          <View style={styles.card}>
            {/* Ícone com animação de pulsação */}
            <Animated.View
              style={[
                styles.iconeContainer,
                { backgroundColor: config.corFundo },
              ]}
            >
              <Text style={[styles.icone, { color: config.cor }]}>
                {iconeExibicao}
              </Text>
            </Animated.View>

            {/* Título */}
            <Text style={styles.titulo}>{titulo}</Text>

            {/* Mensagem */}
            <Text style={styles.mensagem}>{mensagem}</Text>

            {/* Divisor visual */}
            <View style={styles.divisor} />

            {/* Botões */}
            <View style={styles.containerBotoes}>
              {botoes.map((botao, index) => (
                <TouchableOpacity
                  key={index}
                  style={[
                    styles.botao,
                    botao.estilo === 'primario' && [
                      styles.botaoPrimario,
                      { backgroundColor: config.cor },
                    ],
                    botao.estilo === 'secundario' && styles.botaoSecundario,
                    botao.estilo === 'destrutivo' && styles.botaoDestrutivo,
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
                      styles.textoBorao,
                      botao.estilo === 'primario' && styles.textoBotaoPrimario,
                      botao.estilo === 'destrutivo' &&
                        styles.textoBotaoDestrutivo,
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
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },

  containerAnimado: {
    width: '85%',
    maxWidth: 380,
  },

  card: {
    backgroundColor: '#1A1A2E',
    borderRadius: 20,
    padding: 24,
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.3,
        shadowRadius: 20,
      },
      android: {
        elevation: 12,
      },
    }),
  },

  iconeContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
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
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 8,
  },

  mensagem: {
    fontSize: 14,
    color: '#AAAAAA',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 16,
  },

  divisor: {
    height: 1,
    backgroundColor: '#2E2E4E',
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
    borderRadius: 10,
    minWidth: 100,
    justifyContent: 'center',
    alignItems: 'center',
    flex: 1,
  },

  botaoPrimario: {
    backgroundColor: '#1DB954',
  },

  botaoSecundario: {
    backgroundColor: '#2E2E4E',
    borderWidth: 1,
    borderColor: '#3E3E5E',
  },

  botaoDestrutivo: {
    backgroundColor: '#FF6B3520',
    borderWidth: 1,
    borderColor: '#FF6B35',
  },

  textoBorao: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },

  textoBotaoPrimario: {
    color: '#FFFFFF',
  },

  textoBotaoDestrutivo: {
    color: '#FF6B35',
  },
});
