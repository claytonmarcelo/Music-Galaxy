# Análise Profunda — Music Galaxy

**Data:** 2026-10-22 · **Escopo:** backend, mobile, banco de dados e saúde do repositório · **Método:** análise estática somente-leitura + `tsc --noEmit` nas duas camadas + consultas de leitura ao MariaDB vivo (porta 3307) + amostragem manual de achados críticos.

**Verificações que rodaram de fato:**
- `backend`: `npx tsc --noEmit` → saída vazia, `EXIT_CODE=0` (0 erros) — verificado.
- `mobile`: `npx tsc --noEmit` → saída vazia, 0 erros — verificado.
- MariaDB: `mysql ... -u root -P 3307 -e "SELECT 1" musicgalaxy` → `ok 1`; tabelas presentes: artists, external_api_cache, ingestion_log, metadata_sources, release_types, releases, works; contagens: releases=2265, works=2618, artists=2618.
- Reamostragem manual desta auditoria: `App.tsx` (linhas 7–10 importam Favoritos/Historico/Theme/Modal — **sem** PlayerProvider) e `audioController.ts:509/762/797–804` (cache grava `arquivoFinal` e o `finally` faz `unlink` do mesmo arquivo).

---

## 1. Diagnóstico geral

O projeto compila limpo nas duas camadas e o schema está coerente com o AGENTS.md, mas há **três problemas estruturais** que hoje anulam funcionalidades inteiras:

1. **O subsistema de áudio novo (`audioSource/`) convive com o antigo (`audio/`) sem integração real** — o cache de downloads é estruturalmente inútil, a deduplicação pendura clientes concorrentes, e os dois providers recém-adicionados (DirectLink e GenericWeb) nunca produzem resultados no fluxo normal.
2. **O player do app é web-only e o PlayerContext "oficial" nunca é montado** — em iOS/Android não há reprodução.
3. **Ingestão e superfície da API fora das regras**: `POST /api/search/ingest` é público e sem autenticação, o mobile chama endpoints além do fluxo documentado, e o TTL de `external_api_cache` é ignorado na busca.

Somado a isso, o repositório carrega **camadas de código morto de projetos anteriores** (PHP/Laravel rastreado, Android Kotlin órfão, ~58 scripts de debug no backend) que contradizem o AGENTS.md e poluem o git.

---

## 2. Backend (`backend/src`)

### Crítico

| # | Achado | Evidência | Status |
|---|--------|-----------|--------|
| B1 | **`downloadCache` nunca dá acerto**: `set()` grava o caminho do arquivo final e o `finally` do mesmo fluxo faz `unlink` desse arquivo (linha 509 inclui `arquivoFinal` na lista de remoção). Toda leitura posterior aponta para arquivo apagado e invalida a entrada. | `audioController.ts:509, 762, 797-804`; `downloadCache.ts:90-98` | **Verificado (reamostrado)** |
| B2 | **Deduplicação corrompe o 2º cliente**: `execute()` reusa a promise do primeiro `processDownload(req, res)`, que já respondeu ao 1º `res`; a 2ª requisição recebe um objeto resolvido e seu próprio `res` nunca é respondido → hang/timeout. | `downloadDeduplication.ts:24-46` | Verificado |
| B3 | **`POST /api/search/ingest` sem autenticação** — o próprio comentário admite. Qualquer cliente dispara chamadas externas (MusicBrainz/Discogs) e escritas no banco; combinado com B8, abre caminho indireto de abuse. | `routes/index.ts:31-35` | Verificado |
| B4 | **DirectLinkProvider e GenericWebProvider estão inertes**: `search()` sempre retorna `FAILED`; só `searchInUrl()` produziria algo e nenhum método dele é alcançado por rota. Os commits 0fe8997/20f609e entregaram estrutura, não função. | `directLinkProvider.ts:30-40`, `genericWebProvider.ts:31-53`, `audioController.ts:43-45` | Verificado |
| B5 | **`streaming_url` no banco vira preview de 30 s**: o enriquecer grava o preview de 30 s nesse campo; o app prioriza `release.streaming_url`, então o usuário ouve 30 s em vez do `/stream` completo — conflito direto entre os dois subsistemas de áudio. | `audioEnricher.ts:99-103`; `PlayerContext.tsx:156` | Verificado |

### Alto

- **TTL ignorado na busca**: `MIN_RELEASES_LOCAL = 1` — com ≥1 release local nunca se reavalia o TTL do cache externo (desvio da regra do AGENTS.md). `searchController.ts:16,148`.
- **`videoId` suspenso no banco**: `audioController.ts:231-245` grava `candidate.sourceId` em `youtube_video_id` sem validar formato; se um provider entregar uma URL como `sourceId`, ela seria interpolada na chamada do yt-dlp (`:596-632`). Injeção de alvo de download (suspeita, não ativa hoje).
- **Cache do orquestrador é stub**: `sourceOrchestrator.ts:275-279` sempre retorna `null` — re-orquestração a cada requisição.
- **SSRF latente**: `directLinkProvider.ts:127` e `genericWebProvider.ts:83-97` aceitam URLs arbitrárias via `axios.head/get`; hoje não explorável (métodos órfãos), mas vira SSRF real no dia em que B4 for consertado sem whitelist.

### Médio

- **N+1 na ingestão**: ~6 queries por release (buscarIdFonte, INSERT+SELECT artista/work/tipo/release), serial. `searchOrchestrator.ts:165-247`.
- **`posIngestion` perde o `baseUrl`**: chamado sem 4º argumento (`searchController.ts:167`) → cai no default `http://localhost:3001` e dispositivos na LAN recebem URLs quebradas após ingestão.
- `/stream` e `/download` (operações de até 15 min) sem rate limit próprio; só o global de `index.ts:60-70`. `TIMEOUTS.TOTAL` definido e nunca aplicado (`audioController.ts:113`). Recursão sem limite em `processDownload` (`:632`) — suspeita de loop com fonte ruim.
- Discogs envia token por query string (`discogsAdapter.ts:59`) — exposição em logs de terceiros. LIKE `%%` sem escape de `%`/`_` e sem índice (`searchController.ts:28`).
- Caches de memória sem evicção (`audioEnricher.ts:27-28`); `downloadCache.clearExpired` nunca agendado.

### Conformidade AGENTS.md (backend)

Conforme: porta 3307 (`database.ts:13`), mysql2 sem ORM/Firebase/Supabase/GraphQL (package.json), Regra 1 (adapters só gravam capa oficial ou `null`; Cover Art Archive ainda não implementado), Regra 2 (sem GROUP BY; cada release é uma linha). **Não conforme**: B3 (ingest público consumido pelo app), desvio de TTL, e sobras PHP/Laravel **rastreadas no git** (`backend/app/Models/*.php`, `backend/config/*.php`, `composer.json`) + `backend/test_db.php` com credenciais hardcoded (`musicgalaxy/secret`, linha 3, não rastreado).

### Código morto (verificado via grep)

`audioSource/audioValidator.ts` (nunca importado) · `audio/audioTranscoder.ts` (importado e não usado) · duplicação YouTube: `YoutubeAdapter` (yt-search) vs `YouTubeProvider` (yt-dlp) · ~58 arquivos `<timestamp>-player-script.js` + MP3 de 6,4 MB na raiz do backend (artefatos de runtime).

---

## 3. Mobile (`mobile/`)

### Crítico

- **Player web-only + PlayerContext órfão**: `App.tsx:13-26` não monta `PlayerProvider`; `GlobalPlayer.tsx` não é importado por ninguém. O player realmente usado (`MusicPlayer.tsx`, via `ReleaseCard.tsx:147`) chama `document.createElement('audio')` (`MusicPlayer.tsx:55`) — **não funciona em iOS/Android**. Toda a camada de player nativo (expo-av) está escrita e desconectada.
- **SpotifyLoginScreen é fictício/inseguro**: OAuth client-side em WebView com injeção JS varrendo `access_token` na URL (`:34-36`), `CLIENT_ID='SEU_CLIENT_ID_AQUI'` (`:44`), redirect `http://localhost/callback` mock (`:45`) — e o token recebido é descartado (`MusicPlayer.tsx:348`).

### Alto

- **URLs hardcoded**: `api.ts:31-36` (`10.0.2.2:3001`, `192.168.0.153:3001`, `localhost:3001`) sem `.env`/`app.config`; `PlayerContext.tsx:156-158` repete `localhost:3001` inline.
- **Versões desalinhadas**: Expo SDK 57.0.10 com `react-native 0.74.5` + `react 18.2.0` (`package.json:21-22`) — RN 0.74 é da era do SDK 51; risco de incompatibilidade real em device.
- **Dois ThemeContexts**: `ThemeContext.tsx` (usado) vs `TemaContext.tsx` (órfão, só pelo também órfão `TemaToggle`), com chaves AsyncStorage distintas (`@musicgalaxy:theme` vs `Music_Galaxy_Tema`).
- **Regra 2 inatingível a partir da busca**: `BuscaScreen.tsx:267` navega só para `DetalheRelease`; nenhum caminho da busca chega a `DetalheWork` (só `TelaExplorar.tsx:138` e `DetalheArtistaScreen.tsx:113`). O usuário nunca vê "todas as versões da obra" no fluxo principal.

### Médio

- Endpoints fora da documentação AGENTS.md chamados pelo app: `TelaExplorar.tsx:79,107` (`/api/releases/by-date`, `/api/works/by-decade/:decada`, com `fetch` direto bypassando `api.ts`) e `TelaAdminIngestao` (POST ingest sem auth).
- `ModalContext.tsx:75,201-208` guarda timeout sem cleanup no unmount; `api.ts:82-89` não remove listeners do sinal externo; `DetalheWorkScreen.tsx:125-127` omite dependência no effect.
- Componentes escritos e nunca usados: `SkeletonLoader`, `BottomSheet`, `FiltrosAvancados`, `TemaToggle`, `LoadingScreen`, `GlobalPlayer`.

### Conforme

Regra 1 implementada no front (`ReleaseCard.tsx:61-78`, `DetalheReleaseScreen.tsx:179-181` com placeholder "Sem Capa"); sem dependências proibidas; todas as telas têm estados de loading/erro/vazio; `downloadManager.ts` (fila + AsyncStorage) e `playerAudio.ts` com unsubscribes corretos.

---

## 4. Banco de dados (`database/` + instância viva)

- **Schema `schema.sql` conforme o AGENTS.md**: FKs corretas, `cover_url NULL` = sem capa (`:106`), `quality NULL`, `version_name NOT NULL`, índice único anti-duplicação `uq_release_source_external` (`:130`).
- **Drift de scripts**: `create_tables.sql:40-66` e `create_releases.sql` definem `releases` **sem** as colunas de áudio presentes no schema.sql e no banco real; `youtube_video_id` só existe via `migrations/add_youtube_video_id.sql` — o schema "definitivo" não é fonte única da verdade.
- **`add_mock_audio.sql` viola a política de mídia no banco ativo**: injeta URL falsa SoundHelix em `audio_preview_url`, `streaming_url` e `download_url` de releases reais e arbitra `quality='320kbps'` (`:12-43`) — **15 linhas contaminadas hoje** (contagem verificada via SELECT). Não afeta `cover_url`, mas fere o princípio "nunca inventar mídia, apenas quando a fonte fornece".
- **Suspeita forte de ingestão de capas quebrada**: 2.265 releases, **100% com `cover_url NULL`** — o Cover Art Archive nunca gravou uma capa. E `works=artists=2618` exatos (1:1) sugere criação de artista novo por obra em vez de reuso.
- Índices só por nome/título/version_name; sem full-text (o próprio schema admite em `:314-315`) — coerente com o LIKE não indexado do backend (desempenho de busca degradece com o volume).

---

## 5. Saúde do repositório e tooling

- **Risco imediato de commit de lixo**: o `.gitignore` raiz (`:34`) cobre só `.env*.local` — MP3 de 6,4 MB, `COMMIT_MSG.txt`, `backend/test_db.php`, `php.ini.local`, `query`, `mobile/assets/adaptive-icon.png` estão prontos para entrar num `git add -A`. (`backend/.env` **não** está commitado — verificado com `git ls-files`.)
- **Tooling esquizofrênico na raiz**: `package.json:15,17` roda `composer install` e `php artisan serve` para o "backend" que é Node/ts-node-dev; `docker-compose.yml` sobe MariaDB 11.4 **na mesma porta 3307** do WAMP (regra "porta definitiva") + **Redis e Mailpit** (`:31-58`), fora da stack permitida; `build.gradle.kts` + `app/` (Kotlin/Hilt) são um Android nativo órfão parcialmente rastreado; `tsconfig.json` raiz é residual.
- **CHANGELOG em dia** (verificado contra `git log -6`): cobre DirectLink, GenericWeb, Global Audio Discovery e pipeline de download; único relatório novo (GLOBAL_AUDIO_DISCOVERY) ainda não commitado. Nada não enviado ao remote (HEAD = origin/main = `20f609e`); 3 arquivos modificados pendentes (`.env.example`, `.gitignore`, `package-lock.json`).
- Documentação: ~20 markdowns na raiz, todos rastreados — volume alto de relatórios de validação concorrentes (ANALISE_COMPLETA, ARQUITETURA_FINAL, CONCLUSAO_FINAL, VERIFICATION_*, TEST_SUITE_COMPLETE) sem um índice canônico atualizado.

---

## 6. O que os dois últimos commits realmente entregaram

`0fe8997` + `20f609e` (descoberta global de fontes de áudio) construíram a **estrutura** (orquestador, ranker, exact-match, 3 providers) mas o **fluxo funcional continua 100% dependente do YouTubeProvider**: os dois providers novos retornam `FAILED` em `search()` (B4), o cache do orquestrador é stub, e o `exactMatchEngine` só classifica candidatos de uma fonte efetivamente ativa. O nome do recurso ("descoberta global") não corresponde ao comportamento observável hoje — o que **está** funcionando é o streaming/download via YouTube.

---

## 7. Roteiro de correção por prioridade

**P1 — corrige funções quebradas (inconsistências que anulam os últimos commits):**
1. Ciclo `downloadCache.set` → `unlink` (B1): salvar cópia permanente ou gravar no cache apenas metadados com re-fetch; hoje o cache é custo puro.
2. Deduplicação responder ao 2º `res` (B2): encaminhar o stream por requisição, não reusar promise com `res` embutido.
3. Unificar os dois subsistemas de áudio: decidir dono do `streaming_url` (B5) e plugar DirectLink/GenericWeb de verdade em `search()` (B4) com whitelist anti-SSRF.
4. Montar `PlayerProvider` (ou excluí-lo) e dar ao `MusicPlayer` um caminho nativo com expo-av — hoje o app não toca áudio fora da web.

**P2 — segurança e regras:**
5. Autenticar/remover `POST /api/search/ingest` (B3) e tirar `TelaAdminIngestao` do fluxo do app ou isolá-la por flag.
6. Validar formato de `videoId` antes de persistir (11 chars, charset) (B-alto 2).
7. Aplicar TTL do `external_api_cache` na decisão de re-ingestão; passar `baseUrl` real no `posIngestion`.
8. Sanear o banco: DELETE dos 15 registros do `add_mock_audio.sql`; investigar por que nenhuma capa oficial foi gravada (Cover Art Archive nunca implementado).

**P3 — higiene:**
9. Expandir `.gitignore` raiz (`*.mp3`, `temp/`, `query`, `COMMIT_MSG.txt`, `php.ini*`, artefatos de debug) e expurgar PHP/Laravel/Kotlin/docker-compose rastreados que contradizem o AGENTS.md (com histórico documentado no CHANGELOG).
10. Alinhar Expo SDK 57 ↔ React Native (ou rebaixar a expectativa de SDK); consolidar um único ThemeContext; URLs de API via config; ligar BuscaScreen → DetalheWork para cumprir a Regra 2 no fluxo principal.

---

*Nada foi modificado nesta análise — somente leitura. Cada achado distingue **verificado** (evidência lida/executada) de **suspeita** (raciocínio sobre código sem reprodução).*
