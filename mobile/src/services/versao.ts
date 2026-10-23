// Verificação de atualização do aplicativo.
//
// O servidor publica a última versão disponível para download
// (`GET /api/app/versao`, implementado em `backend/src/services/appVersion.ts`).
// O aplicativo compara essa versão com a instalada e avisa o usuário quando
// existe uma versão nova — sem exigir reinstalação: o APK novo é
// instalado por cima do aplicativo atual e os dados do aparelho
// (favoritos, playlists, histórico e downloads) continuam lá.

import { buscarVersaoPublicada } from './api';
import { VersaoPublicada } from '../types';

// Versão instalada no aparelho.
//
// ATENÇÃO: manter em sincronia com o campo "version" do mobile/package.json
// e com APP_VERSAO_PUBLICADA no servidor. Quando a versão sobe, os três
// lugares sobem juntos.
export const VERSAO_APLICATIVO = '1.0.1';

export interface ResultadoAtualizacao {
  /** Verdadeiro quando existe versão mais nova que a instalada. */
  atualizada: boolean;
  /** Versão instalada no aparelho. */
  versaoInstalada: string;
  /** Versão que o servidor está publicando. */
  versaoPublicada: string;
  /** Endereço de download — só existe quando há versão nova. */
  url: string | null;
  /** Notas da versão, quando o dono escreveu. */
  notas: string | null;
  /** Quando verdadeiro, a atualização é tratada como necessária. */
  obrigatoria: boolean;
}

/**
 * Consulta o servidor e compara com a versão instalada.
 *
 * @throws Error quando o servidor não pode ser consultado — a mensagem
 *         já está em português e é pronta para mostrar ao usuário.
 */
export async function verificarAtualizacao(): Promise<ResultadoAtualizacao> {
  let publicado: VersaoPublicada;

  try {
    const resposta = await buscarVersaoPublicada();
    publicado = resposta.data;
  } catch {
    throw new Error(
      'Não foi possível procurar atualizações. Verifique a internet e o endereço do servidor em Ajustes.'
    );
  }

  const atualizada = versaoMaisRecente(publicado.versao, VERSAO_APLICATIVO);

  return {
    atualizada,
    versaoInstalada: VERSAO_APLICATIVO,
    versaoPublicada: publicado.versao,
    url: atualizada ? publicado.url : null,
    notas: publicado.notas,
    obrigatoria: publicado.obrigatoria,
  };
}

/**
 * Diz se a versão publicada é mais nova que a instalada.
 *
 * A comparação é por número: "1.2" vale o mesmo que "1.2.0" e "1.10" é
 * mais nova que "1.9". Versões que não são numéricas são ignoradas — o
 * aplicativo nunca inventa que está desatualizado.
 */
export function versaoMaisRecente(publicada: string, instalada: string): boolean {
  const partesPublicada = partesVersao(publicada);
  const partesInstalada = partesVersao(instalada);

  if (!partesPublicada.length || !partesInstalada.length) {
    return false;
  }

  const tamanho = Math.max(partesPublicada.length, partesInstalada.length);

  for (let indice = 0; indice < tamanho; indice++) {
    const numeroPublicada = partesPublicada[indice] ?? 0;
    const numeroInstalada = partesInstalada[indice] ?? 0;

    if (numeroPublicada > numeroInstalada) return true;
    if (numeroPublicada < numeroInstalada) return false;
  }

  return false;
}

// Quebra a versão em números. Trechos que não são número são ignorados.
function partesVersao(valor: string): number[] {
  return valor
    .trim()
    .split('.')
    .map((parte) => Number.parseInt(parte, 10))
    .filter((numero) => Number.isFinite(numero) && numero >= 0);
}
