// Ponto de entrada do aplicativo Music Galaxy.
// Renderiza o navegador principal que gerencia todas as telas.
// Envolve os Providers de contextos globais (Favoritos, Histórico, Tema, Modais).

import React from 'react';
import AppNavigator from './src/navigation/AppNavigator';
import { FavoritosProvider } from './src/contexts/FavoritosContext';
import { HistoricoProvider } from './src/contexts/HistoricoContext';
import { TemaProvider } from './src/contexts/TemaContext';
import { ModalProvider } from './src/contexts/ModalContext';
import ModalGlobalContainer from './src/components/ModalGlobalContainer';

export default function App(): React.JSX.Element {
  return (
    <TemaProvider>
      <FavoritosProvider>
        <HistoricoProvider>
          <ModalProvider>
            <AppNavigator />
            <ModalGlobalContainer />
          </ModalProvider>
        </HistoricoProvider>
      </FavoritosProvider>
    </TemaProvider>
  );
}
