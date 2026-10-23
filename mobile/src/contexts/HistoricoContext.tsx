// Contexto global para gerenciar histórico de buscas.
// Persiste últimas 20 buscas em AsyncStorage para sugestões rápidas.

import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = '@MusicGalaxy:historico';
const MAX_HISTORICO = 20;

export interface ItemHistorico {
  termo: string;
  timestamp: number;
}

interface HistoricoContextData {
  historico: ItemHistorico[];
  carregando: boolean;
  adicionarBusca: (termo: string) => Promise<void>;
  removerBusca: (termo: string) => Promise<void>;
  limparHistorico: () => Promise<void>;
}

const HistoricoContext = createContext<HistoricoContextData | undefined>(undefined);

export function HistoricoProvider({ children }: { children: React.ReactNode }): React.JSX.Element {
  const [historico, setHistorico] = useState<ItemHistorico[]>([]);
  const [carregando, setCarregando] = useState(true);
  // Lista mais recente para evitar perder buscas feitas em sequência rápida.
  const historicoRef = useRef<ItemHistorico[]>([]);

  // Carrega histórico do AsyncStorage ao iniciar
  useEffect(() => {
    let ativo = true;

    const carregarHistorico = async () => {
      try {
        const dados = await AsyncStorage.getItem(STORAGE_KEY);
        if (!ativo) return;

        if (dados) {
          const historicoCarregado = JSON.parse(dados) as ItemHistorico[];
          historicoRef.current = historicoCarregado;
          setHistorico(historicoCarregado);
        }
      } catch (erro) {
        console.error('Erro ao carregar histórico:', erro);
      } finally {
        if (ativo) setCarregando(false);
      }
    };

    void carregarHistorico();

    return () => {
      ativo = false;
    };
  }, []);

  const salvarHistorico = async (novoHistorico: ItemHistorico[]) => {
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(novoHistorico));
      historicoRef.current = novoHistorico;
      setHistorico(novoHistorico);
    } catch (erro) {
      console.error('Erro ao salvar histórico:', erro);
      throw erro;
    }
  };

  const adicionarBusca = async (termo: string) => {
    const termoNormalizado = termo.trim().toLowerCase();
    if (!termoNormalizado) return;

    // Remove duplicatas (mantém apenas a mais recente)
    const historicoFiltrado = historicoRef.current.filter(
      item => item.termo.toLowerCase() !== termoNormalizado
    );

    const novoItem: ItemHistorico = {
      termo: termo.trim(),
      timestamp: Date.now(),
    };

    // Adiciona no início e limita a MAX_HISTORICO itens
    const novoHistorico = [novoItem, ...historicoFiltrado].slice(0, MAX_HISTORICO);
    await salvarHistorico(novoHistorico);
  };

  const removerBusca = async (termo: string) => {
    const termoNormalizado = termo.trim().toLowerCase();
    const novoHistorico = historicoRef.current.filter(
      item => item.termo.toLowerCase() !== termoNormalizado
    );
    await salvarHistorico(novoHistorico);
  };

  const limparHistorico = async () => {
    await AsyncStorage.removeItem(STORAGE_KEY);
    historicoRef.current = [];
    setHistorico([]);
  };

  return (
    <HistoricoContext.Provider
      value={{
        historico,
        carregando,
        adicionarBusca,
        removerBusca,
        limparHistorico,
      }}
    >
      {children}
    </HistoricoContext.Provider>
  );
}

export function useHistorico(): HistoricoContextData {
  const contexto = useContext(HistoricoContext);
  if (!contexto) {
    throw new Error('useHistorico deve ser usado dentro de HistoricoProvider');
  }
  return contexto;
}
