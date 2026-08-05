// Adapter para a API do Spotify.
// O Spotify exige autenticação OAuth via Client Credentials para qualquer busca.
// Documentação: https://developer.spotify.com/documentation/web-api/
// Crie seu app em: https://developer.spotify.com/dashboard

import https from 'https';
import http from 'http';

// Token de acesso em memória — o Spotify emite tokens com duração de 1 hora
let tokenEmCache: { valor: string; expiraEm: number } | null = null;

export class SpotifyAdapter {
  readonly nomeFonte = 'Spotify';

  private get clientId(): string | null {
    return process.env['SPOTIFY_CLIENT_ID'] ?? null;
  }

  private get clientSecret(): string | null {
    return process.env['SPOTIFY_CLIENT_SECRET'] ?? null;
  }

  // Verifica se as credenciais estão configuradas no .env
  get estaConfigurado(): boolean {
    return !!(this.clientId && this.clientSecret);
  }

  // Obtém token via Client Credentials Flow.
  // Reaproveita o token em cache enquanto não expirou (margem de 60s).
  private async obterToken(): Promise<string> {
    const agora = Date.now();

    if (tokenEmCache && tokenEmCache.expiraEm > agora) {
      return tokenEmCache.valor;
    }

    const credenciais = Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64');
    const corpo = 'grant_type=client_credentials';

    const resposta = await this.fazerRequisicaoPost(
      'https://accounts.spotify.com/api/token',
      corpo,
      {
        'Authorization': `Basic ${credenciais}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      }
    );

    const dados = JSON.parse(resposta);

    if (!dados.access_token) {
      throw new Error('Spotify não retornou access_token. Verifique SPOTIFY_CLIENT_ID e SPOTIFY_CLIENT_SECRET.');
    }

    // Guarda o token em cache com margem de segurança de 60 segundos
    tokenEmCache = {
      valor: dados.access_token,
      expiraEm: agora + (dados.expires_in - 60) * 1000,
    };

    return tokenEmCache.valor;
  }

  // Busca prévia de áudio do Spotify para o artista e título informados.
  async buscarPreviewAudio(artista: string, titulo: string): Promise<string | null> {
    if (!this.estaConfigurado) return null;

    try {
      const token = await this.obterToken();
      const query = `artist:${artista} track:${titulo}`;
      const url = `https://api.spotify.com/v1/search?q=${encodeURIComponent(query)}&type=track&limit=1&market=BR`;

      const respostaBruta = await this.fazerRequisicaoGet(url, {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/json',
      });

      const dados = JSON.parse(respostaBruta);
      const faixas = dados.tracks?.items ?? [];

      if (faixas.length > 0 && faixas[0].preview_url) {
        return faixas[0].preview_url;
      }

      // Algumas faixas não têm preview_url — tenta busca simplificada
      if (faixas.length === 0) {
        const urlSimples = `https://api.spotify.com/v1/search?q=${encodeURIComponent(`${artista} ${titulo}`)}&type=track&limit=3&market=BR`;
        const respostaSimples = await this.fazerRequisicaoGet(urlSimples, {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json',
        });
        const dadosSimples = JSON.parse(respostaSimples);
        const faixasSimples = dadosSimples.tracks?.items ?? [];

        for (const faixa of faixasSimples) {
          if (faixa.preview_url) return faixa.preview_url;
        }
      }

      return null;
    } catch (err) {
      console.error(`[${this.nomeFonte}] Erro ao buscar áudio para "${artista} - ${titulo}":`, err instanceof Error ? err.message : String(err));
      return null;
    }
  }

  // Requisição GET genérica com cabeçalhos customizados
  private fazerRequisicaoGet(url: string, cabecalhos: Record<string, string>): Promise<string> {
    return new Promise((resolve, reject) => {
      const modulo = url.startsWith('https') ? https : http;

      const req = modulo.get(url, { headers: cabecalhos }, (res) => {
        if (res.statusCode === 401) {
          // Token expirou — invalida o cache para forçar renovação
          tokenEmCache = null;
          reject(new Error('Spotify: token expirado. Será renovado na próxima tentativa.'));
          res.resume();
          return;
        }
        if (res.statusCode && res.statusCode !== 200) {
          reject(new Error(`${this.nomeFonte} respondeu com status ${res.statusCode}`));
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
      req.setTimeout(10000, () => {
        req.destroy();
        reject(new Error(`Timeout na requisição ao ${this.nomeFonte}`));
      });
    });
  }

  // Requisição POST para obter o token OAuth
  private fazerRequisicaoPost(
    url: string,
    corpo: string,
    cabecalhos: Record<string, string>
  ): Promise<string> {
    return new Promise((resolve, reject) => {
      const corpoBuff = Buffer.from(corpo, 'utf8');
      const urlParsed = new URL(url);

      const opcoes = {
        hostname: urlParsed.hostname,
        path: urlParsed.pathname,
        method: 'POST',
        headers: {
          ...cabecalhos,
          'Content-Length': corpoBuff.length,
        },
      };

      const req = https.request(opcoes, (res) => {
        if (res.statusCode && res.statusCode !== 200) {
          reject(new Error(`Spotify OAuth respondeu com status ${res.statusCode}`));
          res.resume();
          return;
        }

        let respostaCorpo = '';
        res.setEncoding('utf8');
        res.on('data', chunk => { respostaCorpo += chunk; });
        res.on('end', () => resolve(respostaCorpo));
        res.on('error', reject);
      });

      req.on('error', reject);
      req.setTimeout(10000, () => {
        req.destroy();
        reject(new Error('Timeout no OAuth do Spotify'));
      });
      req.write(corpoBuff);
      req.end();
    });
  }
}
