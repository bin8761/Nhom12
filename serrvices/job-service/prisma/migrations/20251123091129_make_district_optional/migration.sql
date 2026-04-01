-- DropForeignKey
ALTER TABLE `job` DROP FOREIGN KEY `Job_districtCode_fkey`;

-- AlterTable
ALTER TABLE `job` MODIFY `districtCode` VARCHAR(64) NULL,
    MODIFY `districtNameSnapshot` VARCHAR(160) NULL;

-- AddForeignKey
ALTER TABLE `job` ADD CONSTRAINT `Job_districtCode_fkey` FOREIGN KEY (`districtCode`) REFERENCES `district`(`code`) ON DELETE SET NULL ON UPDATE CASCADE;
