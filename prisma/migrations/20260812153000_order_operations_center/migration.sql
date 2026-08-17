-- Independent operational dimensions. The legacy Order.status remains for storefront compatibility.
CREATE TYPE "FulfillmentStatus" AS ENUM ('to_prepare', 'preparing', 'ready', 'shipped', 'cancelled');
CREATE TYPE "ReturnStatus" AS ENUM ('requested', 'approved', 'received', 'inspected', 'closed', 'rejected');
CREATE TYPE "OrderSlaStage" AS ENUM ('preparation', 'shipping', 'delivery');

ALTER TABLE "Order"
ADD COLUMN "fulfillmentStatus" "FulfillmentStatus" NOT NULL DEFAULT 'to_prepare',
ADD COLUMN "confirmationRequired" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "confirmedAt" TIMESTAMP(3),
ADD COLUMN "preparationStartedAt" TIMESTAMP(3),
ADD COLUMN "preparedAt" TIMESTAMP(3),
ADD COLUMN "shippedAt" TIMESTAMP(3),
ADD COLUMN "deliveredAt" TIMESTAMP(3),
ADD COLUMN "estimatedDeliveryAt" TIMESTAMP(3),
ADD COLUMN "version" INTEGER NOT NULL DEFAULT 0;

-- Conservative legacy mapping:
-- pending/processing remain work to prepare; paid meant "preparing" in the old admin mapper;
-- shipped/out_for_delivery/delivered imply fulfillment left the warehouse; cancellation stays terminal.
UPDATE "Order"
SET "fulfillmentStatus" = CASE
  WHEN "status" = 'paid' THEN 'preparing'::"FulfillmentStatus"
  WHEN "status" IN ('shipped', 'out_for_delivery', 'delivered') THEN 'shipped'::"FulfillmentStatus"
  WHEN "status" = 'cancelled' THEN 'cancelled'::"FulfillmentStatus"
  ELSE 'to_prepare'::"FulfillmentStatus"
END;

UPDATE "Order"
SET
  "confirmedAt" = CASE
    WHEN "status" NOT IN ('pending', 'cancelled') THEN "statusChangedAt"
    ELSE NULL
  END,
  "preparationStartedAt" = CASE
    WHEN "status" IN ('paid', 'shipped', 'out_for_delivery', 'delivered') THEN "statusChangedAt"
    ELSE NULL
  END,
  "preparedAt" = CASE
    WHEN "status" IN ('shipped', 'out_for_delivery', 'delivered') THEN "statusChangedAt"
    ELSE NULL
  END,
  "shippedAt" = CASE
    WHEN "status" IN ('shipped', 'out_for_delivery', 'delivered') THEN "statusChangedAt"
    ELSE NULL
  END,
  "deliveredAt" = CASE
    WHEN "status" = 'delivered' OR "deliveryStatus" = 'delivered' THEN "statusChangedAt"
    ELSE NULL
  END;

-- Repair legacy delivered rows whose delivery dimension was never synchronized.
UPDATE "Order"
SET "deliveryStatus" = 'delivered'
WHERE "status" = 'delivered' AND "deliveryStatus" <> 'delivered';

CREATE TABLE "OrderEvent" (
  "id" TEXT NOT NULL,
  "orderId" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "actorUserId" TEXT,
  "actorEmail" TEXT,
  "actorName" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "OrderEvent_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "OrderNote" (
  "id" TEXT NOT NULL,
  "orderId" TEXT NOT NULL,
  "content" TEXT NOT NULL,
  "createdBy" TEXT NOT NULL,
  "actorUserId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "OrderNote_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "OrderReturn" (
  "id" TEXT NOT NULL,
  "orderId" TEXT NOT NULL,
  "status" "ReturnStatus" NOT NULL DEFAULT 'requested',
  "reason" TEXT NOT NULL,
  "itemSnapshot" JSONB,
  "refundStatus" TEXT,
  "refundAmount" DECIMAL(10,2),
  "refundedAt" TIMESTAMP(3),
  "requestedBy" TEXT,
  "reviewedBy" TEXT,
  "receivedAt" TIMESTAMP(3),
  "inspectedAt" TIMESTAMP(3),
  "closedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "OrderReturn_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "OrderSlaPolicy" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "stage" "OrderSlaStage" NOT NULL,
  "durationHours" INTEGER NOT NULL,
  "workingDays" BOOLEAN NOT NULL DEFAULT true,
  "applicableCarrier" TEXT,
  "applicableZone" TEXT,
  "priority" INTEGER NOT NULL DEFAULT 0,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "OrderSlaPolicy_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Order_fulfillmentStatus_orderDate_idx" ON "Order"("fulfillmentStatus", "orderDate");
CREATE INDEX "Order_customerName_idx" ON "Order"("customerName");
CREATE INDEX "Order_shippingPhone_idx" ON "Order"("shippingPhone");
CREATE INDEX "Order_shippingCity_idx" ON "Order"("shippingCity");
CREATE INDEX "Order_trackingNumber_idx" ON "Order"("trackingNumber");
CREATE INDEX "OrderEvent_orderId_createdAt_idx" ON "OrderEvent"("orderId", "createdAt");
CREATE INDEX "OrderEvent_type_createdAt_idx" ON "OrderEvent"("type", "createdAt");
CREATE INDEX "OrderNote_orderId_createdAt_idx" ON "OrderNote"("orderId", "createdAt");
CREATE INDEX "OrderReturn_orderId_status_idx" ON "OrderReturn"("orderId", "status");
CREATE INDEX "OrderReturn_status_createdAt_idx" ON "OrderReturn"("status", "createdAt");
CREATE INDEX "OrderSlaPolicy_stage_isActive_priority_idx" ON "OrderSlaPolicy"("stage", "isActive", "priority");

ALTER TABLE "OrderEvent" ADD CONSTRAINT "OrderEvent_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OrderNote" ADD CONSTRAINT "OrderNote_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OrderReturn" ADD CONSTRAINT "OrderReturn_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

INSERT INTO "OrderSlaPolicy" (
  "id", "name", "stage", "durationHours", "workingDays", "applicableZone", "priority", "updatedAt"
) VALUES
  ('default-preparation', 'Préparation standard', 'preparation', 24, true, NULL, 0, CURRENT_TIMESTAMP),
  ('default-shipping', 'Expédition après préparation', 'shipping', 24, true, NULL, 0, CURRENT_TIMESTAMP),
  ('delivery-rabat-sale', 'Livraison Rabat-Salé', 'delivery', 24, true, 'rabat-sale', 20, CURRENT_TIMESTAMP),
  ('delivery-other-zones', 'Livraison autres zones', 'delivery', 72, true, NULL, 0, CURRENT_TIMESTAMP);

-- Seed an immutable creation event for every existing order.
INSERT INTO "OrderEvent" (
  "id", "orderId", "type", "title", "description", "actorName", "createdAt"
)
SELECT
  'legacy-created-' || "id",
  "id",
  'ORDER_CREATED',
  'Commande créée',
  'Événement initial créé lors de la migration du centre opérationnel.',
  'Système',
  "createdAt"
FROM "Order";
