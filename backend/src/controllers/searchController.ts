// Controller de busca musical.
// Implementa o endpoint principal GET /api/search?q={termo}.
// Consulta o banco local primeiro; se não houver dados suficientes
// ou o cache tiver expirado, dispara a ingestão das fontes externas
// antes de responder — tudo de forma transparente para o cliente.

import { Request, Response, NextFunction } from 'express';
import { RowDataPacket } from 'mysql2';
import pool from '../config/database';
import { haIngestaoEmCurso, ingerirPorTermo } from '../services/ingestion/searchOrchestrator';
import { resolverFonte, DadosReleaseParaAudio } from './audioController';
import { RespostaPaginada, ReleaseCompleto } from '../types';
import { ErroAplicacao } from '../middleware/errorHandler';
import { baseUrlDaRequisicao, urlsDeMidia } from '../utils/urls';

// Quantidade mínima de releases no banco local para considerar que o termo
// já foi ingerido antes. Abaixo disso, força nova ingestão.
const MIN_RELEASES_LOCAL = 1;

// Intervalo entre resoluções de áudio na fila em segundo plano.
// A descoberta consulta sites abertos (motor de busca) e precisa de ritmo
// suave para não disparar proteções anti-bot das fontes.
const INTERVALO_ENTRE_RESOLUCOES = 8000;

// Quantas resoluções andam em paralelo. Com uma só, cada versão esperava a
// anterior terminar (8 s de intervalo + até 15 s de descoberta) e a primeira
// busca por um artista levava minutos para mostrar qualquer música. Três
// mantêm o ritmo educado em cada fonte e entregam os primeiros resultados
// em segundos.
const RESOLUCOES_SIMULTANEAS = 3;

// Fila em memória de releases aguardando descoberta de fonte de áudio.
// Regra do usuário: o app só exibe versões que têm áudio. As releases sem
// fonte ficam fora da resposta, mas são resolvidas aqui em segundo plano,
// uma a uma, para aparecerem nas próximas buscas.
interface ItemFilaResolucao {
  id: number;
  version_name: string;
  work_title: string;
  artist_name: string;
}

const filaResolucao: ItemFilaResolucao[] = [];
let processandoFila = false;

// Coloca na fila as releases sem áudio encontradas numa busca.
// Recebe apenas as que já vêm sem fonte do banco — não é preciso revalidar.
//
// As versões do termo RECÉM-BUSCADO entram na frente da fila: sem isso, a
// primeira busca por um artista ficava atrás de centenas de versões antigas
// (de buscas anteriores) e o usuário não via resultado nenhum por muito tempo.
// A ordem dentro do lote é preservada.
function enfileirarResolucoes(releases: ItemFilaResolucao[]): void {
  const novas: ItemFilaResolucao[] = [];
  const jaNoLote = new Set<number>();

  for (const r of releases) {
    if (jaNoLote.has(r.id)) continue;
    if (filaResolucao.some((item) => item.id === r.id)) continue;

    jaNoLote.add(r.id);
    novas.push({
      id:           r.id,
      version_name: r.version_name,
      work_title:   r.work_title,
      artist_name:  r.artist_name,
    });
  }

  if (novas.length === 0) return;

  filaResolucao.unshift(...novas);
  void processarFilaResolucao();
}

// Processa a fila com algumas resoluções em paralelo.
// Cada trabalhador tira o próximo item e, depois de resolver, espera o
// intervalo antes de pegar outro — o ritmo por fonte continua suave.
async function processarFilaResolucao(): Promise<void> {
  if (processandoFila) return;
  processandoFila = true;

  const trabalhador = async (): Promise<void> => {
    while (filaResolucao.length > 0) {
      const item = filaResolucao.shift();
      if (!item) return;

      try {
        // Re-checa no banco: se a fonte já foi salva por outro fluxo, pula
        const [linhas] = await pool.execute<RowDataPacket[]>(
          `SELECT audio_source_url FROM releases WHERE id = ? LIMIT 1`,
          [item.id]
        );
        if (linhas[0]?.['audio_source_url']) continue;

        const dados: DadosReleaseParaAudio = {
          id:                   item.id,
          audio_source_url:     null,
          audio_source_provider: null,
          audio_source_page_url: null,
          version_name:         item.version_name,
          work_title:           item.work_title,
          artist_name:          item.artist_name,
        };
        await resolverFonte(dados);
      } catch (erro) {
        console.error(
          `[SEARCH] Falha ao resolver áudio da release ${item.id}:`,
          erro instanceof Error ? erro.message : erro
        );
      }
      // Espaçamento para respeitar as fontes abertas consultadas
      await new Promise((resolve) => setTimeout(resolve, INTERVALO_ENTRE_RESOLUCOES));
    }
  };

  try {
    await Promise.all(
      Array.from({ length: RESOLUCOES_SIMULTANEAS }, () => trabalhador())
    );
  } finally {
    processandoFila = false;
  }
}

// Divide o termo em palavras pesquisáveis (mínimo 2 caracteres cada).
function separarPalavras(termo: string): string[] {
  return termo.trim().replace(/\s+/g, ' ').split(' ').filter((p) => p.length >= 2);
}

export interface CriterioBusca {
  // Filtro: recalled largo — toda versão que menciona as palavras do termo.
  clausula: string;
  paramsClausula: string[];
  // Relevância: expressão numérica (mais alto = mais perto do que foi pedido).
  relevancia: string;
  paramsRelevancia: string[];
}

// Letras que se escrevem com acento em português e espanhol. O REGEXP do MariaDB
// compara caixa sem se importar, mas não dobra acento: "legiao" não casaria
// "Legião" sem esta classe. Verificado em 26/10/2026 contra o banco real.
const LETRAS_COM_VARIANTES: Record<string, string> = {
  a: 'aàáâãäå',
  c: 'cç',
  e: 'eèéêë',
  i: 'iìíîï',
  n: 'nñ',
  o: 'oòóôõö',
  u: 'uùúûü',
  y: 'yÿ',
};

// Texto sem acentos, em minúsculas, para comparação e para montar padrões.
function semAcentos(texto: string): string {
  return texto.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

// Texto digitado pelo usuário transformado em padrão de expressão regular que
// aceita a mesma palavra escrita com ou sem acento.
function padraoSemAcento(texto: string): string {
  return semAcentos(texto)
    .split('')
    .map((caractere) => {
      const variantes = LETRAS_COM_VARIANTES[caractere];
      if (variantes) return `[${variantes}]`;
      // Qualquer coisa que a regex entenda como operador deixa de ser operador.
      return /[.*+?^${}()|[\]\\]/.test(caractere) ? `\\${caractere}` : caractere;
    })
    .join('');
}

// A palavra inteira, e não um pedaço dela: `[[:<:]]one[[:>:]]` casa "One More
// Time" e não casa "Someone" nem "Alcione".
function palavraInteira(palavra: string): string {
  return `[[:<:]]${padraoSemAcento(palavra)}[[:>:]]`;
}

// As palavras do termo na ordem em que foram digitadas, coladas pelo que houver
// entre elas no título (espaço, hífen, apóstrofo). "Baader-Meinhof" é uma frase só.
function padraoFrase(palavras: string[]): string {
  return `[[:<:]]${palavras.map(padraoSemAcento).join('[^[:alnum:]]+')}` + '[[:>:]]';
}

// Monta o critério da busca: o filtro continua sendo o AND de LIKE por palavra
// (para não esconder nenhuma versão disponível — Regra 2) e a relevância passa a
// decidir a ordem.
//
// Por que a ordem importa: com ORDER BY alfabético, a busca por "queen" abria com
// "Hairspray Queen" do Nirvana e a busca por "one" abria com "Someone Like You",
// porque o LIKE `%one%` também casa um pedaço de palavra. Medido em 26/10/2026:
// 260 obras contêm "one" como pedaço contra 181 que dizem a palavra.
//
// Escala (o casamento exato sempre vale mais que o parcial):
//   100 — o termo é exatamente o nome do artista/banda
//    90 — o termo é exatamente o título da obra ou da versão
//    20 — as palavras do termo, juntas e inteiras, aparecem no título
//    15 — as palavras do termo, juntas e inteiras, aparecem no nome do artista
//     6 — por palavra inteira encontrada no título
//     3 — por palavra inteira encontrada no nome do artista
// Abaixo disso o resto fica em zero e desce para o fim da lista: a versão continua
// na resposta (Regra 2), só não passa na frente do que foi realmente pedido.
//
// A igualdade usa a colação do banco (utf8mb4_unicode_ci): caixa e acento não
// precisam ser digitados como a fonte oficial publicou. O REGEXP dobra caixa mas
// NÃO dobra acento, então cada letra acentuável vira classe de caracteres.
export function montarCriterioBusca(termo: string): CriterioBusca | null {
  const palavras = separarPalavras(termo);
  if (palavras.length === 0) return null;

  const termoCompleto = palavras.join(' ');

  const blocos: string[] = [];
  const paramsClausula: string[] = [];
  for (const palavra of palavras) {
    const p = `%${palavra}%`;
    // Cada palavra deve aparecer em pelo menos um dos campos pesquisáveis
    blocos.push(`(w.title LIKE ? OR a.name LIKE ? OR r.version_name LIKE ? OR r.album_name LIKE ?)`);
    paramsClausula.push(p, p, p, p);
  }

  // Só entram na pontuação as palavras que têm letra ou número: um termo feito
  // de pontuação solta não gera padrão de expressão regular utilizável.
  const palavrasEscoraveis = palavras.filter((p) => /[a-z0-9]/.test(semAcentos(p)));
  const porPalavra = palavrasEscoraveis.map(palavraInteira);
  const frase = porPalavra.length > 0 ? padraoFrase(palavrasEscoraveis) : '';

  // Soma de palavras inteiras presentes em cada lado. O parêntese é obrigatório:
  // a aritmética vem depois da soma dos booleanos.
  const palavrasNoTitulo = palavrasEscoraveis
    .map(() => '(w.title REGEXP ? OR r.version_name REGEXP ?)')
    .join(' + ');
  const palavrasNoArtista = palavrasEscoraveis.map(() => 'a.name REGEXP ?').join(' + ');

  const relevancia =
    `CASE WHEN a.name = ? THEN 100 ` +
    `     WHEN w.title = ? OR r.version_name = ? THEN 90 ` +
    (porPalavra.length === 0
      ? `     ELSE 0 `
      : `     ELSE (w.title REGEXP ? OR r.version_name REGEXP ?) * 20 ` +
        `        + (a.name REGEXP ?) * 15 ` +
        `        + (${palavrasNoTitulo}) * 6 ` +
        `        + (${palavrasNoArtista}) * 3 `) +
    `END`;

  return {
    clausula: blocos.join(' AND '),
    paramsClausula,
    relevancia,
    // os ? abaixo seguem exatamente a ordem em que aparecem na expressão acima
    paramsRelevancia: [
      termoCompleto,                        // a.name =
      termoCompleto,                        // w.title =
      termoCompleto,                        // r.version_name =
      ...(porPalavra.length === 0
        ? []
        : [
            frase, frase,                   // frase inteira no título
            frase,                          // frase inteira no artista
            ...porPalavra.flatMap((p) => [p, p]), // palavras inteiras no título
            ...porPalavra,                  // palavras inteiras no artista
          ]),
    ],
  };
}

// Busca releases no banco local com todos os dados relacionados.
// Quando `somenteComAudio` é true (Regra 7), o filtro acontece no SQL — antes
// ele era aplicado só depois do LIMIT, então uma versão com áudio que caísse
// além da primeira página nunca aparecia e a página vinha vazia.
async function buscarReleasesLocal(
  termo: string,
  limit: number,
  offset: number,
  baseUrl: string = 'http://localhost:3001',
  somenteComAudio: boolean = false
): Promise<{ releases: ReleaseCompleto[]; total: number }> {
  // O termo vira filtro (recall largo) + relevância (ordem do que foi pedido)
  const criterio = montarCriterioBusca(termo);
  if (!criterio) return { releases: [], total: 0 };

  const { clausula, paramsClausula, relevancia, paramsRelevancia } = criterio;
  const filtroAudio = somenteComAudio ? ' AND r.audio_source_url IS NOT NULL' : '';

  // Consulta principal — JOIN entre todas as tabelas relacionadas
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT
       r.id,
       r.work_id,
       r.version_name,
       r.album_name,
       r.release_year,
       r.label,
       r.country,
       r.quality,
       r.cover_url,
       r.source_reference_url,
       r.audio_preview_url,
       r.audio_source_url,
       r.audio_source_provider,
       r.audio_source_page_url,
       rt.name        AS release_type,
       rt.category    AS release_type_category,
       ms.name        AS metadata_source,
       w.title        AS work_title,
       w.original_release_year,
       a.id           AS artist_id,
       a.name         AS artist_name,
       a.country      AS artist_country
     FROM releases r
     JOIN works          w  ON r.work_id          = w.id
     JOIN artists        a  ON w.artist_id         = a.id
     JOIN release_types  rt ON r.release_type_id   = rt.id
     JOIN metadata_sources ms ON r.metadata_source_id = ms.id
     WHERE ${clausula}${filtroAudio}
     ORDER BY (${relevancia}) DESC, a.name ASC, w.title ASC, r.release_year ASC, r.id ASC
     LIMIT ? OFFSET ?`,
    [...paramsClausula, ...paramsRelevancia, limit, offset]
  );

  // Contagem total para paginação — mesma condição da consulta principal
  const [countRows] = await pool.execute<RowDataPacket[]>(
    `SELECT COUNT(*) AS total
     FROM releases r
     JOIN works          w  ON r.work_id        = w.id
     JOIN artists        a  ON w.artist_id       = a.id
     WHERE ${clausula}${filtroAudio}`,
    paramsClausula
  );

  const total = (countRows[0]?.['total'] as number) ?? 0;

  const releases: ReleaseCompleto[] = rows.map(row => {
    const id = row['id'] as number;
    const midia = urlsDeMidia(baseUrl, id);
    return {
      id,
      work_id:              row['work_id'] as number,
      version_name:         row['version_name'] as string,
      album_name:           row['album_name'] as string | null,
      release_year:         row['release_year'] as number | null,
      label:                row['label'] as string | null,
      country:              row['country'] as string | null,
      quality:              row['quality'] as string | null,
      cover_url:            row['cover_url'] as string | null,      // null = sem capa oficial (Regra 1)
      source_reference_url: row['source_reference_url'] as string | null,
      audio_preview_url:    row['audio_preview_url'] as string | null,
      // Sempre aponta para os endpoints do backend (stream completo / download).
      // Os campos streaming_url/download_url do banco podem conter previews de 30s
      // (dados legados) e não devem ser usados como link de reprodução ou download.
      streaming_url:        midia.streaming_url,
      download_url:         midia.download_url,
      audio_source_url:     row['audio_source_url'] as string | null,
      audio_source_provider: row['audio_source_provider'] as string | null,
      audio_source_page_url: row['audio_source_page_url'] as string | null,
      release_type:         row['release_type'] as string,
      release_type_category: row['release_type_category'] as string,
      metadata_source:      row['metadata_source'] as string,
      work_title:           row['work_title'] as string,
      artist_id:            row['artist_id'] as number,
      artist_name:          row['artist_name'] as string,
      artist_country:       row['artist_country'] as string | null,
      original_release_year: row['original_release_year'] as number | null,
    };
  });

  return { releases, total };
}

// Busca as releases do termo que ainda NÃO têm fonte de áudio (Regra 7).
// Devolve a contagem total (para a resposta) e uma amostra limitada para a
// fila de resolução em segundo plano — nunca milhares de itens de uma vez.
async function buscarPendentesAudio(
  termo: string,
  limiteFila: number
): Promise<{ total: number; itens: ItemFilaResolucao[] }> {
  const criterio = montarCriterioBusca(termo);
  if (!criterio) return { total: 0, itens: [] };

  const { clausula, paramsClausula, relevancia, paramsRelevancia } = criterio;

  const [countRows] = await pool.execute<RowDataPacket[]>(
    `SELECT COUNT(*) AS total
     FROM releases r
     JOIN works   w ON r.work_id  = w.id
     JOIN artists a ON w.artist_id = a.id
     WHERE ${clausula} AND r.audio_source_url IS NULL`,
    paramsClausula
  );
  const total = (countRows[0]?.['total'] as number) ?? 0;

  if (total === 0) return { total: 0, itens: [] };

  // A amostra que vai para a fila sai pela relevância, não pelo alfabeto: o que
  // o usuário acabou de pedir é o primeiro a ganhar áudio descoberto.
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT r.id, r.version_name, w.title AS work_title, a.name AS artist_name
     FROM releases r
     JOIN works   w ON r.work_id  = w.id
     JOIN artists a ON w.artist_id = a.id
     WHERE ${clausula} AND r.audio_source_url IS NULL
     ORDER BY (${relevancia}) DESC, a.name ASC, w.title ASC, r.release_year ASC, r.id ASC
     LIMIT ?`,
    [...paramsClausula, ...paramsRelevancia, limiteFila]
  );

  const itens: ItemFilaResolucao[] = rows.map(row => ({
    id:           row['id'] as number,
    version_name: row['version_name'] as string,
    work_title:   row['work_title'] as string,
    artist_name:  row['artist_name'] as string,
  }));

  return { total, itens };
}

// Quanto tempo a primeira resposta da busca espera a ingestão de um termo novo.
// O aplicativo aborta a requisição em 45 s (TIMEOUT_MS de mobile/src/services/api.ts);
// este teto fica bem abaixo disso para que a resposta chegue antes de o cliente
// desistir. A ingestão não é cancelada: ela continua em segundo plano e a tela
// se preenche sozinha pelas reconsultas leve=1.
const AGUARDA_INGESTAO_MS = 15000;

function esperar(ms: number): Promise<void> {
  return new Promise((resolver) => setTimeout(resolver, ms));
}

// Handler do GET /api/search?q={termo}
export async function buscarMusicas(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const termo  = (req.query['q'] as string).trim();
    const limit  = Math.min(parseInt(req.query['limit']  as string || '50', 10), 100);
    const offset = Math.max(parseInt(req.query['offset'] as string || '0',  10), 0);
    const page   = Math.floor(offset / limit) + 1;

    // Atualização leve (`leve=1`): o aplicativo usa isto para reconsultar a
    // tela enquanto o backend procura as fontes de áudio em segundo plano.
    // Responde só com o banco local e NÃO dispara ingestão — sem isso, um
    // atualizador automático chamaria MusicBrainz e Discogs a cada poucos
    // segundos e estouraria o rate limit das fontes.
    const leve = req.query['leve'] === '1';

    const baseUrl = baseUrlDaRequisicao(req);

    // Tenta busca local primeiro (já filtrada pela Regra 7 no SQL)
    const local = await buscarReleasesLocal(termo, limit, offset, baseUrl, true);

    // Regra do usuário: só exibir versões que têm áudio. As demais saem da
    // resposta, mas entram na fila de resolução em segundo plano.
    const pendentesLocal = await buscarPendentesAudio(termo, 200);
    enfileirarResolucoes(pendentesLocal.itens);

    // Atualização leve: responde com o estado atual do banco e mantém a fila
    // de resolução andando, mas não chama as fontes de metadados de novo.
    // É o caminho usado pela atualização automática da tela de busca.
    if (leve) {
      const respostaLeve: RespostaPaginada<ReleaseCompleto> = {
        success: true,
        data: {
          results:         local.releases,
          total:           local.total,
          page,
          per_page:        limit,
          fromCache:       true,
          pendentes_audio: pendentesLocal.total,
          // A atualização leve também informa se ainda há ingestão do termo em
          // curso: é ela que segura a tela atualizando enquanto o backend monta
          // o catálogo, mesmo quando ainda não há nenhuma versão pendente no
          // banco para contar.
          ingestao_em_curso: haIngestaoEmCurso(termo),
        },
      };
      res.json(respostaLeve);
      return;
    }

    // Se há dados locais suficientes, responde direto (do banco local = "cache" natural)
    if (local.total + pendentesLocal.total >= MIN_RELEASES_LOCAL) {
      // Regra do usuário: nunca reutilizar buscas idênticas. Mesmo com dados
      // locais, dispara uma ingestão NOVA em segundo plano (limpa o cache do
      // termo e consulta as fontes externas de novo). A resposta sai rápida
      // do banco local; a atualização fica pronta para as próximas buscas.
      //
      // Quando a ingestão termina, as versões que ela acabou de criar (faixas
      // de discos do artista, por exemplo) entram na FRENTE da fila. Sem
      // isso, elas só seriam resolvidas na busca seguinte e o usuário ficaria
      // olhando uma lista vazia mesmo com músicas recém-catalogadas.
      void ingerirPorTermo(termo)
        .then(async () => {
          const recemCatalogadas = await buscarPendentesAudio(termo, 200);
          enfileirarResolucoes(recemCatalogadas.itens);
        })
        .catch((erro) => {
          console.error(
            '[SEARCH] Ingestão em segundo plano falhou:',
            erro instanceof Error ? erro.message : erro
          );
        });

      const resposta: RespostaPaginada<ReleaseCompleto> = {
        success: true,
        data: {
          results:         local.releases,
          total:           local.total,
          page,
          per_page:        limit,
          fromCache:       true,
          pendentes_audio: pendentesLocal.total,
          // Acabamos de disparar a ingestão deste termo em segundo plano.
          ingestao_em_curso: haIngestaoEmCurso(termo),
        },
      };
      res.json(resposta);
      return;
    }

    // Sem dados locais — a ingestão consulta MusicBrainz e Discogs e, para um
    // artista com discografia, passa de um minuto. Esperar até o fim derrubava a
    // primeira busca de um termo novo: o aplicativo desistia em 45 s e a tela
    // ficava sem nada no meio de um trabalho que ainda estava rodando aqui.
    //
    // A espera é limitada. O que já está no banco responde na hora, a ingestão
    // segue em segundo plano e o aplicativo reconsulta (leve=1) enquanto
    // ingestao_em_curso for true — é assim que a lista aparece sozinha, sem
    // consulta repetida às fontes externas e sem inventar resultado.
    const ingestao = ingerirPorTermo(termo).catch((erro) => {
      console.error(
        '[SEARCH] Ingestão falhou, respondendo só com dados locais:',
        erro instanceof Error ? erro.message : erro
      );
    });
    await Promise.race([ingestao, esperar(AGUARDA_INGESTAO_MS)]);

    // Consulta o banco com o mesmo filtro da Regra 7 — com o que a ingestão já
    // conseguiu gravar até aqui.
    const posIngestion = await buscarReleasesLocal(termo, limit, offset, baseUrl, true);

    // Mesma regra: sem áudio, sem exibição. E o que sobrou entra na fila.
    const pendentesPos = await buscarPendentesAudio(termo, 200);
    enfileirarResolucoes(pendentesPos.itens);

    const resposta: RespostaPaginada<ReleaseCompleto> = {
      success: true,
      data: {
        results:         posIngestion.releases,
        total:           posIngestion.total,
        page,
        per_page:        limit,
        fromCache:       false,
        pendentes_audio: pendentesPos.total,
        // Se a ingestão ultrapassou o teto de espera acima ela continua aqui:
        // o sinal diz ao aplicativo para continuar reconsultando o banco leve.
        ingestao_em_curso: haIngestaoEmCurso(termo),
      },
    };
    res.json(resposta);
  } catch (err) {
    next(err);
  }
}

// Handler do POST /api/search/ingest
// Uso interno: força resincronização manual de um termo (manutenção/admin).
export async function forcarIngestion(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { q } = req.body as { q?: string };

    if (!q || typeof q !== 'string' || q.trim().length === 0) {
      throw new ErroAplicacao('Campo "q" é obrigatório no body.', 400);
    }

    const resultado = await ingerirPorTermo(q.trim());

    res.json({
      success: true,
      data: {
        termo:           q.trim(),
        worksCreated:    resultado.worksCreated,
        releasesCreated: resultado.releasesCreated,
        fontesChamadas:  resultado.fontesChamadas,
        fromCache:       resultado.fromCache,
      },
    });
  } catch (err) {
    next(err);
  }
}
