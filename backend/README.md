# Music Galaxy - Backend API

API Backend para o aplicativo Music Galaxy, construída com Node.js, Express, TypeScript e MariaDB.

## Tecnologias

- **Node.js** - Runtime JavaScript
- **Express** - Framework web
- **TypeScript** - Tipagem estática
- **MariaDB** - Banco de dados relacional
- **mysql2** - Driver MySQL/MariaDB

## Instalação

```bash
# Acessar diretório do backend
cd backend

# Instalar dependências
npm install
```

## Configuração

1. Copie o arquivo `.env.example` para `.env` e ajuste as configurações:
   ```bash
   cp .env.example .env
   ```
2. Certifique-se de que o MariaDB está rodando no WampServer64 na porta 3307
3. Execute os scripts do banco de dados em `../database/`

## Scripts Disponíveis

```bash
npm run dev      # Inicia servidor em modo desenvolvimento
npm run build    # Compila TypeScript para JavaScript
npm start        # Inicia servidor em produção
npm run lint     # Executa ESLint
npm test         # Executa testes
```

## Endpoints da API

### Busca Musical

#### `GET /api/busca`
Busca músicas por termo com todas as versões disponíveis.

**Query Params:**
- `q` (obrigatório) - Termo de busca
- `formato` (opcional) - Filtrar por formato de lançamento
- `tipo_versao` (opcional) - Filtrar por tipo de versão
- `ano` (opcional) - Filtrar por ano de lançamento
- `limite` (opcional) - Limite de resultados (padrão: 50, máximo: 100)
- `offset` (opcional) - Offset para paginação (padrão: 0)

**Exemplo:**
```bash
curl "http://localhost:3001/api/busca?q=daft%20punk&limite=10"
```

#### `GET /api/busca/:id`
Busca detalhes de uma música específica com todas as versões.

**Params:**
- `id` - ID da música

**Exemplo:**
```bash
curl "http://localhost:3001/api/busca/1"
```

#### `GET /api/busca/formatos`
Lista todos os formatos de lançamento disponíveis.

#### `GET /api/busca/tipos-versao`
Lista todos os tipos de versão disponíveis.

### Sistema

#### `GET /health`
Health check da API.

#### `GET /`
Informações sobre a API.

## Regras de Negócio Implementadas

### Regra 1 - Capa Oficial
- A API retorna apenas URLs de capas oficiais
- Campo `capa_disponivel` indica se a capa está disponível
- Nunca gera ou substitui capas artificialmente

### Regra 2 - Pesquisa Completa
- A busca retorna todas as versões disponíveis de uma música
- Cada versão é retornada individualmente
- Suporta filtros por formato, tipo de versão e ano
- Never hides or substitutes versions

## Estrutura do Projeto

```
backend/
├── src/
│   ├── config/          # Configurações (banco de dados)
│   ├── controllers/     # Controladores da API
│   ├── models/          # Modelos de dados TypeScript
│   ├── routes/          # Rotas da API
│   ├── services/        # Serviços de negócio
│   ├── middleware/      # Middleware Express
│   └── index.ts         # Ponto de entrada
├── package.json
├── tsconfig.json
└── .env                 # Variáveis de ambiente
```

## Desenvolvimento

O servidor de desenvolvimento recarrega automaticamente quando há alterações nos arquivos TypeScript.

```bash
npm run dev
```

## Produção

Para produção:

```bash
# Compilar TypeScript
npm run build

# Iniciar servidor
npm start
```

## Segurança

- Helmet para headers de segurança
- CORS configurável
- Rate limiting para prevenir abuso
- Validação de entrada
- Tratamento de erros apropriado

## Troubleshooting

### Erro de conexão com banco de dados
- Verifique se o WampServer64 está rodando
- Verifique as credenciais no arquivo `.env`
- Verifique se o banco de dados `musicgalaxy` existe

### Erro de compilação TypeScript
- Certifique-se de que todas as dependências estão instaladas
- Verifique se o `tsconfig.json` está configurado corretamente
