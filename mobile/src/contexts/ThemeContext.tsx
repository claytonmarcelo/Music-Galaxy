// Contexto de Tema - Dark/Light
// Gerencia o tema do aplicativo com persistência no AsyncStorage.
// A partir da identidade visual Aurora, o tema ganhou tokens de vidro fosco
// (glass) e de luzes da aurora. As chaves antigas foram mantidas para que
// nenhuma tela existente quebre.

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useColorScheme } from 'react-native';

// Definição dos temas
type Theme = 'light' | 'dark' | 'auto';

interface ThemeColors {
  // Chaves clássicas (compatibilidade)
  background: string;
  card: string;
  text: string;
  textSecondary: string;
  primary: string;
  secondary: string;
  accent: string;
  border: string;
  success: string;
  error: string;
  warning: string;
  input: string;
  button: string;
  buttonText: string;
  icon: string;
  overlay: string;
  // Tokens de vidro fosco (identidade Aurora)
  glassCard: string;        // fundo translúcido de cartões
  glassCardForte: string;   // vidro mais opaco (modais, navegação, player)
  glassBorder: string;      // contorno sutil de vidro
  glassHighlight: string;   // brilho superior do vidro
  glassShadow: string;      // cor da sombra projetada
  backdrop: string;         // véu escuro atrás dos modais
  // Luzes da aurora
  auroraPrimaria: string;   // violeta
  auroraSecundaria: string; // ciano
  auroraTerciaria: string;  // rosa
  auroraQuaternaria: string;// verde
}

const lightTheme: ThemeColors = {
  // Chaves clássicas
  background: '#F5F6FB',
  card: '#FFFFFF',
  text: '#14142B',
  textSecondary: '#5A5C77',
  primary: '#6D28D9',
  secondary: '#1F2937',
  accent: '#EDE9FE',
  border: '#E4E4F0',
  success: '#16A34A',
  error: '#DC2626',
  warning: '#D97706',
  input: '#F0F0F6',
  button: '#6D28D9',
  buttonText: '#FFFFFF',
  icon: '#14142B',
  overlay: 'rgba(20, 20, 43, 0.35)',
  // Vidro fosco
  glassCard: 'rgba(255, 255, 255, 0.55)',
  glassCardForte: 'rgba(255, 255, 255, 0.92)',
  glassBorder: 'rgba(20, 20, 43, 0.12)',
  glassHighlight: 'rgba(255, 255, 255, 0.95)',
  glassShadow: '#8B8BA8',
  backdrop: 'rgba(20, 20, 43, 0.35)',
  // Luzes da aurora
  auroraPrimaria: '#7C3AED',
  auroraSecundaria: '#06B6D4',
  auroraTerciaria: '#DB2777',
  auroraQuaternaria: '#10B981',
};

const darkTheme: ThemeColors = {
  // Chaves clássicas
  background: '#0B0B1A',
  card: '#151528',
  text: '#FFFFFF',
  textSecondary: '#A9ABC6',
  primary: '#8B5CF6',
  secondary: '#3B3B5E',
  accent: '#232342',
  border: '#2E2E52',
  success: '#34D399',
  error: '#F87171',
  warning: '#FBBF24',
  input: '#1C1C33',
  button: '#8B5CF6',
  buttonText: '#FFFFFF',
  icon: '#FFFFFF',
  overlay: 'rgba(8, 8, 20, 0.62)',
  // Vidro fosco
  glassCard: 'rgba(255, 255, 255, 0.07)',
  glassCardForte: 'rgba(23, 23, 48, 0.88)',
  glassBorder: 'rgba(255, 255, 255, 0.14)',
  glassHighlight: 'rgba(255, 255, 255, 0.25)',
  glassShadow: '#000000',
  backdrop: 'rgba(8, 8, 20, 0.62)',
  // Luzes da aurora
  auroraPrimaria: '#7C3AED',
  auroraSecundaria: '#06B6D4',
  auroraTerciaria: '#DB2777',
  auroraQuaternaria: '#10B981',
};

interface ThemeContextType {
  theme: Theme;
  isDark: boolean;
  colors: ThemeColors;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

interface ThemeProviderProps {
  children: ReactNode;
}

export function ThemeProvider({ children }: ThemeProviderProps): React.JSX.Element {
  const [theme, setThemeState] = useState<Theme>('auto');
  const systemColorScheme = useColorScheme();
  const isDark = theme === 'dark' || (theme === 'auto' && systemColorScheme === 'dark');
  const colors = isDark ? darkTheme : lightTheme;

  // Carregar tema salvo
  useEffect(() => {
    loadTheme();
  }, []);

  // Salvar tema quando mudar
  useEffect(() => {
    saveTheme(theme);
  }, [theme]);

  const loadTheme = async () => {
    try {
      const savedTheme = await AsyncStorage.getItem('@musicgalaxy:theme');
      if (savedTheme) {
        setThemeState(savedTheme as Theme);
      }
    } catch (error) {
      console.error('Erro ao carregar tema:', error);
    }
  };

  const saveTheme = async (themeToSave: Theme) => {
    try {
      await AsyncStorage.setItem('@musicgalaxy:theme', themeToSave);
    } catch (error) {
      console.error('Erro ao salvar tema:', error);
    }
  };

  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme);
  };

  const toggleTheme = () => {
    if (theme === 'light') {
      setThemeState('dark');
    } else if (theme === 'dark') {
      setThemeState('auto');
    } else {
      setThemeState('light');
    }
  };

  return (
    <ThemeContext.Provider value={{ theme, isDark, colors, setTheme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextType {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme deve ser usado dentro de ThemeProvider');
  }
  return context;
}
