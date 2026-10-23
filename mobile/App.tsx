// Ponto de entrada do aplicativo Music Galaxy.
// Renderiza o navegador principal que gerencia todas as telas.
// Envolve os Providers de contextos globais (Favoritos, Playlists,
// Históricos, Tema, Modais).
//
// A abertura começa pela tela de boas-vindas (3 segundos com o mascote
// animado) e só depois entrega o lugar ao fluxo de navegação. Antes disso,
// o aplicativo confere se o aparelho tem a versão do Android exigida: em
// aparelhos antigos, a tela de compatibilidade explica o que fazer em vez
// de deixar o aplicativo falhar.

import React, { useState } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import AppNavigator from './src/navigation/AppNavigator';
import TelaBoasVindas from './src/screens/TelaBoasVindas';
import TelaCompatibilidade from './src/screens/TelaCompatibilidade';
import { FavoritosProvider } from './src/contexts/FavoritosContext';
import { PlaylistsProvider } from './src/contexts/PlaylistsContext';
import { HistoricoProvider } from './src/contexts/HistoricoContext';
import { HistoricoReproducaoProvider } from './src/contexts/HistoricoReproducaoContext';
import { ThemeProvider } from './src/contexts/ThemeContext';
import { ModalProvider } from './src/contexts/ModalContext';
import ModalGlobalContainer from './src/components/ModalGlobalContainer';
import { inicializarApiConfig } from './src/services/api';
import { aparelhoCompativel } from './src/services/compatibilidade';

// Carrega o endereço do servidor salvo pelo usuário antes das primeiras
// requisições (sem bloquear a abertura do aplicativo).
inicializarApiConfig();

export default function App(): React.JSX.Element {
  // Enquanto verdadeiro, a apresentação de boas-vindas ocupa a tela.
  const [boasVindasVisivel, setBoasVindasVisivel] = useState(true);

  // Aparelhos com Android anterior à versão exigida recebem a tela de
  // compatibilidade no lugar do aplicativo.
  const [compativel] = useState(() => aparelhoCompativel());

  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <FavoritosProvider>
          <PlaylistsProvider>
            <HistoricoProvider>
              <HistoricoReproducaoProvider>
                <ModalProvider>
                  {!compativel ? (
                    <TelaCompatibilidade />
                  ) : boasVindasVisivel ? (
                    <TelaBoasVindas onConcluir={() => setBoasVindasVisivel(false)} />
                  ) : (
                    <AppNavigator />
                  )}
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
