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

O Music Galaxy centraliza a busca em fontes de dados confiáveis (MusicBrainz, Cover Art Archive e Discogs), aplicando regras rígidas para garantir que nenhuma capa ou versão seja inventada, aproximada ou substituída.

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
- Catálogo fixo com mais de 60 tipos de release

### Capas Oficiais
- Exibição de capa oficial via Cover Art Archive, vinculada ao MusicBrainz
- Nenhuma capa sintética, aproximada ou de placeholder

### Player e Download
- Reprodução e download utilizam exclusivamente a URL original da versão selecionada
- Nenhum áudio sintético, mock ou de teste no fluxo de reprodução
- Ordem natural respeitada: streaming, preview e download, quando disponíveis
- Progresso de download com caminho local persistido no gerenciador de arquivos do Expo
- Pipeline de download: yt-dlp (com retry e múltiplas estratégias) → arquivo temporário → FFmpeg → validação → cliente
- Formatos suportados: FLAC (codec flac, 44100 Hz, stereo, 24 bit) e MP3 (codec libmp3lame, 320k, 44100 Hz, stereo)
- Validação de assinatura de arquivo antes de enviar ao cliente (FLAC: fLaC, MP3: ID3 ou sync bytes)
- Validação de decodificação completa via FFmpeg antes de enviar ao cliente
- Limpeza automática de arquivos temporários após download ou erro
- MIME types corretos: audio/flac para FLAC, audio/mpeg para MP3
- Extensões corretas: .flac para FLAC, .mp3 para MP3
- Download no frontend com rastreamento de progresso em tempo real (Web: fetch com stream reader)
- Retry inteligente com exponential backoff (1s, 2s, 4s) para falhas transitórias
- Múltiplas estratégias de formato yt-dlp (m4a, mp3, webm, opus, bestaudio) para maximizar compatibilidade
- Classificação de erros (SOURCE_UNAVAILABLE, FORMAT_UNAVAILABLE, TIMEOUT, etc) para diagnóstico preciso
- Logs estruturados com medição de tempo por etapa (yt-dlp, FFmpeg, validação) para observabilidade

### Ingestão de Dados Externos
- Orquestrador de ingestão consulta MusicBrainz, Cover Art Archive e Discogs
- Cache das respostas em MariaDB, com TTL configurável
- Respeito aos limites de taxa de cada API (1 req/seg MusicBrainz, 60 req/min Discogs autenticado)
- Log de auditoria de todas as operações de ingestão

### Favoritos e Histórico
- Persistência de favoritos via AsyncStorage
- Rastreamento de histórico de visualizações

### Interface Premium
- Modais personalizados com animações (sucesso, erro, aviso, informação, confirmação)
- Sistema de notificações (toast) com fechamento automático e barra de progresso
- Componentes reutilizáveis: BottomSheet, controles de player, progresso de download, tela de carregamento, alternância de tema
- Animações globais com timings e curvas de easing padronizados
- Tema com acento verde (#1DB954)

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
| Histórico de buscas                 | ✅      |
| Interface premium com animações     | ✅      |

---

## Tecnologias

### Frontend (Mobile)
| Tecnologia    | Finalidade                       |
|---------------|-----------------------------------|
| React Native  | Framework mobile                  |
| Expo SDK 57   | Ferramentas e build mobile        |
| TypeScript    | Tipagem estática                  |
| AsyncStorage  | Persistência local (favoritos)    |

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

---

## Estrutura de Pastas

```text
musicgalaxy/
├── mobile/                    → Aplicativo React Native
│   ├── src/
│   │   ├── components/       → Componentes reutilizáveis
│   │   ├── screens/          → Telas do aplicativo
│   │   ├── services/         → Serviços de API
│   │   ├── types/            → Definições TypeScript
│   │   ├── navigation/       → Configuração de navegação
│   │   └── styles/           → Estilos globais
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
- **release_types** — Catálogo fixo de tipos (60+ tipos)
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

MUSICBRAINZ_USER_AGENT=MusicGalaxy/1.0 (contato: seu-email@exemplo.com)
DISCOGS_TOKEN=seu_token_pessoal_discogs
DISCOGS_USER_AGENT=MusicGalaxy/1.0
```

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
Lista todas as versões/releases de uma obra.

#### `GET /api/releases/:id`
Detalhes de uma versão/release específica.

#### `GET /api/release-types`
Lista o catálogo de tipos de versão disponíveis.

#### `GET /api/artists`
Lista e busca artistas cadastrados.

### Sistema

#### `GET /health`
Health check da API.

---

## Validação da Integração

TypeScript compilar sem erro não comprova que a lógica funciona. Antes de considerar a integração concluída, é preciso rodar e confirmar:

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
- [x] Player e download com URL original da release
- [x] Interface mobile com design premium e animações
- [x] Sistema de favoritos e histórico de buscas

### Futuro
- Tela de detalhes de obra/release com mais informações contextuais
- Filtros avançados de busca
- Tema escuro
- Melhorias de acessibilidade
- Painel administrativo para gestão de ingestão

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
