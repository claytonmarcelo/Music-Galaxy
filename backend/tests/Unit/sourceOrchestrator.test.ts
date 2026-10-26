// Testes do SourceOrchestrator — cache de descoberta, inclusive o negativo.
//
// A fila de resolução da Regra 7 recoloca a mesma faixa sem fonte na frente a
// cada busca. Se o orquestrador só guarda acertos, cada volta da fila refaz
// todas as consultas aos sites abertos; o ritmo de requisições é o que faz o
// motor de busca devolver captcha. Estes testes travam o comportamento com um
// provider falso que conta quantas vezes foi consultado.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { SourceOrchestrator } from '../../src/services/audioSource/sourceOrchestrator';
import {
  AudioCandidate,
  AudioIdentity,
  IAudioSourceProvider,
  SearchResult,
} from '../../src/services/audioSource/types';

const identidade: AudioIdentity = {
  artist: 'Daft Punk',
  title: 'One More Time',
};

// Provider de teste: devolve o que mandarem e conta as consultas recebidas.
class ProviderFalso implements IAudioSourceProvider {
  readonly providerId = 'provider-falso';
  readonly timeouts = { search: 1000, metadata: 1000, download: 1000 };
  consultas = 0;

  constructor(private readonly candidatos: AudioCandidate[]) {}

  async search(): Promise<SearchResult> {
    this.consultas += 1;
    return {
      providerId: this.providerId,
      candidates: this.candidatos,
      status: 'SUCCESS',
      durationMs: 1,
    };
  }

  async getMetadata(): Promise<AudioCandidate | null> {
    return null;
  }

  async getDownloadInfo(): Promise<{ url: string; format: string } | null> {
    return null;
  }

  async checkAvailability(): Promise<boolean> {
    return true;
  }
}

function candidatoExato(): AudioCandidate {
  return {
    providerId: 'provider-falso',
    sourceId: 'https://archive.org/download/daftpunk/One%20More%20Time.mp3',
    artist: 'Daft Punk',
    title: 'One More Time',
    format: 'mp3',
    url: 'https://archive.org/download/daftpunk/One%20More%20Time.mp3',
    metadata: {},
  };
}

// O orquestrador fala bastante no console; sem isso a saída do teste vira ruído.
async function semLog<T>(executar: () => Promise<T>): Promise<T> {
  const originais = { log: console.log, warn: console.warn, error: console.error };
  const mudo = () => undefined;
  console.log = mudo;
  console.warn = mudo;
  console.error = mudo;
  try {
    return await executar();
  } finally {
    Object.assign(console, originais);
  }
}

test('guarda no cache a faixa que não teve fonte e não consulta de novo', async () => {
  const provider = new ProviderFalso([]);
  const orquestrador = new SourceOrchestrator();
  orquestrador.registerProvider(provider);

  const primeira = await semLog(() => orquestrador.discover(identidade));
  const segunda = await semLog(() => orquestrador.discover(identidade));

  assert.equal(primeira.bestCandidate, null);
  assert.equal(primeira.fromCache, false);
  assert.equal(segunda.bestCandidate, null, 'o cache precisa devolver o mesmo resultado negativo');
  assert.equal(segunda.fromCache, true, 'a segunda descoberta da mesma faixa não pode ir à web');
  assert.equal(provider.consultas, 1, 'um resultado negativo já registrado não pode reconsultar o provider');
});

test('cada faixa tem o próprio cache negativo', async () => {
  const provider = new ProviderFalso([]);
  const orquestrador = new SourceOrchestrator();
  orquestrador.registerProvider(provider);

  await semLog(() => orquestrador.discover(identidade));
  await semLog(() => orquestrador.discover({ ...identidade, title: 'Harder, Better, Faster, Stronger' }));

  assert.equal(provider.consultas, 2, 'identidades diferentes continuam sendo consultadas');
});

test('reaproveita o cache quando a fonte foi encontrada', async () => {
  const provider = new ProviderFalso([candidatoExato()]);
  const orquestrador = new SourceOrchestrator();
  orquestrador.registerProvider(provider);

  const primeira = await semLog(() => orquestrador.discover(identidade));
  const segunda = await semLog(() => orquestrador.discover(identidade));

  assert.notEqual(primeira.bestCandidate, null, 'a correspondência exata precisa ser aceita');
  assert.notEqual(segunda.bestCandidate, null);
  assert.equal(segunda.fromCache, true);
  assert.equal(provider.consultas, 1);
});
