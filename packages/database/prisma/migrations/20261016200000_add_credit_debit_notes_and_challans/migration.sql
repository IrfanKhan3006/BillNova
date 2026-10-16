-- Credit notes (sales returns / receivable reductions), debit notes (purchase
-- returns / payable reductions) and delivery challans (goods out before the
-- bill).
--
-- Additive only: no existing table is altered except `tenants`, which gains
-- new columns with defaults, so existing rows and queries are unaffected. The
-- three modules stay switched off until a tenant is given them.

CREATE TYPE "CreditNoteStatus" AS ENUM ('DRAFT', 'ISSUED', 'CANCELLED');
CREATE TYPE "DebitNoteStatus" AS ENUM ('DRAFT', 'ISSUED', 'CANCELLED');
CREATE TYPE "ChallanStatus" AS ENUM ('DRAFT', 'DISPATCHED', 'DELIVERED', 'INVOICED', 'CANCELLED');
CREATE TYPE "NoteReason" AS ENUM ('SALES_RETURN', 'PURCHASE_RETURN', 'RATE_DIFFERENCE', 'POST_SALE_DISCOUNT', 'DEFICIENCY_IN_SERVICE', 'CANCELLATION', 'OTHER');

ALTER TABLE "tenants"
  ADD COLUMN "creditNotePrefix" TEXT NOT NULL DEFAULT 'CN',
  ADD COLUMN "creditNoteCounter" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "debitNotePrefix" TEXT NOT NULL DEFAULT 'DN',
  ADD COLUMN "debitNoteCounter" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "challanPrefix" TEXT NOT NULL DEFAULT 'DC',
  ADD COLUMN "challanCounter" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "creditNotesEnabled" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "debitNotesEnabled" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "challansEnabled" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE "credit_notes" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "invoiceId" TEXT,
    "creditNoteNumber" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT,
    "status" "CreditNoteStatus" NOT NULL DEFAULT 'DRAFT',
    "reason" "NoteReason" NOT NULL DEFAULT 'SALES_RETURN',
    "reasonNote" TEXT,
    "subTotal" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "taxAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "discountAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "originalInvoiceNumber" TEXT,
    "originalInvoiceDate" TIMESTAMP(3),
    "restock" BOOLEAN NOT NULL DEFAULT true,
    "stockApplied" BOOLEAN NOT NULL DEFAULT false,
    "ledgerApplied" BOOLEAN NOT NULL DEFAULT false,
    "appliedToInvoice" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "notes" TEXT,
    "shareToken" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "credit_notes_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "credit_notes_shareToken_key" ON "credit_notes"("shareToken");
CREATE UNIQUE INDEX "credit_notes_tenantId_creditNoteNumber_key" ON "credit_notes"("tenantId", "creditNoteNumber");
CREATE INDEX "credit_notes_tenantId_date_idx" ON "credit_notes"("tenantId", "date");

CREATE TABLE "credit_note_items" (
    "id" TEXT NOT NULL,
    "creditNoteId" TEXT NOT NULL,
    "productId" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "qty" INTEGER NOT NULL DEFAULT 1,
    "price" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "taxRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "taxAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "discountRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "discountAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "total" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "hsnCode" TEXT,

    CONSTRAINT "credit_note_items_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "debit_notes" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "purchaseInvoiceId" TEXT,
    "debitNoteNumber" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT,
    "status" "DebitNoteStatus" NOT NULL DEFAULT 'DRAFT',
    "reason" "NoteReason" NOT NULL DEFAULT 'PURCHASE_RETURN',
    "reasonNote" TEXT,
    "subTotal" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "taxAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "discountAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "originalInvoiceNumber" TEXT,
    "originalInvoiceDate" TIMESTAMP(3),
    "restock" BOOLEAN NOT NULL DEFAULT true,
    "stockApplied" BOOLEAN NOT NULL DEFAULT false,
    "ledgerApplied" BOOLEAN NOT NULL DEFAULT false,
    "appliedToInvoice" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "notes" TEXT,
    "shareToken" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "debit_notes_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "debit_notes_shareToken_key" ON "debit_notes"("shareToken");
CREATE UNIQUE INDEX "debit_notes_tenantId_debitNoteNumber_key" ON "debit_notes"("tenantId", "debitNoteNumber");
CREATE INDEX "debit_notes_tenantId_date_idx" ON "debit_notes"("tenantId", "date");

CREATE TABLE "debit_note_items" (
    "id" TEXT NOT NULL,
    "debitNoteId" TEXT NOT NULL,
    "productId" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "qty" INTEGER NOT NULL DEFAULT 1,
    "price" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "taxRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "taxAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "discountRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "discountAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "total" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "hsnCode" TEXT,

    CONSTRAINT "debit_note_items_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "delivery_challans" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "salesOrderId" TEXT,
    "challanNumber" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT,
    "status" "ChallanStatus" NOT NULL DEFAULT 'DRAFT',
    "challanType" TEXT NOT NULL DEFAULT 'DELIVERY',
    "subTotal" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "taxAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "discountAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "vehicleNumber" TEXT,
    "despatchedThrough" TEXT,
    "destination" TEXT,
    "termsOfDelivery" TEXT,
    "shipToName" TEXT,
    "shipToAddress" TEXT,
    "shipToGstin" TEXT,
    "shipToState" TEXT,
    "notes" TEXT,
    "shareToken" TEXT,
    "stockApplied" BOOLEAN NOT NULL DEFAULT false,
    "convertedInvoiceId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "delivery_challans_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "delivery_challans_shareToken_key" ON "delivery_challans"("shareToken");
CREATE UNIQUE INDEX "delivery_challans_tenantId_challanNumber_key" ON "delivery_challans"("tenantId", "challanNumber");
CREATE INDEX "delivery_challans_tenantId_date_idx" ON "delivery_challans"("tenantId", "date");

CREATE TABLE "delivery_challan_items" (
    "id" TEXT NOT NULL,
    "challanId" TEXT NOT NULL,
    "productId" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "qty" INTEGER NOT NULL DEFAULT 1,
    "price" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "taxRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "taxAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "discountRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "discountAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "total" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "hsnCode" TEXT,

    CONSTRAINT "delivery_challan_items_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "credit_notes" ADD CONSTRAINT "credit_notes_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "credit_notes" ADD CONSTRAINT "credit_notes_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "credit_notes" ADD CONSTRAINT "credit_notes_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "invoices"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "credit_note_items" ADD CONSTRAINT "credit_note_items_creditNoteId_fkey" FOREIGN KEY ("creditNoteId") REFERENCES "credit_notes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "credit_note_items" ADD CONSTRAINT "credit_note_items_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "debit_notes" ADD CONSTRAINT "debit_notes_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "debit_notes" ADD CONSTRAINT "debit_notes_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "vendors"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "debit_notes" ADD CONSTRAINT "debit_notes_purchaseInvoiceId_fkey" FOREIGN KEY ("purchaseInvoiceId") REFERENCES "purchase_invoices"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "debit_note_items" ADD CONSTRAINT "debit_note_items_debitNoteId_fkey" FOREIGN KEY ("debitNoteId") REFERENCES "debit_notes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "debit_note_items" ADD CONSTRAINT "debit_note_items_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "delivery_challans" ADD CONSTRAINT "delivery_challans_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "delivery_challans" ADD CONSTRAINT "delivery_challans_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "delivery_challans" ADD CONSTRAINT "delivery_challans_salesOrderId_fkey" FOREIGN KEY ("salesOrderId") REFERENCES "sales_orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "delivery_challans" ADD CONSTRAINT "delivery_challans_convertedInvoiceId_fkey" FOREIGN KEY ("convertedInvoiceId") REFERENCES "invoices"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "delivery_challan_items" ADD CONSTRAINT "delivery_challan_items_challanId_fkey" FOREIGN KEY ("challanId") REFERENCES "delivery_challans"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "delivery_challan_items" ADD CONSTRAINT "delivery_challan_items_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;
