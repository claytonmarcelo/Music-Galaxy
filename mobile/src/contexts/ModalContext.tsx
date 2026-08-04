// Contexto Global para Modais e Notificações
// Permite usar modais de qualquer lugar do app sem prop drilling

import React, { createContext, useContext, useState, useCallback } from 'react';
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

interface ModalContextType {
  // Estados
  estadoModal: EstadoModal;
  estadoToast: EstadoToast;

  // Métodos Modal
  abrirSucesso: (titulo: string, mensagem: string, onConfirmar?: () => void) => void;
  abrirErro: (titulo: string, mensagem: string, onConfirmar?: () => void) => void;
  abrirAviso: (titulo: string, mensagem: string, onConfirmar?: () => void) => void;
  abrirInfo: (titulo: string, mensagem: string, onConfirmar?: () => void) => void;
  abrirConfirmacao: (
    titulo: string,
    mensagem: string,
    onConfirmar: () => void,
    onCancelar?: () => void
  ) => void;
  abrirPersonalizado: (
    tipo: TipoModal,
    titulo: string,
    mensagem: string,
    botoes: BotaoModal[]
  ) => void;
  fecharModal: () => void;

  // Métodos Toast
  toastSucesso: (mensagem: string, duracao?: number) => void;
  toastErro: (mensagem: string, duracao?: number) => void;
  toastAviso: (mensagem: string, duracao?: number) => void;
  toastInfo: (mensagem: string, duracao?: number) => void;
  fecharToast: () => void;
}

const ModalContext = createContext<ModalContextType | undefined>(undefined);

interface Props {
  children: React.ReactNode;
}

export function ModalProvider({ children }: Props): React.JSX.Element {
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

  const [timeoutToast, setTimeoutToast] = useState<ReturnType<typeof setTimeout> | null>(null);

  // Modais
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

  const abrirAviso = useCallback((titulo: string, mensagem: string, onConfirmar?: () => void) => {
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
  }, []);

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

  const abrirPersonalizado = useCallback(
    (tipo: TipoModal, titulo: string, mensagem: string, botoes: BotaoModal[]) => {
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

  const fecharModal = useCallback(() => {
    setEstadoModal(prev => ({
      ...prev,
      visivel: false,
    }));
  }, []);

  // Toasts
  const mostrarToast = useCallback((tipo: TipoToast, mensagem: string, duracao: number) => {
    if (timeoutToast) clearTimeout(timeoutToast);

    setEstadoToast({
      visivel: true,
      tipo,
      mensagem,
    });

    const timeout = setTimeout(() => {
      setEstadoToast(prev => ({
        ...prev,
        visivel: false,
      }));
    }, duracao);

    setTimeoutToast(timeout);
  }, [timeoutToast]);

  const toastSucesso = useCallback((mensagem: string, duracao = 3000) => {
    mostrarToast('sucesso', mensagem, duracao);
  }, [mostrarToast]);

  const toastErro = useCallback((mensagem: string, duracao = 4000) => {
    mostrarToast('erro', mensagem, duracao);
  }, [mostrarToast]);

  const toastAviso = useCallback((mensagem: string, duracao = 3000) => {
    mostrarToast('aviso', mensagem, duracao);
  }, [mostrarToast]);

  const toastInfo = useCallback((mensagem: string, duracao = 3000) => {
    mostrarToast('info', mensagem, duracao);
  }, [mostrarToast]);

  const fecharToast = useCallback(() => {
    if (timeoutToast) clearTimeout(timeoutToast);
    setEstadoToast(prev => ({
      ...prev,
      visivel: false,
    }));
  }, [timeoutToast]);

  const valor: ModalContextType = {
    estadoModal,
    estadoToast,
    abrirSucesso,
    abrirErro,
    abrirAviso,
    abrirInfo,
    abrirConfirmacao,
    abrirPersonalizado,
    fecharModal,
    toastSucesso,
    toastErro,
    toastAviso,
    toastInfo,
    fecharToast,
  };

  return (
    <ModalContext.Provider value={valor}>
      {children}
    </ModalContext.Provider>
  );
}

export function useModal(): ModalContextType {
  const contexto = useContext(ModalContext);
  if (!contexto) {
    throw new Error('useModal deve ser usado dentro de ModalProvider');
  }
  return contexto;
}
