import https from 'https';
import http from 'http';

export class DeezerAdapter {
  readonly nomeFonte = 'Deezer';

  async buscarPreviewAudio(artista: string, titulo: string): Promise<string | null> {
    const tituloLimpo = titulo.replace(/\(.*?\)/g, '').trim();
    const query = `artist:"${artista}" track:"${tituloLimpo || titulo}"`;
    const url = `https://api.deezer.com/search?q=${encodeURIComponent(query)}&limit=1`;

    try {
      const respostaBruta = await this.fazerRequisicao(url);
      const dados = JSON.parse(respostaBruta);
      
      if (dados.data && dados.data.length > 0 && dados.data[0].preview) {
        return dados.data[0].preview;
      }
      return null;
    } catch (err) {
      console.error(`[${this.nomeFonte}] Erro ao buscar áudio para "${artista} - ${titulo}":`, err instanceof Error ? err.message : String(err));
      return null;
    }
  }

  private fazerRequisicao(url: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const opcoes = {
        headers: {
          'User-Agent': 'MusicGalaxy/1.0',
          'Accept': 'application/json',
        },
      };

      const modulo = url.startsWith('https') ? https : http;

      const req = modulo.get(url, opcoes, (res) => {
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
}
