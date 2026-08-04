-- Tabela: artists
CREATE TABLE IF NOT EXISTS artists (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  country VARCHAR(100) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_artists_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Tabela: works
CREATE TABLE IF NOT EXISTS works (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  artist_id INT UNSIGNED NOT NULL,
  original_release_year YEAR NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_works_artist FOREIGN KEY (artist_id) REFERENCES artists(id)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  INDEX idx_works_title (title)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Tabela: release_types
CREATE TABLE IF NOT EXISTS release_types (
  id SMALLINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL UNIQUE,
  category ENUM('release_format','mix_edit','instrumental','playback') NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Tabela: metadata_sources
CREATE TABLE IF NOT EXISTS metadata_sources (
  id SMALLINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(150) NOT NULL UNIQUE,
  base_url VARCHAR(255) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Tabela: releases
CREATE TABLE IF NOT EXISTS releases (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  work_id INT UNSIGNED NOT NULL,
  release_type_id SMALLINT UNSIGNED NOT NULL,
  version_name VARCHAR(255) NOT NULL,
  album_name VARCHAR(255) NULL,
  release_year YEAR NULL,
  label VARCHAR(150) NULL,
  country VARCHAR(100) NULL,
  quality VARCHAR(50) NULL,
  cover_url VARCHAR(500) NULL,
  metadata_source_id SMALLINT UNSIGNED NOT NULL,
  source_reference_url VARCHAR(500) NULL,
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

-- Tabela: external_api_cache
CREATE TABLE IF NOT EXISTS external_api_cache (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  metadata_source_id SMALLINT UNSIGNED NOT NULL,
  request_key VARCHAR(500) NOT NULL,
  response_body LONGTEXT NOT NULL,
  fetched_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP NOT NULL,
  CONSTRAINT fk_cache_source FOREIGN KEY (metadata_source_id) REFERENCES metadata_sources(id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  UNIQUE KEY uq_cache_source_key (metadata_source_id, request_key),
  INDEX idx_cache_expires (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Tabela: ingestion_log
CREATE TABLE IF NOT EXISTS ingestion_log (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  metadata_source_id SMALLINT UNSIGNED NOT NULL,
  request_type ENUM('search', 'work_detail', 'release_detail', 'cover_art') NOT NULL,
  request_query VARCHAR(500) NOT NULL,
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
