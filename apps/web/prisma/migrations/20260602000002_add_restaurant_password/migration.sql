-- AlterTable: add bcrypt password hash for per-restaurant login
ALTER TABLE "Restaurant" ADD COLUMN "passwordHash" TEXT;
