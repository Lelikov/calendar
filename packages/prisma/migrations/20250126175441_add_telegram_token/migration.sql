-- AlterTable
ALTER TABLE "users" ADD COLUMN     "telegram_token" TEXT DEFAULT md5(random()::text);
