Music Galaxy
O Music Galaxy é um aplicativo de busca musical projetado para DJs, colecionadores, produtores e pesquisadores, com foco absoluto em precisão e veracidade dos dados — nunca inventando informações, apenas refletindo o que existe nas fontes consultadas.
Principais Pilares
🎯 Regras Fundamentais
Capa Oficial Apenas: Exibe somente a arte original disponível nas fontes; sem IA, sem imagens fictícias ou modificadas.
Resultado Completo: Retorna todas as versões de uma obra — qualquer formato (álbum, single, promo, bootleg legal etc.) e qualquer variação (remix, edit, instrumental, playback etc.).
🛠️ Tecnologias Utilizadas
Tabela
Camada	Tecnologias
Aplicativo	React Native + TypeScript + Expo SDK 57
Servidor	Node.js + TypeScript + Express
Banco de Dados	MariaDB (porta 3307 via WampServer64)
📡 Fontes de Dados Integradas
MusicBrainz: Metadados completos de obras e artistas
Cover Art Archive: Capas oficiais
Discogs: Detalhes de lançamentos físicos e variações
Estrutura e Funcionamento
O endpoint principal (GET /api/search) primeiro consulta o banco local; se não encontrar ou se os dados estiverem desatualizados, busca automaticamente nas fontes externas e armazena em cache.
O banco é normalizado: separa artistas, obras e cada lançamento/versão individualmente — garantindo que nenhuma informação seja perdida ou substituída.
Há sistema de auditoria, respeito aos limites de requisição das APIs e regras claras de uso para evitar bloqueios.
Status Atual
✅ Banco de dados estruturado
✅ API REST implementada
✅ Interface básica do aplicativo pronta
🔄 Em desenvolvimento: Integração definitiva com Discogs/MusicBrainz, tela de detalhes, favoritos e filtros avançados.
Gostaria que eu transformasse essa documentação em um guia rápido de instalação, um diagrama de funcionamento ou até um resumo executivo para apresentar o projeto?
melhore este readme.md de forma profissional completo.
Music Galaxy
Busca musical com precisão absoluta: dados reais, fontes confiáveis, nenhuma informação inventada.
Sumário
Sobre o Projeto
Princípios Fundamentais
Público-Alvo
Stack Tecnológica
Estrutura do Projeto
Instalação e Configuração
Documentação da API
Modelo de Dados
Integração com Fontes Externas
Fluxo de Busca e Cache
Validação e Testes
Próximos Passos
Resolução de Problemas
Licença e Suporte
Sobre o Projeto
O Music Galaxy é uma plataforma de busca musical desenvolvida para entregar a máxima completude e fidelidade de dados. Seu diferencial é a política de nunca gerar ou inventar informações: capas, versões, formatos e detalhes refletem exclusivamente o que é registrado nas fontes oficiais consultadas.
Diferente de soluções generalistas, ele foi projetado para localizar todas as variações de uma mesma obra — atendendo a demandas que exigem exatidão sobre lançamentos e versões.
Princípios Fundamentais
🎨 Regra 1 — Capa Oficial Exclusiva
Apenas a arte oficial correspondente ao resultado é exibida, quando disponível na fonte consultada.
Proibido: geração de capas por IA, criação de imagens fictícias, uso de capas de outras obras/artistas, modificação de artes ou substituição por imagens semelhantes.
Se não houver capa oficial disponível, nenhuma imagem é apresentada no lugar.
🔍 Regra 2 — Busca Completa e Inalterada
Todas as versões existentes de uma obra são retornadas, independentemente do formato ou edição.
Formatos suportados: Álbum, Single, EP, Maxi Single, CD Single, Promo, White Label, Coletâneas, Box Set, Deluxe Edition, Remastered, Reissue, Trilha Sonora, Bootleg (legal), Demo, Ao Vivo, entre outros.
Versões suportadas: Instrumental, Acapella, Karaokê, Radio Edit, Extended Mix, Club Mix, Remix, Dub Mix, VIP Mix, Reelaboração, Mashup, Versão DJ, entre outras.
Público-Alvo
DJs
Colecionadores de discos e mídias
Produtores e profissionais da música
Pesquisadores e arquivistas musicais
Entusiastas que buscam versões específicas de obras
Stack Tecnológica
Tabela
Camada	Tecnologias
Aplicativo	React Native + TypeScript + Expo SDK 57
Backend	Node.js + TypeScript + Express
Banco de Dados	MariaDB (porta 3307 via WampServer64)
Integrações	MusicBrainz, Cover Art Archive, Discogs
Segurança	Helmet, CORS, Rate Limiting
Estrutura do Projeto
plaintext
musicgalaxy/
├── mobile/                    # Aplicativo React Native
│   ├── src/
│   │   ├── components/        # Componentes reutilizáveis
│   │   ├── screens/           # Telas do aplicativo
│   │   ├── services/          # Comunicação com API
│   │   ├── types/             # Definições TypeScript
│   │   ├── navigation/        # Configuração de rotas
│   │   └── styles/            # Estilos e temas globais
│   ├── App.tsx
│   ├── package.json
│   └── index.ts
│
├── backend/                   # API REST
│   ├── src/
│   │   ├── config/            # Conexão com banco e variáveis
│   │   ├── controllers/      # Lógica das requisições
│   │   ├── models/            # Modelos de dados
│   │   ├── routes/            # Definição de endpoints
│   │   ├── services/          # Regras de negócio e integrações
│   │   ├── types/             # Tipos e interfaces
│   │   ├── middleware/       # Tratamento de requisições
│   │   └── index.ts           # Entrada da aplicação
│   ├── package.json
│   ├── tsconfig.json
│   └── .env.example
│
├── database/                  # Scripts do banco
│   ├── schema.sql             # Estrutura completa
│   ├── seeds/                 # Dados iniciais
│   └── README.md
│
├── AGENTS.md                  # Orientações para agentes de IA
└── README.md                  # Documentação principal

Instalação e Configuração
Pré-requisitos
Node.js 20+
WampServer64 (com MariaDB ativado na porta 3307)
Expo CLI (npm install -g @expo/cli)
1. Banco de Dados
Acesse o phpMyAdmin em http://localhost/phpmyadmin e crie o banco musicgalaxy. Execute o script:
bash
mysql -u root -p -P 3307 musicgalaxy < database/schema.sql

2. Backend
bash
cd backend
npm install
cp .env.example .env

Edite o .env com credenciais do banco, chaves das APIs e e-mail válido para o User-Agent do MusicBrainz. Inicie o servidor:
bash
npm run dev

A API estará disponível em http://localhost:3001
3. Aplicativo Mobile
bash
cd mobile
npm install
npm start

Use o Expo Go no celular ou emulador para visualizar o projeto.
Documentação da API
Busca Musical
Tabela
Método	Endpoint	Descrição
GET	/api/search?q={termo}	Busca principal (consulta cache e fontes externas)
POST	/api/search/ingest	Sincronização manual (uso interno/administrativo)
Parâmetros da busca:
q (obrigatório): termo de pesquisa
limit (opcional): máximo de resultados (padrão 50, máximo 100)
offset (opcional): paginação (padrão 0)
category (opcional): filtro por tipo de lançamento/versão
Resposta padrão:
json
{
  "success": true,
  "data": {
    "results": [],
    "total": 100,
    "page": 1,
    "per_page": 50,
    "fromCache": true
  }
}

Demais Endpoints
GET /api/works/:id → Detalhes de uma obra
GET /api/works/:id/releases → Todas as versões de uma obra
GET /api/releases/:id → Detalhes de um lançamento
GET /api/release-types → Lista completa de tipos de lançamento
GET /health → Verificação de status da API
Modelo de Dados
O banco segue estrutura normalizada para evitar duplicações e preservar a separação entre obra e lançamento:
Tabela
Tabela	Finalidade
artists	Dados de artistas e bandas
works	Obras musicais (conceito original, independente de versão)
releases	Cada lançamento/versão específica de uma obra
release_types	Catálogo fixo com mais de 60 tipos de lançamento/versão
metadata_sources	Registro das fontes consultadas
external_api_cache	Cache de respostas de APIs externas
ingestion_log	Auditoria de todas as importações de dados
Integração com Fontes Externas
Fontes Oficiais
MusicBrainz: Base aberta e confiável de metadados musicais
Cover Art Archive: Capas oficiais vinculadas ao MusicBrainz
Discogs: Detalhes completos de formatos físicos e variações
Regras de Integração
Respeito aos limites de requisição: 1 req/s no MusicBrainz; 60 req/min no Discogs (autenticado)
Dados armazenados em cache no MariaDB conforme TTL configurado
Todas as operações registradas para rastreabilidade
Configuração Obrigatória no .env
env
MUSICBRAINZ_USER_AGENT=MusicGalaxy/1.0 (contato: seu-email@valido.com.br)
DISCOGS_TOKEN=seu_token_pessoal_discogs
DISCOGS_USER_AGENT=MusicGalaxy/1.0

⚠️ O User-Agent do MusicBrainz requer e-mail válido — valores genéricos causam bloqueio. O token do Discogs deve ser gerado na sua conta do serviço.
Fluxo de Busca e Cache
O usuário envia o termo de busca
A API consulta primeiro o banco local
Se não houver dados ou estiverem vencidos:
Busca nas fontes externas
Armazena os dados novos no banco e no cache
Registra a operação no log de auditoria
Retorna os resultados completos ao aplicativo
Validação e Testes
Após implementar as integrações, confirme o funcionamento completo:
bash
# 1. Primeira busca — deve popular banco e cache
curl "http://localhost:3001/api/search?q=One%20More%20Time%20Daft%20Punk"

# 2. Busca repetida — deve retornar do cache
curl "http://localhost:3001/api/search?q=One%20More%20Time%20Daft%20Punk"

# 3. Verificar cache no banco
mysql -u root -p -P 3307 musicgalaxy -e \
  "SELECT request_key, fetched_at, expires_at FROM external_api_cache;"

# 4. Verificar auditoria
mysql -u root -p -P 3307 musicgalaxy -e \
  "SELECT metadata_source_id, request_type, status, works_created, releases_created FROM ingestion_log ORDER BY created_at DESC LIMIT 10;"

Próximos Passos
 Finalizar integração com Discogs e MusicBrainz
 Implementar tela de detalhes de obra e lançamento
 Sistema de favoritos e histórico de buscas
 Filtros avançados por formato, país, ano e selo
 Suporte a tema escuro e melhorias de acessibilidade
 Painel administrativo para gestão de cache e sincronização
Resolução de Problemas
Tabela
Problema	Solução
Falha na conexão com o banco	Verifique se o WampServer está ativo, porta 3307 e credenciais corretas
Instalação de dependências	Limpe o cache do npm, remova node_modules e instale novamente
Expo não inicia	Confira porta 19000 livre, use expo start --clear ou ajuste firewall
APIs externas bloqueiam requisições	Atualize o User-Agent com e-mail válido e verifique o token do Discogs
Licença e Suporte
Este projeto é propriedade exclusiva de seus desenvolvedores. Para dúvidas, orientações técnicas ou contribuições, consulte o arquivo AGENTS.md ou entre em contato com a equipe responsável.
