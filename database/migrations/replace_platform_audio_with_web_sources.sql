-- ============================================================
-- Migração: fontes de áudio de plataformas → sites abertos
-- Data: 2026-10-22
--
-- JUSTIFICATIVA TÉCNICA (obrigatória para alteração de schema):
-- A Regra 3 do AGENTS.md proíbe o uso de YouTube, Spotify, Deezer,
-- iTunes/Apple Music e qualquer plataforma de música semelhante.
-- O áudio passa a ser descoberto exclusivamente em sites abertos
-- (blogs, fóruns, links diretos) pelo sistema audioSource/.
--
-- Esta migração:
--   1. Cria as colunas que armazenam a fonte web descoberta.
--   2. Expurga os dados proibidos/fictícios das colunas antigas.
--   3. Mantém as colunas antigas como LEGADO (sempre NULL) para não
--      quebrar histórico — estão descontinuadas.
-- ============================================================

-- 1. Novas colunas de fonte de áudio web (Regra 3)
ALTER TABLE releases
  ADD COLUMN IF NOT EXISTS audio_source_url      VARCHAR(700) NULL COMMENT 'URL direta do arquivo de áudio em site aberto (blog/forum). Regra 3: nunca de plataformas de música.',
  ADD COLUMN IF NOT EXISTS audio_source_provider VARCHAR(60)  NULL COMMENT 'Provider que descobriu a fonte (generic-web, direct-link).',
  ADD COLUMN IF NOT EXISTS audio_source_page_url VARCHAR(700) NULL COMMENT 'URL da página de origem (blog/forum) onde o arquivo foi encontrado.';

-- 2. Expurgo de dados de plataformas proibidas e mocks fictícios
--    (youtube_video_id, previews iTunes/Deezer/Spotify e o mock SoundHelix)
UPDATE releases
SET youtube_video_id  = NULL,   -- LEGADO: descontinuado pela Regra 3
    audio_preview_url = NULL,   -- LEGADO: previews de 30s de plataformas proibidas
    streaming_url     = NULL,   -- LEGADO: o app deve usar /api/releases/:id/stream
    download_url      = NULL;   -- LEGADO: o app deve usar /api/releases/:id/download

-- 3. Verificação
-- SELECT COUNT(*) AS fontes_web FROM releases WHERE audio_source_url IS NOT NULL;
