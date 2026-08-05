// Contexto de Tema - Dark/Light
// Gerencia o tema do aplicativo com persistência no AsyncStorage

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useColorScheme } from 'react-native';

// Definição dos temas
type Theme = 'light' | 'dark' | 'auto';

interface ThemeColors {
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
}

const lightTheme: ThemeColors = {
  background: '#FFFFFF',
  card: '#F5F5F5',
  text: '#000000',
  textSecondary: '#666666',
  primary: '#1DB954',
  secondary: '#191414',
  accent: '#E6F4FE',
  border: '#E0E0E0',
  success: '#4CAF50',
  error: '#F44336',
  warning: '#FF9800',
  input: '#F0F0F0',
  button: '#1DB954',
  buttonText: '#FFFFFF',
  icon: '#000000',
  overlay: 'rgba(0, 0, 0, 0.5)',
};

const darkTheme: ThemeColors = {
  background: '#0F0F1A',
  card: '#1A1A2E',
  text: '#FFFFFF',
  textSecondary: '#A0A0C0',
  primary: '#1DB954',
  secondary: '#E6F4FE',
  accent: '#252540',
  border: '#2C2C54',
  success: '#4CAF50',
  error: '#F44336',
  warning: '#FF9800',
  input: '#252540',
  button: '#1DB954',
  buttonText: '#FFFFFF',
  icon: '#FFFFFF',
  overlay: 'rgba(0, 0, 0, 0.7)',
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
