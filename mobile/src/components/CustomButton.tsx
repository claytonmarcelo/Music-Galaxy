// Botão personalizado em formato de pílula.
// Primário em marfim (tema escuro) ou vinho (tema claro), secundário em
// vidro e variantes discretas. Sempre com ícone de linha opcional.

import React from 'react';
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  ViewStyle,
  TextStyle,
  Animated,
  ActivityIndicator,
} from 'react-native';
import { USE_NATIVE_DRIVER } from '../utils/animacoes';
import { useTheme } from '../contexts/ThemeContext';
import Icone, { NomeIcone } from './Icone';

interface CustomButtonProps {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost';
  size?: 'small' | 'medium' | 'large';
  disabled?: boolean;
  loading?: boolean;
  icone?: NomeIcone;
  iconeDireita?: boolean;
  style?: ViewStyle;
  textStyle?: TextStyle;
}

export default function CustomButton({
  title,
  onPress,
  variant = 'primary',
  size = 'medium',
  disabled = false,
  loading = false,
  icone,
  iconeDireita = false,
  style,
  textStyle,
}: CustomButtonProps): React.JSX.Element {
  const { colors } = useTheme();
  const escalaAnim = React.useRef(new Animated.Value(1)).current;

  const aoPressionar = () => {
    Animated.spring(escalaAnim, {
      toValue: 0.97,
      useNativeDriver: USE_NATIVE_DRIVER,
    }).start();
  };

  const aoSoltar = () => {
    Animated.spring(escalaAnim, {
      toValue: 1,
      useNativeDriver: USE_NATIVE_DRIVER,
    }).start();
  };

  const corTexto =
    variant === 'primary'
      ? colors.buttonText
      : variant === 'ghost' || variant === 'outline'
        ? colors.primary
        : colors.text;

  const corIcone =
    variant === 'primary' ? colors.buttonText : variant === 'secondary' ? colors.text : colors.primary;

  const getEstiloBotao = (): ViewStyle => {
    const tamanhos: Record<typeof size, ViewStyle> = {
      small: { paddingHorizontal: 16, minHeight: 36 },
      medium: { paddingHorizontal: 20, minHeight: 46 },
      large: { paddingHorizontal: 26, minHeight: 54 },
    };

    const variantes: Record<typeof variant, ViewStyle> = {
      primary: {
        backgroundColor: colors.button,
        shadowColor: colors.glassShadow,
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.28,
        shadowRadius: 12,
        elevation: 5,
      },
      secondary: {
        backgroundColor: colors.glassCard,
        borderWidth: 1,
        borderColor: colors.glassBorder,
      },
      outline: {
        backgroundColor: 'transparent',
        borderWidth: 1,
        borderColor: colors.glassBorder,
      },
      ghost: { backgroundColor: 'transparent' },
    };

    return {
      borderRadius: 999,
      justifyContent: 'center',
      alignItems: 'center',
      flexDirection: 'row',
      ...tamanhos[size],
      ...variantes[variant],
      opacity: disabled ? 0.45 : 1,
    };
  };

  const tamanhoFonte = size === 'small' ? 12 : size === 'large' ? 16 : 14;
  const tamanhoIcone = size === 'small' ? 14 : size === 'large' ? 19 : 17;

  return (
    <Animated.View style={{ transform: [{ scale: escalaAnim }] }}>
      <TouchableOpacity
        style={[getEstiloBotao(), style]}
        onPress={onPress}
        onPressIn={aoPressionar}
        onPressOut={aoSoltar}
        disabled={disabled || loading}
        activeOpacity={0.85}
        accessibilityRole="button"
        accessibilityLabel={title}
      >
        {loading ? (
          <ActivityIndicator color={corTexto} size="small" />
        ) : (
          <>
            {icone && !iconeDireita && (
              <Icone
                nome={icone}
                tamanho={tamanhoIcone}
                cor={corIcone}
                estilo={styles.iconeEsquerda}
              />
            )}
            <Text
              style={[
                styles.texto,
                { color: corTexto, fontSize: tamanhoFonte },
                textStyle,
              ]}
            >
              {title}
            </Text>
            {icone && iconeDireita && (
              <Icone
                nome={icone}
                tamanho={tamanhoIcone}
                cor={corIcone}
                estilo={styles.iconeDireita}
              />
            )}
          </>
        )}
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  texto: {
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  iconeEsquerda: {
    marginRight: 8,
  },
  iconeDireita: {
    marginLeft: 8,
  },
});
