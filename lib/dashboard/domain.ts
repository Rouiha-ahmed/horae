import { isOrderPaymentCollected } from "@/lib/orders/domain";

export const DASHBOARD_TIME_ZONE = "Africa/Casablanca";
export const DASHBOARD_PERIODS = [7, 30, 90] as const;

export type DashboardPeriod = (typeof DASHBOARD_PERIODS)[number];
export type DashboardMode = "today" | "pilotage";

export type DashboardDateWindow = {
  period: DashboardPeriod;
  start: Date;
  end: Date;
  previousStart: Date;
  previousEnd: Date;
  label: string;
  comparisonLabel: string;
};

export type RevenueOrderPoint = {
  date: string;
  label: string;
  revenue: number;
  orders: number;
  collectedOrders: number;
};

export type DailyRevenueOrderRow = {
  date: string;
  revenue: number;
  orders: number;
  collectedOrders: number;
};

export type PerformanceOrder = {
  status: string;
  paymentStatus: string;
  totalPrice: number;
  orderDate: Date;
  preparedAt: Date | null;
  deliveredAt: Date | null;
};

const zonedPartsFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: DASHBOARD_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const labelFormatter = new Intl.DateTimeFormat("fr-MA", {
  timeZone: DASHBOARD_TIME_ZONE,
  day: "2-digit",
  month: "short",
});

const fullDateFormatter = new Intl.DateTimeFormat("fr-MA", {
  timeZone: DASHBOARD_TIME_ZONE,
  day: "numeric",
  month: "long",
  year: "numeric",
});

const partsFor = (value: Date) => {
  const values = Object.fromEntries(
    zonedPartsFormatter
      .formatToParts(value)
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, Number(part.value)]),
  );
  return { year: values.year, month: values.month, day: values.day };
};

const timeZoneOffsetMs = (value: Date) => {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: DASHBOARD_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });
  const parts = Object.fromEntries(
    formatter
      .formatToParts(value)
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, Number(part.value)]),
  );
  const asUtc = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second,
  );
  return asUtc - value.getTime();
};

const zonedMidnight = (year: number, month: number, day: number) => {
  const utcGuess = Date.UTC(year, month - 1, day, 0, 0, 0, 0);
  let value = new Date(utcGuess);
  value = new Date(utcGuess - timeZoneOffsetMs(value));
  return new Date(utcGuess - timeZoneOffsetMs(value));
};

const addCalendarDays = (value: Date, days: number) => {
  const parts = partsFor(value);
  const shifted = new Date(Date.UTC(parts.year, parts.month - 1, parts.day + days));
  return zonedMidnight(
    shifted.getUTCFullYear(),
    shifted.getUTCMonth() + 1,
    shifted.getUTCDate(),
  );
};

export const dashboardDateKey = (value: Date) => {
  const { year, month, day } = partsFor(value);
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
};

const dateFromKey = (key: string) => {
  const [year, month, day] = key.split("-").map(Number);
  return zonedMidnight(year, month, day);
};

const keyPlusDays = (key: string, days: number) =>
  dashboardDateKey(addCalendarDays(dateFromKey(key), days));

export function parseDashboardMode(value: string | string[] | undefined): DashboardMode {
  const candidate = Array.isArray(value) ? value[0] : value;
  return candidate === "pilotage" ? "pilotage" : "today";
}

export function parseDashboardPeriod(value: string | string[] | undefined): DashboardPeriod {
  const candidate = Number(Array.isArray(value) ? value[0] : value);
  return DASHBOARD_PERIODS.includes(candidate as DashboardPeriod)
    ? (candidate as DashboardPeriod)
    : 30;
}

export function buildDashboardDateWindow(
  period: DashboardPeriod,
  now = new Date(),
): DashboardDateWindow {
  const today = partsFor(now);
  const tomorrowStart = zonedMidnight(today.year, today.month, today.day + 1);
  const end = new Date(tomorrowStart.getTime() - 1);
  const todayStart = zonedMidnight(today.year, today.month, today.day);
  const start = addCalendarDays(todayStart, -(period - 1));
  const previousEnd = new Date(start.getTime() - 1);
  const previousStart = addCalendarDays(start, -period);

  return {
    period,
    start,
    end,
    previousStart,
    previousEnd,
    label: `${period} derniers jours`,
    comparisonLabel: `${fullDateFormatter.format(previousStart)} – ${fullDateFormatter.format(previousEnd)}`,
  };
}

export const isCollectedRevenueOrder = (order: {
  status: string;
  paymentStatus: string;
}) => order.status !== "cancelled" && isOrderPaymentCollected(order);

export const metricChangePercent = (value: number, previous: number) => {
  if (previous === 0) return value === 0 ? 0 : 100;
  return ((value - previous) / previous) * 100;
};

export const metricPointChange = (value: number, previous: number) => value - previous;

export function calculatePerformanceMetrics(orders: PerformanceOrder[]) {
  const collected = orders.filter(isCollectedRevenueOrder);
  const revenue = collected.reduce((sum, order) => sum + order.totalPrice, 0);
  const preparationHours = orders
    .filter((order) => order.preparedAt)
    .map((order) =>
      Math.max(0, order.preparedAt!.getTime() - order.orderDate.getTime()) / 3_600_000,
    );
  const deliveryHours = orders
    .filter((order) => order.deliveredAt)
    .map((order) =>
      Math.max(0, order.deliveredAt!.getTime() - order.orderDate.getTime()) / 3_600_000,
    );
  const average = (values: number[]) =>
    values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
  const cancelled = orders.filter((order) => order.status === "cancelled").length;

  return {
    revenue,
    orders: orders.length,
    collectedOrders: collected.length,
    averageBasket: collected.length ? revenue / collected.length : 0,
    cancellationRate: orders.length ? (cancelled / orders.length) * 100 : 0,
    averagePreparationHours: average(preparationHours),
    averageDeliveryHours: average(deliveryHours),
  };
}

export function buildRevenueOrderSeries(
  rows: DailyRevenueOrderRow[],
  window: Pick<DashboardDateWindow, "start" | "period">,
): RevenueOrderPoint[] {
  const byDate = new Map(rows.map((row) => [row.date, row]));
  const startKey = dashboardDateKey(window.start);
  const daily = Array.from({ length: window.period }, (_, index) => {
    const date = keyPlusDays(startKey, index);
    const row = byDate.get(date);
    return {
      date,
      label: labelFormatter.format(dateFromKey(date)),
      revenue: row?.revenue || 0,
      orders: row?.orders || 0,
      collectedOrders: row?.collectedOrders || 0,
    };
  });

  if (window.period < 90) return daily;

  const weekly: RevenueOrderPoint[] = [];
  for (let index = 0; index < daily.length; index += 7) {
    const bucket = daily.slice(index, index + 7);
    const first = bucket[0];
    const last = bucket[bucket.length - 1];
    weekly.push({
      date: first.date,
      label: `${first.label} – ${last.label}`,
      revenue: bucket.reduce((sum, point) => sum + point.revenue, 0),
      orders: bucket.reduce((sum, point) => sum + point.orders, 0),
      collectedOrders: bucket.reduce((sum, point) => sum + point.collectedOrders, 0),
    });
  }
  return weekly;
}
