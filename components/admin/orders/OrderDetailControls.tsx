"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Mail, MessageCircle, Phone, RefreshCw } from "lucide-react";
import { useActionState, useState, useTransition } from "react";

import {
  addOrderNoteState,
  createOrderReturnState,
  performOrderActionState,
  recordOrderContactState,
  updateOrderAddressState,
  type OrderMutationState,
} from "@/app/admin/orders/actions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  canRolePerformOrderAction,
  nextActionLabels,
  type OrderAction,
  type OrderNextAction,
  type OrderOperatorRole,
} from "@/lib/orders/domain";
import { cn } from "@/lib/utils";

const initialState: OrderMutationState = { success: false, message: "", revision: 0 };

const actionableNextActions = new Set<OrderNextAction>([
  "RESOLVE_DELIVERY_INCIDENT",
  "CONFIRM_ORDER",
  "VERIFY_PAYMENT",
  "START_PREPARATION",
  "MARK_READY",
  "SHIP_ORDER",
  "ADD_TRACKING",
  "PROCESS_RETURN",
]);

const actionLabel = (action: OrderAction) => {
  if (action in nextActionLabels) {
    return nextActionLabels[action as keyof typeof nextActionLabels].button;
  }
  if (action === "MARK_DELIVERED") return "Marquer livrée";
  if (action === "CANCEL_ORDER") return "Annuler la commande";
  return "Confirmer";
};

function MutationFeedback({ state }: { state: OrderMutationState }) {
  if (!state.message) return null;
  return (
    <p role={state.success ? "status" : "alert"} className={cn("rounded-xl px-3 py-2 text-xs", state.success ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700")}>
      {state.message}
    </p>
  );
}

function ActionFields({
  action,
  carrier,
  trackingNumber,
}: {
  action: OrderAction;
  carrier?: string | null;
  trackingNumber?: string | null;
}) {
  const needsReason = ["VERIFY_PAYMENT", "RESOLVE_DELIVERY_INCIDENT", "PROCESS_RETURN", "CANCEL_ORDER"].includes(action);

  return (
    <>
      {action === "SHIP_ORDER" || action === "ADD_TRACKING" ? (
        <label className="block text-sm font-semibold text-slate-800">
          Transporteur {action === "SHIP_ORDER" ? "*" : ""}
          <Input name="carrier" required={action === "SHIP_ORDER"} defaultValue={carrier || ""} className="mt-2 h-11 rounded-2xl" placeholder="Amana Express" />
        </label>
      ) : null}
      {action === "SHIP_ORDER" || action === "ADD_TRACKING" ? (
        <label className="block text-sm font-semibold text-slate-800">
          Numéro de suivi {action === "ADD_TRACKING" ? "*" : ""}
          <Input name="trackingNumber" required={action === "ADD_TRACKING"} defaultValue={trackingNumber || ""} className="mt-2 h-11 rounded-2xl" placeholder="Référence transporteur" />
        </label>
      ) : null}
      {action === "SHIP_ORDER" ? (
        <label className="block text-sm font-semibold text-slate-800">
          Livraison estimée
          <Input name="estimatedDeliveryAt" type="date" className="mt-2 h-11 rounded-2xl" />
        </label>
      ) : null}
      {needsReason ? (
        <label className="block text-sm font-semibold text-slate-800">
          Motif *
          <textarea name="reason" required minLength={3} maxLength={500} className="mt-2 min-h-24 w-full rounded-2xl border border-slate-200 p-3 text-sm outline-none focus:border-shop_btn_dark_green" />
        </label>
      ) : null}
    </>
  );
}

export function OrderPrimaryAction({
  orderId,
  version,
  nextAction,
  operatorRole,
  carrier,
  trackingNumber,
}: {
  orderId: string;
  version: number;
  nextAction: OrderNextAction;
  operatorRole: OrderOperatorRole;
  carrier: string | null;
  trackingNumber: string | null;
}) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(
    async (previous: OrderMutationState, formData: FormData) => {
      const result = await performOrderActionState(previous, formData);
      if (result.success) router.refresh();
      return result;
    },
    initialState
  );

  if (nextAction === "NONE") {
    return (
      <section className="rounded-[26px] border border-emerald-200 bg-emerald-50/80 p-5">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">Prochaine action</p>
        <h2 className="mt-2 text-xl font-semibold text-emerald-950">Aucune action opérationnelle</h2>
        <p className="mt-2 text-sm text-emerald-800">La commande ne nécessite pas d&apos;intervention immédiate.</p>
      </section>
    );
  }

  if (!actionableNextActions.has(nextAction)) {
    return (
      <section className="rounded-[26px] border border-rose-200 bg-rose-50/80 p-5">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-rose-700">Prochaine action</p>
        <h2 className="mt-2 text-xl font-semibold text-rose-950">{nextActionLabels[nextAction].title}</h2>
        <Button asChild className="mt-4 rounded-xl bg-shop_btn_dark_green text-white"><Link href="#client">{nextActionLabels[nextAction].button}</Link></Button>
      </section>
    );
  }

  const action = nextAction as OrderAction;
  if (!canRolePerformOrderAction(operatorRole, action)) {
    return (
      <section className="rounded-[26px] border border-amber-200 bg-amber-50/80 p-5">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-700">Prochaine action</p>
        <h2 className="mt-2 text-xl font-semibold text-amber-950">{nextActionLabels[nextAction].title}</h2>
        <p className="mt-2 text-sm text-amber-800">Cette action sensible doit être effectuée par un manager.</p>
      </section>
    );
  }
  return (
    <section className="rounded-[26px] border border-blue-200 bg-[linear-gradient(135deg,#eff6ff,#ffffff)] p-5 shadow-[0_22px_55px_-45px_rgba(37,99,235,0.65)]">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-700">Prochaine action</p>
      <h2 className="mt-2 text-xl font-semibold text-slate-950">{nextActionLabels[nextAction].title}</h2>
      <form action={formAction} className="mt-4 space-y-4">
        <input type="hidden" name="orderId" value={orderId} />
        <input type="hidden" name="expectedVersion" value={version} />
        <input type="hidden" name="action" value={action} />
        <ActionFields action={action} carrier={carrier} trackingNumber={trackingNumber} />
        <MutationFeedback state={state} />
        <Button disabled={pending} type="submit" className="h-11 rounded-xl bg-shop_btn_dark_green px-6 text-white hover:bg-shop_dark_green">
          {pending ? "Traitement…" : nextActionLabels[nextAction].button}
        </Button>
      </form>
    </section>
  );
}

export function OrderSecondaryActions({
  orderId,
  version,
  canMarkDelivered,
  canCancel,
}: {
  orderId: string;
  version: number;
  canMarkDelivered: boolean;
  canCancel: boolean;
}) {
  const [action, setAction] = useState<OrderAction | null>(null);
  const router = useRouter();
  const [state, formAction, pending] = useActionState(
    async (previous: OrderMutationState, formData: FormData) => {
      const result = await performOrderActionState(previous, formData);
      if (result.success) {
        setAction(null);
        router.refresh();
      }
      return result;
    },
    initialState
  );

  return (
    <>
      <div className="flex flex-wrap gap-2">
        {canMarkDelivered ? <Button type="button" variant="outline" className="rounded-xl" onClick={() => setAction("MARK_DELIVERED")}>Marquer livrée</Button> : null}
        {canCancel ? <Button type="button" variant="outline" className="rounded-xl border-rose-200 text-rose-600 hover:bg-rose-50" onClick={() => setAction("CANCEL_ORDER")}>Annuler</Button> : null}
      </div>
      <Dialog open={Boolean(action)} onOpenChange={(open) => !open && setAction(null)}>
        <DialogContent className="rounded-[26px] sm:max-w-md">
          <DialogHeader><DialogTitle>{action ? actionLabel(action) : "Action"}</DialogTitle><DialogDescription>Cette opération sera validée et historisée.</DialogDescription></DialogHeader>
          {action ? <form action={formAction} className="space-y-4"><input type="hidden" name="orderId" value={orderId} /><input type="hidden" name="expectedVersion" value={version} /><input type="hidden" name="action" value={action} /><ActionFields action={action} /><MutationFeedback state={state} /><DialogFooter><DialogClose asChild><Button type="button" variant="outline">Fermer</Button></DialogClose><Button disabled={pending} type="submit" className={cn("text-white", action === "CANCEL_ORDER" ? "bg-rose-600" : "bg-shop_btn_dark_green")}>{pending ? "Traitement…" : actionLabel(action)}</Button></DialogFooter></form> : null}
        </DialogContent>
      </Dialog>
    </>
  );
}

export function OrderNoteForm({ orderId }: { orderId: string }) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(
    async (previous: OrderMutationState, formData: FormData) => {
      const result = await addOrderNoteState(previous, formData);
      if (result.success) router.refresh();
      return result;
    },
    initialState
  );
  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="orderId" value={orderId} />
      <textarea name="content" required minLength={2} maxLength={2000} placeholder="Ajouter une note interne…" className="min-h-24 w-full rounded-2xl border border-slate-200 p-3 text-sm outline-none focus:border-shop_btn_dark_green" />
      <MutationFeedback state={state} />
      <Button disabled={pending} type="submit" size="sm" className="rounded-xl bg-shop_btn_dark_green text-white">{pending ? "Ajout…" : "Ajouter la note"}</Button>
    </form>
  );
}

export function OrderAddressForm({
  order,
}: {
  order: { id: string; name: string; phone: string; address: string; city: string; state: string; zip: string; shipped: boolean };
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(
    async (previous: OrderMutationState, formData: FormData) => {
      const result = await updateOrderAddressState(previous, formData);
      if (result.success) {
        setOpen(false);
        router.refresh();
      }
      return result;
    },
    initialState
  );
  return (
    <>
      <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(true)} className="rounded-xl text-blue-700">Modifier</Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="rounded-[26px] sm:max-w-lg"><DialogHeader><DialogTitle>Modifier la livraison</DialogTitle><DialogDescription>Les anciennes et nouvelles valeurs seront conservées dans la timeline.</DialogDescription></DialogHeader><form action={formAction} className="grid gap-3 sm:grid-cols-2"><input type="hidden" name="orderId" value={order.id} /><label className="text-xs font-semibold">Nom<Input name="name" required defaultValue={order.name} className="mt-1 rounded-xl" /></label><label className="text-xs font-semibold">Téléphone<Input name="phone" required defaultValue={order.phone} className="mt-1 rounded-xl" /></label><label className="text-xs font-semibold sm:col-span-2">Adresse<Input name="address" required defaultValue={order.address} className="mt-1 rounded-xl" /></label><label className="text-xs font-semibold">Ville<Input name="city" required defaultValue={order.city} className="mt-1 rounded-xl" /></label><label className="text-xs font-semibold">Région<Input name="state" defaultValue={order.state} className="mt-1 rounded-xl" /></label><label className="text-xs font-semibold">Code postal<Input name="zip" defaultValue={order.zip} className="mt-1 rounded-xl" /></label>{order.shipped ? <label className="text-xs font-semibold sm:col-span-2">Motif après expédition *<textarea name="reason" required minLength={3} className="mt-1 min-h-20 w-full rounded-xl border border-slate-200 p-3" /></label> : null}<div className="sm:col-span-2"><MutationFeedback state={state} /></div><DialogFooter className="sm:col-span-2"><DialogClose asChild><Button type="button" variant="outline">Annuler</Button></DialogClose><Button disabled={pending} type="submit" className="bg-shop_btn_dark_green text-white">{pending ? "Enregistrement…" : "Enregistrer"}</Button></DialogFooter></form></DialogContent>
      </Dialog>
    </>
  );
}

export function OrderContactButtons({ orderId, phone, email }: { orderId: string; phone: string | null; email: string }) {
  const [pending, startTransition] = useTransition();
  const contact = (channel: "phone" | "whatsapp" | "email", href: string) => {
    const formData = new FormData();
    formData.set("orderId", orderId);
    formData.set("channel", channel);
    startTransition(async () => {
      await recordOrderContactState(initialState, formData);
      window.location.href = href;
    });
  };
  const compactPhone = (phone || "").replace(/[^+\d]/g, "");
  return (
    <div className="flex flex-wrap gap-2">
      <Button disabled={pending || !phone} type="button" variant="outline" size="sm" className="rounded-xl" onClick={() => contact("phone", `tel:${compactPhone}`)}><Phone className="h-4 w-4" />Appeler</Button>
      <Button disabled={pending || !phone} type="button" variant="outline" size="sm" className="rounded-xl" onClick={() => contact("whatsapp", `https://wa.me/${compactPhone.replace(/^\+/, "")}`)}><MessageCircle className="h-4 w-4" />WhatsApp</Button>
      <Button disabled={pending || !email} type="button" variant="outline" size="sm" className="rounded-xl" onClick={() => contact("email", `mailto:${encodeURIComponent(email)}`)}><Mail className="h-4 w-4" />Email</Button>
    </div>
  );
}

export function OrderReturnForm({ orderId }: { orderId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(
    async (previous: OrderMutationState, formData: FormData) => {
      const result = await createOrderReturnState(previous, formData);
      if (result.success) {
        setOpen(false);
        router.refresh();
      }
      return result;
    },
    initialState
  );
  return (
    <>
      <Button type="button" variant="outline" size="sm" className="rounded-xl" onClick={() => setOpen(true)}><RefreshCw className="h-4 w-4" />Ouvrir un retour</Button>
      <Dialog open={open} onOpenChange={setOpen}><DialogContent className="rounded-[26px] sm:max-w-md"><DialogHeader><DialogTitle>Ouvrir un retour</DialogTitle><DialogDescription>Le retour et le remboursement restent deux opérations distinctes.</DialogDescription></DialogHeader><form action={formAction} className="space-y-4"><input type="hidden" name="orderId" value={orderId} /><label className="block text-sm font-semibold">Motif *<textarea name="reason" required minLength={3} maxLength={1000} className="mt-2 min-h-28 w-full rounded-2xl border border-slate-200 p-3" /></label><MutationFeedback state={state} /><DialogFooter><DialogClose asChild><Button type="button" variant="outline">Annuler</Button></DialogClose><Button disabled={pending} type="submit" className="bg-shop_btn_dark_green text-white">{pending ? "Ouverture…" : "Ouvrir le retour"}</Button></DialogFooter></form></DialogContent></Dialog>
    </>
  );
}
