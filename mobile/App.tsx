// Ponto de entrada do aplicativo Music Galaxy.
// Renderiza o navegador principal que gerencia todas as telas.

import React from 'react';
import AppNavigator from './src/navigation/AppNavigator';

export default function App(): React.JSX.Element {
  return <AppNavigator />;
}
