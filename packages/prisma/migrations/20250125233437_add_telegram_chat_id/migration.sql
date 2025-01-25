/*
  Warnings:

  - Made the column `locale` on table `users` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "users" ADD COLUMN     "telegram_chat_id" BIGINT,
ALTER COLUMN "locale" SET NOT NULL;
