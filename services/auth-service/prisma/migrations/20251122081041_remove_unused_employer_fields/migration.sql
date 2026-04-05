/*
  Warnings:

  - You are about to drop the column `company_description` on the `employer_profiles` table. All the data in the column will be lost.
  - You are about to drop the column `company_size` on the `employer_profiles` table. All the data in the column will be lost.
  - You are about to drop the column `date_of_birth` on the `employer_profiles` table. All the data in the column will be lost.
  - You are about to drop the column `full_name` on the `employer_profiles` table. All the data in the column will be lost.
  - You are about to drop the column `industry` on the `employer_profiles` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE `employer_profiles` DROP COLUMN `company_description`,
    DROP COLUMN `company_size`,
    DROP COLUMN `date_of_birth`,
    DROP COLUMN `full_name`,
    DROP COLUMN `industry`;
