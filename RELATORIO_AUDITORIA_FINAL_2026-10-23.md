# Relatório de Auditoria Final — Music Galaxy

**Data:** 2026-10-23
**Branch:** `main` · **Remoto:** `https://github.com/claytonmarcelo/Music-Galaxy.git`
**Escopo:** conformidade com o pedido, funcionamento global, ausência de regressões, reconhecimento sonoro, artefato Android de produção, segurança/privacidade, compatibilidade e tratamento de falhas.

> Método: todo número deste relatório saiu de um comando executado nesta sessão. O que não pôde ser checado está marcado **NÃO VERIFICADO** — nenhuma evidência foi substituída por suposição.

---

## 1. Matriz de conformidade

| # | Requisito | Situação | Evidência |
|---|---|---|---|
| 1 | Reconhecimento sonoro implementado de ponta a ponta | **CONFORME** | `backend/src/services/recognition/` (4 arquivos) + `POST /api/recognize` + `mobile/src/hooks/useReconhecimentoSonoro.ts` + `mobile/src/components/PainelReconhecimento.tsx` |
| 2 | Backend valida a amostra antes de chamar o provedor | **CONFORME** | `validarAmostra()` (1 KB–2 MB, 2–30 s, 7 formatos) · 55/55 testes unitários |
| 3 | Nada de metadado inventado | **CONFORME** | `normalizarRespostaAudD` não cria título/artista/álbum; sem título → `no_match` (teste unitário dedicado) |
| 4 | Credencial só no servidor | **CONFORME** | `AUDD_TOKEN` lido de `process.env`; `git grep` em HEAD sem nenhum valor real; `backend/.env` ignorado |
| 5 | Aplicativo não expõe a credencial nem o áudio | **CONFORME** | chave ausente de `mobile/`; gravação apagada no `finally` de `enviarAmostra` |
| 6 | Regra 3 preservada (só fontes abertas) | **CONFORME** | reconhecimento **não** devolve áudio; a busca normal continua filtrada por `audio_source_url` |
| 7 | Regra 5 preservada (zero erro de TypeScript) | **CONFORME** | `npx tsc --noEmit` → exit 0 no backend e no mobile, inclusive em clone limpo |
| 8 | Sem regressão de busca/stream | **CONFORME** | `/api/search?q=daft punk` → 48 versões · `/api/releases/77/stream` → **206 Partial Content** |
| 9 | Android 2025+ | **CONFORME (compilação + APK gerado)** / **NÃO VERIFICADO (aparelho)** | `compileSdk 36` / `targetSdk 36` / `minSdk 24` / `buildTools 36.0.0` impressos pelo Gradle · APK de release gerado (85.608.305 bytes) com `targetSdkVersion:'36'` lido do próprio pacote |
| 10 | Permissão de microfone declarada no Android | **CONFORME** | `RECORD_AUDIO` presente no manifesto gerado por `expo prebuild` |
| 11 | Mensagens em português brasileiro | **CONFORME** | painel, rota e manual em pt-BR (capturas e respostas reais abaixo) |
| 12 | Recuperação sem reinstalar | **CONFORME** | "Tentar novamente" reexecuta a tentativa sem recarregar o aplicativo (verificado no navegador) |
| 13 | Sem segredo, PII ou gravação de áudio no repositório | **CONFORME** | varredura do HEAD sem achados; nenhum `.wav`/`.mp3` versionado |
| 14 | Compatibilidade universal com versões futuras | **NÃO APLICÁVEL / NÃO PROMETIDO** | o relatório não afirma compatibilidade com Android não testado |
| 15 | Busca de atualização pela internet | **CONFORME** | `GET /api/app/versao` + checagem automática ao abrir + "Procurar atualizações" em Ajustes → Sobre · modal "Nova versão disponível" verificado no navegador |

---

## 2. Verificações técnicas (saída real dos comandos)

**TypeScript — clone limpo do repositório** (`git archive HEAD` → `C:/Users/Public/mg-clone`, sem a árvore de trabalho):

```
backend:  npx tsc --noEmit  →  BACKEND_EXIT=0
mobile:   npx tsc --noEmit  →  MOBILE_EXIT=0
```

**Suítes no mesmo clone limpo:**

```
npm run test:unit → tests 55 · pass 55 · fail 0 · skipped 0
npm run test:api  → tests 20 · pass 20 · fail 0 · skipped 0
```

**Suítes na árvore de trabalho, depois da busca de atualização (feature nova):**

```
npm run test:unit → tests 55 · pass 55 · fail 0 · skipped 0
npm run test:api  → tests 24 · pass 24 · fail 0 · skipped 0   (4 novos de appVersion)
npx tsc --noEmit  → BACKEND_EXIT=0 · MOBILE_EXIT=0
```

**API no servidor em execução** (`http://127.0.0.1:3001`):

| Requisição | Resultado real |
|---|---|
| `GET /health` | `200` · `{"status":"ok","version":"1.0.0"}` |
| `GET /api/search?q=daft punk` | `success: true` · **48** versões com áudio · **142** aguardando fonte |
| `GET /api/releases/77/stream` (Range 0-2047) | `206 Partial Content` · `Content-Type: audio/mpeg` · `Content-Range: bytes 0-2047/126615437` |
| `POST /api/recognize` (WAV 3 s real, sem credencial) | `503` · `O reconhecimento sonoro não está configurado neste servidor.` |
| `POST /api/recognize` (base64 corrompido) | `400` · `A amostra de áudio enviada está corrompida ou em formato inválido.` |
| `POST /api/recognize` (campo ausente) | `400` · `Envie a amostra de áudio no campo "audio_base64".` |
| `GET /api/app/versao` | `200` · `{"versao":"1.0.0","url":"https://github.com/claytonmarcelo/Music-Galaxy/releases/latest","notas":null,"obrigatoria":false}` |

---

## 2-bis. Busca de atualização pela internet — o que foi exercitado de fato

O pedido previa "busca de atualização pela internet". A auditoria encontrou que **a funcionalidade não existia**: não havia `expo-updates`, nem `expo-constants`, nem uso de `Linking` em `mobile/src` — o manual só descrevia a instalação manual do APK. A lacuna foi implementada e verificada.

| Caminho | Verificação real | Resultado |
|---|---|---|
| Publicação no servidor | `GET /api/app/versao` na API em execução | `200` com o contrato `versao`/`url`/`notas`/`obrigatoria` |
| Checagem automática | requisições observadas no navegador ao abrir o app | `GET /api/app/versao` → `200` (2,5 s depois de abrir) |
| Busca manual | clique em "Procurar atualizações" (Ajustes → Sobre) | `GET /api/app/versao` → `200` + toast "Você já está usando a versão mais recente." |
| Versão nova | servidor de teste em `localhost:3002` publicando `1.1.0` | modal "Nova versão disponível" com o número da versão, as notas publicadas e os botões "Agora não" e "Baixar" |
| Botão "Baixar" | URL aberta interceptada no navegador | exatamente `https://github.com/claytonmarcelo/Music-Galaxy/releases/download/v1.1.0/Music-Galaxy-v1.1.0.apk` (o endereço publicado pelo servidor, sem alteração) |
| Endereço perigoso | `APP_URL_DOWNLOAD=javascript:alert(1)` e `= ftp://...` | descartados pelo servidor; resposta cai no endereço oficial de lançamentos |
| Versão malformada | `APP_VERSAO_PUBLICADA=versao-de-teste` | descartada; resposta cai em `1.0.0` |
| Console do navegador | 3 mensagens (informativas) | 0 erros · 0 avisos |
| Requisições repetidas | log de rede | 3 chamadas no total (automática + manual), **sem laço** |

**NÃO VERIFICADO:** a instalação do APK baixado pelo botão "Baixar" em aparelho Android físico não foi executada. O botão usa `Linking.openURL`, que no Android abre o navegador — comportamento padrão do sistema, sem teste em aparelho nesta sessão.

**Nenhuma dependência nova** foi adicionada ao aplicativo: a versão instalada é a constante `VERSAO_APLICATIVO` (`mobile/src/services/versao.ts`), e a comparação de versões é numérica (`1.10` > `1.9`; `1.2` = `1.2.0`), com versão não numérica descartada — o aplicativo nunca afirma estar desatualizado sem prova.

---

## 3. Reconhecimento sonoro — o que foi exercitado de fato

**Caminho de erro (permissão indisponível) — verificado ponta a ponta no Expo web:**

1. Botão de microfone dentro do campo de busca (`aria-label` = "Identificar a música que está tocando");
2. painel abre com **"Não foi possível identificar"** e a mensagem **"O microfone está bloqueado. Libere a permissão nas configurações do aparelho para identificar músicas."**;
3. botões **"Tentar novamente"** e **"Fechar"** presentes;
4. "Tentar novamente" reexecuta a tentativa — o painel continua funcional, **sem reinstalar** o aplicativo;
5. console do navegador: **3 mensagens informativas, 0 erros e 0 avisos**;
6. sem rolagem horizontal após a correção do fundo: `scrollWidth 460` = `clientWidth 460`.

**Caminho de acerto (faixa reconhecida) — NÃO VERIFICADO:** exige `AUDD_TOKEN` válido, que não existe no ambiente (`grep -c AUDD_TOKEN backend/.env` → `0`). A implementação do adaptador, do contrato e da normalização está coberta por testes unitários com respostas reais do formato do AudD, mas **nenhuma chamada ao serviço de produção foi feita** — não há como declarar esse caminho validado.

**Captura por microfone em aparelho Android físico — NÃO VERIFICADO:** não há aparelho Android físico disponível nesta sessão. O manifesto e a configuração do plugin foram conferidos no projeto nativo gerado.

---

## 4. Artefato Android de produção

**Ambiente de compilação usado** (fora do repositório, porque o Java não consegue gravar dentro da árvore do projeto e o caminho do perfil do Windows contém acento):

- Gradle **9.3.1**, JDK **21.0.8** (`C:/Program Files/Android/openjdk/jdk-21.0.8`);
- SDK do Android espelhado em `C:/Users/Public/mg-sdk` (plataformas 34/35/36, build-tools 34.0.0/35.0.0/36.0.0, NDK 27.1.12297006);
- `GRADLE_USER_HOME` movido para `C:/Users/Public/mg-gradle` — **motivo**: o `cmd.exe` executa os `.bat` do AGP com a página de código 850 e corrompe o caminho `C:\Users\Usuário\.gradle`, quebrando o build com `ClassNotFoundException` (`com.google.prefab.cli.AppKt` e `worker.org.gradle.process.internal.worker.GradleWorkerMain`). Com o caminho só-ASCII, os dois erros desapareceram.

**Níveis de API reais, impressos pelo Gradle nesta compilação:**

```
buildTools:  36.0.0
minSdk:      24
compileSdk:  36
targetSdk:   36
ndk:         27.1.12297006
kotlin:      2.1.20
ksp:         2.1.20-2.0.1
```

`targetSdk 36` corresponde ao **Android 16 (lançado em 2025)** — o aplicativo é compilado contra o alvo de 2025 em diante, como pedido. `minSdk 24` mantém a instalação em aparelhos mais antigos; **isso é escolha de alcance, não promessa de compatibilidade** — a auditoria não afirma que o aplicativo foi testado em nenhum aparelho físico.

**Permissões do manifesto gerado:** `RECORD_AUDIO`, `INTERNET`, `MODIFY_AUDIO_SETTINGS`, `VIBRATE`, `FOREGROUND_SERVICE`, `FOREGROUND_SERVICE_MEDIA_PLAYBACK`, `SYSTEM_ALERT_WINDOW`, `READ/WRITE_EXTERNAL_STORAGE`.

**Plugin `expo-audio` em `mobile/app.json`:** `recordAudioAndroid: true`, `enableBackgroundRecording: false` e texto da permissão em português — o microfone não grava em segundo plano.

**Artefato assinado:** o APK de release é assinado com o keystore de depuração (`debug.keystore`), como exige a instalação sem recusa em aparelho de teste. A assinatura de produção é do usuário, via EAS.

### 4-bis. APK de release realmente gerado

A compilação de release terminou com sucesso depois de corrigir o ambiente (Gradle home e temporários em caminho só-ASCII). Saída real do Gradle:

```
BUILD SUCCESSFUL in 38m 29s
489 actionable tasks: 306 executed, 183 up-to-date
```

Depois de sincronizar o código com a **busca de atualização**, a recompilação incremental também passou:

```
BUILD SUCCESSFUL in 2m 38s
489 actionable tasks: 30 executed, 459 up-to-date
```

**Arquivo gerado:**

```
C:/Users/Public/mgbuild/mobile/android/app/build/outputs/apk/release/app-release.apk
85.614.477 bytes  ·  1.542 entradas no pacote
```

**Metadados lidos do próprio APK** (`aapt dump badging`):

```
package: name='com.musicgalaxy.app' versionCode='1' versionName='1.0.0'
         platformBuildVersionName='16' compileSdkVersion='36'
sdkVersion:'24'
targetSdkVersion:'36'
application: label='Music Galaxy' icon='res/BW.xml'
launchable-activity: name='com.musicgalaxy.app.MainActivity'
densities: '120' '160' '240' '320' '480' '640' '65534' '65535'
supports-screens: 'small' 'normal' 'large' 'xlarge'
```

| Item | Valor real |
|---|---|
| ABIs empacotadas | `arm64-v8a`, `armeabi-v7a`, `x86`, `x86_64` |
| Ícone do aplicativo | adaptive icon (`res/BW.xml`) com `background` e `foreground` |
| Atividade inicial | `com.musicgalaxy.app.MainActivity` |
| Permissões no manifesto | `RECORD_AUDIO`, `INTERNET`, `MODIFY_AUDIO_SETTINGS`, `VIBRATE`, `FOREGROUND_SERVICE`, `FOREGROUND_SERVICE_MEDIA_PLAYBACK`, `SYSTEM_ALERT_WINDOW`, `READ/WRITE_EXTERNAL_STORAGE` (com `maxSdkVersion=32`), `ACCESS_NETWORK_STATE`, `WAKE_LOCK` |
| Assinatura | `CN=Android Debug` — SHA-256 `fac61745dc0903786fb9ede62a962b399f7348f0bb6f899b8332667591033b9c` |
| Motor de JavaScript | Hermes (`index.android.bundle` de 1.989.072 bytes dentro do pacote) |

**A feature nova está dentro do APK:** a busca de strings no bundle Hermes (que guarda os textos acentuados em UTF-16LE) encontrou "Procurar atualizações", "Nova versão disponível" e "Você já está usando a versão mais recente." — além dos identificadores `app/versao` e `versaoPublicada`.

`targetSdkVersion 36` = **Android 16 (2025)**, `sdkVersion 24` = Android 7.0 como piso de instalação. O APK cobre aparelhos de 2025 em diante **e** os mais antigos — alcance maior do que o pedido, sem promessa de compatibilidade com versões que não foram testadas.

**NÃO VERIFICADO:** o APK **não** foi instalado nem executado em aparelho Android físico nesta sessão (não há aparelho disponível), e o download da imagem por baixa de latência do archive.org não foi exercitado no aparelho. A assinatura é a de depuração — a de produção depende do login do usuário no EAS.

### 4-ter. APK recompilado com o código atual (23/10/2026, depois das correções)

O APK anterior era de antes das correções desta rodada. O código do commit `31286e2` foi sincronizado para a árvore de build (`C:/Users/Public/mgbuild/mobile`, fora do repositório porque o Java não grava dentro da árvore do projeto) e o Gradle recompilou o release:

```
BUILD SUCCESSFUL in 8m 47s
446 actionable tasks: 75 executed, 371 up-to-date
```

**Arquivo gerado:**

```
C:/Users/Public/mgbuild/mobile/android/app/build/outputs/apk/release/app-release.apk
84.709.935 bytes
```

São **904.542 bytes a menos** que o APK anterior (85.614.477), porque as cinco dependências que nunca eram importadas deixaram de entrar no pacote.

**Metadados lidos do próprio APK** (`aapt dump badging`):

```
package: name='com.musicgalaxy.app' versionCode='1' versionName='1.0.0'
         platformBuildVersionName='16' platformBuildVersionCode='36' compileSdkVersion='36'
sdkVersion:'24'
targetSdkVersion:'36'
```

**Assinatura conferida** (`apksigner verify --print-certs`):

```
Signer #1 certificate DN: CN=Android Debug, OU=Android, O=Unknown, L=Unknown, ST=Unknown, C=US
Signer #1 certificate SHA-256 digest: fac61745dc0903786fb9ede62a962b399f7348f0bb6f899b8332667591033b9c
```

**O código novo está dentro do pacote.** O bundle Hermes embutido (`assets/index.android.bundle`, 1.994.716 bytes) contém as marcas desta rodada:

| Marca no bundle | Origem |
|---|---|
| `absoluteFill` | a camada global que coloca o aviso no topo da tela |
| "Remover do histórico de reproduções?" | o botão novo da aba Histórico da Biblioteca |
| "Limpar a lista de Explorar?" | o modal de confirmação do botão "Limpar" do Explorar |
| "Procurar atualizações" / "Você já está usando a versão mais recente." | a busca de atualização pela internet |

**A build na nuvem do EAS foi tentada, e o bloqueio é real (não suposição):**

```
$ npx eas-cli@latest whoami
Not logged in

$ npx eas-cli@latest build --platform android --profile preview --non-interactive --no-wait
An Expo user account is required to proceed.
Either log in with eas login or set the EXPO_TOKEN environment variable if you're using EAS CLI on CI
    Error: build command failed.
```

O `eas.json` está pronto (APK nos três perfis: development, preview, production) e `mobile/app.json` só precisa do `extra.eas.projectId`, que o EAS cria no primeiro `eas build` depois do login. **O que falta é exclusivamente a conta do dono** — não há credencial no ambiente (`EXPO_TOKEN` não definido, `~/.expo/state.json` sem sessão) e não é possível criar conta verificada por e-mail de third party em nome do usuário.

**NÃO VERIFICADO:** o APK não foi instalado nem executado em aparelho Android físico — `adb devices` devolve lista vazia (nenhum aparelho conectado nesta máquina).

---

## 5. Ausência de regressões

| Caminho | Verificação | Resultado |
|---|---|---|
| Busca por texto | `GET /api/search?q=daft punk` | 48 versões com áudio (antes 20) · 142 pendentes |
| Reprodução | `GET /api/releases/77/stream` | 206 com `Content-Range` válido |
| Interface (web) | botão do microfone, painel, Ajustes | todos os controles presentes e funcionais |
| Deslocamento horizontal | `scrollWidth` × `clientWidth` | 460 × 460 — corrigido pelo recorte da camada de brilhos (`1123db1`) |
| Console | 3 mensagens | 0 erros · 0 avisos |
| Servidor configurável | "Testar conexão" | `GET http://localhost:3001/health` → **200** (3 requisições observadas) |
| Busca de atualização | "Procurar atualizações" + checagem automática | `GET /api/app/versao` → **200**; modal de nova versão e botão "Baixar" verificados |
| TypeScript | backend e mobile | exit 0 nos dois, também em clone limpo |
| Testes | unitários e de integração | 55/55 e 24/24 (20/20 no clone limpo + 4 novos de `appVersion`) |
| Aviso (toast) | medida do cartão no navegador | **antes**: topo 483 px em janela de 473 px (fora da tela) · **depois**: topo 10 px, esquerda 16 px, 428 × 64 px, dentro da tela |
| Modal de confirmação | "Limpar a lista de Explorar" | abre o modal com título, explicação e os botões "Manter a lista" / "Limpar a lista" |
| Décadas | `GET /api/works/by-decade/{d}` | 3 / 3 / 4 / 2 / 2 / 2 / 0 obras com áudio (2020s → 1960s); a de 1960 tem 62 obras no catálogo e nenhuma com fonte resolvida |
| Dependências do aplicativo | `npx expo-doctor` · `npx expo install --check` | "21/21 checks passed. No issues detected!" · "Dependencies are up to date" (5 pacotes não usados removidos) |

---

## 6. Segurança e privacidade

- **Segredos:** `git grep` no `HEAD` por valores de `api_token`, `AUDD_TOKEN`, `DISCOGS_TOKEN` e `MUSICBRAINZ_TOKEN` → **nenhum achado**. `backend/.env` está ignorado (`backend/.gitignore:14`); `backend/.env.example` é versionado e contém apenas marcadores (`seu_token_de_desenvolvedor_audd`).
- **Amostras de áudio:** nenhuma gravação versionada; a captura é temporária, apagada no `finally` de `enviarAmostra` e nunca gravada no banco.
- **Dados pessoais:** o histórico (favoritos, playlists, buscas, reproduções) vive no AsyncStorage do aparelho e não vai para o backend.
- **SSRF:** o guard `auditarUrl()` bloqueia IP privado/loopback/link-local/reservado, IPv6, DNS rebinding, redirects e domínios de plataformas; tem testes unitários próprios.
- **Força bruta:** `POST /api/recognize` tem limitador próprio (20 tentativas por 15 min, `RECOGNITION_RATE_LIMIT_*`), com teste de integração que confirma o 429.
- **Corpo da requisição:** limite de 3 MB aplicado **na rota** (`app.use('/api/recognize', express.json({ limit: '3mb' }))`), sem afrouxar o limite global de 10 kB das outras rotas.

---

## 7. Tratamento de falhas (recuperação sem reinstalar)

1. **Sem credencial no servidor** → 503 com mensagem explicativa; o aplicativo explica ao usuário e a busca por texto continua funcionando.
2. **Permissão de microfone negada** → painel com a orientação de liberar nas configurações do aparelho.
3. **Amostra inválida/corrompida/sem título** → 400 com mensagem específica; o painel oferece "Tentar novamente".
4. **Sem internet ou servidor fora do ar** → `network_error` com "Não foi possível conectar ao servidor. Verifique a internet e o endereço em Ajustes."; o endereço é ajustável em Ajustes → "Servidor da API", com "Testar conexão" e "Restaurar endereço padrão".
5. **Servidor demorou** → timeout de 45 s no aplicativo e "O servidor demorou demais para responder. Tente novamente."
6. **Excesso de tentativas** → 429 e "Muitas tentativas de reconhecimento. Aguarde alguns minutos antes de tentar de novo."
7. **Falha do provedor** → `provider_error` com "Não foi possível identificar a música agora." e o botão de nova tentativa.

---

## 8. Achados da auditoria — o que foi corrigido nesta rodada

Cada achado abaixo foi tratado **na íntegra**, sem meias-medidas e sem esconder o que ficou de fora. A coluna "Situação" reflete o estado real depois da correção.

| # | Achado | Situação | Como foi resolvido |
|---|---|---|---|
| 1 | Restos de Laravel no backend | **CORRIGIDO** | 13 arquivos versionados apagados (`backend/app/Models/*`, `backend/config/*`, `backend/composer.json`) e as 5 pastas vazias (`app`, `bootstrap`, `database`, `routes`, `storage`) removidas. `backend/.gitignore` ficou só com o padrão dos scripts temporários do player. Recuperação: `git show 24635e8:backend/app/Models/Album.php` |
| 2 | Pasta de teste vazia | **CORRIGIDO** | `backend/tests/Feature/` removida (não havia arquivo dentro) |
| 3 | `as any[]` para burlar o tipo da consulta | **CORRIGIDO** | `backend/src/services/cache/externalApiCache.ts` tipa o resultado com `ResultSetHeader` (`mysql2`), sem `any` |
| 4 | `eslint-disable` | **CORRIGIDO** | `OfflineBanner` e `ToastNotificacao` passaram a usar `useCallback` + ref no lugar do silenciamento |
| 5 | Função exposta sem consumidor (`removerReproducao`) | **CORRIGIDO** | Botão de lixeira por item na aba Histórico da Biblioteca, com confirmação e aviso de que arquivo baixado, favorito e playlist continuam intactos |
| 6 | Dependências declaradas e nunca importadas | **CORRIGIDO** | `expo-auth-session`, `expo-blur`, `expo-crypto`, `expo-linear-gradient` e `react-native-webview` removidos (`npm install` → "removed 7 packages"). `npx expo-doctor` → "21/21 checks passed. No issues detected!"; `npx expo install --check` → "Dependencies are up to date" |
| 7 | Arquivos de rascunho do dono | **INTOCADOS (por decisão do dono)** | `COMMIT_MSG.txt`, `backend/test_db.php`, `php.ini.local`, `query` e `vibe_images/` continuam fora do versionamento e não foram alterados |
| 8 | **Achado novo desta rodada:** o aviso (toast) era desenhado fora da tela | **CORRIGIDO** | `ModalGlobalContainer` usava `flex: 0` (altura zero, colada no rodapé da coluna); como o aviso é absoluto (`top: insets.top + 10`), ele era renderizado **483 px abaixo do topo de uma janela de 473 px** — invisível. A camada passou a usar `StyleSheet.absoluteFill` e o aviso agora é medido em **topo 10 px, esquerda 16 px, 428 × 64 px, inteiramente dentro da tela** (verificado no navegador, com captura) |
| 9 | Duplicações de utilitários e de cartão | **CORRIGIDO** | `CardObra` passou a ser usado no Explorar e na tela do artista; `utils/formatadores.ts` e `utils/helpers.ts` (órfãos) substituíram as cópias locais em `PlayerControls`, `DownloadProgress` e `TelaBiblioteca` |
| 10 | Toast sem duração real e temporizador sem limpeza | **CORRIGIDO** | A duração vai no estado do `ModalContext` e chega ao `ToastNotificacao`; o temporizador vive em ref e é limpo no desmonte do componente |
| 11 | **Achado novo desta rodada:** o `.gitignore` do backend escondia uma pasta de código | **CORRIGIDO** | O padrão `cache/` (sem barra) alcançava qualquer pasta chamada `cache` em qualquer nível, inclusive `backend/src/services/cache/`, que guarda o código do cache externo — um arquivo novo criado ali seria ignorado em silêncio. Os padrões foram ancorados (`/cache/` e `/temp/`), que é onde ficam de fato `backend/cache/audio` e `backend/temp/audio`. Confirmado com `git check-ignore`: `backend/src/services/cache/novoArquivo.ts` não é mais ignorado; `backend/cache/audio/...` continua ignorado |

### 8-bis. Dois achados que estavam **antigos** (corrigidos antes desta auditoria)

A auditoria tinha listado como defeito duas coisas que **já estavam resolvidas no código**. Isso foi confirmado com execução real, e o relatório anterior está sendo corrigido para não repetir uma acusação infundada:

| Achado listado | Verificação real | Conclusão |
|---|---|---|
| "A lista de décadas do Explorar aparece vazia" | `GET /api/works/by-decade/{d}` devolve **3 (2020s), 3 (2010s), 4 (2000s), 2 (1990s), 2 (1980s), 2 (1970s), 0 (1960s)** obras; no banco há 310 / 470 / 507 / 343 / 226 / 133 / 62 / 7 obras nas décadas de 2020 a 1950 | O achado era **antigo**: `ANO_EFETIVO_SQL` (`backend/src/utils/urls.ts`) já usa `COALESCE` com o menor ano de lançamento das versões, então obras sem `original_release_year` entram na contagem. A década de 1960 devolve zero porque **nenhuma obra dela tem fonte de áudio resolvida** — é a Regra 7 filtrando, não defeito |
| "`DetalheArtistaScreen` não tem entrada de navegação" | O detalhe da versão mostra o botão **"Ver artista"** (`DetalheReleaseScreen.tsx:393`) e a API devolve `artist_id`; no navegador a tela abre (Daft Punk, "2 obras": "Daft Club 2003" e "One More Time 2000") | O achado era **antigo**: a entrada existe e funciona |

---

## 9. O que continua pendente (ação humana ou externa)

| Pendência | Quem resolve | Estado |
|---|---|---|
| Login na conta EAS e `eas build` (APK assinado de produção) | o usuário | **Bloqueado pela credencial, com evidência real:** `npx eas-cli@latest whoami` → "Not logged in"; `npx eas-cli@latest build --platform android --profile preview --non-interactive --no-wait` → "An Expo user account is required to proceed." O `eas.json` já gera APK nos três perfis; depois do login, `npx eas build --platform android --profile preview` resolve o `extra.eas.projectId` sozinho |
| APK de release para instalar e testar em aparelho | o usuário | **Pronto:** `C:/Users/Public/mgbuild/mobile/android/app/build/outputs/apk/release/app-release.apk` (84.709.935 bytes, `targetSdk 36`, assinado com o keystore de depuração — instala sem recusa) |
| Credencial do AudD para o caminho de acerto | o usuário | `AUDD_TOKEN` no `backend/.env` |
| Teste com microfone em aparelho Android físico | o usuário | aparelho Android 2025+ (`adb devices` não encontrou aparelho nesta máquina) |
| Publicar a primeira versão no servidor | o usuário | `APP_VERSAO_PUBLICADA` e `APP_URL_DOWNLOAD` no `backend/.env` — sem isso o aplicativo continua funcionando e apenas não avisa de versão nova |
| Push para o repositório público | o usuário | **nenhum push foi feito nesta sessão** |

---

## 10. Veredito

**APROVADO COM RESSALVAS.**

O que está **comprovado**: o backend e o aplicativo compilam sem erro de TypeScript (inclusive em clone limpo do repositório), as 79 verificações automatizadas passam (55 unitárias + 24 de integração contra o MariaDB real), a API real responde como documentado, o reconhecimento sonoro está implementado ponta a ponta com credencial isolada no servidor e mensagens em pt-BR, a busca de atualização pela internet funciona nos dois gatilhos (automático e manual) com aviso honesto e sem laço de requisições, a busca e a reprodução seguem funcionando, o artefato Android compila com `targetSdk 36` e a permissão de microfone declarada no manifesto.

Nesta rodada os **achados de código** da auditoria foram corrigidos na íntegra (restos de Laravel, `as any[]`, `eslint-disable`, função sem consumidor, dependências não importadas, duplicações, pasta vazia e a duração do toast). Dois **achados novos** apareceram no caminho e também foram resolvidos: o aviso (toast) era desenhado fora da tela — a camada global tinha altura zero, então o aviso renderizava 483 px abaixo do topo de uma janela de 473 px — e o padrão `cache/` do `.gitignore` do backend alcançava `backend/src/services/cache/`, que é código-fonte, e esconderia de qualquer arquivo novo criado ali. Os dois estão documentados em `AGENTS.md`. Dois achados anteriores ("décadas vazias" e "tela do artista sem entrada") foram refutados com execução real e medição no banco: estavam **antigos**, não são defeitos do código atual.

As **ressalvas** (impedem aprovação integral, conforme exigido): o caminho de acerto do reconhecimento não foi exercitado contra o serviço real por falta de credencial; a captura por microfone, a instalação do APK e a instalação do APK indicado pelo botão "Baixar" não foram executadas em aparelho Android físico (`adb devices` não encontrou aparelho); e o APK de produção assinado depende do login do usuário no EAS — bloqueio comprovado pela própria CLI ("An Expo user account is required to proceed."). Nenhuma dessas ressalvas foi escondida por suposição — cada uma está marcada como **NÃO VERIFICADO** acima, com o motivo exato.

**O artefato entregável está em dia com o código:** o APK de release foi recompilado a partir do commit `31286e2` (`BUILD SUCCESSFUL in 8m 47s`, 84.709.935 bytes, `targetSdk 36`, assinatura conferida com `apksigner`) e o bundle Hermes dentro do pacote contém as marcas desta rodada (`absoluteFill`, "Remover do histórico de reproduções?", "Limpar a lista de Explorar?", "Procurar atualizações"). O que falta para fechar a entrega é a ação do dono: entrar na conta Expo, rodar o `eas build` para assinar com a chave de produção e instalar o APK em um aparelho.
