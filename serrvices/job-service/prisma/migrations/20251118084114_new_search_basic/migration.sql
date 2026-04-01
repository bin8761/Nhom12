/*
  Warnings:

  - The primary key for the `district` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `province` table will be changed. If it partially fails, the table could be left without primary key constraint.

*/
-- DropForeignKey
ALTER TABLE `district` DROP FOREIGN KEY `District_provinceCode_fkey`;

-- DropForeignKey
ALTER TABLE `districtalias` DROP FOREIGN KEY `DistrictAlias_districtCode_fkey`;

-- DropForeignKey
ALTER TABLE `job` DROP FOREIGN KEY `Job_districtCode_fkey`;

-- DropForeignKey
ALTER TABLE `job` DROP FOREIGN KEY `Job_provinceCode_fkey`;

-- DropForeignKey
ALTER TABLE `provincealias` DROP FOREIGN KEY `ProvinceAlias_provinceCode_fkey`;

-- AlterTable
ALTER TABLE `district` DROP PRIMARY KEY,
    MODIFY `code` VARCHAR(64) NOT NULL,
    MODIFY `provinceCode` VARCHAR(64) NOT NULL,
    ADD PRIMARY KEY (`code`);

-- AlterTable
ALTER TABLE `districtalias` MODIFY `districtCode` VARCHAR(64) NOT NULL;

-- AlterTable
ALTER TABLE `job` MODIFY `provinceCode` VARCHAR(64) NOT NULL,
    MODIFY `districtCode` VARCHAR(64) NOT NULL;

-- AlterTable
ALTER TABLE `province` DROP PRIMARY KEY,
    MODIFY `code` VARCHAR(64) NOT NULL,
    ADD PRIMARY KEY (`code`);

-- AlterTable
ALTER TABLE `provincealias` MODIFY `provinceCode` VARCHAR(64) NOT NULL;

-- AddForeignKey
ALTER TABLE `Job` ADD CONSTRAINT `Job_provinceCode_fkey` FOREIGN KEY (`provinceCode`) REFERENCES `Province`(`code`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Job` ADD CONSTRAINT `Job_districtCode_fkey` FOREIGN KEY (`districtCode`) REFERENCES `District`(`code`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ProvinceAlias` ADD CONSTRAINT `ProvinceAlias_provinceCode_fkey` FOREIGN KEY (`provinceCode`) REFERENCES `Province`(`code`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `District` ADD CONSTRAINT `District_provinceCode_fkey` FOREIGN KEY (`provinceCode`) REFERENCES `Province`(`code`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `DistrictAlias` ADD CONSTRAINT `DistrictAlias_districtCode_fkey` FOREIGN KEY (`districtCode`) REFERENCES `District`(`code`) ON DELETE CASCADE ON UPDATE CASCADE;
