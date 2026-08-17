ALTER TABLE "User"
  ADD COLUMN "loyaltyTierQualifiedAt" TIMESTAMP(3),
  ADD COLUMN "loyaltyTierValidUntil" TIMESTAMP(3);

CREATE INDEX "User_loyaltyTierValidUntil_idx" ON "User"("loyaltyTierValidUntil");

-- Backfill status and segment from the authoritative paid + delivered perimeter.
WITH commercial AS (
  SELECT
    u."id" AS "userId",
    COALESCE(SUM(o."totalPrice") FILTER (WHERE o."orderDate" >= CURRENT_TIMESTAMP - INTERVAL '12 months'), 0) AS revenue_12m,
    COUNT(o."id") FILTER (WHERE o."orderDate" >= CURRENT_TIMESTAMP - INTERVAL '12 months') AS orders_12m,
    MAX(o."orderDate") AS last_order
  FROM "User" u
  LEFT JOIN "Order" o
    ON o."userId" = u."id"
    AND o."status" = 'delivered'
    AND o."paymentStatus" = 'paid'
  GROUP BY u."id"
)
UPDATE "User" u
SET
  "loyaltyTier" = CASE
    WHEN c.revenue_12m >= 6000 THEN 'gold'::"LoyaltyTier"
    WHEN c.revenue_12m >= 3000 THEN 'silver'::"LoyaltyTier"
    ELSE 'bronze'::"LoyaltyTier"
  END,
  "loyaltyTierQualifiedAt" = CASE WHEN c.last_order IS NOT NULL THEN CURRENT_TIMESTAMP ELSE NULL END,
  "loyaltyTierValidUntil" = CASE WHEN c.last_order IS NOT NULL THEN CURRENT_TIMESTAMP + INTERVAL '12 months' ELSE NULL END,
  "activitySegment" = CASE
    WHEN c.last_order IS NULL THEN CASE WHEN u."createdAt" >= CURRENT_TIMESTAMP - INTERVAL '30 days' THEN 'NEW'::"CustomerActivitySegment" ELSE 'NO_PURCHASE'::"CustomerActivitySegment" END
    WHEN c.last_order < CURRENT_TIMESTAMP - INTERVAL '365 days' THEN 'INACTIVE'::"CustomerActivitySegment"
    WHEN c.last_order < CURRENT_TIMESTAMP - INTERVAL '90 days' THEN 'TO_REENGAGE'::"CustomerActivitySegment"
    WHEN c.orders_12m >= 3 AND c.revenue_12m >= 1000 THEN 'LOYAL'::"CustomerActivitySegment"
    ELSE 'ACTIVE'::"CustomerActivitySegment"
  END
FROM commercial c
WHERE c."userId" = u."id";
