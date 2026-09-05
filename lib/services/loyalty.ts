import {
  CustomerActivitySegment,
  LoyaltyTier,
  LoyaltyTransactionType,
  Prisma,
} from "@prisma/client";

import {
  DEFAULT_SEGMENT_RULES,
  DEFAULT_TIER_RULES,
  calculateEarnedPoints,
  calculateRefundPointReversal,
  classifyCustomerSegment,
  getTierFromRevenue,
  isValidCommercialOrder,
  createLedgerSnapshot,
  calculateOutstandingExpiringLots,
} from "@/lib/loyalty";
import { prisma } from "@/lib/prisma";

export const VALID_COMMERCIAL_ORDER_WHERE = {
  status: "delivered",
  paymentStatus: "paid",
} as const satisfies Prisma.OrderWhereInput;

export type LoyaltyActor = {
  userId?: string | null;
  email?: string | null;
  label?: string | null;
};

type TransactionClient = Prisma.TransactionClient;

const actorLabel = (actor?: LoyaltyActor) =>
  actor?.email || actor?.label || actor?.userId || "system";

const asJson = (value: Record<string, unknown> | undefined) =>
  value as Prisma.InputJsonValue | undefined;

export async function getLoyaltyConfiguration(db: typeof prisma | TransactionClient = prisma) {
  const [settings, storedRules] = await Promise.all([
    db.loyaltyProgramSettings.findUnique({ where: { id: "default" } }),
    db.loyaltyTierRule.findMany({ where: { isActive: true }, orderBy: { revenueThreshold: "asc" } }),
  ]);

  return {
    settings: settings
      ? {
          ...settings,
          loyalMinimumRevenue: Number(settings.loyalMinimumRevenue),
          reengagementCycleMultiplier: Number(settings.reengagementCycleMultiplier),
        }
      : {
          id: "default",
          statusValidityMonths: 12,
          pointExpirationMonths: 18,
          expirationAlertDays: [60, 30, 7],
          separateStatusAndPoints: true,
          ...DEFAULT_SEGMENT_RULES,
          createdAt: new Date(0),
          updatedAt: new Date(0),
        },
    tierRules: storedRules.length
      ? storedRules.map((rule) => ({
          ...rule,
          revenueThreshold: Number(rule.revenueThreshold),
        }))
      : DEFAULT_TIER_RULES.map((rule) => ({
          id: `default-${rule.tier}`,
          ...rule,
          isActive: true,
          createdAt: new Date(0),
          updatedAt: new Date(0),
        })),
  };
}

export async function writeAuditLog(
  db: TransactionClient | typeof prisma,
  input: {
    actor?: LoyaltyActor;
    action: string;
    entity: string;
    entityId?: string | null;
    metadata?: Record<string, unknown>;
  },
) {
  return db.adminAuditLog.create({
    data: {
      actorUserId: input.actor?.userId || null,
      actorEmail: input.actor?.email || null,
      action: input.action,
      entity: input.entity,
      entityId: input.entityId || null,
      metadata: asJson(input.metadata),
    },
  });
}

async function createLedgerMovement(
  tx: TransactionClient,
  input: {
    userId: string;
    amount: number;
    type: LoyaltyTransactionType;
    reason: string;
    actor?: LoyaltyActor;
    orderId?: string | null;
    rewardRedemptionId?: string | null;
    reversedTransactionId?: string | null;
    expiresAt?: Date | null;
    idempotencyKey?: string | null;
    metadata?: Record<string, unknown>;
    allowNegativeBalance?: boolean;
  },
) {
  if (input.idempotencyKey) {
    const existing = await tx.loyaltyTransaction.findUnique({
      where: { idempotencyKey: input.idempotencyKey },
    });
    if (existing) return existing;
  }

  const user = await tx.user.findUnique({
    where: { id: input.userId },
    select: { loyaltyPoints: true },
  });
  if (!user) throw new Error("Client introuvable.");

  const amount = Math.trunc(input.amount);
  const snapshot = createLedgerSnapshot({
    balance: user.loyaltyPoints,
    amount,
    type: input.type,
    reason: input.reason,
    allowNegative: input.allowNegativeBalance ?? false,
  });
  const newBalance = snapshot.newBalance;

  const movement = await tx.loyaltyTransaction.create({
    data: {
      userId: input.userId,
      amount,
      type: input.type,
      reason: input.reason,
      previousBalance: user.loyaltyPoints,
      newBalance,
      createdBy: actorLabel(input.actor),
      orderId: input.orderId || null,
      rewardRedemptionId: input.rewardRedemptionId || null,
      reversedTransactionId: input.reversedTransactionId || null,
      expiresAt: input.expiresAt || null,
      idempotencyKey: input.idempotencyKey || null,
      metadata: asJson(input.metadata),
    },
  });

  await tx.user.update({
    where: { id: input.userId },
    data: { loyaltyPoints: newBalance },
  });

  return movement;
}

async function calculateAndStoreCustomerStatus(tx: TransactionClient, userId: string) {
  const { settings, tierRules } = await getLoyaltyConfiguration(tx);
  const qualificationMonths = Math.max(...tierRules.map((rule) => rule.qualificationMonths), 12);
  const qualificationStart = new Date();
  qualificationStart.setMonth(qualificationStart.getMonth() - qualificationMonths);

  const user = await tx.user.findUnique({
    where: { id: userId },
    select: {
      createdAt: true,
      loyaltyTier: true,
      loyaltyTierQualifiedAt: true,
      loyaltyTierValidUntil: true,
      orders: {
        where: VALID_COMMERCIAL_ORDER_WHERE,
        select: { orderDate: true, totalPrice: true },
        orderBy: { orderDate: "asc" },
      },
    },
  });
  if (!user) throw new Error("Client introuvable.");

  const qualifyingOrders = user.orders.filter((order) => order.orderDate >= qualificationStart);
  const qualifyingRevenue = qualifyingOrders.reduce((sum, order) => sum + Number(order.totalPrice), 0);
  const computedTier = getTierFromRevenue(qualifyingRevenue, tierRules);
  const rank: Record<LoyaltyTier, number> = { bronze: 0, silver: 1, gold: 2 };
  const now = new Date();
  const keepsGuaranteedStatus =
    rank[computedTier] < rank[user.loyaltyTier] &&
    Boolean(user.loyaltyTierValidUntil && user.loyaltyTierValidUntil > now);
  const tier = keepsGuaranteedStatus ? user.loyaltyTier : computedTier;
  const renewsStatus =
    tier !== user.loyaltyTier ||
    !user.loyaltyTierValidUntil ||
    user.loyaltyTierValidUntil <= now;
  const validUntil = new Date(now);
  validUntil.setMonth(validUntil.getMonth() + settings.statusValidityMonths);
  const classification = classifyCustomerSegment({
    createdAt: user.createdAt,
    validOrderDates: user.orders.map((order) => order.orderDate),
    qualifyingRevenue,
    rules: {
      newCustomerDays: settings.newCustomerDays,
      activeCustomerDays: settings.activeCustomerDays,
      inactiveCustomerDays: settings.inactiveCustomerDays,
      loyalMinimumOrders: settings.loyalMinimumOrders,
      loyalMinimumRevenue: settings.loyalMinimumRevenue,
      reengagementCycleMultiplier: settings.reengagementCycleMultiplier,
      minimumOrdersForCycle: settings.minimumOrdersForCycle,
    },
  });

  await tx.user.update({
    where: { id: userId },
    data: {
      loyaltyTier: tier,
      activitySegment: classification.segment as CustomerActivitySegment,
      ...(renewsStatus
        ? { loyaltyTierQualifiedAt: now, loyaltyTierValidUntil: validUntil }
        : {}),
    },
  });

  return { tier, qualifyingRevenue, ...classification };
}

export async function reconcileOrderLoyalty(orderId: string, actor?: LoyaltyActor) {
  return prisma.$transaction(async (tx) => {
    const order = await tx.order.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        orderNumber: true,
        userId: true,
        status: true,
        paymentStatus: true,
        totalPrice: true,
        orderDate: true,
        user: { select: { loyaltySuspendedAt: true } },
      },
    });
    if (!order || !order.userId) return null;

    const existingEarn = await tx.loyaltyTransaction.findFirst({
      where: { orderId, type: "earned" },
      orderBy: { createdAt: "asc" },
    });
    const isValid = isValidCommercialOrder(order);

    if (isValid && !existingEarn && !order.user?.loyaltySuspendedAt) {
      const { settings, tierRules } = await getLoyaltyConfiguration(tx);
      const qualifyingStart = new Date(order.orderDate);
      qualifyingStart.setMonth(
        qualifyingStart.getMonth() - Math.max(...tierRules.map((rule) => rule.qualificationMonths), 12),
      );
      const revenue = await tx.order.aggregate({
        where: {
          userId: order.userId,
          ...VALID_COMMERCIAL_ORDER_WHERE,
          orderDate: { gte: qualifyingStart, lte: order.orderDate },
        },
        _sum: { totalPrice: true },
      });
      const tier = getTierFromRevenue(Number(revenue._sum.totalPrice || 0), tierRules);
      const rule = tierRules.find((candidate) => candidate.tier === tier) ?? tierRules[0];
      const points = calculateEarnedPoints(Number(order.totalPrice), rule.pointsPer100Mad);
      if (points > 0) {
        const expiresAt = new Date(order.orderDate);
        expiresAt.setMonth(expiresAt.getMonth() + settings.pointExpirationMonths);
        await tx.loyaltyTransaction.updateMany({
          where: { userId: order.userId, amount: { gt: 0 }, expiresAt: { not: null } },
          data: { expiresAt },
        });
        await createLedgerMovement(tx, {
          userId: order.userId,
          orderId,
          amount: points,
          type: "earned",
          reason: `Points gagnés sur la commande ${order.orderNumber}`,
          expiresAt,
          actor,
          idempotencyKey: `order-earned:${orderId}`,
          metadata: { tier, pointsPer100Mad: rule.pointsPer100Mad },
        });
      }
    } else if (!isValid && existingEarn) {
      const existingReversal = await tx.loyaltyTransaction.findFirst({
        where: { reversedTransactionId: existingEarn.id },
      });
      if (!existingReversal) {
        const type: LoyaltyTransactionType =
          order.paymentStatus === "refunded" ? "refund_reversal" : "cancellation_reversal";
        await createLedgerMovement(tx, {
          userId: order.userId,
          orderId,
          amount: -existingEarn.amount,
          type,
          reason:
            type === "refund_reversal"
              ? `Annulation des points après remboursement de ${order.orderNumber}`
              : `Annulation des points après annulation de ${order.orderNumber}`,
          actor,
          reversedTransactionId: existingEarn.id,
          idempotencyKey: `order-reversal:${orderId}:${type}`,
          allowNegativeBalance: true,
        });
      }
    }

    const customerStatus = await calculateAndStoreCustomerStatus(tx, order.userId);
    await writeAuditLog(tx, {
      actor,
      action: "loyalty.order_reconciled",
      entity: "Order",
      entityId: orderId,
      metadata: { isValidCommercialOrder: isValid, tier: customerStatus.tier },
    });
    return customerStatus;
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

export async function adjustCustomerPoints(input: {
  userId: string;
  amount: number;
  reason: string;
  actor: LoyaltyActor;
}) {
  const reason = input.reason.trim();
  if (reason.length < 3) throw new Error("Un motif précis est obligatoire.");
  const amount = Math.trunc(input.amount);
  if (!amount || Math.abs(amount) > 1_000_000) throw new Error("Montant de points invalide.");

  return prisma.$transaction(async (tx) => {
    const movement = await createLedgerMovement(tx, {
      userId: input.userId,
      amount,
      type: "manual_adjustment",
      reason,
      actor: input.actor,
    });
    await writeAuditLog(tx, {
      actor: input.actor,
      action: "loyalty.points_adjusted",
      entity: "User",
      entityId: input.userId,
      metadata: {
        amount,
        reason,
        previousBalance: movement.previousBalance,
        newBalance: movement.newBalance,
        transactionId: movement.id,
      },
    });
    return movement;
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

export async function redeemReward(input: {
  userId: string;
  rewardId: string;
  idempotencyKey: string;
  actor: LoyaltyActor;
}) {
  if (!input.idempotencyKey.trim()) throw new Error("Clé de demande manquante.");
  return prisma.$transaction(async (tx) => {
    const existing = await tx.loyaltyRewardRedemption.findUnique({
      where: { idempotencyKey: input.idempotencyKey },
      include: { transactions: true },
    });
    if (existing) return existing;

    const [user, reward] = await Promise.all([
      tx.user.findUnique({ where: { id: input.userId }, select: { loyaltyPoints: true, loyaltySuspendedAt: true } }),
      tx.loyaltyReward.findUnique({ where: { id: input.rewardId } }),
    ]);
    if (!user) throw new Error("Client introuvable.");
    if (user.loyaltySuspendedAt) throw new Error("Le programme de fidélité de ce client est suspendu.");
    if (!reward || !reward.isActive || reward.archivedAt) throw new Error("Cette récompense n’est plus disponible.");
    if (user.loyaltyPoints < reward.pointsCost) throw new Error("Le solde de points est insuffisant.");

    const redemption = await tx.loyaltyRewardRedemption.create({
      data: {
        userId: input.userId,
        rewardId: input.rewardId,
        pointsCostSnapshot: reward.pointsCost,
        rewardSnapshot: {
          name: reward.name,
          type: reward.type,
          monetaryValue: reward.monetaryValue ? Number(reward.monetaryValue) : null,
          percentageValue: reward.percentageValue,
        },
        idempotencyKey: input.idempotencyKey,
        issuedBy: actorLabel(input.actor),
      },
    });
    await createLedgerMovement(tx, {
      userId: input.userId,
      rewardRedemptionId: redemption.id,
      amount: -reward.pointsCost,
      type: "redeemed",
      reason: `Récompense émise : ${reward.name}`,
      actor: input.actor,
      idempotencyKey: `reward-redemption:${redemption.id}`,
    });
    await writeAuditLog(tx, {
      actor: input.actor,
      action: "loyalty.reward_redeemed",
      entity: "LoyaltyRewardRedemption",
      entityId: redemption.id,
      metadata: { rewardId: reward.id, userId: input.userId, pointsCost: reward.pointsCost },
    });
    return tx.loyaltyRewardRedemption.findUniqueOrThrow({
      where: { id: redemption.id },
      include: { transactions: true },
    });
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

export async function recordRefundPointReversal(input: {
  orderId: string;
  externalEventId: string;
  refundAmount: number;
  actor?: LoyaltyActor;
  metadata?: Record<string, unknown>;
}) {
  if (!input.externalEventId.trim()) throw new Error("Identifiant de remboursement manquant.");
  if (!Number.isFinite(input.refundAmount) || input.refundAmount <= 0) {
    throw new Error("Montant de remboursement invalide.");
  }

  return prisma.$transaction(async (tx) => {
    const duplicate = await tx.loyaltyRefundEvent.findUnique({
      where: { orderId_externalEventId: { orderId: input.orderId, externalEventId: input.externalEventId } },
      include: { loyaltyTransaction: true },
    });
    if (duplicate) return duplicate;

    const order = await tx.order.findUnique({
      where: { id: input.orderId },
      include: {
        loyaltyTransactions: { where: { type: "earned" }, orderBy: { createdAt: "asc" }, take: 1 },
        loyaltyRefundEvents: { include: { loyaltyTransaction: true } },
      },
    });
    if (!order || !order.userId) throw new Error("Commande client introuvable.");
    const earned = order.loyaltyTransactions[0];
    const alreadyReversedPoints = order.loyaltyRefundEvents.reduce(
      (sum, event) => sum + Math.abs(event.loyaltyTransaction?.amount || 0),
      0,
    );
    const pointsToReverse = earned
      ? calculateRefundPointReversal({
          originalPoints: earned.amount,
          orderAmount: Number(order.totalPrice),
          refundAmount: input.refundAmount,
          alreadyReversedPoints,
        })
      : 0;

    const refundEvent = await tx.loyaltyRefundEvent.create({
      data: {
        orderId: input.orderId,
        externalEventId: input.externalEventId,
        refundedAmount: input.refundAmount,
        metadata: asJson(input.metadata),
      },
    });

    if (pointsToReverse > 0 && earned) {
      const movement = await createLedgerMovement(tx, {
        userId: order.userId,
        orderId: order.id,
        amount: -pointsToReverse,
        type: "refund_reversal",
        reason: `Remboursement ${input.externalEventId} sur ${order.orderNumber}`,
        actor: input.actor,
        reversedTransactionId: earned.id,
        idempotencyKey: `refund:${order.id}:${input.externalEventId}`,
        allowNegativeBalance: true,
        metadata: { refundAmount: input.refundAmount },
      });
      await tx.loyaltyRefundEvent.update({
        where: { id: refundEvent.id },
        data: { loyaltyTransactionId: movement.id },
      });
    }

    await calculateAndStoreCustomerStatus(tx, order.userId);
    await writeAuditLog(tx, {
      actor: input.actor,
      action: "loyalty.refund_reversed",
      entity: "Order",
      entityId: order.id,
      metadata: { externalEventId: input.externalEventId, refundAmount: input.refundAmount, pointsToReverse },
    });
    return tx.loyaltyRefundEvent.findUniqueOrThrow({
      where: { id: refundEvent.id },
      include: { loyaltyTransaction: true },
    });
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

export async function reconcileCustomerBalance(userId: string, actor?: LoyaltyActor) {
  return prisma.$transaction(async (tx) => {
    const aggregate = await tx.loyaltyTransaction.aggregate({
      where: { userId },
      _sum: { amount: true },
    });
    const balance = aggregate._sum.amount || 0;
    const user = await tx.user.update({ where: { id: userId }, data: { loyaltyPoints: balance } });
    await writeAuditLog(tx, {
      actor,
      action: "loyalty.balance_reconciled",
      entity: "User",
      entityId: userId,
      metadata: { balance },
    });
    return user;
  });
}

export async function refreshAllCustomerClassifications(actor?: LoyaltyActor) {
  const users = await prisma.user.findMany({ select: { id: true } });
  const batchSize = 25;
  for (let index = 0; index < users.length; index += batchSize) {
    const batch = users.slice(index, index + batchSize);
    await Promise.all(
      batch.map((user) => prisma.$transaction((tx) => calculateAndStoreCustomerStatus(tx, user.id))),
    );
  }
  await writeAuditLog(prisma, {
    actor,
    action: "customers.classifications_refreshed",
    entity: "User",
    metadata: { customerCount: users.length },
  });
  return users.length;
}

export async function expireDueLoyaltyPoints(actor?: LoyaltyActor, now = new Date()) {
  const users = await prisma.user.findMany({
    where: { loyaltyTransactions: { some: { amount: { gt: 0 }, expiresAt: { lte: now } } } },
    select: { id: true },
  });
  let expiredPoints = 0;

  for (const user of users) {
    await prisma.$transaction(async (tx) => {
      const transactions = await tx.loyaltyTransaction.findMany({
        where: { userId: user.id },
        select: { id: true, amount: true, createdAt: true, expiresAt: true, reversedTransactionId: true },
        orderBy: { createdAt: "asc" },
      });
      const dueLots = calculateOutstandingExpiringLots(transactions, now, new Date(0));
      for (const lot of dueLots) {
        await createLedgerMovement(tx, {
          userId: user.id,
          amount: -lot.remaining,
          type: "expired",
          reason: `Expiration après inactivité du lot ${lot.id}`,
          actor,
          reversedTransactionId: lot.id,
          idempotencyKey: `expiration:${lot.id}`,
        });
        expiredPoints += lot.remaining;
      }
    });
  }

  await writeAuditLog(prisma, {
    actor,
    action: "loyalty.expiration_processed",
    entity: "LoyaltyTransaction",
    metadata: { customerCount: users.length, expiredPoints, processedAt: now.toISOString() },
  });
  return { customerCount: users.length, expiredPoints };
}
