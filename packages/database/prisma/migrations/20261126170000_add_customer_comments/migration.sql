-- CreateTable: dated comment thread per customer
CREATE TABLE "customer_comments" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "customer_comments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "customer_comments_customerId_createdAt_idx" ON "customer_comments"("customerId", "createdAt");

-- AddForeignKey
ALTER TABLE "customer_comments" ADD CONSTRAINT "customer_comments_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_comments" ADD CONSTRAINT "customer_comments_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Carry any single comment already saved on the customer into the new thread
INSERT INTO "customer_comments" ("id", "tenantId", "customerId", "body", "createdAt")
SELECT gen_random_uuid()::text, "tenantId", "id", "notes", "updatedAt"
FROM "customers"
WHERE "notes" IS NOT NULL AND btrim("notes") <> '';
