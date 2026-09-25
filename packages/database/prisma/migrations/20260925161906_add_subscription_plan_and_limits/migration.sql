-- AlterEnum
ALTER TYPE "TenantPlan" ADD VALUE 'BASIC';

-- AlterTable
ALTER TABLE "tenants" ADD COLUMN     "maxFreeInvoices" INTEGER NOT NULL DEFAULT 7,
ADD COLUMN     "planExpiresAt" TIMESTAMP(3),
ADD COLUMN     "planPrice" DOUBLE PRECISION NOT NULL DEFAULT 3000,
ADD COLUMN     "subscriptionStatus" TEXT NOT NULL DEFAULT 'TRIAL',
ADD COLUMN     "upgradeRequested" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "upgradeRequestedAt" TIMESTAMP(3);
