-- AlterTable
ALTER TABLE "invoice_items" ADD COLUMN     "hsnCode" TEXT;

-- AlterTable
ALTER TABLE "invoices" ADD COLUMN     "ackDate" TIMESTAMP(3),
ADD COLUMN     "ackNo" TEXT,
ADD COLUMN     "buyersOrderDate" TIMESTAMP(3),
ADD COLUMN     "buyersOrderNo" TEXT,
ADD COLUMN     "consigneeAddress" TEXT,
ADD COLUMN     "consigneeGstin" TEXT,
ADD COLUMN     "consigneeName" TEXT,
ADD COLUMN     "consigneeState" TEXT,
ADD COLUMN     "deliveryNote" TEXT,
ADD COLUMN     "deliveryNoteDate" TIMESTAMP(3),
ADD COLUMN     "despatchDocNo" TEXT,
ADD COLUMN     "despatchedThrough" TEXT,
ADD COLUMN     "destination" TEXT,
ADD COLUMN     "irn" TEXT,
ADD COLUMN     "otherReferences" TEXT,
ADD COLUMN     "paymentTerms" TEXT,
ADD COLUMN     "supplierRef" TEXT,
ADD COLUMN     "termsOfDelivery" TEXT;

-- AlterTable
ALTER TABLE "products" ADD COLUMN     "hsnCode" TEXT;
