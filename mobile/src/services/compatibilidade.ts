// Compatibilidade do aparelho com o aplicativo.
//
// O Music Galaxy é distribuído apenas para os Androids lançados em 2025 ou
// depois — a partir do Android 16 (nível de API 36). O instalador do
// próprio Android recusa o APK em aparelhos anteriores, e este módulo dá
// ao aplicativo o número exato do sistema, para que a incompatibilidade seja
// explicada com clareza em vez de virar um erro genérico.

import { Platform } from 'react-native';

// Nível de API do Android 16 — primeira versão do Android lançada em 2025.
export const ANDROID_MINIMO_API = 36;

// Como chamar a versão exigida, em texto de interface.
export const ANDROID_MINIMO_ROTULO = 'Android 16 (versão de 2025)';

// Versões do Android por nível de API. Serve para dizer ao usuário qual
// versão ele tem, sem inventar nome nenhum.
const NOMES_POR_API: Record<number, string> = {
  24: 'Android 7.0',
  25: 'Android 7.1',
  26: 'Android 8.0',
  27: 'Android 8.1',
  28: 'Android 9',
  29: 'Android 10',
  30: 'Android 11',
  31: 'Android 12',
  32: 'Android 12L',
  33: 'Android 13',
  34: 'Android 14',
  35: 'Android 15',
  36: 'Android 16',
  37: 'Android 17',
};

/**
 * Nível de API do Android em que o aparelho está rodando.
 *
 * @returns O número do nível de API ou `null` quando não é Android (no
 *          navegador e no iOS o aplicativo funciona normalmente).
 */
export function nivelApiAndroid(): number | null {
  if (Platform.OS !== 'android') return null;
  return typeof Platform.Version === 'number' ? Platform.Version : null;
}

/**
 * Diz se o aparelho pode usar o aplicativo.
 *
 * @returns `true` fora do Android e em aparelhos com a versão exigida.
 */
export function aparelhoCompativel(): boolean {
  const nivel = nivelApiAndroid();
  if (nivel === null) return true;
  return nivel >= ANDROID_MINIMO_API;
}

/**
 * Nome da versão do Android correspondente a um nível de API.
 *
 * @param nivelApi Nível de API do aparelho.
 * @returns Nome da versão, por exemplo "Android 15".
 */
export function nomeVersaoAndroid(nivelApi: number): string {
  return NOMES_POR_API[nivelApi] ?? `Android (nível ${nivelApi})`;
}

/**
 * Frase curta que resume a diferença entre o aparelho e o que o
 * aplicativo precisa.
 *
 * @param nivelApi Nível de API detectado no aparelho.
 * @returns Texto pronto para mostrar ao usuário.
 */
export function descricaoIncompatibilidade(nivelApi: number): string {
  const nome = nomeVersaoAndroid(nivelApi);
  return (
    `Este aparelho está com ${nome} (nível ${nivelApi}). ` +
    `O Music Galaxy usa recursos do ${ANDROID_MINIMO_ROTULO} ou mais novo.`
  );
}
