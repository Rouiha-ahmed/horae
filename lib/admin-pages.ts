import {
  Prisma,
  type DeliveryStatus,
  type OrderStatus,
  type PaymentStatus,
} from "@prisma/client";
import { unstable_cache } from "next/cache";

import {
  adminOrderStageOptions,
  getAdminDataTag,
  getAdminOrderStage,
  orderStatusToDeliveryStatus,
  requireAdmin,
  type AdminDashboardData,
} from "@/lib/admin";
import { sanitizePublicImageUrl } from "@/lib/image";
import { getPotentialBrandDuplicateGroups } from "@/lib/brands";
import { prisma } from "@/lib/prisma";

const adminDataTag = getAdminDataTag();
const sevenDaysFromNow = () => new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
const timelineLabelFormatter = new Intl.DateTimeFormat("fr-MA", {
  weekday: "short",
  day: "2-digit",
});

const decimalToNumber = (value: Prisma.Decimal | number | null | undefined) => {
  if (value === null || value === undefined) {
    return 0;
  }

  return typeof value === "number" ? value : Number(value);
};

const isDatabaseUnavailableError = (error: unknown) => {
  if (
    error instanceof Prisma.PrismaClientInitializationError ||
    error instanceof Prisma.PrismaClientRustPanicError
  ) {
    return true;
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    return ["P1001", "P1002", "P1017"].includes(error.code);
  }

  if (!(error instanceof Error)) {
    return false;
  }

  return /can't reach database server|database server|connection|timed out/i.test(
    error.message
  );
};

const toDate = (value: Date | string | null) => (value ? new Date(value) : null);

const getDashboardDateKey = (value: Date) =>
  `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(
    value.getDate()
  ).padStart(2, "0")}`;

const buildOrderStageBreakdown = (counts: Partial<Record<OrderStatus, number>>) =>
  adminOrderStageOptions.map((option) => {
    const count =
      option.value === "pending"
        ? counts.pending || 0
        : option.value === "confirmed"
          ? counts.processing || 0
          : option.value === "preparing"
            ? counts.paid || 0
            : option.value === "shipped"
              ? (counts.shipped || 0) + (counts.out_for_delivery || 0)
              : option.value === "delivered"
                ? counts.delivered || 0
                : counts.cancelled || 0;

    return {
      status: option.value,
      label: option.label,
      count,
    };
  });

const buildOrderCountsMap = (
  groups: Array<{
    status: OrderStatus;
    _count: {
      status: number;
    };
  }>
) =>
  groups.reduce<Partial<Record<OrderStatus, number>>>((accumulator, item) => {
    accumulator[item.status] = item._count.status;
    return accumulator;
  }, {});

const getPendingOrdersCount = (
  breakdown: AdminDashboardData["orderStageBreakdown"]
) =>
  breakdown
    .filter((item) =>
      ["pending", "confirmed", "preparing", "shipped"].includes(item.status)
    )
    .reduce((sum, item) => sum + item.count, 0);

const getEffectiveDeliveryStatus = (
  deliveryStatus: DeliveryStatus,
  status: OrderStatus
) =>
  deliveryStatus === "not_assigned" ? orderStatusToDeliveryStatus(status) : deliveryStatus;

const mapOrders = (
  orders: Array<{
    id: string;
    orderNumber: string;
    customerName: string;
    email: string;
    shippingPhone: string | null;
    shippingAddress: string | null;
    shippingCity: string | null;
    shippingState: string | null;
    shippingZip: string | null;
    totalPrice: Prisma.Decimal | number;
    status: OrderStatus;
    deliveryStatus: DeliveryStatus;
    deliveryCompany: string | null;
    deliveryPersonName: string | null;
    driverPhoneNumber: string | null;
    trackingNumber: string | null;
    paymentStatus: PaymentStatus;
    paymentMethod: AdminDashboardData["orders"][number]["paymentMethod"];
    orderDate: Date;
    items: Array<{
      id: string;
      productNameSnapshot: string;
      productImageUrlSnapshot: string | null;
      productPriceSnapshot: Prisma.Decimal | number;
      quantity: number;
      product: {
        stock: number;
      } | null;
    }>;
  }>
): AdminDashboardData["orders"] =>
  orders.map((order) => ({
    id: order.id,
    orderNumber: order.orderNumber,
    customerName: order.customerName,
    email: order.email,
    phone: order.shippingPhone,
    address: order.shippingAddress,
    city: order.shippingCity,
    state: order.shippingState,
    zip: order.shippingZip,
    totalPrice: decimalToNumber(order.totalPrice),
    status: order.status,
    adminStage: getAdminOrderStage(order.status),
    deliveryStatus: getEffectiveDeliveryStatus(order.deliveryStatus, order.status),
    deliveryCompany: order.deliveryCompany,
    deliveryPersonName: order.deliveryPersonName,
    driverPhoneNumber: order.driverPhoneNumber,
    trackingNumber: order.trackingNumber,
    paymentStatus: order.paymentStatus,
    paymentMethod: order.paymentMethod,
    orderDate: order.orderDate,
    itemsCount: order.items.length,
    items: order.items.map((item) => ({
      id: item.id,
      name: item.productNameSnapshot,
      imageUrl: item.productImageUrlSnapshot,
      quantity: item.quantity,
      unitPrice: decimalToNumber(item.productPriceSnapshot),
      isOutOfStock: (item.product?.stock ?? 1) <= 0,
      isStockInsufficient:
        (item.product?.stock ?? Number.POSITIVE_INFINITY) > 0 &&
        item.quantity > (item.product?.stock ?? Number.POSITIVE_INFINITY),
    })),
  }));

const mapCustomers = (
  customers: Array<{
    id: string;
    fullName: string;
    email: string;
    loyaltyTier: AdminDashboardData["customers"][number]["loyaltyTier"];
    loyaltyPoints: number;
    installmentsEligible: boolean;
    createdAt: Date;
    orders: Array<{
      orderDate: Date;
      paymentStatus: PaymentStatus;
      totalPrice: Prisma.Decimal | number;
    }>;
    _count: {
      orders: number;
    };
  }>
): AdminDashboardData["customers"] =>
  customers.map((customer) => {
    const paidOrders = customer.orders.filter((order) => order.paymentStatus === "paid");

    return {
      id: customer.id,
      fullName: customer.fullName,
      email: customer.email,
      loyaltyTier: customer.loyaltyTier,
      loyaltyPoints: customer.loyaltyPoints,
      installmentsEligible: customer.installmentsEligible,
      orderCount: customer._count.orders,
      totalSpent: paidOrders.reduce(
        (sum, order) => sum + decimalToNumber(order.totalPrice),
        0
      ),
      lastOrderDate: customer.orders[0]?.orderDate || null,
      createdAt: customer.createdAt,
    };
  });

const mapLowStockItems = (
  items: Array<{
    id: string;
    name: string;
    stock: number;
    lastRestockedAt: Date | null;
    images: Array<{
      url: string;
    }>;
  }>
): AdminDashboardData["lowStockItems"] =>
  items.map((item) => ({
    id: item.id,
    name: item.name,
    stock: item.stock,
    lastRestockedAt: item.lastRestockedAt,
    imageUrl: item.images[0]?.url || null,
  }));

const mapCategories = (
  categories: Array<{
    id: string;
    title: string;
    sortOrder?: number;
    range?: number | null;
    description: string | null;
    featured: boolean;
    imageUrl: string | null;
    updatedAt: Date;
    _count: {
      products: number;
    };
  }>
): AdminDashboardData["categories"] =>
  categories.map((category) => ({
    id: category.id,
    title: category.title,
    sortOrder: category.sortOrder ?? category.range ?? 0,
    description: category.description,
    featured: category.featured,
    productCount: category._count.products,
    imageUrl: category.imageUrl,
    updatedAt: category.updatedAt,
  }));

const mapBrands = (
  brands: Array<{
    id: string;
    title: string;
    description: string | null;
    imageUrl: string | null;
    isActive: boolean;
    archivedAt: Date | null;
    updatedAt: Date;
    _count: {
      products: number;
    };
  }>
): AdminDashboardData["brands"] =>
  brands.map((brand) => ({
    id: brand.id,
    title: brand.title,
    description: brand.description,
    productCount: brand._count.products,
    imageUrl: brand.imageUrl,
    isActive: brand.isActive,
    archivedAt: brand.archivedAt,
    updatedAt: brand.updatedAt,
  }));

const mapProducts = (
  products: Array<{
    id: string;
    name: string;
    description: string | null;
    price: Prisma.Decimal | number;
    discount: number;
    stock: number;
    lastRestockedAt: Date | null;
    status: AdminDashboardData["products"][number]["status"];
    isFeatured: boolean;
    brandId: string | null;
    updatedAt: Date;
    brand: {
      title: string;
    } | null;
    images: Array<{
      url: string;
    }>;
    categories: Array<{
      category: {
        id: string;
        title: string;
      };
    }>;
  }>
): AdminDashboardData["products"] =>
  products.map((product) => ({
    id: product.id,
    name: product.name,
    description: product.description,
    price: decimalToNumber(product.price),
    discount: product.discount,
    stock: product.stock,
    lastRestockedAt: product.lastRestockedAt,
    status: product.status,
    isFeatured: product.isFeatured,
    brandId: product.brandId,
    brandTitle: product.brand?.title || null,
    categoryIds: product.categories.map((item) => item.category.id),
    categoryTitles: product.categories.map((item) => item.category.title),
    imageUrl: product.images[0]?.url || null,
    imageUrls: product.images.map((image) => image.url),
    imagesCount: product.images.length,
    updatedAt: product.updatedAt,
  }));

const mapPromoCodes = (
  promoCodes: Array<{
    id: string;
    title: string;
    code: string;
    active: boolean;
    discountType: AdminDashboardData["promoCodes"][number]["discountType"];
    discountValue: Prisma.Decimal | number;
    endsAt: Date | null;
    updatedAt: Date;
  }>
): AdminDashboardData["promoCodes"] =>
  promoCodes.map((promo) => ({
    id: promo.id,
    title: promo.title,
    code: promo.code,
    active: promo.active,
    discountType: promo.discountType,
    discountValue: decimalToNumber(promo.discountValue),
    endsAt: promo.endsAt,
    updatedAt: promo.updatedAt,
  }));

const normalizeOrders = (orders: AdminDashboardData["orders"]) =>
  orders.map((order) => ({
    ...order,
    orderDate: new Date(order.orderDate),
  }));

const normalizeCustomers = (customers: AdminDashboardData["customers"]) =>
  customers.map((customer) => ({
    ...customer,
    lastOrderDate: toDate(customer.lastOrderDate),
    createdAt: new Date(customer.createdAt),
  }));

const normalizeCategories = (categories: AdminDashboardData["categories"]) =>
  categories.map((category) => ({
    ...category,
    updatedAt: new Date(category.updatedAt),
  }));

const normalizeBrands = (brands: AdminDashboardData["brands"]) =>
  brands.map((brand) => ({
    ...brand,
    archivedAt: toDate(brand.archivedAt),
    updatedAt: new Date(brand.updatedAt),
  }));

const normalizeProducts = (products: AdminDashboardData["products"]) =>
  products.map((product) => ({
    ...product,
    lastRestockedAt: toDate(product.lastRestockedAt),
    updatedAt: new Date(product.updatedAt),
  }));

const normalizePromoCodes = (promoCodes: AdminDashboardData["promoCodes"]) =>
  promoCodes.map((promo) => ({
    ...promo,
    endsAt: toDate(promo.endsAt),
    updatedAt: new Date(promo.updatedAt),
  }));

export const dashboardDateRangeOptions = [
  { value: "today", label: "Aujourd'hui" },
  { value: "last_7_days", label: "7 derniers jours" },
  { value: "last_30_days", label: "30 derniers jours" },
  { value: "current_month", label: "Mois courant" },
  { value: "custom", label: "Periode personnalisee" },
] as const;

const dashboardOrderStatusOptions = [
  "pending",
  "processing",
  "paid",
  "shipped",
  "out_for_delivery",
  "delivered",
  "cancelled",
] as const satisfies readonly OrderStatus[];

const dashboardPaymentStatusOptions = [
  "pending",
  "partial",
  "paid",
  "failed",
  "refunded",
] as const satisfies readonly PaymentStatus[];

const dashboardDeliveryStatusOptions = [
  "not_assigned",
  "preparing",
  "in_transit",
  "out_for_delivery",
  "delivered",
  "delayed",
  "failed",
  "returned",
] as const satisfies readonly DeliveryStatus[];

export type DashboardDateRange = (typeof dashboardDateRangeOptions)[number]["value"];

export type AdminDashboardFilters = {
  dateRange: DashboardDateRange;
  from: string;
  to: string;
  orderStatus: "all" | OrderStatus;
  paymentStatus: "all" | PaymentStatus;
  deliveryStatus: "all" | DeliveryStatus;
  categoryId: string;
};

type DashboardDateWindow = {
  key: DashboardDateRange;
  label: string;
  start: Date;
  end: Date;
  previousStart: Date;
  previousEnd: Date;
  days: number;
};

type DashboardOrderDateField = "orderDate" | "statusChangedAt";

export type DashboardKpiFormat = "currency" | "number" | "percent" | "duration";

export type DashboardKpi = {
  label: string;
  value: number;
  previousValue: number;
  changePct: number;
  helper: string;
  format: DashboardKpiFormat;
  tone: "success" | "warning" | "danger" | "info" | "neutral";
  invertTrend?: boolean;
  trend: number[];
};

export type DashboardRevenuePoint = {
  date: string;
  label: string;
  revenue: number;
  orders: number;
};

export type AdminOverviewData = {
  filters: AdminDashboardFilters;
  dateWindow: {
    label: string;
    start: string;
    end: string;
    previousStart: string;
    previousEnd: string;
  };
  filterOptions: {
    dateRanges: typeof dashboardDateRangeOptions;
    orderStatuses: Array<{ value: "all" | OrderStatus; label: string }>;
    paymentStatuses: Array<{ value: "all" | PaymentStatus; label: string }>;
    deliveryStatuses: Array<{ value: "all" | DeliveryStatus; label: string }>;
    categories: Array<{ id: string; title: string }>;
  };
  metrics: AdminDashboardData["metrics"];
  operationalAlerts: Array<{
    key: "orders" | "stock" | "payments" | "deliveries";
    label: string;
    value: number;
    helper: string;
    href: string;
    tone: "warning" | "danger" | "success" | "info";
  }>;
  priorityTasks: Array<{
    label: string;
    value: number;
    helper: string;
    href: string;
    tone: "warning" | "danger" | "success" | "info";
  }>;
  businessKpis: {
    financial: DashboardKpi[];
    orders: DashboardKpi[];
    performance: DashboardKpi[];
  };
  analytics: {
    revenueSeries: DashboardRevenuePoint[];
    paidVsUnpaid: Array<{ status: PaymentStatus; count: number }>;
    ordersByStatus: Array<{ status: OrderStatus; count: number }>;
    ordersByCategory: Array<{ category: string; orders: number; revenue: number }>;
  };
  inventorySummary: {
    outOfStock: number;
    lowStock: number;
    criticalStock: number;
    stockOutRate: number;
  };
  orderStageBreakdown: AdminDashboardData["orderStageBreakdown"];
  recentOrders: AdminDashboardData["orders"];
  recentCustomers: AdminDashboardData["customers"];
  lowStockItems: AdminDashboardData["lowStockItems"];
  revenueSeries: DashboardRevenuePoint[];
  topProducts: Array<{
    name: string;
    unitsSold: number;
    ordersCount: number;
  }>;
};

const getParamValue = (
  params: Record<string, string | string[] | undefined>,
  key: string
) => {
  const value = params[key];
  return Array.isArray(value) ? value[0] : value;
};

const isDateRange = (value: string | undefined): value is DashboardDateRange =>
  dashboardDateRangeOptions.some((option) => option.value === value);

const isOrderStatus = (value: string | undefined): value is OrderStatus =>
  dashboardOrderStatusOptions.includes(value as OrderStatus);

const isPaymentStatus = (value: string | undefined): value is PaymentStatus =>
  dashboardPaymentStatusOptions.includes(value as PaymentStatus);

const isDeliveryStatus = (value: string | undefined): value is DeliveryStatus =>
  dashboardDeliveryStatusOptions.includes(value as DeliveryStatus);

const isValidDateInput = (value: string | undefined) =>
  Boolean(value && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(new Date(`${value}T00:00:00`).getTime()));

export const parseAdminDashboardFilters = (
  params: Record<string, string | string[] | undefined>
): AdminDashboardFilters => {
  const dateRange = getParamValue(params, "range");
  const orderStatus = getParamValue(params, "orderStatus");
  const paymentStatus = getParamValue(params, "paymentStatus");
  const deliveryStatus = getParamValue(params, "deliveryStatus");
  const categoryId = getParamValue(params, "categoryId");
  const from = getParamValue(params, "from");
  const to = getParamValue(params, "to");

  return {
    dateRange: isDateRange(dateRange) ? dateRange : "last_30_days",
    from: isValidDateInput(from) ? from || "" : "",
    to: isValidDateInput(to) ? to || "" : "",
    orderStatus: isOrderStatus(orderStatus) ? orderStatus : "all",
    paymentStatus: isPaymentStatus(paymentStatus) ? paymentStatus : "all",
    deliveryStatus: isDeliveryStatus(deliveryStatus) ? deliveryStatus : "all",
    categoryId: categoryId || "all",
  };
};

const startOfDay = (value: Date) => {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  return date;
};

const endOfDay = (value: Date) => {
  const date = new Date(value);
  date.setHours(23, 59, 59, 999);
  return date;
};

const addDays = (value: Date, days: number) => {
  const date = new Date(value);
  date.setDate(date.getDate() + days);
  return date;
};

const dateInputToStart = (value: string) => startOfDay(new Date(`${value}T00:00:00`));
const dateInputToEnd = (value: string) => endOfDay(new Date(`${value}T00:00:00`));

const toDateInput = (value: Date) => value.toISOString().slice(0, 10);

const getInclusiveDays = (start: Date, end: Date) =>
  Math.max(1, Math.round((startOfDay(end).getTime() - startOfDay(start).getTime()) / 86_400_000) + 1);

const buildDateWindow = (
  filters: AdminDashboardFilters,
  now = new Date()
): DashboardDateWindow => {
  const todayStart = startOfDay(now);
  const todayEnd = endOfDay(now);
  let start = addDays(todayStart, -29);
  let end = todayEnd;
  let label = "30 derniers jours";
  let key = filters.dateRange;

  if (filters.dateRange === "today") {
    start = todayStart;
    end = todayEnd;
    label = "Aujourd'hui";
  } else if (filters.dateRange === "last_7_days") {
    start = addDays(todayStart, -6);
    end = todayEnd;
    label = "7 derniers jours";
  } else if (filters.dateRange === "current_month") {
    start = startOfDay(new Date(now.getFullYear(), now.getMonth(), 1));
    end = todayEnd;
    label = "Mois courant";
  } else if (filters.dateRange === "custom" && filters.from && filters.to) {
    const customStart = dateInputToStart(filters.from);
    const customEnd = dateInputToEnd(filters.to);

    start = customStart <= customEnd ? customStart : customEnd;
    end = customStart <= customEnd ? customEnd : customStart;
    label = `${toDateInput(start)} -> ${toDateInput(end)}`;
  } else {
    key = "last_30_days";
  }

  const days = getInclusiveDays(start, end);
  const previousEnd = new Date(start.getTime() - 1);
  const previousStart = startOfDay(addDays(start, -days));

  return {
    key,
    label,
    start,
    end,
    previousStart,
    previousEnd,
    days,
  };
};

const buildOrderWhere = (
  filters: AdminDashboardFilters,
  dateWindow?: Pick<DashboardDateWindow, "start" | "end">,
  dateField: DashboardOrderDateField = "orderDate"
): Prisma.OrderWhereInput => {
  const clauses: Prisma.OrderWhereInput[] = [];

  if (dateWindow) {
    const dateFilter = {
      gte: dateWindow.start,
      lte: dateWindow.end,
    };

    clauses.push(
      dateField === "statusChangedAt"
        ? {
            statusChangedAt: dateFilter,
          }
        : {
            orderDate: dateFilter,
          }
    );
  }

  if (filters.orderStatus !== "all") {
    clauses.push({ status: filters.orderStatus });
  }

  if (filters.paymentStatus !== "all") {
    clauses.push({ paymentStatus: filters.paymentStatus });
  }

  if (filters.deliveryStatus !== "all") {
    clauses.push({ deliveryStatus: filters.deliveryStatus });
  }

  if (filters.categoryId !== "all") {
    clauses.push({
      items: {
        some: {
          product: {
            is: {
              categories: {
                some: {
                  categoryId: filters.categoryId,
                },
              },
            },
          },
        },
      },
    });
  }

  return clauses.length ? { AND: clauses } : {};
};

const buildProductWhere = (filters: AdminDashboardFilters): Prisma.ProductWhereInput =>
  filters.categoryId === "all"
    ? {}
    : {
        categories: {
          some: {
            categoryId: filters.categoryId,
          },
        },
      };

const withPaidRevenue = (where: Prisma.OrderWhereInput): Prisma.OrderWhereInput => ({
  AND: [
    where,
    {
      paymentStatus: "paid",
      status: {
        not: "cancelled",
      },
    },
  ],
});

const withOrderClauses = (
  where: Prisma.OrderWhereInput,
  ...clauses: Prisma.OrderWhereInput[]
): Prisma.OrderWhereInput => ({
  AND: [where, ...clauses],
});

const getChangePct = (value: number, previousValue: number) => {
  if (previousValue === 0) {
    return value > 0 ? 100 : 0;
  }

  return ((value - previousValue) / previousValue) * 100;
};

const average = (values: number[]) =>
  values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;

const buildDashboardRevenueSeries = (
  orders: Array<{
    orderDate: Date;
    statusChangedAt: Date;
    paymentStatus: PaymentStatus;
    status: OrderStatus;
    totalPrice: Prisma.Decimal | number;
  }>,
  window: DashboardDateWindow
) => {
  const series = Array.from({ length: window.days }, (_, index) => {
    const date = addDays(window.start, index);

    return {
      date: getDashboardDateKey(date),
      label: timelineLabelFormatter.format(date),
      revenue: 0,
      orders: 0,
    };
  });
  const seriesByDate = new Map(series.map((entry) => [entry.date, entry]));

  orders.forEach((order) => {
    const bucket = seriesByDate.get(getDashboardDateKey(order.statusChangedAt));

    if (!bucket) {
      return;
    }

    bucket.orders += 1;

    if (order.paymentStatus === "paid" && order.status !== "cancelled") {
      bucket.revenue += decimalToNumber(order.totalPrice);
    }
  });

  return series;
};

const makeKpi = ({
  label,
  value,
  previousValue,
  helper,
  format,
  tone,
  invertTrend,
  trend,
}: Omit<DashboardKpi, "changePct">): DashboardKpi => ({
  label,
  value,
  previousValue,
  changePct: getChangePct(value, previousValue),
  helper,
  format,
  tone,
  invertTrend,
  trend,
});

async function fetchAdminOverviewData(
  filters: AdminDashboardFilters
): Promise<AdminOverviewData> {
  const now = new Date();
  const dateWindow = buildDateWindow(filters, now);
  const periodWhere = buildOrderWhere(filters, dateWindow, "statusChangedAt");
  const previousWhere = buildOrderWhere(
    filters,
    {
      start: dateWindow.previousStart,
      end: dateWindow.previousEnd,
    },
    "statusChangedAt"
  );
  const productWhere = buildProductWhere(filters);
  const todayWindow = {
    start: startOfDay(now),
    end: endOfDay(now),
  };
  const yesterday = addDays(now, -1);
  const previousDayWindow = {
    start: startOfDay(yesterday),
    end: endOfDay(yesterday),
  };
  const sevenDayWindow = {
    start: addDays(startOfDay(now), -6),
    end: endOfDay(now),
  };
  const previousSevenDayWindow = {
    start: addDays(startOfDay(now), -13),
    end: endOfDay(addDays(now, -7)),
  };
  const thirtyDayWindow = {
    start: addDays(startOfDay(now), -29),
    end: endOfDay(now),
  };
  const previousThirtyDayWindow = {
    start: addDays(startOfDay(now), -59),
    end: endOfDay(addDays(now, -30)),
  };
  const currentMonthWindow = {
    start: startOfDay(new Date(now.getFullYear(), now.getMonth(), 1)),
    end: endOfDay(now),
  };
  const previousMonthWindow = {
    start: startOfDay(new Date(now.getFullYear(), now.getMonth() - 1, 1)),
    end: endOfDay(new Date(now.getFullYear(), now.getMonth(), 0)),
  };
  const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const lateCutoff = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);
  const unconfirmedPaymentStatuses: PaymentStatus[] = ["pending", "partial", "failed"];
  const processStatuses: OrderStatus[] = ["pending", "processing", "paid"];
  const activeDeliveryStatuses: DeliveryStatus[] = ["in_transit", "out_for_delivery", "delayed"];
  const lateDeliveryClause: Prisma.OrderWhereInput = {
    OR: [
      { deliveryStatus: "delayed" },
      {
        status: {
          in: ["shipped", "out_for_delivery"],
        },
        orderDate: {
          lt: lateCutoff,
        },
      },
      {
        deliveryStatus: {
          in: activeDeliveryStatuses,
        },
        orderDate: {
          lt: lateCutoff,
        },
      },
    ],
  };

  const [
    totalOrders,
    previousTotalOrders,
    totalProducts,
    totalCategories,
    totalBrands,
    activePromoCodes,
    totalCustomers,
    selectedRevenueAggregate,
    previousRevenueAggregate,
    todayRevenueAggregate,
    previousTodayRevenueAggregate,
    sevenDayRevenueAggregate,
    previousSevenDayRevenueAggregate,
    thirtyDayRevenueAggregate,
    previousThirtyDayRevenueAggregate,
    currentMonthRevenueAggregate,
    previousCurrentMonthRevenueAggregate,
    selectedOrderAggregate,
    previousOrderAggregate,
    paidOrders,
    previousPaidOrders,
    unpaidOrders,
    cancelledOrders,
    previousCancelledOrders,
    lateOrders,
    previousLateOrders,
    ordersToProcess,
    pendingMoreThan24h,
    unconfirmedPayments,
    outOfStockProducts,
    lowStockProducts,
    criticalStockProducts,
    orderStatusGroups,
    paymentStatusGroups,
    recentOrders,
    lowStockItems,
    recentCustomers,
    expiringPromoCodes,
    chartOrders,
    categoryOrderItems,
    topProducts,
    categories,
    durationOrders,
  ] = await Promise.all([
    prisma.order.count({ where: periodWhere }),
    prisma.order.count({ where: previousWhere }),
    prisma.product.count({ where: productWhere }),
    prisma.category.count(),
    prisma.brand.count(),
    prisma.promoCode.count({
      where: {
        active: true,
      },
    }),
    prisma.user.count(),
    prisma.order.aggregate({
      where: withPaidRevenue(periodWhere),
      _sum: {
        totalPrice: true,
      },
    }),
    prisma.order.aggregate({
      where: withPaidRevenue(previousWhere),
      _sum: {
        totalPrice: true,
      },
    }),
    prisma.order.aggregate({
      where: withPaidRevenue(
        buildOrderWhere(filters, todayWindow, "statusChangedAt")
      ),
      _sum: {
        totalPrice: true,
      },
    }),
    prisma.order.aggregate({
      where: withPaidRevenue(
        buildOrderWhere(filters, previousDayWindow, "statusChangedAt")
      ),
      _sum: {
        totalPrice: true,
      },
    }),
    prisma.order.aggregate({
      where: withPaidRevenue(
        buildOrderWhere(filters, sevenDayWindow, "statusChangedAt")
      ),
      _sum: {
        totalPrice: true,
      },
    }),
    prisma.order.aggregate({
      where: withPaidRevenue(
        buildOrderWhere(filters, previousSevenDayWindow, "statusChangedAt")
      ),
      _sum: {
        totalPrice: true,
      },
    }),
    prisma.order.aggregate({
      where: withPaidRevenue(
        buildOrderWhere(filters, thirtyDayWindow, "statusChangedAt")
      ),
      _sum: {
        totalPrice: true,
      },
    }),
    prisma.order.aggregate({
      where: withPaidRevenue(
        buildOrderWhere(filters, previousThirtyDayWindow, "statusChangedAt")
      ),
      _sum: {
        totalPrice: true,
      },
    }),
    prisma.order.aggregate({
      where: withPaidRevenue(
        buildOrderWhere(filters, currentMonthWindow, "statusChangedAt")
      ),
      _sum: {
        totalPrice: true,
      },
    }),
    prisma.order.aggregate({
      where: withPaidRevenue(
        buildOrderWhere(filters, previousMonthWindow, "statusChangedAt")
      ),
      _sum: {
        totalPrice: true,
      },
    }),
    prisma.order.aggregate({
      where: periodWhere,
      _avg: {
        totalPrice: true,
      },
    }),
    prisma.order.aggregate({
      where: previousWhere,
      _avg: {
        totalPrice: true,
      },
    }),
    prisma.order.count({
      where: withOrderClauses(periodWhere, { paymentStatus: "paid" }),
    }),
    prisma.order.count({
      where: withOrderClauses(previousWhere, { paymentStatus: "paid" }),
    }),
    prisma.order.count({
      where: withOrderClauses(periodWhere, {
        paymentStatus: {
          not: "paid",
        },
      }),
    }),
    prisma.order.count({
      where: withOrderClauses(periodWhere, { status: "cancelled" }),
    }),
    prisma.order.count({
      where: withOrderClauses(previousWhere, { status: "cancelled" }),
    }),
    prisma.order.count({
      where: withOrderClauses(periodWhere, lateDeliveryClause),
    }),
    prisma.order.count({
      where: withOrderClauses(previousWhere, lateDeliveryClause),
    }),
    prisma.order.count({
      where: withOrderClauses(periodWhere, {
        status: {
          in: processStatuses,
        },
      }),
    }),
    prisma.order.count({
      where: withOrderClauses(periodWhere, {
        status: {
          in: processStatuses,
        },
        orderDate: {
          lt: twentyFourHoursAgo,
        },
      }),
    }),
    prisma.order.count({
      where: withOrderClauses(periodWhere, {
        paymentStatus: {
          in: unconfirmedPaymentStatuses,
        },
      }),
    }),
    prisma.product.count({
      where: {
        ...productWhere,
        stock: {
          lte: 0,
        },
      },
    }),
    prisma.product.count({
      where: {
        ...productWhere,
        stock: {
          gt: 0,
          lte: 5,
        },
      },
    }),
    prisma.product.count({
      where: {
        ...productWhere,
        stock: {
          gt: 0,
          lte: 2,
        },
      },
    }),
    prisma.order.groupBy({
      by: ["status"],
      where: periodWhere,
      _count: {
        status: true,
      },
    }),
    prisma.order.groupBy({
      by: ["paymentStatus"],
      where: periodWhere,
      _count: {
        paymentStatus: true,
      },
    }),
    prisma.order.findMany({
      where: periodWhere,
      orderBy: {
        orderDate: "desc",
      },
      include: {
        items: {
          orderBy: {
            createdAt: "asc",
          },
          select: {
            id: true,
            productNameSnapshot: true,
            productImageUrlSnapshot: true,
            productPriceSnapshot: true,
            quantity: true,
            product: {
              select: {
                stock: true,
              },
            },
          },
        },
      },
      take: 80,
    }),
    prisma.product.findMany({
      where: {
        ...productWhere,
        stock: {
          lte: 5,
        },
      },
      orderBy: [
        {
          stock: "asc",
        },
        {
          updatedAt: "desc",
        },
      ],
      select: {
        id: true,
        name: true,
        stock: true,
        lastRestockedAt: true,
        images: {
          orderBy: {
            sortOrder: "asc",
          },
          select: {
            url: true,
          },
          take: 1,
        },
      },
      take: 8,
    }),
    prisma.user.findMany({
      orderBy: {
        createdAt: "desc",
      },
      include: {
        orders: {
          orderBy: {
            orderDate: "desc",
          },
          select: {
            orderDate: true,
            paymentStatus: true,
            totalPrice: true,
          },
        },
        _count: {
          select: {
            orders: true,
          },
        },
      },
      take: 6,
    }),
    prisma.promoCode.count({
      where: {
        active: true,
        endsAt: {
          gte: new Date(),
          lte: sevenDaysFromNow(),
        },
      },
    }),
    prisma.order.findMany({
      where: periodWhere,
      orderBy: {
        orderDate: "asc",
      },
      select: {
        orderDate: true,
        statusChangedAt: true,
        paymentStatus: true,
        totalPrice: true,
        status: true,
      },
    }),
    prisma.orderItem.findMany({
      where: {
        order: periodWhere,
        ...(filters.categoryId !== "all"
          ? {
              product: {
                is: {
                  categories: {
                    some: {
                      categoryId: filters.categoryId,
                    },
                  },
                },
              },
            }
          : {}),
      },
      select: {
        quantity: true,
        productPriceSnapshot: true,
        product: {
          select: {
            categories: {
              select: {
                category: {
                  select: {
                    title: true,
                  },
                },
              },
            },
          },
        },
      },
      take: 500,
    }),
    prisma.orderItem.groupBy({
      by: ["productNameSnapshot"],
      where: {
        order: periodWhere,
      },
      _sum: {
        quantity: true,
      },
      _count: {
        _all: true,
      },
      orderBy: {
        _sum: {
          quantity: "desc",
        },
      },
      take: 5,
    }),
    prisma.category.findMany({
      orderBy: {
        title: "asc",
      },
      select: {
        id: true,
        title: true,
      },
    }),
    prisma.order.findMany({
      where: periodWhere,
      select: {
        orderDate: true,
        updatedAt: true,
        status: true,
        deliveryStatus: true,
      },
      take: 500,
    }),
  ]);

  const selectedRevenue = decimalToNumber(selectedRevenueAggregate._sum.totalPrice);
  const previousRevenue = decimalToNumber(previousRevenueAggregate._sum.totalPrice);
  const selectedAverageBasket = decimalToNumber(selectedOrderAggregate._avg.totalPrice);
  const previousAverageBasket = decimalToNumber(previousOrderAggregate._avg.totalPrice);
  const orderStageBreakdown = buildOrderStageBreakdown(
    buildOrderCountsMap(orderStatusGroups)
  );
  const revenueSeries = buildDashboardRevenueSeries(chartOrders, dateWindow);
  const stockOutRate = totalProducts ? (outOfStockProducts / totalProducts) * 100 : 0;
  const conversionRate = totalOrders ? (paidOrders / totalOrders) * 100 : 0;
  const previousConversionRate =
    previousTotalOrders ? (previousPaidOrders / previousTotalOrders) * 100 : 0;
  const cancellationRate = totalOrders ? (cancelledOrders / totalOrders) * 100 : 0;
  const previousCancellationRate =
    previousTotalOrders ? (previousCancelledOrders / previousTotalOrders) * 100 : 0;

  const preparationDurations = durationOrders
    .filter((order) => ["paid", "shipped", "out_for_delivery", "delivered"].includes(order.status))
    .map((order) => Math.max(0, order.updatedAt.getTime() - order.orderDate.getTime()) / 3_600_000);
  const deliveryDurations = durationOrders
    .filter((order) =>
      ["shipped", "out_for_delivery", "delivered"].includes(order.status) ||
      ["in_transit", "out_for_delivery", "delivered"].includes(order.deliveryStatus)
    )
    .map((order) => Math.max(0, order.updatedAt.getTime() - order.orderDate.getTime()) / 3_600_000);
  const averagePreparationHours = average(preparationDurations);
  const averageDeliveryHours = average(deliveryDurations);

  const categoryMap = new Map<string, { category: string; orders: number; revenue: number }>();
  categoryOrderItems.forEach((item) => {
    const categoryTitles = item.product?.categories.length
      ? item.product.categories.map((entry) => entry.category.title)
      : ["Sans categorie"];

    categoryTitles.forEach((title) => {
      const current = categoryMap.get(title) || {
        category: title,
        orders: 0,
        revenue: 0,
      };

      current.orders += item.quantity;
      current.revenue += item.quantity * decimalToNumber(item.productPriceSnapshot);
      categoryMap.set(title, current);
    });
  });

  const financialKpis: DashboardKpi[] = [
    makeKpi({
      label: "Revenus aujourd'hui",
      value: decimalToNumber(todayRevenueAggregate._sum.totalPrice),
      previousValue: decimalToNumber(previousTodayRevenueAggregate._sum.totalPrice),
      helper: "Compare avec la veille.",
      format: "currency",
      tone: "success",
      trend: revenueSeries.map((point) => point.revenue),
    }),
    makeKpi({
      label: "Revenus 7 jours",
      value: decimalToNumber(sevenDayRevenueAggregate._sum.totalPrice),
      previousValue: decimalToNumber(previousSevenDayRevenueAggregate._sum.totalPrice),
      helper: "Compare avec les 7 jours precedents.",
      format: "currency",
      tone: "info",
      trend: revenueSeries.map((point) => point.revenue),
    }),
    makeKpi({
      label: "Revenus 30 jours",
      value: decimalToNumber(thirtyDayRevenueAggregate._sum.totalPrice),
      previousValue: decimalToNumber(previousThirtyDayRevenueAggregate._sum.totalPrice),
      helper: "Compare avec les 30 jours precedents.",
      format: "currency",
      tone: "info",
      trend: revenueSeries.map((point) => point.revenue),
    }),
    makeKpi({
      label: "Revenus mois courant",
      value: decimalToNumber(currentMonthRevenueAggregate._sum.totalPrice),
      previousValue: decimalToNumber(previousCurrentMonthRevenueAggregate._sum.totalPrice),
      helper: "Compare avec le mois precedent.",
      format: "currency",
      tone: "success",
      trend: revenueSeries.map((point) => point.revenue),
    }),
    makeKpi({
      label: filters.dateRange === "custom" ? "Revenus periode custom" : "Revenus periode",
      value: selectedRevenue,
      previousValue: previousRevenue,
      helper: `Fenetre active: ${dateWindow.label}.`,
      format: "currency",
      tone: "neutral",
      trend: revenueSeries.map((point) => point.revenue),
    }),
  ];

  const orderKpis: DashboardKpi[] = [
    makeKpi({
      label: "Nombre de commandes",
      value: totalOrders,
      previousValue: previousTotalOrders,
      helper: "Commandes creees dans la periode active.",
      format: "number",
      tone: "info",
      trend: revenueSeries.map((point) => point.orders),
    }),
    makeKpi({
      label: "Commandes payees",
      value: paidOrders,
      previousValue: previousPaidOrders,
      helper: "Paiements marques comme regles.",
      format: "number",
      tone: "success",
      trend: [previousPaidOrders, paidOrders],
    }),
    makeKpi({
      label: "Commandes non payees",
      value: unpaidOrders,
      previousValue: 0,
      helper: "Inclut attente, partiel, echec et remboursement.",
      format: "number",
      tone: "warning",
      invertTrend: true,
      trend: [0, unpaidOrders],
    }),
    makeKpi({
      label: "Commandes annulees",
      value: cancelledOrders,
      previousValue: previousCancelledOrders,
      helper: "A surveiller avec le taux d'annulation.",
      format: "number",
      tone: "danger",
      invertTrend: true,
      trend: [previousCancelledOrders, cancelledOrders],
    }),
    makeKpi({
      label: "Commandes en retard",
      value: lateOrders,
      previousValue: previousLateOrders,
      helper: "Expeditions actives au-dela de 72h ou marquees en retard.",
      format: "number",
      tone: "danger",
      invertTrend: true,
      trend: [previousLateOrders, lateOrders],
    }),
  ];

  const performanceKpis: DashboardKpi[] = [
    makeKpi({
      label: "Panier moyen",
      value: selectedAverageBasket,
      previousValue: previousAverageBasket,
      helper: "Moyenne des totaux de commande.",
      format: "currency",
      tone: "success",
      trend: [previousAverageBasket, selectedAverageBasket],
    }),
    makeKpi({
      label: "Conversion paiement",
      value: conversionRate,
      previousValue: previousConversionRate,
      helper: "Part des commandes payees dans la periode.",
      format: "percent",
      tone: "info",
      trend: [previousConversionRate, conversionRate],
    }),
    makeKpi({
      label: "Taux d'annulation",
      value: cancellationRate,
      previousValue: previousCancellationRate,
      helper: "Part des commandes annulees.",
      format: "percent",
      tone: "danger",
      invertTrend: true,
      trend: [previousCancellationRate, cancellationRate],
    }),
    makeKpi({
      label: "Preparation moyenne",
      value: averagePreparationHours,
      previousValue: averagePreparationHours,
      helper: "Estime depuis la derniere mise a jour de commande.",
      format: "duration",
      tone: "warning",
      invertTrend: true,
      trend: preparationDurations.slice(-8),
    }),
    makeKpi({
      label: "Livraison moyenne",
      value: averageDeliveryHours,
      previousValue: averageDeliveryHours,
      helper: "Estime depuis les commandes expediees.",
      format: "duration",
      tone: "warning",
      invertTrend: true,
      trend: deliveryDurations.slice(-8),
    }),
    makeKpi({
      label: "Taux de rupture",
      value: stockOutRate,
      previousValue: stockOutRate,
      helper: "Produits en rupture sur le catalogue filtre.",
      format: "percent",
      tone: "danger",
      invertTrend: true,
      trend: [stockOutRate],
    }),
  ];

  return {
    filters: {
      ...filters,
      dateRange: dateWindow.key,
      from: filters.from || toDateInput(dateWindow.start),
      to: filters.to || toDateInput(dateWindow.end),
    },
    dateWindow: {
      label: dateWindow.label,
      start: dateWindow.start.toISOString(),
      end: dateWindow.end.toISOString(),
      previousStart: dateWindow.previousStart.toISOString(),
      previousEnd: dateWindow.previousEnd.toISOString(),
    },
    filterOptions: {
      dateRanges: dashboardDateRangeOptions,
      orderStatuses: [
        { value: "all", label: "Tous les statuts" },
        ...dashboardOrderStatusOptions.map((value) => ({
          value,
          label: value,
        })),
      ],
      paymentStatuses: [
        { value: "all", label: "Tous les paiements" },
        ...dashboardPaymentStatusOptions.map((value) => ({
          value,
          label: value,
        })),
      ],
      deliveryStatuses: [
        { value: "all", label: "Toutes les livraisons" },
        ...dashboardDeliveryStatusOptions.map((value) => ({
          value,
          label: value,
        })),
      ],
      categories,
    },
    metrics: {
      totalRevenue: selectedRevenue,
      totalOrders,
      pendingOrders: ordersToProcess,
      totalProducts,
      totalCategories,
      totalBrands,
      activePromoCodes,
      expiringPromoCodes,
      lowStockProducts,
      totalCustomers,
    },
    operationalAlerts: [
      {
        key: "orders",
        label: "Commandes a traiter",
        value: ordersToProcess,
        helper: "En attente, confirmees ou en preparation.",
        href: "/admin/orders?stage=priority#orders-list",
        tone: ordersToProcess > 0 ? "warning" : "success",
      },
      {
        key: "stock",
        label: "Produits en rupture",
        value: outOfStockProducts,
        helper: "A reapprovisionner avant nouvelles ventes.",
        href: "/admin/products?stock=out#products-list",
        tone: outOfStockProducts > 0 ? "danger" : "success",
      },
      {
        key: "payments",
        label: "Paiements non confirmes",
        value: unconfirmedPayments,
        helper: "Paiements en attente, partiels ou bloques.",
        href: "/admin/orders?paymentStatus=pending#orders-list",
        tone: unconfirmedPayments > 0 ? "danger" : "success",
      },
      {
        key: "deliveries",
        label: "Livraisons en retard",
        value: lateOrders,
        helper: "Expeditions actives au-dela de 72h.",
        href: "/admin/orders?deliveryStatus=delayed#orders-list",
        tone: lateOrders > 0 ? "warning" : "success",
      },
    ],
    priorityTasks: [
      {
        label: "Commandes en attente de traitement",
        value: ordersToProcess,
        helper: "Ouvrir la file prioritaire.",
        href: "/admin/orders?stage=priority#orders-list",
        tone: "warning",
      },
      {
        label: "Produits en rupture",
        value: outOfStockProducts,
        helper: "Verifier le stock et relancer l'approvisionnement.",
        href: "/admin/products?stock=out#products-list",
        tone: "danger",
      },
      {
        label: "Commandes bloquees depuis 24h",
        value: pendingMoreThan24h,
        helper: "Priorite bureau validation.",
        href: "/admin/orders?age=24h&stage=priority#orders-list",
        tone: "danger",
      },
      {
        label: "Paiements non confirmes",
        value: unconfirmedPayments,
        helper: "Controler les moyens de paiement.",
        href: "/admin/orders?paymentStatus=pending#orders-list",
        tone: "warning",
      },
      {
        label: "Livraisons retardees",
        value: lateOrders,
        helper: "Contacter transporteur ou livreur.",
        href: "/admin/orders?deliveryStatus=delayed#orders-list",
        tone: "warning",
      },
    ],
    businessKpis: {
      financial: financialKpis,
      orders: orderKpis,
      performance: performanceKpis,
    },
    analytics: {
      revenueSeries,
      paidVsUnpaid: paymentStatusGroups.map((item) => ({
        status: item.paymentStatus,
        count: item._count.paymentStatus,
      })),
      ordersByStatus: orderStatusGroups.map((item) => ({
        status: item.status,
        count: item._count.status,
      })),
      ordersByCategory: Array.from(categoryMap.values())
        .sort((a, b) => b.orders - a.orders)
        .slice(0, 8),
    },
    inventorySummary: {
      outOfStock: outOfStockProducts,
      lowStock: lowStockProducts,
      criticalStock: criticalStockProducts,
      stockOutRate,
    },
    orderStageBreakdown,
    recentOrders: mapOrders(recentOrders),
    recentCustomers: mapCustomers(recentCustomers),
    lowStockItems: mapLowStockItems(lowStockItems),
    revenueSeries,
    topProducts: topProducts.map((item) => ({
      name: item.productNameSnapshot,
      unitsSold: item._sum.quantity || 0,
      ordersCount: item._count._all,
    })),
  };
}

export async function getAdminOverviewData(
  filters: AdminDashboardFilters = parseAdminDashboardFilters({})
): Promise<AdminOverviewData> {
  await requireAdmin();
  const data = await fetchAdminOverviewData(filters);

  return {
    ...data,
    recentOrders: normalizeOrders(data.recentOrders),
    recentCustomers: normalizeCustomers(data.recentCustomers),
    lowStockItems: data.lowStockItems.map((item) => ({
      ...item,
      lastRestockedAt: toDate(item.lastRestockedAt),
    })),
  };
}

export type AdminOrdersPageData = {
  metrics: {
    totalOrders: number;
    pendingOrders: number;
    paidOrders: number;
    totalRevenue: number;
  };
  staleOrderCutoff: string;
  orderStageBreakdown: AdminDashboardData["orderStageBreakdown"];
  paymentStatusBreakdown: AdminDashboardData["paymentStatusBreakdown"];
  orders: AdminDashboardData["orders"];
};

async function fetchAdminOrdersPageData(): Promise<AdminOrdersPageData> {
  const [totalOrders, paidRevenueAggregate, orderStatusGroups, paymentStatusGroups, orders] =
    await Promise.all([
      prisma.order.count(),
      prisma.order.aggregate({
        where: {
          paymentStatus: "paid",
        },
        _sum: {
          totalPrice: true,
        },
      }),
      prisma.order.groupBy({
        by: ["status"],
        _count: {
          status: true,
        },
      }),
      prisma.order.groupBy({
        by: ["paymentStatus"],
        _count: {
          paymentStatus: true,
        },
      }),
      prisma.order.findMany({
        orderBy: {
          orderDate: "desc",
        },
        include: {
          items: {
            orderBy: {
              createdAt: "asc",
            },
            select: {
              id: true,
              productNameSnapshot: true,
              productImageUrlSnapshot: true,
              productPriceSnapshot: true,
              quantity: true,
              product: {
                select: {
                  stock: true,
                },
              },
            },
          },
        },
        take: 60,
      }),
    ]);

  const orderStageBreakdown = buildOrderStageBreakdown(
    buildOrderCountsMap(orderStatusGroups)
  );

  return {
    metrics: {
      totalOrders,
      pendingOrders: getPendingOrdersCount(orderStageBreakdown),
      paidOrders:
        paymentStatusGroups.find((item) => item.paymentStatus === "paid")?._count
          .paymentStatus || 0,
      totalRevenue: decimalToNumber(paidRevenueAggregate._sum.totalPrice),
    },
    staleOrderCutoff: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
    orderStageBreakdown,
    paymentStatusBreakdown: paymentStatusGroups.map((item) => ({
      status: item.paymentStatus,
      count: item._count.paymentStatus,
    })),
    orders: mapOrders(orders),
  };
}

const getCachedAdminOrdersPageData = unstable_cache(
  fetchAdminOrdersPageData,
  ["admin-orders-page-data"],
  {
    tags: [adminDataTag],
    revalidate: 120,
  }
);

export async function getAdminOrdersPageData(): Promise<AdminOrdersPageData> {
  await requireAdmin();
  const data = await getCachedAdminOrdersPageData();

  return {
    ...data,
    orders: normalizeOrders(data.orders),
  };
}

export type AdminProductsPageData = {
  metrics: {
    totalProducts: number;
    featuredProducts: number;
    lowStockProducts: number;
    totalBrands: number;
    totalCategories: number;
  };
  products: AdminDashboardData["products"];
  brands: AdminDashboardData["brands"];
  categories: AdminDashboardData["categories"];
  lowStockItems: AdminDashboardData["lowStockItems"];
};

async function fetchAdminProductsPageData(
  productBrandId = "",
  productCategoryId = ""
): Promise<AdminProductsPageData> {
  const productFilters: Prisma.ProductWhereInput[] = [];
  if (productBrandId === "unassigned") productFilters.push({ brandId: null });
  else if (productBrandId) productFilters.push({ brandId: productBrandId });
  if (productCategoryId === "unassigned") {
    productFilters.push({
      categories: { none: { category: { archivedAt: null, isActive: true } } },
    });
  } else if (productCategoryId) {
    productFilters.push({ categories: { some: { categoryId: productCategoryId } } });
  }
  const [
    totalProducts,
    featuredProducts,
    lowStockProducts,
    totalBrands,
    totalCategories,
    products,
    brands,
    categories,
    lowStockItems,
  ] = await Promise.all([
    prisma.product.count(),
    prisma.product.count({
      where: {
        isFeatured: true,
      },
    }),
    prisma.product.count({
      where: {
        stock: {
          lte: 5,
        },
      },
    }),
    prisma.brand.count(),
    prisma.category.count(),
    prisma.product.findMany({
      where: productFilters.length ? { AND: productFilters } : {},
      orderBy: {
        updatedAt: "desc",
      },
      select: {
        id: true,
        name: true,
        description: true,
        price: true,
        discount: true,
        stock: true,
        lastRestockedAt: true,
        status: true,
        isFeatured: true,
        brandId: true,
        updatedAt: true,
        brand: {
          select: {
            title: true,
          },
        },
        images: {
          orderBy: {
            sortOrder: "asc",
          },
          select: {
            url: true,
          },
        },
        categories: {
          include: {
            category: {
              select: {
                id: true,
                title: true,
              },
            },
          },
        },
      },
      take: 24,
    }),
    prisma.brand.findMany({
      orderBy: {
        title: "asc",
      },
      select: {
        id: true,
        title: true,
        description: true,
        imageUrl: true,
        isActive: true,
        archivedAt: true,
        updatedAt: true,
        _count: {
          select: {
            products: true,
          },
        },
      },
    }),
    prisma.category.findMany({
      where: { archivedAt: null },
      orderBy: {
        title: "asc",
      },
      select: {
        id: true,
        title: true,
        description: true,
        featured: true,
        imageUrl: true,
        updatedAt: true,
        _count: {
          select: {
            products: true,
          },
        },
      },
    }),
    prisma.product.findMany({
      where: {
        stock: {
          lte: 5,
        },
      },
      orderBy: [
        {
          stock: "asc",
        },
        {
          updatedAt: "desc",
        },
      ],
      select: {
        id: true,
        name: true,
        stock: true,
        lastRestockedAt: true,
        images: {
          orderBy: {
            sortOrder: "asc",
          },
          select: {
            url: true,
          },
          take: 1,
        },
      },
      take: 6,
    }),
  ]);

  return {
    metrics: {
      totalProducts,
      featuredProducts,
      lowStockProducts,
      totalBrands,
      totalCategories,
    },
    products: mapProducts(products),
    brands: mapBrands(brands),
    categories: mapCategories(categories),
    lowStockItems: mapLowStockItems(lowStockItems),
  };
}

const getCachedAdminProductsPageData = unstable_cache(
  fetchAdminProductsPageData,
  ["admin-products-page-data"],
  {
    tags: [adminDataTag],
    revalidate: 120,
  }
);

export async function getAdminProductsPageData(
  options: { brandId?: string; categoryId?: string } = {}
): Promise<AdminProductsPageData> {
  await requireAdmin();
  const data = await getCachedAdminProductsPageData(
    options.brandId || "",
    options.categoryId || ""
  );

  return {
    ...data,
    products: normalizeProducts(data.products),
    brands: normalizeBrands(data.brands),
    categories: normalizeCategories(data.categories),
    lowStockItems: data.lowStockItems.map((item) => ({
      ...item,
      lastRestockedAt: toDate(item.lastRestockedAt),
    })),
  };
}

export type AdminCategoriesPageData = {
  metrics: {
    totalCategories: number;
    featuredCategories: number;
    totalProducts: number;
  };
  categories: AdminDashboardData["categories"];
};

async function fetchAdminCategoriesPageData(): Promise<AdminCategoriesPageData> {
  const [totalCategories, featuredCategories, totalProducts, categories] = await Promise.all([
    prisma.category.count(),
    prisma.category.count({
      where: {
        featured: true,
      },
    }),
    prisma.product.count(),
    prisma.category.findMany({
      orderBy: [{ range: "asc" }, { title: "asc" }],
      select: {
        id: true,
        title: true,
        range: true,
        description: true,
        featured: true,
        imageUrl: true,
        updatedAt: true,
        _count: {
          select: {
            products: true,
          },
        },
      },
    }),
  ]);

  return {
    metrics: {
      totalCategories,
      featuredCategories,
      totalProducts,
    },
    categories: mapCategories(categories),
  };
}

const getCachedAdminCategoriesPageData = unstable_cache(
  fetchAdminCategoriesPageData,
  ["admin-categories-page-data"],
  {
    tags: [adminDataTag],
    revalidate: 120,
  }
);

export async function getAdminCategoriesPageData(): Promise<AdminCategoriesPageData> {
  await requireAdmin();
  let data: AdminCategoriesPageData;

  try {
    data = await getCachedAdminCategoriesPageData();
  } catch (error) {
    if (!isDatabaseUnavailableError(error)) {
      throw error;
    }

    console.error(
      "Admin categories page: database unavailable, returning empty fallback.",
      error
    );

    return {
      metrics: {
        totalCategories: 0,
        featuredCategories: 0,
        totalProducts: 0,
      },
      categories: [],
    };
  }

  return {
    ...data,
    categories: normalizeCategories(data.categories),
  };
}

export type AdminBrandFilters = {
  query: string;
  status: "all" | "active" | "inactive" | "archived";
  association: "all" | "with-products" | "without-products";
  sort: "a-z" | "z-a";
  page: number;
};

export const parseAdminBrandFilters = (
  params: Record<string, string | string[] | undefined>
): AdminBrandFilters => {
  const status = getParamValue(params, "brandStatus");
  const association = getParamValue(params, "association");
  const sort = getParamValue(params, "sort");
  const rawPage = Number.parseInt(getParamValue(params, "page") || "1", 10);

  return {
    query: (getParamValue(params, "q") || "").trim().slice(0, 100),
    status: ["active", "inactive", "archived"].includes(status || "")
      ? (status as AdminBrandFilters["status"])
      : "all",
    association: ["with-products", "without-products"].includes(association || "")
      ? (association as AdminBrandFilters["association"])
      : "all",
    sort: sort === "z-a" ? "z-a" : "a-z",
    page: Number.isFinite(rawPage) && rawPage > 0 ? rawPage : 1,
  };
};

export type AdminBrandListItem = {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  imageUrl: string | null;
  isActive: boolean;
  archivedAt: Date | null;
  archivedBy: string | null;
  updatedAt: Date;
  productCount: number;
  products: Array<{ id: string; name: string }>;
};

export type AdminBrandsPageData = {
  metrics: {
    totalBrands: number;
    activeBrands: number;
    brandsWithoutProducts: number;
    brandsWithoutLogo: number;
    brandlessProducts: number;
    archivedBrands: number;
  };
  brands: AdminBrandListItem[];
  duplicateGroups: Array<Array<{ id: string; title: string }>>;
  pagination: {
    currentPage: number;
    totalPages: number;
    pageSize: number;
    filteredCount: number;
  };
};

export async function getAdminBrandsPageData(
  filters: AdminBrandFilters
): Promise<AdminBrandsPageData> {
  await requireAdmin();

  const clauses: Prisma.BrandWhereInput[] = [];

  if (filters.query) {
    clauses.push({ title: { contains: filters.query, mode: "insensitive" } });
  }

  if (filters.status === "active") {
    clauses.push({ archivedAt: null, isActive: true });
  } else if (filters.status === "inactive") {
    clauses.push({ archivedAt: null, isActive: false });
  } else if (filters.status === "archived") {
    clauses.push({ archivedAt: { not: null } });
  }

  if (filters.association === "with-products") {
    clauses.push({ products: { some: {} } });
  } else if (filters.association === "without-products") {
    clauses.push({ products: { none: {} } });
  }

  const where: Prisma.BrandWhereInput = clauses.length ? { AND: clauses } : {};
  const pageSize = 10;

  const [
    totalBrands,
    activeBrands,
    brandsWithoutProducts,
    brandsWithoutLogo,
    brandlessProducts,
    archivedBrands,
    filteredCount,
    duplicateCandidates,
  ] = await Promise.all([
    prisma.brand.count(),
    prisma.brand.count({ where: { archivedAt: null, isActive: true } }),
    prisma.brand.count({ where: { archivedAt: null, products: { none: {} } } }),
    prisma.brand.count({
      where: {
        archivedAt: null,
        OR: [{ imageUrl: null }, { imageUrl: "" }],
      },
    }),
    prisma.product.count({ where: { brandId: null } }),
    prisma.brand.count({ where: { archivedAt: { not: null } } }),
    prisma.brand.count({ where }),
    prisma.brand.findMany({ select: { id: true, title: true } }),
  ]);

  const totalPages = Math.max(1, Math.ceil(filteredCount / pageSize));
  const currentPage = Math.min(filters.page, totalPages);
  const brands = await prisma.brand.findMany({
    where,
    orderBy: { title: filters.sort === "z-a" ? "desc" : "asc" },
    skip: (currentPage - 1) * pageSize,
    take: pageSize,
    select: {
      id: true,
      title: true,
      slug: true,
      description: true,
      imageUrl: true,
      isActive: true,
      archivedAt: true,
      archivedBy: true,
      updatedAt: true,
      products: {
        orderBy: { name: "asc" },
        take: 3,
        select: { id: true, name: true },
      },
      _count: { select: { products: true } },
    },
  });

  return {
    metrics: {
      totalBrands,
      activeBrands,
      brandsWithoutProducts,
      brandsWithoutLogo,
      brandlessProducts,
      archivedBrands,
    },
    brands: brands.map((brand) => ({
      id: brand.id,
      title: brand.title,
      slug: brand.slug,
      description: brand.description,
      imageUrl: brand.imageUrl,
      isActive: brand.isActive,
      archivedAt: brand.archivedAt,
      archivedBy: brand.archivedBy,
      updatedAt: brand.updatedAt,
      productCount: brand._count.products,
      products: brand.products,
    })),
    duplicateGroups: getPotentialBrandDuplicateGroups(duplicateCandidates),
    pagination: {
      currentPage,
      totalPages,
      pageSize,
      filteredCount,
    },
  };
}

export type AdminHomepagePageData = {
  metrics: {
    heroSlides: number;
    trustItems: number;
    headerLinks: number;
    footerLinks: number;
    socialLinks: number;
    newsletterSubscribers: number;
  };
  settings: {
    announcementEnabled: boolean;
    announcementText: string;
    announcementHref: string | null;
    heroAutoplayMs: number;
    featuredCategoriesTitle: string;
    featuredCategoriesSubtitle: string;
    promotionsTitle: string;
    promotionsSubtitle: string;
    bestSellersTitle: string;
    bestSellersSubtitle: string;
    newArrivalsTitle: string;
    newArrivalsSubtitle: string;
    brandsTitle: string;
    brandsSubtitle: string;
    trustTitle: string;
    trustSubtitle: string;
    loyaltyBadge: string;
    loyaltyTitle: string;
    loyaltyDescription: string;
    loyaltyCtaLabel: string;
    loyaltyCtaHref: string;
    loyaltyHighlightText: string;
    loyaltyImageUrl: string | null;
    newsletterTitle: string;
    newsletterDescription: string;
    newsletterPlaceholder: string;
    newsletterButtonLabel: string;
    newsletterSuccessMessage: string;
    newsletterErrorMessage: string;
    footerAboutTitle: string;
    footerAboutDescription: string;
    footerQuickLinksTitle: string;
    footerLegalLinksTitle: string;
    footerCategoriesTitle: string;
    footerContactPhone: string | null;
    footerContactEmail: string | null;
    footerContactHours: string | null;
    footerCopyrightText: string;
    featuredCategoriesLimit: number;
    promotionsLimit: number;
    bestSellersLimit: number;
    newArrivalsLimit: number;
    brandsLimit: number;
  };
  heroSlides: Array<{
    id: string;
    badge: string | null;
    title: string;
    subtitle: string | null;
    ctaLabel: string | null;
    ctaHref: string | null;
    imageUrl: string | null;
    altText: string | null;
    sortOrder: number;
    isActive: boolean;
  }>;
  trustItems: Array<{
    id: string;
    title: string;
    description: string;
    icon: string;
    sortOrder: number;
    isActive: boolean;
  }>;
  links: Array<{
    id: string;
    group: "header" | "footer_quick" | "footer_legal";
    title: string;
    href: string;
    sortOrder: number;
    openInNewTab: boolean;
  }>;
  socialLinks: Array<{
    id: string;
    platform: string;
    title: string;
    href: string;
    sortOrder: number;
    openInNewTab: boolean;
  }>;
};

const defaultHomepageSettings: AdminHomepagePageData["settings"] = {
  announcementEnabled: true,
  announcementText: "Livraison gratuite partout au Maroc des 299 MAD d'achat.",
  announcementHref: "/shop",
  heroAutoplayMs: 5000,
  featuredCategoriesTitle: "Categories en vedette",
  featuredCategoriesSubtitle: "Retrouvez les univers les plus demandes par nos clientes.",
  promotionsTitle: "Promotions du moment",
  promotionsSubtitle: "Des remises actives sur une selection de produits.",
  bestSellersTitle: "Meilleures ventes",
  bestSellersSubtitle: "Les produits les plus commandes cette semaine.",
  newArrivalsTitle: "Nouveautes",
  newArrivalsSubtitle: "Les derniers ajouts de notre catalogue.",
  brandsTitle: "Marques partenaires",
  brandsSubtitle: "Des marques dermo-cosmetiques reconnues.",
  trustTitle: "Pourquoi commander chez Zayna",
  trustSubtitle: "Des engagements clairs pour une experience d'achat fluide.",
  loyaltyBadge: "Programme fidelite",
  loyaltyTitle: "Cumulez des avantages a chaque commande",
  loyaltyDescription:
    "Activez votre carte fidelite pour debloquer des offres reservees, des remises personnalisees et un suivi sur mesure.",
  loyaltyCtaLabel: "Demander ma carte",
  loyaltyCtaHref: "/#contact",
  loyaltyHighlightText: "Service client disponible 7j/7",
  loyaltyImageUrl: "/carte-fideliteEEEEE.png",
  newsletterTitle: "Restez informee des nouveautes",
  newsletterDescription: "Recevez nos conseils beaute, offres et lancements en avant-premiere.",
  newsletterPlaceholder: "Votre adresse e-mail",
  newsletterButtonLabel: "S'abonner",
  newsletterSuccessMessage: "Merci, votre inscription a bien ete prise en compte.",
  newsletterErrorMessage: "Impossible de valider votre inscription pour le moment.",
  footerAboutTitle: "A propos de Zayna",
  footerAboutDescription:
    "Votre parapharmacie en ligne pour une routine beaute et bien-etre complete.",
  footerQuickLinksTitle: "Liens rapides",
  footerLegalLinksTitle: "Informations legales",
  footerCategoriesTitle: "Categories",
  footerContactPhone: null,
  footerContactEmail: null,
  footerContactHours: null,
  footerCopyrightText: "ZAYNA. Tous droits reserves.",
  featuredCategoriesLimit: 8,
  promotionsLimit: 10,
  bestSellersLimit: 10,
  newArrivalsLimit: 10,
  brandsLimit: 12,
};

async function fetchAdminHomepagePageData(): Promise<AdminHomepagePageData> {
  const [settingsRecord, heroSlides, trustItems, links, socialLinks, newsletterSubscribers] =
    await Promise.all([
      prisma.storefrontSettings.findUnique({
        where: {
          id: "default",
        },
      }),
      prisma.homeHeroSlide.findMany({
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      }),
      prisma.homeTrustItem.findMany({
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      }),
      prisma.siteLink.findMany({
        orderBy: [{ group: "asc" }, { sortOrder: "asc" }, { createdAt: "asc" }],
      }),
      prisma.siteSocialLink.findMany({
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      }),
      prisma.newsletterSubscription.count({
        where: {
          isActive: true,
        },
      }),
    ]);

  const settings = settingsRecord
    ? {
        announcementEnabled: settingsRecord.announcementEnabled,
        announcementText: settingsRecord.announcementText,
        announcementHref: settingsRecord.announcementHref,
        heroAutoplayMs: settingsRecord.heroAutoplayMs,
        featuredCategoriesTitle: settingsRecord.featuredCategoriesTitle,
        featuredCategoriesSubtitle: settingsRecord.featuredCategoriesSubtitle,
        promotionsTitle: settingsRecord.promotionsTitle,
        promotionsSubtitle: settingsRecord.promotionsSubtitle,
        bestSellersTitle: settingsRecord.bestSellersTitle,
        bestSellersSubtitle: settingsRecord.bestSellersSubtitle,
        newArrivalsTitle: settingsRecord.newArrivalsTitle,
        newArrivalsSubtitle: settingsRecord.newArrivalsSubtitle,
        brandsTitle: settingsRecord.brandsTitle,
        brandsSubtitle: settingsRecord.brandsSubtitle,
        trustTitle: settingsRecord.trustTitle,
        trustSubtitle: settingsRecord.trustSubtitle,
        loyaltyBadge: settingsRecord.loyaltyBadge,
        loyaltyTitle: settingsRecord.loyaltyTitle,
        loyaltyDescription: settingsRecord.loyaltyDescription,
        loyaltyCtaLabel: settingsRecord.loyaltyCtaLabel,
        loyaltyCtaHref: settingsRecord.loyaltyCtaHref,
        loyaltyHighlightText: settingsRecord.loyaltyHighlightText,
        loyaltyImageUrl: sanitizePublicImageUrl(
          settingsRecord.loyaltyImageUrl,
          defaultHomepageSettings.loyaltyImageUrl || ""
        ),
        newsletterTitle: settingsRecord.newsletterTitle,
        newsletterDescription: settingsRecord.newsletterDescription,
        newsletterPlaceholder: settingsRecord.newsletterPlaceholder,
        newsletterButtonLabel: settingsRecord.newsletterButtonLabel,
        newsletterSuccessMessage: settingsRecord.newsletterSuccessMessage,
        newsletterErrorMessage: settingsRecord.newsletterErrorMessage,
        footerAboutTitle: settingsRecord.footerAboutTitle,
        footerAboutDescription: settingsRecord.footerAboutDescription,
        footerQuickLinksTitle: settingsRecord.footerQuickLinksTitle,
        footerLegalLinksTitle: settingsRecord.footerLegalLinksTitle,
        footerCategoriesTitle: settingsRecord.footerCategoriesTitle,
        footerContactPhone: settingsRecord.footerContactPhone,
        footerContactEmail: settingsRecord.footerContactEmail,
        footerContactHours: settingsRecord.footerContactHours,
        footerCopyrightText: settingsRecord.footerCopyrightText,
        featuredCategoriesLimit: settingsRecord.featuredCategoriesLimit,
        promotionsLimit: settingsRecord.promotionsLimit,
        bestSellersLimit: settingsRecord.bestSellersLimit,
        newArrivalsLimit: settingsRecord.newArrivalsLimit,
        brandsLimit: settingsRecord.brandsLimit,
      }
    : defaultHomepageSettings;

  const headerLinks = links.filter((link) => link.group === "header").length;
  const footerLinks = links.filter((link) => link.group !== "header").length;

  return {
    metrics: {
      heroSlides: heroSlides.length,
      trustItems: trustItems.length,
      headerLinks,
      footerLinks,
      socialLinks: socialLinks.length,
      newsletterSubscribers,
    },
    settings,
    heroSlides: heroSlides.map((slide) => ({
      id: slide.id,
      badge: slide.badge,
      title: slide.title,
      subtitle: slide.subtitle,
      ctaLabel: slide.ctaLabel,
      ctaHref: slide.ctaHref,
      imageUrl: slide.imageUrl,
      altText: slide.altText,
      sortOrder: slide.sortOrder,
      isActive: slide.isActive,
    })),
    trustItems: trustItems.map((item) => ({
      id: item.id,
      title: item.title,
      description: item.description,
      icon: item.icon,
      sortOrder: item.sortOrder,
      isActive: item.isActive,
    })),
    links: links.map((link) => ({
      id: link.id,
      group: link.group,
      title: link.title,
      href: link.href,
      sortOrder: link.sortOrder,
      openInNewTab: link.openInNewTab,
    })),
    socialLinks: socialLinks.map((item) => ({
      id: item.id,
      platform: item.platform,
      title: item.title,
      href: item.href,
      sortOrder: item.sortOrder,
      openInNewTab: item.openInNewTab,
    })),
  };
}

const getCachedAdminHomepagePageData = unstable_cache(
  fetchAdminHomepagePageData,
  ["admin-homepage-page-data"],
  {
    tags: [adminDataTag],
    revalidate: 120,
  }
);

export async function getAdminHomepagePageData(): Promise<AdminHomepagePageData> {
  await requireAdmin();
  return getCachedAdminHomepagePageData();
}

export type AdminPromoCodesPageData = {
  metrics: {
    totalPromoCodes: number;
    activePromoCodes: number;
    expiringPromoCodes: number;
    averageDiscountValue: number;
  };
  promoCodes: AdminDashboardData["promoCodes"];
  expiringPromoIds: string[];
};

async function fetchAdminPromoCodesPageData(): Promise<AdminPromoCodesPageData> {
  const expiringThreshold = sevenDaysFromNow().getTime();
  const [totalPromoCodes, activePromoCodes, expiringPromoCodes, averageDiscount, promoCodes] =
    await Promise.all([
      prisma.promoCode.count(),
      prisma.promoCode.count({
        where: {
          active: true,
        },
      }),
      prisma.promoCode.count({
        where: {
          active: true,
          endsAt: {
            gte: new Date(),
            lte: sevenDaysFromNow(),
          },
        },
      }),
      prisma.promoCode.aggregate({
        _avg: {
          discountValue: true,
        },
      }),
      prisma.promoCode.findMany({
        orderBy: {
          updatedAt: "desc",
        },
        take: 30,
      }),
    ]);

  return {
    metrics: {
      totalPromoCodes,
      activePromoCodes,
      expiringPromoCodes,
      averageDiscountValue: decimalToNumber(averageDiscount._avg.discountValue),
    },
    promoCodes: mapPromoCodes(promoCodes),
    expiringPromoIds: promoCodes
      .filter(
        (promo) =>
          promo.active &&
          Boolean(promo.endsAt) &&
          (promo.endsAt as Date).getTime() <= expiringThreshold
      )
      .map((promo) => promo.id),
  };
}

const getCachedAdminPromoCodesPageData = unstable_cache(
  fetchAdminPromoCodesPageData,
  ["admin-promo-page-data"],
  {
    tags: [adminDataTag],
    revalidate: 120,
  }
);

export async function getAdminPromoCodesPageData(): Promise<AdminPromoCodesPageData> {
  await requireAdmin();
  const data = await getCachedAdminPromoCodesPageData();

  return {
    ...data,
    promoCodes: normalizePromoCodes(data.promoCodes),
  };
}
