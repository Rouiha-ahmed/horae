import type { LoyaltyTier } from "@prisma/client";

export const DEFAULT_TIER_RULES = [
  { tier: "bronze" as const, pointsPer100Mad: 10, revenueThreshold: 0, qualificationMonths: 12 },
  { tier: "silver" as const, pointsPer100Mad: 12, revenueThreshold: 3_000, qualificationMonths: 12 },
  { tier: "gold" as const, pointsPer100Mad: 15, revenueThreshold: 6_000, qualificationMonths: 12 },
];

export const DEFAULT_SEGMENT_RULES = {
  newCustomerDays: 30,
  activeCustomerDays: 90,
  inactiveCustomerDays: 365,
  loyalMinimumOrders: 3,
  loyalMinimumRevenue: 1_000,
  reengagementCycleMultiplier: 1.5,
  minimumOrdersForCycle: 3,
};

export const POINTS_PER_100_MAD = DEFAULT_TIER_RULES[0].pointsPer100Mad;
export const TIER_THRESHOLDS: Record<LoyaltyTier, number> = {
  bronze: 0,
  silver: 3_000,
  gold: 6_000,
};

export const TIER_LABELS: Record<LoyaltyTier, string> = {
  bronze: "Bronze",
  silver: "Argent",
  gold: "Gold",
};

export type CommercialOrderLike = {
  status: string;
  paymentStatus: string;
  totalPrice?: number;
  orderDate?: Date;
};

export type ActivitySegment =
  | "NEW"
  | "ACTIVE"
  | "LOYAL"
  | "TO_REENGAGE"
  | "NO_PURCHASE"
  | "INACTIVE";

export type SegmentRuleInput = typeof DEFAULT_SEGMENT_RULES;

/** The one authoritative commercial perimeter used throughout the application. */
export function isValidCommercialOrder(order: Pick<CommercialOrderLike, "status" | "paymentStatus">) {
  return order.status === "delivered" && order.paymentStatus === "paid";
}

export function calculateEarnedPoints(totalMAD: number, pointsPer100Mad = POINTS_PER_100_MAD) {
  if (!Number.isFinite(totalMAD) || totalMAD <= 0 || pointsPer100Mad <= 0) return 0;
  return Math.floor(totalMAD / 100) * Math.trunc(pointsPer100Mad);
}

export function getTierFromRevenue(
  revenue: number,
  rules: Array<{ tier: LoyaltyTier; revenueThreshold: number }>,
): LoyaltyTier {
  return [...rules]
    .sort((a, b) => b.revenueThreshold - a.revenueThreshold)
    .find((rule) => revenue >= rule.revenueThreshold)?.tier ?? "bronze";
}

/** Backward-compatible helper for storefront screens; status is revenue-based in admin services. */
export function getTierFromPoints(points: number): LoyaltyTier {
  if (points >= 600) return "gold";
  if (points >= 300) return "silver";
  return "bronze";
}

export function getPointsToNextTier(points: number) {
  if (points >= 600) return { nextTier: null, pointsNeeded: 0, progressPct: 100 };
  if (points >= 300) {
    return {
      nextTier: "gold" as LoyaltyTier,
      pointsNeeded: 600 - points,
      progressPct: Math.max(0, Math.min(100, Math.round(((points - 300) / 300) * 100))),
    };
  }
  return {
    nextTier: "silver" as LoyaltyTier,
    pointsNeeded: 300 - points,
    progressPct: Math.max(0, Math.min(100, Math.round((points / 300) * 100))),
  };
}

export function averagePurchaseIntervalDays(dates: Date[]) {
  const ordered = [...dates].sort((a, b) => a.getTime() - b.getTime());
  if (ordered.length < 2) return null;
  const intervals = ordered.slice(1).map((date, index) =>
    (date.getTime() - ordered[index].getTime()) / 86_400_000,
  );
  return intervals.reduce((sum, value) => sum + value, 0) / intervals.length;
}

export function classifyCustomerSegment(input: {
  createdAt: Date;
  validOrderDates: Date[];
  qualifyingRevenue: number;
  now?: Date;
  rules?: SegmentRuleInput;
}): {
  segment: ActivitySegment;
  averageIntervalDays: number | null;
  daysSinceLastPurchase: number | null;
  expectedNextPurchaseAt: Date | null;
} {
  const now = input.now ?? new Date();
  const rules = input.rules ?? DEFAULT_SEGMENT_RULES;
  const dates = [...input.validOrderDates].sort((a, b) => a.getTime() - b.getTime());
  const ageDays = Math.floor((now.getTime() - input.createdAt.getTime()) / 86_400_000);

  if (!dates.length) {
    return {
      segment: ageDays <= rules.newCustomerDays ? "NEW" : "NO_PURCHASE",
      averageIntervalDays: null,
      daysSinceLastPurchase: null,
      expectedNextPurchaseAt: null,
    };
  }

  const lastPurchase = dates.at(-1)!;
  const daysSinceLastPurchase = Math.max(
    0,
    Math.floor((now.getTime() - lastPurchase.getTime()) / 86_400_000),
  );
  const averageIntervalDays = averagePurchaseIntervalDays(dates);
  const expectedNextPurchaseAt = averageIntervalDays
    ? new Date(lastPurchase.getTime() + averageIntervalDays * 86_400_000)
    : null;

  let segment: ActivitySegment;
  if (ageDays <= rules.newCustomerDays && dates.length <= 1) {
    segment = "NEW";
  } else if (daysSinceLastPurchase >= rules.inactiveCustomerDays) {
    segment = "INACTIVE";
  } else if (
    dates.length >= rules.minimumOrdersForCycle &&
    averageIntervalDays &&
    daysSinceLastPurchase > averageIntervalDays * rules.reengagementCycleMultiplier
  ) {
    segment = "TO_REENGAGE";
  } else if (
    dates.length >= rules.loyalMinimumOrders &&
    input.qualifyingRevenue >= rules.loyalMinimumRevenue &&
    daysSinceLastPurchase <= rules.activeCustomerDays
  ) {
    segment = "LOYAL";
  } else if (daysSinceLastPurchase <= rules.activeCustomerDays) {
    segment = "ACTIVE";
  } else {
    segment = "TO_REENGAGE";
  }

  return { segment, averageIntervalDays, daysSinceLastPurchase, expectedNextPurchaseAt };
}

export function calculateRefundPointReversal(input: {
  originalPoints: number;
  orderAmount: number;
  refundAmount: number;
  alreadyReversedPoints?: number;
}) {
  const originalPoints = Math.max(0, Math.trunc(input.originalPoints));
  const alreadyReversed = Math.max(0, Math.trunc(input.alreadyReversedPoints ?? 0));
  if (originalPoints === 0 || input.orderAmount <= 0 || input.refundAmount <= 0) return 0;
  const proportional = Math.floor(
    originalPoints * Math.min(1, input.refundAmount / input.orderAmount),
  );
  return Math.max(0, Math.min(originalPoints - alreadyReversed, proportional));
}

export function applyLedgerMovement(balance: number, amount: number, allowNegative = false) {
  if (!Number.isInteger(amount) || amount === 0) {
    throw new Error("Le mouvement de points doit être un entier non nul.");
  }
  const next = balance + amount;
  if (!allowNegative && next < 0) {
    throw new Error("Le solde de points est insuffisant.");
  }
  return next;
}

export function createLedgerSnapshot(input: {
  balance: number;
  amount: number;
  type: string;
  reason: string;
  allowNegative?: boolean;
}) {
  const reason = input.reason.trim();
  if (reason.length < 3) throw new Error("Un motif précis est obligatoire.");
  const newBalance = applyLedgerMovement(input.balance, Math.trunc(input.amount), input.allowNegative);
  return {
    amount: Math.trunc(input.amount),
    type: input.type,
    reason,
    previousBalance: input.balance,
    newBalance,
  };
}

export function normalizePagination(page?: number, pageSize?: number) {
  const normalizedPage = Math.max(1, Math.trunc(page || 1));
  const normalizedPageSize = Math.min(100, Math.max(10, Math.trunc(pageSize || 25)));
  return { page: normalizedPage, pageSize: normalizedPageSize, skip: (normalizedPage - 1) * normalizedPageSize };
}

export function calculateOutstandingExpiringLots(
  transactions: Array<{
    id: string;
    amount: number;
    createdAt: Date;
    expiresAt: Date | null;
    reversedTransactionId?: string | null;
  }>,
  dueBefore: Date,
  now = new Date(),
) {
  const ordered = [...transactions].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  const lots: Array<{ id: string; remaining: number; expiresAt: Date | null; createdAt: Date }> = [];
  const byId = new Map<string, (typeof lots)[number]>();

  for (const transaction of ordered) {
    if (transaction.amount > 0) {
      const lot = {
        id: transaction.id,
        remaining: transaction.amount,
        expiresAt: transaction.expiresAt,
        createdAt: transaction.createdAt,
      };
      lots.push(lot);
      byId.set(lot.id, lot);
      continue;
    }

    let debit = Math.abs(transaction.amount);
    if (transaction.reversedTransactionId) {
      const target = byId.get(transaction.reversedTransactionId);
      if (target) {
        const consumed = Math.min(target.remaining, debit);
        target.remaining -= consumed;
        debit -= consumed;
      }
    }
    for (const lot of lots) {
      if (debit <= 0) break;
      const consumed = Math.min(lot.remaining, debit);
      lot.remaining -= consumed;
      debit -= consumed;
    }
  }

  return lots.filter(
    (lot) => lot.remaining > 0 && lot.expiresAt && lot.expiresAt >= now && lot.expiresAt <= dueBefore,
  );
}

export const TIER_BENEFITS: Record<LoyaltyTier, string[]> = {
  bronze: ["Accès aux récompenses", "Historique de points détaillé"],
  silver: ["Tout Bronze", "Gain de points accéléré", "Offres Argent"],
  gold: ["Tout Argent", "Gain de points maximal", "Avantages Gold prioritaires"],
};
