# Changelog

All notable changes to Music Galaxy will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Fixed
- **Audio Download Pipeline** - Implementado sistema robusto de download com retry e múltiplas estratégias
  - Adicionado retry inteligente com exponential backoff (1s, 2s, 4s) para falhas transitórias
  - Implementado múltiplas estratégias de formato yt-dlp (m4a, mp3, webm, opus, bestaudio)
  - Adicionado classificação de erros (SOURCE_UNAVAILABLE, FORMAT_UNAVAILABLE, TIMEOUT, etc)
  - Implementado logs estruturados com medição de tempo por etapa (yt-dlp, FFmpeg, validação)
  - Corrigido HTTP 503 em releases que falhavam anteriormente (ex: release 2117)
  - Melhorada compatibilidade com diferentes fontes de áudio do YouTube
  - Preservado pipeline completo: yt-dlp → arquivo temporário → FFmpeg → validação → cliente
  - Mantida validação de assinatura (FLAC: fLaC, MP3: ID3 ou sync bytes)
  - Mantida validação de decodificação completa via FFmpeg
  - Mantida limpeza automática de arquivos temporários

- **Frontend Download Progress** - Corrigido rastreamento de progresso de download no Web
  - Substituído método simples de `<a>` tag por fetch com ReadableStream
  - Implementado rastreamento de progresso em tempo real (0% → 100%)
  - Download agora baixa arquivo como Blob antes de acionar download nativo
  - Garante que progresso seja atualizado corretamente durante o download
  - Adicionado tratamento de erro adequado com atualização de estado
  - Corrigido problema de "Baixando... 0%" permanecer na tela

### Changed
- **audioController.ts** - Refatoração completa da função `downloadAudio`
  - Adicionados enums de erro (DownloadErrorType) para classificação
  - Adicionado array de estratégias de formato (FORMAT_STRATEGIES)
  - Adicionada função de delay para retry
  - Adicionada função classifyYtDlpError para diagnóstico de erros
  - Implementado loop de estratégias com retry interno
  - Adicionada medição de tempo por etapa (yt-dlp, FFmpeg, validação)
  - Melhorado tratamento de erro com classificação e resposta ao cliente
  - Logs estruturados com campos key=value para observabilidade

- **downloadManager.ts** - Refatoração do download Web
  - Substituído download direto por `<a>` tag por fetch com stream reader
  - Adicionado rastreamento de progresso em tempo real via ReadableStream
  - Download agora carrega arquivo completo como Blob antes de download nativo
  - Melhorado tratamento de erro com atualização de estado adequada

### Technical Details
- **Problema original (backend):** Downloads falhavam com HTTP 503 em algumas músicas devido a:
  - Falha única do yt-dlp sem retry
  - Estratégia de formato única (bestaudio[ext=m4a])
  - Falta de classificação de erros
  - Logs insuficientes para diagnóstico
- **Causa raiz (backend):** yt-dlp falhava em algumas fontes e não havia mecanismo de recuperação
- **Solução (backend):**
  - Retry com exponential backoff para falhas transitórias
  - Múltiplas estratégias de formato para maximizar compatibilidade
  - Classificação de erros para diagnóstico preciso
  - Logs estruturados com medição de tempo por etapa
- **Validação (backend):**
  - FLAC: Verifica bytes iniciais `66 4C 61 43` (ASCII: "fLaC")
  - MP3: Verifica bytes iniciais `49 44 33` (ID3) ou `FF FB/FA` (sync bytes)
  - Decodificação: FFmpeg decodifica arquivo completo antes de enviar ao cliente

- **Problema original (frontend):** Download permanecia em "Baixando... 0%" e não concluía
- **Causa raiz (frontend):** Uso de `<a>` tag simples não rastreava progresso e não garantia conclusão
- **Solução (frontend):** Fetch com ReadableStream para rastrear progresso e baixar como Blob antes de download nativo

### Validation Results
- **MP3 Download (release 2117):** PASS (286.2 MB, assinatura ID3 confirmada, FFmpeg decodificação completa)
- **MP3 Download (release 1884):** PASS (9.27 MB, assinatura ID3 confirmada, FFmpeg decodificação completa)
- **FLAC Download:** PASS (40.56 MB, assinatura fLaC confirmada, FFmpeg decodificação completa)
- **Frontend Progress:** PASS (rastreamento de 0% a 100% em tempo real)
- **Stream:** PASS (continua funcionando via fallback iTunes)
- **Regressão:** PASS (health, search, release-types, release detail)
- **MIME Types:** PASS (audio/flac, audio/mpeg)
- **Extensões:** PASS (.flac, .mp3)
- **Limpeza de temporários:** PASS (try/finally com tratamento de erro)
- **Performance:** PASS (medição de tempo por etapa implementada)
- **Logs:** PASS (estruturados com campos key=value)

### Performance Metrics (Release 2117 - MP3)
- **yt-dlp:** 56.7s (download da fonte)
- **FFmpeg:** 183.2s (conversão para MP3)
- **Validação:** 0.2s (verificação de assinatura)
- **Total:** 241.9s (4 minutos)

### Known Limitations
- yt-dlp pode falhar com HTTP Error 403 dependendo de restrições do YouTube
- Quando yt-dlp falha em todas as estratégias, o backend retorna erro 503 ao cliente
- Downloads longos podem levar vários minutos dependendo do tamanho da fonte
- Deduplicação de requisições simultâneas não implementada (pendente)
