// Testes do guard de segurança da Regra 3 (webAudio).
//
// Cobrem a lista negra de plataformas, as faixas de IP não roteáveis
// (IPv4 e IPv6, incluindo endereços mapeados) e a auditoria de URLs antes
// de qualquer requisição de rede — a base do anti-SSRF.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  auditarUrl,
  dominioPlataformaProibida,
  enderecoNaoRoteavel,
  extrairLinksDeAudio,
  interpretarNomeDeArquivo,
  pareceUrlDeAudio,
} from '../../src/services/audioSource/webAudio';

test('bloqueia domínios de plataformas de música, inclusive subdomínios', () => {
  assert.equal(dominioPlataformaProibida('youtube.com'), true);
  assert.equal(dominioPlataformaProibida('music.youtube.com'), true);
  assert.equal(dominioPlataformaProibida('open.spotify.com'), true);
  assert.equal(dominioPlataformaProibida('deezer.com'), true);
  assert.equal(dominioPlataformaProibida('music.apple.com'), true);
  assert.equal(dominioPlataformaProibida('soundcloud.com'), true);
  assert.equal(dominioPlataformaProibida('bandcamp.com'), true);
});

test('não bloqueia sites abertos com nomes parecidos', () => {
  assert.equal(dominioPlataformaProibida('blog.exemplo.org'), false);
  assert.equal(dominioPlataformaProibida('notyoutube.com'), false);
  assert.equal(dominioPlataformaProibida('meu-spotify-blog.net'), false);
});

test('detecta IPv4 privado, loopback, link-local, CGNAT e multicast', () => {
  assert.equal(enderecoNaoRoteavel('127.0.0.1'), true);
  assert.equal(enderecoNaoRoteavel('10.0.0.1'), true);
  assert.equal(enderecoNaoRoteavel('172.16.0.1'), true);
  assert.equal(enderecoNaoRoteavel('192.168.1.1'), true);
  assert.equal(enderecoNaoRoteavel('169.254.10.20'), true);
  assert.equal(enderecoNaoRoteavel('100.64.0.1'), true);
  assert.equal(enderecoNaoRoteavel('224.0.0.1'), true);
  assert.equal(enderecoNaoRoteavel('0.0.0.0'), true);
});

test('aceita IPv4 público', () => {
  assert.equal(enderecoNaoRoteavel('8.8.8.8'), false);
  assert.equal(enderecoNaoRoteavel('172.32.0.1'), false);
  assert.equal(enderecoNaoRoteavel('1.1.1.1'), false);
});

test('detecta IPv6 de loopback, link-local, ULA, documentation e multicast', () => {
  assert.equal(enderecoNaoRoteavel('::1'), true);
  assert.equal(enderecoNaoRoteavel('::'), true);
  assert.equal(enderecoNaoRoteavel('fe80::1'), true);
  assert.equal(enderecoNaoRoteavel('fc00::1'), true);
  assert.equal(enderecoNaoRoteavel('fd12:3456:789a::1'), true);
  assert.equal(enderecoNaoRoteavel('ff02::1'), true);
  assert.equal(enderecoNaoRoteavel('2001:db8::1'), true);
});

test('aceita IPv6 público e valida IPv4 embutido em IPv6 mapeado', () => {
  assert.equal(enderecoNaoRoteavel('2001:4860:4860::8888'), false);
  assert.equal(enderecoNaoRoteavel('::ffff:10.0.0.1'), true);
  assert.equal(enderecoNaoRoteavel('::ffff:8.8.8.8'), false);
});

test('rejeita entradas que nem são endereços IP', () => {
  assert.equal(enderecoNaoRoteavel('nao-e-um-ip'), true);
  assert.equal(enderecoNaoRoteavel(''), true);
});

test('auditarUrl rejeita URL malformada e protocolos não HTTP', async () => {
  const malformada = await auditarUrl('nao e uma url');
  const arquivo = await auditarUrl('file:///etc/passwd');
  const ftp = await auditarUrl('ftp://exemplo.org/faixa.mp3');

  assert.equal(malformada.ok, false);
  assert.equal(arquivo.ok, false);
  assert.equal(ftp.ok, false);
});

test('auditarUrl rejeita credenciais embutidas na URL', async () => {
  const resultado = await auditarUrl('https://usuario:senha@blog.exemplo.org/faixa.mp3');

  assert.equal(resultado.ok, false);
  assert.match(resultado.motivo ?? '', /credenciais/i);
});

test('auditarUrl rejeita hosts internos e IPs privados literais', async () => {
  const loopback = await auditarUrl('http://127.0.0.1/faixa.mp3');
  const privado = await auditarUrl('http://192.168.0.10/faixa.mp3');
  const localhost = await auditarUrl('http://localhost/faixa.mp3');
  const interno = await auditarUrl('http://servidor.internal/faixa.mp3');

  assert.equal(loopback.ok, false);
  assert.equal(privado.ok, false);
  assert.equal(localhost.ok, false);
  assert.equal(interno.ok, false);
});

test('auditarUrl rejeita plataformas proibidas pela Regra 3', async () => {
  const youtube = await auditarUrl('https://www.youtube.com/watch?v=abc');
  const spotify = await auditarUrl('https://open.spotify.com/track/abc');

  assert.equal(youtube.ok, false);
  assert.match(youtube.motivo ?? '', /Regra 3/i);
  assert.equal(spotify.ok, false);
});

test('extrai links de áudio de HTML com tags e URLs cruas em JavaScript', () => {
  const html = `
    <html><body>
      <a href="/arquivos/Daft Punk - One More Time.mp3">Baixar MP3</a>
      <audio src="https://cdn.exemplo.org/audio/faixa.ogg"></audio>
      <source src="/audio/outra.flac" type="audio/flac">
      <a href="/redirect?url=malicioso.mp3">Rastreamento</a>
      <script>player.load("https://cdn.exemplo.org/js/player.mp3");</script>
    </body></html>
  `;

  const links = extrairLinksDeAudio(html, 'https://blog.exemplo.org/post');
  const urls = links.map((link) => link.url);

  assert.equal(links.length, 4, `esperava 4 links, veio: ${urls.join(', ')}`);
  assert.ok(
    urls.some((url) => decodeURIComponent(url).endsWith('Daft Punk - One More Time.mp3'))
  );
  assert.ok(urls.includes('https://cdn.exemplo.org/audio/faixa.ogg'));
  assert.ok(urls.some((url) => url.endsWith('/audio/outra.flac')));
  assert.ok(urls.includes('https://cdn.exemplo.org/js/player.mp3'));
  assert.ok(!urls.some((url) => url.includes('/redirect')));
});

test('interpreta nome de arquivo no padrão Artista - Título (Versão)', () => {
  const beatles = interpretarNomeDeArquivo('The Beatles - Let It Be (Remastered 2009).mp3');
  assert.equal(beatles.artist, 'The Beatles');
  assert.equal(beatles.title, 'Let It Be');
  assert.equal(beatles.version, 'Remastered 2009');

  const live = interpretarNomeDeArquivo('Artista – Título (Live).flac');
  assert.equal(live.artist, 'Artista');
  assert.equal(live.title, 'Título');
  assert.equal(live.version, 'Live');
});

test('remove assinatura de site do título (Artista - Título - Site.com)', () => {
  const interpretado = interpretarNomeDeArquivo(
    'Daft Punk - One More Time - siteexemplo.com.mp3'
  );

  assert.equal(interpretado.artist, 'Daft Punk');
  assert.equal(interpretado.title, 'One More Time');
});

test('remove termos de lixo do título e aceita nome sem separador', () => {
  const oficial = interpretarNomeDeArquivo('Daft Punk - One More Time (Official Audio).mp3');
  assert.equal(oficial.title, 'One More Time');

  const semSeparador = interpretarNomeDeArquivo('Música Sem Separador.mp3');
  assert.equal(semSeparador.title, 'Música Sem Separador');
});

test('pareceUrlDeAudio distingue arquivos de áudio de páginas HTML', () => {
  assert.equal(pareceUrlDeAudio('https://cdn.exemplo.org/faixa.mp3?sessao=1'), true);
  assert.equal(pareceUrlDeAudio('https://cdn.exemplo.org/faixa.FLAC'), true);
  assert.equal(pareceUrlDeAudio('https://blog.exemplo.org/postagem.html'), false);
});
