CREATE TABLE IF NOT EXISTS `candidates` (
    `id` CHAR(36) NOT NULL,
    `email` VARCHAR(320) NULL,
    `ullName` VARCHAR(160) NULL,
    `phoneNumber` VARCHAR(32) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

