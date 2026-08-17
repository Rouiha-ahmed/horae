import { Prisma, type ProductLifecycleStatus } from "@prisma/client";
import { access } from "node:fs/promises";
import path from "node:path";

import { requireAdmin } from "@/lib/admin";
import { prisma } from "@/lib/prisma";
import {
  computeProductIssues,
  computeStockRisk,
  getPrimaryProductIssue,
  isValidProductImageReference,
  isProductPromotionCurrentlyActive,
  type ProductIssueType,
  type StockRiskLevel,
} from "@/lib/products/domain";

export type ProductView =
  | "all"
  | "action-required"
  | "stock-risk"
  | "promotion"
  | "featured"
  | "draft"
  | "archived";
export type ProductSort =
  | "updated"
  | "name-asc"
  | "name-desc"
  | "price-asc"
  | "price-desc"
  | "stock"
  | "risk";

export type AdminProductFilters = {
  query: string;
  view: ProductView;
  lifecycle: "all" | ProductLifecycleStatus;
  brandId: string;
  categoryId: string;
  stock: "all" | "out" | "risk" | "healthy" | "no-sales";
  promotion: "all" | "active" | "inactive" | "expired";
  issue: "all" | ProductIssueType;
  sort: ProductSort;
  page: number;
  pageSize: number;
};

const first = (value: string | string[] | undefined) =>
  Array.isArray(value) ? value[0] : value;
const oneOf = <T extends string>(
  value: string | undefined,
  values: readonly T[],
  fallback: T,
): T => (values.includes(value as T) ? (value as T) : fallback);

export function parseAdminProductFilters(
  params: Record<string, string | string[] | undefined>,
): AdminProductFilters {
  const view = oneOf(
    first(params.view),
    [
      "all",
      "action-required",
      "stock-risk",
      "promotion",
      "featured",
      "draft",
      "archived",
    ] as const,
    "all",
  );
  return {
    query: first(params.q)?.trim().slice(0, 120) || "",
    view,
    lifecycle: oneOf(
      first(params.lifecycle),
      ["all", "DRAFT", "ACTIVE", "INACTIVE", "ARCHIVED"] as const,
      "all",
    ),
    brandId: first(params.brand)?.trim() || "",
    categoryId: first(params.category)?.trim() || "",
    stock: oneOf(
      first(params.stock),
      ["all", "out", "risk", "healthy", "no-sales"] as const,
      "all",
    ),
    promotion: oneOf(
      first(params.promotion),
      ["all", "active", "inactive", "expired"] as const,
      "all",
    ),
    issue: oneOf(
      first(params.issue),
      [
        "all",
        "OUT_OF_STOCK",
        "VERY_LOW_COVERAGE",
        "MISSING_PRICE",
        "MISSING_IMAGE",
        "BROKEN_IMAGE",
        "MISSING_CATEGORY",
        "EXPIRED_PROMOTION",
        "INCOMPLETE_PRODUCT",
      ] as const,
      "all",
    ),
    sort: oneOf(
      first(params.sort),
      [
        "updated",
        "name-asc",
        "name-desc",
        "price-asc",
        "price-desc",
        "stock",
        "risk",
      ] as const,
      view === "action-required" ? "risk" : "updated",
    ),
    page: Math.max(1, Number.parseInt(first(params.page) || "1", 10) || 1),
    pageSize:
      oneOf(first(params.pageSize), ["10", "20", "50"] as const, "20") === "10"
        ? 10
        : first(params.pageSize) === "50"
          ? 50
          : 20,
  };
}

const productOperationsSelect = {
  id: true,
  name: true,
  slug: true,
  sku: true,
  barcode: true,
  description: true,
  shortDescription: true,
  price: true,
  regularPrice: true,
  salePrice: true,
  discount: true,
  stock: true,
  status: true,
  lifecycleStatus: true,
  isActive: true,
  isFeatured: true,
  isPromotion: true,
  promotionStartsAt: true,
  promotionEndsAt: true,
  archivedAt: true,
  updatedAt: true,
  brandId: true,
  brand: { select: { id: true, title: true, archivedAt: true } },
  categories: {
    select: {
      category: {
        select: {
          id: true,
          title: true,
          isActive: true,
          archivedAt: true,
          parentId: true,
        },
      },
    },
  },
  images: {
    orderBy: [{ isPrimary: "desc" as const }, { sortOrder: "asc" as const }],
    take: 1,
    select: { id: true, url: true, altText: true },
  },
  _count: { select: { images: true, variants: true, orderItems: true } },
} satisfies Prisma.ProductSelect;

type OperationsRecord = Prisma.ProductGetPayload<{
  select: typeof productOperationsSelect;
}>;

const isPrimaryImageResolvable = async (url: string | null | undefined) => {
  if (!url || !isValidProductImageReference(url)) return false;
  if (!url.startsWith("/static-assets/products/")) return true;
  const relative = url.slice("/static-assets/".length);
  const target = path.join(process.cwd(), "public", "static-assets", relative);
  const root = path.join(process.cwd(), "public", "static-assets", "products");
  if (!target.startsWith(root)) return false;
  try {
    await access(target);
    return true;
  } catch {
    return false;
  }
};

export const buildProductSearchWhere = (
  filters: AdminProductFilters,
): Prisma.ProductWhereInput => {
  const clauses: Prisma.ProductWhereInput[] = [];
  if (filters.query) {
    clauses.push({
      OR: [
        { name: { contains: filters.query, mode: "insensitive" } },
        { sku: { contains: filters.query, mode: "insensitive" } },
        { barcode: { contains: filters.query, mode: "insensitive" } },
        {
          brand: {
            is: { title: { contains: filters.query, mode: "insensitive" } },
          },
        },
        {
          categories: {
            some: {
              category: {
                title: { contains: filters.query, mode: "insensitive" },
              },
            },
          },
        },
      ],
    });
  }
  if (filters.lifecycle !== "all")
    clauses.push({ lifecycleStatus: filters.lifecycle });
  if (filters.brandId === "unassigned") clauses.push({ brandId: null });
  else if (filters.brandId) clauses.push({ brandId: filters.brandId });
  if (filters.categoryId === "unassigned")
    clauses.push({
      categories: { none: { category: { isActive: true, archivedAt: null } } },
    });
  else if (filters.categoryId)
    clauses.push({ categories: { some: { categoryId: filters.categoryId } } });
  return clauses.length ? { AND: clauses } : {};
};

const mapRecord = (
  record: OperationsRecord,
  unitsSold30d: number,
  now: Date,
  primaryImageResolvable = true,
) => {
  const stockRisk = computeStockRisk({
    availableStock: record.stock,
    unitsSold30d,
  });
  const activeCategories = record.categories
    .map(({ category }) => category)
    .filter((category) => category.isActive && !category.archivedAt);
  const primaryImageUrl = record.images[0]?.url || null;
  const issues = computeProductIssues({
    lifecycleStatus: record.lifecycleStatus,
    name: record.name,
    sku: record.sku,
    price: Number(record.price),
    stockRisk,
    primaryImageUrl,
    primaryImageResolvable,
    activeCategoryCount: activeCategories.length,
    isPromotion: record.isPromotion,
    discount: record.discount,
    promotionEndsAt: record.promotionEndsAt,
    now,
  });
  const promotionActive = isProductPromotionCurrentlyActive(record, now);
  return {
    id: record.id,
    name: record.name,
    slug: record.slug,
    sku: record.sku,
    barcode: record.barcode,
    description: record.shortDescription || record.description,
    price: Number(record.price),
    regularPrice: Number(record.regularPrice),
    salePrice: record.salePrice ? Number(record.salePrice) : null,
    discount: record.discount,
    stock: record.stock,
    merchandisingStatus: record.status,
    lifecycleStatus: record.lifecycleStatus,
    isFeatured: record.isFeatured,
    isPromotion: record.isPromotion,
    promotionActive,
    promotionStartsAt: record.promotionStartsAt?.toISOString() || null,
    promotionEndsAt: record.promotionEndsAt?.toISOString() || null,
    archivedAt: record.archivedAt?.toISOString() || null,
    updatedAt: record.updatedAt.toISOString(),
    brandId: record.brandId,
    brandTitle: record.brand?.title || null,
    categories: activeCategories.map(({ id, title }) => ({ id, title })),
    primaryImageUrl,
    imageCount: record._count.images,
    variantCount: record._count.variants,
    orderCount: record._count.orderItems,
    unitsSold30d,
    stockRisk,
    issues,
    primaryIssue: getPrimaryProductIssue(issues),
  };
};

export type AdminProductRow = ReturnType<typeof mapRecord>;

const riskOrder: Record<StockRiskLevel, number> = {
  OUT_OF_STOCK: 0,
  CRITICAL: 1,
  LOW: 2,
  HEALTHY: 3,
  NO_RECENT_SALES: 4,
};
const severityOrder = (row: AdminProductRow) =>
  row.primaryIssue?.severity === "CRITICAL" ? 0 : row.primaryIssue ? 1 : 2;

const matchesOperationalFilters = (
  row: AdminProductRow,
  filters: AdminProductFilters,
  now: Date,
) => {
  if (
    filters.view !== "archived" &&
    filters.lifecycle !== "ARCHIVED" &&
    row.lifecycleStatus === "ARCHIVED"
  )
    return false;
  if (filters.view === "action-required" && !row.issues.length) return false;
  if (
    filters.view === "stock-risk" &&
    !["OUT_OF_STOCK", "CRITICAL", "LOW"].includes(row.stockRisk.level)
  )
    return false;
  if (filters.view === "promotion" && !row.promotionActive) return false;
  if (filters.view === "featured" && !row.isFeatured) return false;
  if (filters.view === "draft" && row.lifecycleStatus !== "DRAFT") return false;
  if (filters.view === "archived" && row.lifecycleStatus !== "ARCHIVED")
    return false;
  if (filters.stock === "out" && row.stockRisk.level !== "OUT_OF_STOCK")
    return false;
  if (
    filters.stock === "risk" &&
    !["OUT_OF_STOCK", "CRITICAL", "LOW"].includes(row.stockRisk.level)
  )
    return false;
  if (filters.stock === "healthy" && row.stockRisk.level !== "HEALTHY")
    return false;
  if (filters.stock === "no-sales" && row.stockRisk.level !== "NO_RECENT_SALES")
    return false;
  if (filters.promotion === "active" && !row.promotionActive) return false;
  if (
    filters.promotion === "inactive" &&
    (!row.isPromotion || row.promotionActive)
  )
    return false;
  if (
    filters.promotion === "expired" &&
    !(
      row.isPromotion &&
      row.promotionEndsAt &&
      new Date(row.promotionEndsAt) <= now
    )
  )
    return false;
  if (
    filters.issue !== "all" &&
    !row.issues.some((issue) => issue.type === filters.issue)
  )
    return false;
  return true;
};

const sortRows = (rows: AdminProductRow[], sort: ProductSort) =>
  rows.sort((left, right) => {
    if (sort === "name-asc") return left.name.localeCompare(right.name, "fr");
    if (sort === "name-desc") return right.name.localeCompare(left.name, "fr");
    if (sort === "price-asc") return left.price - right.price;
    if (sort === "price-desc") return right.price - left.price;
    if (sort === "stock") return left.stock - right.stock;
    if (sort === "risk")
      return (
        severityOrder(left) - severityOrder(right) ||
        riskOrder[left.stockRisk.level] - riskOrder[right.stockRisk.level] ||
        left.stock - right.stock
      );
    return (
      new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime()
    );
  });

export async function getAdminProductsOperationsData(
  filters: AdminProductFilters,
) {
  await requireAdmin();
  const now = new Date();
  const records = await prisma.product.findMany({
    where: buildProductSearchWhere(filters),
    select: productOperationsSelect,
  });
  const ids = records.map((record) => record.id);
  const sales = ids.length
    ? await prisma.orderItem.groupBy({
        by: ["productId"],
        where: {
          productId: { in: ids },
          order: {
            status: "delivered",
            paymentStatus: "paid",
            orderDate: {
              gte: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000),
            },
          },
        },
        _sum: { quantity: true },
      })
    : [];
  const salesByProduct = new Map(
    sales.map((item) => [item.productId, item._sum.quantity || 0]),
  );
  const imageResolution = new Map(
    await Promise.all(
      records.map(
        async (record) =>
          [
            record.id,
            await isPrimaryImageResolvable(record.images[0]?.url),
          ] as const,
      ),
    ),
  );
  const allRows = records.map((record) =>
    mapRecord(
      record,
      salesByProduct.get(record.id) || 0,
      now,
      imageResolution.get(record.id),
    ),
  );
  const counters = {
    all: allRows.filter((row) => row.lifecycleStatus !== "ARCHIVED").length,
    active: allRows.filter((row) => row.lifecycleStatus === "ACTIVE").length,
    actionRequired: allRows.filter(
      (row) => row.lifecycleStatus !== "ARCHIVED" && row.issues.length > 0,
    ).length,
    stockRisk: allRows.filter(
      (row) =>
        row.lifecycleStatus !== "ARCHIVED" &&
        ["OUT_OF_STOCK", "CRITICAL", "LOW"].includes(row.stockRisk.level),
    ).length,
    promotion: allRows.filter(
      (row) => row.lifecycleStatus !== "ARCHIVED" && row.promotionActive,
    ).length,
    featured: allRows.filter(
      (row) => row.isFeatured && row.lifecycleStatus !== "ARCHIVED",
    ).length,
    draft: allRows.filter((row) => row.lifecycleStatus === "DRAFT").length,
    archived: allRows.filter((row) => row.lifecycleStatus === "ARCHIVED")
      .length,
  };
  const filtered = sortRows(
    allRows.filter((row) => matchesOperationalFilters(row, filters, now)),
    filters.sort,
  );
  const totalPages = Math.max(1, Math.ceil(filtered.length / filters.pageSize));
  const currentPage = Math.min(filters.page, totalPages);
  const start = (currentPage - 1) * filters.pageSize;
  const [brands, categories] = await Promise.all([
    prisma.brand.findMany({
      where: { archivedAt: null, isActive: true },
      orderBy: { title: "asc" },
      select: { id: true, title: true },
    }),
    prisma.category.findMany({
      where: { archivedAt: null, isActive: true },
      orderBy: [{ range: "asc" }, { title: "asc" }],
      select: { id: true, title: true, parentId: true },
    }),
  ]);
  return {
    filters,
    counters,
    rows: filtered.slice(start, start + filters.pageSize),
    pagination: {
      currentPage,
      totalPages,
      pageSize: filters.pageSize,
      filteredCount: filtered.length,
    },
    brands,
    categories,
  };
}

export type AdminProductsOperationsData = Awaited<
  ReturnType<typeof getAdminProductsOperationsData>
>;

export async function getAdminProductDetail(id: string) {
  await requireAdmin();
  const record = await prisma.product.findUnique({
    where: { id },
    include: {
      brand: { select: { id: true, title: true, archivedAt: true } },
      categories: {
        include: {
          category: {
            select: {
              id: true,
              title: true,
              isActive: true,
              archivedAt: true,
              parentId: true,
            },
          },
        },
      },
      images: { orderBy: [{ isPrimary: "desc" }, { sortOrder: "asc" }] },
      variants: { orderBy: [{ sortOrder: "asc" }, { title: "asc" }] },
      inventoryMovements: {
        orderBy: { createdAt: "desc" },
        take: 100,
        include: { relatedOrder: { select: { orderNumber: true } } },
      },
      _count: { select: { orderItems: true } },
    },
  });
  if (!record) return null;
  const sold = await prisma.orderItem.aggregate({
    where: {
      productId: id,
      order: {
        status: "delivered",
        paymentStatus: "paid",
        orderDate: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
      },
    },
    _sum: { quantity: true },
  });
  const summary = mapRecord(
    {
      ...record,
      images: record.images.slice(0, 1),
      _count: {
        images: record.images.length,
        variants: record.variants.length,
        orderItems: record._count.orderItems,
      },
    },
    sold._sum.quantity || 0,
    new Date(),
    await isPrimaryImageResolvable(record.images[0]?.url),
  );
  return {
    ...summary,
    fullDescription: record.fullDescription || record.description,
    shortDescription: record.shortDescription,
    seoTitle: record.seoTitle,
    seoDescription: record.seoDescription,
    images: record.images.map((image) => ({
      ...image,
      createdAt: image.createdAt.toISOString(),
      updatedAt: image.updatedAt.toISOString(),
    })),
    variants: record.variants.map((variant) => ({
      ...variant,
      regularPrice: Number(variant.regularPrice),
      salePrice: variant.salePrice ? Number(variant.salePrice) : null,
      createdAt: variant.createdAt.toISOString(),
      updatedAt: variant.updatedAt.toISOString(),
    })),
    movements: record.inventoryMovements.map((movement) => ({
      ...movement,
      createdAt: movement.createdAt.toISOString(),
    })),
    allCategories: record.categories.map(({ category }) => ({
      id: category.id,
      title: category.title,
      isActive: category.isActive,
      archivedAt: category.archivedAt?.toISOString() || null,
    })),
  };
}

export type AdminProductDetail = NonNullable<
  Awaited<ReturnType<typeof getAdminProductDetail>>
>;
