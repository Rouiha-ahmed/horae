import Link from "next/link";
import {
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  Banknote,
  Boxes,
  CheckCircle2,
  CircleAlert,
  Clock3,
  MapPin,
  PackageSearch,
  ShoppingBag,
} from "lucide-react";

import { adminCurrencyFormatter, adminSurfaceClassName } from "@/components/admin/AdminPagePrimitives";
import RevenueOrdersChart from "@/components/admin/dashboard/RevenueOrdersChart";
import TopProductsTable from "@/components/admin/dashboard/TopProductsTable";
import type {
  DashboardStockItem,
  PilotageDashboardData,
  PilotageKpi,
} from "@/lib/dashboard/admin-data";
import { cn } from "@/lib/utils";

const number = new Intl.NumberFormat("fr-MA", { maximumFractionDigits: 1 });
const integer = new Intl.NumberFormat("fr-MA");
const dateTime = new Intl.DateTimeFormat("fr-MA", {
  timeZone: "Africa/Casablanca",
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});

const formatHours = (hours: number) => {
  if (hours <= 0) return "—";
  if (hours < 24) return `${number.format(hours)} h`;
  return `${number.format(hours / 24)} j`;
};

const formatKpi = (kpi: PilotageKpi) => {
  if (kpi.format === "currency") return adminCurrencyFormatter.format(kpi.value);
  if (kpi.format === "percent") return `${number.format(kpi.value)} %`;
  if (kpi.format === "duration") return formatHours(kpi.value);
  return integer.format(Math.round(kpi.value));
};

const riskLabel = (risk: DashboardStockItem["riskLevel"]) =>
  risk === "OUT_OF_STOCK" ? "Rupture" : risk === "CRITICAL" ? "Critique" : "À surveiller";

function KpiCard({ kpi }: { kpi: PilotageKpi }) {
  const unchanged = Math.abs(kpi.change) < 0.05;
  const isImprovement = unchanged || (kpi.positiveWhenDown ? kpi.change <= 0 : kpi.change >= 0);
  const TrendIcon = unchanged ? ArrowRight : kpi.change > 0 ? ArrowUpRight : ArrowDownRight;
  return (
    <article className={cn(adminSurfaceClassName, "p-4")}>
      <p className="text-xs font-semibold text-slate-500">{kpi.label}</p>
      <p className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">{formatKpi(kpi)}</p>
      <div className="mt-3 flex items-center gap-2">
        <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-semibold", unchanged ? "bg-slate-100 text-slate-600" : isImprovement ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700")}>
          <TrendIcon className="h-3.5 w-3.5" />
          {kpi.change > 0 ? "+" : ""}{number.format(kpi.change)} {kpi.changeKind === "points" ? "pt" : "%"}
        </span>
        <span className="text-[11px] text-slate-400">vs période précédente</span>
      </div>
      <p className="mt-3 text-xs leading-5 text-slate-500">{kpi.helper}</p>
    </article>
  );
}

const SectionUnavailable = ({ message }: { message: string }) => (
  <div role="alert" className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-6 text-center text-sm text-amber-800">
    <CircleAlert className="mx-auto mb-2 h-5 w-5" />{message}
  </div>
);

export default function PilotageDashboard({ data }: { data: PilotageDashboardData }) {
  const totalCollected = data.payments?.filter((row) => row.collected).reduce((sum, row) => sum + row.amount, 0) || 0;
  return (
    <div className="space-y-6">
      {data.sectionErrors.length ? (
        <div role="alert" className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Certaines analyses n’ont pas pu être chargées : {data.sectionErrors.join(" ")}
        </div>
      ) : null}

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6" aria-label="Indicateurs de pilotage">
        {data.kpis.map((kpi) => <KpiCard key={kpi.key} kpi={kpi} />)}
      </section>

      <section className={cn(adminSurfaceClassName, "p-5 md:p-6")} aria-labelledby="chart-title">
        <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div><h2 id="chart-title" className="text-lg font-semibold text-slate-950">Évolution du CA encaissé et des commandes</h2><p className="mt-1 text-sm text-slate-500">{data.window.label} · comparaison avec {data.window.comparisonLabel}</p></div>
          <span className="rounded-full bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-800">{data.period === 90 ? "Par semaine" : "Par jour"}</span>
        </div>
        <RevenueOrdersChart data={data.series} />
      </section>

      <section className="grid gap-5 xl:grid-cols-2">
        <div className={cn(adminSurfaceClassName, "p-5")}>
          <div className="mb-4 flex items-center gap-2"><PackageSearch className="h-5 w-5 text-blue-700" /><h2 className="text-lg font-semibold text-slate-950">Top produits</h2></div>
          {data.products ? <TopProductsTable products={data.products} /> : <SectionUnavailable message="Le classement des produits est indisponible." />}
        </div>

        <div className={cn(adminSurfaceClassName, "overflow-hidden")}>
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
            <div className="flex items-center gap-2"><Boxes className="h-5 w-5 text-amber-600" /><div><h2 className="font-semibold text-slate-950">Stock prédictif</h2><p className="mt-0.5 text-xs text-slate-500">Vélocité normalisée depuis la période sélectionnée</p></div></div>
            <Link href="/admin/products?view=stock-risk&sort=risk" className="text-xs font-semibold text-blue-700 hover:underline">Voir tout</Link>
          </div>
          {data.stockAnalytics ? data.stockAnalytics.length ? (
            <div className="overflow-x-auto"><table className="w-full min-w-[650px] text-left text-sm"><thead className="bg-slate-50 text-[11px] uppercase tracking-[.08em] text-slate-500"><tr><th className="px-5 py-3">Produit</th><th className="px-3 py-3">Stock</th><th className="px-3 py-3">Ventes/j</th><th className="px-3 py-3">Couverture</th><th className="px-3 py-3">Niveau</th></tr></thead><tbody className="divide-y divide-slate-100">{data.stockAnalytics.map((product) => <tr key={product.id}><td className="px-5 py-3"><Link href={product.href} className="font-semibold text-blue-800 hover:underline">{product.name}</Link></td><td className="px-3 py-3">{integer.format(product.stock)}</td><td className="px-3 py-3">{number.format(product.avgDailySales)}</td><td className="px-3 py-3">{product.daysOfCover === null ? "—" : `${number.format(product.daysOfCover)} j`}</td><td className="px-3 py-3"><span className={cn("rounded-full px-2 py-1 text-xs font-semibold", product.riskLevel === "LOW" ? "bg-amber-50 text-amber-700" : "bg-rose-50 text-rose-700")}>{riskLabel(product.riskLevel)}</span></td></tr>)}</tbody></table></div>
          ) : <div className="flex items-center justify-center gap-2 px-5 py-12 text-sm text-emerald-700"><CheckCircle2 className="h-5 w-5" />Aucun risque stock sur la vélocité de cette période.</div> : <div className="p-5"><SectionUnavailable message="L’analyse prédictive du stock est indisponible." /></div>}
        </div>
      </section>

      <section className="grid gap-5 xl:grid-cols-[1.2fr_.8fr]">
        <div className={cn(adminSurfaceClassName, "overflow-hidden")}>
          <div className="flex items-center gap-2 border-b border-slate-100 px-5 py-4"><MapPin className="h-5 w-5 text-blue-700" /><div><h2 className="font-semibold text-slate-950">Performance livraison par ville</h2><p className="mt-0.5 text-xs text-slate-500">Expédition → livraison, comparée aux politiques SLA actives</p></div></div>
          {data.deliveryPerformance ? data.deliveryPerformance.length ? (
            <div className="overflow-x-auto"><table className="w-full min-w-[650px] text-left text-sm"><thead className="bg-slate-50 text-[11px] uppercase tracking-[.08em] text-slate-500"><tr><th className="px-5 py-3">Ville</th><th className="px-3 py-3">Livraisons</th><th className="px-3 py-3">Délai moyen</th><th className="px-3 py-3">Objectif SLA</th><th className="px-3 py-3">Situation</th></tr></thead><tbody className="divide-y divide-slate-100">{data.deliveryPerformance.map((row) => <tr key={row.city}><td className="px-5 py-3"><Link href={row.href} className="font-semibold text-blue-800 hover:underline">{row.city}</Link></td><td className="px-3 py-3">{integer.format(row.deliveredOrders)}</td><td className="px-3 py-3">{number.format(row.averageDays)} j</td><td className="px-3 py-3">{row.objectiveDays === null ? "Non configuré" : `${number.format(row.objectiveDays)} j`}</td><td className="px-3 py-3"><span className={cn("rounded-full px-2.5 py-1 text-xs font-semibold", row.isWithinSla === null ? "bg-slate-100 text-slate-600" : row.isWithinSla ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700")}>{row.isWithinSla === null ? "Sans objectif" : row.isWithinSla ? "Conforme" : "À surveiller"}</span></td></tr>)}</tbody></table></div>
          ) : <p className="px-5 py-12 text-center text-sm text-slate-500">Aucune livraison terminée sur cette période.</p> : <div className="p-5"><SectionUnavailable message="La performance de livraison est indisponible." /></div>}
        </div>

        <div className={cn(adminSurfaceClassName, "p-5")}>
          <div className="flex items-center gap-2"><Banknote className="h-5 w-5 text-emerald-700" /><h2 className="font-semibold text-slate-950">Paiements & encaissements</h2></div>
          {data.payments ? (
            <div className="mt-5 space-y-3">
              <div className="rounded-2xl bg-blue-950 px-4 py-4 text-white"><p className="text-xs text-blue-200">Total encaissé</p><p className="mt-1 text-2xl font-semibold">{adminCurrencyFormatter.format(totalCollected)}</p></div>
              {data.payments.map((row) => {
                const width = row.collected && totalCollected ? Math.max(4, (row.amount / totalCollected) * 100) : 0;
                return <Link key={row.key} href={row.href} className={cn("block rounded-2xl border p-3 hover:bg-slate-50", row.collected ? "border-slate-200" : "border-orange-200 bg-orange-50/50")}><div className="flex items-center justify-between gap-3"><div><p className="text-sm font-semibold text-slate-900">{row.label}</p><p className="mt-0.5 text-xs text-slate-500">{row.orders} commande(s)</p></div><p className={cn("font-semibold", row.collected ? "text-slate-950" : "text-orange-700")}>{adminCurrencyFormatter.format(row.amount)}</p></div>{row.collected ? <div className="mt-2 h-1.5 rounded-full bg-slate-100"><div className="h-full rounded-full bg-blue-500" style={{ width: `${width}%` }} /></div> : <p className="mt-2 text-xs font-medium text-orange-700">À rapprocher — exclu du CA encaissé</p>}</Link>;
              })}
            </div>
          ) : <div className="mt-5"><SectionUnavailable message="L’analyse des encaissements est indisponible." /></div>}
        </div>
      </section>

      <section className={cn(adminSurfaceClassName, "overflow-hidden")}>
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4"><div className="flex items-center gap-2"><ShoppingBag className="h-5 w-5 text-blue-700" /><div><h2 className="font-semibold text-slate-950">Dernières commandes significatives</h2><p className="mt-0.5 text-xs text-slate-500">Incidents, annulations, retours ou montants élevés</p></div></div><Link href={`/admin/orders?view=all&period=${data.period}d&sort=newest`} className="text-xs font-semibold text-blue-700 hover:underline">Toutes les commandes</Link></div>
        {data.significantOrders ? data.significantOrders.length ? (
          <div className="overflow-x-auto"><table className="w-full min-w-[760px] text-left text-sm"><thead className="bg-slate-50 text-[11px] uppercase tracking-[.08em] text-slate-500"><tr><th className="px-5 py-3">Commande</th><th className="px-3 py-3">Client</th><th className="px-3 py-3">Montant</th><th className="px-3 py-3">Signal</th><th className="px-5 py-3 text-right">Action</th></tr></thead><tbody className="divide-y divide-slate-100">{data.significantOrders.map((order) => <tr key={order.id}><td className="px-5 py-3"><Link href={order.href} className="font-semibold text-blue-800 hover:underline">#{order.orderNumber.slice(-8).toUpperCase()}</Link><p className="mt-1 text-xs text-slate-500">{dateTime.format(new Date(order.orderDate))}</p></td><td className="px-3 py-3">{order.customerName}<p className="mt-1 text-xs text-slate-500">{order.city || "Ville manquante"}</p></td><td className="px-3 py-3 font-semibold">{adminCurrencyFormatter.format(order.totalPrice)}</td><td className="px-3 py-3"><span className={cn("rounded-full px-2.5 py-1 text-xs font-semibold", order.tone === "danger" ? "bg-rose-50 text-rose-700" : order.tone === "warning" ? "bg-amber-50 text-amber-700" : "bg-blue-50 text-blue-700")}>{order.situation}</span></td><td className="px-5 py-3 text-right"><Link href={order.href} className="inline-flex items-center gap-1 text-xs font-semibold text-blue-700 hover:underline">Voir<ArrowRight className="h-3.5 w-3.5" /></Link></td></tr>)}</tbody></table></div>
        ) : <p className="px-5 py-12 text-center text-sm text-slate-500">Aucune commande significative sur cette période.</p> : <div className="p-5"><SectionUnavailable message="Les commandes significatives sont indisponibles." /></div>}
      </section>

      <p className="flex items-center justify-center gap-2 text-xs text-slate-400"><Clock3 className="h-3.5 w-3.5" />Données calculées le {dateTime.format(new Date(data.generatedAt))}</p>
    </div>
  );
}
