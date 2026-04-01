/*
  Warnings:

  - You are about to drop the column `preferredDistrictCode` on the `candidates` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX `candidates_preferredProvinceCode_preferredDistrictCode_idx` ON `candidates`;

-- AlterTable
ALTER TABLE `candidates` DROP COLUMN `preferredDistrictCode`;

-- CreateIndex
CREATE INDEX `candidates_preferredProvinceCode_idx` ON `candidates`(`preferredProvinceCode`);

-- CreateIndex
CREATE INDEX `Job_status_provinceCode_jobType_idx` ON `job`(`status`, `provinceCode`, `jobType`);
