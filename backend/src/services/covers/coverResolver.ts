// Regra 1 — capa oficial da fonte consultada.
//
// Nenhuma capa é gerada, desenhada ou copiada de outra música: quando a
// fonte não tem imagem, o campo fica nulo e o aplicativo mostra o
// placeholder "Sem capa".
//
// De onde vêm as capas oficiais:
//   - MusicBrainz: a busca não devolve imagem. O acervo oficial associado é
//     o Cover Art Archive, que responde pelo identificador do lançamento
//     (MBID) — é a mesma capa publicada no MusicBrainz.
//   - Discogs: a busca traz `cover_image` vazio; a imagem oficial só aparece
//     no detalhe do lançamento (`/releases/{id}`), com o token do servidor.
//
// As duas consultas são feitas em segundo plano, uma de cada vez, e só
// gravam a URL quando a imagem realmente existe. Sem isso, o catálogo
// inteiro exibia "Sem capa" — havia 0 capas em 4.868 versões.

import { ResultSetHeader, RowDataPacket } from 'mysql2';

import pool from '../../config/database';
import { agendarChamada } from '../rateLimiting/rateLimiter';

// Tempo máximo de cada consulta de capa. A capa não é urgente: se a fonte
// demorar, a tentativa é abandonada e refeita noutra rodada.
const TEMPO_LIMITE_MS = 8000;

// Pausa entre uma versão e outra dentro da mesma rodada.
const PAUSA_ENTRE_CONSULTAS_MS = 300;

// Um lote pequeno por rodada, repetido enquanto houver pendências. O custo
// fica distribuído e o servidor não passa minutos preso a uma tarefa visual.
const TAMANHO_DO_LOTE = 40;

const INTERVALO_ENTRE_RODADAS_MS = 5 * 60 * 1000;

export interface RespostaHttp {
  status: number;
  json?: unknown;
}

// Camada HTTP injetável — os testes substituem por respostas fixas e não
// dependem da internet nem do token do Discogs.
export type Requisitar = (
  url: string,
  cabecalhos: Record<string, string>
) => Promise<RespostaHttp>;

// Identificador do lançamento no MusicBrainz (UUID) a partir da URL de
// referência gravada pela ingestão.
export function extrairMbidMusicBrainz(url: string | null | undefined): string | null {
  if (!url) return null;
  const encontrado = url.match(/musicbrainz\.org\/release\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i);
  return encontrado ? encontrado[1]!.toLowerCase() : null;
}

// Identificador numérico do lançamento no Discogs a partir da URL de
// referência ("https://www.discogs.com/release/1035041-Daft-Punk-...").
export function extrairIdDiscogs(url: string | null | undefined): string | null {
  if (!url) return null;
  // O Discogs usa prefixo de idioma tanto de duas letras ("/en/") quanto com
  // região ("/pt_BR/"); os dois precisam ser atravessados para chegar ao id.
  const encontrado = url.match(/discogs\.com\/(?:[a-z]{2}(?:[_-][a-z]{2})?\/)?release\/(\d+)/i);
  return encontrado ? encontrado[1]! : null;
}

interface ImagemDiscogs {
  type?: string;
  uri?: string;
}

// A imagem principal do Discogs é a capa; as demais são contracapa, selo e
// encarte. Só a principal é usada — a Regra 1 fala da capa.
export function escolherImagemDiscogs(imagens: ImagemDiscogs[] | undefined): string | null {
  if (!Array.isArray(imagens) || imagens.length === 0) return null;

  const principal = imagens.find((imagem) => imagem.type === 'primary' && imagem.uri);
  if (principal?.uri) return principal.uri;

  const primeiraComUrl = imagens.find((imagem) => imagem.uri);
  return primeiraComUrl?.uri ?? null;
}

interface ImagemCoverArtArchive {
  front?: boolean;
  image?: string;
  thumbnails?: Record<string, string>;
}

// Prefere a miniatura de 500 px (leve para o celular) e cai para a imagem
// original quando a miniatura não existe.
export function escolherImagemCoverArt(imagens: ImagemCoverArtArchive[] | undefined): string | null {
  if (!Array.isArray(imagens) || imagens.length === 0) return null;

  const frente = imagens.find((imagem) => imagem.front) ?? imagens[0];
  if (!frente) return null;

  return frente.thumbnails?.['500'] ?? frente.image ?? null;
}

// O Cover Art Archive devolve a miniatura em `http://`, que redireciona para
// o archive.org. Página https bloqueia essa imagem (conteúdo misto) e o
// Android recusa tráfego não criptografado. A mesma imagem existe em https:
// só o protocolo muda — nada é gerado, copiado ou trocado.
export function normalizarUrlDeCapa(url: string | null): string | null {
  if (!url) return null;
  return url.replace(/^http:\/\//i, 'https://');
}

// Requisição HTTP real, com prazo. O Node já traz `fetch` global; nenhuma
// dependência nova entra no projeto.
const requisitarHttp: Requisitar = async (url, cabecalhos) => {
  const resposta = await fetch(url, {
    headers: cabecalhos,
    redirect: 'follow',
    signal: AbortSignal.timeout(TEMPO_LIMITE_MS),
  });

  if (!resposta.ok) {
    return { status: resposta.status };
  }

  try {
    return { status: resposta.status, json: await resposta.json() };
  } catch {
    return { status: resposta.status };
  }
};

// Resolve a capa oficial de uma versão. Devolve null quando a fonte não tem
// imagem — nunca inventa uma.
export async function resolverCapa(
  fonte: string | null,
  urlReferencia: string | null,
  requisitar: Requisitar = requisitarHttp
): Promise<string | null> {
  if (fonte === 'MusicBrainz') {
    const mbid = extrairMbidMusicBrainz(urlReferencia);
    if (!mbid) return null;

    await agendarChamada('Cover Art Archive');

    const resposta = await requisitar(
      `https://coverartarchive.org/release/${mbid}`,
      { 'User-Agent': process.env['MUSICBRAINZ_USER_AGENT'] || 'MusicGalaxy/1.0' }
    );
    if (resposta.status !== 200 || !resposta.json) return null;

    const corpo = resposta.json as { images?: ImagemCoverArtArchive[] };
    return normalizarUrlDeCapa(escolherImagemCoverArt(corpo.images));
  }

  if (fonte === 'Discogs') {
    const id = extrairIdDiscogs(urlReferencia);
    if (!id) return null;

    const token = process.env['DISCOGS_TOKEN'];
    if (!token) return null;

    await agendarChamada('Discogs');

    const resposta = await requisitar(
      `https://api.discogs.com/releases/${id}`,
      {
        'User-Agent': process.env['DISCOGS_USER_AGENT'] || 'MusicGalaxy/1.0',
        Authorization: `Discogs token=${token}`,
      }
    );
    if (resposta.status !== 200 || !resposta.json) return null;

    const corpo = resposta.json as { images?: ImagemDiscogs[] };
    return normalizarUrlDeCapa(escolherImagemDiscogs(corpo.images));
  }

  return null;
}

// Referências já tentadas nesta execução do servidor. Evita repetir a
// consulta a cada rodada para um lançamento que comprovadamente não tem
// capa. Um reinício do servidor volta a tentar — a fonte pode ter recebido
// a imagem depois.
const tentativas = new Set<string>();

interface LinhaPendente {
  id: number;
  fonte: string;
  referencia: string | null;
}

let preenchimentoEmCurso = false;

// Preenche capas das versões que o aplicativo de fato exibe (Regra 7: só
// as que têm áudio). São as únicas que o usuário pode ver.
export async function preencherCapasPendentes(
  limite: number = TAMANHO_DO_LOTE,
  requisitar: Requisitar = requisitarHttp
): Promise<{ atualizadas: number; consultadas: number }> {
  if (preenchimentoEmCurso) return { atualizadas: 0, consultadas: 0 };
  preenchimentoEmCurso = true;

  let atualizadas = 0;
  let consultadas = 0;

  try {
    // Sem o token do Discogs nenhuma capa dessa fonte pode ser resolvida: as
    // linhas ficam fora do lote para não ocupar as vagas nem entrar na lista
    // de tentativas (com o token configurado, a rodada seguinte as pega).
    const incluirDiscogs = Boolean(process.env['DISCOGS_TOKEN']);

    // Busca mais linhas do que o lote: as referências já tentadas continuam
    // sem capa no banco, e sem essa folga elas ocupariam as primeiras
    // posições em toda rodada e as versões seguintes nunca seriam visitadas.
    const [linhas] = await pool.execute<RowDataPacket[]>(
      `SELECT r.id, ms.name AS fonte, r.source_reference_url AS referencia
         FROM releases r
         JOIN metadata_sources ms ON ms.id = r.metadata_source_id
        WHERE r.cover_url IS NULL
          AND r.audio_source_url IS NOT NULL
          ${incluirDiscogs ? '' : "AND ms.name <> 'Discogs'"}
        ORDER BY r.updated_at ASC
        LIMIT ?`,
      [limite * 5]
    );

    for (const linha of linhas) {
      if (consultadas >= limite) break;

      const referencia = (linha['referencia'] as string | null) ?? null;
      const chave = referencia ?? `release:${linha['id']}`;
      if (tentativas.has(chave)) continue;

      tentativas.add(chave);
      consultadas += 1;

      try {
        const capa = await resolverCapa(
          linha['fonte'] as string,
          referencia,
          requisitar
        );

        if (capa) {
          // As faixas do mesmo disco compartilham a referência e a capa:
          // uma consulta resolve todas de uma vez.
          const [resultado] = await pool.execute<ResultSetHeader>(
            `UPDATE releases SET cover_url = ?
              WHERE cover_url IS NULL
                AND (source_reference_url = ? OR id = ?)`,
            [capa, referencia, linha['id']]
          );
          atualizadas += resultado.affectedRows;
        }
      } catch (erro) {
        console.warn(
          '[CAPAS] Falha ao resolver capa de',
          referencia ?? linha['id'],
          erro instanceof Error ? erro.message : erro
        );
      }

      await new Promise((resolve) => setTimeout(resolve, PAUSA_ENTRE_CONSULTAS_MS));
    }
  } finally {
    preenchimentoEmCurso = false;
  }

  if (atualizadas > 0) {
    console.log(`[CAPAS] ${atualizadas} versão(ões) ganharam a capa oficial.`);
  }

  return { atualizadas, consultadas };
}

// Liga o preenchimento em segundo plano: uma rodada ao iniciar e outra a
// cada cinco minutos enquanto houver versões sem capa. Nada bloqueia a
// subida do servidor e nenhuma capa é inventada.
export function iniciarPreenchimentoDeCapas(): void {
  const rodar = () => {
    void preencherCapasPendentes().catch((erro) => {
      console.warn(
        '[CAPAS] Rodada de capas falhou:',
        erro instanceof Error ? erro.message : erro
      );
    });
  };

  // Primeira rodada depois de o servidor estar no ar.
  setTimeout(rodar, 5000).unref?.();

  const intervalo = setInterval(rodar, INTERVALO_ENTRE_RODADAS_MS);
  intervalo.unref?.();
}
