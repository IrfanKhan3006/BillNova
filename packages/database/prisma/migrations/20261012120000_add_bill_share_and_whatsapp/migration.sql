-- Public bill link token for WhatsApp sharing
ALTER TABLE "invoices" ADD COLUMN "shareToken" TEXT;

CREATE UNIQUE INDEX "invoices_shareToken_key" ON "invoices"("shareToken");

-- WhatsApp bill message settings
ALTER TABLE "tenants" ADD COLUMN "googleReviewUrl" TEXT;
ALTER TABLE "tenants" ADD COLUMN "whatsappTemplate" TEXT;
