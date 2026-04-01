-- CreateTable
CREATE TABLE `job_documents` (
    `id` VARCHAR(191) NOT NULL,
    `jobId` CHAR(36) NOT NULL,
    `filePath` VARCHAR(255) NOT NULL,
    `originalName` VARCHAR(255) NOT NULL,
    `fileSize` INTEGER NOT NULL,
    `mimeType` VARCHAR(64) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `job_documents_jobId_key`(`jobId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `job_documents` ADD CONSTRAINT `job_documents_jobId_fkey` FOREIGN KEY (`jobId`) REFERENCES `Job`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
