-- Extend the existing customer and order system with an auditable loyalty module.
CREATE TYPE "CustomerActivitySegment" AS ENUM ('NEW', 'ACTIVE', 'LOYAL', 'TO_REENGAGE', 'NO_PURCHASE', 'INACTIVE');
CREATE TYPE "LoyaltyTransactionType" AS ENUM ('earned', 'redeemed', 'expired', 'manual_adjustment', 'refund_reversal', 'cancellation_reversal', 'bonus', 'birthday_bonus', 'opening_balance', 'other');
CREATE TYPE "LoyaltyRewardType" AS ENUM ('fixed_discount', 'free_delivery', 'percentage_discount', 'gift', 'custom');
CREATE TYPE "LoyaltyRedemptionStatus" AS ENUM ('issued', 'applied', 'cancelled', 'expired');
CREATE TYPE "QualityIssueType" AS ENUM ('pointsWithoutRevenue', 'deliveredOrderWithoutPoints', 'pointsOnCancelledOrder', 'potentialDuplicate', 'invalidEmail', 'missingPhone');
CREATE TYPE "QualityIssueSeverity" AS ENUM ('info', 'warning', 'critical');
CREATE TYPE "QualityIssueStatus" AS ENUM ('open', 'reviewed', 'resolved', 'ignored');
CREATE TYPE "PrivacyRequestType" AS ENUM ('export', 'anonymize', 'delete');
CREATE TYPE "PrivacyRequestStatus" AS ENUM ('requested', 'under_review', 'completed', 'rejected');

ALTER TABLE "User"
  ADD COLUMN "activitySegment" "CustomerActivitySegment" NOT NULL DEFAULT 'NO_PURCHASE',
  ADD COLUMN "loyaltySuspendedAt" TIMESTAMP(3),
  ADD COLUMN "loyaltySuspensionReason" TEXT,
  ADD COLUMN "anonymizationRequestedAt" TIMESTAMP(3),
  ADD COLUMN "anonymizedAt" TIMESTAMP(3);

CREATE TABLE "LoyaltyProgramSettings" (
  "id" TEXT NOT NULL DEFAULT 'default',
  "statusValidityMonths" INTEGER NOT NULL DEFAULT 12,
  "pointExpirationMonths" INTEGER NOT NULL DEFAULT 18,
  "expirationAlertDays" INTEGER[] NOT NULL DEFAULT ARRAY[60,30,7],
  "separateStatusAndPoints" BOOLEAN NOT NULL DEFAULT true,
  "newCustomerDays" INTEGER NOT NULL DEFAULT 30,
  "activeCustomerDays" INTEGER NOT NULL DEFAULT 90,
  "inactiveCustomerDays" INTEGER NOT NULL DEFAULT 365,
  "loyalMinimumOrders" INTEGER NOT NULL DEFAULT 3,
  "loyalMinimumRevenue" DECIMAL(10,2) NOT NULL DEFAULT 1000,
  "reengagementCycleMultiplier" DECIMAL(5,2) NOT NULL DEFAULT 1.5,
  "minimumOrdersForCycle" INTEGER NOT NULL DEFAULT 3,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "LoyaltyProgramSettings_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "LoyaltyTierRule" (
  "id" TEXT NOT NULL,
  "tier" "LoyaltyTier" NOT NULL,
  "pointsPer100Mad" INTEGER NOT NULL,
  "revenueThreshold" DECIMAL(10,2) NOT NULL,
  "qualificationMonths" INTEGER NOT NULL DEFAULT 12,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "LoyaltyTierRule_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "LoyaltyTransaction" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "orderId" TEXT,
  "rewardRedemptionId" TEXT,
  "type" "LoyaltyTransactionType" NOT NULL,
  "amount" INTEGER NOT NULL,
  "reason" TEXT NOT NULL,
  "previousBalance" INTEGER NOT NULL,
  "newBalance" INTEGER NOT NULL,
  "expiresAt" TIMESTAMP(3),
  "createdBy" TEXT,
  "idempotencyKey" TEXT,
  "metadata" JSONB,
  "reversedTransactionId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "LoyaltyTransaction_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "LoyaltyRefundEvent" (
  "id" TEXT NOT NULL,
  "orderId" TEXT NOT NULL,
  "externalEventId" TEXT NOT NULL,
  "refundedAmount" DECIMAL(10,2) NOT NULL,
  "loyaltyTransactionId" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "LoyaltyRefundEvent_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "LoyaltyReward" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "type" "LoyaltyRewardType" NOT NULL,
  "pointsCost" INTEGER NOT NULL,
  "monetaryValue" DECIMAL(10,2),
  "percentageValue" INTEGER,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "archivedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "LoyaltyReward_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "LoyaltyRewardRedemption" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "rewardId" TEXT NOT NULL,
  "status" "LoyaltyRedemptionStatus" NOT NULL DEFAULT 'issued',
  "pointsCostSnapshot" INTEGER NOT NULL,
  "rewardSnapshot" JSONB NOT NULL,
  "idempotencyKey" TEXT NOT NULL,
  "issuedBy" TEXT,
  "appliedAt" TIMESTAMP(3),
  "cancelledAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "LoyaltyRewardRedemption_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CustomerTag" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "color" TEXT NOT NULL DEFAULT 'blue',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CustomerTag_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CustomerTagAssignment" (
  "userId" TEXT NOT NULL,
  "tagId" TEXT NOT NULL,
  "assignedBy" TEXT,
  "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CustomerTagAssignment_pkey" PRIMARY KEY ("userId", "tagId")
);

CREATE TABLE "CustomerNote" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "content" TEXT NOT NULL,
  "createdBy" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CustomerNote_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CustomerQualityIssue" (
  "id" TEXT NOT NULL,
  "issueKey" TEXT NOT NULL,
  "userId" TEXT,
  "orderId" TEXT,
  "type" "QualityIssueType" NOT NULL,
  "severity" "QualityIssueSeverity" NOT NULL,
  "status" "QualityIssueStatus" NOT NULL DEFAULT 'open',
  "description" TEXT NOT NULL,
  "recommendedAction" TEXT NOT NULL,
  "metadata" JSONB,
  "detectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "reviewedAt" TIMESTAMP(3),
  "reviewedBy" TEXT,
  "resolvedAt" TIMESTAMP(3),
  CONSTRAINT "CustomerQualityIssue_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AdminAuditLog" (
  "id" TEXT NOT NULL,
  "actorUserId" TEXT,
  "actorEmail" TEXT,
  "action" TEXT NOT NULL,
  "entity" TEXT NOT NULL,
  "entityId" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AdminAuditLog_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CustomerExportLog" (
  "id" TEXT NOT NULL,
  "userId" TEXT,
  "exportedBy" TEXT NOT NULL,
  "format" TEXT NOT NULL DEFAULT 'csv',
  "rowCount" INTEGER NOT NULL,
  "filters" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CustomerExportLog_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CustomerPrivacyRequest" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "type" "PrivacyRequestType" NOT NULL,
  "status" "PrivacyRequestStatus" NOT NULL DEFAULT 'requested',
  "reason" TEXT,
  "requestedBy" TEXT NOT NULL,
  "reviewedBy" TEXT,
  "reviewedAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CustomerPrivacyRequest_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CustomerConsent" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "granted" BOOLEAN NOT NULL,
  "source" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CustomerConsent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "LoyaltyTierRule_tier_key" ON "LoyaltyTierRule"("tier");
CREATE INDEX "LoyaltyTierRule_isActive_revenueThreshold_idx" ON "LoyaltyTierRule"("isActive", "revenueThreshold");
CREATE UNIQUE INDEX "LoyaltyTransaction_idempotencyKey_key" ON "LoyaltyTransaction"("idempotencyKey");
CREATE INDEX "LoyaltyTransaction_userId_createdAt_idx" ON "LoyaltyTransaction"("userId", "createdAt");
CREATE INDEX "LoyaltyTransaction_orderId_type_idx" ON "LoyaltyTransaction"("orderId", "type");
CREATE INDEX "LoyaltyTransaction_expiresAt_idx" ON "LoyaltyTransaction"("expiresAt");
CREATE INDEX "LoyaltyTransaction_rewardRedemptionId_idx" ON "LoyaltyTransaction"("rewardRedemptionId");
CREATE UNIQUE INDEX "LoyaltyRefundEvent_loyaltyTransactionId_key" ON "LoyaltyRefundEvent"("loyaltyTransactionId");
CREATE UNIQUE INDEX "LoyaltyRefundEvent_orderId_externalEventId_key" ON "LoyaltyRefundEvent"("orderId", "externalEventId");
CREATE INDEX "LoyaltyRefundEvent_orderId_createdAt_idx" ON "LoyaltyRefundEvent"("orderId", "createdAt");
CREATE INDEX "LoyaltyReward_isActive_pointsCost_idx" ON "LoyaltyReward"("isActive", "pointsCost");
CREATE UNIQUE INDEX "LoyaltyRewardRedemption_idempotencyKey_key" ON "LoyaltyRewardRedemption"("idempotencyKey");
CREATE INDEX "LoyaltyRewardRedemption_userId_createdAt_idx" ON "LoyaltyRewardRedemption"("userId", "createdAt");
CREATE INDEX "LoyaltyRewardRedemption_rewardId_status_idx" ON "LoyaltyRewardRedemption"("rewardId", "status");
CREATE UNIQUE INDEX "CustomerTag_name_key" ON "CustomerTag"("name");
CREATE INDEX "CustomerTagAssignment_tagId_assignedAt_idx" ON "CustomerTagAssignment"("tagId", "assignedAt");
CREATE INDEX "CustomerNote_userId_createdAt_idx" ON "CustomerNote"("userId", "createdAt");
CREATE UNIQUE INDEX "CustomerQualityIssue_issueKey_key" ON "CustomerQualityIssue"("issueKey");
CREATE INDEX "CustomerQualityIssue_status_severity_detectedAt_idx" ON "CustomerQualityIssue"("status", "severity", "detectedAt");
CREATE INDEX "CustomerQualityIssue_userId_status_idx" ON "CustomerQualityIssue"("userId", "status");
CREATE INDEX "CustomerQualityIssue_orderId_idx" ON "CustomerQualityIssue"("orderId");
CREATE INDEX "AdminAuditLog_entity_entityId_createdAt_idx" ON "AdminAuditLog"("entity", "entityId", "createdAt");
CREATE INDEX "AdminAuditLog_actorUserId_createdAt_idx" ON "AdminAuditLog"("actorUserId", "createdAt");
CREATE INDEX "AdminAuditLog_action_createdAt_idx" ON "AdminAuditLog"("action", "createdAt");
CREATE INDEX "CustomerExportLog_exportedBy_createdAt_idx" ON "CustomerExportLog"("exportedBy", "createdAt");
CREATE INDEX "CustomerExportLog_userId_createdAt_idx" ON "CustomerExportLog"("userId", "createdAt");
CREATE INDEX "CustomerPrivacyRequest_status_createdAt_idx" ON "CustomerPrivacyRequest"("status", "createdAt");
CREATE INDEX "CustomerPrivacyRequest_userId_createdAt_idx" ON "CustomerPrivacyRequest"("userId", "createdAt");
CREATE INDEX "CustomerConsent_userId_type_createdAt_idx" ON "CustomerConsent"("userId", "type", "createdAt");
CREATE INDEX "User_loyaltyTier_idx" ON "User"("loyaltyTier");
CREATE INDEX "User_activitySegment_idx" ON "User"("activitySegment");
CREATE INDEX "User_createdAt_idx" ON "User"("createdAt");

ALTER TABLE "LoyaltyTransaction" ADD CONSTRAINT "LoyaltyTransaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "LoyaltyTransaction" ADD CONSTRAINT "LoyaltyTransaction_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "LoyaltyTransaction" ADD CONSTRAINT "LoyaltyTransaction_rewardRedemptionId_fkey" FOREIGN KEY ("rewardRedemptionId") REFERENCES "LoyaltyRewardRedemption"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "LoyaltyTransaction" ADD CONSTRAINT "LoyaltyTransaction_reversedTransactionId_fkey" FOREIGN KEY ("reversedTransactionId") REFERENCES "LoyaltyTransaction"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "LoyaltyRefundEvent" ADD CONSTRAINT "LoyaltyRefundEvent_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "LoyaltyRefundEvent" ADD CONSTRAINT "LoyaltyRefundEvent_loyaltyTransactionId_fkey" FOREIGN KEY ("loyaltyTransactionId") REFERENCES "LoyaltyTransaction"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "LoyaltyRewardRedemption" ADD CONSTRAINT "LoyaltyRewardRedemption_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "LoyaltyRewardRedemption" ADD CONSTRAINT "LoyaltyRewardRedemption_rewardId_fkey" FOREIGN KEY ("rewardId") REFERENCES "LoyaltyReward"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CustomerTagAssignment" ADD CONSTRAINT "CustomerTagAssignment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CustomerTagAssignment" ADD CONSTRAINT "CustomerTagAssignment_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "CustomerTag"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CustomerNote" ADD CONSTRAINT "CustomerNote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CustomerQualityIssue" ADD CONSTRAINT "CustomerQualityIssue_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CustomerQualityIssue" ADD CONSTRAINT "CustomerQualityIssue_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CustomerExportLog" ADD CONSTRAINT "CustomerExportLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CustomerPrivacyRequest" ADD CONSTRAINT "CustomerPrivacyRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CustomerConsent" ADD CONSTRAINT "CustomerConsent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "LoyaltyProgramSettings" ("id", "updatedAt") VALUES ('default', CURRENT_TIMESTAMP);
INSERT INTO "LoyaltyTierRule" ("id", "tier", "pointsPer100Mad", "revenueThreshold", "qualificationMonths", "updatedAt") VALUES
  ('loyalty-tier-bronze', 'bronze', 10, 0, 12, CURRENT_TIMESTAMP),
  ('loyalty-tier-silver', 'silver', 12, 3000, 12, CURRENT_TIMESTAMP),
  ('loyalty-tier-gold', 'gold', 15, 6000, 12, CURRENT_TIMESTAMP);
INSERT INTO "LoyaltyReward" ("id", "name", "description", "type", "pointsCost", "monetaryValue", "updatedAt") VALUES
  ('reward-discount-10', 'Réduction 10 MAD', 'Bon de réduction de 10 MAD', 'fixed_discount', 50, 10, CURRENT_TIMESTAMP),
  ('reward-discount-20', 'Bon d''achat 20 MAD', 'Bon d''achat de 20 MAD', 'fixed_discount', 100, 20, CURRENT_TIMESTAMP),
  ('reward-free-delivery', 'Livraison offerte', 'Livraison standard offerte', 'free_delivery', 150, NULL, CURRENT_TIMESTAMP),
  ('reward-discount-50', 'Bon d''achat 50 MAD', 'Bon d''achat de 50 MAD', 'fixed_discount', 250, 50, CURRENT_TIMESTAMP);

-- Preserve legacy cached balances as the first auditable ledger entry.
INSERT INTO "LoyaltyTransaction" ("id", "userId", "type", "amount", "reason", "previousBalance", "newBalance", "createdBy", "idempotencyKey", "createdAt")
SELECT 'opening-' || "id", "id", 'opening_balance', "loyaltyPoints", 'Solde antérieur à la migration du grand livre', 0, "loyaltyPoints", 'system:migration', 'opening:' || "id", CURRENT_TIMESTAMP
FROM "User"
WHERE "loyaltyPoints" <> 0;

-- Initial segment backfill uses the same paid + delivered perimeter.
UPDATE "User" u
SET "activitySegment" = CASE
  WHEN NOT EXISTS (SELECT 1 FROM "Order" o WHERE o."userId" = u."id" AND o."status" = 'delivered' AND o."paymentStatus" = 'paid') THEN
    CASE WHEN u."createdAt" >= CURRENT_TIMESTAMP - INTERVAL '30 days' THEN 'NEW'::"CustomerActivitySegment" ELSE 'NO_PURCHASE'::"CustomerActivitySegment" END
  WHEN EXISTS (SELECT 1 FROM "Order" o WHERE o."userId" = u."id" AND o."status" = 'delivered' AND o."paymentStatus" = 'paid' AND o."orderDate" >= CURRENT_TIMESTAMP - INTERVAL '90 days') THEN 'ACTIVE'::"CustomerActivitySegment"
  WHEN EXISTS (SELECT 1 FROM "Order" o WHERE o."userId" = u."id" AND o."status" = 'delivered' AND o."paymentStatus" = 'paid' AND o."orderDate" >= CURRENT_TIMESTAMP - INTERVAL '365 days') THEN 'TO_REENGAGE'::"CustomerActivitySegment"
  ELSE 'INACTIVE'::"CustomerActivitySegment"
END;
