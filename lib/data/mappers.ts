import type { Prisma } from "@prisma/client";

import type { Address, AppImage, Brand, Category, MyOrder, Product } from "@/types";
import { isProductPromotionCurrentlyActive } from "@/lib/products/domain";

const decimalToNumber = (value: Prisma.Decimal | number | null | undefined) => {
  if (value === null || value === undefined) {
    return undefined;
  }

  return typeof value === "number" ? value : Number(value);
};

const toImage = (
  url: string | null | undefined,
  key: string,
  alt?: string | null
): AppImage | null => {
  if (!url) {
    return null;
  }

  return {
    _key: key,
    _type: "image",
    alt: alt || undefined,
    url,
    asset: {
      _ref: key,
      _type: "reference",
      url,
    },
  };
};

export const mapBrand = (brand: {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  imageUrl: string | null;
}): Brand => ({
  _id: brand.id,
  title: brand.title,
  slug: { current: brand.slug },
  description: brand.description,
  image: toImage(brand.imageUrl, `${brand.id}-image`),
});

export const mapCategory = (category: {
  id: string;
  title: string;
  slug: string;
  sortOrder?: number;
  description: string | null;
  range: number | null;
  featured: boolean;
  imageUrl: string | null;
  parentId?: string | null;
  parent?: {
    title: string;
  } | null;
  _count?: {
    products: number;
  };
}): Category => ({
  _id: category.id,
  title: category.title,
  slug: { current: category.slug },
  sortOrder: category.sortOrder ?? category.range ?? 0,
  description: category.description,
  range: category.range,
  featured: category.featured,
  image: toImage(category.imageUrl, `${category.id}-image`),
  productCount: category._count?.products,
  parentId: category.parentId || null,
  parentTitle: category.parent?.title || null,
});

export const mapProduct = (product: {
  id: string;
  name: string;
  slug: string;
  sku?: string;
  barcode?: string | null;
  shortDescription?: string | null;
  fullDescription?: string | null;
  description: string | null;
  price: Prisma.Decimal | number;
  regularPrice?: Prisma.Decimal | number | null;
  salePrice?: Prisma.Decimal | number | null;
  discount: number;
  stock: number;
  status: string | null;
  isActive?: boolean;
  isFeatured: boolean;
  isBestSeller?: boolean;
  isNewArrival?: boolean;
  isPromotion?: boolean;
  promotionStartsAt?: Date | string | null;
  promotionEndsAt?: Date | string | null;
  brand?: {
    id: string;
    title: string;
    slug: string;
    description: string | null;
    imageUrl: string | null;
  } | null;
  images: Array<{
    id: string;
    url: string;
    altText: string | null;
  }>;
  categories: Array<{
    category: {
      title: string;
    };
  }>;
}): Product => {
  const sourcePrice = decimalToNumber(product.price) ?? 0;
  const regularPrice = decimalToNumber(product.regularPrice) ?? sourcePrice;
  const salePrice = decimalToNumber(product.salePrice);
  const promotionActive = isProductPromotionCurrentlyActive({
    isPromotion: Boolean(product.isPromotion),
    discount: product.discount,
    promotionStartsAt: product.promotionStartsAt ?? null,
    promotionEndsAt: product.promotionEndsAt ?? null,
  });
  const price = promotionActive ? (salePrice ?? sourcePrice) : regularPrice;
  const derivedDiscount =
    regularPrice > 0 && typeof salePrice === "number" && salePrice > 0 && salePrice < regularPrice
      ? Math.round(((regularPrice - salePrice) / regularPrice) * 100)
      : 0;

  return {
    _id: product.id,
    name: product.name,
    slug: { current: product.slug },
    sku: product.sku,
    barcode: product.barcode || null,
    shortDescription: product.shortDescription || null,
    fullDescription: product.fullDescription || null,
    description:
      product.description || product.shortDescription || product.fullDescription || null,
    price,
    regularPrice,
    salePrice: promotionActive ? (salePrice ?? sourcePrice) : null,
    discount: promotionActive
      ? product.discount > 0
        ? product.discount
        : derivedDiscount
      : 0,
    stock: product.stock,
    status: product.status as Product["status"],
    isActive: typeof product.isActive === "boolean" ? product.isActive : true,
    isFeatured: product.isFeatured,
    isBestSeller: Boolean(product.isBestSeller),
    isNewArrival: Boolean(product.isNewArrival),
    isPromotion: promotionActive,
    brand: product.brand ? mapBrand(product.brand) : null,
    images: product.images
      .map((image) => toImage(image.url, image.id, image.altText))
      .filter((image): image is AppImage => Boolean(image)),
    categories: product.categories.map((item) => item.category.title),
  };
};

export const mapAddress = (
  address: {
    id: string;
    name: string;
    address: string;
    city: string;
    phone: string;
    state: string;
    zip: string;
    isDefault: boolean;
    createdAt: Date;
  },
  user?: {
    email: string;
    clerkUserId: string;
  }
): Address => ({
  _id: address.id,
  name: address.name,
  email: user?.email,
  clerkUserId: user?.clerkUserId,
  address: address.address,
  city: address.city,
  phone: address.phone,
  state: address.state,
  zip: address.zip,
  default: address.isDefault,
  createdAt: address.createdAt.toISOString(),
});

export const mapOrder = (order: {
  id: string;
  updatedAt: Date;
  orderNumber: string;
  customerName: string;
  email: string;
  orderDate: Date;
  status: string;
  paymentStatus: string;
  paymentMethod: string;
  totalPrice: Prisma.Decimal | number;
  amountDiscount: Prisma.Decimal | number;
  currency: string;
  invoiceId: string | null;
  invoiceNumber: string | null;
  invoiceHostedUrl: string | null;
  shippingName: string | null;
  shippingPhone: string | null;
  shippingAddress: string | null;
  shippingCity: string | null;
  shippingState: string | null;
  shippingZip: string | null;
  items: Array<{
    id: string;
    quantity: number;
    productId: string | null;
    productNameSnapshot: string;
    productPriceSnapshot: Prisma.Decimal | number;
    productImageUrlSnapshot: string | null;
  }>;
}): MyOrder => ({
  _id: order.id,
  _updatedAt: order.updatedAt.toISOString(),
  orderNumber: order.orderNumber,
  customerName: order.customerName,
  email: order.email,
  orderDate: order.orderDate.toISOString(),
  status: order.status,
  paymentStatus: order.paymentStatus,
  paymentMethod: order.paymentMethod,
  totalPrice: decimalToNumber(order.totalPrice) ?? 0,
  amountDiscount: decimalToNumber(order.amountDiscount) ?? 0,
  currency: order.currency,
  invoice: order.invoiceNumber || order.invoiceHostedUrl || order.invoiceId
    ? {
        id: order.invoiceId || undefined,
        number: order.invoiceNumber || undefined,
        hosted_invoice_url: order.invoiceHostedUrl || undefined,
      }
    : null,
  address:
    order.shippingName ||
    order.shippingPhone ||
    order.shippingAddress ||
    order.shippingCity ||
    order.shippingState ||
    order.shippingZip
      ? {
          name: order.shippingName || undefined,
          phone: order.shippingPhone || undefined,
          address: order.shippingAddress || undefined,
          city: order.shippingCity || undefined,
          state: order.shippingState || undefined,
          zip: order.shippingZip || undefined,
        }
      : null,
  products: order.items.map((item) => ({
    _key: item.id,
    quantity: item.quantity,
    product: {
      _id: item.productId || item.id,
      name: item.productNameSnapshot,
      price: decimalToNumber(item.productPriceSnapshot) ?? 0,
      images: item.productImageUrlSnapshot
        ? [toImage(item.productImageUrlSnapshot, `${item.id}-image`)].filter(
            (image): image is AppImage => Boolean(image)
          )
        : [],
    },
  })),
});
