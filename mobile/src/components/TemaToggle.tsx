// Componente Toggle para Trocar Tema com Animação
// Permite ao usuário alternar entre tema claro e escuro de forma elegante

import React, { useRef, useEffect } from 'react';
import {
  TouchableOpacity,
  StyleSheet,
  Platform,
  Animated,
} from 'react-native';
import { useTema } from '../contexts/TemaContext';
import { TIMINGS, EASING } from '../utils/animacoes';

interface Props {
  tamanho?: 'pequeno' | 'medio' | 'grande';
  estilo?: 'simples' | 'premium';
  aoMudar?: () => void;
}

export default function TemaToggle({
  tamanho = 'medio',
  estilo = 'premium',
  aoMudar,
}: Props): React.JSX.Element {
  const { tema, alternarTema } = useTema();

  // Animações
  const rotacaoAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const rotacaoRef = useRef(0);

  // Anima ícone ao clicar
  const animarClique = () => {
    Animated.sequence([
      Animated.spring(scaleAnim, {
        toValue: 0.85,
        useNativeDriver: true,
        ...EASING.suave,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        useNativeDriver: true,
        ...EASING.suave,
      }),
    ]).start();

    // Rotaciona o ícone
    rotacaoRef.current = (rotacaoRef.current + 180) % 360;
    Animated.timing(rotacaoAnim, {
      toValue: rotacaoRef.current,
      duration: TIMINGS.normal,
      useNativeDriver: true,
    }).start();
  };

  const handlePress = async () => {
    animarClique();
    await alternarTema();
    aoMudar?.();
  };

  // Tamanhos do botão
  const tamanhos = {
    pequeno: 36,
    medio: 44,
    grande: 56,
  };

  const tamanhoAtual = tamanhos[tamanho];

  // Icone do tema
  const icone = tema === 'dark' ? '☀️' : '🌙';

  // Estilo simples (apenas ícone)
  if (estilo === 'simples') {
    return (
      <Animated.View
        style={{
          transform: [
            { scale: scaleAnim },
            { rotateZ: rotacaoAnim },
          ],
        }}
      >
        <TouchableOpacity
          style={[
            styles.botaoSimples,
            { width: tamanhoAtual, height: tamanhoAtual },
          ]}
          onPress={handlePress}
          activeOpacity={0.7}
          accessibilityLabel={`Trocar para tema ${tema === 'dark' ? 'claro' : 'escuro'}`}
        >
          <Animated.Text
            style={[
              styles.icone,
              {
                transform: [{ rotateZ: rotacaoAnim }],
              },
            ]}
          >
            {icone}
          </Animated.Text>
        </TouchableOpacity>
      </Animated.View>
    );
  }

  // Estilo premium (com background)
  return (
    <Animated.View
      style={{
        transform: [{ scale: scaleAnim }],
      }}
    >
      <TouchableOpacity
        style={[
          styles.botaoPremium,
          { width: tamanhoAtual, height: tamanhoAtual },
        ]}
        onPress={handlePress}
        activeOpacity={0.7}
        accessibilityLabel={`Trocar para tema ${tema === 'dark' ? 'claro' : 'escuro'}`}
      >
        <Animated.Text
          style={[
            styles.iconePremium,
            {
              fontSize: tamanhoAtual * 0.5,
              transform: [{ rotateZ: rotacaoAnim }],
            },
          ]}
        >
          {icone}
        </Animated.Text>
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  botaoSimples: {
    justifyContent: 'center',
    alignItems: 'center',
  },

  botaoPremium: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#1A1A2E',
    borderRadius: 22,
    borderWidth: 1,
    borderColor: '#2A2A4A',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 4,
      },
      android: {
        elevation: 3,
      },
    }),
  },

  icone: {
    fontSize: 20,
  },

  iconePremium: {
    fontWeight: '700',
  },
});
