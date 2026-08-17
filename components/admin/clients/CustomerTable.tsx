"use client";

import { useActionState, useMemo, useState } from "react";
import Link from "next/link";
import { Mail, Tag, UserRound } from "lucide-react";

import { assignCustomerTagsAction, type CustomerActionState } from "@/app/admin/clients/actions";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export type CustomerTableRow = {
  id: string;
  fullName: string;
  email: string;
  phone: string | null;
  loyaltyCardNumber: string;
  loyaltyPoints: number;
  loyaltyTier: "bronze" | "silver" | "gold";
  activitySegment: string;
  loyaltySuspended: boolean;
  validOrderCount: number;
  paidDeliveredRevenue: number;
  lastValidOrderAt: string | null;
  lastOrderNumber: string | null;
  expiringPoints: number;
  pointsExpireAt: string | null;
  tags: Array<{ id: string; name: string; color: string }>;
};

const initialState: CustomerActionState = { success: false };
const money = new Intl.NumberFormat("fr-MA", { style: "currency", currency: "MAD" });
const date = new Intl.DateTimeFormat("fr-MA", { day: "2-digit", month: "short", year: "numeric" });
const tierLabel = { bronze: "Bronze", silver: "Argent", gold: "Gold" } as const;

export default function CustomerTable({ rows }: { rows: CustomerTableRow[] }) {
  const [selected, setSelected] = useState<string[]>([]);
  const [tagOpen, setTagOpen] = useState(false);
  const [state, formAction, pending] = useActionState(assignCustomerTagsAction, initialState);
  const selectedRows = useMemo(() => rows.filter((row) => selected.includes(row.id)), [rows, selected]);
  const allSelected = rows.length > 0 && selected.length === rows.length;

  const toggleAll = (checked: boolean) => setSelected(checked ? rows.map((row) => row.id) : []);
  const toggle = (id: string, checked: boolean) =>
    setSelected((current) => checked ? [...new Set([...current, id])] : current.filter((item) => item !== id));
  const sendEmail = () => {
    const recipients = selectedRows.map((row) => row.email).join(",");
    if (recipients) window.location.href = `mailto:?bcc=${encodeURIComponent(recipients)}`;
  };

  return (
    <>
      {selected.length > 0 ? (
        <div className="flex flex-wrap items-center gap-2 border-b border-blue-100 bg-blue-50/70 px-4 py-3">
          <span className="mr-auto text-xs font-semibold text-blue-900">{selected.length} client(s) sélectionné(s)</span>
          <Button type="button" size="sm" variant="outline" className="rounded-xl bg-white" onClick={sendEmail}>
            <Mail className="h-4 w-4" /> Envoyer un email
          </Button>
          <Button type="button" size="sm" variant="outline" className="rounded-xl bg-white" onClick={() => setTagOpen(true)}>
            <Tag className="h-4 w-4" /> Attribuer un tag
          </Button>
        </div>
      ) : null}

      <div className="hidden overflow-x-auto lg:block">
        <table className="w-full min-w-[1050px] text-left text-xs">
          <thead className="border-b border-slate-200 bg-slate-50/70 text-[10px] uppercase tracking-[0.08em] text-slate-400">
            <tr>
              <th className="w-12 px-4 py-3"><Checkbox checked={allSelected} onCheckedChange={(value) => toggleAll(value === true)} aria-label="Sélectionner tous les clients" /></th>
              <th className="py-3">Client</th><th>Statut</th><th>Points disponibles</th><th>Dépenses qualifiantes<br />12 mois</th><th>Commandes</th><th>Dernière commande</th><th>Alerte</th><th className="pr-4">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((customer, index) => (
              <tr key={customer.id} className="hover:bg-slate-50/60">
                <td className="px-4 py-3"><Checkbox checked={selected.includes(customer.id)} onCheckedChange={(value) => toggle(customer.id, value === true)} aria-label={`Sélectionner ${customer.fullName}`} /></td>
                <td className="py-3 pr-4">
                  <div className="flex items-center gap-3">
                    <span className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-white", index % 4 === 0 ? "bg-blue-500" : index % 4 === 1 ? "bg-emerald-500" : index % 4 === 2 ? "bg-violet-500" : "bg-orange-500")}>
                      {customer.fullName.split(" ").map((part) => part[0]).slice(0, 2).join("").toUpperCase()}
                    </span>
                    <div className="min-w-0"><p className="font-semibold text-slate-900">{customer.fullName}</p><p className="max-w-52 truncate text-[10px] text-slate-400">{customer.email}</p><p className="font-mono text-[9px] text-slate-400">Carte : {customer.loyaltyCardNumber}</p></div>
                  </div>
                </td>
                <td><span className={cn("rounded-full px-2.5 py-1 text-[10px] font-semibold ring-1 ring-inset", customer.loyaltyTier === "gold" ? "bg-amber-50 text-amber-700 ring-amber-200" : customer.loyaltyTier === "silver" ? "bg-slate-100 text-slate-600 ring-slate-200" : "bg-orange-50 text-orange-700 ring-orange-200")}>{tierLabel[customer.loyaltyTier]}</span>{customer.loyaltySuspended ? <span className="mt-1 block text-[9px] font-semibold text-rose-600">Suspendu</span> : null}</td>
                <td className="font-bold text-slate-900">{customer.loyaltyPoints.toLocaleString("fr-MA")} pts</td>
                <td className="font-semibold text-slate-900">{money.format(customer.paidDeliveredRevenue)}</td>
                <td className="font-semibold text-slate-900">{customer.validOrderCount}</td>
                <td>{customer.lastValidOrderAt ? <><p className="font-semibold text-slate-800">{date.format(new Date(customer.lastValidOrderAt))}</p><p className="text-[9px] text-slate-400">#{customer.lastOrderNumber?.slice(-8).toUpperCase()}</p></> : <span className="text-slate-400">—<small className="block">Aucune commande</small></span>}</td>
                <td>{customer.expiringPoints > 0 ? <span className="inline-flex rounded-xl bg-orange-50 px-2.5 py-1.5 text-[10px] font-semibold text-orange-700 ring-1 ring-orange-100">{customer.expiringPoints} pts expirent bientôt</span> : customer.activitySegment === "INACTIVE" || customer.activitySegment === "TO_REENGAGE" ? <span className="inline-flex rounded-xl bg-slate-100 px-2.5 py-1.5 text-[10px] font-semibold text-slate-600">Client à relancer</span> : <span className="inline-flex rounded-xl bg-emerald-50 px-2.5 py-1.5 text-[10px] font-semibold text-emerald-700">À jour</span>}</td>
                <td className="pr-4"><Link href={`/admin/clients/${customer.id}`} className="inline-flex rounded-xl border border-blue-100 bg-white px-3 py-1.5 text-[10px] font-semibold text-blue-600 hover:bg-blue-50">Voir le profil</Link></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="divide-y divide-slate-100 lg:hidden">
        {rows.map((customer) => (
          <article key={customer.id} className="p-4">
            <div className="flex items-start gap-3"><Checkbox checked={selected.includes(customer.id)} onCheckedChange={(value) => toggle(customer.id, value === true)} aria-label={`Sélectionner ${customer.fullName}`} /><span className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-500 text-xs font-bold text-white"><UserRound className="h-4 w-4" /></span><div className="min-w-0 flex-1"><p className="font-semibold text-slate-900">{customer.fullName}</p><p className="truncate text-xs text-slate-400">{customer.email}</p></div><span className="rounded-full bg-amber-50 px-2 py-1 text-[10px] font-semibold text-amber-700">{tierLabel[customer.loyaltyTier]}</span></div>
            <div className="mt-4 grid grid-cols-3 gap-2 rounded-2xl bg-slate-50 p-3 text-center"><div><strong className="block text-xs">{customer.loyaltyPoints} pts</strong><span className="text-[9px] text-slate-400">Points</span></div><div><strong className="block text-xs">{money.format(customer.paidDeliveredRevenue)}</strong><span className="text-[9px] text-slate-400">CA 12 mois</span></div><div><strong className="block text-xs">{customer.validOrderCount}</strong><span className="text-[9px] text-slate-400">Commandes</span></div></div>
            <Link href={`/admin/clients/${customer.id}`} className="mt-3 flex h-9 items-center justify-center rounded-xl border border-blue-100 text-xs font-semibold text-blue-600">Voir le profil</Link>
          </article>
        ))}
      </div>

      <Dialog open={tagOpen} onOpenChange={setTagOpen}>
        <DialogContent className="rounded-[26px] sm:max-w-md">
          <DialogHeader><DialogTitle>Attribuer un tag</DialogTitle><DialogDescription>Le tag sera ajouté aux {selected.length} profils sélectionnés.</DialogDescription></DialogHeader>
          <form action={formAction} className="space-y-4">
            <input type="hidden" name="userIds" value={selected.join(",")} />
            <Input name="tagName" placeholder="Ex. VIP beauté" required minLength={2} maxLength={40} />
            {state.error ? <p className="text-xs text-rose-600">{state.error}</p> : null}
            {state.success ? <p className="text-xs text-emerald-600">{state.message}</p> : null}
            <Button disabled={pending} className="w-full rounded-xl bg-[#162e6e] text-white">{pending ? "Attribution…" : "Attribuer le tag"}</Button>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
