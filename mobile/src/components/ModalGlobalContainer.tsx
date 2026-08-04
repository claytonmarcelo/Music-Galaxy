// Contenedor Global para Modais e Notificações
// Renderiza ModalPersonalizado e ToastNotificacao com o contexto global

import React from 'react';
import { View } from 'react-native';
import { useModal } from '../contexts/ModalContext';
import ModalPersonalizado from './ModalPersonalizado';
import ToastNotificacao from './ToastNotificacao';

export default function ModalGlobalContainer(): React.JSX.Element {
  const {
    estadoModal,
    estadoToast,
    fecharModal,
    fecharToast,
  } = useModal();

  return (
    <View pointerEvents="box-none" style={{ flex: 0 }}>
      {/* Modal Principal */}
      <ModalPersonalizado
        visivel={estadoModal.visivel}
        tipo={estadoModal.tipo}
        titulo={estadoModal.titulo}
        mensagem={estadoModal.mensagem}
        botoes={estadoModal.botoes}
        onFechar={fecharModal}
      />

      {/* Toast Notificação */}
      <ToastNotificacao
        visivel={estadoToast.visivel}
        tipo={estadoToast.tipo}
        mensagem={estadoToast.mensagem}
        onFechar={fecharToast}
      />
    </View>
  );
}
