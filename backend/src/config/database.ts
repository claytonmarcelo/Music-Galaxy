// Configuração da conexão com o banco de dados MariaDB.
// Usa pool de conexões para eficiência em requisições concorrentes.
// A porta 3307 é definitiva para o ambiente WampServer64 — não alterar.

import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

// Pool de conexões — reutiliza conexões abertas em vez de abrir uma nova por requisição.
const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '3307', 10),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'musicgalaxy',
  waitForConnections: true,
  connectionLimit: 10,       // Máximo de conexões simultâneas no pool
  queueLimit: 0,             // Sem limite de fila de espera por conexão
  charset: 'utf8mb4',
  timezone: 'local',
});

// Verifica se a conexão com o banco está funcionando ao iniciar o servidor.
export async function testarConexaoBanco(): Promise<void> {
  const conn = await pool.getConnection();
  conn.release();
  console.log('[DB] Conexão com MariaDB estabelecida com sucesso.');
}

export default pool;
