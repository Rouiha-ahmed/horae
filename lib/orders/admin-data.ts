import { Prisma } from "@prisma/client";

import {
  computeOrderOperationalState,
  computeSla,
  collectedPaymentStatuses,
  type OrderDomainContext,
  type OrderSlaPolicy,
} from "@/lib/orders/domain";
import { requireOrderOperator } from "@/lib/orders/permissions";
import { prisma } from "@/lib/prisma";

export type AdminOrderView =
  | "to-process"
  | "all"
  | "to-prepare"
  | "to-ship"
  | "in-transit"
  | "delivery-problem"
  | "overdue"
  | "delivered"
  | "cancelled"
  | "returns";

export type AdminOrderFilters = {
  view: AdminOrderView;
  query: string;
  fulfillment: string;
  payment: string;
  method: string;
  delivery: string;
  period: "7d" | "30d" | "90d" | "all";
  city: string;
  carrier: string;
  minAmount: number | null;
  maxAmount: number | null;
  issue: string;
  product: string;
  sort: "priority" | "newest" | "oldest" | "amount-desc" | "amount-asc" | "sla";
  page: number;
  pageSize: 10 | 20 | 50;
};

const firstParam = (
  params: Record<string, string | string[] | undefined>,
  key: string
) => {
  const value = params[key];
  return Array.isArray(value) ? value[0] : value;
};

const parsePositiveAmount = (value: string | undefined) => {
  if (!value) return null;
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
};

const fulfillmentFilters = ["to_prepare", "preparing", "ready", "shipped", "cancelled"] as const;
const paymentFilters = ["pending", "partial", "paid", "failed", "refunded"] as const;
const paymentMethodFilters = ["cod", "cmi_card", "installments"] as const;
const deliveryFilters = [
  "not_assigned",
  "preparing",
  "in_transit",
  "out_for_delivery",
  "delivered",
  "delayed",
  "failed",
  "returned",
] as const;
const issueFilters = [
  "missing-phone",
  "address",
  "payment-failed",
  "uncollected-cod",
  "tracking",
  "delivery",
  "return",
] as const;

const enumFilter = <T extends readonly string[]>(
  value: string | undefined,
  allowed: T
) => (value && allowed.includes(value as T[number]) ? value : "all");

export const parseAdminOrderFilters = (
  params: Record<string, string | string[] | undefined>
): AdminOrderFilters => {
  const requestedView = firstParam(params, "view");
  const views: AdminOrderView[] = [
    "to-process",
    "all",
    "to-prepare",
    "to-ship",
    "in-transit",
    "delivery-problem",
    "overdue",
    "delivered",
    "cancelled",
    "returns",
  ];
  const requestedSort = firstParam(params, "sort");
  const sorts: AdminOrderFilters["sort"][] = [
    "priority",
    "newest",
    "oldest",
    "amount-desc",
    "amount-asc",
    "sla",
  ];
  const requestedPeriod = firstParam(params, "period");
  const requestedPageSize = Number.parseInt(firstParam(params, "pageSize") || "10", 10);
  const requestedPage = Number.parseInt(firstParam(params, "page") || "1", 10);

  return {
    view: views.includes(requestedView as AdminOrderView)
      ? (requestedView as AdminOrderView)
      : "to-process",
    query: (firstParam(params, "q") || "").trim().slice(0, 120),
    fulfillment: enumFilter(firstParam(params, "fulfillment")?.trim(), fulfillmentFilters),
    payment: enumFilter(firstParam(params, "payment")?.trim(), paymentFilters),
    method: enumFilter(firstParam(params, "method")?.trim(), paymentMethodFilters),
    delivery: enumFilter(firstParam(params, "delivery")?.trim(), deliveryFilters),
    period: ["7d", "30d", "90d", "all"].includes(requestedPeriod || "")
      ? (requestedPeriod as AdminOrderFilters["period"])
      : "all",
    city: (firstParam(params, "city") || "").trim().slice(0, 80),
    carrier: (firstParam(params, "carrier") || "").trim().slice(0, 80),
    minAmount: parsePositiveAmount(firstParam(params, "minAmount")),
    maxAmount: parsePositiveAmount(firstParam(params, "maxAmount")),
    issue: enumFilter(firstParam(params, "issue")?.trim(), issueFilters),
    product: (firstParam(params, "product") || "").trim().slice(0, 100),
    sort: sorts.includes(requestedSort as AdminOrderFilters["sort"])
      ? (requestedSort as AdminOrderFilters["sort"])
      : requestedView === "all"
        ? "newest"
        : "priority",
    page: Number.isFinite(requestedPage) && requestedPage > 0 ? requestedPage : 1,
    pageSize: [20, 50].includes(requestedPageSize)
      ? (requestedPageSize as 20 | 50)
      : 10,
  };
};

const activeReturnStatuses = ["requested", "approved", "received", "inspected"] as const;

const getPeriodStart = (period: AdminOrderFilters["period"], now = new Date()) => {
  if (period === "all") return null;
  const days = period === "7d" ? 7 : period === "90d" ? 90 : 30;
  return new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
};

const buildOverdueWhere = (now = new Date()): Prisma.OrderWhereInput => {
  const preparationCutoff = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const deliveryCutoff = new Date(now.getTime() - 72 * 60 * 60 * 1000);

  return {
    status: { not: "cancelled" },
    deliveryStatus: { not: "delivered" },
    OR: [
      {
        fulfillmentStatus: { in: ["to_prepare", "preparing"] },
        orderDate: { lt: preparationCutoff },
      },
      {
        fulfillmentStatus: "ready",
        preparedAt: { lt: preparationCutoff },
      },
      {
        fulfillmentStatus: "shipped",
        shippedAt: { lt: deliveryCutoff },
        deliveryStatus: { in: ["not_assigned", "preparing", "in_transit", "out_for_delivery", "delayed"] },
      },
    ],
  };
};

const buildSlaCandidateWhere = (): Prisma.OrderWhereInput => ({
  status: { not: "cancelled" },
  OR: [
    { fulfillmentStatus: { in: ["to_prepare", "preparing"] } },
    { fulfillmentStatus: "ready" },
    {
      fulfillmentStatus: "shipped",
      deliveryStatus: {
        in: ["not_assigned", "preparing", "in_transit", "out_for_delivery", "delayed"],
      },
    },
  ],
});

const buildCriticalWhere = (now = new Date()): Prisma.OrderWhereInput => ({
  OR: [
    { deliveryStatus: { in: ["failed", "delayed"] } },
    { paymentStatus: "failed" },
    { shippingPhone: null },
    { shippingPhone: "" },
    { shippingAddress: null },
    { shippingAddress: "" },
    { shippingCity: null },
    { shippingCity: "" },
    buildOverdueWhere(now),
  ],
});

const buildToProcessWhere = (now = new Date()): Prisma.OrderWhereInput => ({
  OR: [
    {
      status: { not: "cancelled" },
      OR: [
        buildCriticalWhere(now),
        { confirmationRequired: true, confirmedAt: null },
        {
          paymentMethod: { not: "cod" },
          paymentStatus: { in: ["pending", "partial", "failed"] },
        },
        { paymentMethod: "cod", deliveryStatus: "delivered", paymentStatus: { not: "paid" } },
        { fulfillmentStatus: { in: ["to_prepare", "preparing", "ready"] } },
        {
          fulfillmentStatus: "shipped",
          trackingNumber: null,
          deliveryStatus: { notIn: ["delivered", "returned"] },
        },
      ],
    },
    { returns: { some: { status: { in: [...activeReturnStatuses] } } } },
  ],
});

const buildNextActionWhere = (
  fulfillmentStatus: "to_prepare" | "ready"
): Prisma.OrderWhereInput => ({
  status: { not: "cancelled" },
  fulfillmentStatus,
  paymentStatus: { not: "failed" },
  shippingPhone: { not: null },
  shippingAddress: { not: null },
  shippingCity: { not: null },
  AND: [
    { NOT: { shippingPhone: "" } },
    { NOT: { shippingAddress: "" } },
    { NOT: { shippingCity: "" } },
    {
      OR: [
        { confirmationRequired: false },
        { confirmedAt: { not: null } },
      ],
    },
    {
      OR: [
        {
          paymentMethod: "cod",
          NOT: {
            deliveryStatus: "delivered",
            paymentStatus: { not: "paid" },
          },
        },
        { paymentMethod: { not: "cod" }, paymentStatus: "paid" },
      ],
    },
  ],
});

export const buildAdminOrderWhere = (
  filters: AdminOrderFilters,
  options: { skipView?: boolean; skipPeriod?: boolean } = {}
): Prisma.OrderWhereInput => {
  const clauses: Prisma.OrderWhereInput[] = [];
  const now = new Date();

  if (!options.skipView) {
    if (filters.view === "to-process") clauses.push(buildToProcessWhere(now));
    else if (filters.view === "to-prepare") clauses.push(buildNextActionWhere("to_prepare"));
    else if (filters.view === "to-ship") clauses.push(buildNextActionWhere("ready"));
    else if (filters.view === "in-transit") clauses.push({ deliveryStatus: "in_transit", status: { not: "cancelled" } });
    else if (filters.view === "delivery-problem") clauses.push({ deliveryStatus: { in: ["failed", "delayed"] } });
    else if (filters.view === "overdue") clauses.push(buildSlaCandidateWhere());
    else if (filters.view === "delivered") clauses.push({ deliveryStatus: "delivered" });
    else if (filters.view === "cancelled") clauses.push({ status: "cancelled" });
    else if (filters.view === "returns") clauses.push({ returns: { some: { status: { in: [...activeReturnStatuses] } } } });
  }

  if (filters.query) {
    clauses.push({
      OR: [
        { orderNumber: { contains: filters.query, mode: "insensitive" } },
        { customerName: { contains: filters.query, mode: "insensitive" } },
        { email: { contains: filters.query, mode: "insensitive" } },
        { shippingPhone: { contains: filters.query, mode: "insensitive" } },
        { trackingNumber: { contains: filters.query, mode: "insensitive" } },
        { shippingCity: { contains: filters.query, mode: "insensitive" } },
        {
          items: {
            some: {
              OR: [
                { productNameSnapshot: { contains: filters.query, mode: "insensitive" } },
                { product: { is: { sku: { contains: filters.query, mode: "insensitive" } } } },
              ],
            },
          },
        },
      ],
    });
  }

  if (filters.fulfillment !== "all") clauses.push({ fulfillmentStatus: filters.fulfillment as never });
  if (filters.payment !== "all") clauses.push({ paymentStatus: filters.payment as never });
  if (filters.method !== "all") clauses.push({ paymentMethod: filters.method as never });
  if (filters.delivery !== "all") clauses.push({ deliveryStatus: filters.delivery as never });

  if (!options.skipPeriod) {
    const periodStart = getPeriodStart(filters.period, now);
    if (periodStart) clauses.push({ orderDate: { gte: periodStart } });
  }

  if (filters.city) clauses.push({ shippingCity: { contains: filters.city, mode: "insensitive" } });
  if (filters.carrier) clauses.push({ deliveryCompany: { contains: filters.carrier, mode: "insensitive" } });
  if (filters.minAmount !== null || filters.maxAmount !== null) {
    clauses.push({
      totalPrice: {
        ...(filters.minAmount !== null ? { gte: filters.minAmount } : {}),
        ...(filters.maxAmount !== null ? { lte: filters.maxAmount } : {}),
      },
    });
  }
  if (filters.product) {
    clauses.push({
      items: {
        some: {
          OR: [
            { productNameSnapshot: { contains: filters.product, mode: "insensitive" } },
            { product: { is: { sku: { contains: filters.product, mode: "insensitive" } } } },
          ],
        },
      },
    });
  }

  if (filters.issue === "missing-phone") clauses.push({ OR: [{ shippingPhone: null }, { shippingPhone: "" }] });
  else if (filters.issue === "address") clauses.push({ OR: [{ shippingAddress: null }, { shippingAddress: "" }, { shippingCity: null }, { shippingCity: "" }] });
  else if (filters.issue === "payment-failed") clauses.push({ paymentStatus: "failed" });
  else if (filters.issue === "uncollected-cod") {
    clauses.push({
      paymentMethod: "cod",
      deliveryStatus: "delivered",
      paymentStatus: { in: ["pending", "partial", "failed"] },
    });
  }
  else if (filters.issue === "tracking") clauses.push({ fulfillmentStatus: "shipped", trackingNumber: null });
  else if (filters.issue === "delivery") clauses.push({ deliveryStatus: { in: ["failed", "delayed"] } });
  else if (filters.issue === "return") clauses.push({ returns: { some: { status: { in: [...activeReturnStatuses] } } } });

  return clauses.length ? { AND: clauses } : {};
};

export const orderListSelect = {
  id: true,
  orderNumber: true,
  userId: true,
  customerName: true,
  email: true,
  totalPrice: true,
  status: true,
  paymentStatus: true,
  paymentMethod: true,
  fulfillmentStatus: true,
  deliveryStatus: true,
  confirmationRequired: true,
  confirmedAt: true,
  preparationStartedAt: true,
  preparedAt: true,
  shippedAt: true,
  deliveredAt: true,
  estimatedDeliveryAt: true,
  deliveryCompany: true,
  trackingNumber: true,
  shippingPhone: true,
  shippingAddress: true,
  shippingCity: true,
  shippingState: true,
  shippingZip: true,
  orderDate: true,
  statusChangedAt: true,
  version: true,
  items: {
    orderBy: { createdAt: "asc" as const },
    select: {
      id: true,
      productId: true,
      productNameSnapshot: true,
      productPriceSnapshot: true,
      productImageUrlSnapshot: true,
      quantity: true,
      product: { select: { sku: true } },
    },
  },
  returns: {
    orderBy: { createdAt: "desc" as const },
    select: { id: true, status: true },
  },
} satisfies Prisma.OrderSelect;

export type OrderListRecord = Prisma.OrderGetPayload<{ select: typeof orderListSelect }>;

export const toOrderDomainContext = (order: OrderListRecord): OrderDomainContext => ({
  id: order.id,
  orderNumber: order.orderNumber,
  orderDate: order.orderDate,
  status: order.status,
  paymentStatus: order.paymentStatus,
  paymentMethod: order.paymentMethod,
  fulfillmentStatus: order.fulfillmentStatus,
  deliveryStatus: order.deliveryStatus,
  confirmationRequired: order.confirmationRequired,
  confirmedAt: order.confirmedAt,
  preparationStartedAt: order.preparationStartedAt,
  preparedAt: order.preparedAt,
  shippedAt: order.shippedAt,
  deliveredAt: order.deliveredAt,
  estimatedDeliveryAt: order.estimatedDeliveryAt,
  deliveryCompany: order.deliveryCompany,
  trackingNumber: order.trackingNumber,
  phone: order.shippingPhone,
  address: order.shippingAddress,
  city: order.shippingCity,
  items: order.items.map((item) => ({
    id: item.id,
    name: item.productNameSnapshot,
    sku: item.product?.sku || null,
    quantity: item.quantity,
  })),
  returns: order.returns.map((item) => ({ id: item.id, status: item.status })),
});

export type AdminOrderListItem = ReturnType<typeof mapAdminOrderListItem>;

const mapAdminOrderListItem = (
  order: OrderListRecord,
  policies: OrderSlaPolicy[],
  now = new Date()
) => {
  const operational = computeOrderOperationalState(toOrderDomainContext(order), policies, now);

  return {
    id: order.id,
    orderNumber: order.orderNumber,
    userId: order.userId,
    customerName: order.customerName,
    email: order.email,
    phone: order.shippingPhone,
    address: order.shippingAddress,
    city: order.shippingCity,
    state: order.shippingState,
    zip: order.shippingZip,
    totalPrice: Number(order.totalPrice),
    status: order.status,
    paymentStatus: order.paymentStatus,
    paymentMethod: order.paymentMethod,
    fulfillmentStatus: order.fulfillmentStatus,
    deliveryStatus: order.deliveryStatus,
    deliveryCompany: order.deliveryCompany,
    trackingNumber: order.trackingNumber,
    orderDate: order.orderDate,
    preparedAt: order.preparedAt,
    shippedAt: order.shippedAt,
    deliveredAt: order.deliveredAt,
    statusChangedAt: order.statusChangedAt,
    version: order.version,
    itemsCount: order.items.reduce((sum, item) => sum + item.quantity, 0),
    itemNames: order.items.map((item) => item.productNameSnapshot),
    nextAction: operational.nextAction,
    attentionLevel: operational.attentionLevel,
    issues: operational.issues,
    sla: operational.sla,
    priorityScore: operational.priorityScore,
  };
};

export const loadActiveOrderSlaPolicies = async (): Promise<OrderSlaPolicy[]> =>
  prisma.orderSlaPolicy.findMany({
    where: { isActive: true },
    orderBy: [{ priority: "desc" }, { createdAt: "asc" }],
    select: {
      id: true,
      stage: true,
      durationHours: true,
      workingDays: true,
      applicableCarrier: true,
      applicableZone: true,
      priority: true,
    },
  });

const orderByFor = (sort: AdminOrderFilters["sort"]): Prisma.OrderOrderByWithRelationInput[] => {
  if (sort === "oldest") return [{ orderDate: "asc" }];
  if (sort === "amount-desc") return [{ totalPrice: "desc" }, { orderDate: "desc" }];
  if (sort === "amount-asc") return [{ totalPrice: "asc" }, { orderDate: "desc" }];
  if (sort === "sla") return [{ statusChangedAt: "asc" }, { orderDate: "asc" }];
  if (sort === "priority") return [{ orderDate: "asc" }];
  return [{ orderDate: "desc" }];
};

export type AdminOrdersWorkQueueData = Awaited<ReturnType<typeof getAdminOrdersWorkQueueData>>;

export const collectedRevenueWhere = {
  paymentStatus: { in: [...collectedPaymentStatuses] },
} satisfies Prisma.OrderWhereInput;

export async function getAdminOrdersWorkQueueData(filters: AdminOrderFilters) {
  const operator = await requireOrderOperator();

  const where = buildAdminOrderWhere(filters);
  const policies = await loadActiveOrderSlaPolicies();
  const [
    totalOrders,
    paidOrders,
    paidRevenue,
    toProcess,
    toPrepare,
    toShip,
    inTransit,
    deliveryProblem,
    overdueCandidates,
    delivered,
    cancelled,
    candidateFilteredCount,
    cities,
    carriers,
  ] = await Promise.all([
    prisma.order.count(),
    prisma.order.count({ where: collectedRevenueWhere }),
    prisma.order.aggregate({ where: collectedRevenueWhere, _sum: { totalPrice: true }, _avg: { totalPrice: true } }),
    prisma.order.count({ where: buildToProcessWhere() }),
    prisma.order.count({ where: buildNextActionWhere("to_prepare") }),
    prisma.order.count({ where: buildNextActionWhere("ready") }),
    prisma.order.count({ where: { deliveryStatus: "in_transit", status: { not: "cancelled" } } }),
    prisma.order.count({ where: { deliveryStatus: { in: ["failed", "delayed"] } } }),
    prisma.order.findMany({
      where: buildSlaCandidateWhere(),
      select: orderListSelect,
    }),
    prisma.order.count({ where: { deliveryStatus: "delivered" } }),
    prisma.order.count({ where: { status: "cancelled" } }),
    prisma.order.count({ where }),
    prisma.order.findMany({ where: { shippingCity: { not: null } }, distinct: ["shippingCity"], select: { shippingCity: true }, orderBy: { shippingCity: "asc" } }),
    prisma.order.findMany({ where: { deliveryCompany: { not: null } }, distinct: ["deliveryCompany"], select: { deliveryCompany: true }, orderBy: { deliveryCompany: "asc" } }),
  ]);

  const now = new Date();
  const exactOverdueCandidates = overdueCandidates.filter(
    (order) => computeSla(toOrderDomainContext(order), policies, now)?.isOverdue
  );
  const exactOverdueViewRecords =
    filters.view === "overdue"
      ? (
          await prisma.order.findMany({
            where,
            orderBy: orderByFor(filters.sort),
            select: orderListSelect,
          })
        ).filter(
          (order) => computeSla(toOrderDomainContext(order), policies, now)?.isOverdue,
        )
      : null;
  if (exactOverdueViewRecords && ["priority", "sla"].includes(filters.sort)) {
    exactOverdueViewRecords.sort((left, right) => {
      const leftState = computeOrderOperationalState(toOrderDomainContext(left), policies, now);
      const rightState = computeOrderOperationalState(toOrderDomainContext(right), policies, now);
      if (filters.sort === "sla") {
        return (leftState.sla?.dueAt.getTime() || 0) - (rightState.sla?.dueAt.getTime() || 0);
      }
      return rightState.priorityScore - leftState.priorityScore;
    });
  }
  const filteredCount = exactOverdueViewRecords?.length ?? candidateFilteredCount;
  const totalPages = Math.max(1, Math.ceil(filteredCount / filters.pageSize));
  const currentPage = Math.min(filters.page, totalPages);
  const skip = (currentPage - 1) * filters.pageSize;
  let records: OrderListRecord[];

  if (exactOverdueViewRecords) {
    records = exactOverdueViewRecords.slice(skip, skip + filters.pageSize);
  } else if (filters.sort === "priority" && filters.view === "to-process") {
    const criticalWhere: Prisma.OrderWhereInput = { AND: [where, buildCriticalWhere()] };
    const criticalCount = await prisma.order.count({ where: criticalWhere });
    const criticalTake = Math.max(0, Math.min(filters.pageSize, criticalCount - skip));
    const criticalRecords = criticalTake
      ? await prisma.order.findMany({ where: criticalWhere, orderBy: [{ orderDate: "asc" }], skip, take: criticalTake, select: orderListSelect })
      : [];
    const normalTake = filters.pageSize - criticalRecords.length;
    const normalSkip = Math.max(0, skip - criticalCount);
    const normalRecords = normalTake
      ? await prisma.order.findMany({ where: { AND: [where, { NOT: buildCriticalWhere() }] }, orderBy: [{ orderDate: "asc" }], skip: normalSkip, take: normalTake, select: orderListSelect })
      : [];
    records = [...criticalRecords, ...normalRecords];
  } else {
    records = await prisma.order.findMany({
      where,
      orderBy: orderByFor(filters.sort),
      skip,
      take: filters.pageSize,
      select: orderListSelect,
    });
  }

  const orders = records
    .map((order) => mapAdminOrderListItem(order, policies, now))
    .sort((left, right) =>
      filters.sort === "priority" ? right.priorityScore - left.priorityScore : 0
    );
  const exactOverdue = exactOverdueCandidates.length;

  return {
    operatorRole: operator.role,
    metrics: {
      totalOrders,
      paidOrders,
      paidRevenue: Number(paidRevenue._sum.totalPrice || 0),
      averagePaidBasket: Number(paidRevenue._avg.totalPrice || 0),
      toProcess,
      toPrepare,
      toShip,
      inTransit,
      deliveryProblem,
      overdue: exactOverdue,
      delivered,
      cancelled,
    },
    filters,
    orders,
    options: {
      cities: cities.map((item) => item.shippingCity).filter((value): value is string => Boolean(value)),
      carriers: carriers.map((item) => item.deliveryCompany).filter((value): value is string => Boolean(value)),
    },
    pagination: { currentPage, totalPages, pageSize: filters.pageSize, filteredCount },
  };
}

export async function getAdminOrderDetail(orderId: string) {
  const operator = await requireOrderOperator();
  const policies = await loadActiveOrderSlaPolicies();
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: {
      ...orderListSelect,
      currency: true,
      shippingName: true,
      amountDiscount: true,
      promoCode: true,
      promoDiscount: true,
      installmentMonths: true,
      installmentMonthlyAmount: true,
      deliveryPersonName: true,
      driverPhoneNumber: true,
      invoiceNumber: true,
      stripePaymentIntentId: true,
      user: { select: { id: true, fullName: true, loyaltyCardNumber: true } },
      items: {
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          productId: true,
          productNameSnapshot: true,
          productPriceSnapshot: true,
          productImageUrlSnapshot: true,
          quantity: true,
          product: { select: { sku: true } },
        },
      },
      events: { orderBy: { createdAt: "desc" }, take: 100 },
      notes: { orderBy: { createdAt: "desc" }, take: 50 },
      returns: { orderBy: { createdAt: "desc" } },
    },
  });

  if (!order) return null;

  const listCompatible = {
    ...order,
    returns: order.returns.map((item) => ({ id: item.id, status: item.status })),
  } as OrderListRecord;
  const operational = computeOrderOperationalState(toOrderDomainContext(listCompatible), policies);

  return {
    ...order,
    operatorRole: operator.role,
    totalPrice: Number(order.totalPrice),
    amountDiscount: Number(order.amountDiscount),
    promoDiscount: Number(order.promoDiscount),
    installmentMonthlyAmount: order.installmentMonthlyAmount ? Number(order.installmentMonthlyAmount) : null,
    items: order.items.map((item) => ({
      ...item,
      productPriceSnapshot: Number(item.productPriceSnapshot),
      sku: item.product?.sku || null,
    })),
    returns: order.returns.map((item) => ({
      ...item,
      refundAmount: item.refundAmount ? Number(item.refundAmount) : null,
    })),
    operational,
    performance: {
      preparationMs: order.preparedAt ? order.preparedAt.getTime() - order.orderDate.getTime() : null,
      deliveryMs: order.deliveredAt ? order.deliveredAt.getTime() - order.orderDate.getTime() : null,
    },
  };
}

export async function getOrdersForExport(filters: AdminOrderFilters) {
  await requireOrderOperator();
  return prisma.order.findMany({
    where: buildAdminOrderWhere(filters),
    orderBy: { orderDate: "desc" },
    take: 10_000,
    select: {
      orderNumber: true,
      orderDate: true,
      customerName: true,
      email: true,
      shippingPhone: true,
      shippingCity: true,
      totalPrice: true,
      paymentMethod: true,
      paymentStatus: true,
      fulfillmentStatus: true,
      deliveryStatus: true,
      deliveryCompany: true,
      trackingNumber: true,
    },
  });
}
