// Configuração de navegação do app Music Galaxy.
// Usa React Navigation com stack navigator para transições entre telas.

import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { RootStackParamList } from '../types';
import BuscaScreen from '../screens/BuscaScreen';
import DetalheReleaseScreen from '../screens/DetalheReleaseScreen';

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function AppNavigator(): React.JSX.Element {
  return (
    <NavigationContainer>
      <Stack.Navigator
        initialRouteName="Busca"
        screenOptions={{
          headerShown: false,   // Cada tela gerencia seu próprio cabeçalho
          contentStyle: { backgroundColor: '#0F0F1A' },
          animation: 'slide_from_right',
        }}
      >
        <Stack.Screen name="Busca" component={BuscaScreen} />
        <Stack.Screen name="DetalheRelease" component={DetalheReleaseScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
