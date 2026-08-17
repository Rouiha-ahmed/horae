import { Prisma } from "@prisma/client";

import { mapProduct } from "@/lib/data/mappers";
import { prisma } from "@/lib/prisma";
import { sellableProductWhere } from "@/lib/products/storefront-rules";
import type { Product } from "@/types";

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
    include: {
      category: {
        select: {
          title: true,
        },
      },
    },
  },
};

type ProductRecord = Prisma.ProductGetPayload<{
  select: typeof productSelect;
}>;

export type StorefrontCustomHomepageProductSection = {
  id: string;
  title: string;
  subtitle: string | null;
  slug: string;
  order: number;
  products: Product[];
};

const toProduct = (product: ProductRecord) => mapProduct(product);

const homepageProductSectionEntities = [
  "HomepageProductSection",
  "HomepageProductSectionItem",
];

const isHomepageProductSectionSchemaError = (error: unknown) => {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError)) {
    return false;
  }

  if (error.code !== "P2021" && error.code !== "P2022") {
    return false;
  }

  const meta = error.meta as Prisma.JsonObject | undefined;
  const rawTable =
    (typeof meta?.table === "string" && meta.table) ||
    (typeof meta?.column === "string" && meta.column) ||
    "";

  return homepageProductSectionEntities.some((entity) => rawTable.includes(entity));
};

const hasHomepageProductSectionDelegates = () => {
  const raw = prisma as unknown as Record<string, unknown>;
  const sectionDelegate = raw["homepageProductSection"] as
    | {
        findMany?: unknown;
      }
    | undefined;
  const itemDelegate = raw["homepageProductSectionItem"] as
    | {
        findMany?: unknown;
      }
    | undefined;

  return Boolean(
    sectionDelegate &&
      typeof sectionDelegate.findMany === "function" &&
      itemDelegate &&
      typeof itemDelegate.findMany === "function"
  );
};

const isMissingHomepageProductSectionDelegateError = (error: unknown) => {
  if (!(error instanceof TypeError)) {
    return false;
  }

  const message = String(error.message || "").toLowerCase();
  return (
    message.includes("findmany") &&
    (message.includes("undefined") ||
      message.includes("homepageproductsection") ||
      message.includes("homepageproductsectionitem"))
  );
};

export async function getStorefrontCustomHomepageProductSections(): Promise<
  StorefrontCustomHomepageProductSection[]
> {
  if (!hasHomepageProductSectionDelegates()) {
    return [];
  }

  let rows: Array<{
    id: string;
    title: string;
    subtitle: string | null;
    slug: string;
    order: number;
    items: Array<{
      order: number;
      product: ProductRecord;
    }>;
  }> = [];

  try {
    rows = await prisma.homepageProductSection.findMany({
      where: {
        isActive: true,
      },
      orderBy: [{ order: "asc" }, { createdAt: "asc" }],
      include: {
        items: {
          orderBy: [{ order: "asc" }, { createdAt: "asc" }],
          where: {
            product: {
              ...sellableProductWhere,
            },
          },
          include: {
            product: {
              select: productSelect,
            },
          },
        },
      },
    });
  } catch (error) {
    if (
      isHomepageProductSectionSchemaError(error) ||
      isMissingHomepageProductSectionDelegateError(error)
    ) {
      return [];
    }
    throw error;
  }

  return rows
    .map((row) => ({
      id: row.id,
      title: row.title,
      subtitle: row.subtitle,
      slug: row.slug,
      order: row.order,
      products: row.items
        .map((item) => item.product)
        .filter((item): item is ProductRecord => Boolean(item))
        .map(toProduct),
    }))
    .filter((section) => section.products.length > 0 && section.title.trim());
}
