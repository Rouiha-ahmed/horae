import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import PrintOrdersButton from "@/components/admin/orders/PrintOrdersButton";
import { requireOrderOperator } from "@/lib/orders/permissions";
import { prisma } from "@/lib/prisma";

const currency = new Intl.NumberFormat("fr-MA", {
  style: "currency",
  currency: "MAD",
  maximumFractionDigits: 2,
});
const date = new Intl.DateTimeFormat("fr-MA", {
  day: "numeric",
  month: "long",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

export default async function AdminOrdersPrintPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireOrderOperator();
  const params = await searchParams;
  const rawIds = Array.isArray(params.ids) ? params.ids[0] : params.ids;
  const ids = Array.from(
    new Set((rawIds || "").split(",").map((value) => value.trim()).filter(Boolean))
  ).slice(0, 100);
  const orders = ids.length
    ? await prisma.order.findMany({
        where: { id: { in: ids } },
        orderBy: { orderDate: "asc" },
        select: {
          id: true,
          orderNumber: true,
          orderDate: true,
          customerName: true,
          email: true,
          totalPrice: true,
          paymentMethod: true,
          paymentStatus: true,
          fulfillmentStatus: true,
          deliveryStatus: true,
          shippingName: true,
          shippingPhone: true,
          shippingAddress: true,
          shippingCity: true,
          shippingState: true,
          shippingZip: true,
          deliveryCompany: true,
          trackingNumber: true,
          items: {
            orderBy: { createdAt: "asc" },
            select: {
              id: true,
              productNameSnapshot: true,
              productPriceSnapshot: true,
              quantity: true,
              product: { select: { sku: true } },
            },
          },
        },
      })
    : [];

  return (
    <div className="order-print-root space-y-5 bg-white p-2 text-slate-950 print:p-0">
      <style>{`@media print { body * { visibility: hidden !important; } .order-print-root, .order-print-root * { visibility: visible !important; } .order-print-root { position: absolute; inset: 0; width: 100%; } .order-print-card { break-inside: avoid; page-break-inside: avoid; } }`}</style>
      <header className="print:hidden flex items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-4">
        <Link href="/admin/orders" className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600">
          <ArrowLeft className="h-4 w-4" />
          Retour aux commandes
        </Link>
        <PrintOrdersButton />
      </header>

      {orders.length ? (
        <div className="space-y-5">
          {orders.map((order) => {
            const subtotal = order.items.reduce(
              (sum, item) => sum + Number(item.productPriceSnapshot) * item.quantity,
              0
            );
            return (
              <article key={order.id} className="order-print-card rounded-2xl border border-slate-300 p-5">
                <div className="flex items-start justify-between gap-6 border-b border-slate-200 pb-4">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">HORAE · Bon de traitement</p>
                    <h1 className="mt-2 text-2xl font-bold">#{order.orderNumber.slice(-8).toUpperCase()}</h1>
                    <p className="mt-1 text-xs text-slate-500">{date.format(order.orderDate)}</p>
                  </div>
                  <div className="text-right text-sm">
                    <p className="font-bold">{currency.format(Number(order.totalPrice))}</p>
                    <p className="mt-1 text-slate-500">{order.paymentMethod} · {order.paymentStatus}</p>
                    <p className="text-slate-500">{order.fulfillmentStatus} · {order.deliveryStatus}</p>
                  </div>
                </div>

                <div className="grid gap-5 py-4 text-sm sm:grid-cols-2">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Client</p>
                    <p className="mt-2 font-semibold">{order.shippingName || order.customerName}</p>
                    <p>{order.shippingPhone || "Téléphone manquant"}</p>
                    <p>{order.email}</p>
                    <p className="mt-2">{order.shippingAddress || "Adresse manquante"}</p>
                    <p>{[order.shippingCity, order.shippingState, order.shippingZip].filter(Boolean).join(" · ") || "Ville manquante"}</p>
                  </div>
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Expédition</p>
                    <p className="mt-2">Transporteur : {order.deliveryCompany || "À assigner"}</p>
                    <p>Tracking : {order.trackingNumber || "À renseigner"}</p>
                  </div>
                </div>

                <table className="w-full border-collapse text-left text-sm">
                  <thead><tr className="border-y border-slate-200 text-xs uppercase text-slate-500"><th className="py-2">Article</th><th className="py-2">SKU</th><th className="py-2 text-center">Qté</th><th className="py-2 text-right">Total</th></tr></thead>
                  <tbody>{order.items.map((item) => <tr key={item.id} className="border-b border-slate-100"><td className="py-2 font-medium">{item.productNameSnapshot}</td><td className="py-2 text-slate-500">{item.product?.sku || "—"}</td><td className="py-2 text-center">{item.quantity}</td><td className="py-2 text-right">{currency.format(Number(item.productPriceSnapshot) * item.quantity)}</td></tr>)}</tbody>
                </table>
                <div className="mt-4 flex justify-end text-sm"><p>Sous-total articles : <strong>{currency.format(subtotal)}</strong></p></div>
              </article>
            );
          })}
        </div>
      ) : (
        <div className="rounded-2xl border border-slate-200 p-12 text-center text-sm text-slate-500">Aucune commande valide sélectionnée.</div>
      )}
    </div>
  );
}
