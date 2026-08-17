-- Draft/public separation and reversible lifecycle metadata for the visual
-- Homepage editor. Existing rows remain published and active.
ALTER TABLE "HomepageSection"
  ADD COLUMN "archivedAt" TIMESTAMP(3),
  ADD COLUMN "startsAt" TIMESTAMP(3),
  ADD COLUMN "endsAt" TIMESTAMP(3);

ALTER TABLE "HomeHeroSlide"
  ADD COLUMN "archivedAt" TIMESTAMP(3),
  ADD COLUMN "startsAt" TIMESTAMP(3),
  ADD COLUMN "endsAt" TIMESTAMP(3);

ALTER TABLE "HomeTrustItem"
  ADD COLUMN "archivedAt" TIMESTAMP(3);

ALTER TABLE "SiteLink"
  ADD COLUMN "isActive" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "archivedAt" TIMESTAMP(3);

ALTER TABLE "SiteSocialLink"
  ADD COLUMN "isActive" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "archivedAt" TIMESTAMP(3);

DROP INDEX IF EXISTS "HomepageSection_isActive_order_idx";
DROP INDEX IF EXISTS "HomeHeroSlide_isActive_sortOrder_idx";
DROP INDEX IF EXISTS "HomeTrustItem_isActive_sortOrder_idx";
DROP INDEX IF EXISTS "SiteLink_group_sortOrder_idx";
DROP INDEX IF EXISTS "SiteSocialLink_sortOrder_idx";

CREATE INDEX "HomepageSection_isActive_archivedAt_order_idx"
  ON "HomepageSection"("isActive", "archivedAt", "order");
CREATE INDEX "HomepageSection_startsAt_endsAt_idx"
  ON "HomepageSection"("startsAt", "endsAt");
CREATE INDEX "HomeHeroSlide_isActive_archivedAt_sortOrder_idx"
  ON "HomeHeroSlide"("isActive", "archivedAt", "sortOrder");
CREATE INDEX "HomeHeroSlide_startsAt_endsAt_idx"
  ON "HomeHeroSlide"("startsAt", "endsAt");
CREATE INDEX "HomeTrustItem_isActive_archivedAt_sortOrder_idx"
  ON "HomeTrustItem"("isActive", "archivedAt", "sortOrder");
CREATE INDEX "SiteLink_group_isActive_archivedAt_sortOrder_idx"
  ON "SiteLink"("group", "isActive", "archivedAt", "sortOrder");
CREATE INDEX "SiteSocialLink_isActive_archivedAt_sortOrder_idx"
  ON "SiteSocialLink"("isActive", "archivedAt", "sortOrder");

CREATE TABLE "HomepageWorkspace" (
  "id" TEXT NOT NULL DEFAULT 'default',
  "draft" JSONB NOT NULL,
  "published" JSONB NOT NULL,
  "draftVersion" INTEGER NOT NULL DEFAULT 1,
  "publishedVersion" INTEGER NOT NULL DEFAULT 1,
  "draftUpdatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "draftUpdatedBy" TEXT,
  "publishedAt" TIMESTAMP(3),
  "publishedBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "HomepageWorkspace_pkey" PRIMARY KEY ("id")
);
