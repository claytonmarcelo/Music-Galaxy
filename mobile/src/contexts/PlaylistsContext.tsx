// Contexto global de playlists locais.
// Cada playlist guarda uma cópia dos dados das versões no próprio aparelho,
// preservando a ordem em que foram adicionadas. Excluir uma playlist ou
// remover uma música NUNCA apaga o arquivo baixado nem os favoritos.

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

const STORAGE_KEY = '@MusicGalaxy:playlists';
const LIMITE_NOME = 60;

export interface Playlist {
  id: string;
  nome: string;
  criadaEm: number;
  atualizadaEm: number;
  releases: Release[];
}

interface PlaylistsContextData {
  playlists: Playlist[];
  carregando: boolean;
  criarPlaylist: (nome: string) => Promise<string>;
  renomearPlaylist: (id: string, nome: string) => Promise<void>;
  excluirPlaylist: (id: string) => Promise<void>;
  adicionarRelease: (playlistId: string, release: Release) => Promise<boolean>;
  removerRelease: (playlistId: string, releaseId: number) => Promise<void>;
  playlistContem: (playlistId: string, releaseId: number) => boolean;
}

const PlaylistsContext = createContext<PlaylistsContextData | undefined>(undefined);

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

// Normaliza o que veio do AsyncStorage: descarta registros corrompidos,
// remove versões duplicadas e mantém a ordem original de cada playlist.
function normalizarPlaylists(valor: unknown): Playlist[] {
  if (!Array.isArray(valor)) return [];

  const idsUsados = new Set<string>();
  const resultado: Playlist[] = [];

  valor.forEach((item) => {
    if (!item || typeof item !== 'object') return;
    const registro = item as Record<string, unknown>;

    if (typeof registro.id !== 'string' || !registro.id || idsUsados.has(registro.id)) {
      return;
    }
    if (typeof registro.nome !== 'string' || !registro.nome.trim()) return;

    const releasesBrutas = Array.isArray(registro.releases) ? registro.releases : [];
    const idsReleases = new Set<number>();
    const releases = releasesBrutas.filter((release): release is Release => {
      if (!ehReleaseValida(release) || idsReleases.has(release.id)) return false;
      idsReleases.add(release.id);
      return true;
    });

    const agora = Date.now();
    idsUsados.add(registro.id);
    resultado.push({
      id: registro.id,
      nome: registro.nome.trim().slice(0, LIMITE_NOME),
      criadaEm: typeof registro.criadaEm === 'number' ? registro.criadaEm : agora,
      atualizadaEm: typeof registro.atualizadaEm === 'number' ? registro.atualizadaEm : agora,
      releases,
    });
  });

  return resultado;
}

// Gera um identificador local estável o suficiente para as playlists.
function gerarId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

interface Props {
  children: React.ReactNode;
}

export function PlaylistsProvider({ children }: Props): React.JSX.Element {
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [carregando, setCarregando] = useState(true);
  // Mantém sempre a versão mais recente para evitar perda de dados quando
  // duas ações acontecem em sequência rápida.
  const playlistsRef = useRef<Playlist[]>([]);

  useEffect(() => {
    let ativo = true;

    const carregar = async () => {
      try {
        const dados = await AsyncStorage.getItem(STORAGE_KEY);
        if (!ativo) return;

        const carregadas = dados ? normalizarPlaylists(JSON.parse(dados)) : [];
        playlistsRef.current = carregadas;
        setPlaylists(carregadas);
      } catch (erro) {
        console.error('Erro ao carregar playlists:', erro);
      } finally {
        if (ativo) setCarregando(false);
      }
    };

    void carregar();

    return () => {
      ativo = false;
    };
  }, []);

  // Grava primeiro no aparelho e só então atualiza a interface: se a
  // persistência falhar, o usuário recebe o erro e nada fica pela metade.
  const salvar = useCallback(async (novas: Playlist[]): Promise<void> => {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(novas));
    playlistsRef.current = novas;
    setPlaylists(novas);
  }, []);

  const criarPlaylist = useCallback(
    async (nome: string): Promise<string> => {
      const nomeLimpo = nome.trim().slice(0, LIMITE_NOME);
      if (!nomeLimpo) {
        throw new Error('Digite um nome para a playlist.');
      }

      const jaExiste = playlistsRef.current.some(
        (playlist) => playlist.nome.toLowerCase() === nomeLimpo.toLowerCase()
      );
      if (jaExiste) {
        throw new Error('Já existe uma playlist com esse nome.');
      }

      const agora = Date.now();
      const nova: Playlist = {
        id: gerarId(),
        nome: nomeLimpo,
        criadaEm: agora,
        atualizadaEm: agora,
        releases: [],
      };

      await salvar([...playlistsRef.current, nova]);
      return nova.id;
    },
    [salvar]
  );

  const renomearPlaylist = useCallback(
    async (id: string, nome: string): Promise<void> => {
      const nomeLimpo = nome.trim().slice(0, LIMITE_NOME);
      if (!nomeLimpo) {
        throw new Error('Digite um nome para a playlist.');
      }

      const nomeOcupado = playlistsRef.current.some(
        (playlist) =>
          playlist.id !== id && playlist.nome.toLowerCase() === nomeLimpo.toLowerCase()
      );
      if (nomeOcupado) {
        throw new Error('Já existe uma playlist com esse nome.');
      }

      const novas = playlistsRef.current.map((playlist) =>
        playlist.id === id
          ? { ...playlist, nome: nomeLimpo, atualizadaEm: Date.now() }
          : playlist
      );
      await salvar(novas);
    },
    [salvar]
  );

  const excluirPlaylist = useCallback(
    async (id: string): Promise<void> => {
      await salvar(playlistsRef.current.filter((playlist) => playlist.id !== id));
    },
    [salvar]
  );

  const adicionarRelease = useCallback(
    async (playlistId: string, release: Release): Promise<boolean> => {
      const playlist = playlistsRef.current.find((item) => item.id === playlistId);
      if (!playlist) {
        throw new Error('Playlist não encontrada.');
      }
      if (playlist.releases.some((item) => item.id === release.id)) {
        return false;
      }

      const novas = playlistsRef.current.map((item) =>
        item.id === playlistId
          ? {
              ...item,
              releases: [...item.releases, release],
              atualizadaEm: Date.now(),
            }
          : item
      );
      await salvar(novas);
      return true;
    },
    [salvar]
  );

  const removerRelease = useCallback(
    async (playlistId: string, releaseId: number): Promise<void> => {
      const novas = playlistsRef.current.map((playlist) =>
        playlist.id === playlistId
          ? {
              ...playlist,
              releases: playlist.releases.filter((release) => release.id !== releaseId),
              atualizadaEm: Date.now(),
            }
          : playlist
      );
      await salvar(novas);
    },
    [salvar]
  );

  const playlistContem = useCallback(
    (playlistId: string, releaseId: number): boolean => {
      const playlist = playlists.find((item) => item.id === playlistId);
      return playlist?.releases.some((release) => release.id === releaseId) ?? false;
    },
    [playlists]
  );

  return (
    <PlaylistsContext.Provider
      value={{
        playlists,
        carregando,
        criarPlaylist,
        renomearPlaylist,
        excluirPlaylist,
        adicionarRelease,
        removerRelease,
        playlistContem,
      }}
    >
      {children}
    </PlaylistsContext.Provider>
  );
}

export function usePlaylists(): PlaylistsContextData {
  const contexto = useContext(PlaylistsContext);
  if (!contexto) {
    throw new Error('usePlaylists deve ser usado dentro de PlaylistsProvider');
  }
  return contexto;
}
