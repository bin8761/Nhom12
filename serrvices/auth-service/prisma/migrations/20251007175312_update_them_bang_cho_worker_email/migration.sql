-- CreateTable
CREATE TABLE `email_outbox` (
    `id` VARCHAR(191) NOT NULL,
    `job_id` VARCHAR(191) NULL,
    `user_id` VARCHAR(191) NULL,
    `email` VARCHAR(191) NOT NULL,
    `template_key` VARCHAR(191) NOT NULL,
    `status` ENUM('pending', 'retrying', 'sent', 'failed') NOT NULL,
    `attempts` INTEGER NOT NULL DEFAULT 0,
    `last_error` TEXT NULL,
    `last_attempt_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `email_outbox_user_id_idx`(`user_id`),
    INDEX `email_outbox_created_at_idx`(`created_at`),
    UNIQUE INDEX `email_outbox_job_id_key`(`job_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
