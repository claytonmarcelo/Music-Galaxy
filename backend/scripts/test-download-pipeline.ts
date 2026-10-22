// Teste manual do pipeline de download + cache (Regra 3) com arquivo MP3 público.
// Uso: npx ts-node scripts/test-download-pipeline.ts
// Valida: guard anti-SSRF/plataformas → download HTTP → assinatura → cache.set (move) → cache.get

import axios from 'axios';
import fsPromises from 'fs/promises';
import fs from 'fs';
import path from 'path';
import { downloadCache } from '../src/services/downloadCache';
import { auditarUrl } from '../src/services/audioSource/webAudio';

async function main(): Promise<void> {
  const url = 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3';

  const g = await auditarUrl(url);
  console.log('1. auditoria:', g.ok ? 'APROVADA' : `BLOQUEADA ${g.motivo}`);
  if (!g.ok) process.exit(1);

  const tempDir = path.join(__dirname, '../temp/audio');
  await fsPromises.mkdir(tempDir, { recursive: true });
  const destino = path.join(tempDir, 'pipeline_test.mp3');

  const r = await axios.get(g.url!.href, {
    responseType: 'stream',
    timeout: 60000,
    headers: { 'User-Agent': 'Mozilla/5.0' },
  });
  console.log('2. download status:', r.status, 'content-type:', r.headers['content-type']);

  const ws = fs.createWriteStream(destino);
  await new Promise<void>((res, rej) => {
    r.data.pipe(ws);
    ws.on('finish', () => res());
    ws.on('error', rej);
  });
  const st = await fsPromises.stat(destino);
  console.log('3. bytes baixados:', st.size);

  const cabeca = Buffer.alloc(3);
  const fdH = await fsPromises.open(destino, 'r');
  await fdH.read(cabeca, 0, 3, 0);
  await fdH.close();
  console.log('4. assinatura:', cabeca.toString('ascii') === 'ID3' ? 'ID3 ok (mp3 válido)' : cabeca.toString('hex'));

  const caminhoCache = await downloadCache.set(999999, 'mp3', destino);
  console.log('5. cache.set retornou:', caminhoCache);

  if (caminhoCache) {
    const existe = await fsPromises.stat(caminhoCache).then(() => true).catch(() => false);
    console.log('6. arquivo existe no cache permanente:', existe);
    const hit = await downloadCache.get(999999, 'mp3');
    console.log('7. cache.get:', hit ? `HIT em ${hit.filePath}` : 'MISS');
  }
  const tempSumiu = !(await fsPromises.stat(destino).then(() => true).catch(() => false));
  console.log('8. temporário foi MOVIDO para o cache (não deletado):', tempSumiu);
}

main().catch((e) => {
  console.error('FALHA:', e);
  process.exit(1);
});
