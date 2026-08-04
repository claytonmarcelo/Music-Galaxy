# Music Galaxy

Aplicativo de busca musical focado em precisão de dados e completude de resultados. O diferencial do aplicativo é nunca inventar informações: capas de música e versões de lançamento devem refletir exatamente o que existe nas fontes de dados consultadas.

## Visão Geral

Music Galaxy é destinado a DJs, colecionadores, produtores musicais e pesquisadores que precisam localizar versões específicas de uma mesma obra (remixes, edições, formatos de lançamento, instrumentais, playback, entre outros).

## Stack Tecnológica

- **Frontend**: React Native + TypeScript + Expo SDK 57
- **Backend**: Node.js + TypeScript + Express
- **Banco de Dados**: MariaDB (porta 3307 via WampServer64)

## Regras de Negócio

### Regra 1 — Capa Oficial da Música
O Music Galaxy deve exibir exclusivamente a capa oficial correspondente ao resultado da pesquisa, quando essa capa estiver disponível na fonte consultada.

- Nunca gerar capas por inteligência artificial
- Nunca criar capas fictícias
- Nunca utilizar capas de outra música, álbum ou artista
- Nunca modificar a arte oficial
- Nunca substituir a capa correta por uma imagem semelhante
- Se a fonte não disponibilizar a capa oficial, o aplicativo não deve inventar uma

### Regra 2 — Pesquisa Musical Completa
O mecanismo de pesquisa deve localizar e apresentar todas as versões existentes de uma mesma obra musical, independentemente do formato de lançamento.

**Formatos suportados**: Álbum, Single, EP, Maxi Single, CD Single, Promo, White Label, Coletâneas, Box Set, Deluxe Edition, Remastered, Reissue, Soundtrack, Bootleg (legal), Demo, Live Album, e muitos mais.

**Versões suportadas**: Instrumental, Acapella, Karaoke, Radio Edit, Extended Mix, Club Mix, Remix, Dub Mix, VIP Mix, Rework, Mashup, DJ Version, e muito mais.

## Estrutura do Projeto

```
musicgalaxy/
├── mobile/                    # Aplicativo React Native
│   ├── src/
│   │   ├── components/       # Componentes reutilizáveis
│   │   ├── screens/           # Telas do aplicativo
│   │   ├── services/          # Serviços de API
│   │   ├── types/             # Definições TypeScript
│   │   ├── navigation/        # Configuração de navegação
│   │   └── styles/            # Estilos globais
│   ├── App.tsx
│   ├── package.json
│   └── index.ts
│
├── backend/                   # API Backend
│   ├── src/
│   │   ├── config/            # Configurações (banco de dados)
│   │   ├── controllers/       # Controladores da API
│   │   ├── models/            # Modelos TypeScript
│   │   ├── routes/            # Rotas Express
│   │   ├── services/          # Serviços de negócio
│   │   ├── types/             # Tipos TypeScript
│   │   ├── middleware/        # Middleware Express
│   │   └── index.ts           # Ponto de entrada
│   ├── package.json
│   ├── tsconfig.json
│   └── .env.example
│
├── database/                  # Scripts do banco de dados
│   ├── schema.sql             # Schema completo
│   ├── seeds/                 # Dados iniciais
│   └── README.md
│
├── AGENTS.md                  # Instruções para agentes de IA
└── README.md
```

## Configuração Inicial

### 1. Configurar Banco de Dados MariaDB

Certifique-se de que o WampServer64 está rodando e acesse o phpMyAdmin em `http://localhost/phpmyadmin`.

Execute o script do banco de dados (inclui schema e seeds):

```bash
# Via phpMyAdmin ou linha de comando:
mysql -u root -p -P 3307 musicgalaxy < database/schema.sql
```

### 2. Configurar Backend

```bash
cd backend
npm install
cp .env.example .env  # Configurar porta do MariaDB (3307)
npm run dev
```

O backend estará disponível em `http://localhost:3001`

### 3. Configurar Frontend React Native

```bash
cd mobile
npm install
npm start
```

Use o Expo Go no seu dispositivo ou emulador para testar.

## API Endpoints

### Busca Musical

#### `GET /api/search?q={termo}`
**único endpoint que o aplicativo mobile chama para busca.** Internamente, consulta primeiro o banco local; se não houver resultado local, ou os dados existentes estiverem além do TTL de `external_api_cache`, o próprio endpoint dispara a ingestão das fontes externas através do orquestrador antes de responder.

**Query Params:**
- `q` (obrigatório) - Termo de busca
- `limit` (opcional) - Limite de resultados (padrão: 50, máximo: 100)
- `offset` (opcional) - Offset para paginação (padrão: 0)
- `category` (opcional) - Filtrar por categoria (release_format, mix_edit, instrumental, playback)

**Resposta:**
```json
{
  "success": true,
  "data": {
    "results": [...],
    "total": 100,
    "page": 1,
    "per_page": 50,
    "fromCache": true
  }
}
```

**Exemplo:**
```bash
curl "http://localhost:3001/api/search?q=daft%20punk&limit=10"
```

#### `POST /api/search/ingest`
Endpoint administrativo/interno, fora do fluxo normal do app. Serve apenas para forçar resincronização manual de um termo (script de manutenção, painel administrativo futuro). Documentado como "uso interno apenas" até existir camada de autenticação.

**Body:**
```json
{
  "q": "termo de busca"
}
```

#### `GET /api/works/:id`
Detalhes de uma obra específica.

#### `GET /api/works/:id/releases`
Lista todas as versões/releases de uma obra.

#### `GET /api/releases/:id`
Detalhes de uma versão/release específica.

#### `GET /api/release-types`
Lista o catálogo de tipos de versão disponíveis.

### Sistema

#### `GET /health`
Health check da API.

## Schema do Banco de Dados

O schema usa uma estrutura normalizada com tabelas principais:

- **artists** - Artistas/bandas
- **works** - Obras musicais (conceituais, independentes de versões)
- **releases** - Cada versão/lançamento específico de uma obra
- **release_types** - Catálogo fixo de tipos (60+ tipos)
- **metadata_sources** - Fontes de metadados (Discogs, MusicBrainz, etc)
- **external_api_cache** - Cache de respostas de APIs externas em MariaDB
- **ingestion_log** - Auditoria de ingestão de dados externos

Cada release é um registro independente, seguindo a Regra 2: nenhuma versão substitui outra.

## Integração com Fontes Externas

O Music Galaxy integra com APIs externas para buscar metadados musicais:

### Fontes de Dados
- **MusicBrainz** - Banco de dados aberto de metadados musicais
- **Cover Art Archive** - Capas oficiais associadas ao MusicBrainz
- **Discogs** - Catálogo com detalhes de formatos físicos e variações

### Sistema de Ingestão
- **POST /api/search/ingest** - Busca e ingere dados de fontes externas
- **Cache em MariaDB** - Reduz chamadas repetidas e respeita limites de taxa
- **Rate Limiting** - Respeita limites de cada API (1 req/seg MusicBrainz, 60 req/min Discogs)
- **Auditoria** - Log de todas as operações de ingestão para rastreabilidade

### Configuração
Adicione ao `backend/.env`:
```env
MUSICBRAINZ_USER_AGENT=MusicGalaxy/1.0 (contato: seu-email@exemplo.com)
DISCOGS_TOKEN=seu_token_pessoal_discogs
DISCOGS_USER_AGENT=MusicGalaxy/1.0
```

## Validação da Integração

TypeScript compilar sem erro não comprova que a lógica funciona. Antes de considerar a integração concluída, rodar e confirmar:

```bash
# 1. Busca real de ponta a ponta — deve popular works, releases,
#    external_api_cache e ingestion_log na primeira chamada.
curl "http://localhost:3001/api/search?q=One%20More%20Time%20Daft%20Punk"

# 2. Repetir a mesma busca — deve responder do cache/banco local,
#    sem gerar nova linha em external_api_cache.
curl "http://localhost:3001/api/search?q=One%20More%20Time%20Daft%20Punk"

# 3. Confirmar no banco que o cache não duplicou:
mysql -u root -p -P 3307 musicgalaxy -e \
  "SELECT request_key, fetched_at, expires_at FROM external_api_cache;"

# 4. Confirmar que a auditoria registrou a operação:
mysql -u root -p -P 3307 musicgalaxy -e \
  "SELECT metadata_source_id, request_type, status, works_created, releases_created FROM ingestion_log ORDER BY created_at DESC LIMIT 10;"
```

Configuração não opcional:
- `MUSICBRAINZ_USER_AGENT` no `.env` real precisa ter um e-mail de contato válido (nunca o placeholder `seu-email@exemplo.com`) — o MusicBrainz bloqueia User-Agents genéricos.
- `DISCOGS_TOKEN` precisa ser um token pessoal real gerado na conta Discogs do projeto; sem ele, o adapter opera no limite de 25 req/min (não autenticado) em vez de 60 req/min, e algumas rotas podem responder 401.

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

## Funcionalidades Implementadas

### ✅ Banco de Dados
- Schema normalizado com artists, works, releases
- Catálogo completo de release_types (60+ tipos)
- Sistema de metadados com rastreamento de fonte
- Suporte a todas as categorias: release_format, mix_edit, instrumental, playback

### ✅ Backend API
- API RESTful com Express e TypeScript
- Conexão com MariaDB (porta 3307)
- Endpoints conforme especificação: /api/search, /api/works, /api/releases, /api/artists
- Implementação das Regras 1 e 2 (capa oficial + busca completa)

### ✅ Fluxo de Player e Download
- O player e o download usam a URL original da release selecionada pelo usuário
- Não há áudio sintético, mock ou URL de teste no fluxo de reprodução
- A seleção de mídia respeita a ordem natural da release: streaming, preview e download quando disponíveis
- O download mantém o controle de progresso e o caminho local persistido no gerenciador de arquivos do Expo

### ✅ Verificação do Web Expo
- O bundler web foi validado com exportação estável do Metro
- O app web responde em `http://localhost:8082` após a correção do entrypoint do workspace
- A API de busca foi validada diretamente via `curl` com retorno real de resultados de release
- Middleware de segurança (Helmet, CORS, Rate Limiting)
- Sistema de ingestão de dados de MusicBrainz e Discogs
- Cache em MariaDB com TTL

### ✅ Frontend React Native
- Tela de busca musical com animações suaves
- Cards de release com capa oficial (Regra 1)
- Busca retorna todas as versões (Regra 2)
- Paginação infinita
- Loading states e tratamento de erros

### ✨ **Design Premium com Animações (v1.0)**
- **Modais Personalizados**: ModalPersonalizado.tsx com spring animations e 5 tipos (sucesso/erro/aviso/info/confirmacao)
- **Sistema de Notificações**: ToastNotificacao.tsx com auto-close e barra de progresso
- **Componentes Premium**:
  - BottomSheet.tsx (slide-up para filtros e menus)
  - PlayerControls.tsx (reprodução com pulse animation)
  - DownloadProgress.tsx (progresso com checkmark animado)
  - LoadingScreen.tsx (spinner customizado com breathing animation)
  - TemaToggle.tsx (troca de tema com scale + rotação 180deg)
- **Animações Globais**: Sistema centralizado com timings (rápida/normal/lenta) e easing (bouncy/suave)
- **Telas Aprimoradas**:
  - BuscaScreen: Fade/scale animations
  - DetalheReleaseScreen: Staggered animations com parallax
  - DetalheWorkScreen: Scroll parallax na capa
  - 6 telas adicionais com design premium
- **Contextos Globais**: 
  - ModalContext.tsx (substitui 100% dos Alert nativos)
  - TemaContext.tsx (transições animadas entre temas)
  - FavoritosContext.tsx (persistência em AsyncStorage)
  - HistoricoContext.tsx (rastreamento de visualizações)
- **TypeScript**: 0 erros (mobile + backend)

## Próximos Passos

1. **Integração com APIs Externas**
   - Implementar integração com Discogs API
   - Implementar integração com MusicBrainz API
   - Sistema de sincronização de dados

2. **Funcionalidades Adicionais**
   - Tela de detalhes de obra/release
   - Sistema de favoritos
   - Histórico de buscas
   - Filtros avançados

3. **Melhorias de UI/UX**
   - Animações e transições
   - Tema escuro
   - Acessibilidade

## Changelog

### [v1.0.0] - 4 de Agosto de 2026

#### 🎨 Implementação Premium Completa
- **Design Gourmet**: Componentes premium com borderRadius 16-24px, shadows platform-specific
- **Sistema de Animações**: Timings (rápida/normal/lenta), Easing (bouncy/suave), 8 funções reutilizáveis
- **Modais Personalizados**: Substituição 100% de Alert.alert() nativo por ModalPersonalizado.tsx
- **Notificações Elegantes**: ToastNotificacao.tsx com auto-close e barra de progresso
- **Componentes Reutilizáveis**: BottomSheet, PlayerControls, DownloadProgress, LoadingScreen, TemaToggle

#### 🎬 Telas Aprimoradas com Animações
- BuscaScreen: Animações de entrada, scale header, campo de busca com shadow
- DetalheReleaseScreen: Staggered animations, cards com borderLeft verde
- DetalheWorkScreen: Parallax scroll na capa, slide animations
- DetalheArtistaScreen, TelaBiblioteca, TelaExplorar, FavoritosScreen, SettingsScreen, TelaAdminIngestao

#### 🎛️ Infraestrutura Global
- ModalContext.tsx com métodos: abrirSucesso/Erro/Aviso/Info/Confirmacao
- useModalGlobal.ts hook customizado
- ModalGlobalContainer.tsx renderizador global
- TemaContext.tsx com transições animadas
- Acento verde Spotify (#1DB954)

#### 🔧 Backend Aprimorado
- artistsController.ts: Endpoints de artistas
- searchOrchestrator.ts: Orquestrador de ingestão
- Todos os 11 endpoints obrigatórios implementados

#### ✅ Verificação
- TypeScript: 0 erros (mobile + backend)
- Stack confirmada: React Native + TypeScript + Expo SDK 57 + Node.js + MariaDB 3307
- Commit hash: 9cc6ef6 (54 arquivos modificados, +15.447 linhas)

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

## Licença

Este projeto é propriedade exclusiva de seus desenvolvedores.

## Suporte

Para dúvidas ou problemas, consulte a documentação técnica em `AGENTS.md`.
