-- Add candidate preferred location fields
ALTER TABLE `candidates`
    ADD COLUMN `preferredProvinceCode` VARCHAR(64) NULL,
    ADD COLUMN `preferredDistrictCode` VARCHAR(64) NULL,
    ADD COLUMN `preferredAddressLine` VARCHAR(255) NULL,
    ADD COLUMN `preferredLocationNote` VARCHAR(255) NULL;

CREATE INDEX `candidates_preferredProvinceCode_preferredDistrictCode_idx`
    ON `candidates`(`preferredProvinceCode`, `preferredDistrictCode`);
