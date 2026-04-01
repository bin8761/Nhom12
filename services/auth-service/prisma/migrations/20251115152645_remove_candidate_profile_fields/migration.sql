/*
  Warnings:

  - You are about to drop the column `cv_url` on the `candidate_profiles` table. All the data in the column will be lost.
  - You are about to drop the column `headline` on the `candidate_profiles` table. All the data in the column will be lost.
  - You are about to drop the column `portfolio_url` on the `candidate_profiles` table. All the data in the column will be lost.
  - You are about to drop the column `preferred_job_types` on the `candidate_profiles` table. All the data in the column will be lost.
  - You are about to drop the column `skills` on the `candidate_profiles` table. All the data in the column will be lost.
  - You are about to drop the column `summary` on the `candidate_profiles` table. All the data in the column will be lost.
  - You are about to drop the column `years_experience` on the `candidate_profiles` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE `candidate_profiles` DROP COLUMN `cv_url`,
    DROP COLUMN `headline`,
    DROP COLUMN `portfolio_url`,
    DROP COLUMN `preferred_job_types`,
    DROP COLUMN `skills`,
    DROP COLUMN `summary`,
    DROP COLUMN `years_experience`;
