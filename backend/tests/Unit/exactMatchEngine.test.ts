// Testes do ExactMatchEngine — integridade da versão e pontuação.
//
// Cobrem os dois lados da Regra 2: um lançamento original NUNCA pode receber
// áudio de live/remix/instrumental, e uma versão que PEDE uma variante só é
// aceita quando o candidato comprova essa variante.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { ExactMatchEngine } from '../../src/services/audioSource/exactMatchEngine';
import {
  AudioCandidate,
  AudioIdentity,
  MatchClassification,
} from '../../src/services/audioSource/types';

const motor = new ExactMatchEngine();

function candidato(alteracoes: Partial<AudioCandidate> = {}): AudioCandidate {
  return {
    providerId: 'teste',
    sourceId: 'https://blog.exemplo.org/arquivos/faixa.mp3',
    artist: 'Daft Punk',
    title: 'One More Time',
    metadata: {},
    ...alteracoes,
  };
}

const identidadeOriginal: AudioIdentity = {
  artist: 'Daft Punk',
  title: 'One More Time',
};

test('aceita o lançamento original com artista, título e duração exatos', () => {
  const resultado = motor.scoreCandidate(identidadeOriginal, candidato({ duration: 320 }));

  assert.equal(resultado.classification, MatchClassification.EXACT_MATCH);
  assert.ok(resultado.score >= 90, `pontuação insuficiente: ${resultado.score}`);
});

test('ignora diferenças de caixa e acentuação na identidade', () => {
  const resultado = motor.scoreCandidate(
    { artist: 'Beyoncé', title: 'Halo' },
    candidato({ artist: 'beyonce', title: 'HALO' })
  );

  assert.equal(resultado.classification, MatchClassification.EXACT_MATCH);
});

test('rejeita candidato live para um lançamento original', () => {
  const resultado = motor.scoreCandidate(
    identidadeOriginal,
    candidato({ title: 'One More Time (Live)' })
  );

  assert.equal(resultado.classification, MatchClassification.REJECTED);
  assert.match(resultado.reasons.join(' '), /live/i);
});

test('rejeita candidato remix mesmo quando o campo version está vazio', () => {
  const resultado = motor.scoreCandidate(
    identidadeOriginal,
    candidato({ title: 'One More Time (Remix)' })
  );

  assert.equal(resultado.classification, MatchClassification.REJECTED);
  assert.match(resultado.reasons.join(' '), /remix/i);
});

test('rejeita instrumental quando o pedido é a versão original', () => {
  const resultado = motor.scoreCandidate(
    identidadeOriginal,
    candidato({ version: 'Instrumental' })
  );

  assert.equal(resultado.classification, MatchClassification.REJECTED);
});

test('aceita instrumental quando a identidade pede instrumental', () => {
  const resultado = motor.scoreCandidate(
    { ...identidadeOriginal, version: 'Instrumental' },
    candidato({ version: 'Instrumental' })
  );

  assert.equal(resultado.classification, MatchClassification.EXACT_MATCH);
});

test('rejeita quando a identidade pede variante e o candidato não comprova', () => {
  const resultado = motor.scoreCandidate(
    { ...identidadeOriginal, version: 'Instrumental' },
    candidato()
  );

  assert.equal(resultado.classification, MatchClassification.REJECTED);
  assert.match(resultado.reasons.join(' '), /não identificada/i);
});

test('trata "Original Mix" e "Remastered" como versões neutras', () => {
  const comOriginalMix = motor.scoreCandidate(
    identidadeOriginal,
    candidato({ version: 'Original Mix' })
  );
  const comRemaster = motor.scoreCandidate(
    identidadeOriginal,
    candidato({ title: 'One More Time', version: 'Remastered 2009' })
  );

  assert.equal(comOriginalMix.classification, MatchClassification.EXACT_MATCH);
  assert.equal(comRemaster.classification, MatchClassification.EXACT_MATCH);
});

test('rejeita artista completamente diferente', () => {
  const resultado = motor.scoreCandidate(
    identidadeOriginal,
    candidato({ artist: 'Metallica' })
  );

  assert.equal(resultado.classification, MatchClassification.REJECTED);
  assert.match(resultado.reasons.join(' '), /Artista muito diferente/i);
});

test('rejeita título com indicador de preview ou sample', () => {
  const resultado = motor.scoreCandidate(
    identidadeOriginal,
    candidato({ title: 'One More Time (Preview)' })
  );

  assert.equal(resultado.classification, MatchClassification.REJECTED);
  assert.match(resultado.reasons.join(' '), /preview|sample/i);
});

test('filtra apenas EXACT_MATCH da lista de pontuações', () => {
  const pontuacoes = motor.scoreCandidates(identidadeOriginal, [
    candidato(),
    candidato({ title: 'One More Time (Live)' }),
  ]);

  const exatos = motor.filterExactMatches(pontuacoes);

  assert.equal(exatos.length, 1);
  assert.equal(exatos[0]?.candidate.title, 'One More Time');
});
