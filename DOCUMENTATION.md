# 📚 Documentação - Music Galaxy

Bem-vindo ao Music Galaxy! Este documento serve como um índice para toda a documentação do projeto.

## 🎯 Comece Aqui

### Para Usuários
- [📖 README.md](README.md) - Visão geral do projeto, stack, setup inicial

### Para Desenvolvedores
1. [📋 AGENTS.md](AGENTS.md) - Instruções técnicas obrigatórias (leia primeiro!)
2. [👥 CONTRIBUTING.md](CONTRIBUTING.md) - Guia de contribuição e padrões de código
3. [🚀 RELEASE_NOTES.md](RELEASE_NOTES.md) - O que foi implementado em v1.0

---

## 📂 Estrutura da Documentação

### Configuração & Setup
| Arquivo | Descrição | Para Quem |
|---------|-----------|-----------|
| **README.md** | Visão geral, stack, regras de negócio, endpoints | Todos |
| **AGENTS.md** | Instruções para agentes de IA, stack obrigatória, regras | Desenvolvedoras |
| **CONTRIBUTING.md** | Setup local, padrões de código, workflow | Contribuidoras |

### Informações Técnicas
| Arquivo | Descrição | Para Quem |
|---------|-----------|-----------|
| **RELEASE_NOTES.md** | Changelog v1.0, componentes novos, implementação | Desenvolvedoras |
| **.env.example** | Variáveis de ambiente | Setup |
| **AGENTS.md** | Schema do banco, integração com APIs externas | Arquitetura |

### Código-Fonte
| Diretório | Descrição | Linguagem |
|----------|-----------|-----------|
| **mobile/src/** | Aplicativo React Native | TypeScript + React |
| **backend/src/** | API Backend | TypeScript + Express |
| **database/** | Scripts do banco | SQL |

---

## 🎨 Implementação Premium v1.0

### O Que Foi Implementado

#### Componentes Novos (9)
- ✅ ModalPersonalizado.tsx
- ✅ ToastNotificacao.tsx
- ✅ BottomSheet.tsx
- ✅ PlayerControls.tsx
- ✅ DownloadProgress.tsx
- ✅ LoadingScreen.tsx
- ✅ TemaToggle.tsx
- ✅ ModalGlobalContainer.tsx
- ✅ useModalGlobal.ts (hook)

#### Telas Aprimoradas (9)
- ✅ BuscaScreen - Animações de entrada
- ✅ DetalheReleaseScreen - Staggered animations
- ✅ DetalheWorkScreen - Parallax scroll
- ✅ DetalheArtistaScreen - Novo
- ✅ TelaBiblioteca - Novo
- ✅ TelaExplorar - Novo
- ✅ FavoritosScreen - Novo
- ✅ SettingsScreen - Novo
- ✅ TelaAdminIngestao - Novo

#### Contextos Globais (4)
- ✅ ModalContext.tsx (aprimorado)
- ✅ TemaContext.tsx (aprimorado)
- ✅ FavoritosContext.tsx
- ✅ HistoricoContext.tsx

#### Sistema de Animações
- ✅ animacoes.ts - Timings, Easing, 8 funções reutilizáveis
- ✅ Integrado em todas as telas

**Ver mais em:** [RELEASE_NOTES.md](RELEASE_NOTES.md)

---

## 🚀 Como Começar

### 1️⃣ Instalação Rápida (5 min)
```bash
# Clone
git clone https://github.com/claytonmarcelo/Music-Galaxy.git
cd Music-Galaxy

# Setup banco
mysql -u root -p -P 3307 musicgalaxy < database/schema.sql

# Backend
cd backend && npm install && npm run dev

# Frontend (outro terminal)
cd mobile && npm install && npm start
```

### 2️⃣ Entender a Arquitetura
- Leia [README.md](README.md) - Seção "Estrutura do Projeto"
- Leia [AGENTS.md](AGENTS.md) - Seção "Arquitetura da API"
- Explore o código em `mobile/src/` e `backend/src/`

### 3️⃣ Desenvolver uma Feature
1. Leia [CONTRIBUTING.md](CONTRIBUTING.md)
2. Crie uma branch: `git checkout -b feature/minha-feature`
3. Siga os padrões de código (TypeScript, React Native, Animações)
4. Teste localmente: `npx tsc --noEmit`
5. Commit + Push + PR

---

## 📖 Documentação Detalhada

### Banco de Dados
- **Schema**: [database/schema.sql](database/schema.sql)
- **Tabelas principais**: artists, works, releases, release_types, metadata_sources
- **Descrição**: [README.md](README.md) - Seção "Schema do Banco de Dados"

### API Endpoints (11)
- `GET /api/search?q={termo}` - Busca com ingestão sob demanda
- `POST /api/search/ingest` - Força resincronização (admin)
- `GET /api/works/:id` - Detalhes de obra
- `GET /api/works/:id/releases` - Releases de uma obra
- `GET /api/works/by-decade/:decade` - Obras por década
- `GET /api/releases/:id` - Detalhes de release
- `GET /api/releases/by-date` - Releases recentes
- `GET /api/release-types` - Catálogo de tipos
- `GET /api/artists/:id` - Detalhes de artista
- `GET /api/artists/:id/works` - Obras de um artista
- `GET /health` - Health check

**Mais detalhes**: [README.md](README.md) - Seção "API Endpoints"

### Integração com Fontes Externas
- **MusicBrainz API**: Metadados musicais
- **Discogs API**: Formatos físicos e variações
- **Cover Art Archive**: Capas oficiais

**Configuração**: [README.md](README.md) - Seção "Integração com Fontes Externas"

### Regras de Negócio
1. **Regra 1 — Capa Oficial**: Nunca gerar/criar/fictícia, sempre oficial
2. **Regra 2 — Pesquisa Completa**: Retornar TODAS as versões

**Mais detalhes**: [README.md](README.md) - Seção "Regras de Negócio"

---

## 🎯 Padrões de Desenvolvimento

### Stack Obrigatória
- ✅ React Native + TypeScript + Expo SDK 57
- ✅ Node.js + TypeScript + Express
- ✅ MariaDB (porta 3307)

### Código
- 📝 Comentários em português brasileiro
- 🔤 TypeScript com tipos explícitos
- 🎬 Animações reutilizáveis de `animacoes.ts`
- 🚫 NUNCA `Alert.alert()` - use `useModalGlobal()`

**Mais detalhes**: [CONTRIBUTING.md](CONTRIBUTING.md) - Seção "Padrões de Código"

---

## ❓ FAQ

### Como faço para...

#### ...configurar as credenciais do MusicBrainz?
```env
MUSICBRAINZ_USER_AGENT=MusicGalaxy/1.0 (seu-email@seu-dominio.com)
```
Leia mais em [README.md](README.md) - "Integração com Fontes Externas"

#### ...adicionar uma nova animação?
1. Crie a função em `mobile/src/utils/animacoes.ts`
2. Reutilize em componentes com `import { minhaAnimacao } from '../utils/animacoes'`
3. Siga o padrão de timings (TIMINGS.normal) e easing (EASING.suave)

Exemplo em [CONTRIBUTING.md](CONTRIBUTING.md) - "Animações"

#### ...criar um novo endpoint?
1. Defina o tipo em `backend/src/types/index.ts`
2. Implemente o controller em `backend/src/controllers/`
3. Registre a rota em `backend/src/routes/index.ts`
4. Adicione validação em `backend/src/middleware/validacao.ts`

Exemplo em [CONTRIBUTING.md](CONTRIBUTING.md) - "API & Backend"

#### ...debugar uma feature?
```bash
# Frontend
cd mobile && npx tsc --noEmit  # TypeScript errors
npm start                       # Expo logs

# Backend
cd backend && npx tsc --noEmit  # TypeScript errors
npm run dev                      # Server logs

# Banco
mysql -u root -p -P 3307 musicgalaxy
mysql> SELECT * FROM releases WHERE version_name LIKE '%termo%' LIMIT 5;
```

---

## 📞 Suporte & Contribuição

### Encontrou um Bug?
1. Verifique se já existe uma issue
2. Abra uma nova issue com:
   - Descrição clara do problema
   - Como reproduzir
   - Stack trace (se houver)
   - Sistema operacional

### Quer Contribuir?
1. Leia [CONTRIBUTING.md](CONTRIBUTING.md)
2. Siga os padrões de código
3. Crie uma branch e PR

### Precisa de Ajuda?
- 📖 Consulte a documentação acima
- 📝 Abra uma discussão no GitHub
- 💬 Verifique issues fechadas (podem ter respostas)

---

## 🔗 Links Importantes

### Repositório
- 🌐 [GitHub: claytonmarcelo/Music-Galaxy](https://github.com/claytonmarcelo/Music-Galaxy)
- 📋 Branch: `main`

### Tecnologias
- [React Native](https://reactnative.dev)
- [TypeScript](https://www.typescriptlang.org)
- [Express.js](https://expressjs.com)
- [MariaDB](https://mariadb.com)
- [Expo](https://expo.dev)

### APIs Externas
- [MusicBrainz](https://musicbrainz.org)
- [Discogs](https://www.discogs.com/developers)
- [Cover Art Archive](https://coverartarchive.org)

---

## 📊 Status do Projeto

| Aspecto | Status | Detalhes |
|---------|--------|----------|
| **Banco de Dados** | ✅ Completo | Schema normalizado com 7 tabelas |
| **Backend API** | ✅ Completo | 11/11 endpoints implementados |
| **Frontend** | ✅ Completo | 9 telas + 9 componentes + 4 contextos |
| **Animações** | ✅ Completo | Sistema global com 8 funções reutilizáveis |
| **Modais** | ✅ Completo | Substituição 100% de Alert nativo |
| **TypeScript** | ✅ 0 Erros | Mobile + Backend compilam sem erros |
| **Documentação** | ✅ Completo | README + AGENTS + CONTRIBUTING + RELEASE_NOTES |
| **Production Ready** | ✅ Sim | Pronto para deployment |

---

## 🎓 Roadmap (v1.1+)

- [ ] Autenticação de usuários
- [ ] WebSockets para sync em tempo real
- [ ] Recomendações personalizadas
- [ ] Reprodutor integrado
- [ ] Colaboração em playlists

---

## 📝 Licença

Este projeto é propriedade exclusiva de seus desenvolvedores.

---

## 🙋 Criado por

**Clayton Marcelo**  
GitHub: [@claytonmarcelo](https://github.com/claytonmarcelo)

---

**Última atualização**: 4 de Agosto de 2026  
**Versão**: v1.0.0 ✅
