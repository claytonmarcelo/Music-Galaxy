-- ============================================================================
-- Migration: Adiciona youtube_video_id à tabela releases
-- Executar: mysql -u root -P 3307 musicgalaxy < database/migrations/add_youtube_video_id.sql
-- ============================================================================

ALTER TABLE releases
  ADD COLUMN IF NOT EXISTS youtube_video_id VARCHAR(20) NULL
    COMMENT 'ID do vídeo no YouTube para stream e download completo'
    AFTER download_url;

-- Índice para facilitar buscas por video_id
CREATE INDEX IF NOT EXISTS idx_releases_youtube_video_id
  ON releases (youtube_video_id);
