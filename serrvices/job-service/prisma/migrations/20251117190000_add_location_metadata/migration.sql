-- Create Province table
CREATE TABLE `Province` (
    `code` VARCHAR(16) NOT NULL,
    `name` VARCHAR(160) NOT NULL,
    `slug` VARCHAR(160) NOT NULL,
    `active` BOOLEAN NOT NULL DEFAULT true,
    `priority` SMALLINT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Province_slug_key`(`slug`),
    PRIMARY KEY (`code`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Create ProvinceAlias table
CREATE TABLE `ProvinceAlias` (
    `id` VARCHAR(191) NOT NULL,
    `provinceCode` VARCHAR(16) NOT NULL,
    `alias` VARCHAR(160) NOT NULL,
    `normalizedAlias` VARCHAR(160) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `ProvinceAlias_normalizedAlias_idx`(`normalizedAlias`),
    UNIQUE INDEX `ProvinceAlias_provinceCode_alias_key`(`provinceCode`, `alias`),
    PRIMARY KEY (`id`),
    CONSTRAINT `ProvinceAlias_provinceCode_fkey` FOREIGN KEY (`provinceCode`) REFERENCES `Province`(`code`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Create District table
CREATE TABLE `District` (
    `code` VARCHAR(16) NOT NULL,
    `provinceCode` VARCHAR(16) NOT NULL,
    `name` VARCHAR(160) NOT NULL,
    `slug` VARCHAR(160) NOT NULL,
    `active` BOOLEAN NOT NULL DEFAULT true,
    `priority` SMALLINT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `District_provinceCode_idx`(`provinceCode`),
    UNIQUE INDEX `District_provinceCode_slug_key`(`provinceCode`, `slug`),
    PRIMARY KEY (`code`),
    CONSTRAINT `District_provinceCode_fkey` FOREIGN KEY (`provinceCode`) REFERENCES `Province`(`code`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Create DistrictAlias table
CREATE TABLE `DistrictAlias` (
    `id` VARCHAR(191) NOT NULL,
    `districtCode` VARCHAR(16) NOT NULL,
    `alias` VARCHAR(160) NOT NULL,
    `normalizedAlias` VARCHAR(160) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `DistrictAlias_normalizedAlias_idx`(`normalizedAlias`),
    UNIQUE INDEX `DistrictAlias_districtCode_alias_key`(`districtCode`, `alias`),
    PRIMARY KEY (`id`),
    CONSTRAINT `DistrictAlias_districtCode_fkey` FOREIGN KEY (`districtCode`) REFERENCES `District`(`code`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Seed placeholder province/district for legacy rows
INSERT INTO `Province` (`code`, `name`, `slug`, `active`, `priority`, `createdAt`, `updatedAt`)
VALUES ('UNKNOWN', 'Legacy Province', 'legacy-province', true, NULL, NOW(3), NOW(3))
ON DUPLICATE KEY UPDATE `name` = VALUES(`name`);

INSERT INTO `District` (`code`, `provinceCode`, `name`, `slug`, `active`, `priority`, `createdAt`, `updatedAt`)
VALUES ('UNKNOWN', 'UNKNOWN', 'Legacy District', 'legacy-district', true, NULL, NOW(3), NOW(3))
ON DUPLICATE KEY UPDATE `name` = VALUES(`name`);

-- Update Job table with new fields
ALTER TABLE `Job`
    ADD COLUMN `provinceCode` VARCHAR(16) NOT NULL DEFAULT 'UNKNOWN',
    ADD COLUMN `districtCode` VARCHAR(16) NOT NULL DEFAULT 'UNKNOWN',
    ADD COLUMN `provinceNameSnapshot` VARCHAR(160) NOT NULL DEFAULT 'Legacy Province',
    ADD COLUMN `districtNameSnapshot` VARCHAR(160) NOT NULL DEFAULT 'Legacy District',
    ADD COLUMN `addressLine` VARCHAR(255) NULL,
    ADD CONSTRAINT `Job_provinceCode_fkey` FOREIGN KEY (`provinceCode`) REFERENCES `Province`(`code`) ON DELETE RESTRICT ON UPDATE CASCADE,
    ADD CONSTRAINT `Job_districtCode_fkey` FOREIGN KEY (`districtCode`) REFERENCES `District`(`code`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- Indexes for new query paths
CREATE INDEX `Job_status_provinceCode_districtCode_jobType_idx` ON `Job`(`status`, `provinceCode`, `districtCode`, `jobType`);
CREATE INDEX `Job_status_updatedAt_idx` ON `Job`(`status`, `updatedAt`);
CREATE FULLTEXT INDEX `Job_title_description_idx` ON `Job`(`title`, `description`);
