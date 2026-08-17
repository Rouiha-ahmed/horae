import { Download, Filter, Mail, Search, Tag } from "lucide-react";
import Link from "next/link";

import ClientsPageHeader from "@/components/admin/clients/ClientsPageHeader";
import CustomerTable, { type CustomerTableRow } from "@/components/admin/clients/CustomerTable";
import { requireAdmin } from "@/lib/admin";
import { getCustomerList } from "@/lib/services/admin-customers";
import { cn } from "@/lib/utils";
import type { CustomerActivitySegment, LoyaltyTier } from "@prisma/client";

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };
const value = (entry: string | string[] | undefined) => Array.isArray(entry) ? entry[0] || "" : entry || "";
const pageHref = (params: URLSearchParams, page: number) => { const next = new URLSearchParams(params); next.set("page", String(page)); return `/admin/clients/list?${next}`; };

export default async function CustomerListPage({ searchParams }: Props) {
  await requireAdmin();
  const raw = await searchParams;
  const search = value(raw.search);
  const tier = value(raw.tier) || "all";
  const segment = value(raw.segment) || "all";
  const alert = value(raw.alert) || "all";
  const tagId = value(raw.tagId);
  const sort = value(raw.sort) || "created";
  const direction = value(raw.direction) || (sort === "name" ? "asc" : "desc");
  const page = Math.max(1, Number.parseInt(value(raw.page) || "1", 10) || 1);
  const pageSize = Math.min(100, Math.max(10, Number.parseInt(value(raw.pageSize) || "25", 10) || 25));
  const minPoints = value(raw.minPoints) ? Number.parseInt(value(raw.minPoints), 10) : undefined;
  const maxPoints = value(raw.maxPoints) ? Number.parseInt(value(raw.maxPoints), 10) : undefined;
  const data = await getCustomerList({
    search,
    tier: tier as LoyaltyTier | "all",
    segment: segment as CustomerActivitySegment | "all",
    alert: alert as "all" | "expiring" | "inactive",
    tagId: tagId || undefined,
    sort: sort as "name" | "points" | "created" | "tier",
    direction: direction as "asc" | "desc",
    minPoints: Number.isFinite(minPoints) ? minPoints : undefined,
    maxPoints: Number.isFinite(maxPoints) ? maxPoints : undefined,
    page,
    pageSize,
  });
  const query = new URLSearchParams();
  for (const [key, entry] of Object.entries(raw)) { const first = value(entry); if (first) query.set(key, first); }
  const exportHref = `/admin/clients/export?${query}`;
  const rows: CustomerTableRow[] = data.customers.map((customer) => ({
    id: customer.id, fullName: customer.fullName, email: customer.email, phone: customer.phone,
    loyaltyCardNumber: customer.loyaltyCardNumber, loyaltyPoints: customer.loyaltyPoints,
    loyaltyTier: customer.loyaltyTier, activitySegment: customer.activitySegment,
    loyaltySuspended: Boolean(customer.loyaltySuspendedAt), validOrderCount: customer.validOrderCount,
    paidDeliveredRevenue: customer.paidDeliveredRevenue,
    lastValidOrderAt: customer.lastValidOrderAt?.toISOString() || null,
    lastOrderNumber: customer.lastOrderNumber, expiringPoints: customer.expiringPoints,
    pointsExpireAt: customer.pointsExpireAt?.toISOString() || null, tags: customer.tags,
  }));

  return (
    <div className="space-y-5">
      <ClientsPageHeader description="Recherchez, filtrez et pilotez les profils clients sans charger toute la base dans le navigateur." actions={<Link href={exportHref} className="inline-flex h-10 items-center gap-2 rounded-xl border border-emerald-200 bg-white px-4 text-xs font-semibold text-emerald-700"><Download className="h-4 w-4" /> Exporter</Link>} />

      <section className="rounded-[24px] border border-slate-200/80 bg-white p-4 shadow-[0_16px_50px_-42px_rgba(15,23,42,0.4)]">
        <form className="flex flex-col gap-3" action="/admin/clients/list">
          <div className="flex flex-col gap-3 lg:flex-row">
            <label className="relative flex-1"><Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><input name="search" defaultValue={search} placeholder="Rechercher un client…" className="h-11 w-full rounded-2xl border border-slate-200 bg-white pl-10 pr-4 text-sm outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-50" /></label>
            <select name="tier" defaultValue={tier} className="h-11 rounded-2xl border border-slate-200 bg-white px-4 text-xs font-semibold"><option value="all">Tous les statuts</option><option value="bronze">Bronze</option><option value="silver">Argent</option><option value="gold">Gold</option></select>
            <select name="segment" defaultValue={segment} className="h-11 rounded-2xl border border-slate-200 bg-white px-4 text-xs font-semibold"><option value="all">Tous les segments</option><option value="NEW">Nouveaux</option><option value="ACTIVE">Actifs</option><option value="LOYAL">Fidèles</option><option value="TO_REENGAGE">À relancer</option><option value="NO_PURCHASE">Sans achat</option><option value="INACTIVE">Inactifs</option></select>
            <select name="alert" defaultValue={alert} className="h-11 rounded-2xl border border-slate-200 bg-white px-4 text-xs font-semibold"><option value="all">Toutes les alertes</option><option value="expiring">Points expirants</option><option value="inactive">Inactifs / à relancer</option></select>
            <button className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl bg-[#162e6e] px-5 text-xs font-semibold text-white"><Filter className="h-4 w-4" /> Filtrer</button>
          </div>
          <details className="group rounded-2xl border border-slate-100 bg-slate-50/60 px-4 py-3"><summary className="cursor-pointer list-none text-xs font-semibold text-slate-600">Filtres avancés et tri</summary><div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-5"><select name="tagId" defaultValue={tagId} className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-xs"><option value="">Tous les tags</option>{data.tags.map((tag) => <option key={tag.id} value={tag.id}>{tag.name}</option>)}</select><input name="minPoints" type="number" min={0} defaultValue={minPoints} placeholder="Points minimum" className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-xs" /><input name="maxPoints" type="number" min={0} defaultValue={maxPoints} placeholder="Points maximum" className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-xs" /><select name="sort" defaultValue={sort} className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-xs"><option value="created">Date d’inscription</option><option value="name">Nom</option><option value="points">Points</option><option value="tier">Statut fidélité</option></select><select name="direction" defaultValue={direction} className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-xs"><option value="desc">Décroissant</option><option value="asc">Croissant</option></select></div></details>
        </form>
        <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
          {[{ label: "Tous", href: "/admin/clients/list", count: data.counts.total, active: tier === "all" && alert === "all" }, { label: "Bronze", href: "/admin/clients/list?tier=bronze", count: data.counts.tiers.bronze || 0, active: tier === "bronze" }, { label: "Argent", href: "/admin/clients/list?tier=silver", count: data.counts.tiers.silver || 0, active: tier === "silver" }, { label: "Gold", href: "/admin/clients/list?tier=gold", count: data.counts.tiers.gold || 0, active: tier === "gold" }, { label: "Inactifs", href: "/admin/clients/list?alert=inactive", count: (data.counts.segments.INACTIVE || 0) + (data.counts.segments.TO_REENGAGE || 0), active: alert === "inactive" }].map((item) => <Link key={item.label} href={item.href} className={cn("shrink-0 rounded-xl border px-3 py-2 text-xs font-semibold", item.active ? "border-[#162e6e] bg-[#162e6e] text-white" : "border-slate-200 bg-white text-slate-600")}>{item.label} <span className="ml-1 opacity-70">{item.count.toLocaleString("fr-MA")}</span></Link>)}
        </div>
      </section>

      <section className="overflow-hidden rounded-[24px] border border-slate-200/80 bg-white shadow-[0_16px_50px_-42px_rgba(15,23,42,0.4)]">
        {rows.length ? <CustomerTable rows={rows} /> : <div className="flex min-h-72 flex-col items-center justify-center px-5 text-center"><Search className="h-8 w-8 text-slate-300" /><h2 className="mt-4 text-sm font-semibold text-slate-800">Aucun client trouvé</h2><p className="mt-1 text-xs text-slate-400">Modifiez la recherche ou les filtres.</p></div>}
        <div className="flex flex-col gap-3 border-t border-slate-100 px-4 py-4 text-xs text-slate-500 sm:flex-row sm:items-center"><p className="mr-auto">Affichage {(data.pagination.page - 1) * data.pagination.pageSize + (rows.length ? 1 : 0)} à {(data.pagination.page - 1) * data.pagination.pageSize + rows.length} sur {data.pagination.total.toLocaleString("fr-MA")} clients</p><div className="flex items-center gap-2"><Link aria-disabled={page <= 1} href={pageHref(query, Math.max(1, page - 1))} className={cn("rounded-xl border px-3 py-2", page <= 1 && "pointer-events-none opacity-40")}>Précédent</Link><span className="rounded-xl bg-[#162e6e] px-3 py-2 font-semibold text-white">{page}</span><span>/ {data.pagination.totalPages}</span><Link aria-disabled={page >= data.pagination.totalPages} href={pageHref(query, Math.min(data.pagination.totalPages, page + 1))} className={cn("rounded-xl border px-3 py-2", page >= data.pagination.totalPages && "pointer-events-none opacity-40")}>Suivant</Link></div></div>
      </section>
      <div className="sr-only"><Mail /><Tag /></div>
    </div>
  );
}
