"use client";

import { useActionState, useState } from "react";
import { Mail, MessageSquareText, PauseCircle, PlayCircle, Shield, SlidersHorizontal } from "lucide-react";

import {
  addCustomerNoteAction,
  adjustPointsAction,
  requestCustomerPrivacyAction,
  toggleLoyaltySuspensionAction,
  type CustomerActionState,
} from "@/app/admin/clients/actions";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const initial: CustomerActionState = { success: false };
const field = "h-10 w-full rounded-xl border border-slate-200 px-3 text-xs outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-50";

function Feedback({ state }: { state: CustomerActionState }) {
  return state.error ? <p className="text-xs text-rose-600">{state.error}</p> : state.success ? <p className="text-xs text-emerald-600">{state.message}</p> : null;
}

export default function CustomerProfileActions({ user }: { user: { id: string; fullName: string; email: string; suspended: boolean } }) {
  const [dialog, setDialog] = useState<"points" | "note" | "suspend" | "privacy" | null>(null);
  const [pointState, pointAction, pointPending] = useActionState(adjustPointsAction, initial);
  const [noteState, noteAction, notePending] = useActionState(addCustomerNoteAction, initial);
  const [suspendState, suspendAction, suspendPending] = useActionState(toggleLoyaltySuspensionAction, initial);
  const [privacyState, privacyAction, privacyPending] = useActionState(requestCustomerPrivacyAction, initial);
  const actions = [
    { key: "points" as const, title: "Ajuster les points", subtitle: "Ajouter ou retirer avec motif", icon: SlidersHorizontal, tone: "bg-cyan-50 text-cyan-600" },
    { key: "email" as const, title: "Envoyer un email", subtitle: "Contacter ce client", icon: Mail, tone: "bg-violet-50 text-violet-600" },
    { key: "note" as const, title: "Ajouter une note", subtitle: "Visible uniquement par les admins", icon: MessageSquareText, tone: "bg-amber-50 text-amber-600" },
    { key: "suspend" as const, title: user.suspended ? "Réactiver la fidélité" : "Suspendre le programme", subtitle: user.suspended ? "Autoriser de nouveaux mouvements" : "Désactiver temporairement", icon: user.suspended ? PlayCircle : PauseCircle, tone: user.suspended ? "bg-emerald-50 text-emerald-600" : "bg-rose-50 text-rose-600" },
    { key: "privacy" as const, title: "Confidentialité & données", subtitle: "Export ou demande d’anonymisation", icon: Shield, tone: "bg-slate-100 text-slate-600" },
  ];

  return <><section className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-[0_16px_50px_-42px_rgba(15,23,42,0.4)]"><h2 className="px-1 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">Actions rapides</h2><div className="mt-2 divide-y divide-slate-100">{actions.map(({ key, title, subtitle, icon: Icon, tone }) => key === "email" ? <a key={key} href={`mailto:${encodeURIComponent(user.email)}`} className="flex items-center gap-3 py-3"><span className={`flex h-9 w-9 items-center justify-center rounded-xl ${tone}`}><Icon className="h-4 w-4" /></span><span className="flex-1"><strong className="block text-xs text-slate-800">{title}</strong><small className="text-[10px] text-slate-400">{subtitle}</small></span><span className="text-slate-300">›</span></a> : <button key={key} type="button" onClick={() => setDialog(key)} className="flex w-full items-center gap-3 py-3 text-left"><span className={`flex h-9 w-9 items-center justify-center rounded-xl ${tone}`}><Icon className="h-4 w-4" /></span><span className="flex-1"><strong className="block text-xs text-slate-800">{title}</strong><small className="text-[10px] text-slate-400">{subtitle}</small></span><span className="text-slate-300">›</span></button>)}</div><p className="mt-3 rounded-xl bg-slate-50 p-3 text-[10px] leading-4 text-slate-500">Les modifications de points, suspensions et demandes de données sont tracées avec l’auteur et la date.</p></section>

    <Dialog open={dialog === "points"} onOpenChange={(open) => !open && setDialog(null)}><DialogContent className="rounded-[26px] sm:max-w-md"><DialogHeader><DialogTitle>Ajuster les points</DialogTitle><DialogDescription>Un mouvement signé sera ajouté au grand livre. Le solde n’est jamais modifié silencieusement.</DialogDescription></DialogHeader><form action={pointAction} className="space-y-3"><input type="hidden" name="userId" value={user.id} /><div className="grid grid-cols-2 gap-3"><label className="text-xs font-semibold">Opération<select name="direction" className={`${field} mt-1`}><option value="add">Ajouter</option><option value="remove">Retirer</option></select></label><label className="text-xs font-semibold">Montant<input name="amount" type="number" min={1} className={`${field} mt-1`} required /></label></div><label className="block text-xs font-semibold">Motif<textarea name="reason" minLength={3} maxLength={500} required className="mt-1 min-h-24 w-full rounded-xl border border-slate-200 p-3 text-xs" /></label><Feedback state={pointState} /><Button disabled={pointPending} className="w-full rounded-xl bg-[#162e6e] text-white">{pointPending ? "Enregistrement…" : "Enregistrer le mouvement"}</Button></form></DialogContent></Dialog>

    <Dialog open={dialog === "note"} onOpenChange={(open) => !open && setDialog(null)}><DialogContent className="rounded-[26px] sm:max-w-md"><DialogHeader><DialogTitle>Ajouter une note interne</DialogTitle><DialogDescription>Cette note sera horodatée et visible uniquement dans l’espace admin.</DialogDescription></DialogHeader><form action={noteAction} className="space-y-3"><input type="hidden" name="userId" value={user.id} /><textarea name="content" minLength={3} maxLength={2000} required placeholder="Votre note…" className="min-h-32 w-full rounded-xl border border-slate-200 p-3 text-xs" /><Feedback state={noteState} /><Button disabled={notePending} className="w-full rounded-xl bg-[#162e6e] text-white">{notePending ? "Ajout…" : "Ajouter la note"}</Button></form></DialogContent></Dialog>

    <Dialog open={dialog === "suspend"} onOpenChange={(open) => !open && setDialog(null)}><DialogContent className="rounded-[26px] sm:max-w-md"><DialogHeader><DialogTitle>{user.suspended ? "Réactiver" : "Suspendre"} le programme</DialogTitle><DialogDescription>{user.suspended ? "Les futurs gains et échanges seront de nouveau autorisés." : "Les commandes restent intactes, mais aucun nouveau gain ou échange ne sera autorisé."}</DialogDescription></DialogHeader><form action={suspendAction} className="space-y-3"><input type="hidden" name="userId" value={user.id} /><input type="hidden" name="suspend" value={user.suspended ? "false" : "true"} />{!user.suspended ? <textarea name="reason" minLength={3} required placeholder="Motif obligatoire…" className="min-h-24 w-full rounded-xl border border-slate-200 p-3 text-xs" /> : null}<Feedback state={suspendState} /><Button disabled={suspendPending} className="w-full rounded-xl bg-[#162e6e] text-white">{suspendPending ? "Traitement…" : user.suspended ? "Réactiver" : "Suspendre"}</Button></form></DialogContent></Dialog>

    <Dialog open={dialog === "privacy"} onOpenChange={(open) => !open && setDialog(null)}><DialogContent className="rounded-[26px] sm:max-w-md"><DialogHeader><DialogTitle>Contrôle des données personnelles</DialogTitle><DialogDescription>La demande entre dans un workflow de revue. Aucune donnée financière ni commande n’est supprimée automatiquement.</DialogDescription></DialogHeader><form action={privacyAction} className="space-y-3"><input type="hidden" name="userId" value={user.id} /><label className="block text-xs font-semibold">Demande<select name="type" className={`${field} mt-1`}><option value="export">Exporter les données du profil</option><option value="anonymize">Demander l’anonymisation</option><option value="delete">Demander la suppression</option></select></label><textarea name="reason" placeholder="Contexte ou motif…" className="min-h-24 w-full rounded-xl border border-slate-200 p-3 text-xs" /><Feedback state={privacyState} /><Button disabled={privacyPending} className="w-full rounded-xl bg-[#162e6e] text-white">{privacyPending ? "Enregistrement…" : "Enregistrer la demande"}</Button></form></DialogContent></Dialog>
  </>;
}
