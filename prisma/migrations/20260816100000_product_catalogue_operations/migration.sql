-- Product lifecycle is separate from the existing merchandising status
-- (new/hot/sale). Existing storefront-visible products become ACTIVE.
CREATE TYPE "ProductLifecycleStatus" AS ENUM ('DRAFT', 'ACTIVE', 'INACTIVE', 'ARCHIVED');
CREATE TYPE "InventoryMovementReason" AS ENUM (
  'INITIAL_BALANCE', 'ORDER', 'ORDER_CANCELLED', 'MANUAL_ADJUSTMENT',
  'RESTOCK', 'RETURN', 'DAMAGE', 'CORRECTION', 'IMPORT'
);

ALTER TABLE "Product"
  ADD COLUMN "lifecycleStatus" "ProductLifecycleStatus" NOT NULL DEFAULT 'ACTIVE',
  ADD COLUMN "promotionStartsAt" TIMESTAMP(3),
  ADD COLUMN "promotionEndsAt" TIMESTAMP(3),
  ADD COLUMN "archivedAt" TIMESTAMP(3),
  ADD COLUMN "archivedBy" TEXT;

UPDATE "Product"
SET "lifecycleStatus" = CASE WHEN "isActive" THEN 'ACTIVE'::"ProductLifecycleStatus" ELSE 'INACTIVE'::"ProductLifecycleStatus" END;

-- Existing per-product discounts remain enabled as legacy product promotions.
UPDATE "Product"
SET "isPromotion" = true
WHERE "discount" > 0 OR "salePrice" IS NOT NULL OR "status" = 'sale';

ALTER TABLE "Product" ALTER COLUMN "lifecycleStatus" SET DEFAULT 'DRAFT';

CREATE TABLE "InventoryMovement" (
  "id" TEXT NOT NULL,
  "productId" TEXT NOT NULL,
  "previousQuantity" INTEGER NOT NULL,
  "quantityDelta" INTEGER NOT NULL,
  "newQuantity" INTEGER NOT NULL,
  "reason" "InventoryMovementReason" NOT NULL,
  "note" TEXT,
  "actorUserId" TEXT,
  "actorEmail" TEXT,
  "actorName" TEXT,
  "relatedOrderId" TEXT,
  "idempotencyKey" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "InventoryMovement_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "InventoryMovement_idempotencyKey_key" ON "InventoryMovement"("idempotencyKey");
CREATE INDEX "InventoryMovement_productId_createdAt_idx" ON "InventoryMovement"("productId", "createdAt");
CREATE INDEX "InventoryMovement_relatedOrderId_createdAt_idx" ON "InventoryMovement"("relatedOrderId", "createdAt");
CREATE INDEX "InventoryMovement_reason_createdAt_idx" ON "InventoryMovement"("reason", "createdAt");
CREATE UNIQUE INDEX "Product_barcode_key" ON "Product"("barcode");
CREATE UNIQUE INDEX "ProductVariant_barcode_key" ON "ProductVariant"("barcode");
CREATE INDEX "Product_lifecycleStatus_updatedAt_idx" ON "Product"("lifecycleStatus", "updatedAt");
CREATE INDEX "Product_archivedAt_idx" ON "Product"("archivedAt");
CREATE INDEX "Product_isPromotion_promotionStartsAt_promotionEndsAt_idx" ON "Product"("isPromotion", "promotionStartsAt", "promotionEndsAt");

ALTER TABLE "InventoryMovement"
  ADD CONSTRAINT "InventoryMovement_productId_fkey"
  FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "InventoryMovement"
  ADD CONSTRAINT "InventoryMovement_relatedOrderId_fkey"
  FOREIGN KEY ("relatedOrderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- The project had no stock ledger. Record an explicitly labelled baseline only;
-- do not invent historical order/restock reasons.
INSERT INTO "InventoryMovement" (
  "id", "productId", "previousQuantity", "quantityDelta", "newQuantity",
  "reason", "note", "actorName", "idempotencyKey"
)
SELECT
  'initial_' || "id", "id", 0, "stock", "stock",
  'INITIAL_BALANCE'::"InventoryMovementReason",
  'Solde initial lors de la migration du registre de stock',
  'Migration système',
  'initial-balance:' || "id"
FROM "Product";

-- Case-insensitive contains search is used by the Admin catalogue.
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX "Product_name_trgm_idx" ON "Product" USING GIN ("name" gin_trgm_ops);
CREATE INDEX "Product_sku_trgm_idx" ON "Product" USING GIN ("sku" gin_trgm_ops);
CREATE INDEX "Product_barcode_trgm_idx" ON "Product" USING GIN ("barcode" gin_trgm_ops);
CREATE INDEX "Brand_title_trgm_idx" ON "Brand" USING GIN ("title" gin_trgm_ops);
CREATE INDEX "Category_title_trgm_idx" ON "Category" USING GIN ("title" gin_trgm_ops);
