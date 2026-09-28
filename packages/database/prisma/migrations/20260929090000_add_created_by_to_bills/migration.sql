-- AlterTable
ALTER TABLE "invoices" ADD COLUMN     "createdById" TEXT;

-- AlterTable
ALTER TABLE "purchase_invoices" ADD COLUMN     "createdById" TEXT;
