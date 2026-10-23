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
import { streamAudio, downloadAudio, definirFonteAudio } from '../controllers/audioController';
import { reconhecerMusicaNoAudio } from '../controllers/recognitionController';
import { publicarVersao } from '../controllers/appController';

const router = Router();

// ============================================================
// Versão publicada do aplicativo
// ============================================================
// O aplicativo consulta esta rota para saber se existe uma versão nova
// para download. A resposta vem do ambiente do servidor (ver
// services/appVersion.ts) — publicar uma versão nova não exige
// recompilar o aplicativo.

router.get('/app/versao', publicarVersao);

// ============================================================
// Reconhecimento sonoro
// ============================================================
// Cada tentativa consome uma requisição do serviço externo de reconhecimento,
// por isso a rota tem limite próprio, mais restrito que o limite geral.
//
// O limitador é montado em `app.ts`, ANTES do parser de corpo de 3 MB: assim
// a tentativa é recusada sem receber e decodificar o corpo inteiro da amostra.

// POST /api/recognize
// Recebe a amostra de áudio capturada pelo microfone e devolve a
// identificação. O áudio não é gravado em disco nem no banco de dados.
router.post(
  '/recognize',
  asyncHandler(reconhecerMusicaNoAudio)
);

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

// GET /api/works/by-decade/:decade
// Obras lançadas em uma década específica (ex: 1990, 2000, 2010).
// Atenção: rota estática precisa vir ANTES de /works/:id,
// senão "by-decade" é interpretado como um id e retorna 400.
router.get(
  '/works/by-decade/:decade',
  validarPaginacao,
  asyncHandler(listarWorksPorDecada)
);

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

// GET /api/releases/by-date
// Releases recentes ordenados por data de criação.
// Atenção: esta rota estática precisa vir ANTES de /releases/:id,
// senão "by-date" é interpretado como um id e retorna 400.
router.get(
  '/releases/by-date',
  validarPaginacao,
  asyncHandler(listarReleasesPorData)
);

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

// ============================================================
// Áudio (Streaming e Download via sites abertos — Regra 3)
// Proibido: YouTube, Spotify, Deezer, iTunes e qualquer plataforma de música.
// Fontes permitidas: blogs, fóruns, homepages e links diretos do mundo inteiro.
// ============================================================

// GET /api/releases/:id/stream
// Proxy de streaming da URL direta descoberta em site aberto (com suporte a Range)
router.get(
  '/releases/:id/stream',
  validarParamId,
  asyncHandler(streamAudio)
);

// GET /api/releases/:id/download
// Entrega o áudio completo como arquivo .mp3/.flac (cache permanente + dedup)
router.get(
  '/releases/:id/download',
  validarParamId,
  asyncHandler(downloadAudio)
);

// POST /api/releases/:id/audio-source  { url }
// Registra uma fonte de áudio em site aberto fornecida pelo usuário/painel.
// A URL é validada contra o guard anti-SSRF e a lista negra de plataformas.
router.post(
  '/releases/:id/audio-source',
  validarParamId,
  asyncHandler(definirFonteAudio)
);

export default router;
