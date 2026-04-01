-- CreateTable
CREATE TABLE `candidate_profiles` (
    `id` VARCHAR(191) NOT NULL,
    `user_id` VARCHAR(191) NOT NULL,
    `full_name` VARCHAR(120) NOT NULL,
    `phone_number` VARCHAR(32) NULL,
    `location` VARCHAR(120) NULL,
    `headline` VARCHAR(120) NULL,
    `summary` TEXT NULL,
    `skills` JSON NULL,
    `years_experience` INTEGER NULL,
    `portfolio_url` VARCHAR(255) NULL,
    `cv_url` VARCHAR(255) NULL,
    `preferred_job_types` JSON NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `updated_by` VARCHAR(36) NOT NULL,

    UNIQUE INDEX `candidate_profiles_user_id_key`(`user_id`),
    INDEX `candidate_profiles_updated_at_idx`(`updated_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `employer_profiles` (
    `id` VARCHAR(191) NOT NULL,
    `user_id` VARCHAR(191) NOT NULL,
    `company_name` VARCHAR(160) NOT NULL,
    `company_website` VARCHAR(255) NULL,
    `industry` VARCHAR(120) NULL,
    `company_size` ENUM('micro', 'small', 'medium', 'large', 'enterprise') NULL,
    `headquarters_location` VARCHAR(160) NULL,
    `company_description` TEXT NULL,
    `contact_email` VARCHAR(255) NULL,
    `contact_phone` VARCHAR(32) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `updated_by` VARCHAR(36) NOT NULL,

    UNIQUE INDEX `employer_profiles_user_id_key`(`user_id`),
    INDEX `employer_profiles_updated_at_idx`(`updated_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `candidate_profiles` ADD CONSTRAINT `candidate_profiles_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `employer_profiles` ADD CONSTRAINT `employer_profiles_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
