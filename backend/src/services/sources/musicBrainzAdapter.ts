// Adapter para a API MusicBrainz.
// MusicBrainz é um banco de dados aberto de metadados musicais.
// Rate limit: 1 requisição por segundo por IP (sem autenticação).
// Documentação: https://musicbrainz.org/doc/MusicBrainz_API

import https from 'https';
import http from 'http';
import { DadosReleaseExterno } from '../../types';
import { AdapterFonteExterna, MusicBrainzRespostaBusca, MusicBrainzRecording, MusicBrainzRelease } from './types';
import { agendarChamada } from '../rateLimiting/rateLimiter';
import { emitirEvento } from '../logger/ingestionLogger';

// URL base da API MusicBrainz
const BASE_URL = 'https://musicbrainz.org/ws/2';

// Quantidade máxima de recordings buscados por pesquisa
const LIMITE_RECORDINGS = 25;

export class MusicBrainzAdapter implements AdapterFonteExterna {
  readonly nomeFonte = 'MusicBrainz';

  // User-Agent obrigatório pelo MusicBrainz — sem ele, as requisições são bloqueadas.
  // Configurado via variável de ambiente para incluir e-mail de contato real.
  private get userAgent(): string {
    return process.env['MUSICBRAINZ_USER_AGENT'] || 'MusicGalaxy/1.0 (contato@musicgalaxy.app)';
  }

  // Busca recordings no MusicBrainz pelo termo de pesquisa.
  // Para cada recording retorna todos os releases associados.
  async buscarPorTermo(termo: string): Promise<DadosReleaseExterno[]> {
    emitirEvento('INGESTION_STARTED', { fonte: this.nomeFonte, termo });

    // Aguarda liberação pelo rate limiter antes de fazer a chamada
    await agendarChamada(this.nomeFonte);

    const url = `${BASE_URL}/recording?query=${encodeURIComponent(termo)}&limit=${LIMITE_RECORDINGS}&fmt=json&inc=releases+artist-credits+release-groups`;

    let respostaBruta: string;
    try {
      respostaBruta = await this.fazerRequisicao(url);
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

  // Extrai todos os releases de um recording do MusicBrainz,
  // mapeando para o formato interno do Music Galaxy.
  private extrairReleases(recording: MusicBrainzRecording): DadosReleaseExterno[] {
    const artistCredits = recording['artist-credit'] ?? [];
    if (artistCredits.length === 0) return [];

    const artistaPrincipal = artistCredits[0]!.artist;
    const nomeArtista = artistaPrincipal.name;
    const paisArtista = artistaPrincipal.area?.name ?? null;

    const releasesDoRecording = recording.releases ?? [];
    const resultado: DadosReleaseExterno[] = [];

    for (const release of releasesDoRecording) {
      const tipoRelease = this.determinarTipoRelease(release);
      const anoLancamento = this.extrairAno(release.date);
      const gravadora = this.extrairGravadora(release);

      resultado.push({
        artist_name: nomeArtista,
        work_title: recording.title,
        artist_country: paisArtista,
        original_release_year: null, // MusicBrainz não retorna diretamente o ano original aqui
        version_name: this.determinarNomeVersao(recording.title, release),
        album_name: release.title !== recording.title ? release.title : null,
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
      resultado.push({
        artist_name: nomeArtista,
        work_title: recording.title,
        artist_country: paisArtista,
        original_release_year: null,
        version_name: recording.title,
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

  // Determina o nome de exibição da versão.
  private determinarNomeVersao(tituloRecording: string, release: MusicBrainzRelease): string {
    const tiposSecundarios = (release['release-group']?.['secondary-types'] ?? []);
    if (tiposSecundarios.length > 0) {
      return `${tituloRecording} (${tiposSecundarios.join(', ')})`;
    }
    return tituloRecording;
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
    const formato = release.media?.[0]?.format;
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
