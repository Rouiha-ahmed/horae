import { CustomerActivitySegment, LoyaltyTier, Prisma } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";

import { requireAdmin } from "@/lib/admin";
import { buildCsv } from "@/lib/customer-export";
import { prisma } from "@/lib/prisma";
import {
  buildCustomerWhere,
  SEGMENT_LABELS,
  type CustomerListFilters,
} from "@/lib/services/admin-customers";
import { VALID_COMMERCIAL_ORDER_WHERE, writeAuditLog } from "@/lib/services/loyalty";

export const dynamic = "force-dynamic";

const tiers = new Set(Object.values(LoyaltyTier));
const segments = new Set(Object.values(CustomerActivitySegment));
const optionalNumber = (value: string | null) => {
  const parsed = value ? Number(value) : Number.NaN;
  return Number.isFinite(parsed) ? parsed : undefined;
};

export async function GET(request: NextRequest) {
  const identity = await requireAdmin();
  const searchParams = request.nextUrl.searchParams;
  const tier = searchParams.get("tier") || "all";
  const segment = searchParams.get("segment") || "all";
  const filters: CustomerListFilters = {
    search: searchParams.get("search") || undefined,
    tier: tiers.has(tier as LoyaltyTier) ? (tier as LoyaltyTier) : "all",
    segment: segments.has(segment as CustomerActivitySegment)
      ? (segment as CustomerActivitySegment)
      : "all",
    alert: searchParams.get("alert") === "expiring"
      ? "expiring"
      : searchParams.get("alert") === "inactive"
        ? "inactive"
        : "all",
    tagId: searchParams.get("tagId") || undefined,
    minPoints: optionalNumber(searchParams.get("minPoints")),
    maxPoints: optionalNumber(searchParams.get("maxPoints")),
  };
  const where = buildCustomerWhere(filters);
  const customers = await prisma.user.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 10_000,
    select: {
      id: true,
      fullName: true,
      email: true,
      loyaltyCardNumber: true,
      loyaltyTier: true,
      activitySegment: true,
      loyaltyPoints: true,
      addresses: { orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }], take: 1 },
      orders: {
        where: VALID_COMMERCIAL_ORDER_WHERE,
        select: { totalPrice: true, orderDate: true },
        orderBy: { orderDate: "desc" },
      },
    },
  });

  const header = [
    "Client",
    "Email",
    "Téléphone",
    "Carte fidélité",
    "Statut",
    "Points",
    "CA payé + livré",
    "Commandes valides",
    "Dernière commande valide",
    "Segment",
  ];
  const rows = customers.map((customer) => [
    customer.fullName,
    customer.email,
    customer.addresses[0]?.phone || "",
    customer.loyaltyCardNumber,
    customer.loyaltyTier,
    customer.loyaltyPoints,
    customer.orders.reduce((sum, order) => sum + Number(order.totalPrice), 0).toFixed(2),
    customer.orders.length,
    customer.orders[0]?.orderDate.toISOString() || "",
    SEGMENT_LABELS[customer.activitySegment],
  ]);
  const csv = buildCsv([header, ...rows]);
  const actor = identity.email || identity.displayName || identity.userId || "admin";

  await prisma.$transaction(async (tx) => {
    await tx.customerExportLog.create({
      data: {
        exportedBy: actor,
        rowCount: customers.length,
        filters: filters as Prisma.InputJsonValue,
      },
    });
    await writeAuditLog(tx, {
      actor: { userId: identity.userId, email: identity.email, label: identity.displayName },
      action: "customers.exported",
      entity: "User",
      metadata: { rowCount: customers.length, filters },
    });
  });

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="clients-zayna-${new Date().toISOString().slice(0, 10)}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
