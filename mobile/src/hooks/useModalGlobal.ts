// Hook Global para Modais e Notificações
// Facilita o uso de ModalPersonalizado e ToastNotificacao em qualquer componente

import { useState, useCallback } from 'react';
import { TipoModal, BotaoModal } from '../components/ModalPersonalizado';
import { TipoToast } from '../components/ToastNotificacao';

interface EstadoModal {
  visivel: boolean;
  tipo: TipoModal;
  titulo: string;
  mensagem: string;
  botoes: BotaoModal[];
}

interface EstadoToast {
  visivel: boolean;
  tipo: TipoToast;
  mensagem: string;
}

export const useModalGlobal = () => {
  const [estadoModal, setEstadoModal] = useState<EstadoModal>({
    visivel: false,
    tipo: 'info',
    titulo: '',
    mensagem: '',
    botoes: [],
  });

  const [estadoToast, setEstadoToast] = useState<EstadoToast>({
    visivel: false,
    tipo: 'info',
    mensagem: '',
  });

  // Abre modal de sucesso
  const abrirSucesso = useCallback((titulo: string, mensagem: string, onConfirmar?: () => void) => {
    setEstadoModal({
      visivel: true,
      tipo: 'sucesso',
      titulo,
      mensagem,
      botoes: [
        {
          texto: 'OK',
          onPress: onConfirmar || (() => {}),
          estilo: 'primario',
        },
      ],
    });
  }, []);

  // Abre modal de erro
  const abrirErro = useCallback((titulo: string, mensagem: string, onConfirmar?: () => void) => {
    setEstadoModal({
      visivel: true,
      tipo: 'erro',
      titulo,
      mensagem,
      botoes: [
        {
          texto: 'Fechar',
          onPress: onConfirmar || (() => {}),
          estilo: 'primario',
        },
      ],
    });
  }, []);

  // Abre modal de aviso
  const abrirAviso = useCallback(
    (titulo: string, mensagem: string, onConfirmar?: () => void) => {
      setEstadoModal({
        visivel: true,
        tipo: 'aviso',
        titulo,
        mensagem,
        botoes: [
          {
            texto: 'Entendi',
            onPress: onConfirmar || (() => {}),
            estilo: 'primario',
          },
        ],
      });
    },
    []
  );

  // Abre modal de informação
  const abrirInfo = useCallback((titulo: string, mensagem: string, onConfirmar?: () => void) => {
    setEstadoModal({
      visivel: true,
      tipo: 'info',
      titulo,
      mensagem,
      botoes: [
        {
          texto: 'OK',
          onPress: onConfirmar || (() => {}),
          estilo: 'primario',
        },
      ],
    });
  }, []);

  // Abre modal de confirmação (sim/não)
  const abrirConfirmacao = useCallback(
    (
      titulo: string,
      mensagem: string,
      onConfirmar: () => void,
      onCancelar?: () => void
    ) => {
      setEstadoModal({
        visivel: true,
        tipo: 'confirmacao',
        titulo,
        mensagem,
        botoes: [
          {
            texto: 'Cancelar',
            onPress: onCancelar || (() => {}),
            estilo: 'secundario',
          },
          {
            texto: 'Confirmar',
            onPress: onConfirmar,
            estilo: 'primario',
          },
        ],
      });
    },
    []
  );

  // Abre modal customizado completo
  const abrirPersonalizado = useCallback(
    (
      tipo: TipoModal,
      titulo: string,
      mensagem: string,
      botoes: BotaoModal[]
    ) => {
      setEstadoModal({
        visivel: true,
        tipo,
        titulo,
        mensagem,
        botoes,
      });
    },
    []
  );

  // Fecha o modal
  const fecharModal = useCallback(() => {
    setEstadoModal(prev => ({
      ...prev,
      visivel: false,
    }));
  }, []);

  // Toast de sucesso
  const toastSucesso = useCallback((mensagem: string, duracao = 3000) => {
    setEstadoToast({
      visivel: true,
      tipo: 'sucesso',
      mensagem,
    });
    setTimeout(() => {
      setEstadoToast(prev => ({
        ...prev,
        visivel: false,
      }));
    }, duracao);
  }, []);

  // Toast de erro
  const toastErro = useCallback((mensagem: string, duracao = 4000) => {
    setEstadoToast({
      visivel: true,
      tipo: 'erro',
      mensagem,
    });
    setTimeout(() => {
      setEstadoToast(prev => ({
        ...prev,
        visivel: false,
      }));
    }, duracao);
  }, []);

  // Toast de aviso
  const toastAviso = useCallback((mensagem: string, duracao = 3000) => {
    setEstadoToast({
      visivel: true,
      tipo: 'aviso',
      mensagem,
    });
    setTimeout(() => {
      setEstadoToast(prev => ({
        ...prev,
        visivel: false,
      }));
    }, duracao);
  }, []);

  // Toast de info
  const toastInfo = useCallback((mensagem: string, duracao = 3000) => {
    setEstadoToast({
      visivel: true,
      tipo: 'info',
      mensagem,
    });
    setTimeout(() => {
      setEstadoToast(prev => ({
        ...prev,
        visivel: false,
      }));
    }, duracao);
  }, []);

  // Fecha toast
  const fecharToast = useCallback(() => {
    setEstadoToast(prev => ({
      ...prev,
      visivel: false,
    }));
  }, []);

  return {
    // Estados
    estadoModal,
    estadoToast,

    // Modais
    abrirSucesso,
    abrirErro,
    abrirAviso,
    abrirInfo,
    abrirConfirmacao,
    abrirPersonalizado,
    fecharModal,

    // Toasts
    toastSucesso,
    toastErro,
    toastAviso,
    toastInfo,
    fecharToast,
  };
};
