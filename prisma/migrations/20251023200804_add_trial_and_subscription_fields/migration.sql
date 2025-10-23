-- AlterTable
ALTER TABLE "Organization" ADD COLUMN     "cancelAtPeriodEnd" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "currentPeriodEnd" TIMESTAMP(3),
ADD COLUMN     "currentPeriodStart" TIMESTAMP(3),
ADD COLUMN     "lastPaymentDate" TIMESTAMP(3),
ADD COLUMN     "nextBillingDate" TIMESTAMP(3),
ADD COLUMN     "paymentMethodBrand" TEXT,
ADD COLUMN     "paymentMethodLast4" TEXT,
ADD COLUMN     "subscriptionStatus" TEXT,
ADD COLUMN     "trialEndDate" TIMESTAMP(3),
ADD COLUMN     "trialStartDate" TIMESTAMP(3),
ADD COLUMN     "trialUsed" BOOLEAN NOT NULL DEFAULT false;
