-- CreateTable
CREATE TABLE `Job` (
    `id` VARCHAR(191) NOT NULL,
    `employerId` CHAR(36) NOT NULL,
    `title` VARCHAR(160) NOT NULL,
    `slug` VARCHAR(200) NOT NULL,
    `description` TEXT NOT NULL,
    `skills` JSON NOT NULL,
    `salary` DECIMAL(15, 2) NOT NULL,
    `currency` CHAR(3) NOT NULL DEFAULT 'VND',
    `location` VARCHAR(160) NOT NULL,
    `jobType` ENUM('FULL_TIME', 'PART_TIME', 'CONTRACT', 'INTERN', 'REMOTE') NOT NULL,
    `status` ENUM('PENDING', 'APPROVED', 'REJECTED', 'DELETED') NOT NULL DEFAULT 'PENDING',
    `publishedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `deletedAt` DATETIME(3) NULL,

    INDEX `Job_status_idx`(`status`),
    INDEX `Job_employerId_status_idx`(`employerId`, `status`),
    INDEX `Job_jobType_idx`(`jobType`),
    INDEX `Job_location_idx`(`location`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
