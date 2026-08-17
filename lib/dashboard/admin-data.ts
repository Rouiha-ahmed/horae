import { Prisma } from "@prisma/client";

import { requireAdmin } from "@/lib/admin";
import {
  buildDashboardDateWindow,
  buildRevenueOrderSeries,
  metricChangePercent,
  metricPointChange,
  type DashboardDateWindow,
  type DashboardPeriod,
  type RevenueOrderPoint,
} from "@/lib/dashboard/domain";
import {
  buildAdminOrderWhere,
  loadActiveOrderSlaPolicies,
  orderListSelect,
  parseAdminOrderFilters,
  toOrderDomainContext,
  type OrderListRecord,
} from "@/lib/orders/admin-data";
import {
  computeOrderOperationalState,
  nextActionLabels,
  resolveOrderSlaPolicy,
  type OrderDomainContext,
  type OrderSlaPolicy,
} from "@/lib/orders/domain";
import { prisma } from "@/lib/prisma";
import { computeStockRisk, type StockRiskLevel } from "@/lib/products/domain";

const DAY_MS = 86_400_000;
const STOCK_RISK_LEVELS = new Set<StockRiskLevel>([
  "OUT_OF_STOCK",
  "CRITICAL",
  "LOW",
]);
type Tone = "danger" | "warning" | "success" | "info" | "neutral";

export type DashboardOrderItem = {
  id: string;
  orderNumber: string;
  customerName: string;
  totalPrice: number;
  orderDate: string;
  city: string | null;
  situation: string;
  tone: Tone;
  href: string;
};

export type DashboardStockItem = {
  id: string;
  name: string;
  stock: number;
  unitsSold: number;
  avgDailySales: number;
  daysOfCover: number | null;
  riskLevel: StockRiskLevel;
  href: string;
};

export type DashboardAttentionPoint = {
  key: string;
  severity: "critical" | "warning" | "positive";
  title: string;
  message: string;
  actionLabel: string;
  href: string;
};

export type TodayDashboardData = {
  generatedAt: string;
  cards: Array<{
    key: "orders" | "payments" | "stock" | "deliveries";
    label: string;
    value: number;
    helper: string;
    actionLabel: string;
    href: string;
    tone: Tone;
  }>;
  attentionPoints: DashboardAttentionPoint[];
  recentActivity: DashboardOrderItem[];
  stockRisk: DashboardStockItem[];
};

export type PilotageKpi = {
  key: string;
  label: string;
  value: number;
  previousValue: number;
  change: number;
  changeKind: "percent" | "points";
  format: "currency" | "number" | "percent" | "duration";
  positiveWhenDown?: boolean;
  helper: string;
};

export type PilotageProductRow = {
  productId: string | null;
  name: string;
  revenue: number;
  units: number;
  revenueTrend: number;
  unitsTrend: number;
  href: string | null;
};

export type DeliveryPerformanceRow = {
  city: string;
  deliveredOrders: number;
  averageDays: number;
  objectiveDays: number | null;
  isWithinSla: boolean | null;
  href: string;
};

export type PaymentCollectionRow = {
  key: string;
  label: string;
  amount: number;
  orders: number;
  collected: boolean;
  href: string;
};

export type PilotageDashboardData = {
  generatedAt: string;
  period: DashboardPeriod;
  window: {
    start: string;
    end: string;
    previousStart: string;
    previousEnd: string;
    label: string;
    comparisonLabel: string;
  };
  kpis: PilotageKpi[];
  series: RevenueOrderPoint[];
  products: PilotageProductRow[] | null;
  stockAnalytics: DashboardStockItem[] | null;
  deliveryPerformance: DeliveryPerformanceRow[] | null;
  payments: PaymentCollectionRow[] | null;
  significantOrders: DashboardOrderItem[] | null;
  sectionErrors: string[];
};

const numberValue = (value: unknown) => {
  if (typeof value === "bigint") return Number(value);
  if (typeof value === "number") return value;
  if (value === null || value === undefined) return 0;
  return Number(value);
};

const riskRank: Record<StockRiskLevel, number> = {
  OUT_OF_STOCK: 0,
  CRITICAL: 1,
  LOW: 2,
  HEALTHY: 3,
  NO_RECENT_SALES: 4,
};

const orderTone = (order: OrderListRecord, priorityScore: number): Tone => {
  if (order.status === "cancelled" || order.deliveryStatus === "failed") return "danger";
  if (priorityScore >= 1_000 || order.deliveryStatus === "delayed") return "danger";
  if (priorityScore > 0 || order.returns.length) return "warning";
  if (order.deliveryStatus === "delivered") return "success";
  return "info";
};

const mapOrder = (
  order: OrderListRecord,
  policies: OrderSlaPolicy[],
  now = new Date(),
): DashboardOrderItem => {
  const operational = computeOrderOperationalState(toOrderDomainContext(order), policies, now);
  const situation =
    order.status === "cancelled"
      ? "Annulée"
      : order.returns.length
        ? "Retour à suivre"
        : operational.nextAction !== "NONE"
          ? nextActionLabels[operational.nextAction]?.button || "Action requise"
          : order.deliveryStatus === "delivered"
            ? "Livrée"
            : order.deliveryStatus === "delayed"
              ? "Livraison en retard"
              : "À surveiller";
  return {
    id: order.id,
    orderNumber: order.orderNumber,
    customerName: order.customerName,
    totalPrice: numberValue(order.totalPrice),
    orderDate: order.orderDate.toISOString(),
    city: order.shippingCity,
    situation,
    tone: orderTone(order, operational.priorityScore),
    href: `/admin/orders/${order.id}`,
  };
};

async function loadStockAnalytics({
  start,
  end,
  sourceDays,
}: {
  start: Date;
  end: Date;
  sourceDays: number;
}) {
  const products = await prisma.product.findMany({
    where: { lifecycleStatus: { not: "ARCHIVED" } },
    select: { id: true, name: true, stock: true },
  });
  const ids = products.map((product) => product.id);
  const sales = ids.length
    ? await prisma.orderItem.groupBy({
        by: ["productId"],
        where: {
          productId: { in: ids },
          order: {
            status: "delivered",
            paymentStatus: "paid",
            orderDate: { gte: start, lte: end },
          },
        },
        _sum: { quantity: true },
      })
    : [];
  const salesByProduct = new Map(
    sales.map((item) => [item.productId, item._sum.quantity || 0]),
  );
  return products
    .map((product) => {
      const unitsSold = salesByProduct.get(product.id) || 0;
      const normalizedUnits30 = unitsSold * (30 / sourceDays);
      const risk = computeStockRisk({
        availableStock: product.stock,
        unitsSold30d: normalizedUnits30,
      });
      return {
        id: product.id,
        name: product.name,
        stock: product.stock,
        unitsSold,
        avgDailySales: unitsSold / sourceDays,
        daysOfCover: risk.daysOfCover,
        riskLevel: risk.level,
        href: `/admin/products/${product.id}#stock`,
      } satisfies DashboardStockItem;
    })
    .filter((product) => STOCK_RISK_LEVELS.has(product.riskLevel))
    .sort(
      (left, right) =>
        riskRank[left.riskLevel] - riskRank[right.riskLevel] ||
        (left.daysOfCover ?? 0) - (right.daysOfCover ?? 0) ||
        left.stock - right.stock,
    );
}

async function loadProductGrowth(now: Date) {
  const currentStart = new Date(now.getTime() - 30 * DAY_MS);
  const previousStart = new Date(now.getTime() - 60 * DAY_MS);
  const [current, previous, products] = await Promise.all([
    prisma.orderItem.groupBy({
      by: ["productId"],
      where: {
        productId: { not: null },
        order: {
          status: "delivered",
          paymentStatus: "paid",
          orderDate: { gte: currentStart, lte: now },
        },
      },
      _sum: { quantity: true },
    }),
    prisma.orderItem.groupBy({
      by: ["productId"],
      where: {
        productId: { not: null },
        order: {
          status: "delivered",
          paymentStatus: "paid",
          orderDate: { gte: previousStart, lt: currentStart },
        },
      },
      _sum: { quantity: true },
    }),
    prisma.product.findMany({ select: { id: true, name: true } }),
  ]);
  const previousById = new Map(
    previous.map((item) => [item.productId, item._sum.quantity || 0]),
  );
  const names = new Map(products.map((product) => [product.id, product.name]));
  return current
    .filter((item) => item.productId && (previousById.get(item.productId) || 0) > 0)
    .map((item) => {
      const previousUnits = previousById.get(item.productId) || 0;
      const units = item._sum.quantity || 0;
      return {
        id: item.productId!,
        name: names.get(item.productId!) || "Produit",
        change: metricChangePercent(units, previousUnits),
      };
    })
    .filter((item) => item.change > 0)
    .sort((left, right) => right.change - left.change)[0];
}

export async function getAdminTodayDashboard(): Promise<TodayDashboardData> {
  await requireAdmin();
  const now = new Date();
  const actionFilters = parseAdminOrderFilters({ sort: "priority" });
  const actionWhere = buildAdminOrderWhere(actionFilters);
  const currentSalesStart = new Date(now.getTime() - 30 * DAY_MS);
  const paymentWhere: Prisma.OrderWhereInput = {
    paymentMethod: "cod",
    deliveryStatus: "delivered",
    paymentStatus: { in: ["pending", "partial", "failed"] },
  };
  const activeDeliveryWhere: Prisma.OrderWhereInput = {
    status: { not: "cancelled" },
    fulfillmentStatus: "shipped",
    deliveryStatus: { in: ["not_assigned", "preparing", "in_transit", "out_for_delivery", "delayed"] },
  };
  const [
    policies,
    actionableCount,
    actionableOlderThan24h,
    actionRecords,
    paymentCount,
    deliveryRecords,
    stockRisk,
    growth,
  ] = await Promise.all([
    loadActiveOrderSlaPolicies(),
    prisma.order.count({ where: actionWhere }),
    prisma.order.count({
      where: {
        AND: [actionWhere, { orderDate: { lt: new Date(now.getTime() - DAY_MS) } }],
      },
    }),
    prisma.order.findMany({
      where: actionWhere,
      orderBy: { orderDate: "desc" },
      take: 24,
      select: orderListSelect,
    }),
    prisma.order.count({ where: paymentWhere }),
    prisma.order.findMany({ where: activeDeliveryWhere, select: orderListSelect }),
    loadStockAnalytics({ start: currentSalesStart, end: now, sourceDays: 30 }),
    loadProductGrowth(now),
  ]);

  const overdueDeliveries = deliveryRecords.filter((order) =>
    computeOrderOperationalState(toOrderDomainContext(order), policies, now).sla?.isOverdue,
  );
  const recentActivity = actionRecords
    .map((order) => ({
      order,
      operational: computeOrderOperationalState(toOrderDomainContext(order), policies, now),
    }))
    .sort(
      (left, right) =>
        right.operational.priorityScore - left.operational.priorityScore ||
        right.order.orderDate.getTime() - left.order.orderDate.getTime(),
    )
    .slice(0, 6)
    .map(({ order }) => mapOrder(order, policies, now));

  const attentionPoints: DashboardAttentionPoint[] = [];
  const firstStockRisk = stockRisk[0];
  if (firstStockRisk) {
    attentionPoints.push({
      key: `stock-${firstStockRisk.id}`,
      severity: firstStockRisk.riskLevel === "LOW" ? "warning" : "critical",
      title: firstStockRisk.name,
      message:
        firstStockRisk.daysOfCover === null
          ? "Risque de stock à contrôler."
          : `Couverture estimée à ${firstStockRisk.daysOfCover.toFixed(1)} jour(s).`,
      actionLabel: "Anticiper le stock",
      href: firstStockRisk.href,
    });
  }
  const delayedCity = overdueDeliveries.find((order) => order.shippingCity)?.shippingCity;
  if (delayedCity) {
    const cityCount = overdueDeliveries.filter(
      (order) => order.shippingCity === delayedCity,
    ).length;
    attentionPoints.push({
      key: `delivery-${delayedCity}`,
      severity: "warning",
      title: delayedCity,
      message: `${cityCount} livraison(s) dépassent actuellement leur SLA.`,
      actionLabel: "Voir les livraisons",
      href: `/admin/orders?view=overdue&fulfillment=shipped&city=${encodeURIComponent(delayedCity)}&sort=sla`,
    });
  }
  if (growth) {
    attentionPoints.push({
      key: `growth-${growth.id}`,
      severity: "positive",
      title: growth.name,
      message: `Ventes en hausse de ${Math.round(growth.change)} % sur 30 jours.`,
      actionLabel: "Voir le produit",
      href: `/admin/products/${growth.id}`,
    });
  }

  return {
    generatedAt: now.toISOString(),
    cards: [
      {
        key: "orders",
        label: "Commandes à traiter",
        value: actionableCount,
        helper: actionableCount
          ? `${actionableOlderThan24h} depuis plus de 24 h`
          : "Aucune action urgente",
        actionLabel: "Voir les commandes",
        href: "/admin/orders?sort=priority",
        tone: actionableCount ? "danger" : "success",
      },
      {
        key: "payments",
        label: "Paiements à vérifier",
        value: paymentCount,
        helper: paymentCount ? "COD livré non encaissé" : "Aucun rapprochement en attente",
        actionLabel: "Vérifier",
        href: "/admin/orders?view=all&issue=uncollected-cod&sort=priority",
        tone: paymentCount ? "warning" : "success",
      },
      {
        key: "stock",
        label: "Stock à risque",
        value: stockRisk.length,
        helper: stockRisk.length
          ? `Couverture faible sur ${stockRisk.length} référence(s)`
          : "Aucune référence à risque",
        actionLabel: "Voir le stock",
        href: "/admin/products?view=stock-risk&sort=risk",
        tone: stockRisk.length ? "warning" : "success",
      },
      {
        key: "deliveries",
        label: "Livraisons en retard",
        value: overdueDeliveries.length,
        helper: overdueDeliveries.length
          ? "SLA de livraison dépassé"
          : "Aucun dépassement critique",
        actionLabel: "Voir les livraisons",
        href: "/admin/orders?view=overdue&fulfillment=shipped&sort=sla",
        tone: overdueDeliveries.length ? "danger" : "success",
      },
    ],
    attentionPoints,
    recentActivity,
    stockRisk: stockRisk.slice(0, 6),
  };
}

type DailySqlRow = {
  date: string;
  revenue: Prisma.Decimal | number;
  orders: bigint | number;
  collected_orders: bigint | number;
};

async function queryDailySeries(start: Date, end: Date) {
  const rows = await prisma.$queryRaw<DailySqlRow[]>(Prisma.sql`
    SELECT
      to_char((o."orderDate" AT TIME ZONE 'Africa/Casablanca'), 'YYYY-MM-DD') AS date,
      COALESCE(SUM(CASE
        WHEN o."paymentStatus"::text = 'paid' AND o."status"::text <> 'cancelled'
        THEN o."totalPrice" ELSE 0 END), 0) AS revenue,
      COUNT(*) AS orders,
      COUNT(*) FILTER (
        WHERE o."paymentStatus"::text = 'paid' AND o."status"::text <> 'cancelled'
      ) AS collected_orders
    FROM "Order" o
    WHERE o."orderDate" >= ${start} AND o."orderDate" <= ${end}
    GROUP BY 1
    ORDER BY 1 ASC
  `);
  return rows.map((row) => ({
    date: row.date,
    revenue: numberValue(row.revenue),
    orders: numberValue(row.orders),
    collectedOrders: numberValue(row.collected_orders),
  }));
}

type DurationSqlRow = {
  cancelled_orders: bigint | number;
  preparation_hours: Prisma.Decimal | number | null;
  delivery_hours: Prisma.Decimal | number | null;
};

async function queryDurations(start: Date, end: Date) {
  const [row] = await prisma.$queryRaw<DurationSqlRow[]>(Prisma.sql`
    SELECT
      COUNT(*) FILTER (WHERE o."status"::text = 'cancelled') AS cancelled_orders,
      AVG(EXTRACT(EPOCH FROM (o."preparedAt" - o."orderDate")) / 3600)
        FILTER (WHERE o."status"::text <> 'cancelled' AND o."preparedAt" IS NOT NULL AND o."preparedAt" >= o."orderDate") AS preparation_hours,
      AVG(EXTRACT(EPOCH FROM (o."deliveredAt" - o."orderDate")) / 3600)
        FILTER (WHERE o."status"::text <> 'cancelled' AND o."deliveredAt" IS NOT NULL AND o."deliveredAt" >= o."orderDate") AS delivery_hours
    FROM "Order" o
    WHERE o."orderDate" >= ${start} AND o."orderDate" <= ${end}
  `);
  return {
    cancelledOrders: numberValue(row?.cancelled_orders),
    preparationHours: numberValue(row?.preparation_hours),
    deliveryHours: numberValue(row?.delivery_hours),
  };
}

type ProductSqlRow = {
  product_id: string | null;
  name: string;
  revenue: Prisma.Decimal | number;
  units: bigint | number;
};

async function queryProductSales(start: Date, end: Date) {
  const rows = await prisma.$queryRaw<ProductSqlRow[]>(Prisma.sql`
    SELECT
      oi."productId" AS product_id,
      COALESCE(MAX(p."name"), MAX(oi."productNameSnapshot")) AS name,
      COALESCE(SUM(oi."quantity" * oi."productPriceSnapshot"), 0) AS revenue,
      COALESCE(SUM(oi."quantity"), 0) AS units
    FROM "OrderItem" oi
    INNER JOIN "Order" o ON o."id" = oi."orderId"
    LEFT JOIN "Product" p ON p."id" = oi."productId"
    WHERE o."orderDate" >= ${start} AND o."orderDate" <= ${end}
      AND o."paymentStatus"::text = 'paid'
      AND o."status"::text <> 'cancelled'
    GROUP BY oi."productId"
  `);
  return rows.map((row) => ({
    productId: row.product_id,
    name: row.name,
    revenue: numberValue(row.revenue),
    units: numberValue(row.units),
  }));
}

async function loadPilotageProducts(window: DashboardDateWindow) {
  const [current, previous, stock] = await Promise.all([
    queryProductSales(window.start, window.end),
    queryProductSales(window.previousStart, window.previousEnd),
    loadStockAnalytics({
      start: window.start,
      end: window.end,
      sourceDays: window.period,
    }),
  ]);
  const previousByKey = new Map(
    previous.map((row) => [row.productId || `name:${row.name}`, row]),
  );
  const products = current
    .map((row) => {
      const prior = previousByKey.get(row.productId || `name:${row.name}`);
      return {
        ...row,
        revenueTrend: metricChangePercent(row.revenue, prior?.revenue || 0),
        unitsTrend: metricChangePercent(row.units, prior?.units || 0),
        href: row.productId ? `/admin/products/${row.productId}` : null,
      };
    })
    .sort((left, right) => Math.max(right.revenue, right.units) - Math.max(left.revenue, left.units))
    .slice(0, 12);
  return { products, stock: stock.slice(0, 8) };
}

const domainContextForDelivery = (order: {
  id: string;
  orderNumber: string;
  orderDate: Date;
  shippedAt: Date | null;
  deliveredAt: Date | null;
  deliveryCompany: string | null;
  shippingCity: string | null;
}): OrderDomainContext => ({
  id: order.id,
  orderNumber: order.orderNumber,
  orderDate: order.orderDate,
  status: "shipped",
  paymentStatus: "paid",
  paymentMethod: "cod",
  fulfillmentStatus: "shipped",
  deliveryStatus: "in_transit",
  confirmationRequired: false,
  confirmedAt: null,
  preparationStartedAt: null,
  preparedAt: null,
  shippedAt: order.shippedAt,
  deliveredAt: order.deliveredAt,
  estimatedDeliveryAt: null,
  deliveryCompany: order.deliveryCompany,
  trackingNumber: null,
  phone: "dashboard",
  address: "dashboard",
  city: order.shippingCity,
  items: [],
  returns: [],
});

async function loadDeliveryPerformance(
  window: DashboardDateWindow,
  policies: OrderSlaPolicy[],
) {
  const orders = await prisma.order.findMany({
    where: {
      orderDate: { gte: window.start, lte: window.end },
      deliveredAt: { not: null },
      deliveryStatus: "delivered",
    },
    select: {
      id: true,
      orderNumber: true,
      orderDate: true,
      shippedAt: true,
      deliveredAt: true,
      deliveryCompany: true,
      shippingCity: true,
    },
  });
  const byCity = new Map<string, { durations: number[]; objectives: number[] }>();
  for (const order of orders) {
    const city = order.shippingCity?.trim();
    if (!city || !order.deliveredAt) continue;
    const bucket = byCity.get(city) || { durations: [], objectives: [] };
    const deliveryStartedAt = order.shippedAt || order.orderDate;
    bucket.durations.push(
      Math.max(0, order.deliveredAt.getTime() - deliveryStartedAt.getTime()) / DAY_MS,
    );
    const policy = resolveOrderSlaPolicy(
      policies,
      "delivery",
      domainContextForDelivery(order),
    );
    if (policy) bucket.objectives.push(policy.durationHours / 24);
    byCity.set(city, bucket);
  }
  return Array.from(byCity.entries())
    .map(([city, values]) => {
      const averageDays =
        values.durations.reduce((sum, value) => sum + value, 0) / values.durations.length;
      const objectiveDays = values.objectives.length
        ? values.objectives.reduce((sum, value) => sum + value, 0) / values.objectives.length
        : null;
      return {
        city,
        deliveredOrders: values.durations.length,
        averageDays,
        objectiveDays,
        isWithinSla: objectiveDays === null ? null : averageDays <= objectiveDays,
        href: `/admin/orders?view=delivered&period=${window.period}d&city=${encodeURIComponent(city)}&sort=newest`,
      } satisfies DeliveryPerformanceRow;
    })
    .sort((left, right) => right.deliveredOrders - left.deliveredOrders)
    .slice(0, 8);
}

async function loadPaymentCollections(window: DashboardDateWindow) {
  const [collected, uncollectedCod] = await Promise.all([
    prisma.order.groupBy({
      by: ["paymentMethod"],
      where: {
        orderDate: { gte: window.start, lte: window.end },
        paymentStatus: "paid",
        status: { not: "cancelled" },
      },
      _sum: { totalPrice: true },
      _count: { _all: true },
    }),
    prisma.order.aggregate({
      where: {
        orderDate: { gte: window.start, lte: window.end },
        paymentMethod: "cod",
        deliveryStatus: "delivered",
        paymentStatus: { in: ["pending", "partial", "failed"] },
      },
      _sum: { totalPrice: true },
      _count: { _all: true },
    }),
  ]);
  const labels = {
    cmi_card: "Payé en ligne",
    installments: "Paiement fractionné encaissé",
    cod: "COD encaissé",
  } as const;
  const rows: PaymentCollectionRow[] = collected.map((row) => ({
    key: row.paymentMethod,
    label: labels[row.paymentMethod],
    amount: numberValue(row._sum.totalPrice),
    orders: row._count._all,
    collected: true,
    href: `/admin/orders?view=all&period=${window.period}d&method=${row.paymentMethod}&payment=paid&sort=newest`,
  }));
  rows.push({
    key: "uncollected-cod",
    label: "COD livré non encaissé",
    amount: numberValue(uncollectedCod._sum.totalPrice),
    orders: uncollectedCod._count._all,
    collected: false,
    href: "/admin/orders?view=all&issue=uncollected-cod&sort=priority",
  });
  return rows;
}

async function loadSignificantOrders(
  window: DashboardDateWindow,
  policies: OrderSlaPolicy[],
) {
  const baseWhere: Prisma.OrderWhereInput = {
    orderDate: { gte: window.start, lte: window.end },
  };
  const [flagged, highValue] = await Promise.all([
    prisma.order.findMany({
      where: {
        AND: [
          baseWhere,
          {
            OR: [
              { status: "cancelled" },
              { deliveryStatus: { in: ["delayed", "failed", "returned"] } },
              { paymentStatus: "failed" },
              { returns: { some: {} } },
            ],
          },
        ],
      },
      orderBy: { orderDate: "desc" },
      take: 12,
      select: orderListSelect,
    }),
    prisma.order.findMany({
      where: baseWhere,
      orderBy: [{ totalPrice: "desc" }, { orderDate: "desc" }],
      take: 4,
      select: orderListSelect,
    }),
  ]);
  const unique = new Map([...flagged, ...highValue].map((order) => [order.id, order]));
  return Array.from(unique.values())
    .sort((left, right) => right.orderDate.getTime() - left.orderDate.getTime())
    .slice(0, 8)
    .map((order) => mapOrder(order, policies));
}

async function loadPilotageCore(window: DashboardDateWindow) {
  const [currentRows, previousRows, currentDurations, previousDurations] =
    await Promise.all([
      queryDailySeries(window.start, window.end),
      queryDailySeries(window.previousStart, window.previousEnd),
      queryDurations(window.start, window.end),
      queryDurations(window.previousStart, window.previousEnd),
    ]);
  const series = buildRevenueOrderSeries(currentRows, window);
  const previousSeries = buildRevenueOrderSeries(previousRows, {
    start: window.previousStart,
    period: window.period,
  });
  const totals = (points: RevenueOrderPoint[]) => ({
    revenue: points.reduce((sum, point) => sum + point.revenue, 0),
    orders: points.reduce((sum, point) => sum + point.orders, 0),
    collectedOrders: points.reduce((sum, point) => sum + point.collectedOrders, 0),
  });
  const current = totals(series);
  const previous = totals(previousSeries);
  const averageBasket = current.collectedOrders ? current.revenue / current.collectedOrders : 0;
  const previousAverageBasket = previous.collectedOrders
    ? previous.revenue / previous.collectedOrders
    : 0;
  const cancellationRate = current.orders
    ? (currentDurations.cancelledOrders / current.orders) * 100
    : 0;
  const previousCancellationRate = previous.orders
    ? (previousDurations.cancelledOrders / previous.orders) * 100
    : 0;
  const kpis: PilotageKpi[] = [
    {
      key: "revenue",
      label: "CA encaissé",
      value: current.revenue,
      previousValue: previous.revenue,
      change: metricChangePercent(current.revenue, previous.revenue),
      changeKind: "percent",
      format: "currency",
      helper: "Commandes payées et non annulées.",
    },
    {
      key: "orders",
      label: "Commandes",
      value: current.orders,
      previousValue: previous.orders,
      change: metricChangePercent(current.orders, previous.orders),
      changeKind: "percent",
      format: "number",
      helper: "Commandes créées sur la période.",
    },
    {
      key: "basket",
      label: "Panier moyen encaissé",
      value: averageBasket,
      previousValue: previousAverageBasket,
      change: metricChangePercent(averageBasket, previousAverageBasket),
      changeKind: "percent",
      format: "currency",
      helper: "CA encaissé / commandes encaissées.",
    },
    {
      key: "cancellation",
      label: "Taux d’annulation",
      value: cancellationRate,
      previousValue: previousCancellationRate,
      change: metricPointChange(cancellationRate, previousCancellationRate),
      changeKind: "points",
      format: "percent",
      positiveWhenDown: true,
      helper: "Annulations / commandes créées.",
    },
    {
      key: "preparation",
      label: "Préparation moyenne",
      value: currentDurations.preparationHours,
      previousValue: previousDurations.preparationHours,
      change: metricChangePercent(
        currentDurations.preparationHours,
        previousDurations.preparationHours,
      ),
      changeKind: "percent",
      format: "duration",
      positiveWhenDown: true,
      helper: "Commande reçue → préparée.",
    },
    {
      key: "delivery",
      label: "Livraison moyenne",
      value: currentDurations.deliveryHours,
      previousValue: previousDurations.deliveryHours,
      change: metricChangePercent(
        currentDurations.deliveryHours,
        previousDurations.deliveryHours,
      ),
      changeKind: "percent",
      format: "duration",
      positiveWhenDown: true,
      helper: "Commande reçue → livrée au client.",
    },
  ];
  return { series, kpis };
}

const settledValue = <T,>(result: PromiseSettledResult<T>) =>
  result.status === "fulfilled" ? result.value : null;

export async function getAdminPilotageDashboard(
  period: DashboardPeriod,
): Promise<PilotageDashboardData> {
  await requireAdmin();
  const now = new Date();
  const window = buildDashboardDateWindow(period, now);
  const policies = await loadActiveOrderSlaPolicies();
  const core = await loadPilotageCore(window);
  const [productsResult, deliveryResult, paymentsResult, ordersResult] =
    await Promise.allSettled([
      loadPilotageProducts(window),
      loadDeliveryPerformance(window, policies),
      loadPaymentCollections(window),
      loadSignificantOrders(window, policies),
    ]);
  const products = settledValue(productsResult);
  const sectionErrors = [
    productsResult.status === "rejected" ? "Top produits et stock prédictif indisponibles." : null,
    deliveryResult.status === "rejected" ? "Performance de livraison indisponible." : null,
    paymentsResult.status === "rejected" ? "Encaissements par moyen de paiement indisponibles." : null,
    ordersResult.status === "rejected" ? "Commandes significatives indisponibles." : null,
  ].filter((message): message is string => Boolean(message));

  return {
    generatedAt: now.toISOString(),
    period,
    window: {
      start: window.start.toISOString(),
      end: window.end.toISOString(),
      previousStart: window.previousStart.toISOString(),
      previousEnd: window.previousEnd.toISOString(),
      label: window.label,
      comparisonLabel: window.comparisonLabel,
    },
    kpis: core.kpis,
    series: core.series,
    products: products?.products || null,
    stockAnalytics: products?.stock || null,
    deliveryPerformance: settledValue(deliveryResult),
    payments: settledValue(paymentsResult),
    significantOrders: settledValue(ordersResult),
    sectionErrors,
  };
}
