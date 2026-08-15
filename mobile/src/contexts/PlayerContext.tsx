// Contexto do Player Global Otimizado
// Gerencia o player de música que persiste entre telas com cache e pré-carregamento

import React, { createContext, useContext, useState, useRef, useEffect, ReactNode, useCallback, useMemo } from 'react';
import { Audio, AVPlaybackStatus } from 'expo-av';
import { Release } from '../types';

interface PlayerState {
  currentRelease: Release | null;
  isPlaying: boolean;
  isLoaded: boolean;
  position: number;
  duration: number;
  volume: number;
  isLoading: boolean;
}

interface AudioCache {
  [key: string]: {
    sound: Audio.Sound;
    loadedAt: number;
  };
}

interface PlayerContextType {
  playerState: PlayerState;
  play: (release: Release) => Promise<void>;
  pause: () => Promise<void>;
  resume: () => Promise<void>;
  stop: () => Promise<void>;
  seek: (position: number) => Promise<void>;
  setVolume: (volume: number) => Promise<void>;
  next: () => void;
  previous: () => void;
  setQueue: (releases: Release[]) => void;
  shuffle: () => void;
  preload: (release: Release) => Promise<void>;
}

const PlayerContext = createContext<PlayerContextType | undefined>(undefined);

interface PlayerProviderProps {
  children: ReactNode;
}

// Cache de áudio para evitar recarregamento
const audioCache: AudioCache = {};
const CACHE_TTL = 5 * 60 * 1000; // 5 minutos
const MAX_CACHE_SIZE = 10; // Máximo de 10 áudios em cache

export function PlayerProvider({ children }: PlayerProviderProps): React.JSX.Element {
  const sound = useRef<Audio.Sound | null>(null);
  const [playerState, setPlayerState] = useState<PlayerState>({
    currentRelease: null,
    isPlaying: false,
    isLoaded: false,
    position: 0,
    duration: 0,
    volume: 1.0,
    isLoading: false,
  });
  const [queue, setQueueState] = useState<Release[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);

  // Limpar cache antigo
  const cleanupCache = useCallback(() => {
    const now = Date.now();
    const keys = Object.keys(audioCache);
    
    // Remover itens antigos
    for (const key of keys) {
      if (now - audioCache[key].loadedAt > CACHE_TTL) {
        audioCache[key].sound.unloadAsync();
        delete audioCache[key];
      }
    }

    // Se ainda tiver muitos itens, remover os mais antigos
    const remainingKeys = Object.keys(audioCache);
    if (remainingKeys.length > MAX_CACHE_SIZE) {
      const sortedKeys = remainingKeys.sort((a, b) => audioCache[a].loadedAt - audioCache[b].loadedAt);
      const toRemove = sortedKeys.slice(0, sortedKeys.length - MAX_CACHE_SIZE);
      for (const key of toRemove) {
        audioCache[key].sound.unloadAsync();
        delete audioCache[key];
      }
    }
  }, []);

  // Limpar o sound quando o componente for desmontado
  useEffect(() => {
    return () => {
      if (sound.current) {
        sound.current.unloadAsync();
      }
      // Limpar todo o cache ao desmontar
      Object.values(audioCache).forEach(item => item.sound.unloadAsync());
      Object.keys(audioCache).forEach(key => delete audioCache[key]);
    };
  }, []);

  // Atualizar status do player otimizado
  const onPlaybackStatusUpdate = useCallback((status: AVPlaybackStatus) => {
    if (status.isLoaded) {
      setPlayerState(prev => ({
        ...prev,
        isPlaying: status.isPlaying,
        position: status.positionMillis,
        duration: status.durationMillis || 0,
        isLoaded: true,
        isLoading: false,
      }));
    }
  }, []);

  // Pré-carregar áudio em background
  const preload = useCallback(async (release: Release) => {
    const audioUrl = release.streaming_url || release.audio_preview_url;
    if (!audioUrl) return;

    const cacheKey = `audio_${release.id}`;
    
    // Se já está no cache, não fazer nada
    if (audioCache[cacheKey]) return;

    try {
      const { sound: newSound } = await Audio.Sound.createAsync(
        { uri: audioUrl },
        { shouldPlay: false },
        onPlaybackStatusUpdate
      );

      audioCache[cacheKey] = {
        sound: newSound,
        loadedAt: Date.now(),
      };

      cleanupCache();
    } catch (error) {
      console.error('Erro ao pré-carregar áudio:', error);
    }
  }, [onPlaybackStatusUpdate, cleanupCache]);

  // Tocar uma música otimizado
  const play = useCallback(async (release: Release) => {
    try {
      setPlayerState(prev => ({ ...prev, isLoading: true }));

      // Parar música atual se estiver tocando
      if (sound.current) {
        await sound.current.stopAsync();
        await sound.current.unloadAsync();
        sound.current = null;
      }

      let audioUrl = release.streaming_url || release.audio_preview_url || `http://localhost:3001/api/releases/${release.id}/stream`;
      if (audioUrl.startsWith('/')) {
        audioUrl = `http://localhost:3001${audioUrl}`;
      }

      const cacheKey = `audio_${release.id}`;
      let newSound: Audio.Sound;

      // Usar do cache se disponível
      if (audioCache[cacheKey]) {
        newSound = audioCache[cacheKey].sound;
        delete audioCache[cacheKey]; // Remover do cache temporariamente
      } else {
        // Carregar novo áudio
        const result = await Audio.Sound.createAsync(
          { uri: audioUrl },
          { 
            shouldPlay: true,
            volume: playerState.volume,
          },
          onPlaybackStatusUpdate
        );
        newSound = result.sound;
      }

      sound.current = newSound;

      setPlayerState({
        currentRelease: release,
        isPlaying: true,
        isLoaded: true,
        position: 0,
        duration: 0,
        volume: playerState.volume,
        isLoading: false,
      });

      // Pré-carregar próxima música em background
      if (queue.length > 0) {
        const nextIndex = (currentIndex + 1) % queue.length;
        const nextRelease = queue[nextIndex];
        if (nextRelease && nextRelease.id !== release.id) {
          setTimeout(() => preload(nextRelease), 1000);
        }
      }
    } catch (error) {
      console.error('Erro ao tocar música:', error);
      setPlayerState(prev => ({ ...prev, isLoading: false }));
    }
  }, [playerState.volume, onPlaybackStatusUpdate, queue, currentIndex, preload]);

  // Pausar música otimizado
  const pause = useCallback(async () => {
    if (sound.current) {
      await sound.current.pauseAsync();
      setPlayerState(prev => ({ ...prev, isPlaying: false }));
    }
  }, []);

  // Retomar música otimizado
  const resume = useCallback(async () => {
    if (sound.current) {
      await sound.current.playAsync();
      setPlayerState(prev => ({ ...prev, isPlaying: true }));
    }
  }, []);

  // Parar música otimizado
  const stop = useCallback(async () => {
    if (sound.current) {
      await sound.current.stopAsync();
      await sound.current.unloadAsync();
      sound.current = null;
    }
    setPlayerState({
      currentRelease: null,
      isPlaying: false,
      isLoaded: false,
      position: 0,
      duration: 0,
      volume: 1.0,
      isLoading: false,
    });
  }, []);

  // Buscar posição otimizado
  const seek = useCallback(async (position: number) => {
    if (sound.current) {
      await sound.current.setPositionAsync(position);
    }
  }, []);

  // Definir volume otimizado
  const setVolume = useCallback(async (volume: number) => {
    if (sound.current) {
      await sound.current.setVolumeAsync(volume);
    }
    setPlayerState(prev => ({ ...prev, volume }));
  }, []);

  // Próxima música otimizado
  const next = useCallback(() => {
    if (queue.length === 0) return;
    const nextIndex = (currentIndex + 1) % queue.length;
    setCurrentIndex(nextIndex);
    play(queue[nextIndex]);
  }, [queue.length, currentIndex, play]);

  // Música anterior otimizado
  const previous = useCallback(() => {
    if (queue.length === 0) return;
    const prevIndex = currentIndex === 0 ? queue.length - 1 : currentIndex - 1;
    setCurrentIndex(prevIndex);
    play(queue[prevIndex]);
  }, [queue.length, currentIndex, play]);

  // Definir fila de reprodução otimizado
  const setQueue = useCallback((releases: Release[]) => {
    setQueueState(releases);
    setCurrentIndex(0);
  }, []);

  // Embaralhar fila otimizado
  const shuffle = useCallback(() => {
    const shuffled = [...queue].sort(() => Math.random() - 0.5);
    setQueueState(shuffled);
    setCurrentIndex(0);
  }, [queue]);

  // Memoizar o valor do contexto para evitar re-renders
  const contextValue = useMemo(() => ({
    playerState,
    play,
    pause,
    resume,
    stop,
    seek,
    setVolume,
    next,
    previous,
    setQueue,
    shuffle,
    preload,
  }), [playerState, play, pause, resume, stop, seek, setVolume, next, previous, setQueue, shuffle, preload]);

  return (
    <PlayerContext.Provider value={contextValue}>
      {children}
    </PlayerContext.Provider>
  );
}

export function usePlayer(): PlayerContextType {
  const context = useContext(PlayerContext);
  if (!context) {
    throw new Error('usePlayer deve ser usado dentro de PlayerProvider');
  }
  return context;
}
