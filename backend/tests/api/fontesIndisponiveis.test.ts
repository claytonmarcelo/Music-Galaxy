// Teste de integração do terceiro estado da busca: a fonte oficial não respondeu.
//
// Sobe o Express real numa porta efêmera e consulta o MariaDB real, como o resto
// da suíte de API. O que é trocado é só o método de consulta das duas fontes de
// metadados: ele recusa com o erro que o MusicBrainz realmente devolve quando
// está ocupado ("status 503", medido em 26/10/2026 nesta máquina). Nada de rede
// externa acontece aqui, e nenhuma linha é escrita no banco.
//
// Antes desta correção a resposta era `total=0, pendentes_audio=0,
// ingestao_em_curso=false` — exatamente a mesma de "essa música não existe" — e
// o aplicativo dizia "Nenhuma versão encontrada" sobre uma falha de consulta.

import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import type { Server } from 'node:http';
import { once } from 'node:events';

import { criarApp } from '../../src/app';
import pool from '../../src/config/database';
import { MusicBrainzAdapter } from '../../src/services/sources/musicBrainzAdapter';
import { DiscogsAdapter } from '../../src/services/sources/discogsAdapter';
import type { DadosReleaseExterno } from '../../src/types';

let servidor: Server | undefined;
let baseUrl = '';

const buscarPorTermoMB = MusicBrainzAdapter.prototype.buscarPorTermo;
const buscarPorTermoDiscogs = DiscogsAdapter.prototype.buscarPorTermo;

before(async () => {
  servidor = criarApp().listen(0, '127.0.0.1');
  await once(servidor, 'listening');

  const endereco = servidor.address();
  assert.ok(endereco && typeof endereco === 'object', 'servidor sem endereço');
  baseUrl = `http://127.0.0.1:${endereco.port}`;
});

after(async () => {
  // As fontes voltam a ser as originais para os testes que rodam depois.
  MusicBrainzAdapter.prototype.buscarPorTermo = buscarPorTermoMB;
  DiscogsAdapter.prototype.buscarPorTermo = buscarPorTermoDiscogs;

  if (servidor) {
    await new Promise<void>((resolve, reject) => {
      servidor?.close((erro) => (erro ? reject(erro) : resolve()));
    });
  }
  // Fechada aqui — é o que permite ao `node --test` terminar: a conexão com o
  // MariaDB fica aberta e seguraria a suíte inteira depois do último teste.
  await pool.end();
});

test('fonte oficial indisponível não é respondida como "nenhuma versão"', async () => {
  const indisponivel = (): Promise<DadosReleaseExterno[]> =>
    Promise.reject(new Error('MusicBrainz respondeu com status 503'));

  MusicBrainzAdapter.prototype.buscarPorTermo = indisponivel;
  DiscogsAdapter.prototype.buscarPorTermo = indisponivel;

  const resposta = await fetch(`${baseUrl}/api/search?q=zzzo+termo+que+nao+existe+zzz`);
  assert.equal(resposta.status, 200, 'a busca precisa responder mesmo com as fontes fora do ar');

  const corpo = (await resposta.json()) as {
    success: boolean;
    data: { total: number; pendentes_audio?: number; ingestao_em_curso?: boolean; fontes_indisponiveis?: boolean };
  };

  assert.equal(corpo.success, true);
  assert.equal(corpo.data.total, 0);
  assert.equal(corpo.data.fontes_indisponiveis, true, 'a resposta precisa dizer que a consulta ficou incompleta');
});

test('fonte que respondeu vazia não marca a consulta como incompleta', async () => {
  // O outro lado da mesma regra: "não tem" é um fato sobre a música, não sobre
  // a consulta. Se os dois casos acendessem o mesmo aviso, a tela mentiria.
  const vazio = (): Promise<DadosReleaseExterno[]> => Promise.resolve([]);

  MusicBrainzAdapter.prototype.buscarPorTermo = vazio;
  DiscogsAdapter.prototype.buscarPorTermo = vazio;

  const resposta = await fetch(`${baseUrl}/api/search?q=zzzo+termo+sem+par+zzz`);
  const corpo = (await resposta.json()) as {
    data: { total: number; fontes_indisponiveis?: boolean };
  };

  assert.equal(corpo.data.total, 0);
  assert.notEqual(corpo.data.fontes_indisponiveis, true, 'acervo vazio não é fonte indisponível');
});
