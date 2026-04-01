/*
  Warnings:

  - You are about to drop the column `ullName` on the `candidates` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE `candidates` DROP COLUMN `ullName`,
    ADD COLUMN `fullName` VARCHAR(160) NULL;
