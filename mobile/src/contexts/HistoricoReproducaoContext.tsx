// Contexto global do histórico de reproduções.
// Registra a última vez que cada versão começou a tocar, da mais recente
// para a mais antiga, sem repetir a mesma versão. É apenas um registro
// local: limpar o histórico não remove arquivos baixados nem favoritos.

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Release } from '../types';

const STORAGE_KEY = '@MusicGalaxy:historicoReproducao';
const MAX_REPRODUCOES = 50;

export interface Reproducao {
  release: Release;
  reproduzidoEm: number;
}

interface HistoricoReproducaoContextData {
  reproducoes: Reproducao[];
  carregando: boolean;
  registrarReproducao: (release: Release) => Promise<void>;
  removerReproducao: (releaseId: number) => Promise<void>;
  limparHistoricoReproducao: () => Promise<void>;
}

const HistoricoReproducaoContext = createContext<
  HistoricoReproducaoContextData | undefined
>(undefined);

// Confere se o registro salvo tem o mínimo necessário para ser exibido.
function ehReleaseValida(valor: unknown): valor is Release {
  if (!valor || typeof valor !== 'object') return false;
  const registro = valor as Record<string, unknown>;
  return (
    typeof registro.id === 'number' &&
    Number.isFinite(registro.id) &&
    typeof registro.version_name === 'string' &&
    typeof registro.work_title === 'string' &&
    typeof registro.artist_name === 'string'
  );
}

// Descarta registros corrompidos e repetidos ao carregar do aparelho.
function normalizarReproducoes(valor: unknown): Reproducao[] {
  if (!Array.isArray(valor)) return [];

  const idsUsados = new Set<number>();
  const resultado: Reproducao[] = [];

  valor.forEach((item) => {
    if (!item || typeof item !== 'object') return;
    const registro = item as Record<string, unknown>;
    if (!ehReleaseValida(registro.release) || idsUsados.has(registro.release.id)) {
      return;
    }

    idsUsados.add(registro.release.id);
    resultado.push({
      release: registro.release,
      reproduzidoEm:
        typeof registro.reproduzidoEm === 'number' ? registro.reproduzidoEm : Date.now(),
    });
  });

  return resultado.slice(0, MAX_REPRODUCOES);
}

interface Props {
  children: React.ReactNode;
}

export function HistoricoReproducaoProvider({ children }: Props): React.JSX.Element {
  const [reproducoes, setReproducoes] = useState<Reproducao[]>([]);
  const [carregando, setCarregando] = useState(true);
  const reproducoesRef = useRef<Reproducao[]>([]);

  useEffect(() => {
    let ativo = true;

    const carregar = async () => {
      try {
        const dados = await AsyncStorage.getItem(STORAGE_KEY);
        if (!ativo) return;

        const carregadas = dados ? normalizarReproducoes(JSON.parse(dados)) : [];
        reproducoesRef.current = carregadas;
        setReproducoes(carregadas);
      } catch (erro) {
        console.error('Erro ao carregar o histórico de reproduções:', erro);
      } finally {
        if (ativo) setCarregando(false);
      }
    };

    void carregar();

    return () => {
      ativo = false;
    };
  }, []);

  // Grava primeiro e só depois atualiza a interface.
  const salvar = useCallback(async (novas: Reproducao[]): Promise<void> => {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(novas));
    reproducoesRef.current = novas;
    setReproducoes(novas);
  }, []);

  const registrarReproducao = useCallback(
    async (release: Release): Promise<void> => {
      const semRepeticao = reproducoesRef.current.filter(
        (item) => item.release.id !== release.id
      );
      const novas = [{ release, reproduzidoEm: Date.now() }, ...semRepeticao].slice(
        0,
        MAX_REPRODUCOES
      );
      await salvar(novas);
    },
    [salvar]
  );

  const removerReproducao = useCallback(
    async (releaseId: number): Promise<void> => {
      await salvar(
        reproducoesRef.current.filter((item) => item.release.id !== releaseId)
      );
    },
    [salvar]
  );

  const limparHistoricoReproducao = useCallback(async (): Promise<void> => {
    await AsyncStorage.removeItem(STORAGE_KEY);
    reproducoesRef.current = [];
    setReproducoes([]);
  }, []);

  return (
    <HistoricoReproducaoContext.Provider
      value={{
        reproducoes,
        carregando,
        registrarReproducao,
        removerReproducao,
        limparHistoricoReproducao,
      }}
    >
      {children}
    </HistoricoReproducaoContext.Provider>
  );
}

export function useHistoricoReproducao(): HistoricoReproducaoContextData {
  const contexto = useContext(HistoricoReproducaoContext);
  if (!contexto) {
    throw new Error(
      'useHistoricoReproducao deve ser usado dentro de HistoricoReproducaoProvider'
    );
  }
  return contexto;
}
