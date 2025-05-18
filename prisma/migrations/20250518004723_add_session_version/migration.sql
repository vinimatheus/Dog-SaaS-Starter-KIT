-- AlterTable
ALTER TABLE "User" ADD COLUMN     "sessionVersion" INTEGER NOT NULL DEFAULT 1;

-- CreateTable
CREATE TABLE "LoginAttemptByIP" (
    "id" TEXT NOT NULL,
    "ip" TEXT NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 1,
    "lastAttempt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "blockedUntil" TIMESTAMP(3),

    CONSTRAINT "LoginAttemptByIP_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LoginAttemptByIP_ip_idx" ON "LoginAttemptByIP"("ip");

-- CreateIndex
CREATE UNIQUE INDEX "LoginAttemptByIP_ip_key" ON "LoginAttemptByIP"("ip");
