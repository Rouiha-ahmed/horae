import {
  Activity,
  AlertTriangle,
  ArrowRight,
  BarChart3,
  CalendarClock,
  Crown,
  Gift,
  Medal,
  ReceiptText,
  RefreshCcw,
  Settings2,
  Shield,
  Sparkles,
  Star,
  Truck,
  Users,
  WalletCards,
} from "lucide-react";
import Link from "next/link";

import ClientsPageHeader from "@/components/admin/clients/ClientsPageHeader";
import { adminCurrencyFormatter } from "@/components/admin/AdminPagePrimitives";
import { requireAdmin } from "@/lib/admin";
import { TIER_LABELS } from "@/lib/loyalty";
import { SEGMENT_LABELS, getCustomerOverview } from "@/lib/services/admin-customers";
import { cn } from "@/lib/utils";

const surface = "rounded-[24px] border border-slate-200/80 bg-white shadow-[0_16px_50px_-42px_rgba(15,23,42,0.4)]";
const integer = new Intl.NumberFormat("fr-MA");
const date = new Intl.DateTimeFormat("fr-MA", { day: "2-digit", month: "short", year: "numeric" });

export default async function AdminClientsOverviewPage() {
  await requireAdmin();
  const data = await getCustomerOverview();
  const metrics = [
    { label: "Total clients", value: integer.format(data.metrics.totalCustomers), helper: "Profils enregistrés", icon: Users, tone: "bg-blue-50 text-blue-600" },
    { label: "Clients actifs (30 j)", value: integer.format(data.metrics.activeCustomers), helper: "Achat valide récent", icon: Activity, tone: "bg-indigo-50 text-indigo-600" },
    { label: "Clients Gold", value: integer.format(data.metrics.goldCustomers), helper: "Seuil Gold atteint", icon: Crown, tone: "bg-amber-50 text-amber-600" },
    { label: "Clients Argent", value: integer.format(data.metrics.silverCustomers), helper: "Seuil Argent atteint", icon: Medal, tone: "bg-slate-100 text-slate-500" },
    { label: "Points disponibles", value: integer.format(data.metrics.availablePoints), helper: "Solde réconciliable", icon: WalletCards, tone: "bg-cyan-50 text-cyan-600" },
    { label: "Points expirant bientôt", value: integer.format(data.metrics.expiringPoints), helper: `${Math.max(...data.settings.expirationAlertDays)} jours`, icon: CalendarClock, tone: "bg-orange-50 text-orange-600" },
    { label: "CA clients fidèles", value: adminCurrencyFormatter.format(data.metrics.loyalRevenue), helper: "12 mois · payé + livré", icon: BarChart3, tone: "bg-emerald-50 text-emerald-600" },
    { label: "Commande moyenne", value: adminCurrencyFormatter.format(data.metrics.averageOrderValue), helper: "Payée + livrée", icon: ReceiptText, tone: "bg-violet-50 text-violet-600" },
  ];

  return (
    <div className="space-y-5">
      <ClientsPageHeader description="Centralisez les profils clients, la segmentation, les points et les récompenses pour développer la fidélité et la valeur client." />

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-8">
        {metrics.map(({ label, value, helper, icon: Icon, tone }) => (
          <article key={label} className={cn(surface, "min-h-40 p-4 2xl:p-4")}>
            <span className={cn("flex h-10 w-10 items-center justify-center rounded-2xl", tone)}>
              <Icon className="h-5 w-5" />
            </span>
            <p className="mt-4 text-xl font-bold tracking-tight text-[#0f1d42]">{value}</p>
            <h2 className="mt-1 text-xs font-semibold text-slate-800">{label}</h2>
            <p className="mt-3 text-[11px] text-slate-400">{helper}</p>
          </article>
        ))}
      </section>

      <section className={cn(surface, "border-amber-200/80 bg-gradient-to-r from-amber-50/70 via-white to-white p-5")}>
        <div className="flex flex-col gap-5 xl:flex-row xl:items-center">
          <div className="flex min-w-[210px] items-center gap-3">
            <Crown className="h-5 w-5 text-amber-500" />
            <div>
              <p className="text-sm font-bold text-amber-800">Programme de fidélité HORAE</p>
              <p className="text-[11px] text-amber-700/70">Règles actives et configurables</p>
            </div>
          </div>
          <div className="grid flex-1 gap-3 sm:grid-cols-3">
            {data.tierRules.map((rule, index) => (
              <div key={rule.tier} className="flex items-center gap-3 rounded-2xl border border-white bg-white/80 px-4 py-3">
                <span className={cn("h-2.5 w-2.5 rounded-full", index === 0 ? "bg-orange-500" : index === 1 ? "bg-slate-400" : "bg-amber-400")} />
                <div>
                  <p className="text-xs font-bold text-slate-800">{TIER_LABELS[rule.tier]}</p>
                  <p className="mt-0.5 text-[11px] text-slate-500">{rule.pointsPer100Mad} pts / 100 MAD · dès {integer.format(rule.revenueThreshold)} MAD</p>
                </div>
              </div>
            ))}
          </div>
          <div className="flex items-center gap-4 border-l-0 text-xs text-slate-600 xl:border-l xl:border-slate-200 xl:pl-5">
            <span><strong className="text-slate-900">{data.settings.pointExpirationMonths} mois</strong><br />expiration</span>
            <span><strong className="text-slate-900">{data.settings.statusValidityMonths} mois</strong><br />statut</span>
            <Link href="/admin/clients/settings" className="flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 font-semibold text-[#162e6e]">
              <Settings2 className="h-4 w-4" /> Paramètres
            </Link>
          </div>
        </div>
      </section>

      <div className="grid gap-4 xl:grid-cols-[1.05fr_1.25fr_1fr]">
        <section className={cn(surface, "p-5")}>
          <div className="flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-sm font-bold text-[#0f1d42]"><Gift className="h-4 w-4" /> Récompenses disponibles</h2>
            <Link href="/admin/clients/settings#rewards" className="text-xs font-semibold text-blue-600">Gérer</Link>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2">
            {data.rewards.slice(0, 4).map((reward, index) => (
              <article key={reward.id} className={cn("rounded-2xl border p-3", index % 4 === 0 ? "border-orange-100 bg-orange-50/50" : index % 4 === 1 ? "border-blue-100 bg-blue-50/50" : index % 4 === 2 ? "border-emerald-100 bg-emerald-50/50" : "border-violet-100 bg-violet-50/50")}>
                <p className="text-xs font-bold text-slate-800">{reward.pointsCost} pts</p>
                <div className="my-3 flex h-9 w-9 items-center justify-center rounded-xl bg-white text-blue-600"><Gift className="h-4 w-4" /></div>
                <p className="line-clamp-2 text-[11px] font-semibold text-slate-600">{reward.name}</p>
              </article>
            ))}
          </div>
        </section>

        <section className={cn(surface, "p-5")}>
          <div className="flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-sm font-bold text-[#0f1d42]"><Users className="h-4 w-4" /> Segments clients</h2>
            <Link href="/admin/clients/segments" className="text-xs font-semibold text-blue-600">Analyser</Link>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
            {Object.entries(SEGMENT_LABELS).map(([key, label], index) => (
              <Link key={key} href={`/admin/clients/list?segment=${key}`} className={cn("rounded-2xl border p-3 text-center transition hover:-translate-y-0.5", index === 1 ? "border-[#162e6e] bg-[#162e6e] text-white" : "border-slate-200 bg-slate-50/60 text-slate-700")}>
                <p className="text-[11px] font-semibold">{label}</p>
                <p className="mt-1 text-sm font-bold">{integer.format(data.segments[key as keyof typeof data.segments] || 0)}</p>
              </Link>
            ))}
          </div>
          <div className="mt-4 flex items-center justify-between rounded-2xl bg-orange-50 px-4 py-3 text-xs text-orange-800">
            <span><strong>{integer.format(data.segments.TO_REENGAGE || 0)}</strong> client(s) à relancer selon leur cycle</span>
            <RefreshCcw className="h-4 w-4" />
          </div>
        </section>

        <section className={cn(surface, "p-5")}>
          <div className="flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-sm font-bold text-[#0f1d42]"><AlertTriangle className="h-4 w-4" /> Alertes &amp; actions</h2>
            <Link href="/admin/clients/quality" className="text-xs font-semibold text-blue-600">Tout voir</Link>
          </div>
          <div className="mt-3 divide-y divide-slate-100">
            {[
              { icon: CalendarClock, value: `${integer.format(data.metrics.expiringPoints)} pts`, label: "expirent bientôt", href: "/admin/clients/list?alert=expiring", tone: "text-orange-600 bg-orange-50" },
              { icon: Crown, value: `${integer.format(data.metrics.goldCustomers)} clients`, label: "au statut Gold", href: "/admin/clients/list?tier=gold", tone: "text-amber-600 bg-amber-50" },
              { icon: RefreshCcw, value: `${integer.format(data.segments.TO_REENGAGE || 0)} clients`, label: "à relancer", href: "/admin/clients/segments", tone: "text-blue-600 bg-blue-50" },
              { icon: Shield, value: `${data.qualityIssueCount} anomalie(s)`, label: "à contrôler", href: "/admin/clients/quality", tone: "text-rose-600 bg-rose-50" },
            ].map(({ icon: Icon, value, label, href, tone }) => (
              <Link key={label} href={href} className="flex items-center gap-3 py-3 first:pt-1">
                <span className={cn("flex h-9 w-9 items-center justify-center rounded-xl", tone)}><Icon className="h-4 w-4" /></span>
                <span className="min-w-0 flex-1 text-xs"><strong className="block text-slate-900">{value}</strong><span className="text-slate-500">{label}</span></span>
                <ArrowRight className="h-3.5 w-3.5 text-blue-500" />
              </Link>
            ))}
          </div>
        </section>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.5fr_1fr]">
        <section className={cn(surface, "overflow-hidden")}>
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
            <h2 className="text-sm font-bold text-[#0f1d42]">Top clients</h2>
            <Link href="/admin/clients/list" className="text-xs font-semibold text-blue-600">Voir tous les clients →</Link>
          </div>
          {data.topCustomers.length ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[680px] text-left text-xs">
                <thead className="bg-slate-50/70 text-[10px] uppercase tracking-wider text-slate-400"><tr><th className="px-5 py-3">Client</th><th>Statut</th><th>Points</th><th>CA qualifiant</th><th>Commandes</th><th>Dernière commande</th></tr></thead>
                <tbody className="divide-y divide-slate-100">
                  {data.topCustomers.map((customer) => (
                    <tr key={customer.id} className="hover:bg-slate-50/60">
                      <td className="px-5 py-3"><Link href={`/admin/clients/${customer.id}`} className="font-semibold text-slate-900 hover:text-blue-600">{customer.fullName}</Link><span className="block text-[10px] text-slate-400">{customer.email}</span></td>
                      <td><span className="rounded-full bg-amber-50 px-2 py-1 text-[10px] font-semibold text-amber-700">{TIER_LABELS[customer.loyaltyTier]}</span></td>
                      <td className="font-semibold">{integer.format(customer.loyaltyPoints)} pts</td>
                      <td className="font-semibold">{adminCurrencyFormatter.format(customer.revenue)}</td>
                      <td>{customer.orderCount}</td><td>{customer.lastOrderAt ? date.format(customer.lastOrderAt) : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : <p className="px-5 py-12 text-center text-sm text-slate-400">Aucune commande payée et livrée.</p>}
        </section>

        <section className={cn(surface, "p-5")}>
          <h2 className="flex items-center gap-2 text-sm font-bold text-[#0f1d42]"><Sparkles className="h-4 w-4 text-violet-500" /> Produits à achat répété</h2>
          <p className="mt-1 text-xs text-slate-500">Dérivé des commandes payées et livrées.</p>
          <div className="mt-3 divide-y divide-slate-100">
            {data.repeatProducts.length ? data.repeatProducts.map((product) => (
              <div key={product.productId} className="flex items-center gap-3 py-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600"><Truck className="h-4 w-4" /></span>
                <div className="min-w-0 flex-1"><p className="truncate text-xs font-semibold text-slate-900">{product.productName}</p><p className="text-[10px] text-slate-400">{product.repeatCustomers} clients récurrents · {product.purchaseCount} achats</p></div>
                <Star className="h-4 w-4 text-amber-400" />
              </div>
            )) : <p className="py-10 text-center text-xs text-slate-400">Pas encore assez d’historique.</p>}
          </div>
        </section>
      </div>
    </div>
  );
}
