"use client";

import { useActionState, useState } from "react";
import { Archive, Gift, Plus, Save, ShieldCheck } from "lucide-react";

import {
  archiveRewardAction,
  saveRewardAction,
  updateLoyaltySettingsAction,
  type CustomerActionState,
} from "@/app/admin/clients/actions";
import { Button } from "@/components/ui/button";

const initial: CustomerActionState = { success: false };
const input = "h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-50";

type SettingsProps = {
  settings: {
    statusValidityMonths: number;
    pointExpirationMonths: number;
    expirationAlertDays: number[];
    separateStatusAndPoints: boolean;
    newCustomerDays: number;
    activeCustomerDays: number;
    inactiveCustomerDays: number;
    loyalMinimumOrders: number;
    loyalMinimumRevenue: number;
    reengagementCycleMultiplier: number;
    minimumOrdersForCycle: number;
  };
  tierRules: Array<{
    tier: "bronze" | "silver" | "gold";
    pointsPer100Mad: number;
    revenueThreshold: number;
    qualificationMonths: number;
  }>;
};

export function LoyaltySettingsForm({ settings, tierRules }: SettingsProps) {
  const [state, formAction, pending] = useActionState(updateLoyaltySettingsAction, initial);
  const rules = new Map(tierRules.map((rule) => [rule.tier, rule]));
  const tiers = ["bronze", "silver", "gold"] as const;
  const labels = { bronze: "Bronze", silver: "Argent", gold: "Gold" };
  const colors = { bronze: "border-orange-200 bg-orange-50/40", silver: "border-slate-200 bg-slate-50/60", gold: "border-amber-200 bg-amber-50/40" };

  return (
    <form action={formAction} className="space-y-4">
      <section className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-[0_16px_50px_-42px_rgba(15,23,42,0.4)]">
        <div><h2 className="text-sm font-bold text-[#0f1d42]">Règles du programme de fidélité</h2><p className="mt-1 text-xs text-slate-500">Les seuils utilisent exclusivement le CA des commandes payées et livrées.</p></div>
        <div className="mt-4 grid gap-3 lg:grid-cols-3">
          {tiers.map((tier) => {
            const rule = rules.get(tier)!;
            return <fieldset key={tier} className={`rounded-[20px] border p-4 ${colors[tier]}`}><legend className="px-1 text-sm font-bold text-slate-800">{labels[tier]}</legend><div className="mt-2 grid gap-3 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3"><label className="text-[10px] font-semibold text-slate-500">Points / 100 MAD<input className={`${input} mt-1`} type="number" name={`${tier}PointsPer100Mad`} defaultValue={rule.pointsPer100Mad} min={1} required /></label><label className="text-[10px] font-semibold text-slate-500">Seuil CA (MAD)<input className={`${input} mt-1`} type="number" name={`${tier}RevenueThreshold`} defaultValue={rule.revenueThreshold} min={0} step="0.01" required /></label><label className="text-[10px] font-semibold text-slate-500">Période (mois)<input className={`${input} mt-1`} type="number" name={`${tier}QualificationMonths`} defaultValue={rule.qualificationMonths} min={1} required /></label></div></fieldset>;
          })}
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-3"><label className="rounded-2xl border border-slate-200 p-4 text-xs font-semibold">Validité du statut<input className={`${input} mt-3`} name="statusValidityMonths" type="number" min={1} defaultValue={settings.statusValidityMonths} /><span className="mt-1 block text-[10px] font-normal text-slate-400">mois</span></label><label className="rounded-2xl border border-slate-200 p-4 text-xs font-semibold">Expiration après inactivité<input className={`${input} mt-3`} name="pointExpirationMonths" type="number" min={1} defaultValue={settings.pointExpirationMonths} /><span className="mt-1 block text-[10px] font-normal text-slate-400">mois</span></label><label className="rounded-2xl border border-slate-200 p-4 text-xs font-semibold">Alertes avant expiration<input className={`${input} mt-3`} name="expirationAlertDays" defaultValue={settings.expirationAlertDays.join(", ")} /><span className="mt-1 block text-[10px] font-normal text-slate-400">jours, séparés par des virgules</span></label></div>
        <label className="mt-4 flex items-center justify-between gap-4 rounded-2xl border border-cyan-100 bg-cyan-50/50 p-4"><span><strong className="flex items-center gap-2 text-xs text-slate-800"><ShieldCheck className="h-4 w-4 text-cyan-600" /> Séparer le statut et les points</strong><small className="mt-1 block text-[10px] text-slate-500">Le solde disponible reste indépendant du niveau client.</small></span><input type="checkbox" name="separateStatusAndPoints" defaultChecked={settings.separateStatusAndPoints} className="h-5 w-5 accent-emerald-500" /></label>
      </section>

      <section id="segments" className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-[0_16px_50px_-42px_rgba(15,23,42,0.4)] scroll-mt-24">
        <h2 className="text-sm font-bold text-[#0f1d42]">Règles de segmentation</h2><p className="mt-1 text-xs text-slate-500">Ces seuils alimentent les segments stockés et les suggestions de relance.</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{[
          ["newCustomerDays", "Nouveau pendant (jours)", settings.newCustomerDays],
          ["activeCustomerDays", "Actif pendant (jours)", settings.activeCustomerDays],
          ["inactiveCustomerDays", "Inactif après (jours)", settings.inactiveCustomerDays],
          ["loyalMinimumOrders", "Commandes client fidèle", settings.loyalMinimumOrders],
          ["loyalMinimumRevenue", "CA minimum fidèle", settings.loyalMinimumRevenue],
          ["reengagementCycleMultiplier", "Multiplicateur de relance", settings.reengagementCycleMultiplier],
          ["minimumOrdersForCycle", "Achats pour calculer le cycle", settings.minimumOrdersForCycle],
        ].map(([name, label, defaultValue]) => <label key={String(name)} className="text-[10px] font-semibold text-slate-500">{label}<input className={`${input} mt-1`} type="number" step={name === "reengagementCycleMultiplier" ? "0.1" : name === "loyalMinimumRevenue" ? "0.01" : "1"} name={String(name)} defaultValue={Number(defaultValue)} min={name === "minimumOrdersForCycle" ? 2 : 1} required /></label>)}</div>
      </section>

      <section className="rounded-[24px] border border-amber-200 bg-amber-50/70 p-5"><label className="flex items-start gap-3 text-xs leading-5 text-amber-900"><input type="checkbox" name="confirmMajor" value="yes" className="mt-0.5 h-4 w-4 accent-amber-600" /><span><strong>Je confirme cette modification majeure.</strong><br />Changer les seuils ou les taux peut modifier le statut et les futurs gains des clients. Les transactions historiques ne sont jamais réécrites.</span></label>{state.error ? <p className="mt-3 text-xs font-semibold text-rose-700">{state.error}</p> : null}{state.success ? <p className="mt-3 text-xs font-semibold text-emerald-700">{state.message}</p> : null}<Button disabled={pending} className="mt-4 rounded-xl bg-[#162e6e] text-white"><Save className="h-4 w-4" /> {pending ? "Enregistrement…" : "Enregistrer les paramètres"}</Button></section>
    </form>
  );
}

type RewardProps = {
  reward?: {
    id: string;
    name: string;
    description: string | null;
    type: "fixed_discount" | "free_delivery" | "percentage_discount" | "gift" | "custom";
    pointsCost: number;
    monetaryValue: number | null;
    percentageValue: number | null;
    isActive: boolean;
  };
};

export function RewardEditor({ reward }: RewardProps) {
  const [open, setOpen] = useState(!reward);
  const [state, formAction, pending] = useActionState(saveRewardAction, initial);
  if (!open && reward) {
    return <article className="rounded-[20px] border border-slate-200 bg-white p-4"><div className="flex items-start justify-between gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-violet-50 text-violet-600"><Gift className="h-4 w-4" /></span><span className={`rounded-full px-2 py-1 text-[9px] font-semibold ${reward.isActive ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>{reward.isActive ? "Activée" : "Inactive"}</span></div><p className="mt-3 text-sm font-bold text-slate-900">{reward.pointsCost} pts</p><p className="mt-1 text-xs font-semibold text-slate-600">{reward.name}</p><div className="mt-4 flex gap-2"><button type="button" onClick={() => setOpen(true)} className="h-8 flex-1 rounded-xl border text-[10px] font-semibold text-blue-600">Modifier</button><form action={archiveRewardAction}><input type="hidden" name="id" value={reward.id} /><button aria-label="Archiver" className="flex h-8 w-8 items-center justify-center rounded-xl border text-rose-500"><Archive className="h-3.5 w-3.5" /></button></form></div></article>;
  }
  return <form action={formAction} className="rounded-[20px] border border-blue-100 bg-blue-50/30 p-4">{reward ? <input type="hidden" name="id" value={reward.id} /> : null}<div className="grid gap-3 sm:grid-cols-2"><label className="text-[10px] font-semibold text-slate-500 sm:col-span-2">Nom<input className={`${input} mt-1`} name="name" defaultValue={reward?.name} required /></label><label className="text-[10px] font-semibold text-slate-500">Type<select className={`${input} mt-1`} name="type" defaultValue={reward?.type || "fixed_discount"}><option value="fixed_discount">Réduction fixe</option><option value="free_delivery">Livraison offerte</option><option value="percentage_discount">Réduction %</option><option value="gift">Cadeau</option><option value="custom">Autre</option></select></label><label className="text-[10px] font-semibold text-slate-500">Coût en points<input className={`${input} mt-1`} type="number" name="pointsCost" min={1} defaultValue={reward?.pointsCost || 50} required /></label><label className="text-[10px] font-semibold text-slate-500">Valeur MAD<input className={`${input} mt-1`} type="number" step="0.01" name="monetaryValue" defaultValue={reward?.monetaryValue ?? ""} /></label><label className="text-[10px] font-semibold text-slate-500">Pourcentage<input className={`${input} mt-1`} type="number" name="percentageValue" defaultValue={reward?.percentageValue ?? ""} min={1} max={100} /></label><label className="text-[10px] font-semibold text-slate-500 sm:col-span-2">Description<input className={`${input} mt-1`} name="description" defaultValue={reward?.description || ""} /></label><label className="flex items-center gap-2 text-xs"><input type="checkbox" name="isActive" defaultChecked={reward?.isActive ?? true} /> Activée</label></div>{state.error ? <p className="mt-3 text-xs text-rose-600">{state.error}</p> : null}{state.success ? <p className="mt-3 text-xs text-emerald-600">{state.message}</p> : null}<div className="mt-4 flex gap-2"><Button disabled={pending} size="sm" className="rounded-xl bg-[#162e6e] text-white">{pending ? "Enregistrement…" : "Enregistrer"}</Button>{reward ? <Button type="button" size="sm" variant="outline" className="rounded-xl" onClick={() => setOpen(false)}>Annuler</Button> : null}</div></form>;
}

export function AddRewardButton() {
  const [open, setOpen] = useState(false);
  return <div>{open ? <RewardEditor /> : <button onClick={() => setOpen(true)} className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-xs font-semibold text-[#162e6e]"><Plus className="h-4 w-4" /> Ajouter une récompense</button>}</div>;
}
