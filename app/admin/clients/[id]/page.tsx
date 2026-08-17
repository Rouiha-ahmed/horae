import {
  ArrowLeft,
  Calendar,
  Clock3,
  Crown,
  Gift,
  Mail,
  MapPin,
  Phone,
  ShoppingBag,
  Star,
  Trophy,
  UserRound,
  WalletCards,
} from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import CustomerProfileActions from "@/components/admin/clients/CustomerProfileActions";
import RewardRedeemButton from "@/components/admin/clients/RewardRedeemButton";
import { requireAdmin } from "@/lib/admin";
import { TIER_LABELS } from "@/lib/loyalty";
import { SEGMENT_LABELS, getCustomerDetail } from "@/lib/services/admin-customers";
import { cn } from "@/lib/utils";

type Props = { params: Promise<{ id: string }>; searchParams: Promise<{ tab?: string }> };
const money = new Intl.NumberFormat("fr-MA", { style: "currency", currency: "MAD" });
const date = new Intl.DateTimeFormat("fr-MA", { day: "2-digit", month: "short", year: "numeric" });
const dateTime = new Intl.DateTimeFormat("fr-MA", { dateStyle: "medium", timeStyle: "short" });
const surface = "rounded-[24px] border border-slate-200/80 bg-white shadow-[0_16px_50px_-42px_rgba(15,23,42,0.4)]";

export default async function CustomerProfilePage({ params, searchParams }: Props) {
  await requireAdmin();
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const data = await getCustomerDetail(id);
  if (!data) notFound();
  const { user, metrics } = data;
  const tab = new Set(["summary", "orders", "loyalty", "profile"]).has(query.tab || "") ? query.tab! : "summary";
  const address = user.addresses[0] || null;
  const initials = user.fullName.split(" ").map((part) => part[0]).slice(0, 2).join("").toUpperCase();
  const tierProgress = data.nextTierThreshold
    ? Math.min(100, Math.max(0, (metrics.qualifyingRevenue / data.nextTierThreshold) * 100))
    : 100;
  const nextRewardProgress = data.nextReward
    ? Math.min(100, Math.max(0, (user.loyaltyPoints / data.nextReward.pointsCost) * 100))
    : 100;
  const earnedByOrder = new Map(
    user.loyaltyTransactions
      .filter((transaction) => transaction.orderId && transaction.type === "earned")
      .map((transaction) => [transaction.orderId!, transaction.amount]),
  );
  const tabs = [
    { key: "summary", label: "Résumé" },
    { key: "orders", label: "Commandes" },
    { key: "loyalty", label: "Fidélité" },
    { key: "profile", label: "Profil" },
  ];

  return <div className="space-y-4">
    <div className="flex items-center gap-2 text-xs text-slate-500"><Link href="/admin/clients" className="hover:text-blue-600">Clients &amp; fidélité</Link><span>›</span><Link href="/admin/clients/list" className="hover:text-blue-600">Clients</Link><span>›</span><span className="font-semibold text-slate-800">Fiche client</span></div>

    <section className={`${surface} p-5`}>
      <div className="grid gap-5 xl:grid-cols-[1.35fr_repeat(4,minmax(150px,.65fr))]">
        <div className="flex items-start gap-4">
          <div className="relative flex h-20 w-20 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-orange-400 to-orange-600 text-2xl font-bold text-white"><span>{initials}</span><span className="absolute -bottom-1 -right-1 flex h-8 w-8 items-center justify-center rounded-full border-4 border-white bg-amber-50 text-amber-600"><Crown className="h-4 w-4" /></span></div>
          <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h1 className="text-xl font-bold text-[#0f1d42]">{user.fullName}</h1><span className="rounded-full bg-amber-50 px-2.5 py-1 text-[10px] font-semibold text-amber-700 ring-1 ring-amber-200">{TIER_LABELS[user.loyaltyTier]}</span><span className="rounded-full bg-blue-50 px-2.5 py-1 text-[10px] font-semibold text-blue-700">{SEGMENT_LABELS[user.activitySegment]}</span></div><p className="mt-2 flex items-center gap-2 text-xs text-slate-500"><Mail className="h-3.5 w-3.5" /> {user.email}</p>{address?.phone ? <p className="mt-1 flex items-center gap-2 text-xs text-slate-500"><Phone className="h-3.5 w-3.5" /> {address.phone}</p> : null}{address?.city ? <p className="mt-1 flex items-center gap-2 text-xs text-slate-500"><MapPin className="h-3.5 w-3.5" /> {address.city}, Maroc</p> : null}<p className="mt-2 text-[10px] text-slate-400">Client depuis le {date.format(user.createdAt)} · Carte {user.loyaltyCardNumber}</p>{user.loyaltySuspendedAt ? <p className="mt-2 rounded-lg bg-rose-50 px-2 py-1 text-[10px] font-semibold text-rose-700">Fidélité suspendue · {user.loyaltySuspensionReason}</p> : null}</div>
        </div>
        {[
          { label: "Points disponibles", value: `${user.loyaltyPoints.toLocaleString("fr-MA")} pts`, helper: "Solde du grand livre", icon: Star, tone: "text-blue-600 bg-blue-50" },
          { label: "Dépenses qualifiantes", value: money.format(metrics.qualifyingRevenue), helper: "12 derniers mois", icon: ShoppingBag, tone: "text-[#162e6e] bg-slate-50" },
          { label: "Statut actuel", value: TIER_LABELS[user.loyaltyTier], helper: user.loyaltyTierValidUntil ? `Valide jusqu’au ${date.format(user.loyaltyTierValidUntil)}` : data.nextTier ? `Prochain : ${TIER_LABELS[data.nextTier]}` : "Niveau maximal", icon: Crown, tone: "text-amber-600 bg-amber-50" },
          { label: "Points à expirer", value: `${metrics.expiringPoints.toLocaleString("fr-MA")} pts`, helper: `Dans ${Math.max(...data.settings.expirationAlertDays)} jours`, icon: Clock3, tone: "text-orange-600 bg-orange-50" },
        ].map(({ label, value, helper, icon: Icon, tone }) => <article key={label} className="rounded-[20px] border border-slate-200 p-4"><span className={cn("flex h-9 w-9 items-center justify-center rounded-xl", tone)}><Icon className="h-4 w-4" /></span><p className="mt-4 text-[9px] font-bold uppercase tracking-wider text-slate-400">{label}</p><p className="mt-1 text-lg font-bold text-[#0f1d42]">{value}</p><p className="mt-2 text-[10px] text-slate-400">{helper}</p></article>)}
      </div>
    </section>

    <section className={`${surface} grid gap-5 p-5 lg:grid-cols-2`}>
      <div>
        <div className="flex justify-between text-[10px] font-semibold uppercase tracking-wider text-slate-400">
          <span>Progression vers {data.nextTier ? TIER_LABELS[data.nextTier] : "le statut maximal"}</span>
          <span>{money.format(metrics.qualifyingRevenue)}{data.nextTierThreshold ? ` / ${money.format(data.nextTierThreshold)}` : ""}</span>
        </div>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100">
          <div className="h-full rounded-full bg-gradient-to-r from-orange-400 to-amber-500" style={{ width: `${tierProgress}%` }} />
        </div>
      </div>
      <div className="border-t border-slate-100 pt-4 lg:border-l lg:border-t-0 lg:pl-5 lg:pt-0">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-violet-50 text-violet-600"><Gift className="h-4 w-4" /></span>
          <div className="flex-1"><p className="text-[10px] text-slate-400">Prochaine récompense</p><p className="text-xs font-semibold">{data.nextReward?.name || "Toutes les récompenses accessibles"}</p></div>
          <strong className="text-xs text-slate-500">{data.nextReward ? `${Math.max(0, data.nextReward.pointsCost - user.loyaltyPoints)} pts restants` : "100 %"}</strong>
        </div>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100">
          <div className="h-full rounded-full bg-violet-500" style={{ width: `${nextRewardProgress}%` }} />
        </div>
      </div>
    </section>

    <nav className="flex gap-1 overflow-x-auto rounded-[20px] border border-slate-200 bg-white p-1.5">{tabs.map((item) => <Link key={item.key} href={`/admin/clients/${id}?tab=${item.key}`} className={cn("shrink-0 rounded-xl px-4 py-2 text-xs font-semibold", tab === item.key ? "bg-[#162e6e] text-white" : "text-slate-500 hover:bg-slate-50")}>{item.label}</Link>)}</nav>

    <div className="grid gap-4 xl:grid-cols-[1fr_320px]">
      <main className="space-y-4">
        {tab === "summary" ? <>
          <div className="grid gap-4 lg:grid-cols-2"><RewardsPanel data={data} /><LedgerPanel transactions={user.loyaltyTransactions.slice(0, 8)} /></div>
          <OrdersPanel orders={user.orders.slice(0, 6)} earnedByOrder={earnedByOrder} />
        </> : null}
        {tab === "orders" ? <OrdersPanel orders={user.orders} earnedByOrder={earnedByOrder} /> : null}
        {tab === "loyalty" ? <><RewardsPanel data={data} /><LedgerPanel transactions={user.loyaltyTransactions} /></> : null}
        {tab === "profile" ? <section className={`${surface} p-5`}><h2 className="text-sm font-bold text-[#0f1d42]">Profil complet</h2><div className="mt-4 grid gap-3 sm:grid-cols-2">{[["Nom", user.fullName], ["E-mail", user.email], ["Téléphone", address?.phone || "Non renseigné"], ["Ville", address?.city || "Non renseignée"], ["Carte fidélité", user.loyaltyCardNumber], ["Création", dateTime.format(user.createdAt)], ["Paiement en plusieurs fois", user.installmentsEligible ? "Autorisé" : "Non autorisé"], ["Dernière mise à jour", dateTime.format(user.updatedAt)]].map(([label, value]) => <div key={label} className="rounded-2xl bg-slate-50 p-4"><p className="text-[10px] uppercase tracking-wider text-slate-400">{label}</p><p className="mt-1 text-xs font-semibold text-slate-800">{value}</p></div>)}</div>{address ? <div className="mt-4 rounded-2xl border border-slate-200 p-4"><p className="text-xs font-semibold">Adresse principale</p><p className="mt-2 text-xs leading-5 text-slate-500">{address.name}<br />{address.address}<br />{address.city} {address.zip}<br />{address.state}</p></div> : null}</section> : null}
      </main>
      <aside className="space-y-4"><CustomerProfileActions user={{ id: user.id, fullName: user.fullName, email: user.email, suspended: Boolean(user.loyaltySuspendedAt) }} /><section className={`${surface} p-4`}><div className="flex items-center justify-between"><h2 className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Notes internes</h2><span className="text-[10px] text-slate-400">{user.notes.length}</span></div><div className="mt-2 divide-y divide-slate-100">{user.notes.length ? user.notes.slice(0, 5).map((note) => <article key={note.id} className="py-3"><p className="text-xs leading-5 text-slate-600">{note.content}</p><p className="mt-2 text-[9px] text-slate-400">{note.createdBy} · {dateTime.format(note.createdAt)}</p></article>) : <p className="py-8 text-center text-xs text-slate-400">Aucune note.</p>}</div></section></aside>
    </div>
    <Link href="/admin/clients/list" className="inline-flex items-center gap-2 text-xs font-semibold text-slate-500 hover:text-blue-600"><ArrowLeft className="h-4 w-4" /> Retour à la liste</Link>
  </div>;
}

type Detail = NonNullable<Awaited<ReturnType<typeof getCustomerDetail>>>;

function RewardsPanel({ data }: { data: Detail }) {
  return <section className={`${surface} p-4`}><div className="flex items-center justify-between"><h2 className="text-xs font-bold uppercase tracking-wider text-slate-500">Récompenses disponibles</h2><Gift className="h-4 w-4 text-violet-500" /></div><div className="mt-3 grid grid-cols-2 gap-2">{data.rewards.slice(0, 6).map((reward) => <article key={reward.id} className="rounded-2xl border border-slate-200 bg-slate-50/50 p-3"><div className="flex items-center justify-between"><span className="flex h-8 w-8 items-center justify-center rounded-xl bg-white text-violet-600"><Gift className="h-4 w-4" /></span><span className="text-[10px] font-bold text-blue-600">{reward.pointsCost} pts</span></div><p className="mt-3 line-clamp-2 text-[11px] font-semibold text-slate-700">{reward.name}</p><RewardRedeemButton userId={data.user.id} rewardId={reward.id} disabled={data.user.loyaltyPoints < reward.pointsCost || Boolean(data.user.loyaltySuspendedAt)} /></article>)}</div></section>;
}

function LedgerPanel({ transactions }: { transactions: Detail["user"]["loyaltyTransactions"] }) {
  return <section className={`${surface} p-4`}><div className="flex items-center justify-between"><h2 className="text-xs font-bold uppercase tracking-wider text-slate-500">Historique fidélité</h2><WalletCards className="h-4 w-4 text-blue-500" /></div><div className="mt-3 divide-y divide-slate-100">{transactions.length ? transactions.map((transaction) => <article key={transaction.id} className="flex items-center gap-3 py-2.5"><span className={cn("flex h-8 w-8 items-center justify-center rounded-xl", transaction.amount > 0 ? "bg-emerald-50 text-emerald-600" : "bg-rose-50 text-rose-600")}><Trophy className="h-3.5 w-3.5" /></span><div className="min-w-0 flex-1"><p className="truncate text-[11px] font-semibold text-slate-700">{transaction.reason}</p><p className="text-[9px] text-slate-400">{dateTime.format(transaction.createdAt)} · {transaction.createdBy || "Système"}</p></div><strong className={cn("text-xs", transaction.amount > 0 ? "text-emerald-600" : "text-rose-600")}>{transaction.amount > 0 ? "+" : ""}{transaction.amount} pts</strong></article>) : <p className="py-12 text-center text-xs text-slate-400">Aucun mouvement.</p>}</div></section>;
}

function OrdersPanel({ orders, earnedByOrder }: { orders: Detail["user"]["orders"]; earnedByOrder: Map<string, number> }) {
  return <section className={`${surface} overflow-hidden`}><div className="flex items-center justify-between border-b border-slate-100 px-5 py-4"><h2 className="text-xs font-bold uppercase tracking-wider text-slate-500">Historique commandes</h2><Calendar className="h-4 w-4 text-slate-400" /></div>{orders.length ? <div className="overflow-x-auto"><table className="w-full min-w-[760px] text-left text-xs"><thead className="bg-slate-50/70 text-[9px] uppercase tracking-wider text-slate-400"><tr><th className="px-5 py-3">Commande</th><th>Date</th><th>Statut</th><th>Montant</th><th>Points gagnés</th><th>Livraison</th><th>Action</th></tr></thead><tbody className="divide-y divide-slate-100">{orders.map((order) => { const qualifies = order.status === "delivered" && order.paymentStatus === "paid"; return <tr key={order.id}><td className="px-5 py-3 font-mono font-semibold text-blue-600">#{order.orderNumber.slice(-8).toUpperCase()}</td><td>{date.format(order.orderDate)}</td><td><span className={cn("rounded-full px-2 py-1 text-[9px] font-semibold", qualifies ? "bg-emerald-50 text-emerald-700" : order.status === "cancelled" ? "bg-rose-50 text-rose-700" : "bg-amber-50 text-amber-700")}>{order.status} · {order.paymentStatus}</span></td><td className="font-semibold">{money.format(Number(order.totalPrice))}</td><td className={cn("font-semibold", earnedByOrder.get(order.id) ? "text-emerald-600" : "text-slate-400")}>{earnedByOrder.get(order.id) ? `+${earnedByOrder.get(order.id)} pts` : "0 pt"}</td><td>{order.deliveryCompany || (order.shippingAddress ? "Livraison à domicile" : "—")}</td><td><Link href={`/admin/orders?order=${order.orderNumber}`} className="rounded-lg border px-2 py-1 text-[9px] font-semibold text-blue-600">Voir le détail</Link></td></tr>; })}</tbody></table></div> : <p className="px-5 py-14 text-center text-xs text-slate-400">Aucune commande.</p>}</section>;
}
