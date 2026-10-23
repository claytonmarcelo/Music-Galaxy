// Adapter para a API Discogs.
// Discogs é um catálogo com detalhes de formatos físicos, variações e prensagens.
// Rate limit: 60 req/min com token pessoal, 25 req/min sem autenticação.
// Documentação: https://www.discogs.com/developers/

import https from 'https';
import http from 'http';
import { DadosReleaseExterno } from '../../types';
import { AdapterFonteExterna, DiscogsRespostaBusca, DiscogsResultado } from './types';
import { agendarChamada } from '../rateLimiting/rateLimiter';
import { emitirEvento } from '../logger/ingestionLogger';
import { nomeOficialOuNulo } from './nomesOficiais';

const BASE_URL = 'https://api.discogs.com';

// Mapeamento de formatos Discogs para os tipos cadastrados no release_types.
// A ordem importa: é uma lista de PRIORIDADE, do formato mais específico para
// o mais genérico. Assim "CD, Maxi-Single" vira Maxi Single (e não CD),
// "CD, Album" vira Álbum, "DVD, DVD-Video" vira DVD e um "CD" sozinho vira
// CD — a regra de formatos do projeto (mp3/flac/CD/DVD/Maxi/Mix/Remix/Bootleg
// e afins) depende dessa distinção.
const PRIORIDADE_FORMATOS: [string, string][] = [
  ['12"',             'Maxi Single'],
  ['maxi',            'Maxi Single'],
  ['dvd',             'DVD'],
  ['7"',              'Single'],
  ['single',          'Single'],
  ['ep',              'EP'],
  ['album',           'Álbum'],
  ['lp',              'Álbum'],
  ['compilation',     'Compilation'],
  ['box set',         'Box Set'],
  ['cd',              'CD'],
  ['promo',           'Promo CD'],
  ['white label',     'White Label'],
  ['sampler',         'Sampler'],
  ['mixed',           'Compilation'],
  ['remastered',      'Remastered'],
  ['reissue',         'Reissue'],
  ['limited edition', 'Limited Edition'],
  ['deluxe',          'Deluxe Edition'],
];

export class DiscogsAdapter implements AdapterFonteExterna {
  readonly nomeFonte = 'Discogs';

  // Camada HTTP. Os testes trocam por uma função que devolve JSON fixo para
  // verificar a Regra 8 sem depender da internet.
  private readonly requisitar: (url: string) => Promise<string>;

  constructor(requisitar?: (url: string) => Promise<string>) {
    this.requisitar = requisitar ?? ((url: string) => this.fazerRequisicao(url));
  }

  // Token de autenticação Discogs — configurado via variável de ambiente.
  private get token(): string | null {
    return process.env['DISCOGS_TOKEN'] ?? null;
  }

  private get userAgent(): string {
    return process.env['DISCOGS_USER_AGENT'] || 'MusicGalaxy/1.0';
  }

  // Busca releases no Discogs pelo termo de pesquisa.
  async buscarPorTermo(termo: string): Promise<DadosReleaseExterno[]> {
    emitirEvento('INGESTION_STARTED', { fonte: this.nomeFonte, termo });

    // Aguarda liberação pelo rate limiter
    await agendarChamada(this.nomeFonte);

    // Discogs não tem endpoint de recording — busca diretamente por releases
    let url = `${BASE_URL}/database/search?q=${encodeURIComponent(termo)}&type=release&per_page=50`;
    if (this.token) {
      url += `&token=${this.token}`;
    }

    let respostaBruta: string;
    try {
      respostaBruta = await this.requisitar(url);
    } catch (err) {
      emitirEvento('INGESTION_FAILED', { fonte: this.nomeFonte, termo, erro: String(err) });
      throw err;
    }

    const dados: DiscogsRespostaBusca = JSON.parse(respostaBruta);
    const resultados = dados.results ?? [];

    const releases: DadosReleaseExterno[] = resultados
      .map(r => this.mapearResultado(r))
      .filter((r): r is DadosReleaseExterno => r !== null);

    emitirEvento('INGESTION_COMPLETED', {
      fonte: this.nomeFonte,
      termo,
      releasesEncontrados: releases.length,
    });

    return releases;
  }

  // Mapeia um resultado bruto do Discogs para o formato interno do Music Galaxy.
  private mapearResultado(resultado: DiscogsResultado): DadosReleaseExterno | null {
    // Discogs formata o título como "Artista - Título do Álbum"
    const partes = resultado.title.split(' - ');
    if (partes.length < 2) return null;

    // Regra 8: nomes oficiais, apenas sem espaços sobrando. Um resultado sem
    // artista ou sem título não entra no catálogo — nada de nome inventado.
    const nomeArtista = nomeOficialOuNulo(partes[0]);
    // O restante após o primeiro " - " é o título (pode conter " - " no nome)
    const tituloObra = nomeOficialOuNulo(partes.slice(1).join(' - '));
    if (!nomeArtista || !tituloObra) return null;

    const tipoRelease = this.determinarTipoRelease(resultado);
    const gravadora = resultado.label?.[0] ?? null;

    // Regra da Capa Oficial: usar cover_image do Discogs apenas quando disponível.
    // thumb é muito pequena (150x150) — preferir cover_image quando existir.
    const capaUrl = resultado.cover_image && !resultado.cover_image.includes('spacer')
      ? resultado.cover_image
      : null;

    return {
      artist_name: nomeArtista,
      work_title: tituloObra,
      artist_country: resultado.country ?? null,
      original_release_year: null,
      // Regra 8: o nome da versão é o título oficial da obra. "Promo",
      // "Remastered", "Deluxe" etc. definem o release_type, não o nome.
      version_name: tituloObra,
      album_name: tituloObra,
      release_year: resultado.year ?? null,
      label: gravadora ? this.limparNomeGravadora(gravadora) : null,
      country: resultado.country ?? null,
      quality: this.determinarQualidade(resultado),
      cover_url: capaUrl,
      release_type_name: tipoRelease,
      source_reference_url: resultado.uri ? `https://www.discogs.com${resultado.uri}` : null,
      external_id: String(resultado.id),
      metadata_source_name: this.nomeFonte,
      audio_preview_url: null,
      streaming_url: null,
      download_url: null,
    };
  }

  // Determina o tipo de release mapeando os formatos Discogs.
  private determinarTipoRelease(resultado: DiscogsResultado): string {
    const formatos = (resultado.format ?? []).map(f => f.toLowerCase());

    // Percorre a lista em ordem de prioridade: o primeiro formato que casar
    // define o tipo (ver comentário de PRIORIDADE_FORMATOS acima).
    for (const [chave, tipo] of PRIORIDADE_FORMATOS) {
      if (formatos.some(f => f.includes(chave))) return tipo;
    }

    return 'Original Release';
  }

  // Determina qualidade com base nos formatos Discogs.
  private determinarQualidade(resultado: DiscogsResultado): string | null {
    const formatos = (resultado.format ?? []).map(f => f.toLowerCase());
    if (formatos.some(f => f.includes('vinyl') || f.includes('12"') || f.includes('7"'))) return 'Vinyl';
    if (formatos.some(f => f.includes('cd'))) return 'CD';
    if (formatos.some(f => f.includes('dvd'))) return 'DVD';
    if (formatos.some(f => f.includes('digital'))) return 'Digital';
    if (formatos.some(f => f.includes('cassette'))) return 'Cassette';
    return null;
  }

  // Remove o numeral de desambiguação do Discogs ("EMI (2)"). Esse numeral é
  // um código interno do catálogo deles, não faz parte do nome oficial da
  // gravadora — mantê-lo seria gravar um nome alterado (Regra 8).
  private limparNomeGravadora(nome: string): string {
    return nome.replace(/\s*\(\d+\)$/, '').trim();
  }

  // Realiza uma requisição HTTP GET com retry e backoff exponencial.
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
        // Rate limit atingido
        if (res.statusCode === 429 && tentativa < 4) {
          const espera = tentativa * 5000;
          emitirEvento('INGESTION_RATE_LIMITED', { fonte: this.nomeFonte, tentativa, espera });
          setTimeout(() => {
            agendarChamada(this.nomeFonte).then(() =>
              this.fazerRequisicao(url, tentativa + 1).then(resolve).catch(reject)
            );
          }, espera);
          res.resume();
          return;
        }

        // Erro do servidor
        if (res.statusCode && res.statusCode >= 500 && tentativa < 4) {
          const espera = tentativa * 3000;
          setTimeout(() => {
            agendarChamada(this.nomeFonte).then(() =>
              this.fazerRequisicao(url, tentativa + 1).then(resolve).catch(reject)
            );
          }, espera);
          res.resume();
          return;
        }

        // Não autorizado — token inválido ou ausente
        if (res.statusCode === 401) {
          reject(new Error('Discogs: token inválido ou ausente. Configure DISCOGS_TOKEN no .env'));
          res.resume();
          return;
        }

        if (res.statusCode && res.statusCode !== 200) {
          reject(new Error(`Discogs respondeu com status ${res.statusCode}`));
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
        reject(new Error('Timeout na requisição ao Discogs'));
      });
    });
  }
}
