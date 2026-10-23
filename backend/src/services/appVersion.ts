// Publicação de versões do aplicativo.
//
// O servidor é a fonte de verdade sobre qual é a última versão do Music
// Galaxy disponível para download. O aplicativo consulta essa rota na
// abertura e na tela de Ajustes para avisar que existe uma versão nova.
//
// Tudo vem do ambiente: publicar uma versão nova é editar o `.env` do
// servidor — não é preciso recompilar nem republicar o aplicativo.

export interface VersaoPublicada {
  /** Versão disponível para download (ex.: "1.1.0"). */
  versao: string;
  /** Endereço do arquivo de instalação. */
  url: string;
  /** Notas da versão, quando o dono escrever. */
  notas: string | null;
  /** Quando verdadeiro, o aplicativo avisa que a atualização é necessária. */
  obrigatoria: boolean;
}

// Usados quando o ambiente não informa nada — o aplicativo continua
// funcionando e apenas não recebe aviso de atualização.
const VERSAO_PADRAO = '1.0.0';
const URL_PADRAO = 'https://github.com/claytonmarcelo/Music-Galaxy/releases/latest';

// Só aceita "1", "1.2" ou "1.2.3" — evita texto solto no campo.
const FORMATO_VERSAO = /^\d+(\.\d+){0,2}$/;

/** Devolve a versão que o servidor está publicando. */
export function versaoPublicada(): VersaoPublicada {
  const versaoInformada = (process.env['APP_VERSAO_PUBLICADA'] || '').trim();
  const urlInformada = (process.env['APP_URL_DOWNLOAD'] || '').trim();
  const notasInformadas = (process.env['APP_NOTAS_ATUALIZACAO'] || '').trim();
  const obrigatoriaInformada = (
    process.env['APP_ATUALIZACAO_OBRIGATORIA'] || ''
  ).toLowerCase();

  return {
    versao: FORMATO_VERSAO.test(versaoInformada) ? versaoInformada : VERSAO_PADRAO,
    url: urlHttpSegura(urlInformada) ? urlInformada : URL_PADRAO,
    notas: notasInformadas.length > 0 ? notasInformadas : null,
    obrigatoria: obrigatoriaInformada === 'true',
  };
}

// Só endereços http/https são aceitos — nada de "javascript:" ou "file:".
function urlHttpSegura(valor: string): boolean {
  if (!valor) return false;

  try {
    const analisada = new URL(valor);
    return analisada.protocol === 'http:' || analisada.protocol === 'https:';
  } catch {
    return false;
  }
}
