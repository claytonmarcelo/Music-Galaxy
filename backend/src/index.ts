// Ponto de entrada do servidor Music Galaxy Backend.
// Carrega o ambiente, valida a configuração essencial, testa o banco e
// inicia a aplicação Express criada em app.ts.
// Regra 3: áudio servido pela API vem apenas de sites abertos.

import dotenv from 'dotenv';

import { criarApp } from './app';
import { testarConexaoBanco } from './config/database';

dotenv.config();

const app = criarApp();

function validarAmbiente(): string[] {
  const avisos: string[] = [];
  const porta = parseInt(process.env['PORT'] || '3001', 10);
  if (!Number.isInteger(porta) || porta < 1 || porta > 65535) {
    throw new Error(`PORT inválida: ${process.env['PORT']}`);
  }

  for (const chave of [
    'RATE_LIMIT_WINDOW_MS',
    'RATE_LIMIT_MAX_REQUESTS',
    'RECOGNITION_RATE_LIMIT_WINDOW_MS',
    'RECOGNITION_RATE_LIMIT_MAX_REQUESTS',
  ]) {
    const valor = process.env[chave];
    if (valor !== undefined && (!Number.isFinite(Number(valor)) || Number(valor) <= 0)) {
      throw new Error(`${chave} inválida: ${valor}`);
    }
  }

  if (process.env['NODE_ENV'] === 'production') {
    if (!process.env['CORS_ORIGIN']) {
      avisos.push('CORS_ORIGIN não definida em produção: nenhuma origem de navegador será aceita.');
    }
    if (!process.env['DB_PASSWORD']) {
      avisos.push('DB_PASSWORD vazia em produção — use uma senha para o MariaDB.');
    }
  }

  return avisos;
}

async function iniciar(): Promise<void> {
  try {
    const avisos = validarAmbiente();
    avisos.forEach((aviso) => console.warn(`[SERVER] Aviso: ${aviso}`));

    await testarConexaoBanco();

    const porta = parseInt(process.env['PORT'] || '3001', 10);
    app.listen(porta, '0.0.0.0', () => {
      console.log(`[SERVER] Music Galaxy API rodando em http://0.0.0.0:${porta}`);
      console.log(`[SERVER] Acesso local: http://localhost:${porta}`);
      console.log(`[SERVER] Ambiente: ${process.env['NODE_ENV'] || 'development'}`);
      console.log(`[SERVER] Banco: ${process.env['DB_HOST']}:${process.env['DB_PORT']}/${process.env['DB_NAME']}`);
    });
  } catch (err) {
    console.error('[SERVER] Falha ao iniciar — verifique a conexão com o banco:', err);
    process.exit(1);
  }
}

void iniciar();

export default app;
