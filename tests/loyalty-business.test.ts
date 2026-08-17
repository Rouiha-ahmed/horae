import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { buildCsv } from "../lib/customer-export";
import {
  applyLedgerMovement,
  calculateEarnedPoints,
  calculateOutstandingExpiringLots,
  calculateRefundPointReversal,
  classifyCustomerSegment,
  createLedgerSnapshot,
  isValidCommercialOrder,
  normalizePagination,
} from "../lib/loyalty";
import { buildCustomerWhere } from "../lib/services/admin-customers";
import { writeAuditLog } from "../lib/services/loyalty";

test("1. paid + delivered is a valid commercial order", () => {
  assert.equal(isValidCommercialOrder({ status: "delivered", paymentStatus: "paid" }), true);
});

test("2. paid but not delivered is excluded", () => {
  assert.equal(isValidCommercialOrder({ status: "shipped", paymentStatus: "paid" }), false);
});

test("3. delivered but unpaid is excluded", () => {
  assert.equal(isValidCommercialOrder({ status: "delivered", paymentStatus: "pending" }), false);
});

test("4. cancelled orders cannot qualify for loyalty", () => {
  assert.equal(isValidCommercialOrder({ status: "cancelled", paymentStatus: "paid" }), false);
});

test("5. points use the configured tier rate per complete 100 MAD", () => {
  assert.equal(calculateEarnedPoints(897, 15), 120);
  assert.equal(calculateEarnedPoints(99.99, 15), 0);
});

test("6. manual adjustment produces an auditable balance snapshot", () => {
  assert.deepEqual(createLedgerSnapshot({ balance: 80, amount: 20, type: "manual_adjustment", reason: "Geste commercial" }), {
    amount: 20,
    type: "manual_adjustment",
    reason: "Geste commercial",
    previousBalance: 80,
    newBalance: 100,
  });
});

test("7. a full refund reverses all earned points", () => {
  assert.equal(calculateRefundPointReversal({ originalPoints: 80, orderAmount: 800, refundAmount: 800 }), 80);
});

test("8. a partial refund reverses only the proportional amount", () => {
  assert.equal(calculateRefundPointReversal({ originalPoints: 80, orderAmount: 800, refundAmount: 200 }), 20);
});

test("9. cumulative refunds cannot double-reverse the original earning", () => {
  assert.equal(calculateRefundPointReversal({ originalPoints: 80, orderAmount: 800, refundAmount: 800, alreadyReversedPoints: 80 }), 0);
});

test("10. segmentation recognizes personalized re-engagement cycles", () => {
  const result = classifyCustomerSegment({
    createdAt: new Date("2025-01-01T00:00:00Z"),
    validOrderDates: [
      new Date("2025-11-01T00:00:00Z"),
      new Date("2025-12-01T00:00:00Z"),
      new Date("2026-01-01T00:00:00Z"),
    ],
    qualifyingRevenue: 1_500,
    now: new Date("2026-03-15T00:00:00Z"),
  });
  assert.equal(result.segment, "TO_REENGAGE");
  assert.equal(Math.round(result.averageIntervalDays || 0), 31);
});

test("11. server pagination clamps page size and calculates the database offset", () => {
  assert.deepEqual(normalizePagination(3, 500), { page: 3, pageSize: 100, skip: 200 });
  assert.deepEqual(normalizePagination(-2, 2), { page: 1, pageSize: 10, skip: 0 });
});

test("12. customer search covers name, email, card, and address phone", () => {
  const where = buildCustomerWhere({ search: "zayna" });
  assert.equal(where.OR?.length, 4);
  assert.match(JSON.stringify(where), /fullName/);
  assert.match(JSON.stringify(where), /email/);
  assert.match(JSON.stringify(where), /loyaltyCardNumber/);
  assert.match(JSON.stringify(where), /phone/);
});

test("13. tier, segment, tag, and expiring filters remain database-side", () => {
  const where = buildCustomerWhere({ tier: "gold", segment: "LOYAL", tagId: "vip", alert: "expiring" });
  assert.equal(where.loyaltyTier, "gold");
  assert.equal(where.activitySegment, "LOYAL");
  assert.match(JSON.stringify(where), /customerTags/);
  assert.match(JSON.stringify(where), /loyaltyTransactions/);
});

test("14. reward redemption deducts points through the same movement rule", () => {
  assert.equal(applyLedgerMovement(250, -100), 150);
});

test("15. insufficient points prevents reward redemption", () => {
  assert.throws(() => applyLedgerMovement(50, -100), /insuffisant/);
});

test("16. audit writer stores actor, action, entity and metadata", async () => {
  const calls: Array<Record<string, unknown>> = [];
  const db = {
    adminAuditLog: {
      create: async ({ data }: { data: Record<string, unknown> }) => {
        calls.push(data);
        return data;
      },
    },
  };
  await writeAuditLog(db as never, {
    actor: { userId: "admin_1", email: "admin@zayna.ma" },
    action: "loyalty.points_adjusted",
    entity: "User",
    entityId: "customer_1",
    metadata: { amount: 10 },
  });
  assert.deepEqual(calls[0], {
    actorUserId: "admin_1",
    actorEmail: "admin@zayna.ma",
    action: "loyalty.points_adjusted",
    entity: "User",
    entityId: "customer_1",
    metadata: { amount: 10 },
  });
});

test("17. CSV export is UTF-8 and neutralizes spreadsheet formulas", () => {
  const csv = buildCsv([["Client", "Email"], ["=HYPERLINK(\"bad\")", "safe@zayna.ma"]]);
  assert.equal(csv.startsWith("\uFEFF"), true);
  assert.match(csv, /'=HYPERLINK/);
});

test("18. customer mutations and exports retain server-side admin guards", () => {
  const actions = readFileSync(new URL("../app/admin/clients/actions.ts", import.meta.url), "utf8");
  const exportRoute = readFileSync(new URL("../app/admin/clients/export/route.ts", import.meta.url), "utf8");
  assert.match(actions, /await requireAdmin\(\)/);
  assert.match(exportRoute, /await requireAdmin\(\)/);
});

test("19. expiring-points calculation allocates redemptions FIFO", () => {
  const lots = calculateOutstandingExpiringLots([
    { id: "earn-1", amount: 80, createdAt: new Date("2026-01-01"), expiresAt: new Date("2026-06-01") },
    { id: "earn-2", amount: 50, createdAt: new Date("2026-02-01"), expiresAt: new Date("2027-01-01") },
    { id: "redeem", amount: -30, createdAt: new Date("2026-03-01"), expiresAt: null },
  ], new Date("2026-07-01"), new Date("2026-04-01"));
  assert.deepEqual(lots.map((lot) => ({ id: lot.id, remaining: lot.remaining })), [
    { id: "earn-1", remaining: 50 },
  ]);
});

test("20. a linked cancellation reversal consumes its original earning", () => {
  const lots = calculateOutstandingExpiringLots([
    { id: "earn-1", amount: 80, createdAt: new Date("2026-01-01"), expiresAt: new Date("2026-06-01") },
    { id: "earn-2", amount: 50, createdAt: new Date("2026-02-01"), expiresAt: new Date("2026-06-01") },
    { id: "reverse-2", amount: -50, createdAt: new Date("2026-03-01"), expiresAt: null, reversedTransactionId: "earn-2" },
  ], new Date("2026-07-01"), new Date("2026-04-01"));
  assert.deepEqual(lots.map((lot) => lot.id), ["earn-1"]);
});
