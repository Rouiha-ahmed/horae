import { Prisma } from "@prisma/client";
import { unstable_cache } from "next/cache";

import { mapBrand, mapCategory, mapOrder, mapProduct } from "@/lib/data/mappers";
import { prisma } from "@/lib/prisma";
import {
  activeProductPromotionWhere,
  sellableProductWhere,
} from "@/lib/products/storefront-rules";
import type { BRANDS_QUERYResult, Category, Product } from "@/types";

const productSelect = {
  id: true,
  name: true,
  slug: true,
  description: true,
  price: true,
  regularPrice: true,
  salePrice: true,
  discount: true,
  stock: true,
  status: true,
  isActive: true,
  isFeatured: true,
  isPromotion: true,
  promotionStartsAt: true,
  promotionEndsAt: true,
  images: {
    orderBy: {
      sortOrder: "asc" as const,
    },
    select: {
      id: true,
      url: true,
      altText: true,
    },
  },
  brand: {
    select: {
      id: true,
      title: true,
      slug: true,
      description: true,
      imageUrl: true,
    },
  },
  categories: {
    where: {
      category: { isActive: true, archivedAt: null },
    },
    include: {
      category: {
        select: {
          title: true,
        },
      },
    },
  },
};

export type SortOption = "relevance" | "price_asc" | "price_desc" | "name_asc" | "name_desc";

type SearchProductsInput = {
  selectedCategory?: string;
  selectedCategories?: string[];
  selectedCategoryId?: string;
  selectedBrand?: string;
  selectedBrands?: string[];
  searchTerm?: string;
  minPrice?: number | null;
  maxPrice?: number | null;
  limit?: number;
  sortBy?: SortOption;
};

const STOREFRONT_REVALIDATE = 300;
const PRODUCT_SEARCH_REVALIDATE = 120;

const VALID_SORT_OPTIONS: SortOption[] = ["relevance", "price_asc", "price_desc", "name_asc", "name_desc"];

const normalizeSearchProductsInput = ({
  selectedCategory,
  selectedCategories,
  selectedCategoryId,
  selectedBrand,
  selectedBrands,
  searchTerm,
  minPrice,
  maxPrice,
  limit,
  sortBy,
}: SearchProductsInput) => {
  const cats = selectedCategories?.filter(Boolean) || (selectedCategory?.trim() ? [selectedCategory.trim()] : []);
  const brnds = selectedBrands?.filter(Boolean) || (selectedBrand?.trim() ? [selectedBrand.trim()] : []);
  return {
    selectedCategories: cats,
    selectedCategoryId: selectedCategoryId?.trim() || "",
    selectedBrands: brnds,
    searchTerm: searchTerm?.trim() || "",
    minPrice:
      typeof minPrice === "number" && Number.isFinite(minPrice) ? minPrice : null,
    maxPrice:
      typeof maxPrice === "number" && Number.isFinite(maxPrice) ? maxPrice : null,
    limit: typeof limit === "number" && Number.isFinite(limit) && limit > 0 ? limit : null,
    sortBy: sortBy && VALID_SORT_OPTIONS.includes(sortBy) ? sortBy : ("relevance" as SortOption),
  };
};

const getCachedCategories = unstable_cache(
  async (quantity?: number): Promise<Category[]> => {
    const categories = await prisma.category.findMany({
      where: {
        isActive: true,
        archivedAt: null,
        OR: [
          { parentId: null },
          { parent: { is: { isActive: true, archivedAt: null } } },
        ],
      },
      orderBy: [{ range: "asc" }, { title: "asc" }],
      select: {
        id: true,
        title: true,
        slug: true,
        description: true,
        range: true,
        featured: true,
        imageUrl: true,
        parentId: true,
        _count: {
          select: {
            products: {
              where: { product: { is: sellableProductWhere } },
            },
          },
        },
      },
    });

    const roots = categories.filter((category) => !category.parentId);
    const ordered = roots.flatMap((root) => [
      root,
      ...categories.filter((category) => category.parentId === root.id),
    ]);
    return ordered.slice(0, quantity || undefined).map(mapCategory);
  },
  ["storefront-categories"],
  { revalidate: STOREFRONT_REVALIDATE }
);

const getCachedAllCategorySlugs = unstable_cache(
  async () => {
    const categories = await prisma.category.findMany({
      where: {
        isActive: true,
        archivedAt: null,
        OR: [
          { parentId: null },
          { parent: { is: { isActive: true, archivedAt: null } } },
        ],
      },
      orderBy: {
        slug: "asc",
      },
      select: {
        slug: true,
      },
    });

    return categories.map((category) => category.slug);
  },
  ["storefront-category-slugs"],
  { revalidate: STOREFRONT_REVALIDATE }
);

const getCachedFooterCategories = unstable_cache(
  async (quantity?: number) => {
    const categories = await prisma.category.findMany({
      where: {
        isActive: true,
        archivedAt: null,
        OR: [
          { parentId: null },
          { parent: { is: { isActive: true, archivedAt: null } } },
        ],
      },
      orderBy: [{ range: "asc" }, { title: "asc" }],
      take: quantity,
      select: {
        id: true,
        title: true,
        slug: true,
      },
    });

    return categories.map((category) => ({
      _id: category.id,
      title: category.title,
      slug: {
        current: category.slug,
      },
    }));
  },
  ["storefront-footer-categories"],
  { revalidate: STOREFRONT_REVALIDATE }
);

const getCachedAllBrands = unstable_cache(
  async (): Promise<BRANDS_QUERYResult> => {
    const brands = await prisma.brand.findMany({
      where: {
        isActive: true,
        archivedAt: null,
      },
      orderBy: {
        title: "asc",
      },
      select: {
        id: true,
        title: true,
        slug: true,
        description: true,
        imageUrl: true,
      },
    });

    return brands.map(mapBrand);
  },
  ["storefront-brands"],
  { revalidate: STOREFRONT_REVALIDATE }
);

const getCachedDealProducts = unstable_cache(
  async (): Promise<Product[]> => {
    const products = await prisma.product.findMany({
      where: {
        ...sellableProductWhere,
        stock: { gt: 0 },
        ...activeProductPromotionWhere(),
      },
      orderBy: {
        name: "asc",
      },
      select: productSelect,
    });

    return products.map(mapProduct);
  },
  ["storefront-deals"],
  { revalidate: STOREFRONT_REVALIDATE }
);

const getCachedProductBySlug = unstable_cache(
  async (slug: string): Promise<Product | null> => {
    const product = await prisma.product.findFirst({
      where: {
        slug,
        ...sellableProductWhere,
      },
      select: productSelect,
    });

    return product ? mapProduct(product) : null;
  },
  ["storefront-product-by-slug"],
  { revalidate: STOREFRONT_REVALIDATE }
);

const getCachedAllProductSlugs = unstable_cache(
  async () => {
    const products = await prisma.product.findMany({
      where: sellableProductWhere,
      orderBy: {
        slug: "asc",
      },
      select: {
        slug: true,
      },
    });

    return products.map((product) => product.slug);
  },
  ["storefront-product-slugs"],
  { revalidate: STOREFRONT_REVALIDATE }
);

const getCachedSearchProducts = unstable_cache(
  async (input: ReturnType<typeof normalizeSearchProductsInput>): Promise<Product[]> => {
    const filters: Prisma.ProductWhereInput[] = [];
    const tokens = input.searchTerm
      .split(/\s+/)
      .map((token) => token.trim())
      .filter(Boolean);

    if (input.selectedCategoryId) {
      filters.push({
        categories: {
          some: {
            categoryId: input.selectedCategoryId,
            category: { isActive: true, archivedAt: null },
          },
        },
      });
    }

    if (input.selectedCategories.length > 0) {
      filters.push({
        categories: {
          some: {
            category: {
              slug: { in: input.selectedCategories },
              isActive: true,
              archivedAt: null,
            },
          },
        },
      });
    }

    if (input.selectedBrands.length > 0) {
      filters.push({
        brand: {
          is: {
            slug: { in: input.selectedBrands },
          },
        },
      });
    }

    if (input.minPrice !== null && input.maxPrice !== null) {
      filters.push({
        price: {
          gte: new Prisma.Decimal(input.minPrice),
          lte: new Prisma.Decimal(input.maxPrice),
        },
      });
    }

    for (const token of tokens) {
      filters.push({
        OR: [
          {
            name: {
              contains: token,
              mode: "insensitive",
            },
          },
          {
            description: {
              contains: token,
              mode: "insensitive",
            },
          },
        ],
      });
    }

    const orderBy: Prisma.ProductOrderByWithRelationInput =
      input.sortBy === "price_asc"  ? { price: "asc" } :
      input.sortBy === "price_desc" ? { price: "desc" } :
      input.sortBy === "name_desc"  ? { name: "desc" } :
      { name: "asc" };

    const products = await prisma.product.findMany({
      where: {
        ...sellableProductWhere,
        ...(filters.length ? { AND: filters } : {}),
      },
      orderBy,
      take: input.limit || undefined,
      select: productSelect,
    });

    return products.map(mapProduct);
  },
  ["storefront-search-products"],
  { revalidate: PRODUCT_SEARCH_REVALIDATE }
);

export const getCategories = async (
  quantity?: number,
  _revalidate?: number
): Promise<Category[]> => {
  void _revalidate;
  return getCachedCategories(quantity);
};

export const getAllCategorySlugs = async () => getCachedAllCategorySlugs();

export const getFooterCategories = async (
  quantity?: number,
  _revalidate = 60
) => {
  void _revalidate;
  return getCachedFooterCategories(quantity);
};

export const getAllBrands = async (): Promise<BRANDS_QUERYResult> => getCachedAllBrands();

export const getDealProducts = async (): Promise<Product[]> => getCachedDealProducts();

export const getProductBySlug = async (slug: string): Promise<Product | null> => {
  return getCachedProductBySlug(slug);
};

export const getAllProductSlugs = async () => getCachedAllProductSlugs();

export const searchProducts = async ({
  selectedCategory,
  selectedCategories,
  selectedCategoryId,
  selectedBrand,
  selectedBrands,
  searchTerm,
  minPrice,
  maxPrice,
  limit,
  sortBy,
}: SearchProductsInput): Promise<Product[]> => {
  return getCachedSearchProducts(
    normalizeSearchProductsInput({
      selectedCategory,
      selectedCategories,
      selectedCategoryId,
      selectedBrand,
      selectedBrands,
      searchTerm,
      minPrice,
      maxPrice,
      limit,
      sortBy,
    })
  );
};

export const getProductsByCategoryId = async (categoryId: string) =>
  searchProducts({ selectedCategoryId: categoryId });

export const getProductsByCategorySlug = async (categorySlug: string) =>
  searchProducts({ selectedCategory: categorySlug });

export const getSearchSuggestions = async (query: string, limit = 6) =>
  searchProducts({ searchTerm: query, limit });

export const getMyOrders = async (userId: string) => {
  const orders = await prisma.order.findMany({
    where: {
      clerkUserId: userId,
    },
    orderBy: {
      orderDate: "desc",
    },
    include: {
      items: {
        orderBy: {
          createdAt: "asc",
        },
      },
    },
  });

  return orders.map(mapOrder);
};

export const getMyOrdersCount = async (userId: string) =>
  prisma.order.count({
    where: {
      clerkUserId: userId,
    },
  });

export const getMyLoyaltyData = async (clerkUserId: string) => {
  const user = await prisma.user.findUnique({
    where: { clerkUserId },
    select: {
      loyaltyPoints:     true,
      loyaltyTier:       true,
      loyaltyCardNumber: true,
      fullName:          true,
      createdAt:         true,
      orders: {
        where: { status: "delivered", paymentStatus: "paid" },
        select: { totalPrice: true, orderDate: true },
        orderBy: { orderDate: "desc" },
      },
    },
  });
  if (!user) return null;
  const totalSpent = user.orders.reduce((s, o) => s + Number(o.totalPrice), 0);
  const lastOrder  = user.orders[0]?.orderDate ?? null;
  return { ...user, totalSpent, lastOrder };
};
