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
import { montarNomeArquivo } from '../../src/controllers/audioController';

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
