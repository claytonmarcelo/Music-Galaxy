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
- `GET /api/search` devolve apenas versões com `audio_source_url` preenchida; as demais entram em fila de resolução em segundo plano (8s de intervalo) e aparecem nas próximas buscas. A resposta traz `pendentes_audio` (versões aguardando resolução).
- O filtro de áudio da busca é aplicado **no SQL, antes do LIMIT/OFFSET** — filtrar depois da paginação escondia versões com áudio que caíam além da primeira página (a busca por "daft punk" devolvia 0 resultados com uma versão pronta no banco). O `total` da resposta é a contagem de versões com áudio; `pendentes_audio` é a contagem das que ainda não têm.
- Mesma regra em `GET /api/releases/by-date`, `GET /api/works/:id/releases` e `GET /api/works/by-decade/:decade` (obras só aparecem se tiverem ao menos uma versão com áudio)
- As versões sem áudio continuam no banco (Regra 2 intacta nos dados); o filtro é de EXIBIÇÃO
- A identidade de um candidato de áudio vem do PRÓPRIO arquivo (nome do arquivo → texto do link → título da página, este último só com um único link de áudio na página). Nunca herdar identidade da página com vários áudios (players globais tocariam a música errada)

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
- `GET /api/search?q={termo}` - **único endpoint que o app mobile chama para busca.** Internamente, consulta primeiro o banco local; se não houver resultado local, ou os dados existentes estiverem além do TTL de `external_api_cache`, o próprio endpoint dispara a ingestão das fontes externas através do orquestrador antes de responder. Responde apenas com versões que têm áudio (Regra 7): `results` filtrado por `audio_source_url`, campo `pendentes_audio` com a contagem das que aguardam, e fila de resolução em segundo plano para descobrir a fonte delas em sites abertos.
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

## Integração com Fontes Externas

### Fontes de Dados
- **MusicBrainz** - Banco de dados aberto de metadados musicais
- **Cover Art Archive** - Capas oficiais associadas ao MusicBrainz
- **Discogs** - Catálogo com detalhes de formatos físicos e variações
- **Internet Archive** - Acervo aberto com áudio; descoberta via APIs públicas do archive.org, sem chave e sem login (Regra 3)

### Estrutura de Integração
```
backend/src/services/
├── sources/
│   ├── types.ts
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
├── rateLimiting/
│   └── rateLimiter.ts
└── ingestion/
    ├── searchOrchestrator.ts
    └── ingestionLogger.ts
```

### Descoberta de Áudio em Sites Abertos
- `SourceOrchestrator` consulta os provedores em paralelo e só aceita candidato com classificação `EXACT_MATCH` (pontuação ≥ 90 no `ExactMatchEngine`).
- `InternetArchiveProvider` usa três consultas Lucene progressivas no `advancedsearch.php` (artista+título, artista+título restrito ao creator, artista), com parada antecipada quando já há fonte forte; metadados têm cache em memória de 30 min (100 itens) e o orçamento total da busca é de 28s.
- O arquivo entregue é sempre validado pelo guard `auditarUrl()` antes de qualquer requisição; o download passa por `HEAD`/`Range` e o stream suporta `206 Partial Content`.
- Validação real (2026-10-23) da release 40 (Daft Punk — One More Time): descoberta em 1,6s, stream `206` com `Content-Range: bytes 0-2047/12817079`, download MP3 de 12.817.079 bytes (assinatura ID3) e cache-hit em 0,39s. O primeiro download direto do archive.org levou ~115s (≈111 KB/s); é latência da fonte, não do pipeline.
- Instrumental/remix/live só são usados quando a própria release pede essa versão; lançamentos originais nunca recebem um áudio alternativo.

### Configuração
Adicionar ao `backend/.env`:
```env
MUSICBRAINZ_USER_AGENT=MusicGalaxy/1.0 (contato: seu-email@exemplo.com)
DISCOGS_TOKEN=seu_token_pessoal_discogs
DISCOGS_USER_AGENT=MusicGalaxy/1.0
```
O Internet Archive não exige chave nem configuração adicional.

### Rate Limiting
- MusicBrainz: 1 requisição por segundo
- Discogs: 60 requisições por minuto (autenticado)

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
