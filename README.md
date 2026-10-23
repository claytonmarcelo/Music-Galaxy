<h1 align="center">Music Galaxy</h1>

<p align="center">
  <strong>Aplicativo de Busca Musical com Precisão de Dados</strong><br>
  Localize todas as versões existentes de uma obra musical — remixes, edições, formatos de lançamento, instrumentais, playback e muito mais — sem informações inventadas.
</p>

<p align="center">
  <img src="https://img.shields.io/badge/licença-propriet%C3%A1ria-lightgrey" alt="Licença Proprietária">
  <img src="https://img.shields.io/badge/version-1.0.0-blue" alt="Versão">
  <img src="https://img.shields.io/badge/typescript-5.x-3178C6?logo=typescript" alt="TypeScript">
  <img src="https://img.shields.io/badge/node-%3E%3D18-339933?logo=node.js" alt="Node.js">
  <img src="https://img.shields.io/badge/expo-SDK%2057-000020?logo=expo" alt="Expo">
  <img src="https://img.shields.io/badge/express-4.x-000000?logo=express" alt="Express">
  <img src="https://img.shields.io/badge/mariadb-10.x-003545?logo=mariadb" alt="MariaDB">
  <img src="https://img.shields.io/badge/react%20native-0.76-61DAFB?logo=react" alt="React Native">
</p>

---

## Sobre o Projeto

O **Music Galaxy** é um aplicativo de busca musical desenvolvido para DJs, colecionadores, produtores musicais e pesquisadores que precisam localizar versões específicas de uma mesma obra.

### Problema que resolve

Encontrar a versão exata de uma música — um remix específico, uma edição de rádio, uma instrumental, um formato de lançamento raro — costuma exigir consultar várias plataformas diferentes, correndo o risco de encontrar capas incorretas, metadados incompletos ou informações geradas artificialmente.

O Music Galaxy centraliza a busca em fontes de dados confiáveis (MusicBrainz, Cover Art Archive, Discogs e Internet Archive) e em sites abertos da web, aplicando regras rígidas para garantir que nenhuma capa, versão ou fonte de áudio seja inventada, aproximada ou substituída.

### Público-alvo

- DJs e produtores musicais
- Colecionadores de vinil, CD e formatos físicos
- Pesquisadores e catalogadores musicais
- Rádios e casas de show que precisam de versões específicas (radio edit, extended mix, instrumental, playback)

### Benefícios

- **Precisão**: Capas e dados sempre fiéis à fonte original
- **Completude**: Todas as versões de uma obra em um único lugar
- **Confiabilidade**: Integração direta com bancos de dados musicais abertos e reconhecidos
- **Performance**: Cache local em MariaDB reduz chamadas repetidas às APIs externas

---

## Regras de Negócio

### Regra 1 — Capa Oficial da Música

O Music Galaxy exibe exclusivamente a capa oficial correspondente ao resultado da pesquisa, quando disponível na fonte consultada.

- Nunca gerar capas por inteligência artificial
- Nunca criar capas fictícias
- Nunca utilizar capas de outra música, álbum ou artista
- Nunca modificar a arte oficial
- Nunca substituir a capa correta por uma imagem semelhante
- Se a fonte não disponibilizar a capa oficial, o aplicativo não inventa uma

### Regra 2 — Pesquisa Musical Completa

O mecanismo de pesquisa localiza e apresenta todas as versões existentes de uma mesma obra musical, independentemente do formato de lançamento.

**Formatos suportados**: Álbum, Single, EP, Maxi Single, CD Single, Promo, White Label, Coletâneas, Box Set, Deluxe Edition, Remastered, Reissue, Soundtrack, Bootleg (legal), Demo, Live Album, e muitos mais.

**Versões suportadas**: Instrumental, Acapella, Karaoke, Radio Edit, Extended Mix, Club Mix, Remix, Dub Mix, VIP Mix, Rework, Mashup, DJ Version, e muito mais.

---

## Funcionalidades

### Busca Musical
- Endpoint único de busca (`/api/search`) com resposta local ou ingestão automática de fontes externas
- Paginação com limite e offset configuráveis
- Filtro por categoria (formato de lançamento, mix/edição, instrumental, playback)

### Obras e Versões (Works & Releases)
- Cada obra é cadastrada de forma conceitual, independente de suas versões
- Cada release é um registro independente — nenhuma versão substitui outra
- Catálogo fixo com 99 tipos de release (incluindo CD e DVD)

### Capas Oficiais
- Exibição de capa oficial via Cover Art Archive, vinculada ao MusicBrainz
- Nenhuma capa sintética, aproximada ou de placeholder

### Player e Download
- **Áudio exclusivamente de sites abertos** — todo stream e download nasce de uma fonte da web aberta (blogs, fóruns, sites pessoais, links diretos e Internet Archive), sempre validada pelo guard `auditarUrl()` da Regra 3. YouTube, Spotify, Deezer, Apple Music e qualquer plataforma de música são proibidos e não aparecem no código do fluxo.
- **Reprodução pelo backend** — o app chama `GET /api/releases/:id/stream`, que faz proxy da fonte aberta e suporta `Range` (`206 Partial Content`); o player mostra tempo, duração, seek e estado real de erro, sem progresso simulado.
- **Download pelo backend** — `GET /api/releases/:id/download?format=mp3|flac` gera o arquivo a partir de `audio_source_url`.
- **Pipeline de download** — cache → deduplicação → download da fonte → `ffprobe` → conversão condicional → validação → cache → cliente. Arquivos processados ficam em cache por 24 horas; requisições simultâneas da mesma versão compartilham o mesmo processamento.
- **Conversão honesta** — a conversão só acontece quando é necessária: MP3 continua MP3 e FLAC continua FLAC. Um MP3 nunca é convertido e chamado de "FLAC sem perdas"; o app informa a qualidade real sem inventar métricas.
- **Validação antes de entregar** — assinatura do arquivo (FLAC: `fLaC`; MP3: ID3 ou sync bytes), decodificação completa via FFmpeg, MIME type e extensão corretos, limite de tamanho e timeout. Arquivo incompleto nunca é tratado como concluído.
- **Fila persistente no aparelho** — progresso real por versão, cancelamento, nova tentativa, remoção individual e limpeza em lote. A fila sobrevive ao fechamento do app (`@musicgalaxy:filaDownloads`) e downloads interrompidos voltam como recuperáveis.
- **Reprodução offline** — quando existe um download concluído no aparelho e o arquivo ainda está presente, o player usa o caminho `file://` antes do stream; se o arquivo falhar, volta ao servidor com aviso claro. Na web não há caminho local e a reprodução é sempre pelo stream.
- **Preferência de qualidade** — MP3 320 kbps ou FLAC sem perdas, escolhida em Ajustes e persistida em `@musicgalaxy:qualidadeDownload`.
- **Headers de cache** — respostas incluem `X-Cache` (HIT/MISS) para rastreamento de eficiência.

### Descoberta de Áudio em Sites Abertos (Exact Match)
- **Provedores** — `internetArchiveProvider` (APIs públicas do archive.org, sem chave e sem login), `genericWebProvider` (blogs, fóruns e páginas com áudio) e `directLinkProvider` (URLs diretas de arquivos). Nenhum provedor de plataforma de música existe no projeto.
- **Orquestração** — `SourceOrchestrator` consulta os provedores em paralelo, com orçamento total de 28s, e só aceita candidato classificado como `EXACT_MATCH` (pontuação ≥ 90 no `ExactMatchEngine`).
- **Identidade pelo arquivo** — nome do arquivo → metadados ID3 → título da página apenas quando a página tem um único áudio. Uma página com vários players nunca empresta sua identidade a uma faixa.
- **Filtro de versão** — instrumental, remix, live, bootleg e afins só são aceitos quando a própria release pede essa versão; o lançamento original nunca recebe um áudio alternativo por engano.
- **Ranking de fontes** — qualidade (codec, bitrate, sample rate), formato e disponibilidade ordenam os candidatos.
- **Guard anti-SSRF** — bloqueia domínios de plataformas, protocolos não HTTP(S), portas e credenciais suspeitas, IPs privados/loopback/link-local/reservados (IPv4 e IPv6), DNS rebinding, redirects para destinos proibidos e respostas acima do limite.
- **Falha explícita** — quando não há fonte confiável, a versão não é exibida na busca (Regra 7) e permanece na fila de resolução em segundo plano; nunca se inventa uma fonte ou um áudio.

### Reconhecimento Sonoro (identificar a música que está tocando)
- **Captura no aparelho** — o botão de microfone dentro do campo de busca grava um trecho curto (12 s, com contagem regressiva de 3 s) usando `expo-audio`. A permissão é pedida só no momento da ação e o microfone é liberado ao sair da tela ou mandar o app para o fundo.
- **Envio ao backend** — a amostra é lida em base64 (`expo-file-system/legacy` no Android/iOS, `FileReader` na web) e enviada para `POST /api/recognize`. O arquivo temporário é apagado logo após a análise, em qualquer caminho de saída.
- **Provedor AudD** — `auddProvider` fala com a API pública do AudD usando `api_token` no corpo da requisição (nunca na URL) e o áudio em `multipart/form-data`. A credencial fica **apenas** no backend (`AUDD_TOKEN` no `.env`) e nunca é exposta ao aplicativo.
- **Contrato honesto** — o painel só exibe título, artista, álbum e confiança **exatamente** como o serviço respondeu. Sem correspondência, o app avisa que não encontrou a música e **não** preenche o campo de busca com nenhuma sugestão inventada.
- **Erros tratados em português** — permissão negada, microfone indisponível, falta de internet, credencial inválida, excesso de tentativas e falha do provedor viram mensagens claras, com "Tentar novamente" e "Cancelar" no painel.

### Ingestão de Dados Externos
- Orquestrador de ingestão consulta MusicBrainz, Cover Art Archive e Discogs
- Cache das respostas em MariaDB, com TTL configurável
- Respeito aos limites de taxa de cada API (1 req/seg MusicBrainz, 60 req/min Discogs autenticado)
- Log de auditoria de todas as operações de ingestão

### Biblioteca Local (favoritos, playlists e históricos)
- **Favoritos** — persistidos em `@MusicGalaxy:favoritos`, sem duplicar versões; exibem exclusivamente a capa oficial (ou "Sem capa oficial", conforme a Regra 1).
- **Playlists** — persistidas em `@MusicGalaxy:playlists`, com nome único, ordem de inserção preservada, renomeação, exclusão e adição/remoção de versões. Tudo é confirmado na interface antes de apagar.
- **Histórico de buscas** — termos recentes em `@MusicGalaxy:historico`, com remoção individual e limpeza confirmada.
- **Histórico de reproduções** — últimas 50 versões efetivamente iniciadas em `@MusicGalaxy:historicoReproducao`, sem repetir a mesma versão.
- **Nada é apagado por engano** — excluir playlist, limpar histórico ou remover favorito nunca apaga o arquivo baixado no aparelho.
- **Tela Biblioteca** — quatro abas (Resumo, Favoritos, Playlists e Histórico), com contagem de favoritos, playlists, reproduções, artistas, obras e tipos.

### Interface Premium
- **Identidade de vidro fosco** — paleta taupe quente, vinho/bordô e marfim, com cartões translúcidos, contornos finos e cantos amplos. Todos os componentes leem os tokens do `ThemeContext`; nenhum estilo usa cor hexadecimal fixa.
- **Tema claro, escuro e automático** — segue o sistema quando configurado como automático e persiste a escolha no aparelho.
- **Fundo atmosférico em React Native puro** — gradiente em faixas e brilhos suaves (`FundoAtmosfera`), sem `expo-linear-gradient`/`expo-blur`.
- **Componentes compartilhados** — `GlassCard`, `CustomButton`, `Icone` (traço fino e nomes em pt-BR), `BarraNavegacaoInferior` flutuante e mascote oficial robô DJ.
- **Feedback consistente** — modais de sucesso, erro, aviso, informação e confirmação; toasts com fechamento automático; estados de carregamento e vazio em todas as listas.
- **Acessibilidade e movimento** — rótulos de acessibilidade nos controles principais, contraste nos dois temas e animações que respeitam a plataforma (`USE_NATIVE_DRIVER`, sem aviso na web).

---

## Módulos Implementados

| Módulo                            | Status |
|-------------------------------------|--------|
| Busca musical                       | ✅      |
| Obras e versões (works/releases)    | ✅      |
| Capa oficial (Regra 1)              | ✅      |
| Busca completa (Regra 2)            | ✅      |
| Player e download                   | ✅      |
| Ingestão de dados externos          | ✅      |
| Cache em MariaDB                     | ✅      |
| Favoritos                           | ✅      |
| Playlists locais                    | ✅      |
| Histórico de buscas e reproduções   | ✅      |
| Fila de downloads persistente       | ✅      |
| Reprodução offline de arquivo baixado | ✅ (em aparelho nativo; web usa stream) |
| Interface de vidro fosco (temas claro/escuro) | ✅ |
| Descoberta de fontes abertas (Exact Match) | ✅ |
| Validação de qualidade de áudio    | ✅      |

---

## Tecnologias

### Frontend (Mobile)
| Tecnologia    | Finalidade                       |
|---------------|-----------------------------------|
| React Native  | Framework mobile                  |
| Expo SDK 57   | Ferramentas e build mobile        |
| TypeScript    | Tipagem estática                  |
| AsyncStorage  | Persistência local (favoritos, playlists, históricos, fila e tema) |

### Backend
| Tecnologia    | Finalidade                       |
|---------------|-----------------------------------|
| Node.js       | Runtime JavaScript                 |
| Express       | Framework HTTP                     |
| TypeScript    | Tipagem estática                   |
| Helmet        | Cabeçalhos de segurança HTTP       |
| CORS          | Controle de origens permitidas     |
| Rate Limiting | Controle de requisições            |

### Banco de Dados
| Tecnologia   | Finalidade                        |
|--------------|------------------------------------|
| MariaDB      | Banco relacional (porta 3307)      |
| WampServer64 | Ambiente local de banco de dados   |

### Fontes de Dados Externas
| Fonte             | Finalidade                                     |
|--------------------|-------------------------------------------------|
| MusicBrainz        | Metadados musicais abertos                       |
| Cover Art Archive   | Capas oficiais vinculadas ao MusicBrainz         |
| Discogs            | Formatos físicos e variações de lançamento       |
| Internet Archive   | Áudio em acervo aberto (APIs públicas, sem chave) |

---

## Estrutura de Pastas

```text
musicgalaxy/
├── mobile/                    → Aplicativo React Native
│   ├── src/
│   │   ├── components/       → Componentes reutilizáveis (vidro fosco, player, cards)
│   │   ├── contexts/         → Tema, favoritos, playlists, históricos e modais
│   │   ├── screens/          → Telas do aplicativo
│   │   ├── services/         → API, player, downloads e busca
│   │   ├── types/            → Definições TypeScript
│   │   └── navigation/       → Configuração de navegação
│   ├── App.tsx
│   ├── package.json
│   └── index.ts
│
├── backend/                   → API Backend
│   ├── src/
│   │   ├── config/            → Configurações (banco de dados)
│   │   ├── controllers/       → Controladores da API
│   │   ├── models/             → Modelos TypeScript
│   │   ├── routes/             → Rotas Express
│   │   ├── services/           → Serviços de negócio
│   │   │   ├── audioSource/    → Sistema de descoberta global de fontes
│   │   │   │   ├── types.ts    → Tipos (AudioIdentity, AudioCandidate, etc)
│   │   │   │   ├── baseProvider.ts → Classe base abstrata para providers
│   │   │   │   ├── exactMatchEngine.ts → Engine de pontuação e classificação
│   │   │   │   ├── sourceRanker.ts → Ranking de fontes por qualidade
│   │   │   │   ├── sourceOrchestrator.ts → Orquestrador de múltiplos providers
│   │   │   │   ├── audioValidator.ts → Validação rigorosa de arquivos
│   │   │   │   └── providers/  → Implementações concretas
│   │   │   │       ├── internetArchiveProvider.ts → Áudio no Internet Archive
│   │   │   │       ├── directLinkProvider.ts → Provider para URLs diretas de áudio
│   │   │   │       └── genericWebProvider.ts → Provider para crawling de sites/blogs
│   │   │   ├── webAudio.ts      → Guard anti-SSRF e lista de plataformas proibidas
│   │   │   ├── downloadCache.ts → Cache de downloads processados
│   │   │   └── downloadDeduplication.ts → Deduplicação de downloads simultâneos
│   │   ├── types/               → Tipos TypeScript
│   │   ├── middleware/          → Middleware Express
│   │   └── index.ts             → Ponto de entrada
│   ├── package.json
│   ├── tsconfig.json
│   └── .env.example
│
├── database/                  → Scripts do banco de dados
│   ├── schema.sql             → Schema completo
│   ├── seeds/                  → Dados iniciais
│   └── README.md
│
├── AGENTS.md                   → Instruções para agentes de IA
└── README.md
```

---

## Arquitetura

```text
┌──────────────────────┐
│  Frontend Mobile     │
│  React Native + Expo │
└──────────┬───────────┘
           │ HTTP
           ▼
┌──────────────────────┐
│  API REST            │
│  Express + Node.js   │
│  TypeScript          │
└──────────┬───────────┘
           │
           ▼
┌──────────────────────┐
│  Orquestrador de     │
│  Ingestão            │
│  MusicBrainz         │
│  Cover Art Archive   │
│  Discogs             │
└──────────┬───────────┘
           │
           ▼
┌──────────────────────┐
│  MariaDB             │
│  Cache (TTL)         │
│  Auditoria           │
└──────────────────────┘
```

### Segurança

- Helmet (cabeçalhos HTTP)
- CORS com controle de origens
- Rate limiting por API externa
- Log de auditoria de ingestão

### Escalabilidade

- Separação entre obra (work) e versão (release)
- Catálogo fixo e extensível de tipos de release
- Cache local para reduzir dependência de APIs externas
- Arquitetura modular preparada para novas fontes de dados

---

## Banco de Dados

O projeto utiliza **MariaDB** (porta 3307, via WampServer64) como banco de dados relacional.

### Schema

O schema é normalizado, com as seguintes tabelas principais:

- **artists** — Artistas/bandas
- **works** — Obras musicais (conceituais, independentes de versões)
- **releases** — Cada versão/lançamento específico de uma obra
- **release_types** — Catálogo fixo de tipos (99 tipos)
- **metadata_sources** — Fontes de metadados (Discogs, MusicBrainz, etc.)
- **external_api_cache** — Cache de respostas de APIs externas
- **ingestion_log** — Auditoria de ingestão de dados externos

Cada release é um registro independente, seguindo a Regra 2: nenhuma versão substitui outra.

### Configuração e seeds

```bash
mysql -u root -p -P 3307 musicgalaxy < database/schema.sql
```

O script já inclui schema e seeds iniciais.

---

## Instalação

### Pré-requisitos

- Node.js >= 18
- WampServer64 com MariaDB rodando na porta 3307
- Expo Go (para testar no dispositivo) ou emulador Android/iOS
- Git
- npm (incluído com Node.js)

### Passo a passo

```bash
# 1. Clone o repositório
git clone https://github.com/claytonmarcelo/Music-Galaxy.git
cd musicgalaxy

# 2. Configure o banco de dados MariaDB
# Certifique-se de que o WampServer64 está rodando e acesse
# o phpMyAdmin em http://localhost/phpmyadmin
mysql -u root -p -P 3307 musicgalaxy < database/schema.sql

# 3. Instale e inicie o backend
cd backend
npm install
cp .env.example .env
# Edite o arquivo .env com suas credenciais e chaves de API

npm run dev

# 4. Em outro terminal, instale e inicie o frontend mobile
cd mobile
npm install
npm start
```

O backend estará disponível em `http://localhost:3001` e o app pode ser aberto no Expo Go ou emulador.

---

## Configuração

Crie um arquivo `.env` na pasta `backend/` baseado no `.env.example`:

```env
PORT=3001
NODE_ENV=development

DB_HOST=localhost
DB_PORT=3307
DB_NAME=musicgalaxy
DB_USER=root
DB_PASSWORD=

RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
CORS_ORIGIN=*

MUSICBRAINZ_USER_AGENT=MusicGalaxy/1.0 (contato: seu-email@exemplo.com)
DISCOGS_TOKEN=seu_token_pessoal_discogs
DISCOGS_USER_AGENT=MusicGalaxy/1.0
```

O Internet Archive não exige chave nem configuração adicional. O endereço da API usado pelo app não fica fixo no código: ele é informado em Ajustes → Servidor da API e salvo no aparelho.

> **Atenção**: `MUSICBRAINZ_USER_AGENT` precisa conter um e-mail de contato real — o MusicBrainz bloqueia User-Agents genéricos. `DISCOGS_TOKEN` precisa ser um token pessoal real gerado na conta Discogs do projeto; sem ele, o adapter opera no limite de 25 req/min (não autenticado) em vez de 60 req/min, e algumas rotas podem responder 401.

---

## API Endpoints

### Busca Musical

#### `GET /api/search?q={termo}`

Único endpoint que o aplicativo mobile chama para busca. Internamente, consulta primeiro o banco local; se não houver resultado ou os dados estiverem além do TTL do cache, o próprio endpoint dispara a ingestão das fontes externas antes de responder.

**Parâmetros de busca:**
- `q` (obrigatório) — Termo de busca
- `limit` (opcional) — Limite de resultados (padrão: 50, máximo: 100)
- `offset` (opcional) — Offset para paginação (padrão: 0)
- `category` (opcional) — Filtrar por categoria (release_format, mix_edit, instrumental, playback)

**Resposta:** somente versões com fonte de áudio já resolvida (Regra 7). O filtro é aplicado no SQL antes da paginação; `pendentes_audio` informa quantas versões ainda aguardam descoberta em segundo plano. A busca também dispara a ingestão das fontes externas quando o banco local não tem o termo.

```json
{
  "success": true,
  "data": {
    "results": [...],
    "total": 100,
    "page": 1,
    "per_page": 50,
    "pendentes_audio": 12
  }
}
```

**Exemplo:**
```bash
curl "http://localhost:3001/api/search?q=daft%20punk&limit=10"
```

#### `POST /api/search/ingest`

Endpoint administrativo/interno, fora do fluxo normal do app. Serve apenas para forçar resincronização manual de um termo. Uso interno apenas, até existir camada de autenticação.

**Corpo da requisição:**
```json
{
  "q": "termo de busca"
}
```

#### `GET /api/works/:id`
Detalhes de uma obra específica.

#### `GET /api/works/:id/releases`
Lista as versões de uma obra que já têm áudio (Regra 7).

#### `GET /api/works/by-decade/:decade`
Lista obras de uma década; só aparecem obras com ao menos uma versão com áudio.

#### `GET /api/releases/:id`
Detalhes de uma versão específica.

#### `GET /api/releases/by-date`
Versões recentes que já têm áudio.

#### `GET /api/release-types`
Lista o catálogo de tipos de versão disponíveis (99 tipos, incluindo CD e DVD).

#### `GET /api/artists`
Lista e busca artistas cadastrados.

### Áudio (Regra 3)

#### `GET /api/releases/:id/stream`
Proxy da fonte web aberta com suporte a `Range`/`206`. É a única origem de reprodução do app.

#### `GET /api/releases/:id/download?format=mp3|flac`
Gera o arquivo de áudio a partir da fonte aberta (cache → deduplicação → download → `ffprobe` → conversão condicional → validação). `format` aceita `mp3` (320 kbps) ou `flac`.

#### `POST /api/releases/:id/audio-source`
Registra manualmente uma fonte aberta confiável: `{ "url": "https://..." }`. A URL é validada pelo guard `auditarUrl()` antes de ser salva.

### Reconhecimento Sonoro

#### `POST /api/recognize`
Identifica a música de um trecho de áudio. Corpo: `{ "audio_base64": "<base64>" }`.

- A amostra precisa ter entre 1 KB e 2 MB e ser um formato de áudio reconhecido (mp3, m4a, wav, flac, ogg, webm, aac) — o formato é conferido pelos bytes iniciais do arquivo, não pelo nome.
- A duração útil fica entre 2 e 30 segundos.
- A resposta segue o contrato `{ success, data: { status, title?, artist?, album?, releaseYear?, provider?, confidence? } }`, com `status` em `matched`, `no_match`, `permission_denied`, `microphone_unavailable`, `network_error`, `provider_error` ou `cancelled`.
- Sem correspondência, `status` é `no_match` **sem** título, artista ou qualquer outro metadado inventado.
- A credencial do provedor (`AUDD_TOKEN`) fica somente no backend. Sem ela, o endpoint responde `503` com a mensagem de que o reconhecimento não está configurado neste servidor.
- Limitador de requisições próprio (20 por 15 minutos, configurável por `RECOGNITION_RATE_LIMIT_*`).

### Sistema

#### `GET /health`
Health check da API.

---

## Validação da Integração

TypeScript compilar sem erro não comprova que a lógica funciona. Antes de considerar uma entrega concluída, rode e confirme:

```bash
# 1. Tipagem nas duas camadas
cd backend && npx tsc --noEmit
cd ../mobile && npx tsc --noEmit

# 2. Testes automatizados do backend (unitários + API com banco real)
cd backend && npm test
npm run test:api

# 3. Busca real: só versões com áudio aparecem (Regra 7)
curl "http://localhost:3001/api/search?q=daft%20punk"

# 4. Stream com Range (deve responder 206 e audio/mpeg)
curl -i -H "Range: bytes=0-2047" \
  "http://localhost:3001/api/releases/40/stream"

# 5. Download real (deve entregar arquivo com assinatura ID3/fLaC)
curl -o /tmp/teste.mp3 \
  "http://localhost:3001/api/releases/40/download?format=mp3"
file /tmp/teste.mp3
```

A validação de UI é feita no Expo web (`cd mobile && npm run web`) percorrendo busca → detalhe → reprodução → download → favorito → playlist → histórico → recarregamento do app.

---

## Desenvolvimento

### Frontend (Mobile)
```bash
cd mobile
npm start          # Inicia o Expo
npm run android    # Executa no Android
npm run ios        # Executa no iOS
npm run web        # Executa no web
```

### Backend (API)
```bash
cd backend
npm run dev        # Inicia servidor de desenvolvimento
npm run build      # Build para produção
npm start          # Inicia servidor em produção
```

---

## Histórico de Versões

### v1.0.0 — 4 de agosto de 2026

#### 🎨 Design Premium
- Componentes com bordas arredondadas (16–24px) e sombras específicas por plataforma
- Sistema de animações com timings (rápida/normal/lenta) e curvas de easing (suave/com efeito de mola)
- Substituição de 100% dos `Alert.alert()` nativos por modais personalizados
- Notificações do tipo toast com fechamento automático e barra de progresso
- Componentes reutilizáveis: BottomSheet, controles de player, progresso de download, tela de carregamento, alternância de tema

#### 🎬 Telas Aprimoradas
- Tela de busca com animações de entrada e campo com sombra
- Tela de detalhe de release com animações escalonadas e cartões destacados
- Tela de detalhe de obra com efeito parallax na capa
- Telas adicionais: detalhe de artista, biblioteca, explorar, favoritos, configurações, administração de ingestão

#### 🎛️ Infraestrutura Global
- Contexto de modais com métodos para sucesso, erro, aviso, informação e confirmação
- Contexto de tema com transições animadas
- Contexto de favoritos com persistência via AsyncStorage
- Contexto de histórico de visualizações
- Acento visual verde (#1DB954)

#### 🔧 Backend
- Controlador de artistas
- Orquestrador de busca e ingestão de dados externos
- Todos os endpoints obrigatórios implementados

#### ✅ Verificação
- TypeScript sem erros (mobile e backend)
- Stack confirmada: React Native + TypeScript + Expo SDK 57 + Node.js + MariaDB (porta 3307)
- Bundler web validado com exportação estável do Metro
- API de busca validada diretamente via `curl`, com retorno real de resultados de release

---

## Roadmap

### Concluído
- [x] Schema normalizado (artists, works, releases)
- [x] Catálogo completo de tipos de release (60+ tipos)
- [x] API REST com Express e TypeScript
- [x] Implementação das Regras 1 e 2 (capa oficial + busca completa)
- [x] Integração com MusicBrainz, Cover Art Archive e Discogs
- [x] Cache em MariaDB com TTL
- [x] Player e download exclusivamente de fontes web abertas (Regra 3)
- [x] Descoberta no Internet Archive e em sites abertos com Exact Match
- [x] Fila de downloads persistente com progresso e cancelamento
- [x] Favoritos, playlists e históricos de busca e reprodução
- [x] Interface de vidro fosco com temas claro, escuro e automático
- [x] Modo offline com servidor configurável

### Futuro
- Painel administrativo para gestão de ingestão
- Migrações versionadas do banco
- Build e distribuição do APK (requer login no EAS)
- Melhorias adicionais de acessibilidade

---

## Troubleshooting

### Erro de conexão com banco de dados
- Verifique se o WampServer64 está rodando
- Verifique se a porta 3307 está configurada em `backend/.env`
- Certifique-se de que o banco `musicgalaxy` existe

### Erro ao instalar dependências
- Verifique se o Node.js está instalado
- Limpe o cache: `npm cache clean --force`
- Delete `node_modules` e `package-lock.json`, reinstale

### Expo não inicia
- Verifique se a porta 19000 está disponível
- Tente `expo start --clear`
- Verifique seu firewall/antivírus

---

## Licença

Este projeto é propriedade exclusiva de seus desenvolvedores.

## Suporte

Para dúvidas ou problemas, consulte a documentação técnica em `AGENTS.md`.

---

<p align="center">
  <em>Desenvolvido por <strong>C. Marcelo Dev. Brasil</strong>.</em>
  <br>
  <a href="https://github.com/claytonmarcelo/Music-Galaxy">🔗 GitHub</a>
</p>
