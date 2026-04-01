-- CreateTable
CREATE TABLE `JobApprovalLog` (
    `id` VARCHAR(191) NOT NULL,
    `jobId` CHAR(36) NOT NULL,
    `action` ENUM('SUBMITTED', 'AUTO_APPROVED', 'ADMIN_APPROVED', 'REJECTED', 'UPDATED', 'DELETED') NOT NULL,
    `performedBy` CHAR(36) NULL,
    `note` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `JobApprovalLog_jobId_action_idx`(`jobId`, `action`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `JobApprovalLog` ADD CONSTRAINT `JobApprovalLog_jobId_fkey` FOREIGN KEY (`jobId`) REFERENCES `Job`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
