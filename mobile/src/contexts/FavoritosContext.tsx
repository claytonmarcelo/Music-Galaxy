// Contexto global para gerenciar favoritos.
// Persiste dados em AsyncStorage para sobreviver entre sessões.

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Release } from '../types';

const STORAGE_KEY = '@MusicGalaxy:favoritos';

interface FavoritosContextData {
  favoritos: Release[];
  carregando: boolean;
  isFavorito: (releaseId: number) => boolean;
  adicionarFavorito: (release: Release) => Promise<void>;
  removerFavorito: (releaseId: number) => Promise<void>;
  limparFavoritos: () => Promise<void>;
}

const FavoritosContext = createContext<FavoritosContextData | undefined>(undefined);

export function FavoritosProvider({ children }: { children: React.ReactNode }): React.JSX.Element {
  const [favoritos, setFavoritos] = useState<Release[]>([]);
  const [carregando, setCarregando] = useState(true);
  // Mantém a lista mais recente para não perder uma alteração feita antes
  // de o carregamento inicial terminar (ou duas ações em sequência).
  const favoritosRef = useRef<Release[]>([]);

  // Carrega favoritos do AsyncStorage ao iniciar
  useEffect(() => {
    let ativo = true;

    const carregarFavoritos = async () => {
      try {
        const dados = await AsyncStorage.getItem(STORAGE_KEY);
        if (!ativo) return;

        if (dados) {
          const favoritosCarregados = JSON.parse(dados) as Release[];
          favoritosRef.current = favoritosCarregados;
          setFavoritos(favoritosCarregados);
        }
      } catch (erro) {
        console.error('Erro ao carregar favoritos:', erro);
      } finally {
        if (ativo) setCarregando(false);
      }
    };

    void carregarFavoritos();

    return () => {
      ativo = false;
    };
  }, []);

  // Grava no aparelho antes de atualizar a interface. A ref é atualizada
  // junto para que a próxima ação parta sempre do estado persistido.
  const salvarFavoritos = async (novosFavoritos: Release[]) => {
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(novosFavoritos));
      favoritosRef.current = novosFavoritos;
      setFavoritos(novosFavoritos);
    } catch (erro) {
      console.error('Erro ao salvar favoritos:', erro);
      throw erro;
    }
  };

  const isFavorito = useCallback((releaseId: number): boolean => {
    return favoritos.some(fav => fav.id === releaseId);
  }, [favoritos]);

  const adicionarFavorito = async (release: Release) => {
    if (favoritosRef.current.some((fav) => fav.id === release.id)) return;

    const novosFavoritos = [release, ...favoritosRef.current];
    await salvarFavoritos(novosFavoritos);
  };

  const removerFavorito = async (releaseId: number) => {
    const novosFavoritos = favoritosRef.current.filter(fav => fav.id !== releaseId);
    await salvarFavoritos(novosFavoritos);
  };

  const limparFavoritos = async () => {
    await AsyncStorage.removeItem(STORAGE_KEY);
    favoritosRef.current = [];
    setFavoritos([]);
  };

  return (
    <FavoritosContext.Provider
      value={{
        favoritos,
        carregando,
        isFavorito,
        adicionarFavorito,
        removerFavorito,
        limparFavoritos,
      }}
    >
      {children}
    </FavoritosContext.Provider>
  );
}

export function useFavoritos(): FavoritosContextData {
  const contexto = useContext(FavoritosContext);
  if (!contexto) {
    throw new Error('useFavoritos deve ser usado dentro de FavoritosProvider');
  }
  return contexto;
}
