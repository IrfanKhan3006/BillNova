-- AlterTable
ALTER TABLE "products" ADD COLUMN     "isService" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "tenants" ADD COLUMN     "businessType" TEXT NOT NULL DEFAULT 'RETAIL',
ADD COLUMN     "trackInventory" BOOLEAN NOT NULL DEFAULT true;
