import {
  calculatePromoDiscount,
  type PaymentMethod,
  type PromoCalculationResult,
} from "@/lib/promo";
import { prisma } from "@/lib/prisma";
import { adjustInventoryInTransaction } from "@/lib/inventory";
import { getEffectiveProductUnitPrice } from "@/lib/products/domain";
import { upsertAppUser, type AppUserIdentity } from "@/lib/services/customer";
import { findPromoCodeByCode, incrementPromoUsage } from "@/lib/services/promo";
import { sendOrderConfirmationWhatsApp } from "@/lib/services/whatsapp";
import type { Address, Product } from "@/types";

type GroupedCartItem = {
  product: Product;
  quantity: number;
};

type CreateManualOrderInput = {
  items: GroupedCartItem[];
  address?: Address | null;
  paymentMethod: Exclude<PaymentMethod, "cmi_card">;
  promoCode?: string;
  installmentMonths?: number;
  identity: AppUserIdentity;
};

const orderProductSelect = {
  id: true,
  name: true,
  price: true,
  regularPrice: true,
  salePrice: true,
  isPromotion: true,
  discount: true,
  promotionStartsAt: true,
  promotionEndsAt: true,
  stock: true,
  images: {
    orderBy: {
      sortOrder: "asc" as const,
    },
    select: {
      url: true,
    },
  },
};

const normalizeInstallmentMonths = (value?: number | null) =>
  value === 6 || value === 12 ? value : 3;

const buildQuantityMap = (items: GroupedCartItem[]) => {
  const quantityByProductId = new Map<string, number>();

  for (const item of items) {
    const productId = item.product?._id;
    if (!productId) {
      throw new Error("Invalid product in cart");
    }

    const quantity = Math.max(1, item.quantity || 0);
    quantityByProductId.set(
      productId,
      (quantityByProductId.get(productId) || 0) + quantity
    );
  }

  return quantityByProductId;
};

export async function createManualOrderRecord(input: CreateManualOrderInput) {
  if (!input.items.length) {
    throw new Error("Cart is empty");
  }

  const appUser = await upsertAppUser(input.identity);
  const quantityByProductId = buildQuantityMap(input.items);
  const productIds = [...quantityByProductId.keys()];

  const products = await prisma.product.findMany({
    where: {
      lifecycleStatus: "ACTIVE",
      isActive: true,
      archivedAt: null,
      id: {
        in: productIds,
      },
    },
    select: orderProductSelect,
  });

  const productById = new Map(products.map((product) => [product.id, product]));
  let subtotal = 0;

  for (const productId of productIds) {
    const product = productById.get(productId);
    const requestedQty = quantityByProductId.get(productId) || 0;

    if (!product) {
      throw new Error("One or more products are unavailable");
    }

    subtotal += getEffectiveProductUnitPrice(product) * requestedQty;
  }

  const promoCode = input.promoCode?.trim().toUpperCase();
  let promoCalculation: PromoCalculationResult = {
    valid: false,
    discountAmount: 0,
    finalTotal: subtotal,
  };

  if (promoCode) {
    const promo = await findPromoCodeByCode(promoCode);
    promoCalculation = calculatePromoDiscount(promo, subtotal, input.paymentMethod);
    if (!promoCalculation.valid) {
      throw new Error(promoCalculation.message || "Invalid promo code");
    }
  }

  const installmentMonths =
    input.paymentMethod === "installments"
      ? normalizeInstallmentMonths(input.installmentMonths)
      : null;

  const order = await prisma.$transaction(async (tx) => {
    const liveProducts = await tx.product.findMany({
      where: {
        lifecycleStatus: "ACTIVE",
        isActive: true,
        archivedAt: null,
        id: {
          in: productIds,
        },
      },
      select: orderProductSelect,
    });
    const liveProductById = new Map(
      liveProducts.map((product) => [product.id, product])
    );

    for (const productId of productIds) {
      const product = liveProductById.get(productId);

      if (!product) {
        throw new Error("One or more products are unavailable");
      }
    }

    const createdOrder = await tx.order.create({
      data: {
        orderNumber: crypto.randomUUID(),
        userId: appUser.id,
        clerkUserId: appUser.clerkUserId,
        customerName: input.identity.fullName,
        email: input.identity.email,
        currency: "MAD",
        paymentMethod: input.paymentMethod,
        paymentStatus: input.paymentMethod === "cod" ? "pending" : "partial",
        status: "pending",
        totalPrice: promoCalculation.finalTotal,
        amountDiscount: promoCalculation.discountAmount,
        promoCode: promoCode || null,
        promoDiscount: promoCalculation.discountAmount,
        orderDate: new Date(),
        installmentMonths,
        installmentMonthlyAmount: installmentMonths
          ? promoCalculation.finalTotal / installmentMonths
          : null,
        shippingName: input.address?.name || null,
        shippingPhone: input.address?.phone || null,
        shippingAddress: input.address?.address || null,
        shippingCity: input.address?.city || null,
        shippingState: input.address?.state || null,
        shippingZip: input.address?.zip || null,
        items: {
          create: productIds.map((productId) => {
            const product = liveProductById.get(productId);
            const quantity = quantityByProductId.get(productId) || 0;

            if (!product) {
              throw new Error("One or more products are unavailable");
            }

            return {
              productId: product.id,
              productNameSnapshot: product.name,
              productPriceSnapshot: getEffectiveProductUnitPrice(product),
              productImageUrlSnapshot: product.images[0]?.url || null,
              quantity,
            };
          }),
        },
      },
    });

    for (const productId of productIds) {
      const requestedQty = quantityByProductId.get(productId) || 0;
      await adjustInventoryInTransaction(tx, {
        productId,
        quantityDelta: -requestedQty,
        reason: "ORDER",
        relatedOrderId: createdOrder.id,
        idempotencyKey: `order:${createdOrder.id}:reserve:${productId}`,
        actor: {
          userId: appUser.clerkUserId,
          email: input.identity.email,
          name: input.identity.fullName,
        },
        note: `Réservation commande ${createdOrder.orderNumber}`,
      });
    }

    await tx.orderEvent.create({
      data: {
        orderId: createdOrder.id,
        type: "ORDER_CREATED",
        title: "Commande créée",
        description:
          input.paymentMethod === "cod"
            ? "Commande créée avec paiement à la livraison."
            : "Commande créée avec paiement en ligne.",
        actorUserId: appUser.clerkUserId,
        actorEmail: input.identity.email,
        actorName: input.identity.fullName,
        metadata: {
          paymentMethod: input.paymentMethod,
          source: "storefront",
        },
      },
    });

    if (promoCalculation.valid && promoCalculation.promoId) {
      await incrementPromoUsage(tx, promoCalculation.promoId);
    }

    return createdOrder;
  });

  await sendOrderConfirmationWhatsApp({
    customerName: order.customerName,
    orderNumber: order.orderNumber,
    phone: order.shippingPhone,
  });

  return {
    orderId: order.id,
    orderNumber: order.orderNumber,
  };
}
