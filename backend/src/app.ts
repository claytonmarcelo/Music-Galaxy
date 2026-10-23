// Aplicação Express do Music Galaxy.
// Separada do ponto de entrada (index.ts) para que os testes de integração
// possam montar a aplicação em uma porta efêmera sem iniciar o servidor real
// nem duplicar o registro de rotas e middlewares.

import express, { Express } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';

import routes from './routes';
import { middlewareErros } from './middleware/errorHandler';

// ============================================================
// Configuração de CORS
// ============================================================
// Em desenvolvimento aceita qualquer origem para facilitar o Expo web e o
// Expo Go no celular. Em produção, somente as origens de CORS_ORIGIN.
function origemPermitida(origin: string | undefined): boolean {
  if (!origin) return true; // apps nativos, curl e testes não enviam Origin
  if (process.env['NODE_ENV'] !== 'production') return true;

  const permitidas = (process.env['CORS_ORIGIN'] || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

  // Sem lista configurada em produção, nega qualquer origem de navegador.
  return permitidas.includes(origin);
}

// ============================================================
// Fábrica da aplicação
// ============================================================
export function criarApp(): Express {
  const app = express();

  app.use(helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  }));

  app.use(cors({
    origin: (origin, callback) => {
      if (origemPermitida(origin)) return callback(null, true);
      return callback(new Error(`Origem não permitida: ${origin}`));
    },
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
  }));

  // O reconhecimento sonoro recebe uma amostra de áudio em base64 — o limite
  // padrão de 10kb não serviria. Este parser é registrado ANTES do parser
  // geral: o body-parser marca o corpo como já lido (`req._body`) e o parser
  // geral o ignora, evitando o erro 413 em rotas normais.
  app.use('/api/recognize', express.json({ limit: '3mb' }));

  // Corpo pequeno: a API só recebe termos de busca e URLs de fonte.
  app.use(express.json({ limit: '10kb' }));
  app.use(express.urlencoded({ extended: true, limit: '10kb' }));

  // Rate limit geral — configurável por ambiente.
  const limiteGeral = rateLimit({
    windowMs: parseInt(process.env['RATE_LIMIT_WINDOW_MS'] || '900000', 10),
    max:      parseInt(process.env['RATE_LIMIT_MAX_REQUESTS'] || '100', 10),
    standardHeaders: true,
    legacyHeaders:   false,
    message: {
      success: false,
      error: 'Muitas requisições. Tente novamente em alguns minutos.',
    },
  });
  app.use(limiteGeral);

  // Health check — não consulta o banco para continuar respondendo mesmo
  // durante uma indisponibilidade do MariaDB.
  app.get('/health', (_req, res) => {
    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      version: '1.0.0',
    });
  });

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
        reconhecer:     'POST /api/recognize',
        versaoApp:      'GET /api/app/versao',
        health:         'GET /health',
      },
    });
  });

  app.use('/api', routes);

  // Middleware de erros sempre por último.
  app.use(middlewareErros);

  return app;
}
