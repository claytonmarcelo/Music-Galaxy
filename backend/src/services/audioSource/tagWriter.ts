// Etiquetas e capa dentro do arquivo de áudio — a mesma métrica dos
// gerenciadores de download: o arquivo que sai do Music Galaxy chega identificável
// em qualquer tocador, com artista, título, álbum e ano gravados nas etiquetas e a
// capa oficial embutida (Regra 1: exclusivamente a capa que a fonte publicou —
// nenhuma capa gerada, nenhuma capa de outra música).
//
// O FFmpeg é chamado pelo próprio binário já usado no projeto (ffmpeg-static), com
// argv em array: nenhum nome oficial escapa por shell, então "Björk", "Guns N'
// Roses" e "AC/DC" entram no arquivo exatamente como a fonte publicou (Regra 8).
//
// Nada aqui é obrigatório para o download existir: se o FFmpeg falhar, o chamador
// entrega o arquivo validado sem etiquetas. O áudio nunca é reescrito — só
// copiado (-c copy), para não perder qualidade no caminho. Junto com a identidade
// vão as etiquetas de ganho medidas no próprio arquivo (loudness.ts): o "volume
// auto" é um número que o tocador aplica na reprodução, não um processamento que
// achata a faixa antes de ela chegar ao usuário.

import { spawn } from 'child_process';
import fs from 'fs/promises';
import axios from 'axios';
import ffmpegPath from 'ffmpeg-static';
import { USER_AGENT, auditarUrl, criarAgentesSeguros, criarBeforeRedirect } from './webAudio';
import type { EtiquetasDeGanho } from './loudness';

// O que se grava no arquivo. Tudo vem do banco, como a fonte oficial publicou.
export interface EtiquetasAudio {
  artista: string;
  titulo: string;
  album?: string | null;
  ano?: number | string | null;
  gravadora?: string | null;
}

export interface ResultadoEtiquetagem {
  etiquetasGravadas: boolean;
  capaEmbutida: boolean;
}

// A capa é um arquivo de imagem já publicado pela fonte; 8 MB é folgado o bastante
// para qualquer encarte frontal e ainda protege o pipeline de um corpo infinito.
const TAMANHO_MAX_CAPA = 8 * 1024 * 1024;
const TEMPO_MAXIMO_ETIQUETAGEM_MS = 60_000;

// Baixa a capa oficial para um arquivo temporário. Sem capa, sem imagem embutida —
// o placeholder "Sem Capa" do aplicativo continua sendo a verdade do banco.
async function baixarCapaOficial(
  capaUrl: string,
  destino: string
): Promise<boolean> {
  try {
    const auditada = await auditarUrl(capaUrl);
    if (!auditada.ok) {
      console.warn(`[TagWriter] Capa rejeitada pelo guard: ${auditada.motivo}`);
      return false;
    }

    const resposta = await axios.get(auditada.url!.href, {
      responseType: 'arraybuffer',
      timeout: 15_000,
      maxRedirects: 3,
      beforeRedirect: criarBeforeRedirect(),
      maxContentLength: TAMANHO_MAX_CAPA,
      headers: { 'User-Agent': USER_AGENT, Accept: 'image/*' },
      ...criarAgentesSeguros(),
    });

    const tipoConteudo = String(resposta.headers['content-type'] ?? '').toLowerCase();
    if (!tipoConteudo.startsWith('image/')) {
      console.warn(`[TagWriter] Fonte da capa não devolveu imagem (${tipoConteudo || 'desconhecido'})`);
      return false;
    }

    await fs.writeFile(destino, Buffer.from(resposta.data));
    return true;
  } catch (erro: unknown) {
    const mensagem = erro instanceof Error ? erro.message : String(erro);
    console.warn(`[TagWriter] Capa indisponível, arquivo sai sem imagem: ${mensagem}`);
    return false;
  }
}

// Executa o FFmpeg copiando o áudio e reescrevendo só o contêiner de etiquetas.
function executarFfmpeg(parametros: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const binario = ffmpegPath || 'ffmpeg';
    const processo = spawn(binario, ['-hide_banner', '-loglevel', 'error', '-y', ...parametros]);

    const temporizador = setTimeout(() => {
      processo.kill('SIGKILL');
      reject(new Error(`Timeout ao gravar etiquetas (${TEMPO_MAXIMO_ETIQUETAGEM_MS / 1000}s)`));
    }, TEMPO_MAXIMO_ETIQUETAGEM_MS);
    temporizador.unref?.();

    let stderr = '';
    processo.stderr.on('data', (pedaco: Buffer) => {
      if (pedaco.length < 4000) stderr += pedaco.toString('utf8');
    });

    processo.on('error', (erro) => {
      clearTimeout(temporizador);
      reject(erro);
    });
    processo.on('close', (codigo) => {
      clearTimeout(temporizador);
      if (codigo === 0) resolve();
      else reject(new Error(`FFmpeg saiu com código ${codigo}: ${stderr.trim().slice(0, 300)}`));
    });
  });
}

/**
 * Monta o argv do FFmpeg. Separado da execução para que o teste confira os
 * nomes oficiais (apóstrofo, acento, barra) sem depender do binário.
 */
export function montarParametrosDeEtiquetagem(opcoes: {
  arquivoOrigem: string;
  destino: string;
  formato: 'mp3' | 'flac';
  etiquetas: EtiquetasAudio;
  caminhoCapa?: string | null;
  ganho?: EtiquetasDeGanho | null;
}): string[] {
  const { arquivoOrigem, destino, formato, etiquetas, caminhoCapa } = opcoes;

  // Toda opção de mapa vem DEPOIS dos `-i`. O FFmpeg lê opção colocada entre dois
  // arquivos como pertencendo ao arquivo que a segue: medido em 26/10/2026, o
  // `-map 0:a:0` antes da capa fazia o binário encerrar com "Option map cannot be
  // applied to input url ...capa" (código -22) e o download saía sem etiquetas.
  const parametros: string[] = ['-i', arquivoOrigem];
  if (caminhoCapa) parametros.push('-i', caminhoCapa);

  // `-map 0:a:0` só a primeira faixa de áudio: descarta qualquer imagem que o
  // upload trouxe, para a capa embutida ser sempre a oficial desta versão.
  parametros.push('-map', '0:a:0');
  if (caminhoCapa) {
    parametros.push('-map', '1:v:0', '-c:v:0', 'copy', '-disposition:v:0', 'attached_pic');
  }
  parametros.push('-c:a', 'copy');

  if (formato === 'mp3') {
    // ID3v2.3 é o que o Android e os tocadores de DJ leem sem conversa; o v1
    // residual ajuda leitores antigos que só abrem o rodapé do arquivo.
    parametros.push('-id3v2_version', '3', '-write_id3v1', '1');
  }

  // `-map_metadata -1` parte de uma folha em branco: o upload traz as etiquetas
  // dele, e elas discordam da identidade oficial (medido em 26/10/2026: o MP3 da
  // release 1505 vinha com `album_artist=Smoke Dza` e
  // `comment=MixFiend.com / MixtapeTorrent.com` ao lado do nome oficial
  // "Smoke DZA", e `track=06` é a posição na compilação, não nesta versão).
  // Regra 8 não permite nome escrito de outra forma dentro do arquivo.
  parametros.push('-map_metadata', '-1');

  if (etiquetas.artista) parametros.push('-metadata', `artist=${etiquetas.artista}`);
  if (etiquetas.titulo) parametros.push('-metadata', `title=${etiquetas.titulo}`);
  if (etiquetas.album) parametros.push('-metadata', `album=${etiquetas.album}`);
  if (etiquetas.ano) parametros.push('-metadata', `date=${String(etiquetas.ano)}`);
  if (etiquetas.gravadora) parametros.push('-metadata', `publisher=${etiquetas.gravadora}`);
  // O álbum se organiza pelo artista oficial; Serato e leitores de biblioteca
  // usam essa par quando `artist` traz o crédito da faixa.
  if (etiquetas.artista) parametros.push('-metadata', `album_artist=${etiquetas.artista}`);

  // Ganho medido no próprio arquivo (loudness.ts): o tocador aplica o volume na
  // reprodução, o áudio não é reescrito. Uppercase é a grafia que os medidores
  // consagrados gravam e a que as bibliotecas de DJ procuram.
  if (opcoes.ganho) {
    parametros.push('-metadata', `REPLAYGAIN_TRACK_GAIN=${opcoes.ganho.replayGainTrackGain}`);
    parametros.push('-metadata', `REPLAYGAIN_TRACK_PEAK=${opcoes.ganho.replayGainTrackPeak}`);
    // R128_TRACK_GAIN é etiqueta de Vorbis comment (FLAC/Opus); num MP3 viraria
    // um TXXX que nenhum leitor de ID3 conhece, então só vai no FLAC.
    if (formato === 'flac') {
      parametros.push('-metadata', `R128_TRACK_GAIN=${opcoes.ganho.r128TrackGain}`);
    }
  }

  if (caminhoCapa) {
    // Etiqueta da própria imagem: "front cover" é o que o tocador usa como capa.
    parametros.push('-metadata:s:v:0', 'title=Album cover', '-metadata:s:v:0', 'comment=Cover (front)');
  }

  parametros.push(destino);
  return parametros;
}

/**
 * Grava as etiquetas (e a capa oficial, quando existe) em um arquivo novo.
 * Devolve o caminho do arquivo etiquetado quando deu certo; devolve `null`
 * quando não deu, e o chamador segue com o arquivo original.
 */
export async function gravarEtiquetas(opcoes: {
  arquivoOrigem: string;
  destino: string;
  formato: 'mp3' | 'flac';
  etiquetas: EtiquetasAudio;
  capaUrl?: string | null;
  ganho?: EtiquetasDeGanho | null;
}): Promise<ResultadoEtiquetagem | null> {
  const { arquivoOrigem, destino, formato, etiquetas } = opcoes;
  const caminhoCapa = `${destino}.capa`;
  let temCapa = false;

  if (opcoes.capaUrl) {
    temCapa = await baixarCapaOficial(opcoes.capaUrl, caminhoCapa);
  }

  const parametros = montarParametrosDeEtiquetagem({
    arquivoOrigem,
    destino,
    formato,
    etiquetas,
    caminhoCapa: temCapa ? caminhoCapa : null,
    ganho: opcoes.ganho ?? null,
  });

  try {
    await executarFfmpeg(parametros);
    return { etiquetasGravadas: true, capaEmbutida: temCapa };
  } catch (erro: unknown) {
    const mensagem = erro instanceof Error ? erro.message : String(erro);
    console.warn(`[TagWriter] Etiquetas não gravadas (arquivo entregue como está): ${mensagem}`);
    return null;
  } finally {
    await fs.unlink(caminhoCapa).catch(() => undefined);
  }
}
