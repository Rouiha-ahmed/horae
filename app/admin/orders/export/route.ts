import { Prisma } from "@prisma/client";
import { type NextRequest, NextResponse } from "next/server";

import { buildCsv } from "@/lib/customer-export";
import {
  getOrdersForExport,
  parseAdminOrderFilters,
} from "@/lib/orders/admin-data";
import { requireOrderOperator } from "@/lib/orders/permissions";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const operator = await requireOrderOperator();
  const params = Object.fromEntries(request.nextUrl.searchParams.entries());
  const filters = parseAdminOrderFilters(params);
  const orders = await getOrdersForExport(filters);
  const rows: Array<Array<string | number | null | undefined>> = [
    [
      "Commande",
      "Date",
      "Client",
      "Email",
      "Téléphone",
      "Ville",
      "Montant",
      "Paiement",
      "Statut paiement",
      "Traitement",
      "Livraison",
      "Transporteur",
      "Tracking",
    ],
    ...orders.map((order) => [
      order.orderNumber,
      order.orderDate.toISOString(),
      order.customerName,
      order.email,
      order.shippingPhone,
      order.shippingCity,
      Number(order.totalPrice).toFixed(2),
      order.paymentMethod,
      order.paymentStatus,
      order.fulfillmentStatus,
      order.deliveryStatus,
      order.deliveryCompany,
      order.trackingNumber,
    ]),
  ];

  await prisma.adminAuditLog.create({
    data: {
      actorUserId: operator.userId,
      actorEmail: operator.email,
      action: "orders.exported",
      entity: "Order",
      metadata: {
        rowCount: orders.length,
        filters,
      } as Prisma.InputJsonValue,
    },
  });

  return new NextResponse(buildCsv(rows), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="commandes-zayna-${new Date().toISOString().slice(0, 10)}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
