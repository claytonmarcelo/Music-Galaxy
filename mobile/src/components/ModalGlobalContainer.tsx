// Contenedor Global para Modais e Notificações
// Renderiza ModalPersonalizado e ToastNotificacao com o contexto global

import React from 'react';
import { StyleSheet, View } from 'react-native';
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
    // A camada ocupa a tela inteira: o toast é posicionado de forma absoluta
    // e precisa de uma referência de altura real para aparecer no topo,
    // acima de qualquer conteúdo (inclusive da barra de navegação).
    <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
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
        duracao={estadoToast.duracao}
        onFechar={fecharToast}
      />
    </View>
  );
}
