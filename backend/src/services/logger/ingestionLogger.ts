// Sistema de log de ingestão de dados externos.
// Toda operação de busca em fontes externas é registrada na tabela ingestion_log,
// garantindo rastreabilidade completa de cada capa e versão armazenada.

import pool from '../../config/database';
import { ParametrosLogIngestion } from '../../types';

// Registra o resultado de uma operação de ingestão no banco de dados.
// Falhas no log não devem interromper o fluxo principal da API.
export async function registrarLogIngestion(params: ParametrosLogIngestion): Promise<void> {
  try {
    await pool.execute(
      `INSERT INTO ingestion_log
         (metadata_source_id, request_type, request_query, status, error_message, works_created, releases_created)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        params.metadata_source_id,
        params.request_type,
        params.request_query,
        params.status,
        params.error_message ?? null,
        params.works_created ?? 0,
        params.releases_created ?? 0,
      ]
    );
  } catch (err) {
    // Log silencioso — falha no registro de log não deve quebrar a aplicação
    console.error('[INGESTION_LOG] Falha ao registrar log de ingestão:', err);
  }
}

// Emite eventos de observabilidade no console de forma estruturada.
// Facilita monitoramento e integração futura com ferramentas de APM.
export function emitirEvento(
  evento: 'INGESTION_STARTED' | 'INGESTION_COMPLETED' | 'INGESTION_FAILED' | 'INGESTION_CACHE_HIT' | 'INGESTION_RATE_LIMITED',
  dados: Record<string, unknown>
): void {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] [${evento}]`, JSON.stringify(dados));
}
