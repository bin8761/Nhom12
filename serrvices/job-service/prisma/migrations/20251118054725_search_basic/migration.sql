-- AlterTable
ALTER TABLE `job` ALTER COLUMN `provinceCode` DROP DEFAULT,
    ALTER COLUMN `districtCode` DROP DEFAULT,
    ALTER COLUMN `provinceNameSnapshot` DROP DEFAULT,
    ALTER COLUMN `districtNameSnapshot` DROP DEFAULT;
