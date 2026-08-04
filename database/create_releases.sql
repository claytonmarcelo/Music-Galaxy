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
