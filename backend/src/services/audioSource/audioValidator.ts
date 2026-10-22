// Audio Validator — Validação rigorosa de arquivos de áudio
// Verifica duração, qualidade, integridade e detecta conteúdo indesejado

import ffmpeg from 'fluent-ffmpeg';
import ffmpegPath from 'ffmpeg-static';
import { path as ffprobePath } from 'ffprobe-static';
import fs from 'fs/promises';

export interface ValidationResult {
  valid: boolean;
  format: string;
  codec: string;
  duration: number;
  sampleRate: number;
  bitDepth?: number;
  bitrate?: number;
  channels: number;
  issues: string[];
  confidence: number; // 0-100
}

export interface DurationCheckResult {
  compatible: boolean;
  actualDuration: number;
  expectedDuration?: number;
  difference: number;
  tolerance: number;
}

export class AudioValidator {
  // Verificar assinatura de arquivo
  async checkFileSignature(filePath: string): Promise<{ valid: boolean; format: string }> {
    try {
      const buffer = await fs.readFile(filePath);
      const firstBytes = buffer.subarray(0, 12);

      // FLAC: fLaC (66 4C 61 43)
      if (firstBytes[0] === 0x66 && firstBytes[1] === 0x4C && 
          firstBytes[2] === 0x61 && firstBytes[3] === 0x43) {
        return { valid: true, format: 'flac' };
      }

      // MP3: ID3v2 (49 44 33) ou sync bytes (FF FB/FA)
      if (firstBytes[0] === 0x49 && firstBytes[1] === 0x44 && firstBytes[2] === 0x33) {
        return { valid: true, format: 'mp3' };
      }

      if (firstBytes[0] === 0xFF && (firstBytes[1] === 0xFB || firstBytes[1] === 0xFA)) {
        return { valid: true, format: 'mp3' };
      }

      // WAV: RIFF (52 49 46 46)
      if (firstBytes[0] === 0x52 && firstBytes[1] === 0x49 && 
          firstBytes[2] === 0x46 && firstBytes[3] === 0x46) {
        return { valid: true, format: 'wav' };
      }

      // M4A: ftyp (66 74 79 70)
      if (firstBytes[4] === 0x66 && firstBytes[5] === 0x74 && 
          firstBytes[6] === 0x79 && firstBytes[7] === 0x70) {
        return { valid: true, format: 'm4a' };
      }

      return { valid: false, format: 'unknown' };
    } catch (error) {
      console.error('[AudioValidator] Error checking file signature:', error);
      return { valid: false, format: 'unknown' };
    }
  }

  // Obter metadados completos do arquivo usando ffprobe
  async getMetadata(filePath: string): Promise<ValidationResult | null> {
    return new Promise((resolve) => {
      ffmpeg(filePath)
        .setFfmpegPath(ffmpegPath || 'ffmpeg')
        // binário ffprobe embutido — sem isso a chamada falha fora do PATH
        .setFfprobePath(ffprobePath || 'ffprobe')
        .ffprobe((err, metadata) => {
          if (err) {
            console.error('[AudioValidator] Error getting metadata:', err);
            resolve(null);
            return;
          }

          const format = metadata.format;
          const audioStream = metadata.streams?.find(s => s.codec_type === 'audio');

          if (!format || !audioStream) {
            resolve(null);
            return;
          }

          const issues: string[] = [];
          let confidence = 100;

          // Verificar se o arquivo está truncado
          if (format.size && format.duration) {
            const bitrate = (format.size * 8) / format.duration / 1000;
            if (bitrate < 32) {
              issues.push('Bitrate muito baixo, possível arquivo truncado');
              confidence -= 30;
            }
          }

          // Verificar se há streams de vídeo (não deve ter em arquivo de áudio)
          const videoStream = metadata.streams?.find(s => s.codec_type === 'video');
          if (videoStream) {
            issues.push('Arquivo contém stream de vídeo');
            confidence -= 20;
          }

          // Verificar se há streams de subtítulo (não deve ter em arquivo de áudio)
          const subtitleStream = metadata.streams?.find(s => s.codec_type === 'subtitle');
          if (subtitleStream) {
            issues.push('Arquivo contém stream de subtítulo');
            confidence -= 10;
          }

          resolve({
            valid: issues.length === 0,
            format: format.format_name || 'unknown',
            codec: audioStream.codec_name || 'unknown',
            duration: format.duration || 0,
            sampleRate: audioStream.sample_rate || 0,
            bitDepth: audioStream.bits_per_sample,
            bitrate: audioStream.bit_rate ? parseInt(audioStream.bit_rate) : format.bit_rate,
            channels: audioStream.channels || 0,
            issues,
            confidence,
          });
        });
    });
  }

  // Verificar compatibilidade de duração
  checkDuration(
    actualDuration: number,
    expectedDuration?: number,
    tolerance: number = 5
  ): DurationCheckResult {
    if (!expectedDuration) {
      // Se não tem duração esperada, não pode rejeitar por isso
      return {
        compatible: true,
        actualDuration,
        difference: 0,
        tolerance: 0,
      };
    }

    const difference = Math.abs(actualDuration - expectedDuration);
    const toleranceAbsolute = Math.max(tolerance, expectedDuration * 0.1); // 10% ou tolerance, o que for maior
    const compatible = difference <= toleranceAbsolute;

    return {
      compatible,
      actualDuration,
      expectedDuration,
      difference,
      tolerance: toleranceAbsolute,
    };
  }

  // Detectar possíveis vinheta ou conteúdo extra
  async detectVinylOrExtraContent(filePath: string): Promise<{ hasVinyl: boolean; hasExtraContent: boolean; confidence: number }> {
    // Esta é uma detecção heurística baseada em análise de áudio
    // Uma implementação completa exigiria análise de waveform e detecção de padrões
    
    // Por enquanto, retorna valores padrão conservadores
    // Em uma implementação completa, seria usado:
    // - Análise de espectrograma
    // - Detecção de cliques/pops (vinyl)
    // - Detecção de locutor (voz humana)
    // - Detecção de silêncio prolongado no início/fim
    
    return {
      hasVinyl: false,
      hasExtraContent: false,
      confidence: 50, // Confiança média pois não foi implementada análise completa
    };
  }

  // Validar se é FLAC real (não upsampled de MP3)
  async validateFlacQuality(filePath: string): Promise<{ isRealFlac: boolean; confidence: number; reason: string }> {
    try {
      const metadata = await this.getMetadata(filePath);
      
      if (!metadata) {
        return { isRealFlac: false, confidence: 0, reason: 'Não foi possível ler metadados' };
      }

      if (metadata.format !== 'flac' && metadata.codec !== 'flac') {
        return { isRealFlac: false, confidence: 100, reason: 'Formato não é FLAC' };
      }

      // Verificar se tem bit depth adequado (FLAC real deve ter pelo menos 16 bit)
      if (metadata.bitDepth && metadata.bitDepth < 16) {
        return { isRealFlac: false, confidence: 80, reason: `Bit depth muito baixo (${metadata.bitDepth} bit)` };
      }

      // Verificar se tem sample rate adequado (FLAC real deve ter pelo menos 44.1kHz)
      if (metadata.sampleRate && metadata.sampleRate < 44100) {
        return { isRealFlac: false, confidence: 70, reason: `Sample rate muito baixo (${metadata.sampleRate} Hz)` };
      }

      // Verificar se tem bitrate consistente com lossless
      // FLAC lossless típico tem bitrate muito alto (700-1500 kbps para estéreo)
      if (metadata.bitrate && metadata.bitrate < 500000) {
        return { isRealFlac: false, confidence: 60, reason: `Bitrate muito baixo para FLAC lossless (${metadata.bitrate / 1000} kbps)` };
      }

      // Se passou todas as verificações, é provavelmente FLAC real
      return { isRealFlac: true, confidence: 85, reason: 'Metadados consistentes com FLAC lossless' };
    } catch (error) {
      console.error('[AudioValidator] Error validating FLAC quality:', error);
      return { isRealFlac: false, confidence: 0, reason: 'Erro na validação' };
    }
  }

  // Validar se é MP3 de qualidade adequada
  async validateMp3Quality(filePath: string): Promise<{ isGoodQuality: boolean; confidence: number; reason: string }> {
    try {
      const metadata = await this.getMetadata(filePath);
      
      if (!metadata) {
        return { isGoodQuality: false, confidence: 0, reason: 'Não foi possível ler metadados' };
      }

      if (metadata.format !== 'mp3' && metadata.codec !== 'mp3') {
        return { isGoodQuality: false, confidence: 100, reason: 'Formato não é MP3' };
      }

      // Verificar se tem bitrate adequado (pelo menos 128 kbps)
      if (metadata.bitrate && metadata.bitrate < 128000) {
        return { isGoodQuality: false, confidence: 90, reason: `Bitrate muito baixo (${metadata.bitrate / 1000} kbps)` };
      }

      // Verificar se tem sample rate adequado (pelo menos 44.1kHz)
      if (metadata.sampleRate && metadata.sampleRate < 44100) {
        return { isGoodQuality: false, confidence: 80, reason: `Sample rate muito baixo (${metadata.sampleRate} Hz)` };
      }

      // Se passou todas as verificações, é qualidade aceitável
      return { isGoodQuality: true, confidence: 85, reason: 'Metadados consistentes com MP3 de qualidade' };
    } catch (error) {
      console.error('[AudioValidator] Error validating MP3 quality:', error);
      return { isGoodQuality: false, confidence: 0, reason: 'Erro na validação' };
    }
  }

  // Validação completa de arquivo
  async validateFile(
    filePath: string,
    expectedFormat: 'mp3' | 'flac',
    expectedDuration?: number
  ): Promise<ValidationResult> {
    const issues: string[] = [];
    let confidence = 100;

    // 1. Verificar assinatura do arquivo
    const signatureCheck = await this.checkFileSignature(filePath);
    if (!signatureCheck.valid) {
      issues.push('Assinatura de arquivo inválida');
      confidence -= 50;
    } else if (signatureCheck.format !== expectedFormat) {
      issues.push(`Formato incorreto: esperado ${expectedFormat}, encontrado ${signatureCheck.format}`);
      confidence -= 30;
    }

    // 2. Obter metadados completos
    const metadata = await this.getMetadata(filePath);
    if (!metadata) {
      return {
        valid: false,
        format: 'unknown',
        codec: 'unknown',
        duration: 0,
        sampleRate: 0,
        channels: 0,
        issues: ['Não foi possível ler metadados do arquivo'],
        confidence: 0,
      };
    }

    // 3. Verificar duração
    if (expectedDuration) {
      const durationCheck = this.checkDuration(metadata.duration, expectedDuration);
      if (!durationCheck.compatible) {
        issues.push(
          `Duração incompatível: esperado ${expectedDuration}s, ` +
          `encontrado ${metadata.duration}s (diferença: ${durationCheck.difference}s)`
        );
        confidence -= 40;
      }
    }

    // 4. Validar qualidade específica do formato
    if (expectedFormat === 'flac') {
      const flacQuality = await this.validateFlacQuality(filePath);
      if (!flacQuality.isRealFlac) {
        issues.push(flacQuality.reason);
        confidence -= (100 - flacQuality.confidence) * 0.5;
      }
    } else if (expectedFormat === 'mp3') {
      const mp3Quality = await this.validateMp3Quality(filePath);
      if (!mp3Quality.isGoodQuality) {
        issues.push(mp3Quality.reason);
        confidence -= (100 - mp3Quality.confidence) * 0.3;
      }
    }

    // 5. Adicionar issues dos metadados
    issues.push(...metadata.issues);
    confidence -= (100 - metadata.confidence) * 0.2;

    // 6. Detectar vinheta/conteúdo extra (heuristic)
    const vinylCheck = await this.detectVinylOrExtraContent(filePath);
    if (vinylCheck.hasVinyl) {
      issues.push('Possível conteúdo de vinil detectado');
      confidence -= 20;
    }
    if (vinylCheck.hasExtraContent) {
      issues.push('Possível conteúdo extra detectado');
      confidence -= 15;
    }

    return {
      valid: issues.length === 0 && confidence >= 70,
      format: metadata.format,
      codec: metadata.codec,
      duration: metadata.duration,
      sampleRate: metadata.sampleRate,
      bitDepth: metadata.bitDepth,
      bitrate: metadata.bitrate,
      channels: metadata.channels,
      issues,
      confidence: Math.max(0, confidence),
    };
  }

  // Decodificar arquivo completo para verificar integridade
  async decodeFile(filePath: string): Promise<{ success: boolean; error?: string }> {
    return new Promise((resolve) => {
      const tempDir = require('path').join(__dirname, '../../../temp/audio');
      const tempFile = require('path').join(tempDir, `decode_test_${Date.now()}.wav`);

      ffmpeg(filePath)
        .setFfmpegPath(ffmpegPath || 'ffmpeg')
        .output(tempFile)
        .on('end', () => {
          // Limpar arquivo temporário
          require('fs').unlink(tempFile, () => {});
          resolve({ success: true });
        })
        .on('error', (err) => {
          // Limpar arquivo temporário se existir
          require('fs').unlink(tempFile, () => {});
          resolve({ success: false, error: err.message });
        })
        .run();
    });
  }
}
