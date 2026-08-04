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
- `GET /api/search?q={termo}` - **único endpoint que o app mobile chama para busca.** Internamente, consulta primeiro o banco local; se não houver resultado local, ou os dados existentes estiverem além do TTL de `external_api_cache`, o próprio endpoint dispara a ingestão das fontes externas através do orquestrador antes de responder.
- `POST /api/search/ingest` - endpoint administrativo/interno, fora do fluxo normal do app. Serve apenas para forçar resincronização manual de um termo (script de manutenção, painel administrativo futuro). Documentado como "uso interno apenas" até existir camada de autenticação.
- `GET /api/works/:id` - Detalhes de obra específica
- `GET /api/works/:id/releases` - Lista versões de uma obra
- `GET /api/releases/:id` - Detalhes de release específico
- `GET /api/release-types` - Lista catálogo de tipos

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
2. **Flexibilização das Regras 1 ou 2** - Nunca flexibilizar sem autorização explícita

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

## Integração com Fontes Externas

### Fontes de Dados
- **MusicBrainz** - Banco de dados aberto de metadados musicais
- **Cover Art Archive** - Capas oficiais associadas ao MusicBrainz
- **Discogs** - Catálogo com detalhes de formatos físicos e variações

### Estrutura de Integração
```
backend/src/services/
├── sources/
│   ├── types.ts
│   ├── musicBrainzAdapter.ts
│   └── discogsAdapter.ts
├── cache/
│   └── externalApiCache.ts
├── rateLimiting/
│   └── rateLimiter.ts
└── ingestion/
    ├── searchOrchestrator.ts
    └── ingestionLogger.ts
```

### Configuração
Adicionar ao `backend/.env`:
```env
MUSICBRAINZ_USER_AGENT=MusicGalaxy/1.0 (contato: seu-email@exemplo.com)
DISCOGS_TOKEN=seu_token_pessoal_discogs
DISCOGS_USER_AGENT=MusicGalaxy/1.0
```

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
