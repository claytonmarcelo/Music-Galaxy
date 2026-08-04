// Rotas da API Music Galaxy.
// Agrupa todos os endpoints e aplica validações e middlewares.

import { Router } from 'express';
import { asyncHandler } from '../middleware/errorHandler';
import { validarParametroBusca, validarPaginacao, validarParamId } from '../middleware/validacao';
import { buscarMusicas, forcarIngestion } from '../controllers/searchController';
import { detalharWork, listarReleasesDeWork, listarWorksPorDecada } from '../controllers/worksController';
import { detalharRelease, listarReleasesPorData } from '../controllers/releasesController';
import { listarReleaseTypes } from '../controllers/releaseTypesController';
import { detalharArtista, listarObrasArtista } from '../controllers/artistsController';

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

// GET /api/works/by-decade/:decade
// Obras lançadas em uma década específica (ex: 1990, 2000, 2010)
router.get(
  '/works/by-decade/:decade',
  validarPaginacao,
  asyncHandler(listarWorksPorDecada)
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

// GET /api/releases/by-date
// Releases recentes ordenados por data de criação
router.get(
  '/releases/by-date',
  validarPaginacao,
  asyncHandler(listarReleasesPorData)
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

// ============================================================
// Artistas (Artists)
// ============================================================

// GET /api/artists/:id
// Detalhes de um artista específico
router.get(
  '/artists/:id',
  validarParamId,
  asyncHandler(detalharArtista)
);

// GET /api/artists/:id/works
// Lista todas as obras de um artista
router.get(
  '/artists/:id/works',
  validarParamId,
  validarPaginacao,
  asyncHandler(listarObrasArtista)
);

export default router;
