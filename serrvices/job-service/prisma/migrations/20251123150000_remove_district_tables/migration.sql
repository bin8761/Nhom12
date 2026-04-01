-- Drop foreign key constraint first
ALTER TABLE `job` DROP FOREIGN KEY IF EXISTS `Job_districtCode_fkey`;

-- Drop district-related columns from job table
ALTER TABLE `job` DROP COLUMN IF EXISTS `districtCode`;
ALTER TABLE `job` DROP COLUMN IF EXISTS `districtNameSnapshot`;

-- Drop district-related index
DROP INDEX IF EXISTS `Job_status_provinceCode_districtCode_jobType_idx` ON `job`;

-- Drop DistrictAlias table
DROP TABLE IF EXISTS `DistrictAlias`;

-- Drop District table
DROP TABLE IF EXISTS `District`;
