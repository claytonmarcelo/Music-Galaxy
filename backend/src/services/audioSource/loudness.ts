// Medida de loudness do arquivo — o "volume auto" honesto.
//
// "Volume auto sem distorção" tem duas leituras e uma delas estraga o áudio:
// normalizar o arquivo (re-encode com ganho aplicado) achata a dinâmica e ancora
// artefato num arquivo que já chegou comprimido. A outra — a que os tocadores e
// as bibliotecas de DJ usam — é medir o nível real, gravar o número nas etiquetas
// e deixar quem reproduz aplicar o ganho na hora. O arquivo continua bit a bit o
// que a fonte publicou (Regra 3: nada é reescrito aqui).
//
// Duas famílias de etiqueta convivem no mundo e por isso as duas são gravadas:
//   · ReplayGain (referência clássica de 89 dB SPL, ~-18 LUFS) — leem-na o
//     foobar2000, o MusicBee, o TagScanner e as bibliotecas de DJ;
//   · EBU R128 (`R128_TRACK_GAIN`, em centibel, referência -23 LUFS) — é o padrão
//     ITU-R BS.1143/ITU-R BS.1770 e o que os leitores nativos de FLAC/Opus consultam.
// Os dois saem da MESMA medição.
//
// Por que `ebur128` e não `loudnorm`: os dois são a implementação oficial do ITU
// BS.1770, mas o `loudnorm` reamostra o áudio inteiro para 192 kHz dentro do
// filtro. Medido em 26/10/2026 num MP3 de 3 min 25 s da cache: `loudnorm` levou
// 11,2 s (18× tempo real) e `ebur128=peak=true` levou 2,8 s (75×), com o MESMO
// resultado — I: -9.1 LUFS / true peak -0.2 dBFS contra input_i -9.13 / input_tp
// -0.19. O custo do `loudnorm` quase dobraria o tempo do download.

import { spawn } from 'child_process';
import ffmpegPath from 'ffmpeg-static';

export interface MedidaLoudness {
  /** Nível integrado medido, em LUFS. */
  integradoLufs: number;
  /** True peak medido, em dBTP. */
  picoDbtp: number;
  /** Faixa de loudness medida, em LU. */
  lraLu: number;
}

export interface EtiquetasDeGanho {
  replayGainTrackGain: string;
  replayGainTrackPeak: string;
  r128TrackGain: string;
}

// Referências dos dois padrões (documentadas no topo).
const REFERENCIA_REPLAY_GAIN_LUFS = -18;
const REFERENCIA_R128_LUFS = -23;

// A análise tem de caber no tempo do download: 3 min 25 s de MP3 custa 2,8 s.
// Passou disso, a etiqueta é omitida — o áudio entregue não atrasa por causa de
// uma medição que não respondeu.
const TEMPO_MAXIMO_MEDICAO_MS = 30_000;

/**
 * Converte a medição nas etiquetas que os tocadores leem. Puro, para ser testado
 * sem depender do binário.
 */
export function calcularEtiquetasDeGanho(medida: MedidaLoudness): EtiquetasDeGanho {
  // dBTP → fator de amplitude, no formato que o ReplayGain guarda (4 casas).
  const picoLinear = Math.pow(10, medida.picoDbtp / 20);
  const ganhoRg = REFERENCIA_REPLAY_GAIN_LUFS - medida.integradoLufs;
  // R128_TRACK_GAIN é o deslocamento até -23 LUFS, em centibel (inteiro).
  const ganhoR128 = Math.round((REFERENCIA_R128_LUFS - medida.integradoLufs) * 100);

  return {
    replayGainTrackGain: `${ganhoRg >= 0 ? '+' : ''}${ganhoRg.toFixed(2)} dB`,
    replayGainTrackPeak: picoLinear.toFixed(4),
    r128TrackGain: String(ganhoR128),
  };
}

// Lê o bloco `Summary:` que o filtro imprime ao fechar (nível info). As linhas de
// um em um segundo vêm ANTES dele, então o sumário é procurado do fim da saída.
export function interpretarSaidaEbur128(stderr: string): MedidaLoudness | null {
  const inicio = stderr.lastIndexOf('Summary:');
  if (inicio < 0) return null;
  const sumario = stderr.slice(inicio);

  const capturar = (padrao: RegExp): number | null => {
    const casa = sumario.match(padrao);
    if (!casa) return null;
    // Pista muda/silenciosa imprime `-inf`: não é número e não gera etiqueta.
    const valor = Number(casa[1]);
    return Number.isFinite(valor) ? valor : null;
  };

  const integrado = capturar(/I:\s+(-?[\d.]+)\s+LUFS/);
  const pico = capturar(/Peak:\s+(-?[\d.]+)\s+dBFS/);
  if (integrado === null || pico === null) return null;

  return { integradoLufs: integrado, picoDbtp: pico, lraLu: capturar(/LRA:\s+(-?[\d.]+)\s+LU/) ?? 0 };
}

/**
 * Mede o loudness real do arquivo. Devolve `null` em qualquer falha (binário
 * ausente, timeout, resposta sem sumário): a etiqueta é uma melhoria, nunca um
 * motivo para o download falhar.
 */
export async function medirLoudness(arquivo: string): Promise<MedidaLoudness | null> {
  const parametros = [
    '-hide_banner',
    '-nostats',
    '-i', arquivo,
    // Só a faixa de áudio: a capa embutida não interessa na medição.
    '-map', '0:a:0',
    // peak=true = true peak (sobremostragem), o número que o padrão pede.
    '-af', 'ebur128=peak=true',
    '-f', 'null',
    process.platform === 'win32' ? 'NUL' : '/dev/null',
  ];

  return new Promise((resolve) => {
    const binario = ffmpegPath || 'ffmpeg';
    let processo: ReturnType<typeof spawn>;
    try {
      processo = spawn(binario, parametros);
    } catch {
      resolve(null);
      return;
    }

    let stderr = '';
    const temporizador = setTimeout(() => {
      processo.kill('SIGKILL');
      resolve(null);
    }, TEMPO_MAXIMO_MEDICAO_MS);
    temporizador.unref?.();

    processo.stderr?.on('data', (pedaco: Buffer) => {
      stderr += pedaco.toString('utf8');
      // Guarda o FIM da saída: o sumário é a última coisa que o filtro escreve e
      // uma faixa longa despejaria uma linha de medição a cada 3 s no buffer.
      if (stderr.length > 64_000) stderr = stderr.slice(-32_000);
    });

    processo.on('error', () => {
      clearTimeout(temporizador);
      resolve(null);
    });
    processo.on('close', () => {
      clearTimeout(temporizador);
      resolve(interpretarSaidaEbur128(stderr));
    });
  });
}
