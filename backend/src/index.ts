// Ponto de entrada do servidor Music Galaxy Backend.
// Inicializa o Express, registra todos os middlewares e rotas,
// verifica a conexão com o banco e inicia o servidor na porta configurada.

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import rateLimit from 'express-rate-limit';

import { testarConexaoBanco } from './config/database';
import routes from './routes';
import { middlewareErros } from './middleware/errorHandler';

// Carrega as variáveis de ambiente do arquivo .env
dotenv.config();

const app = express();
const PORT = parseInt(process.env['PORT'] || '3001', 10);

// ============================================================
// Middlewares de segurança e parsing
// ============================================================

// Helmet — define cabeçalhos HTTP de segurança automaticamente
app.use(helmet());

// CORS — permite requisições do app mobile (Expo) e do localhost
app.use(cors({
  origin: process.env['CORS_ORIGIN'] || '*',
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// Parse de JSON no body das requisições
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));

// Rate limiter geral da API — proteção contra abuso
// Configurável via variáveis de ambiente
const limiteGeral = rateLimit({
  windowMs: parseInt(process.env['RATE_LIMIT_WINDOW_MS'] || '900000', 10), // 15 minutos
  max:      parseInt(process.env['RATE_LIMIT_MAX_REQUESTS'] || '100', 10),
  standardHeaders: true,
  legacyHeaders:   false,
  message: {
    success: false,
    error: 'Muitas requisições. Tente novamente em alguns minutos.',
  },
});
app.use(limiteGeral);

// ============================================================
// Rotas
// ============================================================

// Health check — verificação de saúde do servidor
app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
  });
});

// Informações sobre a API
app.get('/', (_req, res) => {
  res.json({
    name: 'Music Galaxy API',
    version: '1.0.0',
    description: 'API de busca musical com precisão de dados',
    endpoints: {
      busca:          'GET /api/search?q={termo}',
      ingestao:       'POST /api/search/ingest',
      work:           'GET /api/works/:id',
      workReleases:   'GET /api/works/:id/releases',
      release:        'GET /api/releases/:id',
      releaseTypes:   'GET /api/release-types',
      health:         'GET /health',
    },
  });
});

// Todas as rotas da API ficam sob o prefixo /api
app.use('/api', routes);

// ============================================================
// Middleware de erros — deve ser o último registrado
// ============================================================
app.use(middlewareErros);

// ============================================================
// Inicialização do servidor
// ============================================================
async function iniciar(): Promise<void> {
  try {
    // Testa a conexão com o banco antes de aceitar requisições
    await testarConexaoBanco();

    app.listen(PORT, () => {
      console.log(`[SERVER] Music Galaxy API rodando em http://localhost:${PORT}`);
      console.log(`[SERVER] Ambiente: ${process.env['NODE_ENV'] || 'development'}`);
      console.log(`[SERVER] Banco: ${process.env['DB_HOST']}:${process.env['DB_PORT']}/${process.env['DB_NAME']}`);
    });
  } catch (err) {
    console.error('[SERVER] Falha ao iniciar — verifique a conexão com o banco:', err);
    process.exit(1);
  }
}

iniciar();

export default app;
