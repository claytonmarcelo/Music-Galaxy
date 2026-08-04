// Contexto global de tema (claro/escuro) com animações suaves.
// Persiste a preferência em AsyncStorage para lembrar da escolha do usuário.
// Implementa transições animadas ao mudar entre temas.

import React, { createContext, useState, useEffect, useCallback, ReactNode, useRef } from 'react';
import { Animated } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { TIMINGS, EASING } from '../utils/animacoes';

export type Tema = 'light' | 'dark';

interface TemaContextType {
  tema: Tema;
  mudarTema: (novoTema: Tema) => Promise<void>;
  alternarTema: () => Promise<void>;
  transicaoAnim?: Animated.Value;
}

// Cria o contexto com valor padrão
export const TemaContext = createContext<TemaContextType | undefined>(undefined);

// Cores por tema com transições suaves
export const coresTema = {
  light: {
    fundo: '#FFFFFF',
    fundoSecundario: '#F5F5F5',
    fundoTerciario: '#EEEEEE',
    texto: '#000000',
    textoSecundario: '#666666',
    acento: '#1DB954',
    borda: '#DDDDDD',
    sombra: '#00000010',
  },
  dark: {
    fundo: '#0F0F1A',
    fundoSecundario: '#1A1A2E',
    fundoTerciario: '#2E2E4E',
    texto: '#FFFFFF',
    textoSecundario: '#AAAAAA',
    acento: '#1DB954',
    borda: '#2E2E4E',
    sombra: '#00000040',
  },
};

const CHAVE_STORAGE = 'Music_Galaxy_Tema';
const TEMA_PADRAO: Tema = 'dark';

interface Props {
  children: ReactNode;
}

export function TemaProvider({ children }: Props): React.JSX.Element {
  const [tema, setTema] = useState<Tema>(TEMA_PADRAO);
  const [carregando, setCarregando] = useState(true);
  const transicaoAnim = useRef(new Animated.Value(0)).current;

  // Carrega tema salvo do AsyncStorage ao inicializar
  useEffect(() => {
    const carregarTema = async (): Promise<void> => {
      try {
        const temaSalvo = await AsyncStorage.getItem(CHAVE_STORAGE);
        if (temaSalvo && (temaSalvo === 'light' || temaSalvo === 'dark')) {
          setTema(temaSalvo);
        }
      } catch (erro) {
        console.error('Erro ao carregar tema:', erro);
      } finally {
        setCarregando(false);
      }
    };

    carregarTema();
  }, []);

  // Muda o tema com animação e persiste em AsyncStorage
  const mudarTema = useCallback(
    async (novoTema: Tema): Promise<void> => {
      try {
        // Inicia animação de transição
        Animated.sequence([
          Animated.timing(transicaoAnim, {
            toValue: 1,
            duration: TIMINGS.normal,
            useNativeDriver: true,
          }),
          Animated.timing(transicaoAnim, {
            toValue: 0,
            duration: TIMINGS.normal,
            useNativeDriver: true,
          }),
        ]).start();

        // Muda o tema no meio da animação
        setTema(novoTema);
        await AsyncStorage.setItem(CHAVE_STORAGE, novoTema);
      } catch (erro) {
        console.error('Erro ao salvar tema:', erro);
        // Reverte se houver erro ao salvar
        setTema(tema);
      }
    },
    [tema, transicaoAnim]
  );

  // Alterna entre claro e escuro com animação
  const alternarTema = useCallback(async (): Promise<void> => {
    const novoTema = tema === 'dark' ? 'light' : 'dark';
    await mudarTema(novoTema);
  }, [tema, mudarTema]);

  const valor: TemaContextType = {
    tema,
    mudarTema,
    alternarTema,
    transicaoAnim,
  };

  // Enquanto carrega tema salvo, retorna children
  if (carregando) {
    return <>{children}</>;
  }

  return (
    <TemaContext.Provider value={valor}>
      {children}
    </TemaContext.Provider>
  );
}

// Hook para usar o contexto de tema
export function useTema(): TemaContextType {
  const contexto = React.useContext(TemaContext);
  if (!contexto) {
    throw new Error('useTema deve ser usado dentro de TemaProvider');
  }
  return contexto;
}

// Hook para obter cores do tema atual
export function useCorTema() {
  const { tema } = useTema();
  return coresTema[tema];
}
