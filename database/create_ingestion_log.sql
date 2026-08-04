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
