-- CreateEnum
CREATE TYPE "Role" AS ENUM ('OWNER', 'ADMIN', 'USER');

-- AlterTable
ALTER TABLE "User_Organization" ADD COLUMN     "role" "Role" NOT NULL DEFAULT 'USER';
