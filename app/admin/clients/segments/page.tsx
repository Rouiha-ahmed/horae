import { ArrowRight, CalendarClock, RefreshCcw, Repeat2, Settings2, Users } from "lucide-react";
import Link from "next/link";

import ClientsPageHeader from "@/components/admin/clients/ClientsPageHeader";
import { requireAdmin } from "@/lib/admin";
import { SEGMENT_LABELS, getCustomerOverview } from "@/lib/services/admin-customers";

const integer = new Intl.NumberFormat("fr-MA");
const date = new Intl.DateTimeFormat("fr-MA", { day: "2-digit", month: "short", year: "numeric" });
const surface = "rounded-[24px] border border-slate-200/80 bg-white shadow-[0_16px_50px_-42px_rgba(15,23,42,0.4)]";

export default async function CustomerSegmentsPage() {
  await requireAdmin();
  const data = await getCustomerOverview();

  return (
    <div className="space-y-5">
      <ClientsPageHeader description="Segmentation calculée à partir des achats payés et livrés, avec une relance adaptée au cycle propre de chaque client." actions={<Link href="/admin/clients/settings#segments" className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-xs font-semibold text-[#162e6e]"><Settings2 className="h-4 w-4" /> Configurer les règles</Link>} />

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {Object.entries(SEGMENT_LABELS).map(([segment, label]) => (
          <Link key={segment} href={`/admin/clients/list?segment=${segment}`} className={`${surface} p-4 transition hover:-translate-y-0.5`}>
            <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-blue-50 text-blue-600"><Users className="h-4 w-4" /></span>
            <p className="mt-4 text-xl font-bold text-[#0f1d42]">{integer.format(data.segments[segment as keyof typeof data.segments] || 0)}</p>
            <p className="mt-1 text-xs font-semibold text-slate-600">{label}</p>
          </Link>
        ))}
      </section>

      <div className="grid gap-4 xl:grid-cols-[1.35fr_1fr]">
        <section className={surface}>
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4"><div><h2 className="flex items-center gap-2 text-sm font-bold text-[#0f1d42]"><RefreshCcw className="h-4 w-4 text-orange-500" /> Clients à relancer</h2><p className="mt-1 text-xs text-slate-500">Retard par rapport à leur intervalle d’achat habituel.</p></div><Link href="/admin/clients/list?segment=TO_REENGAGE" className="text-xs font-semibold text-blue-600">Voir tous →</Link></div>
          {data.reengagementCustomers.length ? <div className="divide-y divide-slate-100">{data.reengagementCustomers.map((customer) => (
            <article key={customer.id} className="grid gap-3 px-5 py-4 sm:grid-cols-[1.4fr_repeat(4,1fr)_auto] sm:items-center">
              <div><Link href={`/admin/clients/${customer.id}`} className="text-xs font-semibold text-slate-900 hover:text-blue-600">{customer.fullName}</Link><p className="text-[10px] text-slate-400">{customer.email}</p></div>
              <div><p className="text-[10px] text-slate-400">Dernier achat</p><p className="mt-1 text-xs font-semibold">{customer.lastPurchaseAt ? date.format(customer.lastPurchaseAt) : "—"}</p></div>
              <div><p className="text-[10px] text-slate-400">Cycle moyen</p><p className="mt-1 text-xs font-semibold">{customer.averageIntervalDays ? `${Math.round(customer.averageIntervalDays)} jours` : "Historique court"}</p></div>
              <div><p className="text-[10px] text-slate-400">Depuis l’achat</p><p className="mt-1 text-xs font-semibold text-orange-700">{customer.daysSinceLastPurchase ? `${customer.daysSinceLastPurchase} jours` : "—"}</p></div>
              <div><p className="text-[10px] text-slate-400">Achat attendu</p><p className="mt-1 text-xs font-semibold">{customer.expectedNextPurchaseAt ? date.format(customer.expectedNextPurchaseAt) : "—"}</p></div>
              <a href={`mailto:${encodeURIComponent(customer.email)}?subject=${encodeURIComponent("Vous nous manquez chez HORAE")}`} className="inline-flex h-8 items-center justify-center gap-1 rounded-xl border border-blue-100 px-3 text-[10px] font-semibold text-blue-600">Relancer <ArrowRight className="h-3 w-3" /></a>
            </article>
          ))}</div> : <p className="px-5 py-14 text-center text-sm text-slate-400">Aucun client à relancer actuellement.</p>}
        </section>

        <section className={`${surface} p-5`}>
          <h2 className="flex items-center gap-2 text-sm font-bold text-[#0f1d42]"><Repeat2 className="h-4 w-4 text-emerald-600" /> Produits à achat répété</h2>
          <p className="mt-1 text-xs text-slate-500">Les références avec plusieurs commandes valides.</p>
          <div className="mt-3 divide-y divide-slate-100">{data.repeatProducts.length ? data.repeatProducts.map((product) => <div key={product.productId} className="flex items-center gap-3 py-3"><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600"><Repeat2 className="h-4 w-4" /></span><div className="min-w-0 flex-1"><p className="truncate text-xs font-semibold">{product.productName}</p><p className="text-[10px] text-slate-400">{product.purchaseCount} achats · {product.repeatCustomers} clients récurrents</p><p className="text-[10px] text-slate-400">Cycle moyen : {product.averageIntervalDays ? `${Math.round(product.averageIntervalDays)} j` : "—"} · prochain potentiel : {product.potentialNextPurchaseAt ? date.format(product.potentialNextPurchaseAt) : "—"}</p></div><div className="text-right"><p className="text-[10px] text-slate-400">Dernier achat</p><p className="text-[10px] font-semibold">{date.format(product.lastPurchaseAt)}</p></div></div>) : <p className="py-12 text-center text-xs text-slate-400">Historique insuffisant.</p>}</div>
        </section>
      </div>

      <section className={`${surface} grid gap-4 p-5 md:grid-cols-3`}>
        <div className="flex gap-3"><CalendarClock className="mt-0.5 h-5 w-5 text-blue-600" /><div><p className="text-xs font-semibold">Actif</p><p className="mt-1 text-[11px] leading-5 text-slate-500">Achat valide depuis moins de {data.settings.activeCustomerDays} jours.</p></div></div>
        <div className="flex gap-3"><RefreshCcw className="mt-0.5 h-5 w-5 text-orange-600" /><div><p className="text-xs font-semibold">À relancer</p><p className="mt-1 text-[11px] leading-5 text-slate-500">Cycle dépassé de ×{data.settings.reengagementCycleMultiplier}, avec au moins {data.settings.minimumOrdersForCycle} achats.</p></div></div>
        <div className="flex gap-3"><Users className="mt-0.5 h-5 w-5 text-slate-600" /><div><p className="text-xs font-semibold">Inactif</p><p className="mt-1 text-[11px] leading-5 text-slate-500">Aucun achat valide depuis {data.settings.inactiveCustomerDays} jours.</p></div></div>
      </section>
    </div>
  );
}
