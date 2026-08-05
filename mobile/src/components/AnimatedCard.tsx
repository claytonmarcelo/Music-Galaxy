// Card Animado com Efeitos Visuais
// Componente de card com animações de entrada, hover e interação
// Otimizado com memoização

import React, { useRef, useEffect, memo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  ViewStyle,
} from 'react-native';
import { useTheme } from '../contexts/ThemeContext';

interface AnimatedCardProps {
  children: React.ReactNode;
  style?: ViewStyle;
  onPress?: () => void;
  delay?: number;
  animationType?: 'fadeIn' | 'slideUp' | 'scale' | 'rotate';
}

function AnimatedCardComponent({
  children,
  style,
  onPress,
  delay = 0,
  animationType = 'fadeIn',
}: AnimatedCardProps): React.JSX.Element {
  const { colors } = useTheme();
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;
  const scaleAnim = useRef(new Animated.Value(0.8)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;
  const pressScale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const animations = {
      fadeIn: () => {
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 500,
          delay,
          useNativeDriver: false,
        }).start();
      },
      slideUp: () => {
        Animated.parallel([
          Animated.timing(fadeAnim, {
            toValue: 1,
            duration: 500,
            delay,
            useNativeDriver: false,
          }),
          Animated.timing(slideAnim, {
            toValue: 0,
            duration: 500,
            delay,
            useNativeDriver: false,
          }),
        ]).start();
      },
      scale: () => {
        Animated.parallel([
          Animated.timing(fadeAnim, {
            toValue: 1,
            duration: 500,
            delay,
            useNativeDriver: false,
          }),
          Animated.spring(scaleAnim, {
            toValue: 1,
            delay,
            useNativeDriver: false,
          }),
        ]).start();
      },
      rotate: () => {
        Animated.parallel([
          Animated.timing(fadeAnim, {
            toValue: 1,
            duration: 500,
            delay,
            useNativeDriver: false,
          }),
          Animated.timing(rotateAnim, {
            toValue: 1,
            duration: 500,
            delay,
            useNativeDriver: false,
          }),
        ]).start();
      },
    };

    animations[animationType]();
  }, [delay, animationType]);

  const handlePressIn = () => {
    Animated.spring(pressScale, {
      toValue: 0.95,
      useNativeDriver: false,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(pressScale, {
      toValue: 1,
      useNativeDriver: false,
    }).start();
  };

  const getTransform = () => {
    switch (animationType) {
      case 'slideUp':
        return [{ translateY: slideAnim }];
      case 'scale':
        return [{ scale: scaleAnim }];
      case 'rotate':
        return [
          {
            rotate: rotateAnim.interpolate({
              inputRange: [0, 1],
              outputRange: ['-10deg', '0deg'],
            }),
          },
        ];
      default:
        return [];
    }
  };

  const cardContent = (
    <Animated.View
      style={[
        styles.card,
        {
          backgroundColor: colors.card,
          opacity: fadeAnim,
          transform: [...getTransform(), { scale: pressScale }],
        },
        style,
      ]}
    >
      {children}
    </Animated.View>
  );

  if (onPress) {
    return (
      <TouchableOpacity
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        activeOpacity={1}
      >
        {cardContent}
      </TouchableOpacity>
    );
  }

  return cardContent;
}

// Memoizar o componente para evitar re-renders
export default memo(AnimatedCardComponent);

const styles = StyleSheet.create({
  card: {
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
});
