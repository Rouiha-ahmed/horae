import type { ProductLifecycleStatus } from "@prisma/client";

export type StockRiskLevel =
  "OUT_OF_STOCK" | "CRITICAL" | "LOW" | "HEALTHY" | "NO_RECENT_SALES";

export type ProductIssueType =
  | "OUT_OF_STOCK"
  | "VERY_LOW_COVERAGE"
  | "MISSING_PRICE"
  | "MISSING_IMAGE"
  | "BROKEN_IMAGE"
  | "MISSING_CATEGORY"
  | "EXPIRED_PROMOTION"
  | "INCOMPLETE_PRODUCT";

export type ProductAction =
  | "RESTOCK"
  | "VIEW_STOCK"
  | "FIX_PRICE"
  | "ADD_IMAGE"
  | "REPLACE_IMAGE"
  | "CLASSIFY"
  | "DISABLE_PROMOTION"
  | "EDIT";

export type ProductIssue = {
  type: ProductIssueType;
  severity: "CRITICAL" | "WARNING";
  message: string;
  recommendedAction: ProductAction;
};

export const PRODUCT_STOCK_COVER_THRESHOLDS = {
  criticalDays: 3,
  lowDays: 7,
} as const;

export function computeStockRisk({
  availableStock,
  unitsSold30d,
}: {
  availableStock: number;
  unitsSold30d: number;
}) {
  const normalizedStock = Math.max(0, availableStock);
  const normalizedSales = Math.max(0, unitsSold30d);
  if (normalizedStock === 0) {
    return {
      level: "OUT_OF_STOCK" as const,
      avgDailySales30: normalizedSales / 30,
      daysOfCover: 0,
    };
  }
  if (normalizedSales === 0) {
    return {
      level: "NO_RECENT_SALES" as const,
      avgDailySales30: 0,
      daysOfCover: null,
    };
  }
  const avgDailySales30 = normalizedSales / 30;
  const daysOfCover = normalizedStock / avgDailySales30;
  const level: StockRiskLevel =
    daysOfCover < PRODUCT_STOCK_COVER_THRESHOLDS.criticalDays
      ? "CRITICAL"
      : daysOfCover < PRODUCT_STOCK_COVER_THRESHOLDS.lowDays
        ? "LOW"
        : "HEALTHY";
  return { level, avgDailySales30, daysOfCover };
}

export const isProductPromotionCurrentlyActive = (
  promotion: {
    isPromotion: boolean;
    discount: number;
    promotionStartsAt: Date | string | null;
    promotionEndsAt: Date | string | null;
  },
  now = new Date(),
) => {
  if (!promotion.isPromotion || promotion.discount <= 0) return false;
  const timestamp = now.getTime();
  if (
    promotion.promotionStartsAt &&
    new Date(promotion.promotionStartsAt).getTime() > timestamp
  )
    return false;
  if (
    promotion.promotionEndsAt &&
    new Date(promotion.promotionEndsAt).getTime() <= timestamp
  )
    return false;
  return true;
};

export const getEffectiveProductUnitPrice = (
  product: {
    price: unknown;
    regularPrice: unknown;
    salePrice: unknown | null;
    isPromotion: boolean;
    discount: number;
    promotionStartsAt: Date | string | null;
    promotionEndsAt: Date | string | null;
  },
  now = new Date(),
) => {
  const sourcePrice = Number(product.price);
  const regularPrice = Number(product.regularPrice);
  if (!isProductPromotionCurrentlyActive(product, now)) {
    return Number.isFinite(regularPrice) ? regularPrice : sourcePrice;
  }
  const salePrice =
    product.salePrice === null ? sourcePrice : Number(product.salePrice);
  return Number.isFinite(salePrice) ? salePrice : sourcePrice;
};

export const isValidProductImageReference = (
  url: string | null | undefined,
) => {
  if (!url) return false;
  if (url.startsWith("/static-assets/products/"))
    return !url.includes("..") && /\.(webp|png|jpe?g|avif)$/i.test(url);
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" || parsed.protocol === "http:";
  } catch {
    return false;
  }
};

const issuePriority: ProductIssueType[] = [
  "OUT_OF_STOCK",
  "VERY_LOW_COVERAGE",
  "MISSING_PRICE",
  "MISSING_IMAGE",
  "BROKEN_IMAGE",
  "MISSING_CATEGORY",
  "EXPIRED_PROMOTION",
  "INCOMPLETE_PRODUCT",
];

export function computeProductIssues(context: {
  lifecycleStatus: ProductLifecycleStatus;
  name: string;
  sku: string;
  price: number;
  stockRisk: ReturnType<typeof computeStockRisk>;
  primaryImageUrl: string | null;
  primaryImageResolvable?: boolean;
  activeCategoryCount: number;
  isPromotion: boolean;
  discount: number;
  promotionEndsAt: Date | string | null;
  now?: Date;
}): ProductIssue[] {
  if (context.lifecycleStatus === "ARCHIVED") return [];
  const sellable = context.lifecycleStatus === "ACTIVE";
  const issues: ProductIssue[] = [];
  if (sellable && context.stockRisk.level === "OUT_OF_STOCK") {
    issues.push({
      type: "OUT_OF_STOCK",
      severity: "CRITICAL",
      message: "Produit en rupture",
      recommendedAction: "RESTOCK",
    });
  } else if (sellable && context.stockRisk.level === "CRITICAL") {
    issues.push({
      type: "VERY_LOW_COVERAGE",
      severity: "CRITICAL",
      message: "Rupture probable",
      recommendedAction: "VIEW_STOCK",
    });
  }
  if (sellable && context.price <= 0)
    issues.push({
      type: "MISSING_PRICE",
      severity: "CRITICAL",
      message: "Prix manquant",
      recommendedAction: "FIX_PRICE",
    });
  if (sellable && !context.primaryImageUrl)
    issues.push({
      type: "MISSING_IMAGE",
      severity: "CRITICAL",
      message: "Image principale manquante",
      recommendedAction: "ADD_IMAGE",
    });
  else if (
    sellable &&
    (context.primaryImageResolvable === false ||
      !isValidProductImageReference(context.primaryImageUrl))
  )
    issues.push({
      type: "BROKEN_IMAGE",
      severity: "CRITICAL",
      message: "Image cassée",
      recommendedAction: "REPLACE_IMAGE",
    });
  if (sellable && context.activeCategoryCount === 0)
    issues.push({
      type: "MISSING_CATEGORY",
      severity: "WARNING",
      message: "Catégorie manquante",
      recommendedAction: "CLASSIFY",
    });
  const now = context.now || new Date();
  if (
    context.isPromotion &&
    context.discount > 0 &&
    context.promotionEndsAt &&
    new Date(context.promotionEndsAt) <= now
  ) {
    issues.push({
      type: "EXPIRED_PROMOTION",
      severity: "WARNING",
      message: "Promotion terminée",
      recommendedAction: "DISABLE_PROMOTION",
    });
  }
  if (!context.name.trim() || !context.sku.trim())
    issues.push({
      type: "INCOMPLETE_PRODUCT",
      severity: "WARNING",
      message: "Informations à compléter",
      recommendedAction: "EDIT",
    });
  return issues.sort(
    (left, right) =>
      issuePriority.indexOf(left.type) - issuePriority.indexOf(right.type),
  );
}

export const getPrimaryProductIssue = (issues: ProductIssue[]) =>
  issues[0] || null;

export function validateProductLifecycleTransition(
  current: ProductLifecycleStatus,
  next: ProductLifecycleStatus,
) {
  if (current === "ARCHIVED" && next !== "INACTIVE" && next !== "ARCHIVED") {
    throw new Error(
      "Désarchivez le produit avant de modifier son cycle de vie.",
    );
  }
}

export type BulkProductAction =
  "ACTIVATE" | "DEACTIVATE" | "ARCHIVE" | "FEATURE_ON" | "FEATURE_OFF";

export function validateBulkProductAction(
  products: Array<{
    id: string;
    name: string;
    lifecycleStatus: ProductLifecycleStatus;
  }>,
  action: BulkProductAction,
) {
  const compatible: typeof products = [];
  const incompatible: Array<{ id: string; name: string; reason: string }> = [];
  for (const product of products) {
    const reason =
      action === "ARCHIVE" && product.lifecycleStatus === "ARCHIVED"
        ? "Déjà archivé"
        : action === "ACTIVATE" && product.lifecycleStatus === "ARCHIVED"
          ? "Doit d’abord être désarchivé"
          : action === "DEACTIVATE" && product.lifecycleStatus === "ARCHIVED"
            ? "Un produit archivé ne peut pas devenir inactif directement"
            : action === "FEATURE_ON" && product.lifecycleStatus === "ARCHIVED"
              ? "Un produit archivé ne peut pas être mis en avant"
              : null;
    if (reason)
      incompatible.push({ id: product.id, name: product.name, reason });
    else compatible.push(product);
  }
  return { compatible, incompatible };
}
