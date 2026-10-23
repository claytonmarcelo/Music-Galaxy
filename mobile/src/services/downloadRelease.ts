// Preferências e utilitários do fluxo de download.
// A qualidade escolhida é lembrada no aparelho (como no fluxo de um
// gerenciador de downloads) e aplicada ao botão rápido de cada versão.
// Os arquivos continuam vindo SEMPRE do endpoint do backend, que resolve
// a fonte em sites abertos (Regra 3).

import AsyncStorage from '@react-native-async-storage/async-storage';
import { Release } from '../types';
import { BASE_URL } from './api';

export type FormatoDownload = 'mp3' | 'flac';

const CHAVE_QUALIDADE = '@musicgalaxy:qualidadeDownload';

export const OPCOES_QUALIDADE: Array<{
  formato: FormatoDownload;
  titulo: string;
  descricao: string;
}> = [
  {
    formato: 'mp3',
    titulo: 'MP3 320 kbps',
    descricao: 'Ótima qualidade e arquivo menor.',
  },
  {
    formato: 'flac',
    titulo: 'FLAC sem perdas',
    descricao: 'Qualidade de estúdio, arquivo maior.',
  },
];

export const QUALIDADE_PADRAO: FormatoDownload = 'mp3';

// Lê a qualidade padrão salva pelo usuário.
export async function obterQualidadePadrao(): Promise<FormatoDownload> {
  try {
    const valor = await AsyncStorage.getItem(CHAVE_QUALIDADE);
    return valor === 'flac' ? 'flac' : QUALIDADE_PADRAO;
  } catch {
    return QUALIDADE_PADRAO;
  }
}

// Salva a qualidade padrão escolhida em Ajustes.
export async function salvarQualidadePadrao(formato: FormatoDownload): Promise<void> {
  try {
    await AsyncStorage.setItem(CHAVE_QUALIDADE, formato);
  } catch (erro) {
    console.error('Erro ao salvar qualidade de download:', erro);
  }
}

// Rótulo curto para o chip do botão rápido (MP3 / FLAC).
export function rotuloQualidade(formato: FormatoDownload): string {
  return formato.toUpperCase();
}

// Endpoint de download do backend para a versão e o formato escolhidos.
export function urlDownloadRelease(releaseId: number, formato: FormatoDownload): string {
  return `${BASE_URL}/api/releases/${releaseId}/download?format=${formato}`;
}

// Endpoint de stream do backend — única fonte de reprodução (Regra 3).
export function urlStreamRelease(releaseId: number): string {
  return `${BASE_URL}/api/releases/${releaseId}/stream`;
}

// Nome-base do arquivo exibido na fila e salvo no aparelho.
export function nomeBaseArquivoRelease(release: Release): string {
  const base = `${release.artist_name} - ${release.work_title} - ${release.version_name}`;
  return base.replace(/[\\/:*?"<>|]/g, '_').slice(0, 110);
}

export function nomeArquivoRelease(release: Release, formato: FormatoDownload): string {
  return `${nomeBaseArquivoRelease(release)}.${formato}`;
}
