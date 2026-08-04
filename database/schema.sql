-- ============================================================================
-- Music Galaxy - Schema do Banco de Dados (MariaDB)
-- ============================================================================
-- Este arquivo contém a estrutura completa do banco de dados do Music Galaxy.
-- Todas as tabelas foram desenhadas para respeitar as duas regras permanentes
-- do projeto:
--   1) Capa Oficial - nunca inventar, gerar por IA ou substituir capas.
--   2) Pesquisa Musical Completa - cada versão/lançamento de uma obra deve
--      existir como um registro independente, com seus próprios metadados.
-- ============================================================================

-- Criação do banco de dados, caso ainda não exista.
CREATE DATABASE IF NOT EXISTS musicgalaxy
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE musicgalaxy;

-- ============================================================================
-- Tabela: artists
-- Armazena os artistas/bandas responsáveis pelas obras musicais.
-- ============================================================================
CREATE TABLE IF NOT EXISTS artists (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,               -- Nome do artista ou banda
  country VARCHAR(100) NULL,                -- País de origem do artista (quando disponível)
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  INDEX idx_artists_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- Tabela: works
-- Representa a "obra musical" no sentido conceitual (a música em si),
-- independente de quantas versões/lançamentos ela tenha. Todas as versões
-- de uma mesma música apontam para o mesmo registro em "works".
-- ============================================================================
CREATE TABLE IF NOT EXISTS works (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  title VARCHAR(255) NOT NULL,              -- Título canônico da obra musical
  artist_id INT UNSIGNED NOT NULL,          -- Artista principal responsável pela obra
  original_release_year YEAR NULL,          -- Ano do primeiro lançamento conhecido (quando disponível)
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  CONSTRAINT fk_works_artist FOREIGN KEY (artist_id) REFERENCES artists(id)
    ON DELETE RESTRICT ON UPDATE CASCADE,

  INDEX idx_works_title (title)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- Tabela: release_types
-- Catálogo fixo com todos os formatos de lançamento e versões de mixagem
-- que a Regra de Pesquisa Musical Completa exige que sejam cobertos.
-- Mantida como tabela separada (em vez de ENUM) para facilitar expansão
-- futura sem precisar alterar a estrutura da tabela "releases".
-- ============================================================================
CREATE TABLE IF NOT EXISTS release_types (
  id SMALLINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL UNIQUE,        -- Nome do tipo de versão/formato
  category ENUM(
    'release_format',   -- Formato de lançamento (Single, EP, Box Set, etc.)
    'mix_edit',          -- Versão de mixagem/edição (Remix, Radio Edit, etc.)
    'instrumental',       -- Versão instrumental
    'playback'             -- Versão de playback
  ) NOT NULL

) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- Tabela: metadata_sources
-- Registra a origem de cada dado consultado (nome da fonte/API/catálogo).
-- Necessária para cumprir a exigência de "origem dos metadados" exibida
-- em cada resultado de busca.
-- ============================================================================
CREATE TABLE IF NOT EXISTS metadata_sources (
  id SMALLINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(150) NOT NULL UNIQUE,        -- Nome da fonte consultada (ex.: MusicBrainz, Discogs)
  base_url VARCHAR(255) NULL,               -- URL base da fonte, quando aplicável
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- Tabela: releases
-- Cada linha representa UMA versão/lançamento específico de uma obra
-- (works). É o coração da Regra de Pesquisa Musical Completa: nenhuma
-- versão substitui outra, cada uma é um registro próprio e independente.
-- ============================================================================
CREATE TABLE IF NOT EXISTS releases (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  work_id INT UNSIGNED NOT NULL,            -- Obra musical à qual esta versão pertence
  release_type_id SMALLINT UNSIGNED NOT NULL, -- Tipo de versão/formato (release_types)
  version_name VARCHAR(255) NOT NULL,       -- Nome de exibição da versão (ex.: "Radio Edit", "Club Mix")
  album_name VARCHAR(255) NULL,             -- Álbum ou coletânea em que a versão foi lançada
  release_year YEAR NULL,                   -- Ano específico deste lançamento
  label VARCHAR(150) NULL,                  -- Gravadora responsável pelo lançamento
  country VARCHAR(100) NULL,                -- País de lançamento desta versão específica
  quality VARCHAR(50) NULL,                 -- Qualidade disponível (ex.: "320kbps", "FLAC", "CD")

  -- Regra da Capa Oficial: cover_url só é preenchido quando a fonte
  -- consultada realmente fornece a capa oficial. Nunca gerar, criar
  -- ou substituir esse valor artificialmente. Permanece NULL quando
  -- a fonte não disponibiliza a capa, e o resultado é exibido sem capa.
  cover_url VARCHAR(500) NULL,

  metadata_source_id SMALLINT UNSIGNED NOT NULL, -- Origem dos metadados desta versão
  source_reference_url VARCHAR(500) NULL,   -- Link direto ao registro na fonte original (auditoria)

  -- Identificador do registro na fonte externa (ex.: MBID do MusicBrainz
  -- ou release_id do Discogs). Combinado com metadata_source_id, impede
  -- que a mesma versão seja duplicada em reprocessamentos de sincronização.
  external_id VARCHAR(255) NULL,

  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  CONSTRAINT fk_releases_work FOREIGN KEY (work_id) REFERENCES works(id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_releases_type FOREIGN KEY (release_type_id) REFERENCES release_types(id)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT fk_releases_source FOREIGN KEY (metadata_source_id) REFERENCES metadata_sources(id)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  UNIQUE KEY uq_release_source_external (metadata_source_id, external_id),

  INDEX idx_releases_work (work_id),
  INDEX idx_releases_type (release_type_id),
  INDEX idx_releases_version_name (version_name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- Tabela: external_api_cache
-- Cache de respostas de APIs externas (MusicBrainz, Discogs, etc.) mantido
-- diretamente no MariaDB. A stack do projeto não permite Redis ou qualquer
-- outra tecnologia externa de cache, então o próprio banco relacional
-- cumpre esse papel, reduzindo chamadas repetidas e respeitando os limites
-- de taxa de cada fonte (ex.: MusicBrainz permite em média 1 req/seg por
-- IP; Discogs permite 60 req/min autenticado, 25 req/min sem autenticação).
-- ============================================================================
CREATE TABLE IF NOT EXISTS external_api_cache (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  metadata_source_id SMALLINT UNSIGNED NOT NULL, -- Fonte que originou a resposta
  request_key VARCHAR(500) NOT NULL,        -- Chave normalizada da requisição (ex.: hash da URL + parâmetros)
  response_body LONGTEXT NOT NULL,          -- Corpo bruto da resposta (JSON da fonte)
  fetched_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP NOT NULL,            -- Momento em que o cache passa a ser considerado obsoleto

  CONSTRAINT fk_cache_source FOREIGN KEY (metadata_source_id) REFERENCES metadata_sources(id)
    ON DELETE CASCADE ON UPDATE CASCADE,

  UNIQUE KEY uq_cache_source_key (metadata_source_id, request_key),
  INDEX idx_cache_expires (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- Tabela: ingestion_log
-- Auditoria de toda ingestão de dados vinda de fontes externas. Sustenta
-- a Regra da Capa Oficial e a Regra de Pesquisa Completa de forma
-- verificável: qualquer capa ou versão registrada no banco pode ser
-- rastreada até a requisição exata que a originou.
-- ============================================================================
CREATE TABLE IF NOT EXISTS ingestion_log (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  metadata_source_id SMALLINT UNSIGNED NOT NULL,
  request_type ENUM('search', 'work_detail', 'release_detail', 'cover_art') NOT NULL,
  request_query VARCHAR(500) NOT NULL,      -- Termo buscado ou identificador consultado
  status ENUM('success', 'not_found', 'error', 'rate_limited') NOT NULL,
  error_message VARCHAR(500) NULL,
  works_created INT UNSIGNED NOT NULL DEFAULT 0,
  releases_created INT UNSIGNED NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT fk_ingestion_source FOREIGN KEY (metadata_source_id) REFERENCES metadata_sources(id)
    ON DELETE CASCADE ON UPDATE CASCADE,

  INDEX idx_ingestion_source (metadata_source_id),
  INDEX idx_ingestion_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- Seed: release_types
-- Popula o catálogo fixo de formatos e versões exigidos pela Regra de
-- Pesquisa Musical Completa. Lista consolidada a partir da especificação
-- oficial do projeto.
-- ============================================================================
INSERT INTO release_types (name, category) VALUES
  -- Formatos de lançamento
  ('Álbum', 'release_format'),
  ('Single', 'release_format'),
  ('Single Importado', 'release_format'),
  ('Single Nacional', 'release_format'),
  ('EP', 'release_format'),
  ('Maxi Single', 'release_format'),
  ('Maxi Single Importado', 'release_format'),
  ('Maxi Single Nacional', 'release_format'),
  ('CD Single', 'release_format'),
  ('Promo CD', 'release_format'),
  ('Promo Vinyl', 'release_format'),
  ('Promo Digital', 'release_format'),
  ('White Label', 'release_format'),
  ('Test Pressing', 'release_format'),
  ('Coletânea', 'release_format'),
  ('Greatest Hits', 'release_format'),
  ('Box Set', 'release_format'),
  ('Deluxe Edition', 'release_format'),
  ('Anniversary Edition', 'release_format'),
  ('Expanded Edition', 'release_format'),
  ('Remastered', 'release_format'),
  ('Remaster', 'release_format'),
  ('Original Release', 'release_format'),
  ('Reissue', 'release_format'),
  ('Re-Release', 'release_format'),
  ('Special Edition', 'release_format'),
  ('Limited Edition', 'release_format'),
  ("Collector's Edition", 'release_format'),
  ('Soundtrack (OST)', 'release_format'),
  ('Compilation', 'release_format'),
  ('Sampler', 'release_format'),
  ('DJ Promo', 'release_format'),
  ('Radio Promo', 'release_format'),
  ('Club Promo', 'release_format'),
  ('Festival Release', 'release_format'),
  ('Bootleg', 'release_format'),
  ('Demo', 'release_format'),
  ('Demo Tape', 'release_format'),
  ('Live Album', 'release_format'),
  ('Live Session', 'release_format'),
  ('Acoustic Session', 'release_format'),
  ('MTV Unplugged', 'release_format'),
  ('Session Recording', 'release_format'),
  ('Studio Recording', 'release_format'),

  -- Versões de mixagem e edição
  ('Acapella', 'mix_edit'),
  ('Karaoke', 'mix_edit'),
  ('Radio Edit', 'mix_edit'),
  ('Clean Version', 'mix_edit'),
  ('Explicit Version', 'mix_edit'),
  ('Extended Mix', 'mix_edit'),
  ('Club Mix', 'mix_edit'),
  ('Original Mix', 'mix_edit'),
  ('Dub Mix', 'mix_edit'),
  ('VIP Mix', 'mix_edit'),
  ('Rework', 'mix_edit'),
  ('Remix', 'mix_edit'),
  ('Mashup', 'mix_edit'),
  ('Edit', 'mix_edit'),
  ('Intro Edit', 'mix_edit'),
  ('Outro Edit', 'mix_edit'),
  ('Intro/Outro', 'mix_edit'),
  ('DJ Version', 'mix_edit'),
  ('Exclusive Version', 'mix_edit'),
  ('Original Version', 'mix_edit'),
  ('Album Version', 'mix_edit'),
  ('Single Version', 'mix_edit'),
  ('Radio Version', 'mix_edit'),
  ('Club Version', 'mix_edit'),
  ('Dance Mix', 'mix_edit'),
  ('DJ Intro', 'mix_edit'),
  ('DJ Outro', 'mix_edit'),
  ('DJ Friendly', 'mix_edit'),
  ('Live', 'mix_edit'),
  ('Acoustic', 'mix_edit'),

  -- Instrumentais
  ('Instrumental Original', 'instrumental'),
  ('Instrumental Remix', 'instrumental'),
  ('Instrumental Extended', 'instrumental'),
  ('Instrumental Extended Mix', 'instrumental'),
  ('Instrumental Club Mix', 'instrumental'),
  ('Instrumental Radio Edit', 'instrumental'),
  ('Instrumental Dub Mix', 'instrumental'),
  ('Instrumental VIP Mix', 'instrumental'),
  ('Instrumental Rework', 'instrumental'),
  ('Instrumental Edit', 'instrumental'),
  ('Instrumental Live', 'instrumental'),
  ('Instrumental Acoustic', 'instrumental'),
  ('Instrumental Remastered', 'instrumental'),

  -- Playback
  ('Playback Original', 'playback'),
  ('Playback Remix', 'playback'),
  ('Playback Extended', 'playback'),
  ('Playback Instrumental', 'playback'),
  ('Playback Karaoke', 'playback'),
  ('Playback Studio', 'playback'),
  ('Playback Live', 'playback'),
  ('Playback Radio Edit', 'playback'),
  ('Playback Club Mix', 'playback'),
  ('Playback Rework', 'playback');

-- ============================================================================
-- Seed: metadata_sources
-- Fontes externas oficiais de onde o Music Galaxy consulta capas e
-- metadados de versões. Obrigatório popular esta tabela antes de qualquer
-- ingestão, já que "releases.metadata_source_id" é NOT NULL.
-- ============================================================================
INSERT INTO metadata_sources (name, base_url) VALUES
  ('MusicBrainz', 'https://musicbrainz.org/ws/2'),
  ('Cover Art Archive', 'https://coverartarchive.org'),
  ('Discogs', 'https://api.discogs.com');

-- ============================================================================
-- Fim do schema inicial.
-- Próximos passos sugeridos (não incluídos neste arquivo):
--   - Tabela de usuários/favoritos, caso o app tenha contas de usuário.
--   - Tabela de histórico de buscas.
--   - Índices adicionais conforme os padrões de consulta da API forem
--     definidos (ex.: busca full-text em "works.title").
-- ============================================================================
