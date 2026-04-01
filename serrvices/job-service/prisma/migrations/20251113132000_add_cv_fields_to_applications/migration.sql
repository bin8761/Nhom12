-- Extend applications table with CV review metadata
ALTER TABLE `applications`
  ADD COLUMN `cv_snapshot` JSON NULL,
  ADD COLUMN `cv_status` ENUM('PENDING','APPROVED','REJECTED') NOT NULL DEFAULT 'PENDING',
  ADD COLUMN `cv_decision_note` TEXT NULL,
  ADD COLUMN `cv_reviewed_at` DATETIME(3) NULL;

-- Ensure cv_status only stores allowed states when using VARCHAR fallback
ALTER TABLE `applications`
  ADD CONSTRAINT `chk_applications_cv_status`
    CHECK (`cv_status` IN ('PENDING','APPROVED','REJECTED'));
