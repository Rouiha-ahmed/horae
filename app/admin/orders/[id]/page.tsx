import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  CalendarClock,
  CheckCircle2,
  CreditCard,
  MapPin,
  Package2,
  ReceiptText,
  Truck,
  UserRound,
} from "lucide-react";

import {
  OrderAddressForm,
  OrderContactButtons,
  OrderNoteForm,
  OrderPrimaryAction,
  OrderReturnForm,
  OrderSecondaryActions,
} from "@/components/admin/orders/OrderDetailControls";
import { getAdminOrderDetail } from "@/lib/orders/admin-data";
import { resolveImageUrl } from "@/lib/image";
import { cn } from "@/lib/utils";

const currency = new Intl.NumberFormat("fr-MA", { style: "currency", currency: "MAD", maximumFractionDigits: 2 });
const dateTime = new Intl.DateTimeFormat("fr-MA", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
const orderReference = (value: string) => `#${value.slice(-8).toUpperCase()}`;

const labels: Record<string, string> = {
  to_prepare: "À préparer",
  preparing: "En préparation",
  ready: "Prête",
  shipped: "Expédiée",
  cancelled: "Annulée",
  pending: "En attente",
  partial: "Partiel",
  paid: "Payé",
  failed: "Échoué",
  refunded: "Remboursé",
  not_assigned: "Non expédiée",
  in_transit: "En transit",
  out_for_delivery: "En livraison",
  delivered: "Livrée",
  delayed: "Retard",
  returned: "Retournée",
  cod: "Paiement à la livraison (COD)",
  cmi_card: "Carte bancaire",
  installments: "Paiement en plusieurs fois",
  requested: "Demandé",
  approved: "Approuvé",
  received: "Reçu",
  inspected: "Inspecté",
  closed: "Clôturé",
  rejected: "Refusé",
};

const toneFor = (value: string) => {
  if (["paid", "delivered", "closed"].includes(value)) return "bg-emerald-50 text-emerald-700 ring-emerald-200";
  if (["to_prepare", "preparing", "pending", "partial", "ready", "delayed", "requested"].includes(value)) return "bg-amber-50 text-amber-700 ring-amber-200";
  if (["shipped", "in_transit", "out_for_delivery", "approved", "received", "inspected"].includes(value)) return "bg-blue-50 text-blue-700 ring-blue-200";
  if (["cancelled", "failed", "returned", "refunded", "rejected"].includes(value)) return "bg-rose-50 text-rose-700 ring-rose-200";
  return "bg-slate-100 text-slate-600 ring-slate-200";
};

function StatusBadge({ value }: { value: string }) {
  return <span className={cn("inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset", toneFor(value))}>{labels[value] || value}</span>;
}

function Surface({ title, icon: Icon, action, children, id }: { title: string; icon: typeof UserRound; action?: ReactNode; children: ReactNode; id?: string }) {
  return (
    <section id={id} className="rounded-[26px] border border-white/80 bg-white/95 p-5 shadow-[0_24px_70px_-56px_rgba(15,23,42,0.42)]">
      <div className="flex items-center justify-between gap-3"><div className="flex items-center gap-2"><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 text-shop_btn_dark_green"><Icon className="h-4 w-4" /></span><h2 className="font-semibold text-slate-950">{title}</h2></div>{action}</div>
      <div className="mt-4">{children}</div>
    </section>
  );
}

const formatDuration = (milliseconds: number | null) => {
  if (milliseconds === null) return "En cours";
  const hours = Math.max(0, Math.round(milliseconds / 3_600_000));
  return hours < 24 ? `${hours} h` : `${Math.floor(hours / 24)} j ${hours % 24} h`;
};

const metadataRecord = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;

export default async function AdminOrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const order = await getAdminOrderDetail(id);
  if (!order) notFound();

  const canMarkDelivered = order.fulfillmentStatus === "shipped" && ["in_transit", "out_for_delivery", "delayed"].includes(order.deliveryStatus);
  const canCancel = order.operatorRole !== "ORDER_AGENT" && order.status !== "cancelled" && order.deliveryStatus !== "delivered";
  const subtotal = order.items.reduce((sum, item) => sum + item.productPriceSnapshot * item.quantity, 0);

  return (
    <div className="space-y-6">
      <Link href="/admin/orders" className="inline-flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-shop_btn_dark_green"><ArrowLeft className="h-4 w-4" />Retour aux commandes</Link>

      <header className="flex flex-col gap-5 rounded-[28px] border border-white/80 bg-white/95 p-6 shadow-[0_26px_80px_-56px_rgba(15,23,42,0.42)] lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-3"><h1 className="text-3xl font-semibold tracking-tight text-slate-950">Commande {orderReference(order.orderNumber)}</h1>{order.operational.attentionLevel === "CRITICAL" ? <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-3 py-1 text-xs font-semibold text-rose-700 ring-1 ring-rose-200"><AlertTriangle className="h-3.5 w-3.5" />Critique</span> : null}</div>
          <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-slate-500"><strong className="text-lg text-slate-950">{currency.format(order.totalPrice)}</strong><span>Créée le {dateTime.format(order.orderDate)}</span></div>
          <div className="mt-4 flex flex-wrap gap-2"><StatusBadge value={order.fulfillmentStatus} /><StatusBadge value={order.paymentStatus} /><StatusBadge value={order.deliveryStatus} />{order.paymentMethod === "cod" && order.paymentStatus !== "paid" ? <span className="rounded-full bg-violet-50 px-2.5 py-1 text-xs font-semibold text-violet-700 ring-1 ring-violet-200">COD non encaissé</span> : null}</div>
        </div>
        <OrderSecondaryActions orderId={order.id} version={order.version} canMarkDelivered={canMarkDelivered} canCancel={canCancel} />
      </header>

      <OrderPrimaryAction orderId={order.id} version={order.version} nextAction={order.operational.nextAction} operatorRole={order.operatorRole} carrier={order.deliveryCompany} trackingNumber={order.trackingNumber} />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.6fr)_minmax(320px,0.9fr)]">
        <div className="space-y-6">
          <Surface title={`Articles (${order.items.reduce((sum, item) => sum + item.quantity, 0)})`} icon={Package2}>
            <div className="divide-y divide-slate-100">
              {order.items.map((item) => (
                <div key={item.id} className="flex items-center gap-4 py-4 first:pt-0 last:pb-0">
                  <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-2xl border border-slate-200 bg-slate-50">{item.productImageUrlSnapshot ? <Image src={resolveImageUrl(item.productImageUrlSnapshot)} alt={item.productNameSnapshot} fill unoptimized sizes="4rem" className="object-contain p-2" /> : <span className="flex h-full items-center justify-center text-slate-300"><Package2 className="h-5 w-5" /></span>}</div>
                  <div className="min-w-0 flex-1"><p className="font-semibold text-slate-900">{item.productNameSnapshot}</p><p className="mt-1 text-xs text-slate-500">SKU {item.sku || "non disponible"} · Quantité {item.quantity}</p><p className="mt-1 text-xs text-slate-500">{currency.format(item.productPriceSnapshot)} / unité</p></div>
                  <strong className="text-sm text-slate-900">{currency.format(item.productPriceSnapshot * item.quantity)}</strong>
                </div>
              ))}
            </div>
            <div className="mt-5 space-y-2 border-t border-slate-200 pt-4 text-sm"><div className="flex justify-between text-slate-600"><span>Sous-total articles</span><span>{currency.format(subtotal)}</span></div>{order.amountDiscount > 0 ? <div className="flex justify-between text-emerald-700"><span>Remise {order.promoCode ? `(${order.promoCode})` : ""}</span><span>- {currency.format(order.amountDiscount)}</span></div> : null}<div className="flex justify-between border-t border-slate-100 pt-3 text-base font-semibold text-slate-950"><span>Total commande</span><span>{currency.format(order.totalPrice)}</span></div></div>
          </Surface>

          <Surface title="Traitement et performance" icon={CalendarClock}>
            <div className="grid gap-3 sm:grid-cols-2"><div className="rounded-2xl bg-slate-50 p-4"><p className="text-xs text-slate-500">Commande reçue → préparée</p><p className="mt-2 font-semibold text-slate-900">{formatDuration(order.performance.preparationMs)}</p>{order.preparedAt ? <p className="mt-1 text-xs text-slate-500">Préparée le {dateTime.format(order.preparedAt)}</p> : null}</div><div className="rounded-2xl bg-slate-50 p-4"><p className="text-xs text-slate-500">Commande reçue → livrée</p><p className="mt-2 font-semibold text-slate-900">{formatDuration(order.performance.deliveryMs)}</p>{order.deliveredAt ? <p className="mt-1 text-xs text-slate-500">Livrée le {dateTime.format(order.deliveredAt)}</p> : null}</div></div>
            {order.operational.sla ? <div className={cn("mt-3 rounded-2xl px-4 py-3 text-sm", order.operational.sla.isOverdue ? "bg-rose-50 text-rose-800" : "bg-blue-50 text-blue-800")}><strong>{order.operational.sla.isOverdue ? "SLA dépassé" : "SLA en cours"}</strong> · échéance {dateTime.format(order.operational.sla.dueAt)}</div> : null}
          </Surface>

          <Surface title={`Anomalies (${order.operational.issues.length})`} icon={AlertTriangle}>
            {order.operational.issues.length ? <div className="space-y-3">{order.operational.issues.map((issue) => <div key={issue.code} className={cn("rounded-2xl border px-4 py-3", issue.severity === "critical" ? "border-rose-200 bg-rose-50" : "border-amber-200 bg-amber-50")}><div className="flex items-start justify-between gap-3"><div><p className={cn("text-sm font-semibold", issue.severity === "critical" ? "text-rose-800" : "text-amber-800")}>{issue.message}</p><p className="mt-1 text-xs text-slate-600">Action recommandée : {issue.recommendedAction.toLowerCase().replaceAll("_", " ")}</p></div><span className="text-[10px] font-semibold uppercase tracking-wide">{issue.severity}</span></div></div>)}</div> : <div className="rounded-2xl bg-emerald-50 px-4 py-4 text-sm text-emerald-800"><CheckCircle2 className="mr-2 inline h-4 w-4" />Aucune anomalie détectée.</div>}
          </Surface>

          <Surface title="Timeline opérationnelle" icon={ReceiptText}>
            {order.events.length ? <ol className="relative ml-2 border-l border-slate-200 pl-6">{order.events.map((event) => { const metadata = metadataRecord(event.metadata); const previous = metadataRecord(metadata?.previous); const next = metadataRecord(metadata?.next); return <li key={event.id} className="relative pb-6 last:pb-0"><span className="absolute -left-[1.83rem] top-1 h-3 w-3 rounded-full border-2 border-white bg-blue-500 ring-1 ring-blue-200" /><div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between"><div><p className="text-sm font-semibold text-slate-900">{event.title}</p>{event.description ? <p className="mt-1 text-xs leading-5 text-slate-500">{event.description}</p> : null}{event.type === "ADDRESS_UPDATED" && previous && next ? <div className="mt-2 rounded-xl bg-slate-50 p-3 text-xs text-slate-600"><p><strong>Avant :</strong> {String(previous.address || "—")}, {String(previous.city || "—")}</p><p className="mt-1"><strong>Après :</strong> {String(next.address || "—")}, {String(next.city || "—")}</p></div> : null}<p className="mt-1 text-[11px] text-slate-400">{event.actorName || "Système"}</p></div><time className="shrink-0 text-[11px] text-slate-400">{dateTime.format(event.createdAt)}</time></div></li>; })}</ol> : <p className="text-sm text-slate-500">Aucun événement enregistré.</p>}
          </Surface>

          <Surface title={`Retours (${order.returns.length})`} icon={ReceiptText} action={order.deliveryStatus === "delivered" && order.operatorRole !== "ORDER_AGENT" ? <OrderReturnForm orderId={order.id} /> : undefined}>
            {order.returns.length ? <div className="space-y-3">{order.returns.map((orderReturn) => <div key={orderReturn.id} className="rounded-2xl border border-slate-200 p-4"><div className="flex items-center justify-between gap-3"><StatusBadge value={orderReturn.status} /><span className="text-xs text-slate-400">{dateTime.format(orderReturn.createdAt)}</span></div><p className="mt-3 text-sm text-slate-700">{orderReturn.reason}</p><p className="mt-2 text-xs text-slate-500">Remboursement : {orderReturn.refundStatus ? `${orderReturn.refundStatus}${orderReturn.refundAmount ? ` · ${currency.format(orderReturn.refundAmount)}` : ""}` : "aucune opération"}</p></div>)}</div> : <p className="text-sm text-slate-500">Aucun retour. Un retour ne déclenche jamais automatiquement un remboursement.</p>}
          </Surface>
        </div>

        <aside className="space-y-6">
          <Surface id="client" title="Client et livraison" icon={UserRound} action={order.operatorRole !== "ORDER_AGENT" || order.fulfillmentStatus !== "shipped" ? <OrderAddressForm order={{ id: order.id, name: order.shippingName || order.customerName, phone: order.shippingPhone || "", address: order.shippingAddress || "", city: order.shippingCity || "", state: order.shippingState || "", zip: order.shippingZip || "", shipped: order.fulfillmentStatus === "shipped" }} /> : undefined}>
            <div className="space-y-2 text-sm"><p className="font-semibold text-slate-900">{order.shippingName || order.customerName}</p><p className="text-slate-600">{order.shippingPhone || "Téléphone manquant"}</p><p className="text-slate-600">{order.email}</p><div className="mt-3 rounded-2xl bg-slate-50 p-3 text-slate-600"><MapPin className="mr-2 inline h-4 w-4" />{order.shippingAddress || "Adresse manquante"}<br /><span className="ml-6">{[order.shippingCity, order.shippingState, order.shippingZip].filter(Boolean).join(" · ") || "Ville manquante"}</span></div>{order.user ? <Link href={`/admin/clients/${order.user.id}`} className="inline-block text-xs font-semibold text-blue-700 hover:underline">Voir le profil client →</Link> : null}</div>
            <div className="mt-4"><OrderContactButtons orderId={order.id} phone={order.shippingPhone} email={order.email} /></div>
          </Surface>

          <Surface title="Paiement" icon={CreditCard}>
            <div className="space-y-3 text-sm"><div className="flex items-center justify-between gap-3"><span className="text-slate-500">Méthode</span><strong>{labels[order.paymentMethod] || order.paymentMethod}</strong></div><div className="flex items-center justify-between gap-3"><span className="text-slate-500">Statut</span><StatusBadge value={order.paymentStatus} /></div><div className="flex items-center justify-between gap-3"><span className="text-slate-500">Montant</span><strong>{currency.format(order.totalPrice)}</strong></div>{order.stripePaymentIntentId ? <div className="flex items-center justify-between gap-3"><span className="text-slate-500">Référence</span><code className="text-xs">••••{order.stripePaymentIntentId.slice(-8)}</code></div> : null}{order.paymentMethod === "cod" && order.paymentStatus !== "paid" ? <p className="rounded-xl bg-violet-50 px-3 py-2 text-xs text-violet-700">COD en attente d&apos;encaissement. La préparation reste autorisée.</p> : null}</div>
          </Surface>

          <Surface title="Livraison" icon={Truck}>
            <div className="space-y-3 text-sm"><div className="flex justify-between gap-3"><span className="text-slate-500">Statut</span><StatusBadge value={order.deliveryStatus} /></div><div className="flex justify-between gap-3"><span className="text-slate-500">Transporteur</span><strong>{order.deliveryCompany || "Non assigné"}</strong></div><div className="flex justify-between gap-3"><span className="text-slate-500">Tracking</span><strong className="max-w-48 truncate">{order.trackingNumber || "À venir"}</strong></div>{order.estimatedDeliveryAt ? <div className="flex justify-between gap-3"><span className="text-slate-500">Livraison estimée</span><strong>{dateTime.format(order.estimatedDeliveryAt)}</strong></div> : null}</div>
          </Surface>

          <Surface title="Notes internes" icon={ReceiptText}>
            <OrderNoteForm orderId={order.id} />
            {order.notes.length ? <div className="mt-4 divide-y divide-slate-100">{order.notes.map((note) => <div key={note.id} className="py-3"><p className="text-sm leading-6 text-slate-700">{note.content}</p><p className="mt-1 text-[11px] text-slate-400">{note.createdBy} · {dateTime.format(note.createdAt)}</p></div>)}</div> : <p className="mt-4 text-xs text-slate-400">Aucune note pour le moment.</p>}
          </Surface>
        </aside>
      </div>
    </div>
  );
}
