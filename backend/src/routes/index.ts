// Rotas da API Music Galaxy.
// Agrupa todos os endpoints e aplica validações e middlewares.

import { Router } from 'express';
import { asyncHandler } from '../middleware/errorHandler';
import { validarParametroBusca, validarPaginacao, validarParamId } from '../middleware/validacao';
import { buscarMusicas, forcarIngestion } from '../controllers/searchController';
import { detalharWork, listarReleasesDeWork } from '../controllers/worksController';
import { detalharRelease } from '../controllers/releasesController';
import { listarReleaseTypes } from '../controllers/releaseTypesController';

const router = Router();

// ============================================================
// Busca Musical
// ============================================================

// GET /api/search?q={termo}
// Busca principal — consulta banco local primeiro, se necessário dispara ingestão.
router.get(
  '/search',
  validarParametroBusca,
  validarPaginacao,
  asyncHandler(buscarMusicas)
);

// POST /api/search/ingest
// Administrativo/interno — força resincronização manual de um termo.
// Documentado como "uso interno apenas" até existir camada de autenticação.
router.post(
  '/search/ingest',
  asyncHandler(forcarIngestion)
);

// ============================================================
// Obras (Works)
// ============================================================

// GET /api/works/:id
// Detalhes de uma obra específica
router.get(
  '/works/:id',
  validarParamId,
  asyncHandler(detalharWork)
);

// GET /api/works/:id/releases
// Lista todas as versões de uma obra
router.get(
  '/works/:id/releases',
  validarParamId,
  validarPaginacao,
  asyncHandler(listarReleasesDeWork)
);

// ============================================================
// Releases (Versões)
// ============================================================

// GET /api/releases/:id
// Detalhes de uma versão específica
router.get(
  '/releases/:id',
  validarParamId,
  asyncHandler(detalharRelease)
);

// ============================================================
// Catálogo de Tipos
// ============================================================

// GET /api/release-types
// Lista o catálogo completo de tipos de release disponíveis
router.get(
  '/release-types',
  asyncHandler(listarReleaseTypes)
);

export default router;
