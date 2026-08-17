import assert from "node:assert/strict";
import test from "node:test";

import {
  buildDashboardDateWindow,
  buildRevenueOrderSeries,
  calculatePerformanceMetrics,
  dashboardDateKey,
  isCollectedRevenueOrder,
  parseDashboardMode,
  parseDashboardPeriod,
} from "../lib/dashboard/domain";
import {
  buildAdminOrderWhere,
  parseAdminOrderFilters,
} from "../lib/orders/admin-data";

test("le Dashboard sépare les modes et utilise 30 jours par défaut en Pilotage", () => {
  assert.equal(parseDashboardMode(undefined), "today");
  assert.equal(parseDashboardMode("pilotage"), "pilotage");
  assert.equal(parseDashboardPeriod(undefined), 30);
  assert.equal(parseDashboardPeriod("7"), 7);
  assert.equal(parseDashboardPeriod("90"), 90);
  assert.equal(parseDashboardPeriod("365"), 30);
});

test("la comparaison Pilotage couvre la période précédente de longueur identique", () => {
  const window = buildDashboardDateWindow(
    30,
    new Date("2026-08-16T12:00:00.000Z"),
  );
  assert.equal(dashboardDateKey(window.start), "2026-07-18");
  assert.equal(dashboardDateKey(window.end), "2026-08-16");
  assert.equal(dashboardDateKey(window.previousStart), "2026-06-18");
  assert.equal(dashboardDateKey(window.previousEnd), "2026-07-17");
});

test("le CA exclut un COD livré mais non encaissé et le panier partage la même population", () => {
  const orderDate = new Date("2026-08-10T10:00:00.000Z");
  const orders = [
    {
      status: "delivered",
      paymentStatus: "pending",
      totalPrice: 500,
      orderDate,
      preparedAt: new Date("2026-08-10T14:00:00.000Z"),
      deliveredAt: new Date("2026-08-12T10:00:00.000Z"),
    },
    {
      status: "delivered",
      paymentStatus: "paid",
      totalPrice: 300,
      orderDate,
      preparedAt: new Date("2026-08-10T16:00:00.000Z"),
      deliveredAt: new Date("2026-08-11T10:00:00.000Z"),
    },
    {
      status: "cancelled",
      paymentStatus: "paid",
      totalPrice: 900,
      orderDate,
      preparedAt: null,
      deliveredAt: null,
    },
  ];
  assert.equal(isCollectedRevenueOrder(orders[0]), false);
  assert.equal(isCollectedRevenueOrder(orders[1]), true);
  assert.equal(isCollectedRevenueOrder(orders[2]), false);
  const metrics = calculatePerformanceMetrics(orders);
  assert.equal(metrics.revenue, 300);
  assert.equal(metrics.collectedOrders, 1);
  assert.equal(metrics.averageBasket, 300);
  assert.equal(metrics.averagePreparationHours, 5);
  assert.equal(metrics.averageDeliveryHours, 36);
});

test("la série remplit les jours vides et conserve la même définition CA/commandes", () => {
  const window = buildDashboardDateWindow(
    7,
    new Date("2026-08-16T12:00:00.000Z"),
  );
  const series = buildRevenueOrderSeries(
    [{ date: "2026-08-16", revenue: 465, orders: 2, collectedOrders: 1 }],
    window,
  );
  assert.equal(series.length, 7);
  assert.equal(series.reduce((sum, point) => sum + point.revenue, 0), 465);
  assert.equal(series.reduce((sum, point) => sum + point.orders, 0), 2);
});

test("le lien COD non encaissé correspond à un filtre Orders réellement supporté", () => {
  const filters = parseAdminOrderFilters({
    view: "all",
    issue: "uncollected-cod",
    sort: "priority",
  });
  assert.equal(filters.issue, "uncollected-cod");
  const where = JSON.stringify(buildAdminOrderWhere(filters));
  assert.match(where, /"paymentMethod":"cod"/);
  assert.match(where, /"deliveryStatus":"delivered"/);
  assert.match(where, /"paymentStatus":\{"in":\["pending","partial","failed"\]\}/);
});
