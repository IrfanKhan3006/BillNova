-- AlterTable
ALTER TABLE "invoices" ADD COLUMN     "advanceConverted" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "convertedFromAdvanceNumber" TEXT,
ADD COLUMN     "convertedInvoiceId" TEXT,
ADD COLUMN     "isAdvance" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "tenants" ADD COLUMN     "advanceCounter" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "advancePrefix" TEXT NOT NULL DEFAULT 'ADV';
