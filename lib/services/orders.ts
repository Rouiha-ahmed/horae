import type { Stripe } from "stripe";

import {
  calculatePromoDiscount,
  type PaymentMethod,
  type PromoCalculationResult,
} from "@/lib/promo";
import { prisma } from "@/lib/prisma";
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

const normalizePaymentMethod = (value?: string | null): PaymentMethod => {
  if (value === "cod" || value === "installments" || value === "cmi_card") {
    return value;
  }

  return "cmi_card";
};

const parseAddress = (value?: string | null): Address | null => {
  if (!value) {
    return null;
  }

  try {
    return JSON.parse(value) as Address;
  } catch {
    return null;
  }
};

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

    subtotal += Number(product.price) * requestedQty;
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

    for (const productId of productIds) {
      const product = liveProductById.get(productId);
      const requestedQty = quantityByProductId.get(productId) || 0;

      if (!product) {
        continue;
      }

      await tx.product.update({
        where: {
          id: product.id,
        },
        data: {
          stock: Math.max(product.stock - requestedQty, 0),
        },
        select: {
          id: true,
        },
      });
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
              productPriceSnapshot: product.price,
              productImageUrlSnapshot: product.images[0]?.url || null,
              quantity,
            };
          }),
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

export async function createOrderFromStripeSession(
  session: Stripe.Checkout.Session,
  invoice: Stripe.Invoice | null,
  lineItems: Stripe.ApiList<Stripe.LineItem>
) {
  const existingOrder = await prisma.order.findUnique({
    where: {
      stripeCheckoutSessionId: session.id,
    },
  });

  if (existingOrder) {
    return existingOrder;
  }

  const metadata = session.metadata || {};
  const orderNumber = metadata.orderNumber || crypto.randomUUID();
  const customerName =
    metadata.customerName || session.customer_details?.name || "Customer";
  const customerEmail =
    metadata.customerEmail || session.customer_details?.email || "";
  const clerkUserId = metadata.clerkUserId || undefined;
  const paymentMethod = normalizePaymentMethod(metadata.paymentMethod);
  const promoCode = metadata.promoCode?.trim().toUpperCase() || "";
  const promoDiscount = Number(metadata.promoDiscount || 0);
  const installmentMonths = metadata.installmentMonths
    ? normalizeInstallmentMonths(Number(metadata.installmentMonths))
    : null;
  const parsedAddress = parseAddress(metadata.address);

  if (!customerEmail) {
    throw new Error("Customer email is not available");
  }

  const appUser = clerkUserId
    ? await upsertAppUser({
        clerkUserId,
        fullName: customerName,
        email: customerEmail,
      })
    : null;

  const quantityByProductId = new Map<string, number>();
  for (const item of lineItems.data) {
    const stripeProduct = item.price?.product as Stripe.Product | null;
    const productId = stripeProduct?.metadata?.id;
    const quantity = Math.max(0, item.quantity || 0);

    if (!productId || quantity <= 0) {
      continue;
    }

    quantityByProductId.set(
      productId,
      (quantityByProductId.get(productId) || 0) + quantity
    );
  }

  const productIds = [...quantityByProductId.keys()];
  let createdOrder = false;

  const order = await prisma.$transaction(async (tx) => {
    const duplicate = await tx.order.findUnique({
      where: {
        stripeCheckoutSessionId: session.id,
      },
    });

    if (duplicate) {
      return duplicate;
    }

    const products = await tx.product.findMany({
      where: {
        id: {
          in: productIds,
        },
      },
      select: orderProductSelect,
    });
    const productById = new Map(products.map((product) => [product.id, product]));

    for (const productId of productIds) {
      const product = productById.get(productId);
      const quantity = quantityByProductId.get(productId) || 0;

      if (!product) {
        continue;
      }

      await tx.product.update({
        where: {
          id: product.id,
        },
        data: {
          stock: Math.max(product.stock - quantity, 0),
        },
        select: {
          id: true,
        },
      });
    }

    const order = await tx.order.create({
      data: {
        orderNumber,
        userId: appUser?.id || null,
        clerkUserId: clerkUserId || null,
        customerName,
        email: customerEmail,
        currency: (session.currency || "mad").toUpperCase(),
        status: "paid",
        paymentStatus: "paid",
        paymentMethod,
        totalPrice: (session.amount_total || 0) / 100,
        amountDiscount: promoDiscount,
        promoCode: promoCode || null,
        promoDiscount,
        orderDate: new Date(),
        installmentMonths,
        installmentMonthlyAmount: installmentMonths
          ? ((session.amount_total || 0) / 100) / installmentMonths
          : null,
        shippingName: parsedAddress?.name || null,
        shippingPhone: parsedAddress?.phone || null,
        shippingAddress: parsedAddress?.address || null,
        shippingCity: parsedAddress?.city || null,
        shippingState: parsedAddress?.state || null,
        shippingZip: parsedAddress?.zip || null,
        invoiceId: invoice?.id || null,
        invoiceNumber: invoice?.number || null,
        invoiceHostedUrl: invoice?.hosted_invoice_url || null,
        stripeCheckoutSessionId: session.id,
        stripeCustomerId:
          typeof session.customer === "string" ? session.customer : null,
        stripePaymentIntentId:
          typeof session.payment_intent === "string"
            ? session.payment_intent
            : null,
        items: {
          create: lineItems.data.map((item) => {
            const stripeProduct = item.price?.product as Stripe.Product | null;
            const productId = stripeProduct?.metadata?.id || null;
            const product = productId ? productById.get(productId) : null;
            const quantity = Math.max(1, item.quantity || 1);
            const unitAmount =
              item.amount_subtotal && quantity
                ? item.amount_subtotal / 100 / quantity
                : 0;

            return {
              productId: product?.id || null,
              productNameSnapshot:
                product?.name || item.description || stripeProduct?.name || "Produit",
              productPriceSnapshot: product?.price || unitAmount,
              productImageUrlSnapshot:
                product?.images[0]?.url || stripeProduct?.images?.[0] || null,
              quantity,
            };
          }),
        },
      },
    });
    createdOrder = true;

    if (promoCode) {
      const promo = await tx.promoCode.findUnique({
        where: { code: promoCode },
      });
      if (promo) {
        await incrementPromoUsage(tx, promo.id);
      }
    }

    if (
      appUser &&
      typeof session.customer === "string" &&
      appUser.stripeCustomerId !== session.customer
    ) {
      await tx.user.update({
        where: {
          id: appUser.id,
        },
        data: {
          stripeCustomerId: session.customer,
        },
      });
    }

    return order;
  });

  if (createdOrder) {
    await sendOrderConfirmationWhatsApp({
      customerName: order.customerName,
      orderNumber: order.orderNumber,
      phone: order.shippingPhone,
    });
  }

  return order;
}
