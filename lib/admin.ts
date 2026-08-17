import {
  DeliveryStatus,
  LoyaltyTier,
  OrderStatus,
  PaymentMethod,
  PaymentStatus,
  Prisma,
  ProductStatus,
  PromoDiscountType,
} from "@prisma/client";
import { auth, currentUser } from "@clerk/nextjs/server";
import { unstable_cache } from "next/cache";
import { redirect } from "next/navigation";
import { cache } from "react";

import { prisma } from "@/lib/prisma";

const splitEnvList = (value: string | undefined) =>
  new Set(
    (value || "")
      .split(",")
      .map((entry) => entry.trim().toLowerCase())
      .filter(Boolean)
  );

const adminEmailSet = () => splitEnvList(process.env.ADMIN_EMAILS);
const adminUserIdSet = () => splitEnvList(process.env.ADMIN_USER_IDS);

const decimalToNumber = (value: Prisma.Decimal | number | null | undefined) => {
  if (value === null || value === undefined) {
    return 0;
  }

  return typeof value === "number" ? value : Number(value);
};

const primaryEmailFromUser = (user: Awaited<ReturnType<typeof currentUser>>) => {
  if (!user) {
    return null;
  }

  return (
    user.emailAddresses.find(
      (email) => email.id === user.primaryEmailAddressId
    )?.emailAddress ||
    user.emailAddresses[0]?.emailAddress ||
    null
  );
};

export type AdminOrderStage =
  | "pending"
  | "confirmed"
  | "preparing"
  | "shipped"
  | "delivered"
  | "cancelled";

export const productStatusOptions = [
  { value: "new", label: "Nouveau" },
  { value: "hot", label: "Tendance" },
  { value: "sale", label: "Promotion" },
] as const satisfies ReadonlyArray<{ value: ProductStatus; label: string }>;

export const promoDiscountTypeOptions = [
  { value: "percentage", label: "Pourcentage" },
  { value: "fixed", label: "Montant fixe" },
] as const satisfies ReadonlyArray<{
  value: PromoDiscountType;
  label: string;
}>;

export const paymentMethodOptions = [
  { value: "cod", label: "Paiement a la livraison" },
  { value: "cmi_card", label: "Carte bancaire" },
  { value: "installments", label: "Paiement en plusieurs fois" },
] as const satisfies ReadonlyArray<{
  value: PaymentMethod;
  label: string;
}>;

export const adminOrderStageOptions = [
  { value: "pending", label: "En attente" },
  { value: "confirmed", label: "Confirmee" },
  { value: "preparing", label: "En preparation" },
  { value: "shipped", label: "Expediee" },
  { value: "delivered", label: "Livree" },
  { value: "cancelled", label: "Annulee" },
] as const satisfies ReadonlyArray<{ value: AdminOrderStage; label: string }>;

export const getAdminOrderStage = (status: OrderStatus): AdminOrderStage => {
  switch (status) {
    case "processing":
      return "confirmed";
    case "paid":
      return "preparing";
    case "shipped":
    case "out_for_delivery":
      return "shipped";
    case "delivered":
      return "delivered";
    case "cancelled":
      return "cancelled";
    case "pending":
    default:
      return "pending";
  }
};

export const adminStageToOrderStatus = (stage: AdminOrderStage): OrderStatus => {
  switch (stage) {
    case "confirmed":
      return "processing";
    case "preparing":
      return "paid";
    case "shipped":
      return "shipped";
    case "delivered":
      return "delivered";
    case "cancelled":
      return "cancelled";
    case "pending":
    default:
      return "pending";
  }
};

export const orderStatusToDeliveryStatus = (status: OrderStatus): DeliveryStatus => {
  switch (status) {
    case "paid":
      return "preparing";
    case "shipped":
      return "in_transit";
    case "out_for_delivery":
      return "out_for_delivery";
    case "delivered":
      return "delivered";
    case "cancelled":
      return "failed";
    case "pending":
    case "processing":
    default:
      return "not_assigned";
  }
};

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

export type AdminIdentity = {
  userId: string | null;
  email: string | null;
  displayName: string | null;
  isAdmin: boolean;
  accessConfigured: boolean;
  usesDevelopmentFallback: boolean;
};

export const getAdminIdentity = cache(async (): Promise<AdminIdentity> => {
  const emails = adminEmailSet();
  const userIds = adminUserIdSet();
  const accessConfigured = emails.size > 0 || userIds.size > 0;
  const usesDevelopmentFallback =
    !accessConfigured && process.env.NODE_ENV !== "production";
  const { userId } = await auth();

  if (!userId) {
    return {
      userId: null,
      email: null,
      displayName: null,
      isAdmin: false,
      accessConfigured,
      usesDevelopmentFallback: false,
    };
  }

  const normalizedUserId = userId.toLowerCase();
  if (userIds.has(normalizedUserId)) {
    return {
      userId,
      email: null,
      displayName: userId,
      isAdmin: true,
      accessConfigured,
      usesDevelopmentFallback: false,
    };
  }

  if (usesDevelopmentFallback) {
    return {
      userId,
      email: null,
      displayName: userId,
      isAdmin: true,
      accessConfigured,
      usesDevelopmentFallback: true,
    };
  }

  let user: Awaited<ReturnType<typeof currentUser>> | null = null;

  try {
    user = await currentUser();
  } catch (error) {
    console.error("Failed to load Clerk currentUser for admin identity:", error);
  }

  const email = primaryEmailFromUser(user);
  const displayName =
    user?.fullName ||
    [user?.firstName, user?.lastName].filter(Boolean).join(" ") ||
    email ||
    userId;
  const isConfiguredAdmin = email ? emails.has(email.toLowerCase()) : false;

  return {
    userId,
    email,
    displayName,
    isAdmin: accessConfigured ? isConfiguredAdmin : usesDevelopmentFallback,
    accessConfigured,
    usesDevelopmentFallback,
  };
});

export const requireAdmin = async () => {
  const identity = await getAdminIdentity();

  if (!identity.userId) {
    redirect("/");
  }

  if (!identity.isAdmin) {
    redirect("/admin");
  }

  return identity;
};

export type AdminDashboardData = {
  metrics: {
    totalRevenue: number;
    totalOrders: number;
    pendingOrders: number;
    totalProducts: number;
    totalCategories: number;
    totalBrands: number;
    activePromoCodes: number;
    expiringPromoCodes: number;
    lowStockProducts: number;
    totalCustomers: number;
  };
  categories: Array<{
    id: string;
    title: string;
    sortOrder: number;
    description: string | null;
    featured: boolean;
    productCount: number;
    imageUrl: string | null;
    updatedAt: Date;
  }>;
  brands: Array<{
    id: string;
    title: string;
    description: string | null;
    productCount: number;
    imageUrl: string | null;
    isActive: boolean;
    archivedAt: Date | null;
    updatedAt: Date;
  }>;
  products: Array<{
    id: string;
    name: string;
    description: string | null;
    price: number;
    discount: number;
    stock: number;
    lastRestockedAt: Date | null;
    status: ProductStatus;
    isFeatured: boolean;
    brandId: string | null;
    brandTitle: string | null;
    categoryIds: string[];
    categoryTitles: string[];
    imageUrl: string | null;
    imageUrls: string[];
    imagesCount: number;
    updatedAt: Date;
  }>;
  promoCodes: Array<{
    id: string;
    title: string;
    code: string;
    active: boolean;
    discountType: PromoDiscountType;
    discountValue: number;
    endsAt: Date | null;
    updatedAt: Date;
  }>;
  orders: Array<{
    id: string;
    orderNumber: string;
    customerName: string;
    email: string;
    phone: string | null;
    address: string | null;
    city: string | null;
    state: string | null;
    zip: string | null;
    totalPrice: number;
    status: OrderStatus;
    adminStage: AdminOrderStage;
    deliveryStatus: DeliveryStatus;
    deliveryCompany: string | null;
    deliveryPersonName: string | null;
    driverPhoneNumber: string | null;
    trackingNumber: string | null;
    paymentStatus: PaymentStatus;
    paymentMethod: PaymentMethod;
    orderDate: Date;
    itemsCount: number;
    items: Array<{
      id: string;
      name: string;
      imageUrl: string | null;
      quantity: number;
      unitPrice: number;
      isOutOfStock?: boolean;
      isStockInsufficient?: boolean;
    }>;
  }>;
  orderStageBreakdown: Array<{
    status: AdminOrderStage;
    label: string;
    count: number;
  }>;
  paymentStatusBreakdown: Array<{
    status: PaymentStatus;
    count: number;
  }>;
  customers: Array<{
    id: string;
    fullName: string;
    email: string;
    loyaltyTier: LoyaltyTier;
    loyaltyPoints: number;
    installmentsEligible: boolean;
    orderCount: number;
    totalSpent: number;
    lastOrderDate: Date | null;
    createdAt: Date;
  }>;
  lowStockItems: Array<{
    id: string;
    name: string;
    stock: number;
    lastRestockedAt: Date | null;
    imageUrl: string | null;
  }>;
};

export type AdminShellMetrics = {
  pendingOrders: number;
  lowStockProducts: number;
  expiringPromoCodes: number;
};

const ADMIN_DATA_TAG = "admin-data";

const toDate = (value: Date | string | null) => (value ? new Date(value) : null);

const fetchAdminShellMetrics = async (): Promise<AdminShellMetrics> => {
  const [pendingOrders, lowStockProducts, expiringPromoCodes] = await Promise.all([
    prisma.order.count({
      where: {
        status: {
          in: ["pending", "processing", "paid", "shipped", "out_for_delivery"],
        },
      },
    }),
    prisma.product.count({
      where: {
        stock: {
          lte: 5,
        },
      },
    }),
    prisma.promoCode.count({
      where: {
        active: true,
        endsAt: {
          gte: new Date(),
          lte: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        },
      },
    }),
  ]);

  return {
    pendingOrders,
    lowStockProducts,
    expiringPromoCodes,
  };
};

const getCachedAdminShellMetrics = unstable_cache(fetchAdminShellMetrics, ["admin-shell-metrics"], {
  tags: [ADMIN_DATA_TAG],
  revalidate: 120,
});

export const getAdminShellMetrics = async (): Promise<AdminShellMetrics> => getCachedAdminShellMetrics();

const fetchAdminDashboardData = async (): Promise<AdminDashboardData> => {
  const [
    totalOrders,
    totalProducts,
    totalCategories,
    totalBrands,
    activePromoCodes,
    totalCustomers,
    paidRevenueAggregate,
    categories,
    brands,
    products,
    promoCodes,
    orders,
    lowStockItems,
    paymentStatusBreakdown,
    customers,
  ] = await Promise.all([
    prisma.order.count(),
    prisma.product.count(),
    prisma.category.count({ where: { archivedAt: null } }),
    prisma.brand.count(),
    prisma.promoCode.count({
      where: {
        active: true,
      },
    }),
    prisma.user.count(),
    prisma.order.aggregate({
      where: {
        status:        "delivered",
        paymentStatus: "paid",
      },
      _sum: {
        totalPrice: true,
      },
    }),
    prisma.category.findMany({
      where: { archivedAt: null },
      orderBy: [{ range: "asc" }, { title: "asc" }],
      include: {
        _count: {
          select: {
            products: true,
          },
        },
      },
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
    prisma.product.findMany({
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
          select: {
            category: {
              select: {
                id: true,
                title: true,
              },
            },
          },
        },
      },
      take: 36,
    }),
    prisma.promoCode.findMany({
      orderBy: {
        updatedAt: "desc",
      },
      take: 24,
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
          },
        },
      },
      take: 40,
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
      take: 8,
    }),
    prisma.order.groupBy({
      by: ["paymentStatus"],
      _count: {
        paymentStatus: true,
      },
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
            status: true,
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
      take: 12,
    }),
  ]);

  const orderStatusCounts = orders.reduce<Partial<Record<OrderStatus, number>>>(
    (accumulator, order) => {
      accumulator[order.status] = (accumulator[order.status] || 0) + 1;
      return accumulator;
    },
    {}
  );
  const orderStageBreakdown = buildOrderStageBreakdown(orderStatusCounts);
  const pendingOrders = orderStageBreakdown
    .filter((item) =>
      ["pending", "confirmed", "preparing", "shipped"].includes(item.status)
    )
    .reduce((sum, item) => sum + item.count, 0);
  const expiringPromoCodes = promoCodes.filter((promo) => {
    if (!promo.active || !promo.endsAt) {
      return false;
    }

    return promo.endsAt.getTime() <= Date.now() + 7 * 24 * 60 * 60 * 1000;
  }).length;

  return {
    metrics: {
      totalRevenue: decimalToNumber(paidRevenueAggregate._sum.totalPrice),
      totalOrders,
      pendingOrders,
      totalProducts,
      totalCategories,
      totalBrands,
      activePromoCodes,
      expiringPromoCodes,
      lowStockProducts: lowStockItems.length,
      totalCustomers,
    },
    categories: categories.map((category) => ({
      id: category.id,
      title: category.title,
      sortOrder: category.range ?? 0,
      description: category.description,
      featured: category.featured,
      productCount: category._count.products,
      imageUrl: category.imageUrl,
      updatedAt: category.updatedAt,
    })),
    brands: brands.map((brand) => ({
      id: brand.id,
      title: brand.title,
      description: brand.description,
      productCount: brand._count.products,
      imageUrl: brand.imageUrl,
      isActive: brand.isActive,
      archivedAt: brand.archivedAt,
      updatedAt: brand.updatedAt,
    })),
    products: products.map((product) => ({
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
    })),
    promoCodes: promoCodes.map((promo) => ({
      id: promo.id,
      title: promo.title,
      code: promo.code,
      active: promo.active,
      discountType: promo.discountType,
      discountValue: decimalToNumber(promo.discountValue),
      endsAt: promo.endsAt,
      updatedAt: promo.updatedAt,
    })),
    orders: orders.map((order) => ({
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
      deliveryStatus: order.deliveryStatus,
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
      })),
    })),
    orderStageBreakdown,
    paymentStatusBreakdown: paymentStatusBreakdown.map((item) => ({
      status: item.paymentStatus,
      count: item._count.paymentStatus,
    })),
    customers: customers.map((customer) => {
      const paidOrders = customer.orders.filter(
        (order) => order.status === "delivered" && order.paymentStatus === "paid"
      );
      const totalSpent = paidOrders.reduce(
        (sum, order) => sum + decimalToNumber(order.totalPrice),
        0
      );

      return {
        id: customer.id,
        fullName: customer.fullName,
        email: customer.email,
        loyaltyTier: customer.loyaltyTier,
        loyaltyPoints: customer.loyaltyPoints,
        installmentsEligible: customer.installmentsEligible,
        orderCount: customer._count.orders,
        totalSpent,
        lastOrderDate: customer.orders[0]?.orderDate || null,
        createdAt: customer.createdAt,
      };
    }),
    lowStockItems: lowStockItems.map((item) => ({
      id: item.id,
      name: item.name,
      stock: item.stock,
      lastRestockedAt: item.lastRestockedAt,
      imageUrl: item.images[0]?.url || null,
    })),
  };
};

const getCachedAdminDashboardData = unstable_cache(fetchAdminDashboardData, ["admin-dashboard"], {
  tags: [ADMIN_DATA_TAG],
  revalidate: 120,
});

export const getAdminDashboardData = async (): Promise<AdminDashboardData> => {
  await requireAdmin();
  const data = await getCachedAdminDashboardData();

  return {
    ...data,
    categories: data.categories.map((category) => ({
      ...category,
      updatedAt: new Date(category.updatedAt),
    })),
    brands: data.brands.map((brand) => ({
      ...brand,
      updatedAt: new Date(brand.updatedAt),
    })),
    products: data.products.map((product) => ({
      ...product,
      lastRestockedAt: toDate(product.lastRestockedAt),
      updatedAt: new Date(product.updatedAt),
    })),
    promoCodes: data.promoCodes.map((promo) => ({
      ...promo,
      endsAt: toDate(promo.endsAt),
      updatedAt: new Date(promo.updatedAt),
    })),
    orders: data.orders.map((order) => ({
      ...order,
      orderDate: new Date(order.orderDate),
    })),
    customers: data.customers.map((customer) => ({
      ...customer,
      lastOrderDate: toDate(customer.lastOrderDate),
      createdAt: new Date(customer.createdAt),
    })),
    lowStockItems: data.lowStockItems.map((item) => ({
      ...item,
      lastRestockedAt: toDate(item.lastRestockedAt),
    })),
  };
};

export const getAdminDataTag = () => ADMIN_DATA_TAG;
