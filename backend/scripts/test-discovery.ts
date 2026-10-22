// Teste manual da descoberta global de fontes web abertas (Regra 3).
// Uso: npx ts-node scripts/test-discovery.ts "Artista" "Título"
// Não faz parte do fluxo da API — serve para validar o GenericWebProvider ao vivo.

import { GenericWebProvider } from '../src/services/audioSource/providers/genericWebProvider';
import { auditarUrl } from '../src/services/audioSource/webAudio';

async function main(): Promise<void> {
  const artista = process.argv[2] ?? 'The Beatles';
  const titulo  = process.argv[3] ?? 'Let It Be';

  const provider = new GenericWebProvider();
  console.log(`[test] Buscando "${artista}" - "${titulo}" em fontes web abertas...`);

  const inicio = Date.now();
  const resultado = await provider.search({ artist: artista, title: titulo });

  console.log(`[test] status=${resultado.status} candidatos=${resultado.candidates.length} tempo=${((Date.now() - inicio) / 1000).toFixed(1)}s`);

  for (const c of resultado.candidates.slice(0, 5)) {
    console.log('-----------------------------------------');
    console.log(`[cand] artist=${c.artist} | title=${c.title} | version=${c.version ?? '-'}`);
    console.log(`[cand] url=${c.url ?? c.downloadUrl ?? '(sem url)'}`);
    if (c.url) {
      const guard = await auditarUrl(c.url);
      console.log(`[cand] auditoria=${guard.ok ? 'APROVADA' : `BLOQUEADA: ${guard.motivo}`}`);
    }
  }

  if (resultado.error) console.log(`[test] erro=${resultado.error}`);

  // Prova da Regra 3: URLs de plataformas de música devem ser BLOQUEADAS pelo guard
  const proibidas = [
    'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    'https://open.spotify.com/track/0Dffh2ET2USCNGuWTwLE3p',
    'https://www.deezer.com/track/110971672',
    'https://preview.redd.it/udio0000wua61.mp3?auto=webp&s=abc', // link direto web (permitido)
  ];
  console.log('== Auditoria Regra 3 ==');
  for (const u of proibidas) {
    const g = await auditarUrl(u);
    console.log(`${g.ok ? 'PERMITIDA ' : 'BLOQUEADA'} ${u.slice(0, 60)}${g.motivo ? ' (' + g.motivo + ')' : ''}`);
  }
}

main().catch((err) => {
  console.error('[test] Falha:', err);
  process.exit(1);
});
