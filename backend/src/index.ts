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

// Helmet — define cabeçalhos HTTP de segurança
// Em desenvolvimento, desabilita CSP para não bloquear o Expo web
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false,
  crossOriginResourcePolicy: { policy: 'cross-origin' },
}));

// CORS — permite requisições do app mobile (Expo) e do browser local
// Aceita qualquer origem em desenvolvimento para facilitar testes no browser,
// Expo Go no celular e emuladores Android/iOS.
app.use(cors({
  origin: (origin, callback) => {
    // Permite requisições sem origin (apps nativos, curl, Postman)
    if (!origin) return callback(null, true);
    // Em desenvolvimento aceita tudo; em produção restringir por lista
    if (process.env['NODE_ENV'] !== 'production') return callback(null, true);
    // Em produção usa a variável de ambiente CORS_ORIGIN
    const permitidas = (process.env['CORS_ORIGIN'] || '*').split(',').map(o => o.trim());
    if (permitidas.includes('*') || permitidas.includes(origin)) {
      return callback(null, true);
    }
    return callback(new Error(`Origem não permitida: ${origin}`));
  },
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
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

    app.listen(PORT, '0.0.0.0', () => {
      console.log(`[SERVER] Music Galaxy API rodando em http://0.0.0.0:${PORT}`);
      console.log(`[SERVER] Acessar de http://localhost:${PORT}, http://127.0.0.1:${PORT} ou http://192.168.0.153:${PORT}`);
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
