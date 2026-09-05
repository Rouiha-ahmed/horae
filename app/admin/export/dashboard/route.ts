import { type NextRequest, NextResponse } from "next/server";

import { buildCsv } from "@/lib/customer-export";
import { getAdminPilotageDashboard } from "@/lib/dashboard/admin-data";
import { parseDashboardPeriod } from "@/lib/dashboard/domain";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const period = parseDashboardPeriod(request.nextUrl.searchParams.get("period") || undefined);
  const data = await getAdminPilotageDashboard(period);
  const rows: Array<Array<string | number | null | undefined>> = [
    ["Dashboard HORAE", data.window.label],
    ["Période", data.window.start, data.window.end],
    ["Comparaison", data.window.previousStart, data.window.previousEnd],
    [],
    ["Indicateur", "Valeur", "Période précédente", "Évolution"],
    ...data.kpis.map((kpi) => [kpi.label, kpi.value, kpi.previousValue, kpi.change]),
    [],
    ["Date", "CA encaissé (MAD)", "Commandes"],
    ...data.series.map((point) => [point.date, point.revenue, point.orders]),
    [],
    ["Top produit", "CA (MAD)", "Unités", "Tendance CA (%)", "Tendance unités (%)"],
    ...(data.products || []).map((product) => [
      product.name,
      product.revenue,
      product.units,
      product.revenueTrend,
      product.unitsTrend,
    ]),
    [],
    ["Ville", "Livraisons", "Délai moyen (jours)", "Objectif SLA (jours)"],
    ...(data.deliveryPerformance || []).map((row) => [
      row.city,
      row.deliveredOrders,
      row.averageDays,
      row.objectiveDays,
    ]),
    [],
    ["Encaissement", "Montant (MAD)", "Commandes", "Encaissé"],
    ...(data.payments || []).map((row) => [row.label, row.amount, row.orders, row.collected ? "Oui" : "Non"]),
  ];

  return new NextResponse(buildCsv(rows), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="dashboard-zayna-${period}j-${new Date().toISOString().slice(0, 10)}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
