// BottomSheet Premium - Componente reutilizável para menus e filtros
// Slide up animation elegante com backdrop blur effect

import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  Modal,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Dimensions,
  Platform,
} from 'react-native';

interface Props {
  visivel: boolean;
  titulo: string;
  descricao?: string;
  onFechar: () => void;
  children: React.ReactNode;
  altura?: number; // height da sheet (padrão: 60% da tela)
}

const { height: screenHeight } = Dimensions.get('window');

export default function BottomSheet({
  visivel,
  titulo,
  descricao,
  onFechar,
  children,
  altura = screenHeight * 0.6,
}: Props): React.JSX.Element {
  // Animações
  const translateYAnim = useRef(new Animated.Value(altura)).current;
  const opacidadeBackdropAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visivel) {
      // Anima entrada
      Animated.parallel([
        Animated.spring(translateYAnim, {
          toValue: 0,
          useNativeDriver: true,
          tension: 65,
          friction: 11,
        }),
        Animated.timing(opacidadeBackdropAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      // Reset
      translateYAnim.setValue(altura);
      opacidadeBackdropAnim.setValue(0);
    }
  }, [visivel, altura, translateYAnim, opacidadeBackdropAnim]);

  const handleBackdropPress = () => {
    // Anima saída
    Animated.parallel([
      Animated.spring(translateYAnim, {
        toValue: altura,
        useNativeDriver: true,
        tension: 65,
        friction: 11,
      }),
      Animated.timing(opacidadeBackdropAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start(() => {
      onFechar();
    });
  };

  return (
    <Modal
      visible={visivel}
      transparent
      animationType="none"
      onRequestClose={handleBackdropPress}
    >
      {/* Backdrop com fade */}
      <Animated.View
        style={[
          styles.backdrop,
          {
            opacity: opacidadeBackdropAnim,
          },
        ]}
      >
        <TouchableOpacity
          style={styles.backdropTouchable}
          onPress={handleBackdropPress}
          activeOpacity={1}
        />
      </Animated.View>

      {/* Sheet animada */}
      <Animated.View
        style={[
          styles.sheet,
          {
            height: altura,
            transform: [{ translateY: translateYAnim }],
          },
        ]}
      >
        {/* Handle indicador */}
        <View style={styles.handleContainer}>
          <View style={styles.handle} />
        </View>

        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerContent}>
            <Text style={styles.titulo}>{titulo}</Text>
            {descricao && <Text style={styles.descricao}>{descricao}</Text>}
          </View>
          <TouchableOpacity
            onPress={handleBackdropPress}
            activeOpacity={0.7}
            style={styles.botaoFechar}
          >
            <Text style={styles.botaoFecharTexto}>✕</Text>
          </TouchableOpacity>
        </View>

        {/* Divider */}
        <View style={styles.divider} />

        {/* Conteúdo */}
        <View style={styles.conteudo}>
          {children}
        </View>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },

  backdropTouchable: {
    flex: 1,
  },

  sheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#12121F',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.3,
        shadowRadius: 12,
      },
      android: {
        elevation: 12,
      },
    }),
  },

  handleContainer: {
    alignItems: 'center',
    paddingVertical: 12,
  },

  handle: {
    width: 40,
    height: 4,
    backgroundColor: '#2A2A4A',
    borderRadius: 2,
  },

  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },

  headerContent: {
    flex: 1,
    marginRight: 12,
  },

  titulo: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 4,
  },

  descricao: {
    fontSize: 13,
    color: '#8080A0',
    fontWeight: '500',
  },

  botaoFechar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#1A1A2E',
    alignItems: 'center',
    justifyContent: 'center',
  },

  botaoFecharTexto: {
    fontSize: 18,
    color: '#8080A0',
    fontWeight: '600',
  },

  divider: {
    height: 1,
    backgroundColor: '#1A1A2E',
    marginHorizontal: 20,
  },

  conteudo: {
    flex: 1,
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
});
