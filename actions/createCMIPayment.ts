"use server";

import { auth, currentUser } from "@clerk/nextjs/server";
import { buildCMIFormParams, CMI_GATEWAY_URL } from "@/lib/cmi";
import { calculatePromoDiscount } from "@/lib/promo";
import { prisma } from "@/lib/prisma";
import { findPromoCodeByCode, incrementPromoUsage } from "@/lib/services/promo";
import { upsertAppUser } from "@/lib/services/customer";
import { adjustInventoryInTransaction } from "@/lib/inventory";
import { getEffectiveProductUnitPrice } from "@/lib/products/domain";
import type { Address } from "@/types";
import type { CartItem } from "@/store";

export interface CMIPaymentInput {
  items: Array<{ product: CartItem["product"]; quantity: number }>;
  address: Address & { phone?: string };
  promoCode?: string;
  orderNumber: string;
}

export interface CMIPaymentResult {
  formParams: Record<string, string>;
  gatewayUrl: string;
}

export async function createCMIPayment(
  input: CMIPaymentInput
): Promise<CMIPaymentResult> {
  const { userId } = await auth();
  if (!userId) throw new Error("Non autorisé");

  const user = await currentUser();
  const customerEmail =
    user?.primaryEmailAddress?.emailAddress ||
    user?.emailAddresses[0]?.emailAddress;
  if (!customerEmail) throw new Error("Email introuvable");

  const customerName = user?.fullName || input.address.name || "Client";
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL;
  if (!baseUrl) throw new Error("NEXT_PUBLIC_BASE_URL non configuré");

  // Build quantity map
  const quantityByProductId = new Map<string, number>();
  for (const item of input.items) {
    const id = item.product?._id;
    if (!id) throw new Error("Produit invalide");
    quantityByProductId.set(
      id,
      (quantityByProductId.get(id) || 0) + Math.max(1, item.quantity)
    );
  }
  const productIds = [...quantityByProductId.keys()];

  const productSelect = {
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
      orderBy: { sortOrder: "asc" as const },
      select: { url: true },
    },
  };

  // Fetch & validate products
  const products = await prisma.product.findMany({
    where: { id: { in: productIds }, lifecycleStatus: "ACTIVE", isActive: true, archivedAt: null },
    select: productSelect,
  });
  const productById = new Map(products.map((p) => [p.id, p]));

  let subtotal = 0;
  for (const [id, qty] of quantityByProductId) {
    const p = productById.get(id);
    if (!p) throw new Error("Un ou plusieurs produits sont indisponibles");
    subtotal += getEffectiveProductUnitPrice(p) * qty;
  }

  // Promo
  const promoCode = input.promoCode?.trim().toUpperCase();
  let discountAmount = 0;
  let finalTotal = subtotal;
  let promoId: string | null = null;

  if (promoCode) {
    const promo = await findPromoCodeByCode(promoCode);
    const result = calculatePromoDiscount(promo, subtotal, "cmi_card");
    if (!result.valid) throw new Error(result.message || "Code promo invalide");
    discountAmount = result.discountAmount;
    finalTotal = result.finalTotal;
    promoId = result.promoId || null;
  }

  const appUser = await upsertAppUser({
    clerkUserId: userId,
    fullName: customerName,
    email: customerEmail,
  });

  // Create pending order inside a transaction (deducts stock to prevent overselling)
  await prisma.$transaction(async (tx) => {
    const liveProducts = await tx.product.findMany({
      where: { id: { in: productIds }, lifecycleStatus: "ACTIVE", isActive: true, archivedAt: null },
      select: productSelect,
    });
    const liveById = new Map(liveProducts.map((p) => [p.id, p]));

    for (const id of productIds) if (!liveById.has(id)) throw new Error("Un ou plusieurs produits sont indisponibles");

    const createdOrder = await tx.order.create({
      data: {
        orderNumber:   input.orderNumber,
        userId:        appUser.id,
        clerkUserId:   userId,
        customerName,
        email:         customerEmail,
        currency:      "MAD",
        paymentMethod: "cmi_card",
        paymentStatus: "pending",
        status:        "pending",
        totalPrice:    finalTotal,
        amountDiscount: discountAmount,
        promoCode:     promoCode || null,
        promoDiscount: discountAmount,
        orderDate:     new Date(),
        shippingName:  input.address.name    || null,
        shippingPhone: input.address.phone   || null,
        shippingAddress: input.address.address || null,
        shippingCity:  input.address.city    || null,
        shippingState: input.address.state   || null,
        shippingZip:   input.address.zip     || null,
        items: {
          create: productIds.map((id) => {
            const p = liveById.get(id)!;
            return {
              productId:            p.id,
              productNameSnapshot:  p.name,
              productPriceSnapshot: getEffectiveProductUnitPrice(p),
              productImageUrlSnapshot: p.images[0]?.url || null,
              quantity: quantityByProductId.get(id) || 0,
            };
          }),
        },
      },
    });

    for (const [id, qty] of quantityByProductId) {
      await adjustInventoryInTransaction(tx, {
        productId: id,
        quantityDelta: -qty,
        reason: "ORDER",
        relatedOrderId: createdOrder.id,
        idempotencyKey: `order:${createdOrder.id}:reserve:${id}`,
        actor: { userId, email: customerEmail, name: customerName },
        note: `Réservation commande ${createdOrder.orderNumber}`,
      });
    }

    await tx.orderEvent.create({
      data: {
        orderId: createdOrder.id,
        type: "ORDER_CREATED",
        title: "Commande créée",
        description: "Commande créée avec paiement CMI en attente de confirmation.",
        actorUserId: userId,
        actorEmail: customerEmail,
        actorName: customerName,
        metadata: {
          paymentMethod: "cmi_card",
          source: "storefront",
        },
      },
    });

    if (promoId) await incrementPromoUsage(tx, promoId);
  });

  const formParams = buildCMIFormParams(
    input.orderNumber,
    finalTotal,
    {
      name:    customerName,
      email:   customerEmail,
      address: input.address.address || "N/A",
      city:    input.address.city    || "N/A",
      zip:     input.address.zip     || "00000",
      phone:   input.address.phone   || "N/A",
    },
    baseUrl
  );

  return { formParams, gatewayUrl: CMI_GATEWAY_URL };
}
