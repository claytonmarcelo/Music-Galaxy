// Configuração de navegação do app Music Galaxy.
// Usa React Navigation com StackNavigator para transições entre telas.
// Otimizado sem lazy loading para evitar problemas de estado

import React from 'react';
import { View } from 'react-native';
import { NavigationContainer, DefaultTheme, DarkTheme, Theme, useNavigationContainerRef } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useTheme } from '../contexts/ThemeContext';
import OfflineBanner from '../components/OfflineBanner';
import BarraNavegacaoInferior from '../components/BarraNavegacaoInferior';

import { RootStackParamList } from '../types';
import BuscaScreen from '../screens/BuscaScreen';
import DetalheReleaseScreen from '../screens/DetalheReleaseScreen';
import DetalheWorkScreen from '../screens/DetalheWorkScreen';
import DetalheArtistaScreen from '../screens/DetalheArtistaScreen';
import TelaBiblioteca from '../screens/TelaBiblioteca';
import TelaPlaylist from '../screens/TelaPlaylist';
import TelaExplorar from '../screens/TelaExplorar';
import FavoritosScreen from '../screens/FavoritosScreen';
import FilaDownloadsScreen from '../screens/FilaDownloadsScreen';
import SettingsScreen from '../screens/SettingsScreen';
import TelaAdminIngestao from '../screens/TelaAdminIngestao';

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function AppNavigator(): React.JSX.Element {
  const { colors, isDark } = useTheme();
  const navigationRef = useNavigationContainerRef<RootStackParamList>();

  // Tema da navegação alinhado aos tokens visuais do aplicativo.
  const base = isDark ? DarkTheme : DefaultTheme;
  const temaNavegacao: Theme = {
    ...base,
    colors: {
      ...base.colors,
      primary: colors.primary,
      background: colors.background,
      card: colors.glassCardForte,
      text: colors.text,
      border: colors.glassBorder,
      notification: colors.primary,
    },
  };

  return (
    <View style={{ flex: 1 }}>
      <NavigationContainer ref={navigationRef} theme={temaNavegacao}>
      <View style={{ flex: 1 }}>
      <Stack.Navigator
        initialRouteName="Busca"
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.background },
          animation: 'slide_from_right',
          animationTypeForReplace: 'push',
        }}
      >
        <Stack.Screen name="Busca" component={BuscaScreen} />
        <Stack.Screen name="DetalheRelease" component={DetalheReleaseScreen} />
        <Stack.Screen name="DetalheWork" component={DetalheWorkScreen} />
        <Stack.Screen name="DetalheArtista" component={DetalheArtistaScreen} />
        <Stack.Screen name="Biblioteca" component={TelaBiblioteca} />
        <Stack.Screen name="DetalhePlaylist" component={TelaPlaylist} />
        <Stack.Screen name="Explorar" component={TelaExplorar} />
        <Stack.Screen name="Favoritos" component={FavoritosScreen} />
        <Stack.Screen name="FilaDownloads" component={FilaDownloadsScreen} />
        <Stack.Screen name="Settings" component={SettingsScreen} />
        <Stack.Screen name="AdminIngestao" component={TelaAdminIngestao} />
      </Stack.Navigator>
      {/* Barra de navegação inferior — acesso direto às áreas principais do app */}
      <BarraNavegacaoInferior />
      </View>
      </NavigationContainer>
      {/* Aviso global de falta de conexão com o servidor */}
      <OfflineBanner onAbrirAjustes={() => navigationRef.navigate('Settings')} />
    </View>
  );
}
