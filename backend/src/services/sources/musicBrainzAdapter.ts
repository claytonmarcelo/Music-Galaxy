// Adapter para a API MusicBrainz.
// MusicBrainz é um banco de dados aberto de metadados musicais.
// Rate limit: 1 requisição por segundo por IP (sem autenticação).
// Documentação: https://musicbrainz.org/doc/MusicBrainz_API

import https from 'https';
import http from 'http';
import { DadosReleaseExterno } from '../../types';
import {
  AdapterFonteExterna,
  MusicBrainzArtista,
  MusicBrainzRelease,
  MusicBrainzRespostaArtista,
  MusicBrainzRespostaBusca,
  MusicBrainzRespostaReleases,
  MusicBrainzRecording,
} from './types';
import { agendarChamada } from '../rateLimiting/rateLimiter';
import { emitirEvento } from '../logger/ingestionLogger';
import { limparNomeOficial } from './nomesOficiais';

// URL base da API MusicBrainz
const BASE_URL = 'https://musicbrainz.org/ws/2';

// Quantidade máxima de recordings buscados por pesquisa
const LIMITE_RECORDINGS = 25;

// --- Busca por artista ---
// Quando o termo digitado é exatamente o nome de um artista, o catálogo é
// montado pelas FAIXAS dos discos dele. Antes, "the beatles" caía na busca de
// recordings e o MusicBrainz devolvia documentários, entrevistas e discos de
// natal — nada que tivesse áudio disponível em site aberto.
const LIMITE_RELEASES_ARTISTA = 50;      // prensagens consultadas de uma vez
const MAX_DISCOS_ARTISTA = 10;           // discos distintos (release-group) por busca
const MIN_RELEASES_CATALOGO = 20;        // catálogo menor indica título de música, não artista
const TIPOS_DISCOS_ARTISTA = 'album|single|ep';

// Rótulos de faixa que não são música (índices, silêncios, faixas de dados).
const PADRAO_FAIXA_SEM_MUSICA = /^\[(unknown|untitled|silence|data track|video|index)\]/i;

export class MusicBrainzAdapter implements AdapterFonteExterna {
  readonly nomeFonte = 'MusicBrainz';

  // Camada HTTP. Os testes trocam por uma função que devolve JSON fixo, o que
  // permite verificar a Regra 8 (nomes oficiais) sem depender da internet.
  private readonly requisitar: (url: string) => Promise<string>;

  constructor(requisitar?: (url: string) => Promise<string>) {
    this.requisitar = requisitar ?? ((url: string) => this.fazerRequisicao(url));
  }

  // User-Agent obrigatório pelo MusicBrainz — sem ele, as requisições são bloqueadas.
  // Configurado via variável de ambiente para incluir e-mail de contato real.
  private get userAgent(): string {
    return process.env['MUSICBRAINZ_USER_AGENT'] || 'MusicGalaxy/1.0 (contato@musicgalaxy.app)';
  }

  // Busca recordings no MusicBrainz pelo termo de pesquisa.
  // Para cada recording retorna todos os releases associados.
  async buscarPorTermo(termo: string): Promise<DadosReleaseExterno[]> {
    emitirEvento('INGESTION_STARTED', { fonte: this.nomeFonte, termo });

    // 1. O termo é o nome de um artista? Então o catálogo sai das faixas dos
    //    discos dele (álbuns, singles e EPs), que é o que o usuário espera de
    //    uma busca por artista. A falha aqui não impede o fluxo seguinte.
    try {
      const discografia = await this.buscarDiscografiaDoArtista(termo);
      if (discografia.length > 0) {
        emitirEvento('INGESTION_COMPLETED', {
          fonte: this.nomeFonte,
          termo,
          releasesEncontrados: discografia.length,
        });
        return discografia;
      }
    } catch (erro) {
      console.warn(
        '[MusicBrainz] Busca por artista falhou, seguindo para busca por gravação:',
        erro instanceof Error ? erro.message : erro
      );
    }

    // 2. Busca por gravação (nome da música, ou termo livre).
    // Aguarda liberação pelo rate limiter antes de fazer a chamada
    await agendarChamada(this.nomeFonte);

    // Cada palavra do termo deve aparecer no título da gravação, no artista ou
    // no álbum (mesma lógica da busca local). Sem isso, "Daft Punk One More Time"
    // procuraria só no título da gravação e não encontraria a música.
    const url = `${BASE_URL}/recording?query=${encodeURIComponent(this.montarQuery(termo))}&limit=${LIMITE_RECORDINGS}&fmt=json`;

    let respostaBruta: string;
    try {
      respostaBruta = await this.requisitar(url);
    } catch (err) {
      emitirEvento('INGESTION_FAILED', { fonte: this.nomeFonte, termo, erro: String(err) });
      throw err;
    }

    const dados: MusicBrainzRespostaBusca = JSON.parse(respostaBruta);
    const recordings = dados.recordings ?? [];

    const releases: DadosReleaseExterno[] = [];

    for (const recording of recordings) {
      const releasesDoRecording = this.extrairReleases(recording);
      releases.push(...releasesDoRecording);
    }

    emitirEvento('INGESTION_COMPLETED', {
      fonte: this.nomeFonte,
      termo,
      releasesEncontrados: releases.length,
    });

    return releases;
  }

  // Monta o catálogo de faixas de um artista, quando o termo é o nome dele.
  // Devolve vazio quando o termo não corresponde a um artista de catálogo
  // relevante — aí a busca por gravação assume.
  private async buscarDiscografiaDoArtista(termo: string): Promise<DadosReleaseExterno[]> {
    // 1. O termo é exatamente o nome de algum artista?
    await agendarChamada(this.nomeFonte);
    const urlArtista = `${BASE_URL}/artist?query=${encodeURIComponent(`artist:"${termo}"`)}&limit=5&fmt=json`;
    const artistas = (JSON.parse(await this.requisitar(urlArtista)) as MusicBrainzRespostaArtista).artists ?? [];
    const artista = this.escolherArtistaExato(termo, artistas);
    if (!artista) return [];

    // 2. Discos do artista (álbuns, singles e EPs), com as faixas.
    await agendarChamada(this.nomeFonte);
    const urlReleases =
      `${BASE_URL}/release?artist=${encodeURIComponent(artista.id)}` +
      '&inc=recordings+artist-credits+labels+release-groups' +
      `&limit=${LIMITE_RELEASES_ARTISTA}` +
      `&type=${encodeURIComponent(TIPOS_DISCOS_ARTISTA)}` +
      '&fmt=json';
    const dados = JSON.parse(await this.requisitar(urlReleases)) as MusicBrainzRespostaReleases;

    // Nome de artista pode coincidir com título de música ("One More Time").
    // Catálogo pequeno demais é sinal de que a intenção era buscar a música.
    if ((dados['release-count'] ?? 0) < MIN_RELEASES_CATALOGO) return [];

    const discos = this.selecionarDiscos(dados.releases ?? []);
    const faixas: DadosReleaseExterno[] = [];
    for (const disco of discos) {
      faixas.push(...this.extrairFaixasDoDisco(disco, artista));
    }
    return faixas;
  }

  // Compara o termo com os artistas devolvidos pela busca, sem acentos e
  // pontuação. Só aceita coincidência exata — "beatles" não vira "The Beatles"
  // para não sequestrar buscas por música.
  private escolherArtistaExato(termo: string, artistas: MusicBrainzArtista[]): MusicBrainzArtista | null {
    const alvo = this.normalizarNome(termo);
    if (!alvo) return null;

    for (const artista of artistas) {
      if ((artista.score ?? 0) < 95) continue;
      if (this.normalizarNome(artista.name) === alvo) return artista;
    }
    return null;
  }

  // Normaliza texto para comparação: minúsculas, sem acentos, sem pontuação.
  private normalizarNome(texto: string): string {
    return texto
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, ' ')
      .trim();
  }

  // Um disco por release-group: prensagens e reedições do mesmo álbum contam
  // uma vez só. Fica com a edição mais antiga e mantém a ordem cronológica.
  private selecionarDiscos(releases: MusicBrainzRelease[]): MusicBrainzRelease[] {
    const porGrupo = new Map<string, MusicBrainzRelease>();

    for (const release of releases) {
      const chave = release['release-group']?.id ?? release.id;
      const atual = porGrupo.get(chave);
      if (!atual) {
        porGrupo.set(chave, release);
        continue;
      }
      // Data ausente vai para o fim da comparação, nunca "ganha" da com data.
      const dataAtual = atual.date ?? '9999';
      const dataNova = release.date ?? '9999';
      if (dataNova < dataAtual) porGrupo.set(chave, release);
    }

    return [...porGrupo.values()]
      .sort((a, b) => (a.date ?? '9999').localeCompare(b.date ?? '9999'))
      .slice(0, MAX_DISCOS_ARTISTA);
  }

  // Converte cada faixa de um disco em um release do Music Galaxy.
  // O trabalho (work) é a MÚSICA, não o álbum — é isso que permite a busca
  // por artista devolver faixas que podem receber áudio de site aberto.
  private extrairFaixasDoDisco(
    release: MusicBrainzRelease,
    artista: MusicBrainzArtista
  ): DadosReleaseExterno[] {
    const anoDoDisco = this.extrairAno(release.date);
    const paisDoDisco = release.country ?? artista.country ?? artista.area?.name ?? null;
    const gravadora = this.extrairGravadora(release);
    const tipoRelease = this.determinarTipoRelease(release);
    const resultado: DadosReleaseExterno[] = [];

    (release.media ?? []).forEach((midia, indiceMidia) => {
      for (const faixa of midia.tracks ?? []) {
        // Regra 8: o título é o oficial da fonte, só sem espaços sobrando.
        const titulo = limparNomeOficial(faixa.recording?.title ?? faixa.title);
        if (!this.tituloUtilizavel(titulo)) continue;

        // O crédito da faixa no MusicBrainz costuma listar os integrantes
        // ("Björn & Benny, Agnetha & Anni-Frid") em vez do nome do grupo.
        // Como estes discos são da discografia do artista pesquisado, a faixa
        // fica no nome dele — senão o catálogo se fragmenta em vários artistas
        // e a busca por "abba" não encontra as músicas.
        const nomeArtista = limparNomeOficial(artista.name);

        // Ano original vem da primeira gravação da faixa; sem ele, vale o ano
        // do disco. Isso preenche a listagem por década que antes ficava vazia.
        const anoOriginal =
          this.extrairAno(faixa.recording?.['first-release-date']) ?? anoDoDisco;

        resultado.push({
          artist_name: nomeArtista,
          work_title: titulo,
          artist_country: paisDoDisco,
          original_release_year: anoOriginal,
          // Regra 8: o nome da versão é o título oficial da faixa. O tipo de
          // lançamento (Compilation, Live, Remix...) fica em release_type —
          // nunca colado entre parênteses no nome.
          version_name: titulo,
          album_name: limparNomeOficial(release.title),
          release_year: anoDoDisco,
          label: gravadora,
          country: paisDoDisco,
          quality: this.qualidadeDoFormato(midia.format),
          cover_url: null, // Capa oficial é buscada separadamente (Regra 1)
          release_type_name: tipoRelease,
          source_reference_url: `${BASE_URL.replace('/ws/2', '')}/release/${release.id}`,
          // O mesmo disco pode repetir a faixa em mídias diferentes; o número
          // da mídia entra na chave para não colidir no INSERT IGNORE.
          external_id: `${release.id}:${indiceMidia + 1}:${faixa.number ?? ''}:${faixa.recording?.id ?? faixa.id ?? ''}`,
          metadata_source_name: this.nomeFonte,
          audio_preview_url: null,
          streaming_url: null,
          download_url: null,
        });
      }
    });

    return resultado;
  }

  // Faixas de índice, silêncio ou dados não são músicas e não entram no catálogo.
  private tituloUtilizavel(titulo: string): boolean {
    return titulo.length > 0 && !PADRAO_FAIXA_SEM_MUSICA.test(titulo);
  }

  // Monta a query Lucene do MusicBrainz a partir do termo digitado.
  // Cada palavra com 2+ letras vira um grupo (recording OU artist OU release)
  // e os grupos são combinados com AND — garante que todas as palavras do
  // termo apareçam na gravação, no artista ou no álbum.
  private montarQuery(termo: string): string {
    const palavras = termo
      .replace(/[+\-&|!(){}\[\]^"~*?:\\/]/g, ' ')
      .split(/\s+/)
      .filter(p => p.length >= 2);
    if (palavras.length === 0) return termo;
    return palavras
      .map(p => `(recording:${p} OR artist:${p} OR release:${p})`)
      .join(' AND ');
  }

  // Extrai todos os releases de um recording do MusicBrainz,
  // mapeando para o formato interno do Music Galaxy.
  private extrairReleases(recording: MusicBrainzRecording): DadosReleaseExterno[] {
    const artistCredits = recording['artist-credit'] ?? [];
    if (artistCredits.length === 0) return [];

    const artistaPrincipal = artistCredits[0]!.artist;
    // Regra 8: o nome do artista é o oficial publicado pela fonte.
    const nomeArtista = limparNomeOficial(artistaPrincipal.name);
    if (!nomeArtista) return [];
    const paisArtista = artistaPrincipal.area?.name ?? null;

    const releasesDoRecording = recording.releases ?? [];
    const resultado: DadosReleaseExterno[] = [];

    for (const release of releasesDoRecording) {
      const tipoRelease = this.determinarTipoRelease(release);
      const anoLancamento = this.extrairAno(release.date);
      const gravadora = this.extrairGravadora(release);
      // Regra 8: títulos oficiais, sem rótulo de lançamento no nome.
      const tituloObra = limparNomeOficial(recording.title);
      const nomeAlbum = limparNomeOficial(release.title);
      if (!tituloObra) continue;

      resultado.push({
        artist_name: nomeArtista,
        work_title: tituloObra,
        artist_country: paisArtista,
        original_release_year: null, // MusicBrainz não retorna diretamente o ano original aqui
        version_name: tituloObra,
        album_name: nomeAlbum !== tituloObra ? nomeAlbum : null,
        release_year: anoLancamento,
        label: gravadora,
        country: release.country ?? null,
        quality: this.determinarQualidade(release),
        cover_url: null, // Capa buscada separadamente via Cover Art Archive
        release_type_name: tipoRelease,
        source_reference_url: `https://musicbrainz.org/release/${release.id}`,
        external_id: release.id,
        metadata_source_name: this.nomeFonte,
        audio_preview_url: null,
        streaming_url: null,
        download_url: null,
      });
    }

    // Se o recording não tem releases associados, cria uma entrada mínima
    if (releasesDoRecording.length === 0 && nomeArtista) {
      const tituloObra = limparNomeOficial(recording.title);
      if (!tituloObra) return resultado;
      resultado.push({
        artist_name: nomeArtista,
        work_title: tituloObra,
        artist_country: paisArtista,
        original_release_year: null,
        version_name: tituloObra,
        album_name: null,
        release_year: null,
        label: null,
        country: null,
        quality: null,
        cover_url: null,
        release_type_name: 'Original Release',
        source_reference_url: `https://musicbrainz.org/recording/${recording.id}`,
        external_id: recording.id,
        metadata_source_name: this.nomeFonte,
        audio_preview_url: null,
        streaming_url: null,
        download_url: null,
      });
    }

    return resultado;
  }

  // Determina o tipo de release com base nos dados do MusicBrainz.
  // Mapeia os tipos do MusicBrainz para os nomes cadastrados na tabela release_types.
  private determinarTipoRelease(release: MusicBrainzRelease): string {
    const tipoPrimario = release['release-group']?.['primary-type']?.toLowerCase() ?? '';
    const tiposSecundarios = (release['release-group']?.['secondary-types'] ?? []).map(t => t.toLowerCase());
    const formato = release.media?.[0]?.format?.toLowerCase() ?? '';

    // Verificações de tipos secundários especiais
    if (tiposSecundarios.includes('live')) return 'Live Album';
    if (tiposSecundarios.includes('compilation')) return 'Compilation';
    if (tiposSecundarios.includes('remix')) return 'Remix';
    if (tiposSecundarios.includes('soundtrack')) return 'Soundtrack (OST)';
    if (tiposSecundarios.includes('demo')) return 'Demo';
    if (tiposSecundarios.includes('bootleg')) return 'Bootleg';

    // Tipo primário
    if (tipoPrimario === 'album') {
      if (tiposSecundarios.includes('compilation')) return 'Compilation';
      return 'Álbum';
    }
    if (tipoPrimario === 'single') {
      if (formato.includes('vinyl') || formato.includes('12"')) return 'Maxi Single';
      return 'Single';
    }
    if (tipoPrimario === 'ep') return 'EP';
    if (tipoPrimario === 'broadcast') return 'Radio Promo';
    if (tipoPrimario === 'other') return 'Original Release';

    return 'Original Release';
  }

  // Extrai o ano de uma string de data no formato YYYY, YYYY-MM ou YYYY-MM-DD.
  private extrairAno(date?: string): number | null {
    if (!date) return null;
    const ano = parseInt(date.substring(0, 4), 10);
    return isNaN(ano) ? null : ano;
  }

  // Extrai o nome da gravadora dos dados de label-info.
  private extrairGravadora(release: MusicBrainzRelease): string | null {
    const labelInfo = release['label-info'];
    if (!labelInfo || labelInfo.length === 0) return null;
    return labelInfo[0]?.label?.name ?? null;
  }

  // Determina a qualidade com base no formato de mídia.
  private determinarQualidade(release: MusicBrainzRelease): string | null {
    return this.qualidadeDoFormato(release.media?.[0]?.format);
  }

  // Qualidade a partir do nome do formato de uma mídia (CD, Vinyl, Digital...).
  private qualidadeDoFormato(formato?: string): string | null {
    if (!formato) return null;
    const f = formato.toLowerCase();
    if (f.includes('sacd') || f.includes('blu-ray')) return 'Hi-Res';
    if (f.includes('digital')) return 'Digital';
    if (f.includes('cd')) return 'CD';
    if (f.includes('vinyl') || f.includes('12"') || f.includes('7"')) return 'Vinyl';
    if (f.includes('cassette')) return 'Cassette';
    return formato;
  }

  // Realiza uma requisição HTTP GET com Node.js nativo (sem axios ou fetch).
  // Inclui retry com backoff exponencial para erros 429 e 5xx.
  private fazerRequisicao(url: string, tentativa: number = 1): Promise<string> {
    return new Promise((resolve, reject) => {
      const opcoes = {
        headers: {
          'User-Agent': this.userAgent,
          'Accept': 'application/json',
        },
      };

      const modulo = url.startsWith('https') ? https : http;

      const req = modulo.get(url, opcoes, (res) => {
        // Rate limit atingido — aguarda e tenta novamente
        if (res.statusCode === 429 && tentativa < 4) {
          const espera = tentativa * 5000; // 5s, 10s, 15s
          emitirEvento('INGESTION_RATE_LIMITED', { fonte: this.nomeFonte, tentativa, espera });
          setTimeout(() => {
            agendarChamada(this.nomeFonte).then(() =>
              this.fazerRequisicao(url, tentativa + 1).then(resolve).catch(reject)
            );
          }, espera);
          res.resume();
          return;
        }

        // Erro do servidor — retry com backoff
        if (res.statusCode && res.statusCode >= 500 && tentativa < 4) {
          const espera = tentativa * 3000; // 3s, 6s, 9s
          setTimeout(() => {
            agendarChamada(this.nomeFonte).then(() =>
              this.fazerRequisicao(url, tentativa + 1).then(resolve).catch(reject)
            );
          }, espera);
          res.resume();
          return;
        }

        if (res.statusCode && res.statusCode !== 200) {
          reject(new Error(`MusicBrainz respondeu com status ${res.statusCode}`));
          res.resume();
          return;
        }

        let corpo = '';
        res.setEncoding('utf8');
        res.on('data', chunk => { corpo += chunk; });
        res.on('end', () => resolve(corpo));
        res.on('error', reject);
      });

      req.on('error', reject);
      req.setTimeout(15000, () => {
        req.destroy();
        reject(new Error('Timeout na requisição ao MusicBrainz'));
      });
    });
  }
}
