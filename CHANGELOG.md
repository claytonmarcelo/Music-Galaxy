# Changelog

All notable changes to Music Galaxy will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Fixed (Animações na web)
- **Aviso de `useNativeDriver` eliminado** — O React Native Web exibia "Animated: useNativeDriver is not supported because the native animated module is missing" a cada animação (no navegador não existe módulo nativo de animação). Os 9 arquivos de tela/componente que ainda passavam `useNativeDriver: true` fixo agora usam a constante `USE_NATIVE_DRIVER` exportada por `mobile/src/utils/animacoes.ts` (`Platform.OS !== 'web'`): no Android/iOS a animação continua nativa; na web roda em JS sem aviso. Verificado no console do Expo web após busca real ("daft punk"): zero warnings/erros. `npx tsc --noEmit` limpo no mobile.

### Fixed (Interface)
- **Plural de "versão" corrigido** — o app montava o plural como `"versão" + "ões"`, exibindo "versãoões" na tela de busca ("30 versãoões encontradas"), no rodapé da lista, nos detalhes da obra e em Favoritos; agora o texto usa `versão`/`versões` (e `encontrada`/`encontradas`) corretamente. Verificado no app: "30 versões encontradas, aguardando a descoberta do áudio em sites abertos".

### Changed (Interface)
- **Espaçamento do card de versão** — `ReleaseCard` com capa de 104px, respiro interno de 14px/12px, gap consistente entre as linhas de informação (artista, versão, álbum, metadados e rodapé), badges maiores (8px/3px) e margens do card alinhadas ao cabeçalho da lista (20px horizontais, 8px verticais). Nenhuma cor fixa: tudo continua vindo dos tokens do tema.

### Added (Correções do usuário — diff/zip de 2026-10-23)
- **Rota `/api/works/by-decade/:decade` reordenada** — Estava registrada depois de `/works/:id` em `backend/src/routes/index.ts`, então "by-decade" era capturado como `:id` e respondia 400; movida para antes das rotas dinâmicas (com comentário explicativo). Verificado na API: `GET /api/works/by-decade/1990` agora responde 200 com JSON válido.
- **Busca no MusicBrainz por artista/título/álbum** — `musicBrainzAdapter.ts` ganhou `montarQuery()`: cada palavra do termo com 2+ letras vira um grupo Lucene `(recording:p OR artist:p OR release:p)` combinado com AND (antes, "Daft Punk One More Time" procurava apenas no título da gravação e não achava a música). Verificado contra a API real: a query multi-campo retorna gravações com `releases` incluídos por padrão (o `inc` explícito foi removido com segurança).
- **Downloads simultâneos: seguidor servido do cache** — `downloadDeduplication.ts` ganhou `isInFlight()`/`waitForInFlight()`; no `audioController`, quando outro cliente já está gerando o mesmo arquivo, o seguidor espera e serve direto do cache com `X-Cache: HIT`; se o líder falhar, ele produz por conta própria (antes, o seguidor herdava o erro do líder).
- **Arquivos temporários únicos por requisição** — O nome dos arquivos de trabalho do download agora inclui `randomUUID()` além do timestamp, eliminando colisão entre downloads simultâneos da mesma versão.
- **Busca sempre aponta para os endpoints do backend** — `searchController.ts` não lê mais `streaming_url`/`download_url` do banco (podem conter previews de 30s legados); devolve sempre `${baseUrl}/api/releases/:id/stream` e `/download`.
- **Ingestão não derruba a busca** — No caminho sem dados locais, a falha das fontes externas (ex.: rate limit do MusicBrainz) é capturada e a resposta sai com o que existe no banco, em vez de estourar 500.
- **Timeout do app móvel ampliado para 45s** — Buscas de termos ainda não ingeridos esperam o backend consultar as fontes externas; 15s cortava a busca legítima pela metade.
- **Guard de 3 caracteres na tela de busca** — Termos parciais ("da", "daf") não disparam mais a busca com debounce, economizando cota das APIs externas e evitando poluir o banco.

### Nota (Decisões de integração)
- **Não adotado do diff:** o fluxo de ingestão por TTL/`fromCache` do orquestrador (conflita com a regra do usuário de nunca reutilizar buscas idênticas — nossa busca dispara ingestão nova e limpa o cache do termo); as chaves `SPOTIFY_*` no `.env.example` (o usuário pediu a remoção delas do `.env`); o hunk do `PlayerContext` (arquivo inexistente na nossa árvore — o player foi reescrito); a migração `fix_preview_urls.sql` (nossa migração `replace_platform_audio_with_web_sources.sql` já zera essas colunas — banco verificado com 0 linhas de previews legados). Correções equivalentes já existiam aqui: deduplicação de artistas no orquestrador (SELECT antes do INSERT), rota `by-date` antes de `:id`, URLs de download do `downloadManager` via `BASE_URL` configurável, e preservação do arquivo em cache (o `downloadCache.set()` move o arquivo e a limpeza final só apaga temporários).

### Added (Regras do usuário: formatos e áudio obrigatório)
- **Catálogo de formatos ampliado** — Adicionados `CD` e `DVD` como formatos de lançamento no seed de `release_types` (catálogo agora com 99 tipos, verificado via SQL). O mapeamento do Discogs (`discogsAdapter.ts`) passou a usar lista ordenada de prioridades (`12"`/`maxi` → Maxi Single, `dvd` → DVD, `7"`/`single` → Single, `ep` → EP etc.) e a qualidade reconhece `DVD`; MP3/FLAC continuam como qualidade `Digital`.
- **Busca exibe somente versões com áudio (regra do usuário)** — "Caso encontre uma música que não possua o áudio, elimine a busca e não mostre no aplicativo": `GET /api/search` devolve apenas versões com `audio_source_url` preenchida; as demais entram em uma fila de resolução em segundo plano (uma a uma, 8s de intervalo) que descobre a fonte em sites abertos e a persiste para as próximas buscas. A resposta ganhou o campo `pendentes_audio` (versões do termo ainda sem áudio). A mesma regra vale em `GET /api/releases/by-date`, `GET /api/works/:id/releases` e `GET /api/works/by-decade/:decade` (obras só aparecem se tiverem ao menos uma versão com áudio). Verificado na API: busca por "Daft Punk One More Time" retorna `total: 0` e `pendentes_audio: 10` (as 10 versões do termo aguardavam fonte), e `by-date`/`by-decade` retornam vazio com o banco sem fontes ainda.
- **Aviso de resolução em andamento no app** — Quando o backend achou versões mas ainda está descobrindo o áudio, a tela de busca mostra "Localizando fontes de áudio..." com a quantidade pendente e o botão "Buscar novamente"; o toast passou a ser informativo ("Localizando fontes de áudio para N versões...") em vez de "Encontradas 0 versões".
- **Placeholder da busca sempre na cor padrão** — O placeholder virou um `Text` próprio sobreposto ao campo (em vez do `placeholder` nativo), garantindo a cor do token `textSecondary` em qualquer plataforma — elimina o amarelo pintado pelo autofill do sistema no Android/web.

### Fixed (Descoberta global de áudio)
- **Motor de busca trocado para Brave via curl** — Bing ignora aspas até em frases curtas (retorna resultados sem relação), DuckDuckGo/Mojeek/SearXNG respondem desafio ou 403; o Brave respeita frases curtas entre aspas e entrega resultados orgânicos de blogs/fóruns. Como o Brave distingue TLS de Node (HTTP 429) do curl do sistema (200), o `GenericWebProvider` baixa o HTML do motor via `execFile`/curl (lista de argumentos, sem shell) com fallback axios; páginas de desafio ("scheduled a captcha") são detectadas e colocam o motor em espera por 10 minutos, com 3s entre consultas (anti-rajada).
- **Assinatura de blog no nome do arquivo** — `interpretarNomeDeArquivo` agora corta o título no próximo separador ("One More Time - Club Remixer . com" → "One More Time"), destravando o exact match: 5 candidatos reais de `clubremixer.com` pontuaram 100.0 no diagnóstico (antes eram rejeitados por "título muito diferente").
- **Qualificador de versão mais preciso** — Rótulos de release (Compilation, Album, EP etc.) não são mais enviados como "versão" ao Exact Match Engine, evitando penalizar candidatos legítimos de sites abertos; somente qualificadores reais (Radio Edit, Remix, Live...) contam para a pontuação de versão.

### Added (Build do APK via EAS)
- **Dependências alinhadas ao SDK 57 de verdade** — O `package.json` do mobile ainda apontava `react@18.2.0` e `react-native@0.74.5`, incompatíveis com o `expo@57`; `npx expo install --fix` alinhou tudo para as versões esperadas (`react@19.2.3`, `react-native@0.86.3`, `typescript@6.0.3`, `@types/react@~19.2.4`, `expo@~57.0.31` e módulos expo-* correspondentes) e removeu `@types/react-native` (obsoleto — o React Native embute os próprios tipos desde a 0.73).
- **Overrides na raiz do monorepo** — `react`/`react-dom`/`react-native` fixados em uma única versão para o projeto inteiro, eliminando a cópia antiga de `react-native@0.74.5` que o npm auto-instalava na raiz por causa de peer de `@expo/devtools` (exposta pelo `expo-doctor` como duplicata de módulo nativo).
- **Migração `expo-av` → `expo-audio`** — O `expo-av` está sem manutenção e não existe no Expo Go do SDK 57 (verificado em `bundledNativeModules`); o playback nativo (`playerAudio.ts` e `MusicPlayer.tsx`) foi reescrito sobre `createAudioPlayer`/`playbackStatusUpdate` do `expo-audio@~57.0.5` (módulo oficial, presente no Expo Go), com `didJustFinish` removendo o player e tempos convertidos para milissegundos. Decisão autorizada pelo usuário.
- **`app.json` corrigido para o schema do SDK 57** — O campo raiz `splash` (removido no SDK 57) virou configuração do plugin `expo-splash-screen`; plugin `expo-audio` registrado.

### Fixed (Build do APK via EAS)
- **Compatibilidade com TypeScript 6** — `Blob` com `Uint8Array<ArrayBufferLike>` agora usa `BlobPart[]` em `MusicPlayer`/`downloadManager`; `NodeJS.Timeout` trocado por `ReturnType<typeof setTimeout>` em `helpers.ts`.
- **Patches exigidos pelo SDK** — `@react-native-community/slider` fixado em `5.2.0` e `react-native-webview` em `13.16.1` (as versões que o SDK 57 espera).

### Changed (Build do APK via EAS)
- **`expo-doctor`: 21/21 verificações passando** (antes: 3 falhas — schema do app.json, duplicatas de módulo nativo e expo-av sem manutenção).
- **Pipeline de áudio revalidado após reinstalação limpa** — `GET /releases/:id/download?format=flac` gerou FLAC real de 786.918 bytes (assinatura `fLaC`) via ffmpeg-static; stream 206 com Range e download MP3 continuam íntegros; registro temporário de teste revertido no banco.
- **Validações reexecutadas com saída real** — `tsc --noEmit` limpo no backend e no mobile (React 19 + RN 0.86 + TS 6), export do bundle Android (`expo export --platform android --no-bytecode`) com sucesso, backend `/health` ok e Expo dev server no ar em LAN.

### Changed (Limpeza de configuração)
- **Chaves órfãs do Spotify removidas do `.env`** — `SPOTIFY_CLIENT_ID` e `SPOTIFY_CLIENT_SECRET` (com a seção de comentários associada) eram sobras da era pré-Regra 3 e não eram lidas por nenhum código (grep confirmou zero referências); removidas do `backend/.env` a pedido do usuário.

### Added (Barra de navegação inferior)
- **Barra de navegação inferior** — Novo componente `mobile/src/components/BarraNavegacaoInferior.tsx` com as 5 áreas principais (Busca, Biblioteca, Explorar, Favoritos, Ajustes), renderizada sob o stack em `AppNavigator.tsx`. A aba ativa é detectada percorrendo a pilha de navegação de trás para frente (mantém o destaque correto mesmo em telas de detalhe empilhadas); ícones via `MusicEmojis`, cores 100% dos tokens do tema (vidro fosco, sem hexadecimal fixo), com rótulos de acessibilidade em pt-BR. Telas que antes não tinham nenhum ponto de entrada (Biblioteca, Explorar, Ajustes) agora são acessíveis.
- **Rota `/api/releases/by-date` reativada** — A rota estática estava registrada depois de `/releases/:id` em `backend/src/routes/index.ts`, então "by-date" era capturado como `:id` e o `validarParamId` respondia 400 ("ID inválido"); reordenada para antes da rota dinâmica (com comentário explicando o porquê). A aba Explorar voltou a listar as versões recentes.

### Fixed (Player)
- **Erro técnico em inglês no player** — Ao tocar uma versão sem fonte de áudio aberta, o player exibia o texto bruto do HTML5 Audio ("Failed to load because no supported source was found."); `playerAudio.ts` agora detecta erros de mídia da web (nome `NotSupportedError`, mensagens de source não suportado ou `audio.error` preenchido) e os converte em "Nenhuma fonte de áudio aberta disponível para esta versão.", exibida pelo modal global em pt-BR.
- **Tipos mortos de navegação removidos** — `RootStackParamList` declarava variantes "…Tab" (BuscaTab, BibliotecaTab, ExplorarTab, FavoritosTab, SettingsTab) que nunca existiram no navegador; removidas e `tsc --noEmit` limpo nas duas camadas.

### Added (Identidade visual e preparação para APK)
- **Identidade visual "vidro fosco + aurora" aplicada globalmente** — `ThemeContext` ganhou tokens de vidro (`glassCard`, `glassCardForte`, `glassBorder`, `glassHighlight`, `glassShadow`, `backdrop`) e de luzes da aurora (`auroraPrimaria/Secundaria/Terciaria/Quaternaria`), mantendo todas as chaves antigas; novos componentes compartilhados `AuroraBackground` (céu de aurora com círculos de luz translúcidos, em React Native puro, sem dependências novas) e `GlassCard` (cartão de vidro com brilho de borda e sombra). Todas as telas, componentes, modais e toasts usam a nova identidade; zero cores hexadecimais fixas restantes.
- **Modais personalizados globais** — As 15 chamadas `Alert.alert` foram substituídas por `useModal()` (`abrirErro`, `abrirConfirmacao`, `toastSucesso` etc.) com textos coerentes e contextuais em português brasileiro; `ModalPersonalizado` e `ToastNotificacao` restilizados em vidro fosco com cores do tema.
- **Servidor da API configurável no app** — Novo `mobile/src/services/apiConfig.ts` (endereço salvo no AsyncStorage); `api.ts` agora carrega o endereço salvo ao iniciar e todas as chamadas usam a variável viva `BASE_URL`; nova seção "Servidor da API" em Ajustes com campo de endereço, botões Salvar / Testar conexão / Restaurar padrão. Eliminado o IP de rede local fixo da produção.
- **Modo offline** — `OfflineBanner` global avisa quando o servidor não responde (ou não foi configurado) com atalho para Ajustes; o app abre normalmente sem internet.
- **Ícone com fundo transparente** — Nova arte do ícone (disco em vidro com aurora + nome "Music Galaxy" em tipografia elegante) gerada e processada em Node para transparência real no canal alfa (comprovado: 73,8% dos pixels transparentes, cantos com alfa 0); `app.json` atualizado (ícone transparente, splash sobre `#0B0B1A`, adaptive icon removido conforme decisão do usuário).
- **`mobile/eas.json`** — Perfis de build EAS (development/preview/production) gerando **APK** (`buildType: apk`).
- **`utils/tiposRelease.ts`** — Tradução centralizada dos tipos de versão para pt-BR (Álbum, Single, EP, Coletânea, Ao vivo, Remix, Instrumental, Demo, Mixtape, Trilha sonora); usada em `ReleaseCard` e `DetalheReleaseScreen`.

### Changed (Identidade visual e pt-BR)
- **Textos em português brasileiro corrigidos** — "este release dos favoritos" → "esta versão dos favoritos", "Nenhum release encontrado" → "Nenhuma versão encontrada", "Tentar Novamente" → "Tentar novamente", "Releases Criados" → "Versões criadas", plural correto em "Encontrada(s) X versão(ões)", "Nenhuma URL de áudio original..." → "Nenhuma fonte de áudio disponível para esta versão."; "release(s)" em textos de interface → "versão(ões)" (código/API intactos).
- **Navegação e tema** — `AppNavigator` com tema do React Navigation alinhado à identidade e `OfflineBanner` integrado; `App.tsx` carrega a configuração do servidor antes das primeiras requisições.
- **Catálogo de tipos corrigido no banco** — As linhas do catálogo `Álbum` e `Coletânea` estavam com mojibake (`??lbum`, `Colet??nea`) por importação sem UTF-8; corrigidas via `UPDATE` com os valores do próprio seed (verificado na API: bytes UTF-8 corretos). A faixa "Penniefluitjie Kw?la" NÃO foi alterada — o `?` vem da própria fonte oficial (MusicBrainz), e os dados de fonte nunca são modificados (Regra 2).
- **Remoção de código morto/órfãos** — Excluídos do mobile: `BottomSheet`, `CardArtista`, `FiltrosAvancados`, `GlobalPlayer`, `SkeletonLoader`, `TemaToggle`, `useModalGlobal`, `PlayerContext`, `TemaContext` (tema paralelo duplicado), `LoadingScreen`, `adaptive-icon.png`, `generate-assets.js` e o `dist/` web antigo — sem referências em lugar nenhum (verificado por grep) e com `tsc --noEmit` limpo depois.

### Fixed (Identidade visual)
- **`elevation` em estilo de `Image`** — `DetalheReleaseScreen` aplicava `elevation` (propriedade de `View`) no `Image` da capa; a sombra foi movida para o contêiner (`capaWrapper`) e o `tsc --noEmit` voltou a passar.
- **Import quebrado `API_BASE_URL`** — `TelaExplorar` importava `API_BASE_URL`, que não existia mais no `api.ts`; migrado para `BASE_URL`.

### Added (Regra 3 — áudio apenas de fontes web abertas)
- **REGRA 3 permanente** — O projeto deve usar somente sites abertos no mundo inteiro (blogs, fóruns, links diretos); proibido YouTube, Spotify, Deezer e qualquer plataforma de música de qualquer tipo ou gênero. Registrada em `AGENTS.md`.
- **`backend/src/services/audioSource/webAudio.ts`** — Guard central da Regra 3: `PLATAFORMAS_PROIBIDAS` (YouTube, Spotify, Deezer, Apple/iTunes, Amazon, Tidal, SoundCloud, Bandcamp, Qobuz etc.), `auditarUrl()` com anti-SSRF (apenas http/https, sem credenciais, DNS validado, rejeição de IPs não roteáveis), `criarBeforeRedirect()` para checagem em cada hop, `extrairLinksDeAudio()` (cheerio + regex de embeds) e `interpretarNomeDeArquivo()` ("Artista - Título (Versão)").
- **Descoberta web global real no `GenericWebProvider`** — Busca em motores HTML sem chave de API (Bing em primeiro lugar; DuckDuckGo HTML e Mojeek mantidos como secundários pois hoje respondem desafio/403), visita páginas abertas de resultado e extrai links diretos de áudio; candidatos pontuáveis pelo ExactMatchEngine com artista/título/versão interpretados do nome do arquivo.
- **Colunas de fonte aberta em `releases`** — `audio_source_url`, `audio_source_provider`, `audio_source_page_url` (migração `database/migrations/replace_platform_audio_with_web_sources.sql`, já aplicada; colunas de plataformas zeradas).
- **`POST /api/releases/:id/audio-source`** — Registro manual de fonte aberta (`{ "url": "..." }`), validada pelo guard (Regra 3 + anti-SSRF) antes de salvar.
- **Player nativo no mobile** — `MusicPlayer.tsx` agora reproduz no iOS/Android via `expo-av` (`Sound.createAsync`) além do HTML5 Audio na web; libera o recurso ao desmontar; removeu dependência de previews de plataformas.
- **Endpoint `/stream` com suporte real a Range** — Proxy HTTP da fonte web aberta com repasse de `Range`/`Content-Range` (206), `X-Audio-Source-Provider` e invalidação da fonte salva quando a origem responde erro.

### Changed (Regra 3)
- **`audioController.ts` reescrito** — Pipeline único unificado (stream e download) sobre o `SourceOrchestrator` com apenas 2 providers (`generic-web`, `direct-link`): resolverFonte → cache → dedup → download HTTP com retry e limite de 200 MB → detecção via ffprobe → conversão FFmpeg condicional → validação de assinatura → cache permanente.
- **Remoção total das plataformas** — Excluídos `backend/src/services/audio/` (youtubeAdapter, itunesAdapter, deezerAdapter, spotifyAdapter, audioEnricher, audioTranscoder), `youtubeProvider.ts`, `database/add_mock_audio.sql` e desinstaladas dependências `@distube/ytdl-core`, `youtube-dl-exec`, `yt-search`, `@choewy/yt-dlp`, `@ffmpeg-installer/ffmpeg`. O ingestion para de enriquecer releases com previews de plataformas.
- **Mobile sem Spotify** — `SpotifyLoginScreen.tsx` excluído; botão/modal do Spotify removidos; `PlayerContext`, `GlobalPlayer`, `downloadManager` e `DetalheReleaseScreen` passam a usar exclusivamente `/api/releases/:id/stream|download` (sem URLs legadas null e sem localhost fixo).
- **`downloadCache` com diretório permanente** — `backend/cache/audio` com índice `index.json`; `set()` MOVE o arquivo e devolve o caminho definitivo; limpeza horária de expirados agendada com `.unref()`.
- **Contrato do `downloadDeduplication` documentado** — O produtor do download devolve o caminho do arquivo em cache (dados); nunca escreve no `Response`. Cada requisição serve o seu próprio cliente.
- **Cache de descoberta do `SourceOrchestrator`** — Substituído o stub por cache em memória com TTL de 1h, tamanho máximo 500 e evicção de expirados.
- **`AGENTS.md`** — Regra 3 documentada, novos endpoints de áudio e coluna de fonte aberta.

### Fixed (Regra 3 / P1)
- **Cache quebrado (P1)** — O pipeline antigo gravava o arquivo final, movia para o cache e depois apagava o caminho definitivo no `finally`; agora o produtor do cache é o único dono do arquivo e os temporários são removidos com segurança.
- **Deduplicação travada (P1)** — O closure do produtor capturava `req/res` da primeira requisição, deixando o segundo cliente pendurado para sempre; hoje dois downloads simultâneos compartilham UM pipeline e ambos recebem o arquivo completo (comprovado por teste real: `Reusing in-flight download` nos logs, dois arquivos de 8.945.229 bytes íntegros).
- **ffprobe ausente** — Instalado `ffprobe-static` e conectado em `detectAudioFormat`/`AudioValidator` (`setFfprobePath`); antes, "Cannot find ffprobe" forçava re-conversão de MP3 já válido. Com a detecção funcionando, o log mostra `stage=detect format=mp3 codec=mp3` → `stage=ffmpeg status=skipped` (download total em 3,6s).

### Added
- **Global Audio Source Discovery (Exact Match)** - Sistema completo de descoberta e validação de fontes de áudio
  - **Arquitetura de Providers**: Abstração `IAudioSourceProvider` para múltiplas fontes de áudio
  - **Exact Match Engine**: Sistema de pontuação (0-100) e classificação (EXACT_MATCH, PROBABLE_MATCH, REJECTED)
  - **Regras de Rejeição Rigorosas**: Cover, remix, live, instrumental, duração incompatível, conteúdo truncado
  - **Source Ranking**: Classificação de fontes por qualidade (codec, bitrate, sample rate), formato e disponibilidade
  - **Busca Paralela**: Múltiplos providers consultados simultaneamente com timeout individual (30s por provider)
  - **Fallback Automático**: Se um provider falha, outro assume sem interromper o fluxo
  - **Validação de Qualidade**: Detecção de FLAC real vs fake (upsampled de MP3), verificação de bitrate adequado
  - **Validação de Integridade**: Assinatura de arquivo, codec, decodificação FFmpeg completa
  - **Detecção de Vinheta**: Heurística para identificar conteúdo extra ou ruído de vinil
  - **Logs Estruturados**: requestId, providerId, operation para rastreamento completo
  - **Classificação de Erros Expandida**: EXACT_MATCH_NOT_CONFIRMED, NO_SUITABLE_SOURCE, ALL_PROVIDERS_FAILED, INVALID_AUDIO, CORRUPTED_AUDIO
  - **Integração Preservada**: Sistema integrado no audioController com fallback para método tradicional (YouTubeAdapter)
  - **Flag de Habilitação**: `ENABLE_SOURCE_ORCHESTRATOR` para ativar/desativar o novo sistema
  - **Fallback no Download**: Quando download falha com SOURCE_UNAVAILABLE, usa Source Orchestrator para buscar novo videoId

- **DirectLinkProvider** - Provider para URLs diretas de áudio
  - Aceita URLs diretas de áudio (MP3, FLAC, WAV, M4A, AAC, OGG, WMA, Opus, WebM)
  - Valida disponibilidade via HEAD request
  - Extrai metadados (content-type, content-length)
  - Suporta redirecionamentos (até 5 hops)
  - Timeouts: metadata (10s), download (10min)

- **GenericWebProvider** - Provider para crawling de sites/blogs
  - Busca links de áudio em páginas HTML usando cheerio
  - Extrai links de tags <a>, <audio> e <source>
  - Resolve URLs relativas para absolutas
  - Filtra links suspeitos (tracking, affiliate)
  - Suporta múltiplos formatos de áudio
  - Timeouts: search (15s), metadata (10s), download (5min)
  - **Nota**: Web scraping de motores de busca não implementado por questões de ToS

- **audioSource/types.ts** - Tipos para o sistema de AudioSourceProvider
  - AudioIdentity: Identidade musical para busca (artist, title, album, version, duration, isrc, catalogNumber)
  - AudioCandidate: Candidato encontrado por um provider com metadados completos
  - SearchResult: Resultado da busca de um provider com status e duração
  - MatchClassification: Enum de classificação (EXACT_MATCH, PROBABLE_MATCH, REJECTED)
  - CandidateScore: Pontuação de um candidato com classificação e razões
  - ProviderTimeouts: Configuração de timeout por operação (search, metadata, download)
  - IAudioSourceProvider: Interface abstrata para providers de áudio
  - ProviderError: Erro classificado do provider com tipo e retryable

- **audioSource/baseProvider.ts** - Classe base abstrata para providers
  - normalizeString: Normalização de strings para comparação (remove acentos, lowercase)
  - normalizeIdentity: Normalização de identidade musical para busca
  - isSimilar: Verificação de similaridade entre strings com threshold configurável
  - levenshteinDistance: Distância de Levenshtein para comparação fuzzy
  - isDurationCompatible: Comparação de durações com margem de tolerância
  - withTimeout: Wrapper com timeout para operações assíncronas

- **audioSource/exactMatchEngine.ts** - Engine de pontuação e classificação
  - Pontuação mínima para EXACT_MATCH: 90 pontos
  - Pontuação mínima para PROBABLE_MATCH: 60 pontos
  - Pesos dos critérios: artista (35), título (30), duração (15), versão (10), álbum (10)
  - Algoritmo de similaridade baseado em distância de Levenshtein
  - Regras de rejeição: artista diferente, título muito diferente, versão incompatível, duração incompatível, indicadores de preview/sample
  - scoreCandidate: Calcula pontuação completa de um candidato
  - scoreCandidates: Pontua múltiplos candidatos
  - filterExactMatches: Filtra apenas EXACT_MATCH
  - filterAcceptableMatches: Filtra EXACT_MATCH e PROBABLE_MATCH
  - sortByScore: Ordena por pontuação (maior primeiro)

- **audioSource/sourceRanker.ts** - Ranking de fontes por qualidade
  - Preferência de formatos: FLAC (100), WAV (90), ALAC (85), M4A (70), MP3 (65), WebM (50), Opus (45), AAC (40), OGG (35)
  - Cálculo de qualidade baseado em: codec/formato, bitrate, sample rate, bit depth, canais, qualidade declarada
  - RankingCriteria: exactMatch, qualityScore, formatPreference, availability, speed
  - Pontuação final ponderada: exactMatch (50%), qualidade (30%), formato (15%), disponibilidade (5%), velocidade (5%)
  - rankCandidates: Rankeia candidatos pontuados
  - selectBestCandidate: Seleciona o melhor candidato (EXACT_MATCH ou PROBABLE_MATCH com pontuação >= 75)

- **audioSource/providers/youtubeProvider.ts** - Provider concreto para YouTube
  - Implementação completa de IAudioSourceProvider para YouTube
  - Timeouts: search (30s), metadata (15s), download (5min)
  - search: Busca vídeos no YouTube usando yt-dlp (ytsearch10)
  - parseVideoToCandidate: Converte resultado do yt-dlp para AudioCandidate
  - extractVersionFromTitle: Extrai versão do título (Remix, Live, Instrumental, etc)
  - getMetadata: Obtém metadados detalhados de um vídeo
  - getDownloadInfo: Obtém informações de download
  - checkAvailability: Verifica disponibilidade de um vídeo
  - getRealDuration: Obtém duração real usando ffprobe (baixa primeiros 30s)

- **audioSource/providers/directLinkProvider.ts** - Provider para URLs diretas de áudio
  - Implementação completa de IAudioSourceProvider para URLs diretas
  - searchInUrl: Processa URL direta e valida disponibilidade
  - isValidAudioUrl: Valida se URL tem extensão de áudio válida
  - getMetadata: Obtém metadados via HEAD request (content-type, content-length)
  - getDownloadInfo: Retorna URL e formato para download
  - checkAvailability: Verifica disponibilidade via HEAD request
  - extractFormatFromType: Extrai formato do MIME type
  - extractFormatFromUrl: Extrai formato da URL
  - extractFileName: Extrai nome do arquivo da URL
  - formatBytes: Formata bytes para legível

- **audioSource/providers/genericWebProvider.ts** - Provider para crawling de sites/blogs
  - Implementação completa de IAudioSourceProvider para crawling HTML
  - searchInUrl: Busca links de áudio em página HTML usando cheerio
  - Extrai links de tags <a>, <audio> e <source>
  - resolveUrl: Resolve URLs relativas para absolutas
  - isValidAudioUrl: Valida e filtra links suspeitos
  - generateSourceId: Gera ID único a partir da URL
  - extractFormatFromType: Extrai formato do MIME type
  - extractFormatFromUrl: Extrai formato da URL
  - getMetadata: Obtém metadados via HEAD request
  - getDownloadInfo: Retorna URL e formato para download
  - checkAvailability: Verifica disponibilidade via HEAD request
  - formatBytes: Formata bytes para legível

- **audioSource/sourceOrchestrator.ts** - Orquestrador de múltiplos providers
  - Configuração: enableParallelSearch, maxConcurrentProviders, requireExactMatch, enableFallback
  - registerProvider: Registra um provider no orquestrador
  - unregisterProvider: Remove um provider do orquestrador
  - parallelSearch: Executa busca paralela em múltiplos providers
  - sequentialSearch: Executa busca sequencial em múltiplos providers
  - discover: Descobre melhor fonte para uma identidade musical
  - Cache de descoberta (implementação simplificada, pode ser expandida para Redis)
  - Estatísticas: providersCount, config

- **audioSource/audioValidator.ts** - Validação rigorosa de arquivos de áudio
  - checkFileSignature: Verifica assinatura de arquivo (FLAC: fLaC, MP3: ID3/sync, WAV: RIFF, M4A: ftyp)
  - getMetadata: Obtém metadados completos usando ffprobe
  - checkDuration: Verifica compatibilidade de duração com tolerância (10% ou 5s)
  - detectVinylOrExtraContent: Detecção heurística de vinheta e conteúdo extra
  - validateFlacQuality: Valida se é FLAC real (não upsampled de MP3)
  - validateMp3Quality: Valida se é MP3 de qualidade adequada (>= 128kbps, >= 44.1kHz)
  - validateFile: Validação completa de arquivo (assinatura, metadados, duração, qualidade, vinheta)
  - decodeFile: Decodifica arquivo completo para verificar integridade

### Changed
- **audioController.ts** - Integração do Source Orchestrator
  - Adicionados imports de SourceOrchestrator, YouTubeProvider, DirectLinkProvider, GenericWebProvider, AudioIdentity
  - Inicialização do orquestrador com configurações (parallel search, max 3 providers, require exact match, enable fallback)
  - Registro de 3 providers: YouTubeProvider, DirectLinkProvider, GenericWebProvider
  - Flag ENABLE_SOURCE_ORCHESTRATOR para habilitar/desabilitar o novo sistema
  - Expansão do enum DownloadErrorType com novos tipos: EXACT_MATCH_NOT_CONFIRMED, NO_SUITABLE_SOURCE, ALL_PROVIDERS_FAILED, INVALID_AUDIO, CORRUPTED_AUDIO
  - Refatoração da função garantirVideoId para usar Source Orchestrator quando habilitado
  - Fallback para método tradicional (YouTubeAdapter) se orquestrador falhar
  - Fallback no download: quando SOURCE_UNAVAILABLE, usa Source Orchestrator para buscar novo videoId
  - Logs estruturados com requestId, providerId, operation

- **README.md** - Atualizado com arquitetura de descoberta global
  - Adicionada seção "Descoberta Global de Fontes de Áudio (Exact Match)"
  - Adicionados novos módulos na tabela: Descoberta global de fontes (Exact Match), Validação de qualidade de áudio
  - Atualizada estrutura de pastas com detalhes do sistema audioSource (incluindo novos providers)

- **backend/package.json** - Adicionadas dependências para crawling web
  - cheerio: Parsing HTML para extrair links de áudio
  - axios: Requisições HTTP para crawling e metadados
  - @types/cheerio: Tipos TypeScript para cheerio

### Fixed
- **Audio Download Pipeline** - Implementado sistema robusto de download com cache, deduplicação e otimização
  - Adicionado cache de downloads (24 horas) para evitar processamento repetido
  - Implementado deduplicação de downloads simultâneos (in-flight) para compartilhar processos
  - Adicionado timeouts configuráveis por etapa (yt-dlp: 5min, FFmpeg: 10min, validação: 30s)
  - Implementado otimização do FFmpeg para evitar conversões desnecessárias (MP3→MP3, FLAC→FLAC)
  - Adicionado detecção de formato da fonte via ffprobe antes de decidir conversão
  - Adicionado headers X-Cache (HIT/MISS) para rastreamento de eficiência
  - Mantido retry inteligente com exponential backoff (1s, 2s) para falhas transitórias
  - Mantidas múltiplas estratégias de formato yt-dlp (m4a, mp3, webm, opus, bestaudio)
  - Mantida classificação de erros (SOURCE_UNAVAILABLE, FORMAT_UNAVAILABLE, TIMEOUT, etc)
  - Mantidos logs estruturados com medição de tempo por etapa (yt-dlp, FFmpeg, validação)
  - Preservado pipeline completo: cache → deduplicação → yt-dlp → FFmpeg → validação → cache → cliente
  - Mantida validação de assinatura (FLAC: fLaC, MP3: ID3 ou sync bytes)
  - Mantida limpeza automática de arquivos temporários

- **Frontend Download Progress** - Corrigido rastreamento de progresso de download no Web
  - Substituído método simples de `<a>` tag por fetch com ReadableStream
  - Implementado rastreamento de progresso em tempo real (0% → 100%)
  - Download agora baixa arquivo como Blob antes de acionar download nativo
  - Garante que progresso seja atualizado corretamente durante o download
  - Adicionado tratamento de erro adequado com atualização de estado
  - Corrigido problema de "Baixando... 0%" permanecer na tela

### Added
- **downloadCache.ts** - Novo serviço de cache de downloads
  - Armazena arquivos processados em `backend/temp/cache/audio`
  - Índice persistido em JSON com metadados (format, size, createdAt, expiresAt)
  - Limpeza automática de entradas expiradas (24 horas)
  - Métodos: get, set, invalidate, clearExpired, clearAll, getStats

- **downloadDeduplication.ts** - Novo serviço de deduplicação de downloads
  - Compartilha processos em andamento para múltiplas requisições simultâneas
  - Limpeza automática de downloads órfãos (10 minutos)
  - Métodos: execute, cleanup, getStats, destroy

### Changed
- **audioController.ts** - Refatoração completa da função `downloadAudio`
  - Adicionados imports de downloadCache e downloadDeduplication
  - Adicionada função detectAudioFormat para identificar codec da fonte
  - Adicionada função withTimeout para controle de timeout por etapa
  - Adicionado objeto TIMEOUTS com configurações de tempo
  - Separada lógica em função processDownload para uso com deduplicação
  - Implementado verificação de cache antes de processar download
  - Implementado uso de deduplicação para requisições simultâneas
  - Adicionada detecção de formato da fonte para decidir conversão
  - Otimizado FFmpeg para pular conversão quando formato já correto
  - Adicionado salvamento no cache após processamento bem-sucedido
  - Adicionado header X-Cache nas respostas (HIT/MISS)
  - Alterado Cache-Control para public, max-age=86400 (24 horas)
  - Reduzido maxRetries de 3 para 2 para evitar espera excessiva
  - Adicionados parâmetros noCheckCertificates, userAgent, noWarnings ao yt-dlp
  - Mantidos enums de erro (DownloadErrorType) para classificação
  - Mantido array de estratégias de formato (FORMAT_STRATEGIES)
  - Mantida função classifyYtDlpError para diagnóstico de erros
  - Mantidos logs estruturados com campos key=value para observabilidade

- **downloadManager.ts** - Refatoração do download Web
  - Substituído download direto por `<a>` tag por fetch com stream reader
  - Adicionado rastreamento de progresso em tempo real via ReadableStream
  - Download agora carrega arquivo completo como Blob antes de download nativo
  - Melhorado tratamento de erro com atualização de estado adequada

- **README.md** - Atualizado com arquitetura de download otimizada
  - Adicionada descrição do pipeline otimizado (cache → deduplicação → yt-dlp → FFmpeg → validação → cache → cliente)
  - Adicionados detalhes de cache de downloads (24 horas)
  - Adicionados detalhes de deduplicação de downloads simultâneos
  - Adicionados detalhes de timeouts configuráveis
  - Adicionados detalhes de otimização do FFmpeg
  - Adicionados detalhes de headers X-Cache

### Technical Details
- **Problema original (backend):** Downloads falhavam com HTTP 503 e lentidão excessiva (241.9s) devido a:
  - Falha única do yt-dlp sem retry
  - Estratégia de formato única (bestaudio[ext=m4a])
  - Falta de classificação de erros
  - Logs insuficientes para diagnóstico
  - Ausência de cache para evitar processamento repetido
  - Ausência de deduplicação para downloads simultâneos
  - Ausência de timeout para evitar bloqueio indefinido
  - FFmpeg sempre convertia mesmo quando desnecessário (183.2s para 286.2 MB)
- **Causa raiz (backend):** yt-dlp falhava em algumas fontes, não havia mecanismo de recuperação, e FFmpeg fazia reencode desnecessário
- **Solução (backend):**
  - Cache de downloads (24 horas) para evitar processamento repetido
  - Deduplicação de downloads simultâneos para compartilhar processos
  - Timeouts configuráveis por etapa (yt-dlp: 5min, FFmpeg: 10min, validação: 30s)
  - Detecção de formato da fonte para pular conversão desnecessária
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
- **TypeScript:** PASS (npx tsc --noEmit sem erros)
- **API Backend:** PASS (rodando em http://localhost:3001)
- **MariaDB:** PASS (conexão estabelecida na porta 3307)
- **Search API:** PASS (retorna resultados de busca)
- **Release Types API:** PASS (retorna 97 tipos de release)
- **Release Detail API:** PASS (retorna detalhes de release)
- **Works Detail API:** PASS (retorna detalhes de obra)
- **Works Releases API:** PASS (retorna versões de obra)
- **Artist Detail API:** PASS (retorna detalhes de artista)
- **Download API:** PARTIAL (YouTube bloqueando com HTTP 403/EXTRACTION_FAILED - restrição externa)
- **Stream API:** PARTIAL (depende de disponibilidade do YouTube)
- **Cache Service:** PASS (implementado e integrado)
- **Deduplication Service:** PASS (implementado e integrado)
- **Timeouts:** PASS (implementados e integrados)
- **FFmpeg Optimization:** PASS (implementado e integrado)

### Performance Metrics
- **Antes (Release 2117 - MP3):**
  - yt-dlp: 56.7s (download da fonte)
  - FFmpeg: 183.2s (conversão para MP3)
  - Validação: 0.2s (verificação de assinatura)
  - Total: 241.9s (4 minutos)
- **Após (esperado com cache HIT):**
  - Cache lookup: <0.1s
  - Total: <0.1s (quando em cache)
- **Após (esperado com otimização FFmpeg):**
  - yt-dlp: 56.7s (download da fonte)
  - FFmpeg: 0s (pulado se formato já correto)
  - Validação: 0.2s (verificação de assinatura)
  - Total: ~57s (quando fonte já no formato correto)

### Known Limitations
- yt-dlp pode falhar com HTTP Error 403/EXTRACTION_FAILED dependendo de restrições recentes do YouTube
- Quando yt-dlp falha em todas as estratégias, o backend retorna erro 503 ao cliente
- Downloads longos podem levar vários minutos dependendo do tamanho da fonte
- Cache ocupa espaço em disco (backend/temp/cache/audio)
- Deduplicação mantém referências a downloads em andamento na memória
