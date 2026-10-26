// Testes da rodada de 26/10/2026 em que "soul ii soul" não encontrava nada.
//
// O que foi medido antes de escrever qualquer linha: o catálogo tinha 349 versões
// do Soul II Soul e nenhuma com áudio; a busca real do Archive com o artista entre
// aspas (`creator:("Soul II Soul")`) devolvia 0 itens porque o upload se chama
// "Soul II Soul's KEEP ON MOVIN'", e a Marginalia respondia HTTP 200 com a página
// legítima de "No search results found." que o provedor lia como bloqueio anti-bot
// e punia com cooldown de 5 a 120 minutos. As quatro regras abaixo são exatamente
// esses quatro comportamentos, travados para não voltarem.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { montarConsultasDoArchive, termosLuceneDoNome } from '../../src/services/audioSource/providers/internetArchiveProvider';
import {
  hePaginaDeEspera,
  hePaginaSemResultado,
  heDesafioAntiBot,
} from '../../src/services/audioSource/providers/genericWebProvider';
import { montarParametrosDeEtiquetagem } from '../../src/services/audioSource/tagWriter';
import { calcularEtiquetasDeGanho, interpretarSaidaEbur128 } from '../../src/services/audioSource/loudness';
import { montarNomeArquivo, escolherBitrateMp3 } from '../../src/controllers/audioController';

// ---------- Internet Archive: as consultas, na ordem de precisão ----------

test('a consulta larga do artista é ADITIVA: as três frases exatas continuam primeiro', () => {
  const consultas = montarConsultasDoArchive({ artist: 'Soul II Soul', title: 'Keep On Movin' });

  assert.equal(consultas.length, 4);
  // 1 e 2 pedem artista + título como frase; 3 pede só o artista como frase.
  assert.ok(consultas[0]!.includes('(creator:("Soul II Soul") OR title:("Soul II Soul"))'), consultas[0]);
  assert.ok(consultas[0]!.includes('(title:("Keep On Movin") OR "Keep On Movin")'), consultas[0]);
  assert.ok(consultas[1]!.startsWith('mediatype:audio AND creator:("Soul II Soul") AND'), consultas[1]);
  assert.equal(consultas[2], 'mediatype:audio AND (creator:("Soul II Soul") OR title:("Soul II Soul"))');
});

test('a quarta consulta afrouxa só o artista e mantém o título como frase', () => {
  const consultas = montarConsultasDoArchive({ artist: 'Soul II Soul', title: 'Keep On Movin' });
  const larga = consultas[3]!;

  assert.ok(larga.includes('creator:(Soul AND II AND Soul)'), `artista sem frase: ${larga}`);
  assert.ok(larga.includes('title:("Keep On Movin")'), `título continua frase: ${larga}`);
  assert.ok(!larga.includes('creator:("Soul II Soul")'), 'a consulta larga não pode exigir a frase');
});

test('termosLuceneDoNome descarta a pontuação que o índice não guarda', () => {
  assert.equal(termosLuceneDoNome("Soul II Soul's"), 'Soul AND II AND Soul');
  assert.equal(termosLuceneDoNome("Guns N' Roses"), 'Guns AND Roses');
  assert.equal(termosLuceneDoNome('AC/DC'), 'AC AND DC');
  assert.equal(termosLuceneDoNome(''), '');
});

test('sem artista ou sem título não há consulta — o provedor não sai atirando', () => {
  assert.deepEqual(montarConsultasDoArchive({ artist: '', title: 'Qualquer' }), []);
  assert.deepEqual(montarConsultasDoArchive({ artist: 'Alcione', title: '   ' }), []);
});

// ---------- Motor de busca: as três leituras de uma página ----------

// Página real da Marginalia (16.285 bytes) depois de atravessar a espera dela.
const PAGINA_SEM_RESULTADO = `
  <h1>Marginalia Search - zzzqxvbnmtklwmp3naoexiste</h1>
  <p>No search results found. If you believe this is an error, consider either
     submitting an issue on GitHub.</p>
  <p>Showing 0 search results.</p>`;

// Página real da Marginalia (1.051 bytes) quando o motor está segurando o cliente.
const PAGINA_DE_ESPERA = `
  <title>Error</title>
  <h1>Wait For A Moment</h1>
  <p>The search engine is currently barraged by queries from bots</p>
  <p>Please wait for <b id="countdown">2</b> seconds.</p>`;

// Página real da Marginalia com 25 blocos de resultado.
const PAGINA_COM_RESULTADOS = `
  <section class="card search-result"><h2>Soul II Soul - Keep On Movin</h2></section>
  <section class="card search-result"><h2>Volume II: 1990 A New Decade</h2></section>`;

test('página honesta de "sem resultados" não é bloqueio anti-bot', () => {
  assert.equal(hePaginaSemResultado(PAGINA_SEM_RESULTADO), true);
  assert.equal(hePaginaDeEspera(PAGINA_SEM_RESULTADO), false);
  assert.equal(heDesafioAntiBot(PAGINA_SEM_RESULTADO), false);
});

test('página de espera é esperada, e não lida como "o motor não achou nada"', () => {
  assert.equal(hePaginaDeEspera(PAGINA_DE_ESPERA), true);
  assert.equal(hePaginaSemResultado(PAGINA_DE_ESPERA), false);
});

test('lista de resultados não cai em nenhuma das duas armadilhas', () => {
  assert.equal(hePaginaSemResultado(PAGINA_COM_RESULTADOS), false);
  assert.equal(hePaginaDeEspera(PAGINA_COM_RESULTADOS), false);
  assert.equal(heDesafioAntiBot(PAGINA_COM_RESULTADOS), false);
});

test('captcha de verdade continua sendo captcha', () => {
  assert.equal(heDesafioAntiBot('Please schedule a captcha to continue'), true);
  assert.equal(heDesafioAntiBot('we noticed fairly aggressive bot activity from your IP'), true);
});

// ---------- Download: a métrica do gerenciador, com o nome oficial (Regra 8) ----------

test('as etiquetas entram no arquivo com o nome oficial, sem escaping de shell', () => {
  const parametros = montarParametrosDeEtiquetagem({
    arquivoOrigem: 'a/sOURCE.mp3',
    destino: 'a/OUTPUT.mp3',
    formato: 'mp3',
    etiquetas: {
      artista: "Soul II Soul",
      titulo: "Keep On Movin'",
      album: 'Keep On Movin',
      ano: 1989,
      gravadora: 'Virgin',
    },
    caminhoCapa: 'a/OUTPUT.mp3.capa',
  });

  assert.ok(parametros.includes(`title=Keep On Movin'`), `título oficial intacto: ${parametros.join(' ')}`);
  assert.ok(parametros.includes('artist=Soul II Soul'));
  assert.ok(parametros.includes('album=Keep On Movin'));
  assert.ok(parametros.includes('date=1989'));
  assert.ok(parametros.includes('publisher=Virgin'));
  assert.ok(parametros.includes('-id3v2_version'), 'MP3 sai com ID3v2.3');
  assert.ok(parametros.includes('-write_id3v1'), 'e o v1 para leitores antigos');
  assert.equal(parametros.filter((p) => p === '-map').length, 2, 'só o áudio e a capa saem no arquivo');
  assert.ok(parametros.includes('attached_pic'), 'a imagem entra como capa, não como vídeo');
});

// O formato do argv é o que faz o FFmpeg aceitar ou recusar o comando, e a opção
// colocada ENTRE dois `-i` pertence ao arquivo que vem depois dela. Medido em
// 26/10/2026: o `-map 0:a:0` antes da capa derrubava o binário com "Option map
// cannot be applied to input url ...capa" (código -22), o pipeline caía no
// fallback e o download saía com as etiquetas do upload — sem erro para o
// usuário. Este teste é a barreira.
test('nenhuma opção de mapa aparece antes do último arquivo de entrada', () => {
  const parametros = montarParametrosDeEtiquetagem({
    arquivoOrigem: 'a/SOURCE.mp3',
    destino: 'a/OUTPUT.mp3',
    formato: 'mp3',
    etiquetas: { artista: 'Smoke DZA', titulo: 'Two One Two' },
    caminhoCapa: 'a/OUTPUT.mp3.capa',
  });

  const ultimoEntrada = parametros.lastIndexOf('-i');
  const primeiroMapa = parametros.indexOf('-map');
  assert.ok(
    ultimoEntrada < primeiroMapa,
    `os dois -i vêm antes de -map: ${parametros.join(' ')}`
  );
  assert.equal(parametros.filter((p) => p === '-i').length, 2, 'áudio e capa entram como entradas');
  assert.ok(parametros.indexOf('-map_metadata') > primeiroMapa, 'a limpeza de metadados é opção de saída');
});

test('as etiquetas do upload não sobrevivem ao lado do nome oficial', () => {
  const parametros = montarParametrosDeEtiquetagem({
    arquivoOrigem: 'a/SOURCE.mp3',
    destino: 'a/OUTPUT.mp3',
    formato: 'mp3',
    etiquetas: { artista: 'Smoke DZA', titulo: 'Two One Two', album: 'Cuz I Felt Like It' },
    caminhoCapa: null,
  });

  assert.ok(parametros.includes('-1'), 'parte de uma folha em branco');
  assert.ok(parametros.includes('album_artist=Smoke DZA'), 'o álbum usa o mesmo nome oficial');
  assert.ok(
    !parametros.some((p) => p.startsWith('album_artist=') && p !== 'album_artist=Smoke DZA'),
    'não há segunda grafia do artista'
  );
});

test('sem capa no banco o arquivo sai etiquetado e sem imagem (Regra 1)', () => {
  const parametros = montarParametrosDeEtiquetagem({
    arquivoOrigem: 'a/SOURCE.flac',
    destino: 'a/OUTPUT.flac',
    formato: 'flac',
    etiquetas: { artista: 'Legião Urbana', titulo: 'Tempo Perdido', album: 'Dois', ano: 1986 },
    caminhoCapa: null,
  });

  assert.ok(!parametros.some((p) => p.includes('attached_pic')));
  assert.ok(!parametros.some((p) => p.includes('-id3v2_version')), 'FLAC não leva ID3');
  assert.ok(parametros.includes('artist=Legião Urbana'), 'acento preservado como a fonte publicou');
});

test('o nome do arquivo não repete o mesmo título duas vezes', () => {
  const libras = {
    id: 1,
    audio_source_url: null,
    audio_source_provider: null,
    audio_source_page_url: null,
    version_name: 'Running Up That Hill (A Deal With God)',
    work_title: 'Running Up That Hill (A Deal With God)',
    artist_name: 'Kate Bush',
    album_name: 'Hounds of Love',
    release_year: 1985,
    label: null,
    cover_url: null,
  };

  assert.equal(montarNomeArquivo(libras), 'Kate Bush - Hounds of Love - Running Up That Hill (A Deal With God)');

  // Single em que obra, disco e faixa têm o mesmo nome oficial: sai uma vez só.
  assert.equal(
    montarNomeArquivo({ ...libras, album_name: 'Da Funk', work_title: 'Da Funk', version_name: 'Da Funk', artist_name: 'Daft Punk' }),
    'Daft Punk - Da Funk'
  );

  // Disco sem nome no banco: o nome do arquivo não pode sair com " -  - ".
  assert.equal(
    montarNomeArquivo({ ...libras, album_name: null, artist_name: 'deadmau5', version_name: 'Ghosts n Stuff' }),
    'deadmau5 - Ghosts n Stuff'
  );
});

// ---------- Volume auto: a medida real vira etiqueta, o áudio não é reescrito ----------

// Saída VERDADEIRA do `ebur128=peak=true` do FFmpeg deste projeto, colada do
// stderr ao analisar cache/audio/85ac119d…mp3 (release 3294) em 26/10/2026.
const SUMARIO_EBUR128_REAL = `[aost#0:0/pcm_s16le @ 000001ff] Output #0, null, to 'NUL':
size=N/A time=00:03:25.30 bitrate=N/A speed=75.7x
[Parsed_ebur128_0 @ 000001ff69479000] t: 205.3      TARGET:-23 LUFS    M: -58.9 S: -37.3     I:  -9.1 LUFS       LRA:   4.0 LU  FTPK: -50.8 -50.1 dBFS  TPK:  -0.2  -0.2 dBFS
[out#0/null @ 000001ff69440600] video:0kB audio:35370kB subtitle:0kB other streams:0kB muxing overhead: unknown
[Parsed_ebur128_0 @ 000001ff69479000] Summary:

  Integrated loudness:
    I:          -9.1 LUFS
    Threshold: -19.2 LUFS

  Loudness range:
    LRA:         4.0 LU
    Threshold: -29.1 LUFS
    LRA low:   -11.7 LUFS
    LRA high:   -7.8 LUFS

  True peak:
    Peak:       -0.2 dBFS
`;

test('o sumário real do FFmpeg é lido sem depender das linhas de progresso', () => {
  assert.deepEqual(interpretarSaidaEbur128(SUMARIO_EBUR128_REAL), {
    integradoLufs: -9.1,
    picoDbtp: -0.2,
    lraLu: 4.0,
  });
});

test('as etiquetas dos dois padrões saem da mesma medida', () => {
  const medida = interpretarSaidaEbur128(SUMARIO_EBUR128_REAL);
  assert.ok(medida);

  const etiquetas = calcularEtiquetasDeGanho(medida);
  // ReplayGain: referência clássica de -18 LUFS → -18 - (-9.1) = -8.90 dB (a
  // faixa já está alta, então o ganho é negativo: o tocador a ABAIXA).
  assert.equal(etiquetas.replayGainTrackGain, '-8.90 dB');
  // -0.2 dBTP em amplitude linear = 10^(-0.2/20) = 0,9772.
  assert.equal(etiquetas.replayGainTrackPeak, '0.9772');
  // EBU R128: deslocamento até -23 LUFS em centibel.
  assert.equal(etiquetas.r128TrackGain, '-1390');
});

test('faixa quieta recebe sinal de mais e o R128 zera no alvo', () => {
  const etiquetas = calcularEtiquetasDeGanho({ integradoLufs: -23, picoDbtp: -1, lraLu: 6 });

  assert.equal(etiquetas.replayGainTrackGain, '+5.00 dB');
  assert.equal(etiquetas.replayGainTrackPeak, '0.8913');
  assert.equal(etiquetas.r128TrackGain, '0');
});

test('sem sumário, ou com pista muda, nenhuma etiqueta de ganho é inventada', () => {
  assert.equal(interpretarSaidaEbur128(''), null);
  assert.equal(interpretarSaidaEbur128('[Parsed_ebur128_0] sem nada aqui'), null);
  // FFmpeg imprime `-inf` em pista silenciosa: não é número, logo não é ganho.
  assert.equal(
    interpretarSaidaEbur128('Summary:\n\n  Integrated loudness:\n    I:          -inf LUFS\n\n  True peak:\n    Peak:       -inf dBFS\n'),
    null
  );
});

test('as etiquetas de ganho entram no arquivo com a grafia dos medidores', () => {
  const parametros = montarParametrosDeEtiquetagem({
    arquivoOrigem: 'a/SOURCE.mp3',
    destino: 'a/OUTPUT.mp3',
    formato: 'mp3',
    etiquetas: { artista: 'Shiraz Lane', titulo: 'Back to Life', album: 'Layla', ano: 2022 },
    caminhoCapa: null,
    ganho: { replayGainTrackGain: '-8.90 dB', replayGainTrackPeak: '0.9772', r128TrackGain: '-1390' },
  });

  assert.ok(parametros.includes('REPLAYGAIN_TRACK_GAIN=-8.90 dB'), parametros.join(' '));
  assert.ok(parametros.includes('REPLAYGAIN_TRACK_PEAK=0.9772'));
  // O áudio continua só copiado: medir volume não dá direito de reempacotar.
  assert.ok(parametros.includes('copy'));
  assert.ok(!parametros.some((p) => /loudnorm|aresample|dynaudnorm/.test(p)), 'nada de normalização no arquivo');
});

test('R128_TRACK_GAIN vai só no FLAC — no MP3 seria um TXXX que ninguém lê', () => {
  const ganho = { replayGainTrackGain: '+1.00 dB', replayGainTrackPeak: '1.1220', r128TrackGain: '400' };
  const base = {
    destino: 'a/OUTPUT',
    etiquetas: { artista: 'Guns N’ Roses', titulo: 'November Rain' },
    caminhoCapa: null,
    ganho,
  };

  const mp3 = montarParametrosDeEtiquetagem({ ...base, arquivoOrigem: 'a/S.mp3', destino: 'a/O.mp3', formato: 'mp3' });
  const flac = montarParametrosDeEtiquetagem({ ...base, arquivoOrigem: 'a/S.flac', destino: 'a/O.flac', formato: 'flac' });

  assert.ok(!mp3.some((p) => p.includes('R128_TRACK_GAIN')), mp3.join(' '));
  assert.ok(flac.includes('R128_TRACK_GAIN=400'), flac.join(' '));
});

// ---------- Qualidade honesta: a taxa do MP3 respeita o que a fonte entrega ----------

test('um MP3 de 128 kbps da fonte não sai etiquetado como 320 kbps', () => {
  // O caso que existia: todo download era codificado a 320 k, inclusive o que
  // chegou de um upload em 128 k — arquivo maior, mesma informação, e a tela
  // dizendo 320 kbps.
  assert.equal(escolherBitrateMp3(128, false), 128);
  assert.equal(escolherBitrateMp3(192, false), 192);
  assert.equal(escolherBitrateMp3(245, false), 224, 'taxa fora da escada cai para a de baixo');
  assert.equal(escolherBitrateMp3(320, false), 320);
  assert.equal(escolherBitrateMp3(48, false), 64, 'nada abaixo da menor taxa CBR do MP3');
});

test('sem perdas e fonte sem taxa conhecida usam o topo da escada', () => {
  assert.equal(escolherBitrateMp3(96, true), 320, 'FLAC/Vinyl de origem: pode ir a 320');
  assert.equal(escolherBitrateMp3(null, false), 320, 'ffprobe sem taxa: não se aperta o áudio às cegas');
});
