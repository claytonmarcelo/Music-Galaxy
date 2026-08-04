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
