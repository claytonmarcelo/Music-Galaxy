# Contribuindo para Music Galaxy

Obrigado por estar interessado em contribuir para o Music Galaxy! Este documento descreve como você pode participar do desenvolvimento.

## 📋 Antes de Começar

Leia o `README.md` e `AGENTS.md` para entender:
- A arquitetura do projeto
- As Regras de Negócio (especialmente Regra 1 e Regra 2)
- A stack tecnológica obrigatória
- As instruções para agentes de IA

## 🛠️ Setup de Desenvolvimento

### Pré-requisitos
- Node.js v16+ com npm
- WampServer64 com MariaDB (porta 3307)
- Git configurado
- VS Code ou editor de sua preferência

### Instalação

```bash
# 1. Clone o repositório
git clone https://github.com/claytonmarcelo/Music-Galaxy.git
cd Music-Galaxy

# 2. Configure o banco de dados
mysql -u root -p -P 3307 musicgalaxy < database/schema.sql

# 3. Configure o backend
cd backend
npm install
cp .env.example .env
# Edite .env com suas credenciais (MariaDB, MusicBrainz, Discogs)
npm run dev

# 4. Em outro terminal, configure o frontend
cd mobile
npm install
npm start

# 5. Use Expo Go no celular ou emulador para testar
```

## 📐 Arquitetura

### Frontend (React Native + TypeScript + Expo SDK 57)
```
mobile/
├── src/
│   ├── components/       # Componentes reutilizáveis (ModalPersonalizado, ToastNotificacao, etc)
│   ├── screens/          # Telas do app (BuscaScreen, DetalheWorkScreen, etc)
│   ├── contexts/         # Context API (ModalContext, TemaContext, etc)
│   ├── hooks/            # Hooks customizados (useModalGlobal)
│   ├── services/         # API client (api.ts)
│   ├── types/            # Definições TypeScript
│   ├── utils/            # Utilitários (animacoes.ts, formatadores.ts)
│   └── navigation/       # React Navigation setup
├── App.tsx               # Entry point com Providers
└── package.json
```

### Backend (Node.js + TypeScript + Express)
```
backend/
├── src/
│   ├── config/           # Configurações (database.ts)
│   ├── controllers/      # Lógica de requisições
│   ├── routes/           # Definição de rotas
│   ├── services/         # Lógica de negócio
│   │   ├── ingestion/    # Orquestrador de APIs externas
│   │   ├── cache/        # Cache em MariaDB
│   │   ├── rateLimiting/ # Rate limiting
│   │   └── sources/      # Adapters (MusicBrainz, Discogs)
│   ├── middleware/       # Middleware Express
│   ├── types/            # Definições TypeScript
│   └── index.ts          # Entry point
└── package.json
```

### Banco de Dados (MariaDB)
```sql
-- Tabelas principais
CREATE TABLE artists (...)          -- Artistas/bandas
CREATE TABLE works (...)            -- Obras musicais (conceituais)
CREATE TABLE releases (...)         -- Versões/lançamentos específicos
CREATE TABLE release_types (...)    -- Catálogo de tipos
CREATE TABLE metadata_sources (...) -- Fontes de dados
CREATE TABLE external_api_cache (...) -- Cache de APIs externas
CREATE TABLE ingestion_log (...)    -- Auditoria de ingestão
```

## 🎨 Padrões de Código

### TypeScript
- Use tipos explícitos em funções (não inferir)
- Implemente interfaces para dados estruturados
- Evite `any` — use tipos genéricos se necessário

Exemplo:
```typescript
// ✅ BOM
interface Release {
  id: number;
  version_name: string;
  album_name: string;
  release_year: number;
}

function buscarReleases(termo: string): Promise<Release[]> {
  // ...
}

// ❌ RUIM
function buscarReleases(termo: any): any {
  // ...
}
```

### Comentários
- Escreva comentários em **português brasileiro**
- Explique o *por quê*, não o *o quê*
- Use comentários para documentar decisões técnicas

Exemplo:
```typescript
// ✅ BOM
// Divide o termo em palavras para suportar buscas como "Daft Punk One More Time"
// Cada palavra vira um LIKE independente, combinados com AND
const palavras = termo.trim().split(/\s+/).filter(p => p.length >= 2);

// ❌ RUIM
// Split no termo
const palavras = termo.trim().split(/\s+/);
```

### React Native + Animated
- Reutilize funções de `animacoes.ts`
- Use `Animated` para animações suaves (nativa)
- Evite re-renders desnecessários com `useMemo`

Exemplo:
```typescript
// ✅ BOM
import { fadeInOut, scaleSpring } from '../utils/animacoes';

function MeuComponente() {
  return (
    <Animated.View style={[styles.container, fadeInOut(animValue)]}>
      {/* conteúdo */}
    </Animated.View>
  );
}

// ❌ RUIM - Não reutiliza funções globais
const fadeAnim = new Animated.Value(0);
Animated.timing(fadeAnim, {
  toValue: 1,
  duration: 300,
  useNativeDriver: true,
}).start();
```

### Context API
- Use Context apenas para estado global (tema, modais, favoritos)
- Não use para estado local (use `useState`)
- Implemente hooks customizados (ex: `useModalGlobal()`)

Exemplo:
```typescript
// ✅ BOM - Contexto global
const { abrirSucesso, toastErro } = useModalGlobal();

// ❌ RUIM - Estado local em contexto
const [inputValue, setInputValue] = useState('');
```

### Modais e Alertas
- **NUNCA** use `Alert.alert()` nativo
- **SEMPRE** use `useModalGlobal()` para modais personalizados
- Use `toastSucesso()`, `toastErro()`, etc para notificações

Exemplo:
```typescript
// ✅ BOM
const { abrirSucesso, toastErro } = useModalGlobal();

try {
  await adicionarFavorito(releaseId);
  toastSucesso('Release adicionada aos favoritos!');
} catch (err) {
  toastErro('Erro ao adicionar favorito');
}

// ❌ RUIM
Alert.alert('Sucesso', 'Release adicionada!');
Alert.alert('Erro', 'Não consegui adicionar');
```

## 🎬 Animações

### Usar Funções Globais
```typescript
import { 
  TIMINGS, 
  EASING, 
  fadeInOut, 
  scaleSpring, 
  slideVertical 
} from '../utils/animacoes';

// Timings
const duracao = TIMINGS.normal; // 300ms

// Easing
const easing = EASING.suave;

// Funções
<Animated.View style={fadeInOut(animValue, TIMINGS.lenta)}>
  {/* conteúdo com fade suave */}
</Animated.View>
```

### Não Duplicar Animações
```typescript
// ❌ RUIM - Define animação em cada componente
const fadeAnim = new Animated.Value(0);
Animated.timing(fadeAnim, {
  toValue: 1,
  duration: 300,
  useNativeDriver: true,
}).start();

// ✅ BOM - Reutiliza animacoes.ts
import { fadeInOut, TIMINGS } from '../utils/animacoes';
const style = fadeInOut(animValue, TIMINGS.normal);
```

## 📡 API & Backend

### Criar Novo Endpoint

1. **Defina o tipo** em `backend/src/types/index.ts`
2. **Implemente o controller** em `backend/src/controllers/`
3. **Registre a rota** em `backend/src/routes/index.ts`
4. **Adicione validação** em `backend/src/middleware/validacao.ts`

Exemplo:
```typescript
// backend/src/types/index.ts
export interface Artista {
  id: number;
  name: string;
  country: string;
}

// backend/src/controllers/artistsController.ts
export async function detalharArtista(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { id } = req.params;
    const artista = await obterArtista(id);
    res.json({ success: true, data: artista });
  } catch (err) {
    next(err);
  }
}

// backend/src/routes/index.ts
router.get('/artists/:id', validarParamId, asyncHandler(detalharArtista));
```

### Testar Endpoints
```bash
# GET
curl "http://localhost:3001/api/search?q=daft%20punk&limit=10"

# POST
curl -X POST http://localhost:3001/api/search/ingest \
  -H "Content-Type: application/json" \
  -d '{"q": "daft punk"}'

# Verificar banco
mysql -u root -p -P 3307 musicgalaxy -e "SELECT * FROM releases LIMIT 5;"
```

## 🧪 Testes

### Verificar TypeScript
```bash
# Frontend
cd mobile
npx tsc --noEmit

# Backend
cd backend
npx tsc --noEmit
```

### Testes Manuais
1. Abra Expo em um terminal: `cd mobile && npm start`
2. Use Expo Go no celular ou emulador
3. Navegue pelas telas
4. Teste buscas, favoritos, tema alternado
5. Verifique console para erros

## 🔐 Regras Obrigatórias

### Regra 1 — Capa Oficial
- **Nunca** gere capas com IA
- **Nunca** crie capas fictícias
- **Nunca** use capas de outra música
- **Sempre** exiba `null` em `cover_url` se não houver capa oficial

### Regra 2 — Pesquisa Completa
- **Nunca** oculte ou substitua versões
- **Sempre** retorne todas as versões encontradas
- **Sempre** suporte múltiplos formatos e tipos

### Stack Obrigatória
- ❌ **Nunca** adicione Firebase, Supabase, GraphQL
- ❌ **Nunca** use Redux Toolkit Query ou outros gerenciadores de estado
- ❌ **Nunca** adicione ORMs (use `mysql2` diretamente)
- ✅ **Sempre** use: React Native, TypeScript, Expo SDK 57, Node.js, MariaDB

### Porta do Banco
- **FIXO**: MariaDB porta **3307** (não alterar sem aprovação)
- Configurável via `.env` `DB_PORT=3307`

## 🔄 Workflow de Contribuição

### 1. Criar Branch
```bash
git checkout -b feature/minha-feature
# ou para bug fix:
git checkout -b fix/meu-bug
```

### 2. Fazer Mudanças
- Edite os arquivos necessários
- Mantenha comentários em português
- Siga os padrões acima

### 3. Testar Localmente
```bash
# Frontend
cd mobile && npx tsc --noEmit

# Backend
cd backend && npx tsc --noEmit

# Teste manual no emulador/celular
```

### 4. Commit com Mensagem Clara
```bash
git add .
git commit -m "✨ Adicionar [funcionalidade]

- Detalhe 1
- Detalhe 2
- Detalhe 3"
```

**Prefixos de commit recomendados:**
- `✨` - Feature nova
- `🐛` - Bug fix
- `📖` - Documentação
- `♻️` - Refatoração
- `🔧` - Configuração
- `⚡` - Performance

### 5. Push e Pull Request
```bash
git push origin feature/minha-feature
```

Crie um PR no GitHub com:
- Título claro do que foi feito
- Descrição das mudanças
- Screenshots/videos se aplicável
- Checklist de testes

### 6. Code Review
- Espere revisão do desenvolvedor principal
- Responda aos comentários
- Faça ajustes se solicitado

### 7. Merge
- Rebase se necessário: `git rebase main`
- Merge into main: `git merge feature/minha-feature`

## 📚 Referências

- [React Native Docs](https://reactnative.dev)
- [TypeScript Handbook](https://www.typescriptlang.org/docs)
- [Express.js Guide](https://expressjs.com)
- [MariaDB Documentation](https://mariadb.com/docs)
- [MusicBrainz API](https://musicbrainz.org/doc/Development/XML_Web_Service)
- [Discogs API](https://www.discogs.com/developers)

## ❓ Dúvidas?

Consulte:
- `AGENTS.md` para instruções técnicas
- `README.md` para overview
- `RELEASE_NOTES.md` para o que foi implementado
- Abra uma issue no GitHub

---

**Obrigado por contribuir para Music Galaxy!** 🎵✨
