-- Create candidate_cv table to store uploaded CV metadata and parsing state
CREATE TABLE candidate_cv (
    id VARCHAR(191) NOT NULL,
    candidate_id CHAR(36) NOT NULL,
    file_path VARCHAR(255) NOT NULL,
    file_size INT NOT NULL,
    mime_type VARCHAR(64) NOT NULL,
    status ENUM('PENDING','PARSING','PARSED','FAILED') NOT NULL DEFAULT 'PENDING',
    parsed_fields JSON NULL,
    error_message TEXT NULL,
    uploaded_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    processed_at DATETIME(3) NULL,
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_at DATETIME(3) NOT NULL,

    INDEX idx_candidate_cv_candidate_id(candidate_id),
    INDEX idx_candidate_cv_status(status),
    PRIMARY KEY (id)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE candidate_cv
  ADD CONSTRAINT candidate_cv_candidate_id_fkey
    FOREIGN KEY (candidate_id) REFERENCES candidates(id) ON DELETE CASCADE ON UPDATE CASCADE;

