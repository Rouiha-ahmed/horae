-- Category lifecycle is deliberately additive: product/category links are retained.
ALTER TABLE "Category"
  ADD COLUMN "isActive" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "archivedAt" TIMESTAMP(3),
  ADD COLUMN "archivedBy" TEXT;

-- Replace the former alphabetical hierarchy index with the actual manual order.
DROP INDEX IF EXISTS "Category_parentId_title_idx";
CREATE INDEX "Category_parentId_range_title_idx" ON "Category"("parentId", "range", "title");
CREATE INDEX "Category_isActive_archivedAt_idx" ON "Category"("isActive", "archivedAt");
CREATE INDEX "Category_featured_isActive_archivedAt_idx" ON "Category"("featured", "isActive", "archivedAt");
CREATE INDEX "Category_archivedAt_idx" ON "Category"("archivedAt");

-- Keep the existing visible order while making it dense and deterministic per parent.
WITH ordered AS (
  SELECT "id", ROW_NUMBER() OVER (
    PARTITION BY "parentId"
    ORDER BY "range" ASC NULLS LAST, "title" ASC, "id" ASC
  ) - 1 AS next_range
  FROM "Category"
)
UPDATE "Category" AS category
SET "range" = ordered.next_range
FROM ordered
WHERE category."id" = ordered."id";

-- Historical commercial buckets are now generated from product rules. Archive the
-- old navigation records but never remove their ProductCategory associations.
UPDATE "Category"
SET
  "isActive" = false,
  "featured" = false,
  "archivedAt" = COALESCE("archivedAt", CURRENT_TIMESTAMP),
  "archivedBy" = COALESCE("archivedBy", 'system:commercial-collection-migration')
WHERE lower("slug") IN (
  'promotions', 'promos', 'best-sellers', 'best-seller', 'meilleures-ventes',
  'new-arrivals', 'nouveautes', 'nouveaux-produits'
);
