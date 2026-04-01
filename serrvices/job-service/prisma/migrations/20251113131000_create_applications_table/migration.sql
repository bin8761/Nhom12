CREATE TABLE `applications` (
    `id` VARCHAR(191) NOT NULL,
    `jobId` CHAR(36) NOT NULL,
    `candidateId` CHAR(36) NOT NULL,
    `status` ENUM('SUBMITTED','REVIEWED','INTERVIEW','OFFER','REJECTED') NOT NULL DEFAULT 'SUBMITTED',
    `cvFileId` VARCHAR(191) NULL,
    `coverLetter` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `idx_applications_job_id`(`jobId`),
    INDEX `idx_applications_candidate_id`(`candidateId`),
    INDEX `idx_applications_status`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `applications`
  ADD CONSTRAINT `applications_job_id_fkey`
    FOREIGN KEY (`jobId`) REFERENCES `Job`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `applications`
  ADD CONSTRAINT `applications_candidate_id_fkey`
    FOREIGN KEY (`candidateId`) REFERENCES `candidates`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

