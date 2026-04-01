-- DropForeignKey
ALTER TABLE `applications` DROP FOREIGN KEY `applications_candidate_id_fkey`;

-- DropForeignKey
ALTER TABLE `applications` DROP FOREIGN KEY `applications_job_id_fkey`;

-- AddForeignKey
ALTER TABLE `applications` ADD CONSTRAINT `applications_jobId_fkey` FOREIGN KEY (`jobId`) REFERENCES `Job`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `applications` ADD CONSTRAINT `applications_candidateId_fkey` FOREIGN KEY (`candidateId`) REFERENCES `candidates`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
