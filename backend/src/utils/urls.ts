// Utilitários de URLs da API.
// Centraliza a construção dos endereços de mídia e a expressão SQL do ano
// efetivo de uma obra, evitando que cada controller invente o seu próprio
// contrato (antes, /works/:id/releases devolvia as colunas legadas NULL e a
// busca devolvia URLs do backend — duas respostas diferentes para o mesmo app).

import { Request } from 'express';

// Endereço público desta API, derivado da própria requisição.
// Respeita proxy reverso quando a aplicação estiver atrás de um (trust proxy
// é configurado no servidor de produção; em rede local usa o Host recebido).
export function baseUrlDaRequisicao(req: Request): string {
  return `${req.protocol}://${req.get('host') || 'localhost:3001'}`;
}

// URLs de reprodução e download sempre apontam para os endpoints do backend,
// que resolvem a fonte em sites abertos (Regra 3). Nunca usam as colunas
// legadas streaming_url/download_url, que podem conter previews de 30s.
export function urlsDeMidia(baseUrl: string, releaseId: number): {
  streaming_url: string;
  download_url: string;
} {
  return {
    streaming_url: `${baseUrl}/api/releases/${releaseId}/stream`,
    download_url: `${baseUrl}/api/releases/${releaseId}/download`,
  };
}

// Ano efetivo da obra: o original_release_year quando a fonte o informou;
// caso contrário, o menor release_year conhecido entre as versões.
// Sem esse fallback, todas as 3434 obras do banco (ano NULL) ficavam fora da
// exploração por década — a consulta comparava NULL com a faixa de anos.
export const ANO_EFETIVO_SQL = `COALESCE(
  w.original_release_year,
  (SELECT MIN(r_ano.release_year)
     FROM releases r_ano
    WHERE r_ano.work_id = w.id AND r_ano.release_year IS NOT NULL)
)`;
