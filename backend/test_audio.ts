// Script de teste para validar o enriquecimento de áudio com Spotify, iTunes e Deezer.
// Execute com: npx ts-node test_audio.ts

import { enriquecerComAudio } from './src/services/audio/audioEnricher';
import { SpotifyAdapter } from './src/services/audio/spotifyAdapter';
import { ItunesAdapter } from './src/services/audio/itunesAdapter';
import { DeezerAdapter } from './src/services/audio/deezerAdapter';
import { DadosReleaseExterno } from './src/types';

async function testar() {
  console.log('\n============================');
  console.log(' Music Galaxy — Teste de Áudio');
  console.log('============================\n');

  const spotify = new SpotifyAdapter();
  console.log(`Spotify configurado: ${spotify.estaConfigurado ? '✓ SIM' : '✗ NÃO (sem SPOTIFY_CLIENT_ID/SECRET no .env)'}`);

  // Músicas de teste representativas (MPB, internacional e pop)
  const releases: DadosReleaseExterno[] = [
    {
      artist_name: 'Nirvana',
      work_title: 'Smells Like Teen Spirit',
      version_name: 'Original',
      release_type_name: 'Original Release',
      external_id: 'test-1',
      metadata_source_name: 'Test',
    },
    {
      artist_name: 'Queen',
      work_title: 'Bohemian Rhapsody',
      version_name: 'Original',
      release_type_name: 'Original Release',
      external_id: 'test-2',
      metadata_source_name: 'Test',
    },
    {
      artist_name: 'MPB4',
      work_title: 'O Prestígio de MPB4',
      version_name: 'Vinyl',
      release_type_name: 'Original Release',
      external_id: 'test-3',
      metadata_source_name: 'Test',
    },
  ];

  console.log('\n--- Consultando fontes externas ---\n');
  await enriquecerComAudio(releases);

  console.log('\n--- Resultado Final ---\n');
  for (const r of releases) {
    const status = r.audio_preview_url ? '🎵 COM ÁUDIO' : '⚠️  SEM ÁUDIO';
    console.log(`${status} | ${r.artist_name} — ${r.work_title}`);
    if (r.audio_preview_url) {
      console.log(`         URL: ${r.audio_preview_url}`);
    }
  }
  console.log('');
}

testar().catch(console.error);

