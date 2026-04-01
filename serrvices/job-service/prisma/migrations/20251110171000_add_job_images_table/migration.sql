-- CreateTable
CREATE TABLE `JobImage` (
    `id` VARCHAR(191) NOT NULL,
    `jobId` CHAR(36) NOT NULL,
    `filePath` VARCHAR(255) NOT NULL,
    `slot` TINYINT NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    CONSTRAINT `JobImage_slot_check` CHECK (`slot` BETWEEN 1 AND 5),

    UNIQUE INDEX `JobImage_jobId_slot_key`(`jobId`, `slot`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `JobImage` ADD CONSTRAINT `JobImage_jobId_fkey` FOREIGN KEY (`jobId`) REFERENCES `Job`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
