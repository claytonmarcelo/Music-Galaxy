// Configuração de navegação do app Music Galaxy.
// Usa React Navigation com StackNavigator para transições entre telas.

import React from 'react';
import { Text } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { RootStackParamList } from '../types';
import BuscaScreen from '../screens/BuscaScreen';
import DetalheReleaseScreen from '../screens/DetalheReleaseScreen';
import DetalheWorkScreen from '../screens/DetalheWorkScreen';
import DetalheArtistaScreen from '../screens/DetalheArtistaScreen';
import TelaBiblioteca from '../screens/TelaBiblioteca';
import TelaExplorar from '../screens/TelaExplorar';
import FavoritosScreen from '../screens/FavoritosScreen';
import SettingsScreen from '../screens/SettingsScreen';
import TelaAdminIngestao from '../screens/TelaAdminIngestao';

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function AppNavigator(): React.JSX.Element {
  return (
    <NavigationContainer>
      <Stack.Navigator
        initialRouteName="Busca"
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: '#0F0F1A' },
          animation: 'slide_from_right',
        }}
      >
        <Stack.Screen name="Busca" component={BuscaScreen} />
        <Stack.Screen name="DetalheRelease" component={DetalheReleaseScreen} />
        <Stack.Screen name="DetalheWork" component={DetalheWorkScreen} />
        <Stack.Screen name="DetalheArtista" component={DetalheArtistaScreen} />
        <Stack.Screen name="Biblioteca" component={TelaBiblioteca} />
        <Stack.Screen name="Explorar" component={TelaExplorar} />
        <Stack.Screen name="Favoritos" component={FavoritosScreen} />
        <Stack.Screen name="Settings" component={SettingsScreen} />
        <Stack.Screen name="AdminIngestao" component={TelaAdminIngestao} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
