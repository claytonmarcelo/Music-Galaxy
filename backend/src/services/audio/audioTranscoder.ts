// Serviço de Transcodificação de Áudio.
// Recebe um stream legível (Readable Stream) de áudio de origem (ex: YouTube)
// e utiliza o FFmpeg local para converter para MP3 320kbps ou FLAC em tempo real.
//
// Requer o FFmpeg instalado no sistema operacional (WampServer/Windows ou Linux).

import ffmpeg from 'fluent-ffmpeg';
import ffmpegStatic from 'ffmpeg-static';
import { Readable, PassThrough } from 'stream';

// Define o caminho do binário estático do ffmpeg para garantir funcionamento
// independentemente de estar instalado no Windows ou não
if (ffmpegStatic) {
  ffmpeg.setFfmpegPath(ffmpegStatic);
}

export type QualidadeAudio = 'mp3_320' | 'flac' | 'original';

export class AudioTranscoder {
  
  // Converte um stream de origem para o formato desejado e retorna um novo stream (PassThrough)
  transcodificar(inputStream: Readable, qualidade: QualidadeAudio): PassThrough {
    const outputStream = new PassThrough();

    if (qualidade === 'original') {
      // Repassa o áudio original sem alterações
      return inputStream.pipe(outputStream) as PassThrough;
    }

    // Configura o comando do FFmpeg
    let command = ffmpeg(inputStream);

    if (qualidade === 'mp3_320') {
      command = command
        .format('mp3')
        .audioCodec('libmp3lame')
        .audioBitrate('320k')
        // Preserva a taxa de amostragem mais alta
        .audioFrequency(44100);
    } else if (qualidade === 'flac') {
      command = command
        .format('flac')
        .audioCodec('flac')
        // FLAC não tem bitrate fixo, o codec gerencia para manter sem perdas
        // Baseado na fonte (que no nosso caso é o opus do youtube)
        .audioChannels(2);
    }

    // Pipe da saída do FFmpeg para nosso stream
    command
      .on('error', (err) => {
        // Ignora erros de "stream closed" que ocorrem quando o usuário cancela o download
        if (err.message && !err.message.includes('Output stream closed')) {
          console.error(`[AudioTranscoder] Erro na conversão para ${qualidade}:`, err.message);
        }
        outputStream.end();
      })
      .pipe(outputStream, { end: true });

    return outputStream;
  }
}

export const transcoder = new AudioTranscoder();
