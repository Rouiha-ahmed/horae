import { NextRequest, NextResponse } from "next/server";
import { revalidatePath, revalidateTag } from "next/cache";
import { verifyCMICallback } from "@/lib/cmi";
import { getAdminDataTag } from "@/lib/admin";
import { prisma } from "@/lib/prisma";
import { sendOrderConfirmationWhatsApp } from "@/lib/services/whatsapp";
import { adjustInventoryInTransaction } from "@/lib/inventory";

export const dynamic = "force-dynamic";

const revalidateOrderViews = () => {
  revalidateTag(getAdminDataTag(), "max");
  revalidatePath("/admin", "layout");
  revalidatePath("/orders");
};

export async function POST(req: NextRequest) {
  const storeKey = process.env.CMI_STORE_KEY;
  if (!storeKey) {
    console.error("CMI_STORE_KEY not configured");
    return new NextResponse("CONFIGURATION_ERROR", { status: 500 });
  }

  // CMI sends form-encoded body
  const formData = await req.formData();
  const params: Record<string, string> = {};
  for (const [key, value] of formData.entries()) {
    params[key] = String(value);
  }

  // Verify hash — reject tampered callbacks
  if (!verifyCMICallback(params, storeKey)) {
    console.error("CMI callback hash mismatch", { oid: params.oid });
    return new NextResponse("INVALID_HASH", { status: 400 });
  }

  const oid = params.oid; // our orderNumber
  const procReturnCode = params.ProcReturnCode; // "00" = approved

  if (!oid) {
    return new NextResponse("MISSING_OID", { status: 400 });
  }

  const order = await prisma.order.findUnique({
    where: { orderNumber: oid },
    select: {
      id: true,
      status: true,
      paymentStatus: true,
      customerName: true,
      orderNumber: true,
      shippingPhone: true,
    },
  });

  if (!order) {
    console.error("CMI callback: order not found", { oid });
    return new NextResponse("ORDER_NOT_FOUND", { status: 404 });
  }

  // Guard against duplicate or late callbacks. A terminal failed payment has
  // already restored stock and must never do it a second time.
  if (!(["pending", "partial"] as string[]).includes(order.paymentStatus)) {
    return new NextResponse("ACTION=POSTAUTH", {
      status: 200,
      headers: { "Content-Type": "text/plain" },
    });
  }

  if (procReturnCode === "00") {
    // ── Payment approved ──
    await prisma.$transaction(async (tx) => {
      const updated = await tx.order.updateMany({
        where: { id: order.id, paymentStatus: { in: ["pending", "partial"] } },
        data: {
          paymentStatus: "paid",
          // Legacy storefront dimension only. Operational preparation and
          // delivery remain independent and unchanged.
          status: "paid",
          statusChangedAt: new Date(),
          version: { increment: 1 },
          stripePaymentIntentId: params.TransId || params.TRANID || null,
        },
      });
      if (updated.count !== 1) return;
      await Promise.all([
        tx.orderEvent.create({
          data: {
            orderId: order.id,
            type: "PAYMENT_CAPTURED",
            title: "Paiement CMI confirmé",
            actorName: "Passerelle CMI",
            metadata: { transactionId: params.TransId || params.TRANID || null },
          },
        }),
        tx.adminAuditLog.create({
          data: {
            action: "order.payment_captured",
            entity: "Order",
            entityId: order.id,
            metadata: { source: "cmi_callback", transactionId: params.TransId || params.TRANID || null },
          },
        }),
      ]);
    });

    await sendOrderConfirmationWhatsApp({
      customerName: order.customerName,
      orderNumber: order.orderNumber,
      phone: order.shippingPhone,
    });
  } else {
    // ── Payment declined or error — restore stock ──
    await prisma.$transaction(async (tx) => {
      const transitioned = await tx.order.updateMany({
        where: { id: order.id, paymentStatus: { in: ["pending", "partial"] } },
        data: {
          status: "cancelled",
          fulfillmentStatus: "cancelled",
          paymentStatus: "failed",
          deliveryStatus: "not_assigned",
          statusChangedAt: new Date(),
          version: { increment: 1 },
        },
      });
      if (transitioned.count !== 1) return;

      const items = await tx.orderItem.findMany({
        where: { orderId: order.id },
        select: { productId: true, quantity: true },
      });
      for (const item of items) {
        if (item.productId) {
          await adjustInventoryInTransaction(tx, {
            productId: item.productId,
            quantityDelta: item.quantity,
            reason: "ORDER_CANCELLED",
            relatedOrderId: order.id,
            idempotencyKey: `order:${order.id}:restore:${item.productId}`,
            actor: { name: "Passerelle CMI" },
            note: `Restitution après échec du paiement ${order.orderNumber}`,
          });
        }
      }
      await Promise.all([
        tx.orderEvent.create({
          data: {
            orderId: order.id,
            type: "PAYMENT_FAILED",
            title: "Paiement CMI refusé",
            description: params.ErrMsg || params.mdStatus || null,
            actorName: "Passerelle CMI",
            metadata: { returnCode: procReturnCode || null },
          },
        }),
        tx.adminAuditLog.create({
          data: {
            action: "order.payment_failed",
            entity: "Order",
            entityId: order.id,
            metadata: { source: "cmi_callback", returnCode: procReturnCode || null },
          },
        }),
      ]);
    });
  }

  revalidateOrderViews();

  // CMI requires this exact response to capture the payment
  return new NextResponse("ACTION=POSTAUTH", {
    status: 200,
    headers: { "Content-Type": "text/plain" },
  });
}
