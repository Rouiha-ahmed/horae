import {
  CustomerActivitySegment,
  LoyaltyTier,
  Prisma,
  QualityIssueSeverity,
  QualityIssueType,
} from "@prisma/client";

import {
  averagePurchaseIntervalDays,
  calculateOutstandingExpiringLots,
  normalizePagination,
} from "@/lib/loyalty";
import { prisma } from "@/lib/prisma";
import {
  VALID_COMMERCIAL_ORDER_WHERE,
  getLoyaltyConfiguration,
  type LoyaltyActor,
  writeAuditLog,
} from "@/lib/services/loyalty";

const daysAgo = (days: number) => new Date(Date.now() - days * 86_400_000);
const monthsAgo = (months: number) => {
  const date = new Date();
  date.setMonth(date.getMonth() - months);
  return date;
};

export const SEGMENT_LABELS: Record<CustomerActivitySegment, string> = {
  NEW: "Nouveau",
  ACTIVE: "Actif",
  LOYAL: "Fidèle",
  TO_REENGAGE: "À relancer",
  NO_PURCHASE: "Sans achat",
  INACTIVE: "Inactif",
};

export type CustomerListFilters = {
  search?: string;
  tier?: LoyaltyTier | "all";
  segment?: CustomerActivitySegment | "all";
  alert?: "all" | "expiring" | "inactive";
  tagId?: string;
  minPoints?: number;
  maxPoints?: number;
  sort?: "name" | "points" | "created" | "tier";
  direction?: "asc" | "desc";
  page?: number;
  pageSize?: number;
};

export function buildCustomerWhere(filters: CustomerListFilters): Prisma.UserWhereInput {
  const search = filters.search?.trim();
  const alertDays = 60;
  const where: Prisma.UserWhereInput = {
    ...(search
      ? {
          OR: [
            { fullName: { contains: search, mode: "insensitive" } },
            { email: { contains: search, mode: "insensitive" } },
            { loyaltyCardNumber: { contains: search, mode: "insensitive" } },
            { addresses: { some: { phone: { contains: search, mode: "insensitive" } } } },
          ],
        }
      : {}),
    ...(filters.tier && filters.tier !== "all" ? { loyaltyTier: filters.tier } : {}),
    ...(filters.segment && filters.segment !== "all"
      ? { activitySegment: filters.segment }
      : {}),
    ...(filters.tagId ? { customerTags: { some: { tagId: filters.tagId } } } : {}),
    ...(typeof filters.minPoints === "number" || typeof filters.maxPoints === "number"
      ? {
          loyaltyPoints: {
            ...(typeof filters.minPoints === "number" ? { gte: filters.minPoints } : {}),
            ...(typeof filters.maxPoints === "number" ? { lte: filters.maxPoints } : {}),
          },
        }
      : {}),
    ...(filters.alert === "expiring"
      ? {
          loyaltyTransactions: {
            some: {
              amount: { gt: 0 },
              expiresAt: { gte: new Date(), lte: daysAgo(-alertDays) },
            },
          },
        }
      : {}),
    ...(filters.alert === "inactive"
      ? { activitySegment: { in: ["TO_REENGAGE", "INACTIVE"] } }
      : {}),
  };
  return where;
}

export async function getCustomerList(filters: CustomerListFilters) {
  const { page, pageSize, skip } = normalizePagination(filters.page, filters.pageSize);
  const sort = filters.sort || "created";
  const direction = filters.direction || (sort === "name" ? "asc" : "desc");
  const where = buildCustomerWhere(filters);
  const orderBy: Prisma.UserOrderByWithRelationInput =
    sort === "name"
      ? { fullName: direction }
      : sort === "points"
        ? { loyaltyPoints: direction }
        : sort === "tier"
          ? { loyaltyTier: direction }
          : { createdAt: direction };

  const [{ settings }, total, users, tags, tierCounts, segmentCounts] = await Promise.all([
    getLoyaltyConfiguration(),
    prisma.user.count({ where }),
    prisma.user.findMany({
      where,
      orderBy,
      skip,
      take: pageSize,
      select: {
        id: true,
        fullName: true,
        email: true,
        loyaltyCardNumber: true,
        loyaltyPoints: true,
        loyaltyTier: true,
        loyaltyTierQualifiedAt: true,
        loyaltyTierValidUntil: true,
        activitySegment: true,
        loyaltySuspendedAt: true,
        createdAt: true,
        addresses: {
          orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }],
          take: 1,
          select: { phone: true, city: true },
        },
        customerTags: { include: { tag: true } },
        loyaltyTransactions: {
          orderBy: { createdAt: "asc" },
          select: { id: true, amount: true, expiresAt: true, createdAt: true, reversedTransactionId: true },
        },
        orders: {
          where: VALID_COMMERCIAL_ORDER_WHERE,
          select: { id: true, orderNumber: true, totalPrice: true, orderDate: true },
          orderBy: { orderDate: "desc" },
        },
      },
    }),
    prisma.customerTag.findMany({ orderBy: { name: "asc" } }),
    prisma.user.groupBy({ by: ["loyaltyTier"], _count: { id: true } }),
    prisma.user.groupBy({ by: ["activitySegment"], _count: { id: true } }),
  ]);

  const qualificationStart = monthsAgo(12);
  const alertEnd = daysAgo(-Math.max(...settings.expirationAlertDays, 60));
  const customers = users.map((user) => {
    const orders12m = user.orders.filter((order) => order.orderDate >= qualificationStart);
    const lastOrder = user.orders[0] || null;
    const expiringLots = calculateOutstandingExpiringLots(user.loyaltyTransactions, alertEnd);
    return {
      ...user,
      phone: user.addresses[0]?.phone || null,
      city: user.addresses[0]?.city || null,
      validOrderCount: user.orders.length,
      paidDeliveredRevenue: orders12m.reduce((sum, order) => sum + Number(order.totalPrice), 0),
      lifetimeRevenue: user.orders.reduce((sum, order) => sum + Number(order.totalPrice), 0),
      lastValidOrderAt: lastOrder?.orderDate || null,
      lastOrderNumber: lastOrder?.orderNumber || null,
      expiringPoints: expiringLots.reduce((sum, lot) => sum + lot.remaining, 0),
      pointsExpireAt: expiringLots[0]?.expiresAt || null,
      tags: user.customerTags.map((assignment) => assignment.tag),
    };
  });

  return {
    customers,
    tags,
    pagination: { page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) },
    counts: {
      total: await prisma.user.count(),
      tiers: Object.fromEntries(tierCounts.map((item) => [item.loyaltyTier, item._count.id])) as Record<LoyaltyTier, number>,
      segments: Object.fromEntries(segmentCounts.map((item) => [item.activitySegment, item._count.id])) as Record<CustomerActivitySegment, number>,
    },
  };
}

export async function getCustomerOverview() {
  const now = new Date();
  const start30 = daysAgo(30);
  const start12m = monthsAgo(12);
  const previous12mStart = monthsAgo(24);
  const { settings, tierRules } = await getLoyaltyConfiguration();
  const expirationEnd = daysAgo(-Math.max(...settings.expirationAlertDays, 60));

  const [
    totalCustomers,
    activeCustomers,
    tierCounts,
    pointsAggregate,
    expiringTransactions,
    validOrders12m,
    validOrdersPrevious12m,
    loyalRevenue,
    rewards,
    segmentCounts,
    topGroups,
    qualityIssueCount,
    reengagementCustomers,
    recentAudit,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({
      where: { orders: { some: { ...VALID_COMMERCIAL_ORDER_WHERE, orderDate: { gte: start30 } } } },
    }),
    prisma.user.groupBy({ by: ["loyaltyTier"], _count: { id: true } }),
    prisma.user.aggregate({ _sum: { loyaltyPoints: true } }),
    prisma.loyaltyTransaction.findMany({
      select: { id: true, userId: true, amount: true, createdAt: true, expiresAt: true, reversedTransactionId: true },
      orderBy: { createdAt: "asc" },
    }),
    prisma.order.aggregate({
      where: { ...VALID_COMMERCIAL_ORDER_WHERE, orderDate: { gte: start12m } },
      _sum: { totalPrice: true },
      _count: { id: true },
      _avg: { totalPrice: true },
    }),
    prisma.order.aggregate({
      where: {
        ...VALID_COMMERCIAL_ORDER_WHERE,
        orderDate: { gte: previous12mStart, lt: start12m },
      },
      _sum: { totalPrice: true },
      _count: { id: true },
    }),
    prisma.order.aggregate({
      where: {
        ...VALID_COMMERCIAL_ORDER_WHERE,
        orderDate: { gte: start12m },
        user: { loyaltyTier: { in: ["silver", "gold"] } },
      },
      _sum: { totalPrice: true },
    }),
    prisma.loyaltyReward.findMany({
      where: { archivedAt: null },
      orderBy: [{ isActive: "desc" }, { pointsCost: "asc" }],
      take: 8,
    }),
    prisma.user.groupBy({ by: ["activitySegment"], _count: { id: true } }),
    prisma.order.groupBy({
      by: ["userId"],
      where: { ...VALID_COMMERCIAL_ORDER_WHERE, userId: { not: null } },
      _sum: { totalPrice: true },
      _count: { id: true },
      _max: { orderDate: true },
      orderBy: { _sum: { totalPrice: "desc" } },
      take: 5,
    }),
    prisma.customerQualityIssue.count({ where: { status: "open" } }),
    prisma.user.findMany({
      where: { activitySegment: "TO_REENGAGE" },
      take: 5,
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        fullName: true,
        email: true,
        orders: {
          where: VALID_COMMERCIAL_ORDER_WHERE,
          select: { orderDate: true },
          orderBy: { orderDate: "asc" },
        },
      },
    }),
    prisma.adminAuditLog.findMany({ orderBy: { createdAt: "desc" }, take: 5 }),
  ]);

  const userIds = topGroups.flatMap((group) => (group.userId ? [group.userId] : []));
  const topUsers = await prisma.user.findMany({
    where: { id: { in: userIds } },
    select: { id: true, fullName: true, email: true, loyaltyTier: true, loyaltyPoints: true },
  });
  const topUserById = new Map(topUsers.map((user) => [user.id, user]));

  const repeatProducts = await getRepeatPurchaseProducts();
  const transactionsByUser = new Map<string, typeof expiringTransactions>();
  for (const transaction of expiringTransactions) {
    transactionsByUser.set(transaction.userId, [
      ...(transactionsByUser.get(transaction.userId) || []),
      transaction,
    ]);
  }
  const expiringPoints = [...transactionsByUser.values()].reduce(
    (total, transactions) => total + calculateOutstandingExpiringLots(transactions, expirationEnd, now)
      .reduce((sum, lot) => sum + lot.remaining, 0),
    0,
  );
  const currentRevenue = Number(validOrders12m._sum.totalPrice || 0);
  const previousRevenue = Number(validOrdersPrevious12m._sum.totalPrice || 0);
  const revenueChangePct = previousRevenue
    ? ((currentRevenue - previousRevenue) / previousRevenue) * 100
    : currentRevenue > 0
      ? 100
      : 0;

  return {
    settings,
    tierRules,
    rewards,
    recentAudit,
    repeatProducts,
    qualityIssueCount,
    metrics: {
      totalCustomers,
      activeCustomers,
      bronzeCustomers: tierCounts.find((item) => item.loyaltyTier === "bronze")?._count.id || 0,
      silverCustomers: tierCounts.find((item) => item.loyaltyTier === "silver")?._count.id || 0,
      goldCustomers: tierCounts.find((item) => item.loyaltyTier === "gold")?._count.id || 0,
      availablePoints: pointsAggregate._sum.loyaltyPoints || 0,
      expiringPoints,
      loyalRevenue: Number(loyalRevenue._sum.totalPrice || 0),
      qualifyingRevenue: currentRevenue,
      validOrderCount: validOrders12m._count.id,
      averageOrderValue: Number(validOrders12m._avg.totalPrice || 0),
      revenueChangePct,
    },
    segments: Object.fromEntries(
      segmentCounts.map((item) => [item.activitySegment, item._count.id]),
    ) as Record<CustomerActivitySegment, number>,
    topCustomers: topGroups.flatMap((group) => {
      if (!group.userId) return [];
      const user = topUserById.get(group.userId);
      if (!user) return [];
      return [{
        ...user,
        revenue: Number(group._sum.totalPrice || 0),
        orderCount: group._count.id,
        lastOrderAt: group._max.orderDate,
      }];
    }),
    reengagementCustomers: reengagementCustomers.map((user) => {
      const dates = user.orders.map((order) => order.orderDate);
      const lastPurchaseAt = dates.at(-1) || null;
      const averageIntervalDays = averagePurchaseIntervalDays(dates);
      return {
        id: user.id,
        fullName: user.fullName,
        email: user.email,
        lastPurchaseAt,
        averageIntervalDays,
        daysSinceLastPurchase: lastPurchaseAt
          ? Math.floor((now.getTime() - lastPurchaseAt.getTime()) / 86_400_000)
          : null,
        expectedNextPurchaseAt:
          lastPurchaseAt && averageIntervalDays
            ? new Date(lastPurchaseAt.getTime() + averageIntervalDays * 86_400_000)
            : null,
      };
    }),
  };
}

type RepeatProductRow = {
  productId: string;
  productName: string;
  purchaseCount: bigint;
  repeatCustomers: bigint;
  averageIntervalDays: Prisma.Decimal | number | null;
  lastPurchaseAt: Date;
};

export async function getRepeatPurchaseProducts() {
  const rows = await prisma.$queryRaw<RepeatProductRow[]>`
    WITH purchases AS (
      SELECT
        oi."productId" AS "productId",
        oi."productNameSnapshot" AS "productName",
        o."id" AS "orderId",
        o."userId" AS "userId",
        o."orderDate" AS "orderDate",
        LAG(o."orderDate") OVER (
          PARTITION BY oi."productId", o."userId"
          ORDER BY o."orderDate"
        ) AS "previousPurchaseAt"
      FROM "OrderItem" oi
      JOIN "Order" o ON o."id" = oi."orderId"
      WHERE
        o."status" = 'delivered'
        AND o."paymentStatus" = 'paid'
        AND oi."productId" IS NOT NULL
    )
    SELECT
      "productId",
      MAX("productName") AS "productName",
      COUNT(DISTINCT "orderId")::bigint AS "purchaseCount",
      COUNT(DISTINCT "userId") FILTER (WHERE "previousPurchaseAt" IS NOT NULL)::bigint AS "repeatCustomers",
      AVG(EXTRACT(EPOCH FROM ("orderDate" - "previousPurchaseAt")) / 86400)
        FILTER (WHERE "previousPurchaseAt" IS NOT NULL) AS "averageIntervalDays",
      MAX("orderDate") AS "lastPurchaseAt"
    FROM purchases
    GROUP BY "productId"
    HAVING COUNT(DISTINCT "orderId") > 1
    ORDER BY "repeatCustomers" DESC, "purchaseCount" DESC
    LIMIT 5
  `;
  return rows.map((row) => {
    const averageIntervalDays = row.averageIntervalDays === null
      ? null
      : Number(row.averageIntervalDays);
    return {
      ...row,
      purchaseCount: Number(row.purchaseCount),
      repeatCustomers: Number(row.repeatCustomers),
      averageIntervalDays,
      potentialNextPurchaseAt: averageIntervalDays
        ? new Date(row.lastPurchaseAt.getTime() + averageIntervalDays * 86_400_000)
        : null,
    };
  });
}

export async function getCustomerDetail(userId: string) {
  const [{ settings, tierRules }, user, rewards] = await Promise.all([
    getLoyaltyConfiguration(),
    prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        fullName: true,
        email: true,
        loyaltyCardNumber: true,
        loyaltyPoints: true,
        loyaltyTier: true,
        loyaltyTierQualifiedAt: true,
        loyaltyTierValidUntil: true,
        activitySegment: true,
        loyaltySuspendedAt: true,
        loyaltySuspensionReason: true,
        installmentsEligible: true,
        createdAt: true,
        updatedAt: true,
        addresses: { orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }] },
        customerTags: { include: { tag: true } },
        notes: { orderBy: { createdAt: "desc" }, take: 20 },
        loyaltyTransactions: { orderBy: { createdAt: "desc" } },
        rewardRedemptions: { include: { reward: true }, orderBy: { createdAt: "desc" }, take: 30 },
        orders: {
          include: { items: { take: 4 } },
          orderBy: { orderDate: "desc" },
          take: 100,
        },
        qualityIssues: { where: { status: "open" }, orderBy: { detectedAt: "desc" } },
        consents: { orderBy: { createdAt: "desc" } },
        privacyRequests: { orderBy: { createdAt: "desc" } },
      },
    }),
    prisma.loyaltyReward.findMany({ where: { isActive: true, archivedAt: null }, orderBy: { pointsCost: "asc" } }),
  ]);
  if (!user) return null;

  const validOrders = user.orders.filter(
    (order) => order.status === "delivered" && order.paymentStatus === "paid",
  );
  const orders12m = validOrders.filter((order) => order.orderDate >= monthsAgo(12));
  const lifetimeRevenue = validOrders.reduce((sum, order) => sum + Number(order.totalPrice), 0);
  const qualifyingRevenue = orders12m.reduce((sum, order) => sum + Number(order.totalPrice), 0);
  const expiringEnd = daysAgo(-Math.max(...settings.expirationAlertDays, 60));
  const expiringPoints = calculateOutstandingExpiringLots(
    user.loyaltyTransactions,
    expiringEnd,
  ).reduce((sum, lot) => sum + lot.remaining, 0);
  const currentRule = tierRules.find((rule) => rule.tier === user.loyaltyTier) || tierRules[0];
  const nextRule = tierRules.find((rule) => rule.revenueThreshold > qualifyingRevenue) || null;
  const nextReward = rewards.find((reward) => reward.pointsCost > user.loyaltyPoints) || null;

  return {
    user,
    settings,
    tierRules,
    rewards,
    validOrders,
    metrics: {
      validOrderCount: validOrders.length,
      lifetimeRevenue,
      qualifyingRevenue,
      averageOrderValue: validOrders.length ? lifetimeRevenue / validOrders.length : 0,
      lastOrderAt: validOrders[0]?.orderDate || null,
      expiringPoints,
    },
    currentRule,
    nextTier: nextRule?.tier || null,
    nextTierThreshold: nextRule?.revenueThreshold || null,
    nextReward,
  };
}

const emailLooksValid = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

export async function scanCustomerQualityIssues(actor: LoyaltyActor) {
  const [users, validOrders, cancelledOrders] = await Promise.all([
    prisma.user.findMany({
      select: {
        id: true,
        fullName: true,
        email: true,
        loyaltyPoints: true,
        addresses: { select: { phone: true }, take: 1 },
        orders: { where: VALID_COMMERCIAL_ORDER_WHERE, select: { id: true }, take: 1 },
      },
    }),
    prisma.order.findMany({
      where: VALID_COMMERCIAL_ORDER_WHERE,
      select: {
        id: true,
        orderNumber: true,
        userId: true,
        loyaltyTransactions: { where: { type: "earned" }, select: { id: true }, take: 1 },
      },
    }),
    prisma.order.findMany({
      where: { status: "cancelled", loyaltyTransactions: { some: { type: "earned" } } },
      select: {
        id: true,
        orderNumber: true,
        userId: true,
        loyaltyTransactions: { select: { id: true, type: true, reversedTransactionId: true } },
      },
    }),
  ]);

  const candidates: Array<{
    issueKey: string;
    userId?: string | null;
    orderId?: string | null;
    type: QualityIssueType;
    severity: QualityIssueSeverity;
    description: string;
    recommendedAction: string;
  }> = [];
  const usersByEmail = new Map<string, typeof users>();

  for (const user of users) {
    if (user.loyaltyPoints > 0 && user.orders.length === 0) {
      candidates.push({
        issueKey: `pointsWithoutRevenue:${user.id}`,
        userId: user.id,
        type: "pointsWithoutRevenue",
        severity: "warning",
        description: `${user.loyaltyPoints} points sans commande payée et livrée associée.`,
        recommendedAction: "Contrôler le grand livre et documenter l’origine des points.",
      });
    }
    if (!emailLooksValid(user.email)) {
      candidates.push({
        issueKey: `invalidEmail:${user.id}`,
        userId: user.id,
        type: "invalidEmail",
        severity: "warning",
        description: `Adresse e-mail invalide : ${user.email}`,
        recommendedAction: "Vérifier l’adresse avec le client avant toute campagne.",
      });
    }
    if (!user.addresses.some((address) => address.phone.trim())) {
      candidates.push({
        issueKey: `missingPhone:${user.id}`,
        userId: user.id,
        type: "missingPhone",
        severity: "info",
        description: "Aucun numéro de téléphone disponible.",
        recommendedAction: "Compléter le profil lors du prochain contact.",
      });
    }
    const normalizedEmail = user.email.trim().toLowerCase();
    usersByEmail.set(normalizedEmail, [...(usersByEmail.get(normalizedEmail) || []), user]);
  }

  for (const matches of usersByEmail.values()) {
    if (matches.length < 2) continue;
    for (const user of matches) {
      candidates.push({
        issueKey: `potentialDuplicate:${user.id}:${matches[0].email.toLowerCase()}`,
        userId: user.id,
        type: "potentialDuplicate",
        severity: "warning",
        description: `${matches.length} profils partagent la même adresse e-mail.`,
        recommendedAction: "Comparer les profils et lancer une revue de fusion manuelle.",
      });
    }
  }

  for (const order of validOrders) {
    if (!order.userId || order.loyaltyTransactions.length) continue;
    candidates.push({
      issueKey: `deliveredOrderWithoutPoints:${order.id}`,
      userId: order.userId,
      orderId: order.id,
      type: "deliveredOrderWithoutPoints",
      severity: "critical",
      description: `Commande ${order.orderNumber} payée et livrée sans mouvement de gain.`,
      recommendedAction: "Réconcilier la commande pour générer le mouvement manquant.",
    });
  }

  for (const order of cancelledOrders) {
    const earnedIds = order.loyaltyTransactions.filter((item) => item.type === "earned").map((item) => item.id);
    const reversed = order.loyaltyTransactions.some(
      (item) => item.reversedTransactionId && earnedIds.includes(item.reversedTransactionId),
    );
    if (!reversed) {
      candidates.push({
        issueKey: `pointsOnCancelledOrder:${order.id}`,
        userId: order.userId,
        orderId: order.id,
        type: "pointsOnCancelledOrder",
        severity: "critical",
        description: `La commande annulée ${order.orderNumber} conserve des points gagnés.`,
        recommendedAction: "Réconcilier la commande et créer le mouvement inverse.",
      });
    }
  }

  await prisma.$transaction(async (tx) => {
    for (const candidate of candidates) {
      await tx.customerQualityIssue.upsert({
        where: { issueKey: candidate.issueKey },
        create: candidate,
        update: {
          description: candidate.description,
          recommendedAction: candidate.recommendedAction,
          severity: candidate.severity,
          detectedAt: new Date(),
        },
      });
    }
    await writeAuditLog(tx, {
      actor,
      action: "customers.quality_scan",
      entity: "CustomerQualityIssue",
      metadata: { detected: candidates.length },
    });
  });
  return candidates.length;
}
