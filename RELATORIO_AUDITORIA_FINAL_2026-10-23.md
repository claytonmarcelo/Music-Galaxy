# Relatório de Auditoria Final — Music Galaxy

**Data:** 2026-10-23
**Branch:** `main` · **Remoto:** `https://github.com/claytonmarcelo/Music-Galaxy.git`
**Estado do código auditado:** commit `5e4d764` (23/10/2026, 09:34) · 20 commits à frente de `origin/main` · **nenhum push nesta sessão**
**Escopo:** conformidade com o pedido, funcionamento global, ausência de regressões, reconhecimento sonoro, artefato Android de produção, segurança/privacidade, compatibilidade, tratamento de falhas, configuração, estado do Git e observabilidade.

> Método: todo número deste relatório saiu de um comando executado nesta sessão. O que não pôde ser checado está marcado **NÃO VERIFICADO** — nenhuma evidência foi substituída por suposição.

---

## 1. Matriz de conformidade

| # | Requisito | Situação | Evidência |
|---|---|---|---|
| 1 | Reconhecimento sonoro implementado de ponta a ponta | **CONFORME** | `backend/src/services/recognition/` (4 arquivos) + `POST /api/recognize` + `mobile/src/hooks/useReconhecimentoSonoro.ts` + `mobile/src/components/PainelReconhecimento.tsx` |
| 2 | Backend valida a amostra antes de chamar o provedor | **CONFORME** | `validarAmostra()` + `duracaoAmostra.ts` (1 KB–2 MB, 2–30 s exatos, 7 formatos; leitura real de WAV/FLAC/M4A e aproximada de MP3) · **61/61** testes unitários |
| 3 | Nada de metadado inventado | **CONFORME** | `normalizarRespostaAudD` não cria título/artista/álbum; sem título → `no_match` (teste unitário dedicado) |
| 4 | Credencial só no servidor | **CONFORME** | `AUDD_TOKEN` lido de `process.env`; varredura do histórico sem valor real (só marcadores `seu_*`); `backend/.env` ignorado |
| 5 | Aplicativo não expõe a credencial nem o áudio | **CONFORME** | chave ausente de `mobile/`; gravação apagada no `finally` de `enviarAmostra` |
| 6 | Regra 3 preservada (só fontes abertas) | **CONFORME** | reconhecimento **não** devolve áudio; a busca normal continua filtrada por `audio_source_url` |
| 7 | Regra 5 preservada (zero erro de TypeScript) | **CONFORME** | `npx tsc --noEmit` → exit 0 no backend e no mobile (re-executado depois do commit `5e4d764`), inclusive em clone limpo |
| 8 | Sem regressão de busca/stream | **CONFORME** | `/api/search?q=daft punk` → **50 exibidas** (total 51) · 139 pendentes · stream da versão 40 → **206** com `Content-Range: bytes 0-1023/12817079` |
| 9 | Android 2025+ | **CONFORME (compilação)** / **NÃO VERIFICADO (aparelho)** | `minSdk 36` / `compileSdk 36` / `targetSdk 36` · APK de release de 101.765.239 bytes com `sdkVersion:'36'` — porém **anterior** aos commits `d90d746` e `5e4d764`; precisa ser recompilado |
| 9-bis | Somente Android de 2025 em diante (nada anterior) | **CONFORME** | `minSdkVersion 36` = Android 16 (primeira versão de 2025) · o próprio Android recusa a instalação abaixo disso |
| 9-ter | Aviso quando o Android questiona o APK | **CONFORME** | `mobile/src/services/compatibilidade.ts` + `TelaCompatibilidade` (nome exato da versão do aparelho, três passos, botão de busca de versão nova) · `App.tsx` faz a verificação antes das boas-vindas |
| 9-quater | `versionCode` que não trava a atualização | **CONFORME** | `android.versionCode: 1` explícito em `mobile/app.json` · explicado no manual |
| 9-quinquies | Rodapé coerente com o projeto | **CONFORME** | cápsula de vidro com bolha deslizante · verificado no navegador nas cinco abas · área segura medida (14 px livres até a borda) |
| 9-sexies | Botão claro/escuro com desenho atual | **CONFORME** | `BotaoTema` 44 × 44 px com disco interno e cruzamento sol/lua · `SeletorTema` em três cartões de vidro · verificado nos dois temas |
| 9-septies | Boas-vindas de 3 segundos com o personagem | **CONFORME** | `DURACAO_MS = 3000` · medido no navegador: 3,26 s na tela (aparece em 1.985 ms, sai em 5.241 ms) |
| 9-octies | Manual para quem tem dificuldade com o celular | **CONFORME** | `TelaManual` com catorze assuntos em pt-BR simples · "Instalar o aplicativo no Android" e "Quando a instalação é recusada" verificados no navegador |
| 10 | Permissão de microfone declarada no Android | **CONFORME** | `RECORD_AUDIO` presente no manifesto gerado por `expo prebuild` |
| 11 | Mensagens em português brasileiro | **CONFORME** | painel, rota e manual em pt-BR (capturas e respostas reais abaixo) |
| 12 | Recuperação sem reinstalar | **CONFORME** | "Tentar novamente" reexecuta a tentativa sem recarregar o aplicativo (verificado no navegador) |
| 13 | Sem segredo, PII ou gravação de áudio no repositório | **CONFORME** | varredura do HEAD sem achados; nenhum `.wav`/`.mp3` versionado |
| 14 | Compatibilidade universal com versões futuras | **NÃO APLICÁVEL / NÃO PROMETIDO** | o relatório não afirma compatibilidade com Android não testado |
| 15 | Busca de atualização pela internet | **CONFORME** | `GET /api/app/versao` + checagem automática ao abrir + "Procurar atualizações" em Ajustes → Sobre · modal "Nova versão disponível" verificado no navegador |
| 16 | O destino da amostra é informado ao usuário (spec. §9) | **CONFORME** | cartão de aviso no painel durante a captura + texto novo de `microphonePermission` em `mobile/app.json` (vale no próximo APK) · verificado no navegador |
| 17 | Cada falha tem situação própria (spec. §6.1 e §12) | **CONFORME** | `permission_denied`, `microphone_unavailable`, `network_error` e `cancelled` com títulos próprios no painel · verificado no navegador |
| 18 | Faixa identificada fora do catálogo é comunicada (spec. §7) | **CONFORME** | estado "Essa faixa ainda não está no catálogo" + sugestão de buscar pelo artista · verificado no navegador |
| 19 | Auditoria do subsistema classificada (spec. §2.2) | **CONFORME** | seção 3-bis deste relatório (17 critérios de aceitação + funcionalidades + tabela de erros) |
| 20 | Tecnologia escolhida por comparação (spec. §4) | **PARCIAL** | matriz AudD × ShazamKit × ACRCloud registrada (3-quater) e decisão de manter o AudD justificada · **prova de conceito lado a lado NÃO VERIFICADA** |
| 21 | Suíte de testes no aplicativo | **CONFORME** | `mobile/tests/reconhecimento.test.ts` → **13/13** com `node --test`, sem dependência nova · `npm run test:all` → **99/99** |
| 22 | Contradição `README.md` × `AGENTS.md` | **CONFORME (não existe mais)** | varredura real: nenhum vestígio de `yt-dlp`/YouTube no código; os dois documentos concordam (3-ter) |
| 23 | Cancelamento honesto (não confundir desistência com servidor mudo) | **CONFORME** | `descreverInterrupcao()` separa `cancelled` de `network_error` · 2 testes dedicados · verificado no navegador ("Identificação cancelada") |
| 24 | Uma tentativa por vez | **CONFORME** | `emAndamento` + token de geração: tocar no microfone durante uma tentativa **cancela a anterior** e não abre uma segunda captura (verificado no navegador) |
| 25 | Nenhum estado preso depois de cancelar ou sair | **CONFORME** | `cancelar()` libera contagem, gravação, requisição e arquivo; `AppState` e desmonte encerram; "Cancelar" durante "Ouvindo…" devolve o painel a erro com "Tentar novamente" |
| 26 | Falha do provedor com título próprio | **CONFORME** | `provider_error` → **"Serviço de reconhecimento indisponível"** (antes caía no genérico "Não foi possível identificar") |

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

**Suítes na árvore de trabalho, reexecutadas depois do commit `5e4d764` (23/10/2026, execução mais recente):**

```
npm run test:all
  backend unitárias  → tests 61 · pass 61 · fail 0 · skipped 0  (0,95 s)
  backend integração → tests 25 · pass 25 · fail 0 · skipped 0  (1,69 s)
  aplicativo         → tests 13 · pass 13 · fail 0 · skipped 0  (0,17 s)
  total              → 99 verificações, 0 falhas, 0 ignoradas

backend: npx tsc --noEmit                → BACKEND_EXIT=0
mobile:  npx tsc --noEmit                → MOBILE_EXIT=0
mobile:  npx tsc -p tests/tsconfig.json  → MOBILE_TESTS_EXIT=0
```

**API no servidor em execução** (`http://127.0.0.1:3001`):

| Requisição | Resultado real |
|---|---|
| `GET /health` | `200` · `{"status":"ok","version":"1.0.0"}` |
| `GET /api/search?q=daft punk` | `success: true` · `{"total":51,"resultados":50,"pendentes":139,"fonte":"consulta"}` |
| `GET /api/releases/40/stream` (Range 0-1023) | `206 Partial Content` · `Content-Type: audio/mpeg` · `Content-Range: bytes 0-1023/12817079` |
| `POST /api/recognize` (WAV real de 3 s, sem credencial) | `503` · `O reconhecimento sonoro não está configurado neste servidor.` |
| `POST /api/recognize` (WAV de 44 bytes) | `400` · `A amostra de áudio é curta demais para ser analisada.` |
| `POST /api/recognize` (base64 corrompido) | `400` · `A amostra de áudio enviada está corrompida ou em formato inválido.` |
| `POST /api/recognize` (campo ausente) | `400` · `Envie a amostra de áudio no campo "audio_base64".` |
| `POST /api/recognize` (corpo de 3,1 MB) | `413` · mensagem em português (limite de 3 MB da rota) |
| `POST /api/recognize` (JSON malformado) | `400` · mensagem em português (não vaza a pilha do Node) |
| `GET /api/app/versao` | `200` · `{"versao":"1.0.0","url":"https://github.com/claytonmarcelo/Music-Galaxy/releases/latest","notas":null,"obrigatoria":false}` |

> A contagem da busca varia enquanto a fila de resolução de áudio avança (na primeira medição desta auditoria eram 48 versões com áudio e 142 pendentes; na última, 50 e 139). O que importa é a regra: só entra na resposta o que tem `audio_source_url`.

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

### 3.1. Correções desta rodada exercitadas no navegador (commit `5e4d764`)

O fluxo foi reexecutado no Expo web com uma captura sintética de 440 Hz, criada de novo a cada tentativa (uma `MediaStream` reaproveitada expira e gera `NotSupportedError`, o que produziria um falso "Microfone indisponível"):

| Cenário | Resultado real |
|---|---|
| Fechar o painel ocioso | fecha, limpa o resultado e **não** dispara cancelamento |
| Cancelar durante **"Ouvindo…"** | painel volta com **"Identificação cancelada"**, detalhe "A identificação foi interrompida. O microfone já foi liberado." e os botões "Tentar novamente" / "Fechar" |
| Tocar no microfone **durante** uma tentativa | a tentativa anterior é cancelada; **nenhuma segunda captura começa** (trava `emAndamento`) |
| Falha do gravador (`MediaRecorder NotSupportedError`) | painel **"Microfone indisponível"** com "Tentar novamente" |
| Falha do provedor | painel **"Serviço de reconhecimento indisponível"** (título novo; antes caía no genérico) |
| Captura concluída | **um único** `POST /api/recognize` → `503` sem credencial |
| Cancelar **durante a gravação** | **nenhuma requisição** é enviada |
| Cancelar **durante o envio** | a requisição em curso é abortada e nenhum resultado é aplicado |

**NÃO TESTADO nesta sessão:** o cenário visual de `network_error` (servidor fora do ar) não pôde ser reexecutado porque a automação do navegador (MCP `browser-use`) ficou indisponível no meio da rodada. O caminho continua coberto pelo contrato puro — o teste "tempo esgotado vira network_error, nunca cancelled" passa — e pela inspeção de `reconhecimento.ts`; a tela "Sem conexão com o servidor" havia sido verificada em rodada anterior desta auditoria.

---

## 3-bis. Classificação do subsistema de reconhecimento contra a especificação

A especificação "Music Galaxy — Especificação Técnica de Reconhecimento Musical por Áudio" exige (seção 2.2) que **cada recurso relevante seja classificado com evidências** em cinco níveis: **Confirmado** (executado ou testado com resultado reproduzível), **Parcial** (funciona em determinadas condições, com limitação comprovada), **Não funcional** (há evidência de falha), **Não verificado** (há código ou documentação, mas não foi possível comprovar o funcionamento) e **Inexistente** (a ausência foi confirmada após inspeção adequada).

Estado inicial registrado antes de qualquer alteração: branch `main`, commit `75e9bb1`, arquivos inspecionados — `README.md`, `AGENTS.md`, `mobile/package.json`, `mobile/app.json`, `mobile/src/screens/BuscaScreen.tsx`, `mobile/src/services/api.ts`, `mobile/src/types/`, `mobile/src/contexts/`, `backend/package.json`, rotas/controladores/serviços do backend, `backend/src/services/audioSource/` (com `providers/`), scripts e schema do MariaDB, manifesto e `build.gradle` do projeto nativo gerado, e as suítes de teste existentes.

### 3-bis.1. Critérios de aceitação da especificação (seção 14)

| # | Critério | Classificação | Evidência |
|---|---|---|---|
| 1 | A auditoria do código e da documentação estiver registrada | **CONFIRMADO** | esta seção 3-bis, a seção 3 e a seção 10 do relatório; comandos e saídas reproduzíveis transcritos |
| 2 | A contradição entre `README.md` e `AGENTS.md` estar documentada e encaminhada | **CONFIRMADO** | ver 3-ter: a contradição **não existe mais** no estado atual; varredura por `yt-dlp`/YouTube no código sem nenhum vestígio |
| 3 | A tecnologia ter sido selecionada com base em comparação e prova de conceito | **PARCIAL** | a comparação está escrita e verificada (ver 3-quater), mas a **prova de conceito lado a lado** ShazamKit × AudD com as mesmas amostras **não foi executada** — logo, a seleção se apoia em análise técnica documentada, não em medição comparativa |
| 4 | O usuário puder iniciar e cancelar o reconhecimento pela interface | **CONFIRMADO** | botão de microfone dentro do campo de busca (`aria-label` "Identificar a música que está tocando") e "Cancelar"/"Fechar" no painel; verificado no navegador |
| 5 | A permissão de microfone for solicitada corretamente | **PARCIAL** | a permissão é pedida **em tempo de execução, no clique**, nunca na inicialização (`useReconhecimentoSonoro.iniciar`); `RECORD_AUDIO` no manifesto gerado. O diálogo nativo **não foi visto em aparelho** |
| 6 | O reconhecimento funcionar em APK instalado em aparelho Android real | **NÃO VERIFICADO** | `adb devices` devolve lista vazia; o APK de release existe (101.765.239 bytes, `sdkVersion:'36'`) mas **não foi instalado nem executado** |
| 7 | Os resultados serem apresentados sem inventar metadados | **CONFIRMADO** | `normalizarRespostaAudD` não cria título/artista/álbum; sem título vira `no_match` (teste unitário "não inventa metadados ausentes"); a confiança só aparece quando o provedor devolve pontuação documentada; a interface mostra "Título não informado" quando falta |
| 8 | O usuário puder enviar título e artista reconhecidos à lupa | **CONFIRMADO** | botão "Pesquisar no Music Galaxy" → `montarTermoBusca` (só título + artista reais) → `executarBusca`; **13 testes** automatizados no aplicativo + verificado no navegador |
| 9 | A busca por texto continuar funcionando quando o reconhecimento estiver indisponível | **CONFIRMADO** | erro do provedor e falha de permissão exibidos **sem** derrubar a tela de busca; a mensagem de erro sempre acrescenta "A busca por texto continua funcionando normalmente." |
| 10 | Credenciais privadas não expostas no APK | **CONFIRMADO** | `AUDD_TOKEN` lido de `process.env` no backend; `git ls-files mobile/` sem nenhum token; `backend/.env` ignorado; `backend/.env.example` só com marcadores |
| 11 | O áudio não ser persistido sem justificativa | **CONFIRMADO** | o arquivo da captura é apagado no `finally` de `enviarAmostra`; nenhuma tabela de áudio no MariaDB; nenhum `.wav`/`.mp3` versionado |
| 12 | O fluxo de erros liberar o microfone e não deixar operações penduradas | **PARCIAL** | `cancelar()` encerra a gravação, aborta a requisição (`AbortController`), resolve a contagem, limpa os temporizadores e apaga o arquivo; um token de geração invalida respostas atrasadas. Verificado no navegador: cancelar durante "Ouvindo…" devolve "Identificação cancelada", cancelar durante a gravação **não envia requisição** e cancelar durante o envio **aborta a requisição**. `AppState` e desmonte encerram a captura. **A interrupção por chamada telefônica só não foi observada em aparelho** |
| 13 | TypeScript, build e testes automatizados executados e documentados | **PARCIAL** | TypeScript e testes **executados agora, depois do commit `5e4d764`**: exit 0 nas duas camadas e **99/99** (61 + 25 + 13). O **build** do APK com os commits `d90d746` e `5e4d764` **não** foi refeito — o APK em `C:/Users/Public/mgbuild/` (07:33) é anterior a eles |
| 14 | Matriz de versões Android registrada, incluindo API 35 ou superior | **PARCIAL** | a configuração está registrada e confirmada no próprio pacote (`sdkVersion:'36'`, `targetSdkVersion:'36'`, `compileSdkVersion='36'`). A **matriz de aparelhos testados está vazia**: nenhuma versão do Android foi exercitada em aparelho |
| 15 | iOS testado separadamente em dispositivo real | **NÃO VERIFICADO** | o código permanece compatível com iOS (React Native 0.86 → iOS 15.1+), mas **nenhum iPhone físico** foi usado e não há build de iOS validado |
| 16 | Nenhuma funcionalidade, provider, tela, rota, tabela ou dado removido sem autorização | **CONFIRMADO** | esta rodada foi **aditiva**: nada foi removido; os três provedores de áudio (`internetArchiveProvider`, `genericWebProvider`, `directLinkProvider`) seguem intactos; nenhuma rota, tela ou tabela foi apagada |
| 17 | A documentação final distinguir implementado / testado / pendente | **CONFIRMADO** | este relatório (cada item classificado), `CHANGELOG.md`, `AGENTS.md`, `README.md` e o manual dentro do aplicativo |

### 3-bis.2. Funcionalidades do subsistema

| Recurso | Classificação | Evidência |
|---|---|---|
| Captura do microfone pelo `expo-audio` | **PARCIAL** | funciona no navegador (Expo web) com fluxo de permissão, contagem de 3 s e gravação; uma tentativa por vez, cancelamento e falha do gravador tratados e observados; o caminho **nativo** não foi exercitado em aparelho |
| Envio da amostra ao backend | **CONFIRMADO** | `POST /api/recognize` real: **503** com WAV válido de 3 s sem credencial; **400** com WAV de 44 bytes ("A amostra de áudio é curta demais para ser analisada."); **400** sem o campo `audio_base64`; **400** com JSON malformado; **413** com corpo de 3,1 MB; limite de 3 MB na rota e limitador próprio (20 tentativas / 15 min) com teste de integração confirmando o **429** |
| Normalização da resposta do provedor | **CONFIRMADO** | **23** testes unitários em `backend/tests/Unit/recognition.test.ts`, com o formato real de resposta do AudD |
| Envio do resultado à lupa | **CONFIRMADO** | **13** testes no aplicativo (`mobile/tests/reconhecimento.test.ts`) + verificação no navegador |
| Mensagem de faixa fora do catálogo | **CONFIRMADO** | "Essa faixa ainda não está no catálogo" + "Tente buscar só pelo nome do artista." + botão "Tentar de novo" — verificado no navegador |
| Transparência sobre o destino da amostra | **CONFIRMADO** | cartão de aviso durante a captura ("O trecho capturado é enviado ao servidor do Music Galaxy e analisado por um serviço de reconhecimento. Ele não é gravado nem fica guardado.") + o mesmo aviso na permissão nativa de `mobile/app.json` |
| Falhas diferenciadas por situação | **CONFIRMADO** | `permission_denied` → "Microfone bloqueado"; `microphone_unavailable` → "Microfone indisponível"; `network_error` → "Sem conexão com o servidor"; `provider_error` → "Serviço de reconhecimento indisponível"; `cancelled` → "Identificação cancelada" — todas verificadas no navegador ou por resposta real da API |
| Cancelamento e liberação do microfone | **PARCIAL** | exercitado no navegador nos três momentos (contagem, gravação e envio), com desfecho honesto e sem requisição pendurada; sem observação em aparelho |
| Privacidade (segredo, retenção, sem áudio no banco) | **CONFIRMADO** | varredura do `HEAD` sem segredo; `backend/.env` ignorado; áudio apagado no `finally`; nenhuma tabela de áudio |
| Reconhecimento em iOS | **NÃO VERIFICADO** | sem aparelho e sem build de iOS |
| Comparação ShazamKit × AudD × ACRCloud | **PARCIAL** | matriz documentada (ver 3-quater); **sem** prova de conceito executada |
| Ausência de Python no projeto (regra da seção 5.2) | **CONFIRMADO** | `git ls-files` não devolve nenhum arquivo `.py` |
| Ausência de YouTube/`yt-dlp` no código (Regra 3) | **CONFIRMADO** | varredura: as únicas menções são a proibição em prosa e a lista negra do guard `auditarUrl()` |

**Nenhum item foi classificado como "Não funcional"** — não há evidência de falha em nenhum comportamento do subsistema. **Nenhum item foi classificado como "Inexistente"** entre os recursos esperados pela especificação: todos existem no código; o que falta é execução em aparelho e credencial do provedor.

### 3-bis.3. Tabela de erros da especificação (seção 12) — comportamento real

| Situação | Comportamento exigido | Classificação | Comportamento real no projeto |
|---|---|---|---|
| Permissão negada | Explicar como habilitar e manter a busca por texto | **CONFIRMADO** | "Microfone bloqueado" + orientação para as configurações do aparelho + "A busca por texto continua funcionando normalmente." |
| Microfone indisponível | Informar e permitir tentar novamente | **CONFIRMADO** | "Microfone indisponível" + botão "Tentar novamente" |
| Nenhuma música reconhecida | Informar sem inventar título ou artista | **CONFIRMADO** | "Música não encontrada" + "Nada foi preenchido na busca."; o campo de busca não é tocado |
| Internet indisponível | Aviso de conexão sem travar a interface | **CONFIRMADO** | `network_error` → "Sem conexão com o servidor"; o endereço do servidor é ajustável em Ajustes |
| Token inválido ou expirado | Registrar erro técnico sem revelar credenciais | **PARCIAL** | o adaptador troca a mensagem do serviço por "O serviço de reconhecimento está indisponível. A credencial configurada no servidor não é válida." (nunca repassa o texto do provedor, que poderia citar o token) e há teste garantindo que a mensagem não contém "token". **A chamada real com credencial inválida não foi exercitada** (não há credencial no ambiente) |
| Limite de API atingido | Informar indisponibilidade temporária e evitar repetição | **CONFIRMADO** | limitador próprio: 20 tentativas por 15 min → **429** com "Muitas tentativas de reconhecimento. Aguarde alguns minutos antes de tentar de novo." (teste de integração) |
| Timeout | Encerrar a tentativa, liberar o microfone e oferecer nova tentativa | **PARCIAL** | timeout de 45 s no aplicativo (`AbortController`) e no backend (`axios` com `TIMEOUT_MS`); `descreverInterrupcao()` mapeia o esgotamento para `network_error` ("O servidor demorou demais para responder. Tente novamente.") e **nunca** para `cancelled` (teste dedicado). **Não exercitado contra um provedor que demore** |
| Formato de áudio incompatível | Registrar diagnóstico e não esconder o erro | **CONFIRMADO** | erros reais de validação: "A amostra de áudio é curta demais…", "A amostra de áudio é longa demais…", "O formato capturado (X) não é aceito…" — todos com HTTP 400 |
| Usuário cancela | Interromper a captura e as operações canceláveis | **CONFIRMADO** | verificado no navegador nos três momentos: cancelar na contagem/gravação → **nenhuma requisição**; cancelar no envio → requisição abortada; painel mostra "Identificação cancelada" com a promessa de que o microfone já foi liberado; status `cancelled` no contrato |
| Aplicativo vai para segundo plano | Interromper a captura | **PARCIAL** | listener de `AppState` interrompe a captura quando o app sai de `active`; **não observado em aparelho** |
| Falha no backend | Mensagem compreensível e preservar a busca por texto | **CONFIRMADO** | **503** real do servidor com mensagem explicativa; o painel mostra "Não foi possível identificar" + "Tentar novamente" |
| Resultado sem metadados suficientes | Exibir só o que foi devolvido e permitir nova tentativa | **CONFIRMADO** | "Título não informado" quando falta o título; artista e álbum aparecem só se existirem; "Tentar novamente" sempre disponível |

---

## 3-ter. A contradição entre `README.md` e `AGENTS.md` — procedimento e resultado

A especificação tratou a divergência entre os dois documentos como **bloqueio** para qualquer alteração no subsistema de descoberta de áudio (§3). O procedimento exigido foi executado item a item:

| Passo (§3.3) | Verificação real | Resultado |
|---|---|---|
| 1. Localizar os módulos citados nos dois documentos | `grep -rniE "yt-dlp\|ytdlp\|youtu"` em `backend/src`, `mobile/src`, `mobile/app.json` | **Nenhum** adaptador, import, flag ou chamada de YouTube/`yt-dlp` no código. As dez ocorrências são todas comentários de proibição ou a lista negra do guard |
| 2. Confirmar imports, chamadas, flags e fluxos | `backend/src/services/audioSource/providers/` | Três provedores, nenhum deles de plataforma: `internetArchiveProvider.ts`, `genericWebProvider.ts`, `directLinkProvider.ts` |
| 3. Verificar quais fontes são consultadas em execução | `SourceOrchestrator` + `searchOrchestrator` | Fontes abertas: Internet Archive, páginas web abertas e links diretos |
| 4. Inspecionar o guard de URLs | `backend/src/services/audioSource/webAudio.ts` | `auditarUrl()` bloqueia domínios de plataforma, protocolos não-HTTP, IP não roteável, IPv6, DNS rebinding e redirect suspeito; tem testes unitários próprios |
| 5. Registrar a divergência com evidências | esta seção | **A divergência descrita pela especificação não existe mais no estado atual.** O `README.md` (linha 87) já afirma: *"Áudio exclusivamente de sites abertos … YouTube, Spotify, Deezer, Apple Music e qualquer plataforma de música são proibidos e não aparecem no código do fluxo."* — o mesmo que a Regra 3 do `AGENTS.md` |
| 6. Propor atualização documental coerente | esta rodada | Nenhuma mudança de documentação foi necessária nesse ponto: os dois documentos já concordam |
| 7. Não reativar/excluir/substituir providers | esta rodada | Nada foi reativado, excluído nem substituído |
| 8. Solicitar autorização antes de flexibilizar a Regra 3 | esta rodada | Nenhuma flexibilização foi proposta |

**Conclusão:** a contradição apontada pela especificação era **histórica** (o `README` e o `AGENTS.md` foram atualizados em rodadas anteriores, quando o projeto passou a usar apenas fontes abertas). O que a especificação acrescenta é a exigência de que o **reconhecimento sonoro seja uma capacidade independente** — e isso está respeitado: o endpoint `POST /api/recognize` devolve **identificação**, nunca áudio; o áudio do aplicativo continua vindo exclusivamente de `audio_source_url` (Regra 7).

---

## 3-quater. Decisão de tecnologia: AudD × ShazamKit × ACRCloud

A especificação (§4) exige comparar as três tecnologias **antes** de fixar a definitiva. A comparação foi feita e está registrada no `AGENTS.md`, na seção "Decisão de tecnologia do reconhecimento (AudD × ShazamKit × ACRCloud)".

| Critério (§4.4) | ShazamKit | AudD | ACRCloud |
|---|---|---|---|
| Tipo de integração | SDK nativo (AAR) + token de desenvolvedor | API HTTP (formulário) | API HTTP (assinatura da requisição) ou SDK |
| Kotlin no Android | Obrigatório (ponte nativa) | Não obrigatório | Não obrigatório |
| Swift no iOS | Necessário se usado | Não obrigatório | Não obrigatório |
| Envio do áudio original | Não é o modelo central (assinatura acústica) | **Sim** — a API recebe o arquivo | Pode receber áudio ou fingerprint |
| Credencial | Token de desenvolvedor Apple | `api_token` | Chave + segredo de assinatura |
| Dependência nativa no app | Sim (AAR + config plugin) | **Não** | Não |
| Custo | A especificação trouxe a captura de tela da tabela de preços do AudD (teste de 300 requisições; planos a partir de US$ 5/mês) — **não reconferido no site nesta sessão** | **NÃO VERIFICADO** | **NÃO VERIFICADO** |
| Ajuste à stack existente | Exige prova de conceito nativa | **Natural pelo backend Node.js** | Natural pelo backend Node.js |
| Compatibilidade com Expo | Exige módulo nativo | **Sem SDK no cliente** | Sem SDK no cliente |

**Decisão: o AudD foi mantido.** Os motivos, todos verificáveis no código:

1. **A credencial não entra no aplicativo.** O `api_token` é lido de `process.env` dentro do backend e enviado no corpo do formulário ao AudD (`auddProvider.reconhecer`). O aplicativo fala apenas com o backend — cumpre o critério 10 e a seção 9 da especificação.
2. **Não exige SDK nativo nem AAR.** Nenhuma dependência nativa nova, nenhum módulo Kotlin, nenhum plugin de configuração — o projeto permanece 100 % React Native + TypeScript, como manda a seção 5 da especificação.
3. **O `expo-audio` já entrega o áudio.** A captura, a contagem regressiva e a liberação do microfone existem e funcionam; a tecnologia do reconhecimento não interfere na parte difícil do aparelho.
4. **O provedor é trocável.** `RECOGNITION_PROVIDER` decide o adaptador (`recognitionService.criarProvedor`) — um módulo nativo entraria ali sem alterar o controlador, o contrato nem o aplicativo.
5. **O contrato de falha já está normalizado** nos sete status da seção 6.1 da especificação, com o provedor isolado em `backend/src/services/recognition/`.

**O ShazamKit não foi descartado** e está registrado como alternativa. Ele tem duas vantagens reais sobre o AudD: **não envia o arquivo de áudio original** (usa assinatura acústica) e **não cobra por requisição**. Em contrapartida, exige SDK nativo, token de desenvolvedor Apple e integração nativa em Kotlin (e Swift no iOS), o que contraria a simplificação pedida pela seção 5 da especificação.

**A prova de conceito lado a lado (§4.5, §13.4) NÃO FOI EXECUTADA** — sem credencial do AudD e sem build nativo do ShazamKit, qualquer número de acerto, latência ou custo seria inventado. A tabela acima registra **análise técnica documentada**, não medição. É por isso que o critério 3 da seção 14 está classificado como **PARCIAL**.

**O ACRCloud não foi descartado** e também não foi escolhido: a documentação pública consultada (`docs.acrcloud.com/reference/identification-api`) devolveu "Page Not Found" ou conteúdo montado por script, sem texto conferível — **preços, franquias e limites de uso são NÃO VERIFICADOS**.

**Divergência de linha de base do Android:** a especificação (§10.1) pede Android 15 (API 35) ou posterior. O projeto, por regra permanente do `AGENTS.md`, atende **somente 2025 em diante** — Android 16 (API 36). A exigência do projeto é **mais restritiva**, então ela prevalece: `minSdkVersion 36`, e a divergência está registrada aqui e no `AGENTS.md` em vez de ser resolvida em silêncio.

---

## 4. Artefato Android de produção

> As subseções 4-bis a 4-quinquies estão em **ordem cronológica** de compilação. A configuração vigente é a de **4-quater** (`minSdk 36`); a de 4-bis tinha `minSdk 24` e aparece apenas como histórico do processo.

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

### 4-quater. Rodapé, tema, Android 2025+ e o APK correspondente (23/10/2026)

Esta rodada atendeu ao pedido de **padronizar o rodapé**, **atualizar o botão claro/escuro**, **manter a página de boas-vindas de 3 segundos**, **não deixar os botões sobreporem os do aparelho**, **restringir o aplicativo ao Android de 2025 em diante** e **ter um manual para quem tem dificuldade de manusear o celular**.

**O rodapé foi refeito** (`mobile/src/components/BarraNavegacaoInferior.tsx`): cápsula de vidro flutuante, centralizada, largura máxima de 560 px, fio de luz no topo e sombra suave. A aba ativa é marcada por uma bolha circular que desliza por baixo do ícone, posicionada a partir da largura real da fileira (`onLayout`) para ficar sempre centrada. O desenho original tinha bolha de 40 px, raio de 30 px e 14 px livres até a borda; depois do commit `4980bcc` a cápsula ficou com **58 px** de altura (bolha de 32 px, raio de 22 px, mínimo de 10 px até a borda) e o rodapé inteiro com **74 px**. Nesta rodada o dono pediu mais uma redução: a cápsula passou a **48 px** e o rodapé a **60 px** numa janela de 473 px — bolha de 28 px, ícone de 17 px, rótulo de 9/11 px, raio de 18 px e mínimo de 8 px até a borda. Medido no navegador depois da mudança: fileira de abas **40 px**, cápsula **48 px**, área total **60 px** (contra 97 px do desenho original, −38%); os cinco rótulos continuam visíveis, Explorar abriu a tela certa e a bolha ficou com **0,008 px** de desvio entre o próprio centro e o centro da aba ativa. `npx tsc --noEmit` no aplicativo → exit 0. A bolha também foi vista acompanhando Ajustes e Busca.

**O botão claro/escuro foi refeito** (`BotaoTema.tsx`): 44 × 44 px, raio de 16 px, vidro fosco igual ao dos vizinhos, e um disco interno de 30 px em que sol e lua se cruzam com rotação de 180° e escala de 1 a 0.82. O **seletor** (`SeletorTema.tsx`) deixou de ser um botão segmentado e passou a três cartões de vidro (Claro, Escuro, Sistema) com selo colorido, título e descrição. Verificado no navegador nos dois temas.

**As boas-vindas continuam com 3 segundos** (`TelaBoasVindas.tsx`, `DURACAO_MS = 3000`). Medição real no navegador, com um contador de 40 ms dentro da página: o botão "Pular" **aparece em 1.985 ms** e **desaparece em 5.241 ms** — ou seja, **3,26 s** na tela (3 s de temporizador + a animação de saída).

**O aplicativo passou a ser exclusivo do Android de 2025 em diante.** Android 15 é de 2024; a primeira versão de 2025 é o **Android 16, nível de API 36** — por isso `minSdkVersion 36`. O caminho é o oficial e verificável:

1. `expo-build-properties` (versão 57.0.22, publicada em 24/09/2026, `peer: expo: *`) escreve `android.minSdkVersion=36`, `android.compileSdkVersion=36` e `android.targetSdkVersion=36` em `android/gradle.properties` (confirmação: `prebuild --clean` regenerou o arquivo com os três valores).
2. O `expo-root-project` lê essas propriedades e as aplica no `app/build.gradle` — a saída do Gradle na build foi `[ExpoRootProject] … minSdk: 36, compileSdk: 36, targetSdk: 36, ndk: 27.1.12297006, kotlin: 2.1.20`.

**Quando o Android questiona o APK, o aplicativo se ajusta e explica.** `mobile/src/services/compatibilidade.ts` devolve o nível de API do aparelho e o nome da versão (`Android 7.0` … `Android 16`); `mobile/src/screens/TelaCompatibilidade.tsx` mostra o mascote, o nome exato da versão do aparelho, três passos para atualizar o Android, o botão "Procurar versão mais nova" (que consulta o servidor e abre o endereço publicado) e o botão para abrir as informações do aplicativo. `App.tsx` faz a verificação **antes** das boas-vindas, então a tela aparece no lugar do aplicativo. Fora do Android a verificação devolve `null` e o fluxo normal continua.

**Um segundo motivo de recusa foi eliminado:** o `versionCode` estava fixo em `1` dentro do `app/build.gradle` gerado. Publicar uma versão nova com o mesmo `versionCode` faz o Android recusar a atualização ("mesma versão"). Agora `android.versionCode` está explícito em `mobile/app.json`, e o manual explica que cada publicação precisa de um número maior.

**O APK de release foi gerado com esse código:**

```
BUILD SUCCESSFUL in 28m 26s
446 actionable tasks: 418 executed, 28 up-to-date
```

```
C:/Users/Public/mgbuild/mobile/android/app/build/outputs/apk/release/app-release.apk
101.765.239 bytes  ·  1.533 entradas
C:/Users/Public/mgbuild/MusicGalaxy-1.0.0-android16.apk  (cópia preservada)
SHA-256 d7fc8d91e1cd0dc1e7cd0e008df4dc2ea29ad1098bc7dc57dfd190d5752bfa81
```

**Metadados lidos do próprio APK** (`aapt dump badging`):

```
package: name='com.musicgalaxy.app' versionCode='1' versionName='1.0.0'
         platformBuildVersionName='16' platformBuildVersionCode='36' compileSdkVersion='36'
sdkVersion:'36'
targetSdkVersion:'36'
application-label:'Music Galaxy'
launchable-activity: name='com.musicgalaxy.app.MainActivity'
native-code: 'arm64-v8a' 'armeabi-v7a' 'x86' 'x86_64'
```

`sdkVersion:'36'` é a prova de que **o Android recusará a instalação em qualquer aparelho anterior a 2025** — exatamente a regra pedida.

**Assinatura conferida** (`apksigner verify --print-certs`):

```
Signer #1 certificate DN: CN=Android Debug, OU=Android, O=Unknown, L=Unknown, ST=Unknown, C=US
Signer #1 certificate SHA-256 digest: fac61745dc0903786fb9ede62a962b399f7348f0bb6f899b8332667591033b9c
```

É a **mesma chave** do APK anterior — a instalação por cima é aceita, sem recusa por assinatura.

**O código novo está dentro do pacote.** O bundle Hermes embutido (`assets/index.android.bundle`, 2.004.128 bytes) contém, conferidas byte a byte (o Hermes guarda acentos em UTF-16LE):

| Marca no bundle | Origem |
|---|---|
| "Atualize o Android do aparelho" | a tela de compatibilidade |
| "Quando a instalação é recusada" | o assunto novo do manual |
| "Procurar versão mais nova" | o botão da tela de compatibilidade |
| "O Music Galaxy é distribuído apenas para" | o rodapé da tela de compatibilidade |
| "Limpar a lista de Explorar?" | o modal de confirmação do Explorar |
| "Manter a lista" / "Mostrar a lista novamente" | as duas saídas do estado "Lista limpa" |
| "Você já está usando a versão mais recente." | a busca de atualização |

**O APK ficou 17 MB maior — e a causa é a regra pedida.** Composição medida do pacote (`unzip -v`):

| Parte | Bytes (descomprimido) |
|---|---|
| `lib/` (4 ABIs, gravadas sem compressão) | 66.632.872 |
| `classes.dex` + `classes2.dex` + `classes3.dex` | 27.528.840 |
| `res/`, `assets/`, `resources.arsc` e o resto | ~8.197.464 |

Tudo é gravado **sem compressão**. A documentação do Android é explícita: *"If this property and the DSL are unset, dex files will be uncompressed when minSdk >= 28"* ([`DexPackagingOptions`](https://developer.android.com/reference/tools/gradle-api/8.3/null/com/android/build/api/variant/DexPackagingOptions)). Com `minSdk 24` o dex era comprimido e o APK ficava com 84.709.935 bytes; com `minSdk 36` ele passa a ser armazenado e o APK vai a 101.765.239 bytes. **Não é defeito** — é a consequência direta de exigir apenas Android de 2025 em diante. Quem quiser o tamanho antigo pode definir `useLegacyPackaging` (o dex volta a ser comprimido, ao custo de uma instalação mais lenta). As bibliotecas nativas foram auditadas: **sem tabela de depuração** (nenhum `.debug_info`), estão limpas.

**O manual foi revisado e conferido no navegador** (`TelaManual.tsx`, catorze assuntos em português simples). O assunto "Instalar o aplicativo no Android" passou a dizer que o aplicativo funciona no Android 16 (versão de 2025) ou mais novo e que, em Androids anteriores, a instalação é recusada pelo próprio sistema. O assunto novo **"Quando a instalação é recusada"** explica as cinco recusas mais comuns: aparelho anterior a 2025, assinatura diferente da que está instalada, falta de espaço, o aviso interno de versão do aplicativo e a reinstalação por cima (que não apaga favoritos, playlists, histórico nem downloads).

**Verificação desta rodada:**

```
npm run test:unit  → tests 55 · pass 55 · fail 0 · skipped 0
npm run test:api   → tests 24 · pass 24 · fail 0 · skipped 0
backend: npx tsc --noEmit → exit 0
mobile:  npx tsc --noEmit → exit 0
```

No navegador: boas-vindas medida em 3,26 s · modal "Limpar a lista de Explorar?" com "Manter a lista" e "Limpar a lista" · estado "Lista limpa" com "Mostrar a lista novamente" (e a lista voltando) · rodapé acompanhando a aba · seletor de tema mudando para escuro · botão do cabeçalho voltando para claro · a tela de compatibilidade **não** é alcançável na web (a verificação devolve `null` fora do Android).

**NÃO VERIFICADO:** o APK não foi instalado nem executado em aparelho Android físico — `adb devices` devolve lista vazia (nenhum aparelho conectado). A tela de compatibilidade só aparece em aparelho com Android anterior a 16, o que não existe nesta máquina.

### 4-quinquies. O APK existente é anterior aos dois últimos commits

| Evidência | Valor |
|---|---|
| APK de release | `C:/Users/Public/mgbuild/mobile/android/app/build/outputs/apk/release/app-release.apk` · 101.765.239 bytes · **07:33:57** de 23/10/2026 |
| Cópia preservada | `C:/Users/Public/mgbuild/MusicGalaxy-1.0.0-android16.apk` · mesmo tamanho · 07:40:45 |
| Commits posteriores | `4980bcc` (08:49, rodapé) · `d90d746` (09:23, duração real da amostra e limites em português) · `5e4d764` (09:34, cancelamento e captura única) |

O pacote contém a rodada do rodapé, do tema e do Android 16 (o build de 28m26s partiu da árvore de trabalho que já tinha esse código), mas **não contém as correções de reconhecimento** de `d90d746` e `5e4d764` — leitura real da duração da amostra, respostas de limite em português e o cancelamento honesto. Para a entrega dessas correções é preciso **recompilar**: sincronizar a árvore atual em `C:/Users/Public/mgbuild/mobile` e rodar o `gradlew assembleRelease` de lá (procedimento descrito no `AGENTS.md`). **Isso não foi feito nesta rodada** — o artefato de reconhecimento mais recente continua sendo o APK de 07:33.

---

## 5. Ausência de regressões

| Caminho | Verificação | Resultado |
|---|---|---|
| Busca por texto | `GET /api/search?q=daft punk` | **50 exibidas** (total 51) · 139 pendentes · só versões com áudio |
| Reprodução | `GET /api/releases/40/stream` (Range) | **206** com `Content-Range: bytes 0-1023/12817079` |
| Interface (web) | botão do microfone, painel, Ajustes | todos os controles presentes e funcionais |
| Deslocamento horizontal | `scrollWidth` × `clientWidth` | 460 × 460 — corrigido pelo recorte da camada de brilhos (`1123db1`) |
| Console | 3 mensagens | 0 erros · 0 avisos |
| Servidor configurável | "Testar conexão" | `GET http://localhost:3001/health` → **200** (3 requisições observadas) |
| Busca de atualização | "Procurar atualizações" + checagem automática | `GET /api/app/versao` → **200**; modal de nova versão e botão "Baixar" verificados |
| TypeScript | backend e mobile | exit 0 nos dois, reexecutado depois do commit `5e4d764`, também em clone limpo |
| Testes | unitários, de integração e do aplicativo | 61/61 + 25/25 + 13/13 = **99/99**, 0 ignorados |
| Contrato do reconhecimento | cancelamento × tempo esgotado | `cancelled` só quando o usuário desiste; timeout vira `network_error` (2 testes dedicados) |
| Cancelamento na interface | navegador, três momentos | contagem/gravação → sem requisição · envio → requisição abortada · painel "Identificação cancelada" |
| Limites da rota | `POST /api/recognize` | 400 (curta, corrompida, sem campo, JSON inválido) · 413 (3,1 MB) · 429 (integração) · 503 (sem credencial), todas em pt-BR |
| Aviso (toast) | medida do cartão no navegador | **antes**: topo 483 px em janela de 473 px (fora da tela) · **depois**: topo 10 px, esquerda 16 px, 428 × 64 px, dentro da tela |
| Modal de confirmação | "Limpar a lista de Explorar" | abre o modal com título, explicação e os botões "Manter a lista" / "Limpar a lista" |
| Décadas | `GET /api/works/by-decade/{d}` | 3 / 3 / 4 / 2 / 2 / 2 / 0 obras com áudio (2020s → 1960s); a de 1960 tem 62 obras no catálogo e nenhuma com fonte resolvida |
| Dependências do aplicativo | `npx expo-doctor` · `npx expo install --check` | "21/21 checks passed. No issues detected!" · "Dependencies are up to date" (5 pacotes não usados removidos) |

---

## 6. Segurança e privacidade

- **Segredos:** varredura de **todo o histórico** (`git log -p --all`) por `AUDD_TOKEN`, `DISCOGS_TOKEN`, `MUSICBRAINZ_TOKEN` e `api_token`: 5 valores únicos semelhantes a segredo, **todos marcadores** iniciados por `seu_` (atribuições de `AGENTS.md`, `README`, relatórios e `backend/.env.example`). **0** chaves privadas (`BEGIN … PRIVATE KEY`), **0** arquivos `.env` versionados, **0** keystores. `backend/.env` está ignorado (`backend/.gitignore:14`).
- **Amostras de áudio:** nenhuma gravação versionada; a captura é temporária, apagada no `finally` de `enviarAmostra` e nunca gravada no banco.
- **Dados pessoais:** o histórico (favoritos, playlists, buscas, reproduções) vive no AsyncStorage do aparelho e não vai para o backend.
- **SSRF:** o guard `auditarUrl()` bloqueia IP privado/loopback/link-local/reservado, IPv6, DNS rebinding, redirects e domínios de plataformas; tem testes unitários próprios.
- **Força bruta:** `POST /api/recognize` tem limitador próprio (20 tentativas por 15 min, `RECOGNITION_RATE_LIMIT_*`), com teste de integração que confirma o 429.
- **Corpo da requisição:** limite de 3 MB aplicado **na rota** (`app.use('/api/recognize', express.json({ limit: '3mb' }))`), sem afrouxar o limite global de 10 kB das outras rotas.
- **Dependências (`npm audit --omit=dev`, 23/10/2026):** 38 sinalizações (35 altas, 3 moderadas, **0 críticas**). Os avisos são de ferramentas de build — `braces` (GHSA-vfj7-8cjw-p6xm), `decode-uri-component` (GHSA-vcc3-ghjq-m6fr) e `node-forge` (GHSA-86w9-cpqp-85rv). O "conserto" sugerido pela CLI **rebaixaria** `react-native` para 0.72.17 e `expo` para 44.0.6, o que quebraria a stack — não foi aplicado. Nenhum aviso alcança o backend em execução nem o fluxo de reconhecimento.
- **O que é gravado em log:** a pasta `backend/src/services/recognition/` e o controlador não têm **nenhuma** chamada de `console.*` — token e áudio nunca vão para o log. No aplicativo, as quatro chamadas da captura registram apenas o objeto de erro (`console.warn`/`error`), sem o conteúdo da amostra.

---

## 7. Tratamento de falhas (recuperação sem reinstalar)

Cada situação da tabela de erros da especificação (seção 12) tem um comportamento próprio, verificado no navegador ou por resposta real da API. Detalhe completo em 3-bis.3.

1. **Sem credencial no servidor** → 503 com mensagem explicativa; o aplicativo explica ao usuário e a busca por texto continua funcionando.
2. **Permissão de microfone negada** → status `permission_denied` → painel **"Microfone bloqueado"**, com a orientação de liberar nas configurações do aparelho e a frase *"A busca por texto continua funcionando normalmente."*
3. **Microfone indisponível** (gravador ausente, arquivo em uso, navegador sem suporte) → status `microphone_unavailable` → **"Microfone indisponível"** + botão "Tentar novamente".
4. **Amostra inválida/corrompida/sem título** → 400 com mensagem específica ("A amostra de áudio é curta demais para ser analisada.", "Envie a amostra de áudio no campo \"audio_base64\"."); o painel oferece "Tentar novamente".
5. **Sem internet ou servidor fora do ar** → `network_error` → título **"Sem conexão com o servidor"** e a mensagem "Não foi possível conectar ao servidor. Verifique a internet e o endereço em Ajustes."; o endereço é ajustável em Ajustes → "Servidor da API", com "Testar conexão" e "Restaurar endereço padrão". A tela foi verificada em rodada anterior desta auditoria; **nesta sessão o cenário não foi reexecutado** porque a automação do navegador caiu (ver 3.1).
6. **Servidor demorou** → timeout de 45 s no aplicativo e "O servidor demorou demais para responder. Tente novamente."; o contrato diferencia o tempo esgotado (`network_error`) do cancelamento do usuário (`cancelled`) — teste dedicado.
7. **Excesso de tentativas** → 429 e "Muitas tentativas de reconhecimento. Aguarde alguns minutos antes de tentar de novo."
8. **Falha do provedor** → `provider_error` com o título **"Serviço de reconhecimento indisponível"**, a mensagem do serviço e o botão de nova tentativa (verificado no navegador).
9. **Usuário cancelou** → status `cancelled` → **"Identificação cancelada"**, com "A identificação foi interrompida. O microfone já foi liberado." Cancelar na contagem/gravação não envia requisição; cancelar no envio aborta a requisição em curso.
10. **A faixa identificada não existe no catálogo** → a tela de Busca troca o estado vazio genérico por **"Essa faixa ainda não está no catálogo"**, com a sugestão de buscar só pelo nome do artista e o botão "Tentar de novo".

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
| 12 | A amostra era validada **depois** da checagem de credencial, e a duração vinha de estimativa | **CORRIGIDO** | A validação passou a acontecer antes de `criarProvedor()` — amostra inválida recebe 400 mesmo sem `AUDD_TOKEN`. `duracaoAmostra.ts` lê a duração real (WAV/FLAC/M4A exatos, MP3 pelo primeiro quadro) e os limites são aplicados com mensagens em português (commit `d90d746`) |
| 13 | Corpo grande (3,1 MB) e JSON malformado devolviam erro técnico genérico | **CORRIGIDO** | O middleware de erros traduz `entity.too.large` → **413** e corpo inválido → **400**, ambos em pt-BR, sem vazar pilha do Node (commit `d90d746`; verificado por requisição real) |
| 14 | Cancelamento e tempo esgotado chegavam como o mesmo `AbortError` | **CORRIGIDO** | `descreverInterrupcao()` separa os dois: desistência do usuário → `cancelled`; tempo esgotado → `network_error`. Dois testes novos garantem o contrato (commit `5e4d764`) |
| 15 | Tocar no microfone durante uma tentativa podia abrir uma segunda captura e deixar estado preso | **CORRIGIDO** | Trava `emAndamento` + token de geração invalidam contagem, gravação e resposta atrasadas; `cancelar()` resolve a contagem pendente; `AppState` e desmonte encerram a captura. Verificado no navegador (commit `5e4d764`) |
| 16 | `provider_error` caía no título genérico "Não foi possível identificar" | **CORRIGIDO** | O painel ganhou o caso próprio **"Serviço de reconhecimento indisponível"**, com a mensagem do serviço e a lembrança de que a busca por texto continua funcionando (commit `5e4d764`) |

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
| APK de release para instalar e testar em aparelho | o usuário | **Existe, mas é anterior às correções de reconhecimento:** `C:/Users/Public/mgbuild/MusicGalaxy-1.0.0-android16.apk` (101.765.239 bytes, `sdkVersion:'36'` — só instala em Android 16 / 2025 em diante, assinado com o keystore de depuração, mesma chave do APK anterior) |
| Credencial do AudD para o caminho de acerto | o usuário | `AUDD_TOKEN` no `backend/.env` — sem isso a rota responde 503 e o aplicativo explica que o serviço não está configurado |
| Teste com microfone em aparelho Android físico | o usuário | aparelho Android 2025+ (`adb devices` não encontrou aparelho nesta máquina) |
| Novo APK com o código desta rodada | o usuário / build local | o APK em `C:/Users/Public/mgbuild/` é de **07:33** e os commits `d90d746` (09:23) e `5e4d764` (09:34) vieram depois: as correções de duração da amostra, limites em português e cancelamento **não estão no pacote**. Recompilar sincronizando a árvore em `C:/Users/Public/mgbuild/mobile` e rodando o `gradlew assembleRelease` de lá (procedimento do `AGENTS.md`) |
| Prova de conceito comparativa ShazamKit × AudD | o usuário | exige credencial do AudD **e** um build nativo com o AAR do ShazamKit; sem os dois, a decisão se apoia na comparação técnica documentada (3-quater) |
| Teste em iPhone físico | o usuário | o código é compatível com iOS (React Native 0.86 → iOS 15.1+), mas não há aparelho nem build de iOS validado |
| Publicar a primeira versão no servidor | o usuário | `APP_VERSAO_PUBLICADA` e `APP_URL_DOWNLOAD` no `backend/.env` — sem isso o aplicativo continua funcionando e apenas não avisa de versão nova |
| Anel de foco do navegador nos outros campos de texto da versão web | próxima rodada de código | **Achado related, fora do escopo desta rodada (relatado, não corrigido em silêncio):** o retângulo âmbar que o dono viu no campo de busca era o **anel de foco do navegador** (Chrome, na cor de destaque do sistema — `rgb(229,151,0)` = #E59700 medido nesta máquina), desenhado pela folha de estilo do próprio navegador e não pelo aplicativo. O anel foi desligado **apenas no campo de busca** (`mobile/src/screens/BuscaScreen.tsx`, `nativeID="campo-busca-musicgalaxy"` + `outline: none !important` na folha exclusiva da web), porque só esse campo tem indicação de foco do próprio aplicativo (contorno e sombra da pílula em `colors.primary`). Os demais campos de texto da versão web (endereço do servidor em Ajustes, modais de playlist, campos da Biblioteca e do painel administrativo) **continuam com o anel do navegador**, porque nenhum deles tem indicação de foco desenhada pelo aplicativo — desligá-lo ali deixaria o usuário sem nenhuma pista de onde está digitando. Medido depois da correção: **0** pixels âmbar na área do campo de busca vazio e focado (antes: 958, sendo 908 exatamente #E59700). Afeta **somente a versão web**; o APK Android não é desenhado pelo navegador |
| Push para o repositório público | o usuário | **nenhum push foi feito nesta sessão**: a `main` local está **20 commits à frente** de `origin/main` (último commit remoto conhecido: `8c8b13f`, 22/10/2026 23:50) |

---

## 10. Achados fora do escopo (relatados, não corrigidos)

Estes pontos foram encontrados durante a inspeção e **não** foram alterados, porque corrigi-los mexeria em arquivos do dono, em infraestrutura ou em ferramentas fora do pedido. Ficam registrados em vez de corrigidos em silêncio.

| # | Achado | Situação | Evidência |
|---|---|---|---|
| 1 | Esqueleto Android legado na **raiz** do repositório (`app/`), com `<queries>` para Spotify, Google Music, Apple Music e Deezer | **NÃO CORRIGIDO (código do dono)** | `git ls-files app` → 3 arquivos (`app/build.gradle.kts`, `app/src/main/AndroidManifest.xml`, `MusicGalaxyApplication.kt`); o manifesto lista os quatro pacotes nas linhas 78-81. **Não entra no APK**: o projeto nativo usado é `mobile/android/` (gerado por `expo prebuild`), e a raiz não tem `settings.gradle` nem `gradlew` — não é compilável isoladamente |
| 2 | `docker-compose.yml` declara serviços `redis` (`redis:7-alpine`) e `mailpit` (`axllent/mailpit:latest`) | **NÃO CORRIGIDO (infraestrutura)** | Nenhuma dependência `redis`/`ioredis`/`nodemailer` nos três `package.json`; `grep` em `backend/src` por `redis://`, `createClient` ou `mailpit` sem achado. O banco usado é o MariaDB local na porta 3307, fora do compose |
| 3 | `backend/package.json` tem `"lint": "eslint src --ext .ts"`, mas **não existe** configuração ESLint versionada (`.eslintrc*` nem `eslint.config.*`); o mobile não tem script de lint | **NÃO CORRIGIDO (ferramenta não pedida)** | `ls backend/.eslintrc* backend/eslint.config.*` → arquivos inexistentes. A Regra 5 é atendida pelo `tsc --noEmit`, que passa; criar configuração nova seria adicionar ferramenta sem pedido |
| 4 | `SYSTEM_ALERT_WINDOW` consta das permissões do APK, mas o código do aplicativo não desenha sobreposição | **NÃO VERIFICADO / NÃO CORRIGIDO** | Permissão listada pelo `aapt dump badging` do APK; nenhum uso de overlay em `mobile/src`. A origem provável é o overlay de desenvolvimento do Expo, mas **não foi rastreada** até o manifesto que a injeta — remover sem essa prova poderia quebrar a ferramenta de desenvolvimento |

---

## 11. Configuração de desenvolvimento e produção

| Item | Desenvolvimento (verificado nesta máquina) | Produção (o que o código faz) |
|---|---|---|
| Banco | MariaDB **11.4.9** em `127.0.0.1:3307`, schema `musicgalaxy`: 3.720 obras, 3.969 versões, **121 com áudio**, 99 tipos de lançamento, 3 fontes de metadados | mesmas variáveis `DB_HOST`/`DB_PORT`/`DB_USER`/`DB_NAME`; **nenhuma instância de produção foi verificada** |
| Backend | Node **v24.18.0**, Express em `PORT=3001`, `NODE_ENV=development` | `NODE_ENV=production` fecha o CORS: só as origens listadas em `CORS_ORIGIN`; sem lista, qualquer origem de navegador é negada (`backend/src/app.ts`) |
| Limites | corpo de 10 kB no geral e **3 MB só** em `/api/recognize`; 100 requisições/15 min geral; 20/15 min no reconhecimento | ajustáveis por `RATE_LIMIT_*` e `RECOGNITION_RATE_LIMIT_*` |
| Aplicativo | Expo `~57.0.31` · React Native `0.86.3` · React `19.2.3`; endereço padrão: web `http(s)://<host>:3001`, emulador Android `10.0.2.2:3001`, iOS `localhost:3001` | em produção `urlBasePadrao()` devolve **vazio** — o aplicativo abre offline até o usuário salvar o endereço em Ajustes (`apiConfig.ts:34-54`), como manda a Regra 5 |
| Reconhecimento | `RECOGNITION_PROVIDER=audd`; `AUDD_TOKEN` **ausente** no ambiente (`grep -c AUDD_TOKEN backend/.env` → `0`) → rota responde 503 | mesmo mecanismo; a credencial existe somente no servidor |
| Versão publicada | `APP_VERSAO_PUBLICADA=1.0.0` · `APP_URL_DOWNLOAD=https://github.com/claytonmarcelo/Music-Galaxy/releases/latest` · `APP_ATUALIZACAO_OBRIGATORIA=false` | publicar versão nova é editar o `.env`; nenhum build é necessário |
| Versão do aplicativo | `1.0.0` no `package.json` (raiz, mobile e backend), `versionName 1.0.0`, `versionCode 1`, `VERSAO_APLICATIVO = '1.0.0'` | subir `version` **e** `versionCode` a cada publicação |
| Segredos | `backend/.env` ignorado; `backend/.env.example` versionado apenas com marcadores | o mesmo arquivo de exemplo serve de checklist |

**NÃO VERIFICADO:** não existe instância de produção desta API em execução nesta máquina. O comportamento de produção (CORS restrito, HTTPS, proxy reverso) foi conferido **no código**, não em servidor real — e o APK assinado de produção continua dependendo do login do dono no EAS.

---

## 12. Inspeção do Git

| Item | Resultado real |
|---|---|
| Branch / remoto | `main` → `origin` `https://github.com/claytonmarcelo/Music-Galaxy.git` (upstream `origin/main`) |
| Histórico | **66 commits** · **175 arquivos** versionados |
| HEAD | `5e4d764` · 23/10/2026 09:34 · "fix: tornar o cancelamento do reconhecimento honesto e evitar capturas simultâneas" (8 arquivos, +239/−48) |
| Commits anteriores | `d90d746` (09:23, duração real da amostra) · `4980bcc` (08:49, rodapé) · `4a166fb` (08:45, anel de foco) · `c716c7d` (08:18, crédito em Sobre) |
| Sincronia | **20 commits à frente** de `origin/main` (último remoto conhecido `8c8b13f`, 22/10/2026 23:50) — **nenhum push** nesta sessão |
| Arquivos do dono | `COMMIT_MSG.txt`, `backend/test_db.php`, `php.ini.local`, `query`, `vibe_images/` continuam **não rastreados e intocados** |
| Ignorados confirmados | `backend/.env` (`backend/.gitignore:14`) · `mobile/android` (`.gitignore:48`) · `node_modules/` · `dist-test/` · `dist-tests/` |
| Segredos no histórico | 5 valores únicos semelhantes a segredo, **todos marcadores `seu_*`**; 0 chaves privadas; 0 `.env` versionados; 0 keystores |
| Operações destrutivas | **nenhuma** — sem `reset --hard`, `commit --amend`, rebase, `filter-branch`/`filter-repo`, `clean -fd`, `--no-verify` ou `git add .`; os commits foram criados apenas quando pedidos |

---

## 13. Logs e observabilidade

| Camada | O que existe | Evidência |
|---|---|---|
| Backend — erros | `middlewareErros` registra método, caminho, status e mensagem; pilha só para erro 500 | `backend/src/middleware/errorHandler.ts:81-84` |
| Backend — ingestão | `emitirEvento()` grava eventos estruturados `[timestamp] [INGESTION_*]` e `registrarLogIngestion()` insere em `ingestion_log` (falha de log não derruba o fluxo) | `backend/src/services/logger/ingestionLogger.ts`; 106 chamadas `console.*` no backend |
| Reconhecimento | **nenhuma** chamada de `console.*` nos serviços, no controlador ou no limitador — token e áudio não são registrados | `grep` em `backend/src/services/recognition/` e `recognitionController.ts` → 0 |
| Aplicativo | 35 chamadas de `console.*` (player, downloads, contexto e captura); as 4 da captura registram só o objeto de erro | `grep` em `mobile/src` |
| Saúde | `GET /health` responde **sem consultar o banco**, para continuar de pé durante indisponibilidade do MariaDB | `backend/src/app.ts` + `200` real |
| Limites | cabeçalhos `RateLimit-*` no limitador geral; limitador do reconhecimento é criado **por aplicação** (sem singleton compartilhado entre testes) | integração: 429 real |

**NÃO VERIFICADO:** não há envio centralizado de logs (APM, arquivo rotacionado ou serviço externo) nem política de retenção declarada; o comportamento de log **em produção** não foi observado.

---

## 14. Veredito

**APROVADO COM RESSALVAS.**

O que está **comprovado**: o backend e o aplicativo compilam sem erro de TypeScript (inclusive em clone limpo do repositório), as **99 verificações automatizadas** passam — 61 unitárias do backend + 25 de integração contra o MariaDB real + 13 do aplicativo, reexecutadas depois do commit `5e4d764` —, a API real responde como documentado, o reconhecimento sonoro está implementado ponta a ponta com credencial isolada no servidor e mensagens em pt-BR, a busca de atualização pela internet funciona nos dois gatilhos (automático e manual) com aviso honesto e sem laço de requisições, a busca e a reprodução seguem funcionando, o artefato Android compila com `targetSdk 36` e a permissão de microfone declarada no manifesto.

Nesta rodada os **achados de código** da auditoria foram corrigidos na íntegra (restos de Laravel, `as any[]`, `eslint-disable`, função sem consumidor, dependências não importadas, duplicações, pasta vazia e a duração do toast). Dois **achados novos** apareceram no caminho e também foram resolvidos: o aviso (toast) era desenhado fora da tela — a camada global tinha altura zero, então o aviso renderizava 483 px abaixo do topo de uma janela de 473 px — e o padrão `cache/` do `.gitignore` do backend alcançava `backend/src/services/cache/`, que é código-fonte, e esconderia de qualquer arquivo novo criado ali. Os dois estão documentados em `AGENTS.md`. Dois achados anteriores ("décadas vazias" e "tela do artista sem entrada") foram refutados com execução real e medição no banco: estavam **antigos**, não são defeitos do código atual.

**Nesta última rodada** (rodapé, botão claro/escuro, Android 2025+, manual) o que está comprovado: o rodapé virou uma cápsula de vidro com bolha deslizante e 14 px livres até a borda (medido), o botão e o seletor de tema foram refeitos e funcionam nos dois temas (medido), as boas-vindas duram 3,26 s na tela com um temporizador de 3.000 ms (medido), o `minSdkVersion` é 36 e o APK gerado declara `sdkVersion:'36'` (lido do próprio pacote), o aplicativo explica a incompatibilidade em vez de quebrar, e o manual tem catorze assuntos em pt-BR incluindo as cinco recusas de instalação. As **99 verificações** continuam passando e o TypeScript está limpo nas duas camadas.

**Nesta rodada de reconhecimento sonoro** (especificação técnica de reconhecimento musical por áudio) o que está comprovado: a auditoria do subsistema foi registrada e **classificada item a item** em Confirmado / Parcial / Não verificado / Inexistente, com evidência (3-bis); a contradição `README.md` × `AGENTS.md` apontada pela especificação **não existe mais** — varredura real por `yt-dlp` e YouTube no código não encontra vestígio, e os dois documentos dizem a mesma coisa (3-ter); o aplicativo **passa a informar para onde vai o trecho capturado** (cartão de aviso durante a captura e texto novo da permissão nativa); cada falha ganhou **status e título próprios** (`permission_denied` → "Microfone bloqueado", `microphone_unavailable` → "Microfone indisponível", `network_error` → "Sem conexão com o servidor", `provider_error` → "Serviço de reconhecimento indisponível", `cancelled` → "Identificação cancelada"); a faixa identificada que não existe no catálogo deixou de aparecer como "Nenhuma versão encontrada" genérica e passou a ter aviso próprio com sugestão; o contrato do reconhecimento foi extraído para um módulo puro (`mobile/src/services/reconhecimentoContrato.ts`) e ganhou **13 testes automatizados no aplicativo**, sem nenhuma dependência nova; e a comparação **AudD × ShazamKit × ACRCloud** foi feita e registrada antes de qualquer mudança de código, com a justificativa de manter o AudD e as ressalvas do que ficou sem prova (3-quater).

**Na rodada final de correções** (commits `d90d746` e `5e4d764`) o que está comprovado: a amostra é validada **antes** da checagem de credencial e a duração é lida de verdade (WAV/FLAC/M4A exatos, MP3 aproximado); corpo grande responde **413** e JSON inválido **400**, ambos em pt-BR; desistência do usuário e tempo esgotado deixaram de ser o mesmo erro (`cancelled` × `network_error`, com teste dedicado); tocar no microfone durante uma tentativa **cancela a anterior** em vez de abrir uma segunda captura; cancelar na contagem/gravação **não envia requisição** e cancelar no envio **aborta a requisição** (todos observados no navegador); e o painel ganhou o título próprio de falha do provedor. As 99 verificações passam e o TypeScript está limpo nas duas camadas.

As **ressalvas** (impedem aprovação integral, conforme exigido): o caminho de acerto do reconhecimento não foi exercitado contra o serviço real por falta de credencial; a **prova de conceito comparativa** entre ShazamKit e AudD com as mesmas amostras não foi executada (exigiria credencial e build nativo com o AAR), então a seleção do provedor apoia-se em análise técnica documentada, não em medição; a captura por microfone, a instalação do APK e a instalação do APK indicado pelo botão "Baixar" não foram executadas em aparelho Android físico (`adb devices` não encontrou aparelho); o iOS não foi testado em aparelho; o APK de produção assinado depende do login do usuário no EAS — bloqueio comprovado pela própria CLI ("An Expo user account is required to proceed."); e o APK de release existente é de **07:33**, anterior aos commits `d90d746` (09:23) e `5e4d764` (09:34), então **as correções de duração, limites e cancelamento ainda não estão em nenhum pacote instalável**. Há ainda uma lacuna de teste: o cenário visual de `network_error` não foi reexecutado nesta sessão porque a automação do navegador caiu — o contrato está coberto por teste, mas a tela não foi reobservada agora. Nenhuma dessas ressalvas foi escondida por suposição — cada uma está marcada como **NÃO VERIFICADO**, **NÃO TESTADO** ou **PARCIAL** acima, com o motivo exato.

**Sobre o artefato entregável:** o APK de release de 101.765.239 bytes (`sdkVersion:'36'`, assinatura conferida com `apksigner`, mesma chave do anterior) contém a rodada do rodapé, do tema e do Android 2025+, com as marcas verificadas no bundle Hermes ("Atualize o Android do aparelho", "Quando a instalação é recusada", "Procurar versão mais nova", "Limpar a lista de Explorar?"). Ele **não** contém, porém, os dois últimos commits de código — duração real da amostra, respostas 413/400 em português e o cancelamento honesto. O crescimento de 17 MB do pacote tem causa medida e explicada — o dex passa a ser gravado sem compressão porque `minSdk >= 28` ([`DexPackagingOptions`](https://developer.android.com/reference/tools/gradle-api/8.3/null/com/android/build/api/variant/DexPackagingOptions)) — e as bibliotecas nativas foram auditadas sem tabela de depuração. Para fechar a entrega: recompilar o release com a árvore atual (build local, procedimento do `AGENTS.md`), e o dono entrar na conta Expo, rodar o `eas build` para assinar com a chave de produção e instalar em um aparelho Android 16 ou mais novo.
