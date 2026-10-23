# Music Galaxy - Documentação para Agentes de IA

## Visão Geral

Este documento contém instruções específicas para agentes de IA trabalharem no projeto Music Galaxy. Siga estas diretrizes para manter consistência e evitar interrupções desnecessárias.

## Stack Tecnológica (Obrigatória)

- **Frontend**: React Native + TypeScript + Expo SDK 57
- **Backend**: Node.js + TypeScript + Express
- **Banco de Dados**: MariaDB (exclusivamente)

**NÃO introduzir nenhuma outra tecnologia** sem autorização explícita:
- Nada de Firebase, Supabase, GraphQL
- Nada de Redux Toolkit Query ou outros gerenciadores de estado
- Nada de ORMs de terceiros (usar mysql2 diretamente)
- Nada de Expo gerenciado com serviços externos

## Configuração do Ambiente

### Localização
- Caminho: `C:\wamp64\www\musicgalaxy`
- Plataforma: Windows com WampServer64

### Banco de Dados MariaDB
- **Porta oficial: 3307** (configuração definitiva, não alterar)
- Host: 127.0.0.1
- Nome do banco: musicgalaxy
- Usuário: root (configurável via .env)

### Estrutura de Diretórios
```
musicgalaxy/
├── mobile/          # React Native + TypeScript
├── backend/         # Node.js + TypeScript + Express
├── database/        # Scripts MariaDB
├── AGENTS.md        # Este documento
└── README.md        # Documentação geral
```

## Regras Permanentes (Inegociáveis)

### Regra 1 — Capa Oficial da Música
- Exibir exclusivamente a capa oficial da fonte consultada
- Nunca gerar capas por IA
- Nunca criar capas fictícias
- Nunca usar capas de outra música
- Se não houver capa disponível, exibir placeholder "Sem Capa"
- No banco: `cover_url` NULL = sem capa oficial
- **De onde a capa vem** — `backend/src/services/covers/coverResolver.ts` lê a referência oficial gravada pela ingestão: o MBID do MusicBrainz é consultado no **Cover Art Archive** (a mesma capa publicada no MusicBrainz) e o id do Discogs no **detalhe do lançamento** (`/releases/{id}`, com o token do servidor), porque a busca do Discogs devolve `cover_image` vazio. Só a imagem principal/frente é aceita — contracapa, selo e encarte não são capa.
- **Nada bloqueia a subida** — o preenchimento roda em segundo plano: uma rodada 5s depois de o servidor subir e outra a cada 5 minutos, em lotes de 40 versões com áudio (as únicas exibidas, Regra 7). A capa existe em https; se a fonte devolver `http://`, o protocolo é trocado para que a imagem carregue em página https e no Android, sem alterar a imagem.
- **Sem imagem, continua nulo** — 404, corpo vazio ou acervo sem frente não viram capa inventada; a versão segue com `cover_url` NULL e o aplicativo mostra "Sem capa". Referências já tentadas não são repetidas na mesma execução do servidor.

### Regra 2 — Pesquisa Musical Completa
- Retornar TODAS as versões de uma obra musical
- Cada versão é um registro independente na tabela `releases`
- Nunca ocultar ou substituir versões
- Suportar todos os formatos de lançamento e tipos de versão especificados
- No frontend: exibir cada versão individualmente na lista

### Regra 3 — Áudio Apenas de Fontes Web Abertas (Proibição Total de Plataformas)
- O áudio (stream/download) deve vir **exclusivamente de sites abertos no mundo inteiro**: blogs, fóruns, sites pessoais e links diretos de arquivos de áudio
- **JAMAIS, em hipótese alguma, usar YouTube, Spotify, Deezer ou qualquer plataforma/serviço de música** de qualquer tipo ou gênero
- Aplicação em código (não só de comentário):
  - `backend/src/services/audioSource/webAudio.ts` contém `PLATAFORMAS_PROIBIDAS` e `auditarUrl()`, um guard anti-SSRF que bloqueia domínios de plataformas, protocolos não-HTTP, IPs não roteáveis e redirects suspeitos. **Toda URL de áudio visitada pelo sistema passa por esse guard.**
  - `backend/src/services/audioSource/providers/internetArchiveProvider.ts` descobre áudio no **Internet Archive** (archive.org) por APIs públicas (`advancedsearch.php`, `metadata/{id}`, `download/{id}/{arquivo}`), sem chave e sem login. A identidade do candidato vem do próprio arquivo (nome → metadados ID3 → título do item somente quando há um único áudio) e o filtro de versão impede que instrumental/remix/live substituam a versão original.
  - O ingestion (`searchOrchestrator.ts`) nunca salva URLs de plataformas; as colunas legadas (`youtube_video_id`, `audio_preview_url`, `streaming_url`, `download_url`) foram zeradas e são de somente leitura.
  - O app mobile não exibe nem chama nenhum serviço de plataforma (Spotify/YouTube etc.)
- Fonte descoberta é persistida por release em: `audio_source_url`, `audio_source_provider`, `audio_source_page_url`
- Para registrar manualmente uma fonte aberta confiável: `POST /api/releases/:id/audio-source` com `{ "url": "..." }` (validada pelo guard antes de salvar)

### Exceções da Regra 3
- Nenhuma. Se uma funcionalidade depender de conteúdo de plataforma de música, ela deve ser redesenhada com fontes web abertas ou removida.

### Regra 4 — Identidade Visual (Vidro Fosco + Aurora)
- Todas as telas e componentes usam os tokens do `ThemeContext` (mobile/src/contexts/ThemeContext.tsx) e os componentes compartilhados `FundoAtmosfera` (fundo atmosférico em React Native puro, com faixas de gradiente e brilhos suaves) e `GlassCard`
- Paleta oficial: taupe quente profundo, vinho/bordô, marfim e vidro fosco minimalista; tema claro em marfim/areia, tema escuro em taupe profundo com luz vinho e âmbar. Cartões de vidro, botões-pílula, contornos finos e cantos amplos
- **Proibido exibir o nome da identidade visual como texto** em qualquer interface, código visível ao usuário ou comentário desnecessário — é apenas um conceito de design
- **Proibido usar cores hexadecimais fixas** em estilos — sempre tokens do tema (a troca claro/escuro depende disso)
- Ícones: usar o componente `Icone` (nomes em português brasileiro), com traço fino e coerente com a paleta. A barra inferior flutuante (`BarraNavegacaoInferior`) concentra as cinco áreas principais
- Mascote oficial: `mobile/assets/mascote.png` (robô DJ com fones e vinil), usado na busca, nos estados vazios e na seção Sobre
- Ícone do aplicativo: **fundo transparente obrigatório** (PNG com canal alfa real). Assets: `mobile/assets/icon.png`, `mobile/assets/adaptive-icon.png` e `mobile/assets/splash.png`
- Textos de interface **sempre em português brasileiro correto** (acentos, crase, concordância, plural)
- Em texto de interface, "release" é "versão" (o termo técnico "release" permanece apenas em código/API/banco)

### Regra 5 — Aplicativo Sem Erros (APK)
- **Proibido deixar erros de TypeScript, código quebrado, imports mortos, arquivos órfãos ou pastas vazias** no projeto
- Antes de concluir qualquer alteração: `npx tsc --noEmit` limpo nas duas camadas (backend e mobile)
- **Nenhum tipo de suposição**: fatos devem ser verificados com saída real de comandos/APIs
- O endereço do servidor **nunca** deve ser fixado em código para produção — usar a configuração em Ajustes (seção "Servidor da API")
- O aplicativo deve abrir normalmente **sem internet** (modo offline com aviso claro)

### Regra 6 — Todos os Formatos de Música
- O projeto deve buscar músicas em **todos os formatos**: mp3, flac, CD, DVD, Maxi Single, Mix, Remix, Bootleg etc. — em todos os lugares do mundo, pela internet
- O catálogo `release_types` cobre os formatos de lançamento, mixagens, instrumentais e playbacks (99 tipos, incluindo CD e DVD)
- O mapeamento Discogs (`discogsAdapter.ts`) usa `PRIORIDADE_FORMATOS` (lista ordenada) para classificar formatos como Maxi Single, DVD, Single, EP etc.; qualidade no banco representa o suporte (Vinyl, CD, Digital, DVD...)
- Nenhum formato de versão existente no mundo real deve ser ignorado na busca ou no catálogo

### Regra 7 — Só Exibir Versões que Têm Áudio
- "Caso encontre uma música que não possua o áudio, elimine a busca e não mostre no aplicativo"
- `GET /api/search` devolve apenas versões com `audio_source_url` preenchida; as demais entram em fila de resolução em segundo plano e aparecem nas próximas consultas. A resposta traz `pendentes_audio` (versões aguardando resolução).
- A fila resolve **até 3 versões em paralelo** com intervalo de 8s por trabalhador, as versões do termo recém-buscado entram na frente e são deduplicadas; ao terminar a ingestão em segundo plano, o controller reconsulta as pendentes do termo e as enfileira, para que as faixas recém-catalogadas não esperem a próxima busca.
- **A tela se atualiza sozinha** enquanto houver `pendentes_audio > 0`: a cada 10s o aplicativo chama `GET /api/search?q=...&leve=1`, que responde só com o banco local e **não** dispara ingestão (sem isso, o rate limit do MusicBrainz/Discogs estouraria). O automatismo para ao resolver tudo, ao paginar, ao trocar o termo ou após 24 tentativas; o orçamento é por termo e se renova a cada queda real de pendentes. Um número de sequência descarta respostas atrasadas para nunca sobrescrever uma busca nova.
- **A atualização automática é isenta do limite geral** — `leve=1` não dispara ingestão nem escreve nada (duas consultas ao banco), mas era contada no limite de 100 requisições/15 min e bloqueava o próprio aplicativo depois de poucas buscas. O `skip` do `express-rate-limit` (`backend/src/app.ts`) libera somente `GET /api/search?leve=1`; as buscas normais, com ingestão, continuam limitadas.
- O filtro de áudio da busca é aplicado **no SQL, antes do LIMIT/OFFSET** — filtrar depois da paginação escondia versões com áudio que caíam além da primeira página (a busca por "daft punk" devolvia 0 resultados com uma versão pronta no banco). O `total` da resposta é a contagem de versões com áudio; `pendentes_audio` é a contagem das que ainda não têm.
- Mesma regra em `GET /api/releases/by-date`, `GET /api/works/:id/releases` e `GET /api/works/by-decade/:decade` (obras só aparecem se tiverem ao menos uma versão com áudio)
- As versões sem áudio continuam no banco (Regra 2 intacta nos dados); o filtro é de EXIBIÇÃO
- A identidade de um candidato de áudio vem do PRÓPRIO arquivo (nome do arquivo → texto do link → título da página, este último só com um único link de áudio na página). Nunca herdar identidade da página com vários áudios (players globais tocariam a música errada)
- A contagem por década usa `ANO_EFETIVO_SQL` (`backend/src/utils/urls.ts`): quando a obra não tem `original_release_year`, vale o menor ano de lançamento das suas versões. Sem essa segunda fonte, as obras sem ano próprio sumiam das listas por década e a tela parecia vazia

### Regra 8 — Nomes Oficiais de Músicas, Artistas e Bandas
- "O aplicativo mostra cada música, artista e banda pelo nome oficial, como os estúdios de gravação publicaram. **Não é permitido abreviar, escrever errado nem inventar nome — é regra.**"
- O nome chega ao banco exatamente como a fonte oficial (MusicBrainz/Discogs) o publica: mesma grafia, acentos, maiúsculas e minúsculas e sinais (`AC/DC`, `deadmau5`, `Björk`, `Guns N' Roses`). O único ajuste permitido é remover espaços em branco sobrando.
- **O tipo de lançamento nunca entra no nome.** `version_name` é o título oficial da faixa; "Compilation", "Live", "Remix", "Promo", "Remastered" ficam em `release_type` (Regra 6) — nunca colados como "(Compilation)". Antes da regra, **1.700 das 4.868 versões** do banco carregavam esse sufixo inventado (ex.: "Daft Punk (Compilation)"); **1.698 foram reparadas** em 23/10/2026 (o nome voltou a ser o título da obra, inclusive nas 59 que tinham áudio) e as **2 restantes** são nomes oficiais que realmente terminam em "(Remix)". Nenhuma linha foi apagada, e os valores anteriores ficaram registrados fora do repositório.
- `backend/src/services/sources/nomesOficiais.ts` é o único módulo autorizado a tocar em nome vindo de fora (`limparNomeOficial`, `nomeOficialOuNulo`). Os adapters passam por ele e `searchOrchestrator.ts` tem a última barreira: registro sem artista, título ou versão não é gravado.
- **O aplicativo não transforma o nome**: nada de caixa alta forçada em nome de artista ou música (transformaria `deadmau5` em `DEADMAU5`). Caixa alta fica reservada para rótulos de interface e etiquetas.
- Em gravações com vários créditos, o catálogo mantém o **artista principal** do crédito oficial como entidade da tabela `artists`; não funde "feat." em um nome composto para não criar um artista que não existe. O nome completo segue disponível na fonte oficial referenciada pela versão.
- O `label` do Discogs perde o numeral de desambiguação do próprio catálogo ("Virgin (2)" → "Virgin"), que não faz parte do nome oficial da gravadora.
- Nenhuma limpeza de dados legados é feita sem autorização do dono; a correção vale para tudo que for ingerido a partir de agora.

## Schema do Banco de Dados

O schema é definitivo e não deve ser alterado sem justificativa técnica documentada.

### Tabelas Principais
- **artists** - Artistas/bandas
- **works** - Obras musicais (conceituais)
- **releases** - Versões/lançamentos específicos (cada linha = uma versão)
- **release_types** - Catálogo fixo de tipos (categoria: release_format, mix_edit, instrumental, playback)
- **metadata_sources** - Fontes de metadados

### Relacionamentos
- works → artists (N:1)
- releases → works (N:1)
- releases → release_types (N:1)
- releases → metadata_sources (N:1)

## Arquitetura da API

### Endpoints Obrigatórios
- `GET /api/search?q={termo}` - **único endpoint que o app mobile chama para busca.** Internamente, consulta primeiro o banco local; se não houver resultado local, ou os dados existentes estiverem além do TTL de `external_api_cache`, o próprio endpoint dispara a ingestão das fontes externas através do orquestrador antes de responder. Responde apenas com versões que têm áudio (Regra 7): `results` filtrado por `audio_source_url`, campo `pendentes_audio` com a contagem das que aguardam, e fila de resolução em segundo plano para descobrir a fonte delas em sites abertos. Com `leve=1`, responde somente do banco local (sem ingestão) — é o caminho da atualização automática da tela.
- `POST /api/search/ingest` - endpoint administrativo/interno, fora do fluxo normal do app. Serve apenas para forçar resincronização manual de um termo (script de manutenção, painel administrativo futuro). Documentado como "uso interno apenas" até existir camada de autenticação.
- `GET /api/works/:id` - Detalhes de obra específica
- `GET /api/works/:id/releases` - Lista versões de uma obra (somente as que têm áudio — Regra 7)
- `GET /api/works/by-decade/:decade` - Obras de uma década (somente obras com ao menos uma versão com áudio — Regra 7)
- `GET /api/releases/:id` - Detalhes de release específico
- `GET /api/releases/by-date` - Versões recentes (somente as que têm áudio — Regra 7)
- `GET /api/release-types` - Lista catálogo de tipos
- `GET /api/releases/:id/stream` - Stream de áudio completo (proxy da fonte web aberta, com suporte a Range). Única fonte de playback do app (Regra 3)
- `GET /api/releases/:id/download?format=mp3|flac` - Download do arquivo de áudio gerado a partir da fonte web aberta (pipeline: cache → dedup → fetch → ffprobe → conversão condicional → validação)
- `POST /api/releases/:id/audio-source` - Registra manualmente uma fonte aberta (`{ "url": "..." }`), sempre validada pelo guard da Regra 3
- `POST /api/recognize` - Reconhece a música que está tocando a partir de uma amostra de áudio enviada pelo aplicativo (`{ "audio_base64": "..." }`). É o único fluxo que **não** devolve áudio: devolve a identificação. A credencial do provedor fica somente no backend.
- `GET /api/app/versao` - Versão do aplicativo que o servidor está publicando, usada pela busca de atualização do app (`versao`, `url`, `notas`, `obrigatoria`)

### Formato de Resposta
Todas as respostas devem preservar:
- `version_name` - Nome da versão
- `album_name` - Nome do álbum
- `release_year` - Ano de lançamento
- `label` - Gravadora
- `country` - País
- `release_type` - Tipo de lançamento
- `quality` - Qualidade do áudio
- `cover_url` - URL da capa (ou null se não disponível)
- `metadata_source` - Fonte dos metadados

### Resposta de Erro
```json
{
  "success": false,
  "error": "mensagem de erro",
  "message": "detalhes adicionais (opcional)"
}
```

## Padrões de Código

### Comentários
- Todo código deve incluir comentários em **português brasileiro**
- Comentários devem ser humanizados, explicando o propósito de forma clara
- Manter organização e objetividade

### Organização
- Separar responsabilidades entre camadas
- Manter consistência de nomenclatura
- Seguir convenções TypeScript e React Native

## Decisões Técnicas

### Autonomia do Agente
Para decisões técnicas não cobertas neste documento:
- Escolha a opção mais simples e convencional dentro da stack permitida
- Documente a escolha neste arquivo (AGENTS.md)
- Não interrompa o progresso para perguntar

### Exceções que Requerem Confirmação Humana
1. **Mudança na porta 3307 do MariaDB** - Nunca alterar sem autorização explícita
2. **Flexibilização das Regras 1, 2, 3, 4, 5, 6 ou 7** - Nunca flexibilizar sem autorização explícita

### Avisos e modais globais
- O aviso (`ToastNotificacao`) e o modal (`ModalPersonalizado`) são montados por `mobile/src/components/ModalGlobalContainer.tsx`, que fica na raiz do `ModalProvider`
- A camada do contêiner global usa `StyleSheet.absoluteFill`: o aviso é posicionado de forma absoluta e, sem uma referência de altura real, saía desenhado fora da janela (altura zero, colada no rodapé da coluna)
- O aviso respeita a área segura com `useSafeAreaInsets()` (`top: insets.top + 10`), mostra a barra de tempo restante e some sozinho depois da duração informada pelo `ModalContext`
- O modal usa o componente `Modal` do React Native (portal próprio) e continua centralizado, independente da camada do aviso

### Fluxo de Downloads (inspirado no deemix, sem plataformas)
- A experiência de busca, escolha de qualidade e fila segue a lógica de gerenciadores como o deemix, mas **o áudio continua vindo exclusivamente de sites abertos** (Regra 3). O Deezer e qualquer outra plataforma de música não são integrados nem consultados
- Qualidade padrão persistida em `@musicgalaxy:qualidadeDownload`: MP3 320 kbps ou FLAC sem perdas, escolhida em Ajustes e aplicada ao botão rápido de cada versão (`downloadRelease.ts`)
- Cada versão tem download rápido com progresso no próprio cartão; a fila sobrevive ao fechamento do app (`@musicgalaxy:filaDownloads`) e fica disponível em Ajustes → Fila de downloads
- A tela `FilaDownloadsScreen` permite filtrar (todos, baixando, concluídos, com erro), cancelar, tentar novamente, remover e limpar em lote
- Todo arquivo é gerado pelo backend em `/api/releases/:id/download?format=mp3|flac` a partir de `audio_source_url`, passando pelo guard `auditarUrl()`

### Biblioteca local e reprodução offline
- Favoritos (`@MusicGalaxy:favoritos`), playlists (`@MusicGalaxy:playlists`), buscas (`@MusicGalaxy:historico`) e reproduções (`@MusicGalaxy:historicoReproducao`) vivem no AsyncStorage do aparelho; nenhum desses dados é enviado ao backend
- Playlists preservam a ordem de inserção, recusam nome vazio ou repetido e nunca duplicam a mesma versão; excluir playlist ou remover versão não apaga arquivo baixado nem favorito
- Histórico de reproduções tem limite de 50 versões, sem repetição, e só é gravado quando o áudio realmente começa (`onReproduzir` do `PlayerControls`)
- `downloadManager.obterArquivoLocal(releaseId)` só devolve um caminho `file://` de download concluído cujo arquivo ainda existe; na web retorna `null` e o player usa o stream
- O `PlayerControls` prefere o arquivo local, mas volta ao stream com `toastInfo` se o arquivo falhar — nunca esconde a origem real do áudio
- A tela `TelaBiblioteca` concentra as quatro abas (Resumo, Favoritos, Playlists, Histórico); não criar outra tela de biblioteca para as mesmas funções

## Comandos de Desenvolvimento

### Frontend (Mobile)
```bash
cd mobile
npm install
npm start
```

### Backend (API)
```bash
cd backend
npm install
cp .env.example .env
npm run dev
```

### Banco de Dados
```bash
# Via phpMyAdmin: http://localhost/phpmyadmin
# Ou linha de comando (schema inclui seeds automaticamente):
mysql -u root -p -P 3307 musicgalaxy < database/schema.sql
```

### Build do APK (EAS)
```bash
cd mobile
npx eas-cli login            # uma vez, com conta Expo
npx eas-cli build --platform android --profile preview
```
- O `eas.json` gera **APK** (`buildType: "apk"`) nos três perfis (development, preview, production)
- O backend não está embutido no APK: o usuário informa o endereço na tela de Ajustes (seção "Servidor da API"), salvo no aparelho
- Ícone do app: `mobile/assets/icon.png` (fundo transparente, canal alfa real)
- **Sem conta Expo, o APK de release pode ser gerado localmente com Gradle** — o Java não consegue gravar dentro da árvore do projeto (o caminho do perfil do Windows tem acento), então a compilação roda fora do repositório: código sincronizado em `C:/Users/Public/mgbuild/mobile`, `GRADLE_USER_HOME=C:/Users/Public/mg-gradle`, SDK espelhado em `C:/Users/Public/mg-sdk`, temporários em `C:/Users/Public/mg-tmp` e JDK 21. O release sai assinado com o keystore de depuração (instala sem recusa em aparelho de teste) em `C:/Users/Public/mgbuild/mobile/android/app/build/outputs/apk/release/app-release.apk`; a assinatura de produção continua sendo do dono, via EAS
- **Níveis de API do Android — somente 2025 em diante** — o aplicativo é distribuído **apenas** para os Androids lançados em 2025 ou depois, ou seja, a partir do **Android 16 (nível de API 36)**. Isso é fixado em `mobile/app.json` pelo plugin `expo-build-properties` (`minSdkVersion`, `compileSdkVersion` e `targetSdkVersion` = 36): o plugin escreve `android.minSdkVersion=36` em `android/gradle.properties`, e é de lá que o plugin `expo-root-project` do Expo lê o valor aplicado em `app/build.gradle`. Em Androids anteriores, é o próprio instalador do sistema que recusa o APK — o aplicativo não roda em 2024 ou antes. O `expo-build-properties` entrou porque **é preciso mudar um nível** (a regra do próprio AGENTS.md previa isso); versão `57.0.22`, publicada em 24/09/2026, par com o SDK 57 e peer `expo: *`
- **`android.versionCode` precisa subir a cada publicação** — `mobile/app.json` traz `versionCode: 1` e `version: 1.0.0`. Publicar uma versão nova exige **aumentar os dois** (por exemplo, `1.0.1` com `versionCode: 2`): com o mesmo `versionCode`, o Android recusa a instalação da atualização por ser da mesma versão
- **Verificação em execução** — `mobile/src/services/compatibilidade.ts` lê o nível de API do aparelho (`Platform.Version`) e `mobile/src/screens/TelaCompatibilidade.tsx` substitui o aplicativo por uma tela explicativa quando o aparelho é anterior ao mínimo, com o caminho para atualizar o Android e o botão de buscar a versão mais nova pela internet. No navegador e no iOS nada muda
- O projeto nativo (`mobile/android/`) é **gerado** por `npx expo prebuild` e não é versionado; `local.properties` guarda o caminho do SDK da máquina e nunca deve ser commitado

## Integração com Fontes Externas

### Fontes de Dados
- **MusicBrainz** - Banco de dados aberto de metadados musicais
- **Cover Art Archive** - Capas oficiais associadas ao MusicBrainz
- **Discogs** - Catálogo com detalhes de formatos físicos e variações
- **Internet Archive** - Acervo aberto com áudio; descoberta via APIs públicas do archive.org, sem chave e sem login (Regra 3)
- **AudD** - Serviço de identificação de música por áudio (reconhecimento sonoro). Exige credencial de desenvolvedor; a chave fica **apenas** no backend

### Estrutura de Integração
```
backend/src/services/
├── sources/
│   ├── types.ts
│   ├── nomesOficiais.ts         # Regra 8 — nomes oficiais, sem sufixo inventado
│   ├── musicBrainzAdapter.ts
│   └── discogsAdapter.ts
├── audioSource/
│   ├── webAudio.ts               # guard anti-SSRF + lista negra (Regra 3)
│   ├── sourceOrchestrator.ts     # busca em paralelo, exact match, ranking
│   ├── exactMatchEngine.ts
│   ├── sourceRanker.ts
│   └── providers/
│       ├── internetArchiveProvider.ts
│       ├── genericWebProvider.ts
│       └── directLinkProvider.ts
├── cache/
│   └── externalApiCache.ts
├── covers/
│   └── coverResolver.ts          # Regra 1 — capa oficial (CAA/Discogs) em segundo plano
├── rateLimiting/
│   └── rateLimiter.ts
├── recognition/
│   ├── types.ts                # contrato normalizado + status possíveis
│   ├── audioPayload.ts          # validação da amostra (base64, formato, tamanho)
│   ├── recognitionService.ts    # escolhe o provedor e traduz erros
│   └── auddProvider.ts          # adaptador do AudD (credencial no backend)
└── ingestion/
    ├── searchOrchestrator.ts
    └── ingestionLogger.ts
```

O lado do aplicativo do reconhecimento sonoro:
```
mobile/src/
├── hooks/useReconhecimentoSonoro.ts      # captura, contagem, cancelamento, limpeza
├── components/PainelReconhecimento.tsx   # painel de estado e resultado
└── services/
    ├── reconhecimento.ts                  # transporte (POST /api/recognize)
    └── reconhecimentoContrato.ts         # contrato puro (status, mensagens, termo de busca)
mobile/tests/reconhecimento.test.ts       # testes do contrato puro (node:test)
```

### Catálogo do MusicBrainz — busca por artista e por gravação
- **Nome de artista primeiro** — `buscarPorTermo` começa tentando reconhecer o termo como artista (`/artist?query=artist:"term"`), com igualdade de nome normalizado (sem acentos, sem pontuação) e pontuação ≥ 95; falhar nesse ramo não impede a busca por gravação.
- **Piso de catálogo** — só é aceito artista com **≥ 20 releases** no MusicBrainz (`release-count`). Sem esse piso, uma banda de mesmo nome que a música (por exemplo "One More Time", 8 releases) sequestrava o termo no lugar do Daft Punk (556).
- **Discografia com faixas** — `/release?artist={MBID}&inc=recordings+artist-credits+labels+release-groups&limit=50&type=album|single|ep`, no máximo **10 discos**, dos mais antigos para os mais novos.
- **Prensagens agrupadas** — os discos são deduplicados por `release-group.id` (CD, vinil, remaster do mesmo álbum contam uma vez) e fica a data mais antiga.
- **Uma obra por faixa** — cada faixa vira uma obra (`work`), com o ano de `recording.first-release-date` quando existe e o ano do disco quando não. O artista da obra é sempre o artista pesquisado, não o crédito da faixa (que fragmentava o catálogo em "ABBA (Björn, Benny, Agnetha & Frida)" e afins).
- **Nome oficial, sem sufixo (Regra 8)** — `version_name` e `work_title` recebem o título oficial da faixa; `album_name` recebe o título oficial do disco. "Compilation", "Live", "Remix" e demais tipos secundários vão para `release_type`, nunca para o nome — o código que colava `(Compilation)` foi removido.
- **Identidade única da versão** — `external_id` = `release:faixa:recording`, então o mesmo disco em outra prensagem não duplica versões; `quality` representa o suporte (`media[].format` → Vinyl/CD/Digital…) e `source_reference_url` aponta para o release no MusicBrainz.
- **Faixas sem música descartadas** — títulos como `[unknown]`, `[untitled]`, `[silence]`, `[data track]` e `[video]` não entram no catálogo.
- **Busca por gravação continua sendo o caminho 2** — para nome de música ou termo livre, cada palavra com 2+ letras vira um grupo `(recording OR artist OR release)` combinado por AND. A API não oferece ordenação por popularidade, então a qualidade dos resultados depende do catálogo por artista descrito acima.
- **Verificação real desta rodada (2026-10-23)** — "the beatles" saiu de **0** para **7 versões com áudio** (148 pendentes), "adele" **7**, "coldplay" **11**, "metallica" **2**; as obras criadas por essas buscas somam **190** (`id > 3800`).

### Ingestão — uma por termo e gravação serializada
- **Uma ingestão por termo** — `ingerirPorTermo()` guarda a execução em curso num mapa por termo normalizado; quem chega enquanto ela roda (duplo toque, duas abas, paginação) espera e recebe **o mesmo resultado**, em vez de abrir outra consulta ao MusicBrainz e ao Discogs. Sem a trava, o mesmo termo era buscado em paralelo e a gravação duplicava trabalho.
- **Gravação uma de cada vez** — artista e obra são criados com "SELECT e depois INSERT" e as tabelas não têm índice único em nome/título; duas ingestões de termos diferentes podiam passar pelo mesmo teste ao mesmo tempo e criar linhas repetidas. `gravarComExclusividade()` faz a persistência rodar em série — o custo é baixo porque a espera real está nas fontes externas.
- **Evidência (2026-10-23)** — três `POST /api/search/ingest` para "portishead", dois disparados juntos e um 2 s depois, responderam em **3 s** com os mesmos números (**37 obras, 115 versões**); o banco ficou com **115 releases e 115 `external_id` distintos** e **um único** artista "Portishead" (`id` 3323).

### Descoberta de Áudio em Sites Abertos
- `SourceOrchestrator` consulta os provedores em paralelo e só aceita candidato com classificação `EXACT_MATCH` (pontuação ≥ 90 no `ExactMatchEngine`).
- `InternetArchiveProvider` usa três consultas Lucene progressivas no `advancedsearch.php` (artista+título, artista+título restrito ao creator, artista), com parada antecipada quando já há fonte forte; metadados têm cache em memória de 30 min (100 itens) e o orçamento total da busca é de 28s.
- O arquivo entregue é sempre validado pelo guard `auditarUrl()` antes de qualquer requisição; o download passa por `HEAD`/`Range` e o stream suporta `206 Partial Content`.
- Validação real (2026-10-23) da release 40 (Daft Punk — One More Time): descoberta em 1,6s, stream `206` com `Content-Range: bytes 0-2047/12817079`, download MP3 de 12.817.079 bytes (assinatura ID3) e cache-hit em 0,39s. O primeiro download direto do archive.org levou ~115s (≈111 KB/s); é latência da fonte, não do pipeline.
- Instrumental/remix/live só são usados quando a própria release pede essa versão; lançamentos originais nunca recebem um áudio alternativo.

### Reconhecimento Sonoro (identificar a música que está tocando)
- **Fluxo** — o botão de microfone no campo de busca (`mobile/src/screens/BuscaScreen.tsx`) aciona `mobile/src/hooks/useReconhecimentoSonoro.ts`, que grava alguns segundos com `expo-audio`, apaga o arquivo de origem e envia a amostra em base64 para `POST /api/recognize`. O resultado aparece em `mobile/src/components/PainelReconhecimento.tsx`, que oferece "Pesquisar no Music Galaxy" — a busca normal do aplicativo, sem caminho paralelo de áudio.
- **Contrato** — status possíveis: `matched`, `no_match`, `permission_denied`, `microphone_unavailable`, `network_error`, `provider_error`, `invalid_request`, `cancelled`. O campo `confidence` só aparece quando o provedor entrega uma medida documentada; nenhum metadado é inventado pelo Music Galaxy.
- **Amostra inválida não é serviço indisponível** — campo ausente, base64 corrompido ou formato não aceito respondem **400** com `data.status = "invalid_request"`; o painel mostra "Amostra de áudio inválida" e não "Serviço indisponível". Antes os dois casos chegavam como `provider_error` e a mensagem culpava o provedor por um pedido fora do contrato. Falha real do provedor (5xx, 429) continua `provider_error`.
- **Limites da amostra** — base64 de 1 KB a 2 MB, áudio de 2 a 30 segundos, formatos `mp3`, `m4a`, `wav`, `flac`, `ogg`, `webm`, `aac`. A duração é lida do próprio arquivo (`backend/src/services/recognition/duracaoAmostra.ts`): WAV, FLAC e M4A têm leitura exata; MP3 é aproximada; formatos sem duração no cabeçalho (OGG, WebM) usam a janela tolerante de 2 a 45 segundos e nunca são recusados só por estimativa. Amostra inválida é recusada com mensagem em português, e a validação do pedido vem antes da checagem de credencial do provedor.
- **Privacidade** — a credencial do provedor fica somente no `backend/.env`; ela nunca vai para o aplicativo, para o APK, para o código nativo ou para log. A gravação é temporária, apagada logo após a análise e não é gravada no banco.
- **O destino da amostra é informado ao usuário** — a tecnologia escolhida (API externa) exige o envio do áudio: o trecho sai do aparelho, vai ao servidor do Music Galaxy e dali ao serviço de reconhecimento. Isso está escrito no painel (durante a captura), no manual do aplicativo e na permissão de microfone do sistema (`microphonePermission` do plugin `expo-audio`). Nada é gravado, nem no aparelho depois da análise, nem no MariaDB, nem em log.
- **Situações diferenciadas na interface** — o aplicativo produz o status normalizado de cada falha (permissão negada, microfone indisponível, sem conexão, serviço indisponível, cancelamento) e o painel mostra um título específico para cada uma, sempre lembrando que a busca por texto continua funcionando. O contrato puro vive em `mobile/src/services/reconhecimentoContrato.ts`, testado fora do aparelho (`mobile/tests`).
- **Uma tentativa por vez e cancelamento com desfecho** — tocar no microfone durante uma identificação cancela a anterior (o travamento de reentrada vale da preparação até o fim do envio, e a requisição em voo é abortada). Cancelar durante a contagem, a gravação ou o envio mostra "Identificação cancelada"; depois do desfecho, o botão "Fechar" apenas dispensa o painel (`limparResultado`). Cada tentativa tem um número de geração: contagem, gravação e resposta atrasadas de uma tentativa cancelada são descartadas. O painel e o hook nunca deixam o microfone ativo ao sair da tela, ao ir para segundo plano ou ao cancelar.
- **Faixa fora do catálogo** — quando a busca vem de uma faixa reconhecida e o catálogo não devolve versões, a tela mostra "Essa faixa ainda não está no catálogo" em vez de um "nada encontrado" genérico; histórico, filtros e busca por texto não são apagados.
- **Sem credencial** — sem `AUDD_TOKEN` a rota responde 503 com mensagem de serviço não configurado e o aplicativo explica isso ao usuário; a busca por texto continua funcionando normalmente.
- **Fora do escopo da Regra 3** — o reconhecimento identifica a obra, mas **não** fornece áudio: as versões exibidas continuam vindo do catálogo e sendo filtradas por `audio_source_url` (Regra 7). Identificar uma música nunca autoriza obter, baixar ou reproduzir áudio de plataforma proibida.

### Decisão de tecnologia do reconhecimento (AudD × ShazamKit × ACRCloud)
Comparação feita em 23/10/2026 contra a documentação oficial de cada fornecedor. O que está **verificado** nesta rodada:

| Critério | AudD (escolhido) | ShazamKit (Apple) | ACRCloud |
|---|---|---|---|
| Integração | API HTTP pelo backend Node.js | SDK Android em AAR + token de desenvolvedor | API HTTP (ou SDK) |
| Credencial | `api_token` no corpo do formulário | Token de desenvolvedor da conta Apple (Media Identifier + chave privada) | Chave e segredo de assinatura |
| Depósito do SDK | — | Arquivo `shazamkit-android-release.aar` baixado à mão, colocado em `libs/`, com `flatDir` no Gradle | — |
| Dependências nativas | nenhuma | `kotlinx-coroutines`, `okhttp`, `retrofit` + módulo nativo em Kotlin | nenhuma |
| Áudio de entrada | arquivo (mp3, m4a, wav, flac, ogg, webm, aac) | PCM 16 bits mono, 48/44,1/32/16 kHz | arquivo ou *fingerprint* |
| Internet | sim | sim, para consultar o catálogo | sim |
| Custo | teste de 300 requisições; planos a partir de US$ 5/mês (1.000 requisições) | conta de desenvolvedor Apple | cotação a consultar |
| Linha de base do projeto | já atendida (minSdk 36) | o SDK exige API 21, abaixo da linha do projeto | a avaliar |

- **Por que AudD agora** — o fluxo já é nativo do backend Node.js existente, não exige módulo nativo em Kotlin nem AAR baixado à mão, não exige conta de desenvolvedor Apple para funcionar, mantém a credencial só no servidor e a taxa é previsível. Trocar de provedor continua possível: `criarProvedor()` (`backend/src/services/recognition/recognitionService.ts`) escolhe o adaptador por `RECOGNITION_PROVIDER`.
- **ShazamKit fica registrado como alternativa** — exigiria AAR manual, token de desenvolvedor e um módulo nativo em Kotlin dentro de um projeto que hoje não tem módulo nativo e não aceita dependência nativa nova sem autorização do dono. **A prova de conceito lado a lado não foi executada** (classificada como **NÃO VERIFICADO**): depende de conta de desenvolvedor Apple e da comparação de taxa de acerto com as mesmas amostras.
- **ACRCloud não foi descartada** — é a alternativa mais próxima em modelo (API com assinatura). A documentação de referência não entregou conteúdo textual verificável na consulta desta rodada, então preço, limite de amostra e latência estão **NÃO VERIFICADOS**.
- **Linha de base do Android** — a especificação técnica pede "Android 15 (API 35) e posteriores"; o projeto exige **somente 2025 em diante**, ou seja, Android 16 (API 36). A regra do projeto é mais restritiva e continua valendo: baixar o `minSdkVersion` para 35 autorizaria a instalação em aparelhos de 2024, contrariando o pedido do dono. A divergência fica registrada, não "corrigida" por conta própria.
- **iOS** — permanece no escopo. A permissão de microfone é declarada pelo plugin `expo-audio` (`NSMicrophoneUsageDescription`), com o mesmo texto do Android. A versão mínima de iOS segue a do React Native 0.86 (iOS 15.1+); **o reconhecimento em iPhone físico continua NÃO VERIFICADO**, porque não há aparelho iOS nesta máquina.

### Configuração
Adicionar ao `backend/.env`:
```env
MUSICBRAINZ_USER_AGENT=MusicGalaxy/1.0 (contato: seu-email@exemplo.com)
DISCOGS_TOKEN=seu_token_pessoal_discogs
DISCOGS_USER_AGENT=MusicGalaxy/1.0

# Reconhecimento sonoro (POST /api/recognize)
RECOGNITION_PROVIDER=audd
AUDD_TOKEN=seu_token_de_desenvolvedor_audd
RECOGNITION_RATE_LIMIT_WINDOW_MS=900000
RECOGNITION_RATE_LIMIT_MAX_REQUESTS=20

# Publicação de versão do aplicativo (GET /api/app/versao)
APP_VERSAO_PUBLICADA=1.0.0
APP_URL_DOWNLOAD=https://github.com/claytonmarcelo/Music-Galaxy/releases/latest
APP_NOTAS_ATUALIZACAO=
APP_ATUALIZACAO_OBRIGATORIA=false
```
O Internet Archive não exige chave nem configuração adicional.

### Busca de Atualização do Aplicativo
- **O servidor publica, o aplicativo confere** — `backend/src/services/appVersion.ts` lê o ambiente e devolve a versão em `GET /api/app/versao`. Publicar uma versão nova é editar o `.env`: nem o backend nem o aplicativo precisam ser recompilados.
- **Comparação numérica** — `mobile/src/services/versao.ts` compara as partes numéricas (`1.10` é mais nova que `1.9`; `1.2` vale o mesmo que `1.2.0`). Versão não numérica é ignorada: o aplicativo nunca afirma estar desatualizado sem prova.
- **Dois gatilhos** — checagem automática 2,5 s depois de abrir (`AppNavigator`) e busca manual em Ajustes → Sobre → "Procurar atualizações". A trava `emAndamento` impede requisições repetidas.
- **Aviso honesto** — sem resposta do servidor, nada é inventado: a checagem automática fica em silêncio e a manual explica que não foi possível procurar.
- **Segurança do link** — o servidor só aceita endereço `http`/`https`; versão fora do formato `1`, `1.2` ou `1.2.3` cai no padrão. O aplicativo abre o endereço publicado com `Linking.openURL`.
- **Sem perda de dados** — o APK novo é instalado por cima; favoritos, playlists, histórico e downloads ficam no aparelho.
- **Sem dependência nova** — a versão instalada é a constante `VERSAO_APLICATIVO` (`mobile/src/services/versao.ts`), mantida em sincronia com `version` do `mobile/package.json` e com `APP_VERSAO_PUBLICADA`.

### Rate Limiting
- MusicBrainz: 1 requisição por segundo
- Discogs: 60 requisições por minuto (autenticado)
- Reconhecimento sonoro: 20 tentativas por janela de 15 minutos (`RECOGNITION_RATE_LIMIT_*`)

## Verificação

### TypeScript
```bash
# Backend
cd backend
npx tsc --noEmit

# Mobile
cd mobile
npx tsc --noEmit
```

### Testes automatizados
```bash
# Toda a suíte (backend unitário + backend API + contrato do aplicativo)
npm run test:all

# Separados
npm run test        # backend, testes unitários
npm run test:api    # backend, testes de integração contra o app Express
npm run test:mobile # aplicativo, contrato do reconhecimento (node:test, sem emulador)
```
- O aplicativo não tem runner de testes de interface: o que é testado sem aparelho é o **contrato puro** (`mobile/src/services/reconhecimentoContrato.ts`), compilado pelo `mobile/tests/tsconfig.json` e executado com o `node --test` do próprio Node — nenhuma dependência nova.
- `mobile/tsconfig.json` exclui `tests/` e `dist-tests/`: o `tsc --noEmit` do aplicativo continua verificando só o código do app, e os testes têm a própria checagem (`npx tsc -p tests/tsconfig.json --noEmit`).

### Funcional
- Testar endpoints da API via curl ou Postman
- Testar interface mobile via Expo
- Verificar conexão com banco de dados

## Troubleshooting Comum

### Erro de Conexão MariaDB
- Verificar se WampServer64 está rodando
- Confirmar porta 3307 em backend/.env
- Verificar se banco musicgalaxy existe

### Erros de TypeScript
- Verificar tipos em backend/src/types e mobile/src/types
- Garantir consistência entre backend e frontend
- Usar npx tsc --noEmit para verificar

### Dependências
- Sempre usar versões publicadas há pelo menos 7 dias
- Evitar ranges flutuantes (latest, *, unbounded >=)
- Verificar compatibilidade com Expo SDK 57

## Integrações Futuras

Quando implementar integrações com APIs externas:
1. Discogs API - Para metadados de músicas
2. MusicBrainz API - Para dados complementares
3. Sistema de sincronização - Para manter banco atualizado

## Notas Importantes

- A porta 3307 é definitiva para este ambiente
- O schema do banco não deve ser alterado sem documentação
- As regras de capa oficial e busca completa são permanentes
- Todo código deve ser em português brasileiro (comentários)
- Manter consistência entre mobile, backend e database
