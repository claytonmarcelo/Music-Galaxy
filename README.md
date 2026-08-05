<p align="center">
  <img
    src="assets/branding/Logo.png"
    alt="Music Galaxy"
    width="320"
  >
</p>

<h1 align="center">Music Galaxy</h1>

<p align="center">
  <strong>Aplicativo de Busca Musical com Precisão de Dados</strong><br>
  Localize remixes, edições, formatos de lançamento e versões alternativas de qualquer obra musical, com capas oficiais e dados que nunca são inventados.
</p>

<p align="center">
  <a href="./LICENSE"><img src="https://img.shields.io/badge/licença-propriet%C3%A1ria-lightgrey" alt="Licença"></a>
  <img src="https://img.shields.io/badge/versão-1.0.0-blue" alt="Versão">
  <img src="https://img.shields.io/badge/typescript-5.x-3178C6?logo=typescript" alt="TypeScript">
  <img src="https://img.shields.io/badge/node-%3E%3D20-339933?logo=node.js" alt="Node.js">
  <img src="https://img.shields.io/badge/expo-SDK%2057-000020?logo=expo" alt="Expo">
  <img src="https://img.shields.io/badge/react%20native-0.76-61DAFB?logo=react" alt="React Native">
  <img src="https://img.shields.io/badge/mariadb-10.x-003545?logo=mariadb" alt="MariaDB">
  <img src="https://img.shields.io/badge/express-4.x-000000?logo=express" alt="Express">
</p>

---

## Capturas de Tela

> Capturas ilustrativas da interface do Music Galaxy.

<div align="center">

|                                Busca                                |                              Detalhe da Release                              |
| :------------------------------------------------------------------: | :----------------------------------------------------------------------------: |
| <img src="assets/screenshots/busca.png" alt="Busca" width="300"> | <img src="assets/screenshots/detalhe-release.png" alt="Detalhe da Release" width="300"> |

|                              Player                              |                                Favoritos                               |
| :------------------------------------------------------------------: | :----------------------------------------------------------------------: |
| <img src="assets/screenshots/player.png" alt="Player" width="300"> | <img src="assets/screenshots/favoritos.png" alt="Favoritos" width="300"> |

</div>

---

## Sobre o Projeto

O **Music Galaxy** é um aplicativo de busca musical construído para resolver um problema específico: encontrar a versão exata de uma obra musical — não apenas "a música", mas o remix certo, a edição certa, o formato de lançamento certo.

### Problema que resolve

DJs, colecionadores e produtores frequentemente precisam localizar uma versão específica de uma faixa (extended mix, radio edit, instrumental, VIP mix, white label) e acabam esbarrando em plataformas que misturam versões diferentes sob um único resultado, ou que exibem capas genéricas e incorretas.

O Music Galaxy resolve isso tratando cada obra e cada versão/lançamento como registros independentes, sempre lastreados em fontes de dados reais.

### Público-alvo

- DJs e produtores musicais
- Colecionadores de vinil, CD e formatos físicos
- Pesquisadores e catalogadores musicais
- Rádios e serviços de playback/karaokê

### Diferencial

- **Nunca inventa dados**: capas e versões refletem exatamente o que existe nas fontes consultadas
- **Busca completa**: todas as versões de uma obra são retornadas, nenhuma substitui a outra
- **Fontes abertas e confiáveis**: MusicBrainz, Cover Art Archive e Discogs
- **Cache inteligente**: reduz chamadas externas respeitando limites de taxa de cada API

---

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

---

## Funcionalidades

### Busca Musical
- Endpoint único de busca com resposta unificada de cache local ou fontes externas
- Filtro por categoria: formato de lançamento, mix/edição, instrumental, playback
- Paginação com `limit` e `offset`

### Obras e Releases
- Cada obra é conceitual e independente de versões
- Cada release é um registro próprio, sem substituir outras versões
- Catálogo fixo com mais de 60 tipos de release

### Player e Download
- Reprodução usando a URL original da release selecionada
- Sem áudio sintético, mock ou URL de teste
- Download com progresso e caminho local persistido

### Favoritos e Histórico
- Persistência de favoritos local
- Rastreamento de histórico de visualizações

### Design e Experiência
- Modais personalizados substituindo 100% dos alertas nativos
- Sistema de notificações (toast) com barra de progresso
- Animações de entrada, parallax e transições de tema
- Tema com acento verde Spotify (#1DB954)

### Ingestão e Auditoria
- Orquestrador de ingestão de dados externos
- Log de auditoria de todas as operações de ingestão
- Cache com TTL em MariaDB

---

## Módulos Implementados

| Módulo                          | Status |
|---------------------------------|--------|
| Busca musical                   | ✅      |
| Obras (works)                   | ✅      |
| Releases                        | ✅      |
| Regra 1 — Capa oficial          | ✅      |
| Regra 2 — Busca completa        | ✅      |
| Player e download               | ✅      |
| Favoritos                       | ✅      |
| Histórico de buscas              | ✅      |
| Ingestão MusicBrainz/Discogs    | ✅      |
| Cache com TTL                   | ✅      |
| Auditoria de ingestão            | ✅      |
| Design premium com animações      | ✅      |

---

## Tecnologias

### Frontend (Mobile)
| Tecnologia      | Finalidade                  |
|-----------------|------------------------------|
| React Native    | Base do aplicativo mobile     |
| Expo SDK 57     | Ferramentas e build           |
| TypeScript      | Tipagem estática              |
| AsyncStorage    | Persistência local (favoritos)|

### Backend
| Tecnologia   | Finalidade                  |
|--------------|-------------------------------|
| Node.js      | Runtime JavaScript            |
| Express      | Framework HTTP                |
| TypeScript   | Tipagem estática               |
| Helmet       | Cabeçalhos de segurança HTTP  |
| CORS         | Controle de origens permitidas|

### Banco de Dados
| Tecnologia   | Finalidade                  |
|--------------|-------------------------------|
| MariaDB      | Banco relacional (porta 3307)  |
| WampServer64 | Ambiente local de banco        |

### Fontes de Dados Externas
| Fonte                | Finalidade                          |
|----------------------|---------------------------------------|
| MusicBrainz          | Metadados musicais abertos           |
| Cover Art Archive    | Capas oficiais associadas ao MusicBrainz |
| Discogs              | Formatos físicos e variações de release |

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
│   └── package.json
│
├── backend/                   → API REST (Express + TypeScript)
│   ├── src/
│   │   ├── config/            → Configurações (banco de dados)
│   │   ├── controllers/       → Controladores da API
│   │   ├── models/            → Modelos TypeScript
│   │   ├── routes/            → Rotas Express
│   │   ├── services/          → Serviços de negócio (orquestrador de ingestão)
│   │   ├── types/              → Tipos TypeScript
│   │   ├── middleware/        → Middleware Express
│   │   └── index.ts           → Ponto de entrada
│   ├── package.json
│   └── .env.example
│
├── database/                  → Scripts do banco de dados
│   ├── schema.sql             → Schema completo
│   ├── seeds/                 → Dados iniciais
│   └── README.md
│
├── assets/                     → Recursos de branding e screenshots
├── AGENTS.md                   → Instruções para agentes de IA
└── README.md
```

---

## Arquitetura

```text
┌──────────────────────┐
│  App Mobile          │
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
│  Ingestão             │
│  MusicBrainz/Discogs │
└──────────┬───────────┘
           │
           ▼
┌──────────────────────┐
│  MariaDB              │
│  works / releases     │
│  external_api_cache   │
│  ingestion_log        │
└──────────────────────┘
```

### Segurança
- Helmet (cabeçalhos HTTP)
- CORS com controle de origens
- Rate limiting respeitando limites de cada API externa (1 req/seg MusicBrainz, 60 req/min Discogs autenticado)

---

## Banco de Dados

O projeto utiliza **MariaDB** (porta 3307, via WampServer64) como banco de dados relacional, com schema normalizado.

### Tabelas Principais

- **artists** — Artistas/bandas
- **works** — Obras musicais (conceituais, independentes de versões)
- **releases** — Cada versão/lançamento específico de uma obra
- **release_types** — Catálogo fixo de tipos (60+ tipos)
- **metadata_sources** — Fontes de metadados (Discogs, MusicBrainz, etc.)
- **external_api_cache** — Cache de respostas de APIs externas
- **ingestion_log** — Auditoria de ingestão de dados externos

Cada release é um registro independente, seguindo a Regra 2: nenhuma versão substitui outra.

### Executar Schema e Seeds

```bash
mysql -u root -p -P 3307 musicgalaxy < database/schema.sql
```

---

## Instalação

### Pré-requisitos

- Node.js >= 20
- MariaDB (via WampServer64), porta 3307
- Git
- npm (incluído com Node.js)
- Expo Go (para testar no dispositivo/emulador)

### Passo a Passo

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
# Edite o .env com a porta do MariaDB e os tokens de API

npm run dev

# 4. Em outro terminal, instale e inicie o app mobile
cd mobile
npm install
npm start
```

A API estará disponível em `http://localhost:3001`. Use o Expo Go para abrir o app no dispositivo ou emulador.

---

## Configuração

Adicione ao `backend/.env`:

```env
PORT=3001
DB_HOST=localhost
DB_PORT=3307
DB_NAME=musicgalaxy
DB_USER=root
DB_PASSWORD=

MUSICBRAINZ_USER_AGENT=MusicGalaxy/1.0 (contato: seu-email@exemplo.com)
DISCOGS_TOKEN=seu_token_pessoal_discogs
DISCOGS_USER_AGENT=MusicGalaxy/1.0
```

> ⚠️ **Atenção**: `MUSICBRAINZ_USER_AGENT` precisa ter um e-mail de contato válido — o MusicBrainz bloqueia User-Agents genéricos. Sem `DISCOGS_TOKEN` válido, o adapter opera no limite de 25 req/min (não autenticado) em vez de 60 req/min, e algumas rotas podem responder 401.

---

## API Endpoints

### Busca Musical

#### `GET /api/search?q={termo}`
Único endpoint que o aplicativo mobile chama para busca. Internamente, consulta primeiro o banco local; se não houver resultado local, ou os dados existentes estiverem além do TTL de `external_api_cache`, o próprio endpoint dispara a ingestão das fontes externas através do orquestrador antes de responder.

**Parâmetros de busca:**

| Parâmetro  | Obrigatório | Descrição                                                        |
|------------|-------------|--------------------------------------------------------------------|
| `q`        | Sim         | Termo de busca                                                     |
| `limit`    | Não         | Limite de resultados (padrão: 50, máximo: 100)                     |
| `offset`   | Não         | Offset para paginação (padrão: 0)                                  |
| `category` | Não         | Filtro: `release_format`, `mix_edit`, `instrumental`, `playback`   |

**Exemplo:**
```bash
curl "http://localhost:3001/api/search?q=daft%20punk&limit=10"
```

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

#### `POST /api/search/ingest`
Endpoint administrativo/interno, fora do fluxo normal do app. Serve apenas para forçar resincronização manual de um termo. Documentado como "uso interno apenas" até existir camada de autenticação.

```json
{
  "q": "termo de busca"
}
```

#### Demais endpoints

| Método | Rota                      | Descrição                              |
|--------|---------------------------|-------------------------------------------|
| GET    | `/api/works/:id`          | Detalhes de uma obra específica            |
| GET    | `/api/works/:id/releases` | Lista todas as versões/releases de uma obra|
| GET    | `/api/releases/:id`       | Detalhes de uma versão/release específica  |
| GET    | `/api/release-types`      | Catálogo de tipos de versão disponíveis     |
| GET    | `/health`                 | Health check da API                       |

---

## Integração com Fontes Externas

### Sistema de Ingestão
- **Cache em MariaDB**: reduz chamadas repetidas e respeita limites de taxa
- **Rate Limiting**: 1 req/seg no MusicBrainz, 60 req/min no Discogs (autenticado)
- **Auditoria**: log de todas as operações de ingestão para rastreabilidade

### Validação da Integração

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

#### 🎨 Implementação Premium Completa
- Design com componentes premium (borderRadius 16–24px, sombras específicas por plataforma)
- Sistema de animações com timings (rápida/normal/lenta) e easing (bouncy/suave)
- Substituição total de `Alert.alert()` nativo por modais personalizados
- Notificações elegantes com auto-close e barra de progresso

#### 🎬 Telas Aprimoradas
- Tela de busca com animações de entrada e campo com sombra
- Tela de detalhe da release com animações escalonadas
- Tela de detalhe da obra com parallax na capa
- Telas de artista, biblioteca, explorar, favoritos, configurações e administração de ingestão

#### 🎛️ Infraestrutura Global
- Contexto global de modais com métodos de sucesso/erro/aviso/informação/confirmação
- Contexto de tema com transições animadas
- Acento verde Spotify (#1DB954)

#### 🔧 Backend
- Controlador de artistas
- Orquestrador de ingestão de dados externos
- Todos os endpoints obrigatórios implementados

#### ✅ Verificação
- TypeScript sem erros (mobile e backend)
- Stack confirmada: React Native + TypeScript + Expo SDK 57 + Node.js + MariaDB (porta 3307)
- Bundler web validado com exportação estável do Metro

---

## Roadmap

### Concluído
- [x] Schema normalizado (artists, works, releases)
- [x] Catálogo completo de release_types (60+ tipos)
- [x] Regra 1 — Capa oficial
- [x] Regra 2 — Busca completa
- [x] Player e download com URL original
- [x] Sistema de ingestão MusicBrainz e Discogs
- [x] Cache com TTL em MariaDB
- [x] Auditoria de ingestão
- [x] Design premium com animações (v1.0)

### Futuro
- [ ] Filtros avançados de busca
- [ ] Tema escuro
- [ ] Painel administrativo de ingestão com autenticação
- [ ] Melhorias de acessibilidade
- [ ] Sincronização periódica automática com fontes externas

---

## Solução de Problemas

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

## 👨‍💻 Desenvolvedor

<table>
  <tr>
    <td width="90">
      <img src="https://github.com/claytonmarcelo.png" width="90" alt="Clayton Marcelo">
    </td>
    <td>
      <strong>C. Marcelo Dev.</strong><br>
      <strong>📍</strong> Brasil<br><br>
      <a href="https://github.com/claytonmarcelo" target="_blank"><img src="https://img.shields.io/badge/GitHub-claytonmarcelo-181717?style=flat-square&logo=github"></a>
      <a href="https://www.youtube.com/@c.marcelodev.brasil" target="_blank"><img src="https://img.shields.io/badge/YouTube-CMarceloDev-FF0000?style=flat-square&logo=youtube"></a>
      <a href="https://cmarcelodev.com" target="_blank"><img src="https://img.shields.io/badge/Portfólio-cmarcelodev.com-000000?style=flat-square"></a>
      <a href="https://www.linkedin.com/in/clayton-marcelo-dev/" target="_blank"><img src="https://img.shields.io/badge/LinkedIn-claytonmarcelo-0A66C2?style=flat-square&logo=linkedin"></a><br><br>
      <em>Desenvolvedor Full Stack especializado em React, React Native, Node.js, Express, TypeScript e MariaDB.</em>
    </td>
  </tr>
</table>

---

## Suporte

Para dúvidas ou problemas, consulte a documentação técnica em `AGENTS.md`.

## Licença

Este projeto é propriedade exclusiva de seus desenvolvedores.

---

<p align="center">
  <em>Desenvolvido com dedicação por <strong>C. Marcelo Dev. Brasil</strong>.</em>
  <br>
  <a href="https://github.com/claytonmarcelo/Music-Galaxy">🔗 GitHub</a>
</p>
