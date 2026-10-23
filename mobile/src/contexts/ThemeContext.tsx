// Contexto de Tema — claro e escuro.
// A paleta nasce da referência visual do projeto: taupe quente profundo,
// vinho, marfim e vidro fosco minimalista. Todos os componentes leem os
// tokens daqui, então a identidade e a troca de tema vivem em um só lugar.

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useColorScheme } from 'react-native';

// Definição dos temas
type Theme = 'light' | 'dark' | 'auto';

interface ThemeColors {
  // Chaves clássicas (compatibilidade com todas as telas)
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
  // Superfícies de vidro fosco
  glassCard: string;        // fundo translúcido de cartões
  glassCardForte: string;   // vidro mais opaco (modais, navegação, player)
  glassBorder: string;      // contorno sutil de vidro
  glassHighlight: string;   // brilho superior do vidro
  glassShadow: string;      // cor da sombra projetada
  backdrop: string;         // véu escuro atrás dos modais
  // Gradiente de fundo e luzes atmosféricas
  gradienteTopo: string;    // topo mais quente do fundo
  gradienteBase: string;    // base profunda do fundo
  luzPrimaria: string;      // brilho vinho
  luzSecundaria: string;    // brilho cobre rosado
  luzTerciaria: string;     // brilho ameixa
  luzQuaternaria: string;   // brilho âmbar
}

const lightTheme: ThemeColors = {
  // Chaves clássicas
  background: '#F2E9E2',
  card: '#FCF7F2',
  text: '#2A1C19',
  textSecondary: '#7C655C',
  primary: '#8C3A44',
  secondary: '#EADBD1',
  accent: '#EFDDD3',
  border: '#DCC9BE',
  success: '#4F7856',
  error: '#AE4642',
  warning: '#A56B33',
  input: 'rgba(255, 255, 255, 0.62)',
  button: '#7C2F39',
  buttonText: '#FCF5EF',
  icon: '#2A1C19',
  overlay: 'rgba(42, 28, 24, 0.30)',
  // Vidro fosco
  glassCard: 'rgba(255, 252, 248, 0.55)',
  glassCardForte: 'rgba(255, 250, 245, 0.90)',
  glassBorder: 'rgba(42, 28, 25, 0.12)',
  glassHighlight: 'rgba(255, 255, 255, 0.90)',
  glassShadow: '#8D7265',
  backdrop: 'rgba(42, 28, 25, 0.32)',
  // Gradiente e luzes
  gradienteTopo: '#F8EFE8',
  gradienteBase: '#E5D1C4',
  luzPrimaria: '#B0686F',
  luzSecundaria: '#CB8873',
  luzTerciaria: '#8C6070',
  luzQuaternaria: '#C39A72',
};

const darkTheme: ThemeColors = {
  // Chaves clássicas
  background: '#201816',
  card: '#2C211E',
  text: '#F7F0E8',
  textSecondary: '#BCA99F',
  primary: '#D79BA0',
  secondary: '#3B2C27',
  accent: '#5E262D',
  border: '#493831',
  success: '#A9C3A4',
  error: '#E7A099',
  warning: '#DFB489',
  input: 'rgba(255, 244, 235, 0.055)',
  button: '#F7F0E8',
  buttonText: '#2A1917',
  icon: '#F7F0E8',
  overlay: 'rgba(18, 12, 11, 0.60)',
  // Vidro fosco
  glassCard: 'rgba(255, 244, 236, 0.055)',
  glassCardForte: 'rgba(41, 31, 28, 0.86)',
  glassBorder: 'rgba(255, 238, 227, 0.16)',
  glassHighlight: 'rgba(255, 234, 221, 0.42)',
  glassShadow: '#000000',
  backdrop: 'rgba(14, 9, 8, 0.66)',
  // Gradiente e luzes
  gradienteTopo: '#43322B',
  gradienteBase: '#1A1312',
  luzPrimaria: '#8D3742',
  luzSecundaria: '#C77E6E',
  luzTerciaria: '#5A2B3A',
  luzQuaternaria: '#A9764D',
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
