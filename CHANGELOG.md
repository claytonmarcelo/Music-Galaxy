# Changelog

All notable changes to Music Galaxy will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Fixed
- **Audio Download Pipeline** - Reimplementado endpoint de download para gerar arquivos FLAC e MP3 reais e reproduzíveis
  - Substituído método anterior que usava `output: '-'` e `Buffer.from()` por pipeline completo
  - Novo pipeline: yt-dlp → arquivo temporário → FFmpeg → arquivo final → validação → cliente
  - Adicionada validação de assinatura FLAC (fLaC = 66 4C 61 43) antes de enviar ao cliente
  - Adicionada validação de assinatura MP3 (ID3 tag ou sync bytes) antes de enviar ao cliente
  - Implementada limpeza automática de arquivos temporários após download ou erro
  - Criado diretório `backend/temp/audio/` para arquivos temporários
  - Configurações FFmpeg:
    - FLAC: codec flac, 44100 Hz, stereo, 24 bit
    - MP3: codec libmp3lame, 320k bitrate, 44100 Hz, stereo
  - Arquivos temporários são removidos automaticamente em try/finally

### Changed
- **audioController.ts** - Refatoração completa da função `downloadAudio`
  - Adicionados imports: `fluent-ffmpeg`, `fs/promises`, `path`, `os`
  - Removida dependência de `extractAudio: true` do yt-dlp (causava erro)
  - Conversão agora é feita explicitamente pelo FFmpeg
  - Validação de formato antes de enviar ao cliente

### Technical Details
- **Problema original:** Arquivos baixados como `.flac` continham container ISO-BMFF/DASH (ftypdash) em vez de FLAC real
- **Causa raiz:** Uso de `output: '-'` com `Buffer.from()` não garantia conversão real do formato
- **Solução:** Pipeline completo com conversão explícita via FFmpeg e validação de assinatura
- **Validação:**
  - FLAC: Verifica bytes iniciais `66 4C 61 43` (ASCII: "fLaC")
  - MP3: Verifica bytes iniciais `49 44 33` (ID3) ou `FF FB/FA` (sync bytes)
