// Ponto de entrada do aplicativo Music Galaxy.
// Renderiza o navegador principal que gerencia todas as telas.
// Envolve os Providers de contextos globais (Favoritos, Playlists,
// Históricos, Tema, Modais).

import React from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import AppNavigator from './src/navigation/AppNavigator';
import { FavoritosProvider } from './src/contexts/FavoritosContext';
import { PlaylistsProvider } from './src/contexts/PlaylistsContext';
import { HistoricoProvider } from './src/contexts/HistoricoContext';
import { HistoricoReproducaoProvider } from './src/contexts/HistoricoReproducaoContext';
import { ThemeProvider } from './src/contexts/ThemeContext';
import { ModalProvider } from './src/contexts/ModalContext';
import ModalGlobalContainer from './src/components/ModalGlobalContainer';
import { inicializarApiConfig } from './src/services/api';

// Carrega o endereço do servidor salvo pelo usuário antes das primeiras
// requisições (sem bloquear a abertura do aplicativo).
inicializarApiConfig();

export default function App(): React.JSX.Element {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <FavoritosProvider>
          <PlaylistsProvider>
            <HistoricoProvider>
              <HistoricoReproducaoProvider>
                <ModalProvider>
                  <AppNavigator />
                  <ModalGlobalContainer />
                </ModalProvider>
              </HistoricoReproducaoProvider>
            </HistoricoProvider>
          </PlaylistsProvider>
        </FavoritosProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
