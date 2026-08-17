import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  Banknote,
  Boxes,
  CheckCircle2,
  ClipboardList,
  PackageSearch,
  RotateCcw,
  ShoppingBag,
  Truck,
} from "lucide-react";

import { adminCurrencyFormatter, adminSurfaceClassName } from "@/components/admin/AdminPagePrimitives";
import type {
  DashboardStockItem,
  TodayDashboardData,
} from "@/lib/dashboard/admin-data";
import { cn } from "@/lib/utils";

const number = new Intl.NumberFormat("fr-MA");
const dateTime = new Intl.DateTimeFormat("fr-MA", {
  timeZone: "Africa/Casablanca",
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});

const cardConfig = {
  orders: { icon: ShoppingBag, surface: "border-rose-200 bg-rose-50/70", iconTone: "bg-rose-100 text-rose-700" },
  payments: { icon: Banknote, surface: "border-orange-200 bg-orange-50/70", iconTone: "bg-orange-100 text-orange-700" },
  stock: { icon: Boxes, surface: "border-amber-200 bg-amber-50/70", iconTone: "bg-amber-100 text-amber-700" },
  deliveries: { icon: Truck, surface: "border-emerald-200 bg-emerald-50/70", iconTone: "bg-emerald-100 text-emerald-700" },
} as const;

const riskLabel = (risk: DashboardStockItem["riskLevel"]) =>
  risk === "OUT_OF_STOCK"
    ? "Rupture"
    : risk === "CRITICAL"
      ? "Critique"
      : risk === "LOW"
        ? "À surveiller"
        : risk === "NO_RECENT_SALES"
          ? "Sans vente récente"
          : "Normal";

const riskTone = (risk: DashboardStockItem["riskLevel"]) =>
  risk === "OUT_OF_STOCK" || risk === "CRITICAL"
    ? "bg-rose-50 text-rose-700"
    : "bg-amber-50 text-amber-700";

export default function TodayDashboard({ data }: { data: TodayDashboardData }) {
  return (
    <div className="space-y-6">
      <section aria-labelledby="action-now-title">
        <div className="mb-3 flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-rose-600" />
          <h2 id="action-now-title" className="text-lg font-semibold text-slate-950">À traiter maintenant</h2>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {data.cards.map((card) => {
            const config = cardConfig[card.key];
            const Icon = card.value === 0 ? CheckCircle2 : config.icon;
            return (
              <Link
                key={card.key}
                href={card.href}
                className={cn(
                  "group rounded-[26px] border p-5 shadow-[0_22px_60px_-48px_rgba(15,23,42,.45)] transition hover:-translate-y-0.5 hover:shadow-[0_26px_65px_-44px_rgba(15,23,42,.5)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-200",
                  card.value === 0 ? "border-emerald-200 bg-emerald-50/65" : config.surface,
                )}
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm font-semibold text-slate-800">{card.label}</p>
                    <p className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">{number.format(card.value)}</p>
                  </div>
                  <span className={cn("flex h-12 w-12 items-center justify-center rounded-2xl", card.value === 0 ? "bg-emerald-100 text-emerald-700" : config.iconTone)}><Icon className="h-5 w-5" /></span>
                </div>
                <p className="mt-4 min-h-10 text-sm leading-5 text-slate-600">{card.helper}</p>
                <span className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-blue-800">{card.actionLabel}<ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" /></span>
              </Link>
            );
          })}
        </div>
      </section>

      <section className={cn(adminSurfaceClassName, "p-5")} aria-labelledby="attention-title">
        <h2 id="attention-title" className="text-lg font-semibold text-slate-950">Points d’attention</h2>
        {data.attentionPoints.length ? (
          <div className="mt-4 grid gap-3 lg:grid-cols-3">
            {data.attentionPoints.map((alert) => (
              <Link
                key={alert.key}
                href={alert.href}
                className={cn(
                  "group rounded-2xl border p-4 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-200",
                  alert.severity === "critical" ? "border-rose-200 bg-rose-50/60" : alert.severity === "positive" ? "border-emerald-200 bg-emerald-50/60" : "border-amber-200 bg-amber-50/60",
                )}
              >
                <p className="font-semibold text-slate-950">{alert.title}</p>
                <p className="mt-1 text-sm leading-5 text-slate-600">{alert.message}</p>
                <span className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-blue-800">{alert.actionLabel}<ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" /></span>
              </Link>
            ))}
          </div>
        ) : (
          <div className="mt-4 flex items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-5 text-sm text-emerald-800"><CheckCircle2 className="h-5 w-5" />Aucun point d’attention prioritaire détecté.</div>
        )}
      </section>

      <section className="grid gap-5 xl:grid-cols-[1.05fr_1.25fr_.7fr]">
        <div className={cn(adminSurfaceClassName, "overflow-hidden")}>
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
            <div className="flex items-center gap-2"><ClipboardList className="h-5 w-5 text-blue-700" /><h2 className="font-semibold text-slate-950">Activité récente</h2></div>
            <Link href="/admin/orders?sort=priority" className="text-xs font-semibold text-blue-700 hover:underline">Voir tout</Link>
          </div>
          {data.recentActivity.length ? (
            <div className="divide-y divide-slate-100">
              {data.recentActivity.map((order) => (
                <Link key={order.id} href={order.href} className="flex items-center justify-between gap-3 px-5 py-4 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-500">
                  <div className="min-w-0"><p className="font-semibold text-blue-800">#{order.orderNumber.slice(-8).toUpperCase()}</p><p className="mt-1 truncate text-xs text-slate-500">{order.customerName} · {dateTime.format(new Date(order.orderDate))}</p></div>
                  <div className="text-right"><p className="font-semibold text-slate-900">{adminCurrencyFormatter.format(order.totalPrice)}</p><p className={cn("mt-1 text-xs font-semibold", order.tone === "danger" ? "text-rose-700" : order.tone === "warning" ? "text-amber-700" : "text-emerald-700")}>{order.situation}</p></div>
                </Link>
              ))}
            </div>
          ) : <p className="px-5 py-12 text-center text-sm text-slate-500">Aucune commande ne requiert d’intervention.</p>}
        </div>

        <div className={cn(adminSurfaceClassName, "overflow-hidden")}>
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
            <div className="flex items-center gap-2"><Boxes className="h-5 w-5 text-amber-600" /><h2 className="font-semibold text-slate-950">Stock à risque</h2></div>
            <Link href="/admin/products?view=stock-risk&sort=risk" className="text-xs font-semibold text-blue-700 hover:underline">Voir le stock</Link>
          </div>
          {data.stockRisk.length ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[620px] text-left text-sm">
                <thead className="bg-slate-50 text-[11px] uppercase tracking-[.08em] text-slate-500"><tr><th className="px-5 py-3">Produit</th><th className="px-3 py-3">Stock</th><th className="px-3 py-3">Ventes/j</th><th className="px-3 py-3">Couverture</th><th className="px-3 py-3">Niveau</th></tr></thead>
                <tbody className="divide-y divide-slate-100">
                  {data.stockRisk.map((product) => (
                    <tr key={product.id}>
                      <td className="px-5 py-3"><Link href={product.href} className="font-semibold text-blue-800 hover:underline">{product.name}</Link></td>
                      <td className="px-3 py-3">{number.format(product.stock)}</td>
                      <td className="px-3 py-3">{number.format(Number(product.avgDailySales.toFixed(1)))}</td>
                      <td className="px-3 py-3">{product.daysOfCover === null ? "—" : `${number.format(Number(product.daysOfCover.toFixed(1)))} j`}</td>
                      <td className="px-3 py-3"><span className={cn("rounded-full px-2.5 py-1 text-xs font-semibold", riskTone(product.riskLevel))}>{riskLabel(product.riskLevel)}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : <div className="flex items-center justify-center gap-2 px-5 py-12 text-sm text-emerald-700"><CheckCircle2 className="h-5 w-5" />Aucun produit à risque actuellement.</div>}
        </div>

        <aside className={cn(adminSurfaceClassName, "p-5")} aria-labelledby="quick-title">
          <h2 id="quick-title" className="font-semibold text-slate-950">Accès rapides</h2>
          <nav className="mt-4 space-y-2">
            {[
              ["Commandes", "/admin/orders?view=all&sort=newest", ShoppingBag],
              ["Stock à risque", "/admin/products?view=stock-risk&sort=risk", Boxes],
              ["Produits", "/admin/products", PackageSearch],
              ["Retours", "/admin/orders?view=returns&sort=priority", RotateCcw],
            ].map(([label, href, Icon]) => (
              <Link key={label as string} href={href as string} className="flex items-center justify-between rounded-2xl border border-slate-200 px-3 py-3 text-sm font-semibold text-slate-700 hover:border-blue-200 hover:bg-blue-50 hover:text-blue-900">
                <span className="inline-flex items-center gap-2"><Icon className="h-4 w-4" />{label as string}</span><ArrowRight className="h-4 w-4" />
              </Link>
            ))}
          </nav>
        </aside>
      </section>
    </div>
  );
}
