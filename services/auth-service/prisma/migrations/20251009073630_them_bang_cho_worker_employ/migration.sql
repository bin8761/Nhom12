-- AlterTable
ALTER TABLE `users` ADD COLUMN `approval_status` ENUM('pending', 'approved', 'rejected') NOT NULL DEFAULT 'pending',
    ADD COLUMN `approved_at` DATETIME(3) NULL,
    ADD COLUMN `approved_by` VARCHAR(191) NULL,
    ADD COLUMN `rejection_reason` TEXT NULL;
