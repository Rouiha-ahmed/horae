import { AlertTriangle, CheckCircle2, RefreshCcw, ShieldCheck } from "lucide-react";
import Link from "next/link";

import { reviewQualityIssueAction, scanQualityIssuesAction } from "@/app/admin/clients/actions";
import ClientsPageHeader from "@/components/admin/clients/ClientsPageHeader";
import { requireAdmin } from "@/lib/admin";
import { prisma } from "@/lib/prisma";
import { cn } from "@/lib/utils";

const date = new Intl.DateTimeFormat("fr-MA", { dateStyle: "medium", timeStyle: "short" });
const typeLabels = {
  pointsWithoutRevenue: "Points sans revenu",
  deliveredOrderWithoutPoints: "Commande sans points",
  pointsOnCancelledOrder: "Points sur commande annulée",
  potentialDuplicate: "Doublon potentiel",
  invalidEmail: "E-mail invalide",
  missingPhone: "Téléphone manquant",
};

export default async function CustomerQualityPage() {
  await requireAdmin();
  const [issues, counts] = await Promise.all([
    prisma.customerQualityIssue.findMany({
      where: { status: { in: ["open", "reviewed"] } },
      include: { user: { select: { fullName: true, email: true } }, order: { select: { orderNumber: true } } },
      orderBy: [{ severity: "desc" }, { detectedAt: "desc" }],
      take: 200,
    }),
    prisma.customerQualityIssue.groupBy({ by: ["status"], _count: { id: true } }),
  ]);

  return (
    <div className="space-y-5">
      <ClientsPageHeader description="Détectez les incohérences sans supprimer ni corriger silencieusement les données. Chaque résolution reste une action explicite et auditée." actions={<form action={scanQualityIssuesAction}><button className="inline-flex h-10 items-center gap-2 rounded-xl bg-[#162e6e] px-4 text-xs font-semibold text-white"><RefreshCcw className="h-4 w-4" /> Lancer le contrôle</button></form>} />

      <section className="grid gap-3 sm:grid-cols-3">
        {[{ label: "Ouvertes", value: counts.find((item) => item.status === "open")?._count.id || 0, icon: AlertTriangle, tone: "bg-rose-50 text-rose-600" }, { label: "En revue", value: counts.find((item) => item.status === "reviewed")?._count.id || 0, icon: ShieldCheck, tone: "bg-amber-50 text-amber-600" }, { label: "Résolues", value: counts.find((item) => item.status === "resolved")?._count.id || 0, icon: CheckCircle2, tone: "bg-emerald-50 text-emerald-600" }].map(({ label, value, icon: Icon, tone }) => <article key={label} className="rounded-[22px] border border-slate-200 bg-white p-4"><span className={cn("flex h-10 w-10 items-center justify-center rounded-2xl", tone)}><Icon className="h-4 w-4" /></span><p className="mt-3 text-xl font-bold text-[#0f1d42]">{value}</p><p className="text-xs text-slate-500">{label}</p></article>)}
      </section>

      <section className="overflow-hidden rounded-[24px] border border-slate-200 bg-white shadow-[0_16px_50px_-42px_rgba(15,23,42,0.4)]">
        <div className="hidden overflow-x-auto lg:block"><table className="w-full min-w-[950px] text-left text-xs"><thead className="border-b border-slate-200 bg-slate-50/70 text-[10px] uppercase tracking-wider text-slate-400"><tr><th className="px-5 py-3">Client</th><th>Problème</th><th>Sévérité</th><th>Date détectée</th><th>Commande</th><th>Action recommandée</th><th className="pr-5">Revue</th></tr></thead><tbody className="divide-y divide-slate-100">{issues.map((issue) => <tr key={issue.id}><td className="px-5 py-4">{issue.user ? <Link href={`/admin/clients/${issue.userId}`} className="font-semibold text-slate-900 hover:text-blue-600">{issue.user.fullName}<span className="block text-[10px] font-normal text-slate-400">{issue.user.email}</span></Link> : <span className="text-slate-400">Profil indisponible</span>}</td><td><p className="font-semibold text-slate-800">{typeLabels[issue.type]}</p><p className="mt-1 max-w-64 text-[10px] leading-4 text-slate-500">{issue.description}</p></td><td><span className={cn("rounded-full px-2 py-1 text-[10px] font-semibold", issue.severity === "critical" ? "bg-rose-50 text-rose-700" : issue.severity === "warning" ? "bg-amber-50 text-amber-700" : "bg-blue-50 text-blue-700")}>{issue.severity}</span></td><td>{date.format(issue.detectedAt)}</td><td>{issue.order ? <Link href={`/admin/orders?order=${issue.order.orderNumber}`} className="font-mono text-blue-600">#{issue.order.orderNumber.slice(-8).toUpperCase()}</Link> : "—"}</td><td className="max-w-72 pr-3 text-[10px] leading-4 text-slate-500">{issue.recommendedAction}</td><td className="pr-5"><div className="flex gap-1">{issue.status === "open" ? <form action={reviewQualityIssueAction}><input type="hidden" name="id" value={issue.id} /><input type="hidden" name="status" value="reviewed" /><button className="rounded-lg border px-2 py-1 text-[10px] font-semibold">Revoir</button></form> : null}<form action={reviewQualityIssueAction}><input type="hidden" name="id" value={issue.id} /><input type="hidden" name="status" value="resolved" /><button className="rounded-lg bg-emerald-50 px-2 py-1 text-[10px] font-semibold text-emerald-700">Résoudre</button></form></div></td></tr>)}</tbody></table></div>
        <div className="divide-y divide-slate-100 lg:hidden">{issues.map((issue) => <article key={issue.id} className="p-4"><div className="flex items-center justify-between"><p className="text-xs font-semibold">{typeLabels[issue.type]}</p><span className="rounded-full bg-amber-50 px-2 py-1 text-[10px] text-amber-700">{issue.severity}</span></div><p className="mt-2 text-xs leading-5 text-slate-500">{issue.description}</p><p className="mt-3 rounded-xl bg-slate-50 p-3 text-[11px] text-slate-600">{issue.recommendedAction}</p><form action={reviewQualityIssueAction} className="mt-3"><input type="hidden" name="id" value={issue.id} /><input type="hidden" name="status" value="resolved" /><button className="h-9 w-full rounded-xl bg-emerald-50 text-xs font-semibold text-emerald-700">Marquer résolue</button></form></article>)}</div>
        {!issues.length ? <div className="flex min-h-72 flex-col items-center justify-center px-5 text-center"><ShieldCheck className="h-9 w-9 text-emerald-400" /><h2 className="mt-4 text-sm font-semibold text-slate-800">Aucune anomalie ouverte</h2><p className="mt-1 text-xs text-slate-400">Lancez un contrôle pour analyser les données actuelles.</p></div> : null}
      </section>
    </div>
  );
}
