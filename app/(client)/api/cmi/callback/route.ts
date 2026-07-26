import { NextRequest, NextResponse } from "next/server";
import { revalidatePath, revalidateTag } from "next/cache";
import { verifyCMICallback } from "@/lib/cmi";
import { getAdminDataTag, orderStatusToDeliveryStatus } from "@/lib/admin";
import { prisma } from "@/lib/prisma";
import { sendOrderConfirmationWhatsApp } from "@/lib/services/whatsapp";

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

  // Guard against duplicate callbacks
  if (order.paymentStatus === "paid") {
    return new NextResponse("ACTION=POSTAUTH", {
      status: 200,
      headers: { "Content-Type": "text/plain" },
    });
  }

  if (procReturnCode === "00") {
    // ── Payment approved ──
    await prisma.order.update({
      where: { orderNumber: oid },
      data: {
        paymentStatus: "paid",
        status:        "processing",
        deliveryStatus: orderStatusToDeliveryStatus("processing"),
        ...(order.status !== "processing" ? { statusChangedAt: new Date() } : {}),
        // Store CMI transaction reference (reusing the external payment ID field)
        stripePaymentIntentId: params.TransId || params.TRANID || null,
      },
    });

    await sendOrderConfirmationWhatsApp({
      customerName: order.customerName,
      orderNumber: order.orderNumber,
      phone: order.shippingPhone,
    });
  } else {
    // ── Payment declined or error — restore stock ──
    const items = await prisma.orderItem.findMany({
      where: { orderId: order.id },
      select: { productId: true, quantity: true },
    });

    await prisma.$transaction(async (tx) => {
      for (const item of items) {
        if (item.productId) {
          await tx.product.update({
            where: { id: item.productId },
            data: { stock: { increment: item.quantity } },
            select: { id: true },
          });
        }
      }
      await tx.order.update({
        where: { orderNumber: oid },
        data: {
          status: "cancelled",
          paymentStatus: "failed",
          deliveryStatus: orderStatusToDeliveryStatus("cancelled"),
          ...(order.status !== "cancelled" ? { statusChangedAt: new Date() } : {}),
        },
      });
    });
  }

  revalidateOrderViews();

  // CMI requires this exact response to capture the payment
  return new NextResponse("ACTION=POSTAUTH", {
    status: 200,
    headers: { "Content-Type": "text/plain" },
  });
}
