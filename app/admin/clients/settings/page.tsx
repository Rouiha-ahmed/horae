import { AlertTriangle, History } from "lucide-react";
import { expireLoyaltyPointsAction } from "@/app/admin/clients/actions";

import ClientsPageHeader from "@/components/admin/clients/ClientsPageHeader";
import { AddRewardButton, LoyaltySettingsForm, RewardEditor } from "@/components/admin/clients/LoyaltySettingsForms";
import { requireAdmin } from "@/lib/admin";
import { prisma } from "@/lib/prisma";
import { getLoyaltyConfiguration } from "@/lib/services/loyalty";

const date = new Intl.DateTimeFormat("fr-MA", { dateStyle: "medium", timeStyle: "short" });

export default async function LoyaltySettingsPage() {
  await requireAdmin();
  const [{ settings, tierRules }, rewards, audit] = await Promise.all([
    getLoyaltyConfiguration(),
    prisma.loyaltyReward.findMany({ where: { archivedAt: null }, orderBy: { pointsCost: "asc" } }),
    prisma.adminAuditLog.findMany({ where: { action: { startsWith: "loyalty." } }, orderBy: { createdAt: "desc" }, take: 12 }),
  ]);
  return <div className="space-y-5"><ClientsPageHeader description="Configurez les statuts, l’expiration, les segments et le catalogue de récompenses. Chaque changement important est audité." actions={<form action={expireLoyaltyPointsAction}><button className="h-10 rounded-xl border border-orange-200 bg-white px-4 text-xs font-semibold text-orange-700">Traiter les expirations dues</button></form>} />
    <div className="grid gap-5 xl:grid-cols-[1.6fr_.8fr]"><LoyaltySettingsForm settings={settings} tierRules={tierRules} /><aside className="space-y-4"><section className="rounded-[24px] border border-amber-200 bg-amber-50/70 p-5"><h2 className="flex items-center gap-2 text-sm font-bold text-amber-900"><AlertTriangle className="h-4 w-4" /> Modification de règle majeure</h2><p className="mt-2 text-xs leading-5 text-amber-800">Les nouvelles règles s’appliquent aux gains et qualifications futurs. Le grand livre historique reste immuable.</p></section><section className="rounded-[24px] border border-slate-200 bg-white p-5"><h2 className="flex items-center gap-2 text-sm font-bold text-[#0f1d42]"><History className="h-4 w-4" /> Historique des modifications</h2><div className="mt-3 divide-y divide-slate-100">{audit.map((item) => <article key={item.id} className="py-3"><div className="flex justify-between gap-3"><p className="text-xs font-semibold text-slate-800">{item.action.replaceAll(".", " · ")}</p><time className="shrink-0 text-[9px] text-slate-400">{date.format(item.createdAt)}</time></div><p className="mt-1 text-[10px] text-slate-500">{item.actorEmail || item.actorUserId || "Système"}</p></article>)}</div></section></aside></div>
    <section id="rewards" className="scroll-mt-24 rounded-[24px] border border-slate-200 bg-white p-5 shadow-[0_16px_50px_-42px_rgba(15,23,42,0.4)]"><div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="text-sm font-bold text-[#0f1d42]">Catalogue des récompenses</h2><p className="mt-1 text-xs text-slate-500">Ajoutez, modifiez, désactivez ou archivez les avantages échangeables.</p></div><AddRewardButton /></div><div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{rewards.map((reward) => <RewardEditor key={reward.id} reward={{ id: reward.id, name: reward.name, description: reward.description, type: reward.type, pointsCost: reward.pointsCost, monetaryValue: reward.monetaryValue ? Number(reward.monetaryValue) : null, percentageValue: reward.percentageValue, isActive: reward.isActive }} />)}</div></section>
  </div>;
}
