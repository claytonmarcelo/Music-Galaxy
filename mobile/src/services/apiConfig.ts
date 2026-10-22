// Configuração do endereço do servidor (API) — editável pelo usuário.
// O aplicativo precisa saber onde o backend está hospedado. O endereço
// informado pelo usuário fica salvo no AsyncStorage e vale para qualquer
// rede (a antiga versão tinha um IP de rede local fixo na produção, o que
// quebrava o app fora daquela rede). Em desenvolvimento, o padrão continua
// sendo o emulador Android (10.0.2.2) ou o localhost.

import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

// Chave usada para persistir o endereço configurado pelo usuário.
const CHAVE_URL_SERVIDOR = '@musicgalaxy:apiUrl';

// Tempo limite curto para o teste de conexão com o servidor.
const TIMEOUT_TESTE_MS = 6000;

// Remove a barra final e garante o prefixo http:// quando ausente.
// Aceita também URLs com https:// informadas pelo usuário.
export function normalizarUrlServidor(entrada: string): string {
  let url = (entrada ?? '').trim();
  if (!url) {
    return '';
  }
  if (!/^https?:\/\//i.test(url)) {
    url = `http://${url}`;
  }
  // Remove barras finais para montar caminhos limpos depois.
  return url.replace(/\/+$/, '');
}

// Endereço padrão antes de qualquer configuração do usuário.
// Em produção (APK), sem configuração salva, o app abre em modo offline e
// orienta o usuário a informar o endereço na tela de Ajustes.
export function urlBasePadrao(): string {
  // No navegador (versão web), o backend fica no mesmo host, porta 3001.
  if (typeof window !== 'undefined' && typeof document !== 'undefined') {
    const protocolo = window.location.protocol;
    const host = window.location.hostname;
    return `${protocolo}//${host}:3001`;
  }

  // Emulador Android: 10.0.2.2 mapeia para a máquina de desenvolvimento.
  if (Platform.OS === 'android' && __DEV__) {
    return 'http://10.0.2.2:3001';
  }

  // iOS em desenvolvimento: simulador enxerga o localhost da máquina.
  if (__DEV__) {
    return 'http://localhost:3001';
  }

  // Produção: o usuário configura o endereço na tela de Ajustes.
  // Vazio significa "ainda não configurado" — o app funciona offline.
  return '';
}

// Endereço salvo pelo usuário (se existir).
export async function obterUrlSalva(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(CHAVE_URL_SERVIDOR);
  } catch (error) {
    console.error('Erro ao ler endereço do servidor:', error);
    return null;
  }
}

// Grava o endereço informado pelo usuário, já normalizado.
export async function definirUrlServidor(entrada: string): Promise<string> {
  const url = normalizarUrlServidor(entrada);
  try {
    if (url) {
      await AsyncStorage.setItem(CHAVE_URL_SERVIDOR, url);
    } else {
      await AsyncStorage.removeItem(CHAVE_URL_SERVIDOR);
    }
  } catch (error) {
    console.error('Erro ao salvar endereço do servidor:', error);
  }
  return url;
}

// Limpa a configuração do usuário e volta ao padrão.
export async function limparUrlServidor(): Promise<void> {
  try {
    await AsyncStorage.removeItem(CHAVE_URL_SERVIDOR);
  } catch (error) {
    console.error('Erro ao limpar endereço do servidor:', error);
  }
}

// Testa se um endereço responde no endpoint de saúde da API.
// Retorna true apenas quando o servidor responde com sucesso.
export async function testarConexaoServidor(url: string): Promise<boolean> {
  const normalizada = normalizarUrlServidor(url);
  if (!normalizada) {
    return false;
  }
  try {
    const controle = new AbortController();
    const temporizador = setTimeout(() => controle.abort(), TIMEOUT_TESTE_MS);
    const resposta = await fetch(`${normalizada}/health`, {
      method: 'GET',
      signal: controle.signal,
    });
    clearTimeout(temporizador);
    return resposta.ok;
  } catch {
    return false;
  }
}
