import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  computeProductIssues,
  computeStockRisk,
  getEffectiveProductUnitPrice,
  isProductPromotionCurrentlyActive,
  validateBulkProductAction,
  validateProductLifecycleTransition,
} from "../lib/products/domain";
import {
  activeProductPromotionWhere,
  sellableProductWhere,
} from "../lib/products/storefront-rules";
import { buildProductSearchWhere } from "../lib/products/admin-data";

const now = new Date("2026-08-16T12:00:00.000Z");

test("stock risk handles rupture, critical, low, healthy and no-sales without division by zero", () => {
  assert.deepEqual(computeStockRisk({ availableStock: 0, unitsSold30d: 30 }), {
    level: "OUT_OF_STOCK",
    avgDailySales30: 1,
    daysOfCover: 0,
  });
  assert.equal(
    computeStockRisk({ availableStock: 5, unitsSold30d: 60 }).level,
    "CRITICAL",
  );
  assert.equal(
    computeStockRisk({ availableStock: 10, unitsSold30d: 60 }).level,
    "LOW",
  );
  assert.equal(
    computeStockRisk({ availableStock: 20, unitsSold30d: 60 }).level,
    "HEALTHY",
  );
  assert.deepEqual(computeStockRisk({ availableStock: 8, unitsSold30d: 0 }), {
    level: "NO_RECENT_SALES",
    avgDailySales30: 0,
    daysOfCover: null,
  });
});

test("issue engine returns deterministic actionable anomalies and ignores archived products", () => {
  const context = {
    lifecycleStatus: "ACTIVE" as const,
    name: "Soin",
    sku: "SO-1",
    price: 0,
    stockRisk: computeStockRisk({ availableStock: 0, unitsSold30d: 2 }),
    primaryImageUrl: null,
    activeCategoryCount: 0,
    isPromotion: true,
    discount: 20,
    promotionEndsAt: new Date("2026-08-15T00:00:00.000Z"),
    now,
  };
  assert.deepEqual(
    computeProductIssues(context).map((issue) => issue.type),
    [
      "OUT_OF_STOCK",
      "MISSING_PRICE",
      "MISSING_IMAGE",
      "MISSING_CATEGORY",
      "EXPIRED_PROMOTION",
    ],
  );
  assert.deepEqual(
    computeProductIssues({ ...context, lifecycleStatus: "ARCHIVED" }),
    [],
  );
});

test("issue engine distinguishes a missing image from an unresolvable stored image", () => {
  const issues = computeProductIssues({
    lifecycleStatus: "ACTIVE",
    name: "Soin",
    sku: "SO-2",
    price: 120,
    stockRisk: computeStockRisk({ availableStock: 20, unitsSold30d: 30 }),
    primaryImageUrl: "/static-assets/products/missing.webp",
    primaryImageResolvable: false,
    activeCategoryCount: 1,
    isPromotion: false,
    discount: 0,
    promotionEndsAt: null,
    now,
  });
  assert.deepEqual(
    issues.map((issue) => issue.type),
    ["BROKEN_IMAGE"],
  );
});

test("promotion scheduling has exact inclusive start and exclusive end boundaries", () => {
  const promotion = {
    isPromotion: true,
    discount: 15,
    promotionStartsAt: "2026-08-16T12:00:00.000Z",
    promotionEndsAt: "2026-08-17T12:00:00.000Z",
  };
  assert.equal(isProductPromotionCurrentlyActive(promotion, now), true);
  assert.equal(
    isProductPromotionCurrentlyActive(
      promotion,
      new Date("2026-08-17T12:00:00.000Z"),
    ),
    false,
  );
  assert.equal(
    isProductPromotionCurrentlyActive({ ...promotion, discount: 0 }, now),
    false,
  );
});

test("checkout price falls back to reference price outside the product promotion window", () => {
  const product = {
    price: 80,
    regularPrice: 100,
    salePrice: 80,
    isPromotion: true,
    discount: 20,
    promotionStartsAt: new Date("2026-08-01T00:00:00.000Z"),
    promotionEndsAt: new Date("2026-08-20T00:00:00.000Z"),
  };
  assert.equal(getEffectiveProductUnitPrice(product, now), 80);
  assert.equal(
    getEffectiveProductUnitPrice(product, new Date("2026-08-21T00:00:00.000Z")),
    100,
  );
});

test("lifecycle and bulk validation refuse unsafe archived transitions explicitly", () => {
  assert.throws(
    () => validateProductLifecycleTransition("ARCHIVED", "ACTIVE"),
    /Désarchivez/,
  );
  assert.doesNotThrow(() =>
    validateProductLifecycleTransition("ARCHIVED", "INACTIVE"),
  );
  const validation = validateBulkProductAction(
    [
      { id: "active", name: "Actif", lifecycleStatus: "ACTIVE" },
      { id: "archived", name: "Archivé", lifecycleStatus: "ARCHIVED" },
    ],
    "ACTIVATE",
  );
  assert.deepEqual(
    validation.compatible.map((item) => item.id),
    ["active"],
  );
  assert.deepEqual(
    validation.incompatible.map((item) => item.id),
    ["archived"],
  );
});

test("the public visibility and promotion predicates are centralized", () => {
  assert.deepEqual(sellableProductWhere, {
    lifecycleStatus: "ACTIVE",
    isActive: true,
    archivedAt: null,
  });
  const promotionWhere = activeProductPromotionWhere(now);
  assert.equal(promotionWhere.isPromotion, true);
  assert.deepEqual(promotionWhere.discount, { gt: 0 });
  assert.equal(Array.isArray(promotionWhere.AND), true);
});

test("admin catalogue search targets name, SKU, EAN, brand and category on the server", () => {
  const where = buildProductSearchWhere({
    query: "cerave",
    view: "all",
    lifecycle: "all",
    brandId: "",
    categoryId: "",
    stock: "all",
    promotion: "all",
    issue: "all",
    sort: "updated",
    page: 1,
    pageSize: 20,
  });
  const serialized = JSON.stringify(where);
  for (const field of ["name", "sku", "barcode", "brand", "categories"]) {
    assert.match(serialized, new RegExp(`\\"${field}\\"`));
  }
});

test("inventory and order flows keep stock mutations atomic, idempotent and non-destructive", () => {
  const inventory = readFileSync(
    new URL("../lib/inventory.ts", import.meta.url),
    "utf8",
  );
  const manualOrders = readFileSync(
    new URL("../lib/services/orders.ts", import.meta.url),
    "utf8",
  );
  const orderAdmin = readFileSync(
    new URL("../lib/orders/service.ts", import.meta.url),
    "utf8",
  );
  const adminActions = readFileSync(
    new URL("../app/admin/actions.ts", import.meta.url),
    "utf8",
  );

  assert.match(inventory, /UPDATE "Product"[\s\S]*"stock" >=/);
  assert.match(inventory, /idempotencyKey/);
  assert.match(inventory, /inventoryMovement\.create/);
  assert.match(manualOrders, /reason: "ORDER"/);
  assert.match(manualOrders, /getEffectiveProductUnitPrice/);
  assert.match(orderAdmin, /reason: "ORDER_CANCELLED"/);

  const archiveAction = adminActions.slice(
    adminActions.indexOf("export async function deleteProductAction"),
    adminActions.indexOf("export async function createPromoCodeAction"),
  );
  assert.match(archiveAction, /lifecycleStatus: "ARCHIVED"/);
  assert.doesNotMatch(archiveAction, /product\.delete/);
});
