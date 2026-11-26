-- Public share-link tokens for quotations, sales orders and purchase orders,
-- used by the "Send on WhatsApp" button (mirrors invoices.shareToken).
-- Additive and nullable: existing rows get a token lazily, on first share.

ALTER TABLE "quotations" ADD COLUMN "shareToken" TEXT;
ALTER TABLE "sales_orders" ADD COLUMN "shareToken" TEXT;
ALTER TABLE "purchase_orders" ADD COLUMN "shareToken" TEXT;

CREATE UNIQUE INDEX "quotations_shareToken_key" ON "quotations"("shareToken");
CREATE UNIQUE INDEX "sales_orders_shareToken_key" ON "sales_orders"("shareToken");
CREATE UNIQUE INDEX "purchase_orders_shareToken_key" ON "purchase_orders"("shareToken");
