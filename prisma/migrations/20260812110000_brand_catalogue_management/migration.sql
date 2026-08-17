-- Preserve every existing brand while adding reversible catalogue lifecycle metadata.
ALTER TABLE "Brand"
ADD COLUMN "archivedAt" TIMESTAMP(3),
ADD COLUMN "archivedBy" TEXT;

CREATE INDEX "Brand_isActive_archivedAt_idx" ON "Brand"("isActive", "archivedAt");
CREATE INDEX "Brand_archivedAt_idx" ON "Brand"("archivedAt");
