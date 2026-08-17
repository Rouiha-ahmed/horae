"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  AlertTriangle,
  Boxes,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Download,
  Eye,
  Filter,
  MoreHorizontal,
  PackageCheck,
  Search,
  Send,
  Truck,
} from "lucide-react";
import { useActionState, useMemo, useState, useTransition, type FormEvent } from "react";

import {
  bulkOrderActionState,
  performOrderActionState,
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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import {
  canRolePerformOrderAction,
  nextActionLabels,
  type OrderAction,
  type OrderNextAction,
  type OrderOperatorRole,
} from "@/lib/orders/domain";

type WorkQueueOrder = {
  id: string;
  orderNumber: string;
  userId: string | null;
  customerName: string;
  email: string;
  phone: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  totalPrice: number;
  status: string;
  paymentStatus: string;
  paymentMethod: string;
  fulfillmentStatus: string;
  deliveryStatus: string;
  deliveryCompany: string | null;
  trackingNumber: string | null;
  orderDate: string;
  preparedAt: string | null;
  shippedAt: string | null;
  deliveredAt: string | null;
  statusChangedAt: string;
  version: number;
  itemsCount: number;
  itemNames: string[];
  nextAction: OrderNextAction;
  attentionLevel: string;
  issues: Array<{
    code: string;
    severity: string;
    message: string;
    recommendedAction: OrderNextAction;
    blocking: boolean;
  }>;
  sla: {
    stage: string;
    policyId: string;
    dueAt: string;
    isOverdue: boolean;
  } | null;
};

type OrdersWorkQueueData = {
  operatorRole: OrderOperatorRole;
  metrics: {
    totalOrders: number;
    paidOrders: number;
    paidRevenue: number;
    averagePaidBasket: number;
    toProcess: number;
    toPrepare: number;
    toShip: number;
    inTransit: number;
    deliveryProblem: number;
    overdue: number;
    delivered: number;
    cancelled: number;
  };
  filters: {
    view: string;
    query: string;
    fulfillment: string;
    payment: string;
    method: string;
    delivery: string;
    period: string;
    city: string;
    carrier: string;
    minAmount: number | null;
    maxAmount: number | null;
    issue: string;
    product: string;
    sort: string;
    page: number;
    pageSize: number;
  };
  orders: WorkQueueOrder[];
  options: { cities: string[]; carriers: string[] };
  pagination: { currentPage: number; totalPages: number; pageSize: number; filteredCount: number };
};

type Props = {
  data: OrdersWorkQueueData;
  statusMessage?: string;
  errorMessage?: string;
};

const initialState: OrderMutationState = { success: false, message: "", revision: 0 };
const currency = new Intl.NumberFormat("fr-MA", { style: "currency", currency: "MAD", maximumFractionDigits: 2 });
const date = new Intl.DateTimeFormat("fr-MA", { day: "numeric", month: "short", year: "numeric" });
const time = new Intl.DateTimeFormat("fr-MA", { hour: "2-digit", minute: "2-digit" });
const number = new Intl.NumberFormat("fr-MA");

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
  preparing_delivery: "Préparation",
  cod: "COD",
  cmi_card: "Carte bancaire",
  installments: "Plusieurs fois",
};

const toneFor = (value: string) => {
  if (["paid", "delivered"].includes(value)) return "bg-emerald-50 text-emerald-700 ring-emerald-200";
  if (["to_prepare", "preparing", "pending", "partial", "ready", "delayed"].includes(value)) return "bg-amber-50 text-amber-700 ring-amber-200";
  if (["shipped", "in_transit", "out_for_delivery"].includes(value)) return "bg-blue-50 text-blue-700 ring-blue-200";
  if (["cancelled", "failed", "returned", "refunded"].includes(value)) return "bg-rose-50 text-rose-700 ring-rose-200";
  return "bg-slate-100 text-slate-600 ring-slate-200";
};

function StatusBadge({ value, label }: { value: string; label?: string }) {
  return (
    <span className={cn("inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset", toneFor(value))}>
      {label || labels[value] || value}
    </span>
  );
}

const nextActionToOrderAction = (action: OrderNextAction): OrderAction | null => {
  if (action === "NONE" || action === "COMPLETE_CUSTOMER_INFORMATION" || action === "RESOLVE_BLOCKING_INCIDENT") return null;
  return action;
};

const actionPresentation = (action: OrderAction) => {
  if (action in nextActionLabels) {
    return nextActionLabels[action as OrderNextAction];
  }
  if (action === "MARK_DELIVERED") {
    return { title: "Marquer la commande livrée", button: "Marquer livrée" };
  }
  if (action === "CANCEL_ORDER") {
    return { title: "Annuler la commande", button: "Confirmer l'annulation" };
  }
  return { title: "Mettre à jour la commande", button: "Confirmer" };
};

function OrderActionDialog({
  order,
  action,
  open,
  onOpenChange,
}: {
  order: WorkQueueOrder;
  action: OrderAction;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(
    async (previous: OrderMutationState, formData: FormData) => {
      const result = await performOrderActionState(previous, formData);
      if (result.success) {
        onOpenChange(false);
        router.refresh();
      }
      return result;
    },
    initialState
  );
  const needsCarrier = action === "SHIP_ORDER" || action === "ADD_TRACKING";
  const needsTracking = action === "ADD_TRACKING";
  const needsReason = ["VERIFY_PAYMENT", "RESOLVE_DELIVERY_INCIDENT", "PROCESS_RETURN", "CANCEL_ORDER"].includes(action);
  const presentation = actionPresentation(action);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-[26px] border-slate-200 sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{presentation.title}</DialogTitle>
          <DialogDescription>
            {orderReference(order.orderNumber)} · La transition sera validée côté serveur et ajoutée à la timeline.
          </DialogDescription>
        </DialogHeader>
        <form action={formAction} className="space-y-4">
          <input type="hidden" name="orderId" value={order.id} />
          <input type="hidden" name="action" value={action} />
          <input type="hidden" name="expectedVersion" value={order.version} />
          {needsCarrier ? (
            <label className="block text-sm font-semibold text-slate-800">
              Transporteur {action === "SHIP_ORDER" ? "*" : ""}
              <Input name="carrier" required={action === "SHIP_ORDER"} defaultValue={order.deliveryCompany || ""} placeholder="Ex : Amana Express" className="mt-2 h-11 rounded-2xl" />
            </label>
          ) : null}
          {(needsTracking || action === "SHIP_ORDER") ? (
            <label className="block text-sm font-semibold text-slate-800">
              Numéro de suivi {needsTracking ? "*" : ""}
              <Input name="trackingNumber" required={needsTracking} defaultValue={order.trackingNumber || ""} placeholder="Référence transporteur" className="mt-2 h-11 rounded-2xl" />
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
              <textarea name="reason" required minLength={3} maxLength={500} className="mt-2 min-h-24 w-full rounded-2xl border border-slate-200 p-3 text-sm outline-none focus:border-shop_btn_dark_green" placeholder="Expliquez brièvement cette action…" />
            </label>
          ) : null}
          {state.message && !state.success ? <p role="alert" className="rounded-xl bg-rose-50 px-3 py-2 text-xs text-rose-700">{state.message}</p> : null}
          <DialogFooter>
            <DialogClose asChild><Button type="button" variant="outline" className="rounded-xl">Annuler</Button></DialogClose>
            <Button disabled={pending} type="submit" className={cn("rounded-xl text-white", action === "CANCEL_ORDER" ? "bg-rose-600 hover:bg-rose-700" : "bg-shop_btn_dark_green hover:bg-shop_dark_green")}>
              {pending ? "Traitement…" : presentation.button}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function OrderRowActions({ order, operatorRole }: { order: WorkQueueOrder; operatorRole: OrderOperatorRole }) {
  const [dialogAction, setDialogAction] = useState<OrderAction | null>(null);
  const primaryAction = nextActionToOrderAction(order.nextAction);
  const canPerformPrimary = primaryAction
    ? canRolePerformOrderAction(operatorRole, primaryAction)
    : false;
  const requiresInformation = ["COMPLETE_CUSTOMER_INFORMATION", "RESOLVE_BLOCKING_INCIDENT"].includes(order.nextAction);
  const canMarkDelivered = order.fulfillmentStatus === "shipped" && ["in_transit", "out_for_delivery", "delayed"].includes(order.deliveryStatus);
  const canCancel = order.status !== "cancelled" && order.deliveryStatus !== "delivered";
  const canCancelWithRole =
    canCancel && canRolePerformOrderAction(operatorRole, "CANCEL_ORDER");

  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      <div className="flex items-center gap-2">
        {requiresInformation ? (
          <Button asChild size="sm" className="rounded-xl bg-shop_btn_dark_green text-white hover:bg-shop_dark_green">
            <Link href={`/admin/orders/${order.id}#client`}>{nextActionLabels[order.nextAction].button}</Link>
          </Button>
        ) : primaryAction && canPerformPrimary ? (
          <Button type="button" size="sm" onClick={() => setDialogAction(primaryAction)} className="rounded-xl bg-shop_btn_dark_green text-white hover:bg-shop_dark_green">
            {nextActionLabels[order.nextAction].button}
          </Button>
        ) : primaryAction ? (
          <Button asChild variant="outline" size="sm" className="rounded-xl"><Link href={`/admin/orders/${order.id}`}>Manager requis</Link></Button>
        ) : (
          <Button asChild variant="outline" size="sm" className="rounded-xl"><Link href={`/admin/orders/${order.id}`}><Eye className="h-4 w-4" />Voir</Link></Button>
        )}
        {canMarkDelivered ? (
          <Button type="button" variant="outline" size="sm" onClick={() => setDialogAction("MARK_DELIVERED")} className="rounded-xl border-emerald-200 text-emerald-700 hover:bg-emerald-50">
            <CheckCircle2 className="h-4 w-4" />Livrée
          </Button>
        ) : null}
        {canCancelWithRole ? (
          <Button type="button" variant="outline" size="sm" onClick={() => setDialogAction("CANCEL_ORDER")} className="rounded-xl border-rose-200 text-rose-600 hover:bg-rose-50">
            Annuler
          </Button>
        ) : null}
      </div>
      <Popover>
        <PopoverTrigger asChild><Button type="button" variant="outline" size="icon-sm" className="rounded-xl" aria-label={`Actions ${orderReference(order.orderNumber)}`}><MoreHorizontal className="h-4 w-4" /></Button></PopoverTrigger>
        <PopoverContent align="end" className="w-56 rounded-2xl p-2">
          <Link href={`/admin/orders/${order.id}`} className="flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm text-slate-700 hover:bg-slate-50"><Eye className="h-4 w-4" />Ouvrir le détail</Link>
          {!canMarkDelivered && order.deliveryStatus === "delivered" ? <p className="px-3 py-2 text-xs font-medium text-emerald-700">Commande livrée</p> : null}
          {!canCancel && order.status === "cancelled" ? <p className="px-3 py-2 text-xs font-medium text-rose-600">Commande annulée</p> : null}
        </PopoverContent>
      </Popover>
      {dialogAction ? <OrderActionDialog order={order} action={dialogAction} open onOpenChange={(open) => !open && setDialogAction(null)} /> : null}
    </div>
  );
}

function BulkBar({ orders, selected, onClear }: { orders: WorkQueueOrder[]; selected: string[]; onClear: () => void }) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(
    async (previous: OrderMutationState, formData: FormData) => {
      const result = await bulkOrderActionState(previous, formData);
      if (result.success) {
        onClear();
        router.refresh();
      }
      return result;
    },
    initialState
  );
  const selectedOrders = orders.filter((order) => selected.includes(order.id));

  return (
    <div className="border-b border-blue-200 bg-blue-50 px-4 py-3">
      <form action={formAction} className="flex flex-col gap-3 lg:flex-row lg:items-center">
        {selected.map((id) => <input key={id} type="hidden" name="orderIds" value={id} />)}
        <strong className="text-sm text-blue-900">{selected.length} sélectionnée(s)</strong>
        <select name="action" className="h-10 rounded-xl border border-blue-200 bg-white px-3 text-sm" defaultValue="START_PREPARATION">
          <option value="START_PREPARATION">Commencer la préparation</option>
          <option value="MARK_READY">Marquer prête</option>
          <option value="SHIP_ORDER">Assigner transporteur et expédier</option>
        </select>
        <Input name="carrier" placeholder="Transporteur (si expédition)" className="h-10 rounded-xl bg-white lg:max-w-xs" />
        <Button disabled={pending} type="submit" size="sm" className="rounded-xl bg-shop_btn_dark_green text-white">{pending ? "Validation…" : "Appliquer"}</Button>
        <Button asChild type="button" variant="outline" size="sm" className="rounded-xl border-blue-200 bg-white">
          <a href={`/admin/orders/print?ids=${encodeURIComponent(selected.join(","))}`} target="_blank" rel="noreferrer">Imprimer la sélection</a>
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={onClear}>Annuler</Button>
      </form>
      {state.message ? <p className={cn("mt-2 text-xs", state.success ? "text-blue-800" : "text-rose-700")}>{state.message}</p> : null}
      {state.bulk?.incompatible.length ? (
        <ul className="mt-2 text-xs text-rose-700">
          {state.bulk.incompatible.map((item) => <li key={item.id}>{orderReference(item.orderNumber)} : {item.reason}</li>)}
        </ul>
      ) : null}
      <span className="sr-only">{selectedOrders.length} commandes chargées dans la sélection.</span>
    </div>
  );
}

const metricCards = [
  { view: "to-process", href: "/admin/orders?sort=priority", key: "toProcess", label: "À traiter", helper: "Action humaine requise", icon: AlertTriangle, tone: "bg-rose-50 text-rose-700 ring-rose-200" },
  { view: "to-prepare", href: "/admin/orders?view=to-prepare&sort=priority", key: "toPrepare", label: "À préparer", helper: "Démarrer le picking", icon: Boxes, tone: "bg-amber-50 text-amber-700 ring-amber-200" },
  { view: "to-ship", href: "/admin/orders?view=to-ship&sort=priority", key: "toShip", label: "À expédier", helper: "Commandes prêtes", icon: Send, tone: "bg-blue-50 text-blue-700 ring-blue-200" },
  { view: "delivery-problem", href: "/admin/orders?view=delivery-problem&sort=priority", key: "deliveryProblem", label: "Livraison problématique", helper: "Échec ou retard", icon: Truck, tone: "bg-orange-50 text-orange-700 ring-orange-200" },
  { view: "overdue", href: "/admin/orders?view=overdue&sort=priority", key: "overdue", label: "En retard", helper: "SLA dépassé", icon: Clock3, tone: "bg-violet-50 text-violet-700 ring-violet-200" },
] as const;

const orderViewTabs = [
  { value: "to-process", href: "/admin/orders?sort=priority", label: "À traiter", metric: "toProcess" },
  { value: "all", href: "/admin/orders?view=all&sort=newest", label: "Toutes", metric: "totalOrders" },
  { value: "in-transit", href: "/admin/orders?view=in-transit&sort=priority", label: "Livraison", metric: "inTransit" },
  { value: "delivered", href: "/admin/orders?view=delivered&sort=priority", label: "Livrées", metric: "delivered" },
  { value: "cancelled", href: "/admin/orders?view=cancelled&sort=priority", label: "Annulées", metric: "cancelled" },
  { value: "returns", href: "/admin/orders?view=returns&sort=priority", label: "Retours", metric: null },
] as const;

export default function OrdersWorkQueue({ data, statusMessage, errorMessage }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [navigating, startTransition] = useTransition();
  const [searchValue, setSearchValue] = useState(data.filters.query);
  const [advancedOpen, setAdvancedOpen] = useState(Boolean(data.filters.city || data.filters.carrier || data.filters.minAmount !== null || data.filters.maxAmount !== null || data.filters.issue !== "all" || data.filters.product));
  const [selected, setSelected] = useState<string[]>([]);

  const updateQuery = (updates: Record<string, string | null>) => {
    const next = new URLSearchParams(searchParams.toString());
    next.delete("status");
    next.delete("error");
    next.delete("page");
    for (const [key, value] of Object.entries(updates)) {
      const isDefaultValue =
        !value ||
        (key === "view" && value === "to-process") ||
        (key === "period" && value === "all") ||
        (["fulfillment", "payment", "method", "delivery", "issue"].includes(key) &&
          value === "all");

      if (isDefaultValue) next.delete(key);
      else next.set(key, value);
    }
    startTransition(() => router.push(`${pathname}${next.size ? `?${next.toString()}` : ""}`));
  };

  const submitSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    updateQuery({ q: searchValue.trim() || null });
  };

  const pageHref = (pageNumber: number) => {
    const next = new URLSearchParams(searchParams.toString());
    if (pageNumber <= 1) next.delete("page"); else next.set("page", String(pageNumber));
    return `${pathname}${next.size ? `?${next}` : ""}`;
  };

  const exportHref = `/admin/orders/export?${searchParams.toString()}`;
  const allPageSelected = data.orders.length > 0 && data.orders.every((order) => selected.includes(order.id));
  const start = data.pagination.filteredCount ? (data.pagination.currentPage - 1) * data.pagination.pageSize + 1 : 0;
  const end = Math.min(data.pagination.currentPage * data.pagination.pageSize, data.pagination.filteredCount);
  const activeAdvancedCount = useMemo(() => [data.filters.city, data.filters.carrier, data.filters.product, data.filters.issue !== "all" ? data.filters.issue : "", data.filters.minAmount, data.filters.maxAmount].filter(Boolean).length, [data.filters]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Centre opérationnel</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">Commandes</h1>
          <p className="mt-2 text-sm text-slate-600">Traitez d&apos;abord ce qui nécessite une action, puis consultez l&apos;historique complet.</p>
        </div>
        <Button asChild variant="outline" className="h-11 rounded-2xl border-slate-200 bg-white"><a href={exportHref}><Download className="h-4 w-4" />Exporter la vue</a></Button>
      </div>

      {statusMessage ? <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{statusMessage}</div> : null}
      {errorMessage ? <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{errorMessage}</div> : null}

      <section>
        <div className="mb-3 flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-amber-600" /><h2 className="text-sm font-semibold text-slate-800">Ce qui nécessite une action</h2></div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          {metricCards.map(({ view, href, key, label, helper, icon: Icon, tone }) => (
            <button key={view} type="button" onClick={() => window.location.assign(href)} className={cn("rounded-[24px] border bg-white/95 p-4 text-left shadow-[0_20px_55px_-44px_rgba(15,23,42,0.4)] transition hover:-translate-y-0.5", data.filters.view === view ? "border-shop_btn_dark_green ring-2 ring-shop_light_green/20" : "border-white/80") }>
              <div className="flex items-start justify-between gap-3"><div><p className="text-xs font-semibold text-slate-500">{label}</p><p className="mt-2 text-2xl font-semibold text-slate-950">{number.format(data.metrics[key])}</p></div><span className={cn("flex h-10 w-10 items-center justify-center rounded-2xl ring-1 ring-inset", tone)}><Icon className="h-4 w-4" /></span></div>
              <p className="mt-2 text-xs text-slate-500">{helper}</p>
            </button>
          ))}
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl border border-slate-200 bg-white/80 px-4 py-3"><p className="text-xs text-slate-500">Toutes les commandes</p><p className="mt-1 font-semibold text-slate-900">{number.format(data.metrics.totalOrders)}</p></div>
        <div className="rounded-2xl border border-slate-200 bg-white/80 px-4 py-3"><p className="text-xs text-slate-500">Commandes payées</p><p className="mt-1 font-semibold text-slate-900">{number.format(data.metrics.paidOrders)}</p></div>
        <div className="rounded-2xl border border-slate-200 bg-white/80 px-4 py-3"><p className="text-xs text-slate-500">CA encaissé</p><p className="mt-1 font-semibold text-slate-900">{currency.format(data.metrics.paidRevenue)}</p></div>
        <div className="rounded-2xl border border-slate-200 bg-white/80 px-4 py-3"><p className="text-xs text-slate-500">Panier moyen payé</p><p className="mt-1 font-semibold text-slate-900">{currency.format(data.metrics.averagePaidBasket)}</p></div>
      </section>

      <section className="overflow-hidden rounded-[28px] border border-white/80 bg-white/95 shadow-[0_26px_80px_-56px_rgba(15,23,42,0.42)]">
        <div className="border-b border-slate-200 p-4">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
            <form onSubmit={submitSearch} className="relative min-w-0 flex-1">
              <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input value={searchValue} onChange={(event) => setSearchValue(event.target.value)} placeholder="Rechercher (n° commande, client, téléphone, tracking...)" className="h-11 rounded-2xl bg-slate-50 pl-11 pr-20" />
              <button type="submit" className="absolute right-2 top-1/2 -translate-y-1/2 rounded-xl px-3 py-1.5 text-xs font-semibold text-shop_btn_dark_green hover:bg-white">Chercher</button>
            </form>
            <select value={data.filters.fulfillment} onChange={(event) => updateQuery({ fulfillment: event.target.value })} className="h-11 rounded-2xl border border-slate-200 bg-white px-3 text-sm"><option value="all">Traitement : Tous</option><option value="to_prepare">À préparer</option><option value="preparing">En préparation</option><option value="ready">Prête</option><option value="shipped">Expédiée</option><option value="cancelled">Annulée</option></select>
            <select value={data.filters.payment} onChange={(event) => updateQuery({ payment: event.target.value })} className="h-11 rounded-2xl border border-slate-200 bg-white px-3 text-sm"><option value="all">Paiement : Tous</option><option value="pending">En attente</option><option value="partial">Partiel</option><option value="paid">Payé</option><option value="failed">Échoué</option><option value="refunded">Remboursé</option></select>
            <select value={data.filters.method} onChange={(event) => updateQuery({ method: event.target.value })} className="h-11 rounded-2xl border border-slate-200 bg-white px-3 text-sm"><option value="all">Moyen : Tous</option><option value="cod">COD</option><option value="cmi_card">Carte bancaire</option><option value="installments">Plusieurs fois</option></select>
            <select value={data.filters.delivery} onChange={(event) => updateQuery({ delivery: event.target.value })} className="h-11 rounded-2xl border border-slate-200 bg-white px-3 text-sm"><option value="all">Livraison : Toutes</option><option value="not_assigned">Non expédiée</option><option value="in_transit">En transit</option><option value="out_for_delivery">En livraison</option><option value="delivered">Livrée</option><option value="delayed">Retard</option><option value="failed">Échec</option><option value="returned">Retournée</option></select>
            <select value={data.filters.period} onChange={(event) => updateQuery({ period: event.target.value })} className="h-11 rounded-2xl border border-slate-200 bg-white px-3 text-sm"><option value="7d">7 derniers jours</option><option value="30d">30 derniers jours</option><option value="90d">90 derniers jours</option><option value="all">Toutes périodes</option></select>
            <Button type="button" variant="outline" onClick={() => setAdvancedOpen((value) => !value)} className="h-11 rounded-2xl"><Filter className="h-4 w-4" />Filtres{activeAdvancedCount ? ` (${activeAdvancedCount})` : ""}</Button>
          </div>
          {advancedOpen ? (
            <form method="get" className="mt-4 grid gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 sm:grid-cols-2 xl:grid-cols-6">
              {Array.from(searchParams.entries()).filter(([key]) => !["city", "carrier", "minAmount", "maxAmount", "issue", "product", "page"].includes(key)).map(([key, value]) => <input key={key} type="hidden" name={key} value={value} />)}
              <select name="city" defaultValue={data.filters.city} className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm"><option value="">Toutes les villes</option>{data.options.cities.map((city) => <option key={city} value={city}>{city}</option>)}</select>
              <select name="carrier" defaultValue={data.filters.carrier} className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm"><option value="">Tous transporteurs</option>{data.options.carriers.map((carrier) => <option key={carrier} value={carrier}>{carrier}</option>)}</select>
              <Input name="minAmount" type="number" min="0" defaultValue={data.filters.minAmount ?? ""} placeholder="Montant min." className="h-10 rounded-xl bg-white" />
              <Input name="maxAmount" type="number" min="0" defaultValue={data.filters.maxAmount ?? ""} placeholder="Montant max." className="h-10 rounded-xl bg-white" />
              <select name="issue" defaultValue={data.filters.issue} className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm"><option value="all">Toutes anomalies</option><option value="missing-phone">Téléphone manquant</option><option value="address">Adresse</option><option value="payment-failed">Paiement échoué</option><option value="uncollected-cod">COD livré non encaissé</option><option value="tracking">Tracking manquant</option><option value="delivery">Incident livraison</option><option value="return">Retour</option></select>
              <Input name="product" defaultValue={data.filters.product} placeholder="Produit ou SKU" className="h-10 rounded-xl bg-white" />
              <div className="flex gap-2 sm:col-span-2 xl:col-span-6"><Button type="submit" size="sm" className="rounded-xl bg-shop_btn_dark_green text-white">Appliquer</Button><Button asChild type="button" variant="ghost" size="sm"><Link href={`/admin/orders${data.filters.view !== "to-process" ? `?view=${data.filters.view}` : ""}`}>Réinitialiser</Link></Button></div>
            </form>
          ) : null}
        </div>

        <div className="flex flex-col gap-3 border-b border-slate-200 px-4 pt-3 sm:flex-row sm:items-end sm:justify-between">
          <nav className="flex gap-1 overflow-x-auto" aria-label="Vues commandes">
            {orderViewTabs.map((tab) => {
              const count = tab.metric ? data.metrics[tab.metric] : undefined;
              return <button key={tab.value} type="button" onClick={() => window.location.assign(tab.href)} aria-current={data.filters.view === tab.value ? "page" : undefined} className={cn("whitespace-nowrap border-b-2 px-3 py-3 text-sm font-semibold", data.filters.view === tab.value ? "border-shop_btn_dark_green text-shop_btn_dark_green" : "border-transparent text-slate-500 hover:text-slate-800")}>{tab.label}{typeof count === "number" ? <span className="ml-1.5 rounded-full bg-slate-100 px-2 py-0.5 text-[10px]">{count}</span> : null}</button>;
            })}</nav>
          <select value={data.filters.sort} onChange={(event) => updateQuery({ sort: event.target.value })} className="mb-2 h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm"><option value="priority">Priorité</option><option value="newest">Plus récentes</option><option value="oldest">Plus anciennes</option><option value="amount-desc">Montant décroissant</option><option value="amount-asc">Montant croissant</option><option value="sla">Échéance SLA</option></select>
        </div>

        {navigating ? <div className="h-1 animate-pulse bg-shop_light_green" /> : null}
        {selected.length ? <BulkBar orders={data.orders} selected={selected} onClear={() => setSelected([])} /> : null}

        {data.orders.length ? (
          <>
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full min-w-[1080px] text-left text-sm">
                <thead className="border-b border-slate-200 bg-slate-50/80 text-[11px] font-semibold uppercase tracking-[0.1em] text-slate-500"><tr><th className="px-4 py-3"><input type="checkbox" checked={allPageSelected} onChange={(event) => setSelected(event.target.checked ? data.orders.map((order) => order.id) : [])} aria-label="Sélectionner la page" /></th><th className="px-3 py-3">Commande</th><th className="px-3 py-3">Client / destination</th><th className="px-3 py-3">Montant / paiement</th><th className="px-3 py-3">Traitement</th><th className="px-3 py-3">Livraison</th><th className="px-3 py-3">Signal</th><th className="px-4 py-3 text-right">Opérations</th></tr></thead>
                <tbody className="divide-y divide-slate-200">
                  {data.orders.map((order) => <tr key={order.id} className={cn("hover:bg-slate-50/70", order.attentionLevel === "CRITICAL" && "bg-rose-50/30")}><td className="px-4 py-3"><input type="checkbox" checked={selected.includes(order.id)} onChange={(event) => setSelected((current) => event.target.checked ? [...current, order.id] : current.filter((id) => id !== order.id))} aria-label={`Sélectionner ${orderReference(order.orderNumber)}`} /></td><td className="px-3 py-3"><Link href={`/admin/orders/${order.id}`} className="font-semibold text-blue-700 hover:underline">{orderReference(order.orderNumber)}</Link><p className="mt-1 text-xs text-slate-500">{date.format(new Date(order.orderDate))} · {time.format(new Date(order.orderDate))}</p><p className="mt-1 text-xs text-slate-400">{order.itemsCount} article(s)</p></td><td className="px-3 py-3"><p className="font-semibold text-slate-900">{order.customerName}</p><p className="mt-1 max-w-48 truncate text-xs text-slate-500">{order.email}</p><p className="mt-1 text-xs text-slate-500">{order.city || "Ville manquante"}</p></td><td className="px-3 py-3"><p className="font-semibold text-slate-900">{currency.format(order.totalPrice)}</p><p className="mt-1 text-xs text-slate-500">{labels[order.paymentMethod] || order.paymentMethod}</p><div className="mt-1"><StatusBadge value={order.paymentStatus} /></div></td><td className="px-3 py-3"><StatusBadge value={order.fulfillmentStatus} />{order.sla ? <p className={cn("mt-2 text-xs", order.sla.isOverdue ? "font-semibold text-rose-600" : "text-slate-500")}>{order.sla.isOverdue ? "SLA dépassé" : `Échéance ${date.format(new Date(order.sla.dueAt))}`}</p> : null}</td><td className="px-3 py-3"><StatusBadge value={order.deliveryStatus} /><p className="mt-2 text-xs text-slate-500">{order.deliveryCompany || "Transporteur non assigné"}</p>{order.trackingNumber ? <p className="mt-1 max-w-36 truncate text-xs text-slate-400">{order.trackingNumber}</p> : null}</td><td className="px-3 py-3">{order.issues[0] ? <span className={cn("inline-flex max-w-48 items-center gap-1 rounded-xl px-2.5 py-1.5 text-xs font-semibold", order.issues[0].severity === "critical" ? "bg-rose-50 text-rose-700" : "bg-amber-50 text-amber-700")}><AlertTriangle className="h-3.5 w-3.5 shrink-0" /><span className="truncate">{order.issues[0].message}</span></span> : <span className="text-xs text-slate-400">Aucun signal</span>}{order.issues.length > 1 ? <p className="mt-1 text-[10px] text-slate-500">+ {order.issues.length - 1} autre(s)</p> : null}</td><td className="px-4 py-3"><OrderRowActions order={order} operatorRole={data.operatorRole} /></td></tr>)}
                </tbody>
              </table>
            </div>

            <div className="divide-y divide-slate-200 md:hidden">{data.orders.map((order) => <article key={order.id} className={cn("p-4", order.attentionLevel === "CRITICAL" && "bg-rose-50/30")}><div className="flex items-start justify-between gap-3"><div><Link href={`/admin/orders/${order.id}`} className="font-semibold text-blue-700">{orderReference(order.orderNumber)}</Link><p className="mt-1 text-xs text-slate-500">{order.customerName} · {order.city || "Ville manquante"}</p></div><p className="font-semibold text-slate-900">{currency.format(order.totalPrice)}</p></div><div className="mt-3 flex flex-wrap gap-2"><StatusBadge value={order.fulfillmentStatus} /><StatusBadge value={order.paymentStatus} /><StatusBadge value={order.deliveryStatus} /></div>{order.issues[0] ? <p className="mt-3 rounded-xl bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700">{order.issues[0].message}</p> : null}<div className="mt-4"><OrderRowActions order={order} operatorRole={data.operatorRole} /></div></article>)}</div>
          </>
        ) : (
          <div className="px-5 py-16 text-center"><PackageCheck className="mx-auto h-9 w-9 text-emerald-400" /><p className="mt-4 font-semibold text-slate-900">{data.filters.view === "to-process" ? "Aucune commande à traiter" : "Aucune commande trouvée"}</p><p className="mt-2 text-sm text-slate-500">{data.filters.view === "to-process" ? "La file opérationnelle est à jour." : "Modifiez votre recherche ou vos filtres."}</p></div>
        )}

        <div className="flex flex-col gap-3 border-t border-slate-200 px-4 py-4 text-sm text-slate-500 sm:flex-row sm:items-center sm:justify-between"><p>Affichage de {start} à {end} sur {data.pagination.filteredCount} commandes</p><div className="flex items-center gap-2"><select value={data.pagination.pageSize} onChange={(event) => updateQuery({ pageSize: event.target.value })} className="h-9 rounded-xl border border-slate-200 bg-white px-2 text-xs"><option value="10">10 / page</option><option value="20">20 / page</option><option value="50">50 / page</option></select><Button asChild variant="outline" size="icon-sm" className="rounded-xl"><Link href={pageHref(Math.max(1, data.pagination.currentPage - 1))} aria-disabled={data.pagination.currentPage <= 1}><ChevronLeft className="h-4 w-4" /></Link></Button><span className="rounded-xl bg-shop_btn_dark_green px-3 py-1.5 text-xs font-semibold text-white">{data.pagination.currentPage} / {data.pagination.totalPages}</span><Button asChild variant="outline" size="icon-sm" className="rounded-xl"><Link href={pageHref(Math.min(data.pagination.totalPages, data.pagination.currentPage + 1))} aria-disabled={data.pagination.currentPage >= data.pagination.totalPages}><ChevronRight className="h-4 w-4" /></Link></Button></div></div>
      </section>
    </div>
  );
}
