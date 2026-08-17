"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Archive,
  ArchiveRestore,
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  Boxes,
  Check,
  ClipboardList,
  ImageOff,
  Package,
  Pencil,
  Save,
  ShieldCheck,
} from "lucide-react";
import { useActionState, useEffect, useState, useTransition } from "react";

import {
  adjustProductInventoryAction,
  archiveProductAction,
  restoreProductAction,
  type ProductMutationState,
} from "@/app/admin/products/actions";
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
import { Textarea } from "@/components/ui/textarea";
import { resolveImageUrl } from "@/lib/image";
import type { AdminProductDetail as ProductDetailData } from "@/lib/products/admin-data";
import { cn } from "@/lib/utils";

const initialState: ProductMutationState = {
  success: false,
  message: "",
  revision: 0,
};
const money = new Intl.NumberFormat("fr-MA", {
  style: "currency",
  currency: "MAD",
  maximumFractionDigits: 2,
});
const number = new Intl.NumberFormat("fr-MA");
const dateTime = new Intl.DateTimeFormat("fr-MA", {
  dateStyle: "medium",
  timeStyle: "short",
});

const lifecycleLabels = {
  DRAFT: "Brouillon",
  ACTIVE: "Actif",
  INACTIVE: "Inactif",
  ARCHIVED: "Archivé",
} as const;

const movementLabels: Record<string, string> = {
  INITIAL_BALANCE: "Solde initial",
  ORDER: "Commande",
  ORDER_CANCELLED: "Commande annulée",
  MANUAL_ADJUSTMENT: "Ajustement manuel",
  RESTOCK: "Réapprovisionnement",
  RETURN: "Retour client",
  DAMAGE: "Casse / perte",
  CORRECTION: "Correction",
  IMPORT: "Import",
};

function LifecycleBadge({
  value,
}: {
  value: ProductDetailData["lifecycleStatus"];
}) {
  const tone =
    value === "ACTIVE"
      ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
      : value === "DRAFT"
        ? "bg-blue-50 text-blue-700 ring-blue-200"
        : value === "ARCHIVED"
          ? "bg-slate-100 text-slate-600 ring-slate-200"
          : "bg-amber-50 text-amber-700 ring-amber-200";
  return (
    <span
      className={cn(
        "rounded-full px-3 py-1 text-xs font-semibold ring-1 ring-inset",
        tone,
      )}
    >
      {lifecycleLabels[value]}
    </span>
  );
}

function InventoryAdjustment({ productId }: { productId: string }) {
  const router = useRouter();
  const [state, action, pending] = useActionState(
    adjustProductInventoryAction,
    initialState,
  );

  useEffect(() => {
    if (state.success && state.revision) router.refresh();
  }, [router, state.revision, state.success]);

  return (
    <form
      action={action}
      className="rounded-[24px] border border-slate-200 bg-slate-50 p-5"
    >
      <input type="hidden" name="productId" value={productId} />
      <h3 className="font-semibold text-slate-950">Enregistrer un mouvement</h3>
      <p className="mt-1 text-xs leading-5 text-slate-500">
        Utilisez une valeur positive pour une entrée et négative pour une
        sortie. Le solde ne peut jamais devenir négatif.
      </p>
      {state.message ? (
        <div
          role={state.success ? "status" : "alert"}
          className={cn(
            "mt-4 rounded-xl border px-3 py-2 text-xs",
            state.success
              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
              : "border-rose-200 bg-rose-50 text-rose-700",
          )}
        >
          {state.message}
        </div>
      ) : null}
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="space-y-1.5 text-xs font-semibold text-slate-700">
          <span>Variation *</span>
          <Input
            name="quantityDelta"
            type="number"
            step="1"
            required
            placeholder="Ex. 25 ou -2"
            className="bg-white"
          />
        </label>
        <label className="space-y-1.5 text-xs font-semibold text-slate-700">
          <span>Motif *</span>
          <select
            name="reason"
            defaultValue="RESTOCK"
            className="h-9 w-full rounded-md border border-input bg-white px-3 text-sm"
          >
            <option value="RESTOCK">Réapprovisionnement</option>
            <option value="RETURN">Retour client</option>
            <option value="DAMAGE">Casse / perte</option>
            <option value="CORRECTION">Correction</option>
            <option value="MANUAL_ADJUSTMENT">Ajustement manuel</option>
            <option value="IMPORT">Import</option>
          </select>
        </label>
      </div>
      <label className="mt-3 block space-y-1.5 text-xs font-semibold text-slate-700">
        <span>Note explicative</span>
        <Textarea
          name="note"
          maxLength={500}
          placeholder="Bon de livraison, motif de correction…"
          className="min-h-20 bg-white"
        />
      </label>
      <Button
        type="submit"
        disabled={pending}
        className="mt-4 rounded-xl bg-blue-950 text-white"
      >
        <Save className="h-4 w-4" />
        {pending ? "Enregistrement…" : "Enregistrer le mouvement"}
      </Button>
    </form>
  );
}

export default function ProductDetail({
  product,
}: {
  product: ProductDetailData;
}) {
  const router = useRouter();
  const [confirmArchive, setConfirmArchive] = useState(false);
  const [pending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState("");

  const runLifecycleAction = (mode: "archive" | "restore") => {
    startTransition(async () => {
      const response =
        mode === "archive"
          ? await archiveProductAction(product.id)
          : await restoreProductAction(product.id);
      setFeedback(response.message);
      if (response.success) {
        setConfirmArchive(false);
        router.refresh();
      }
    });
  };

  const riskLabel =
    product.stockRisk.level === "OUT_OF_STOCK"
      ? "Rupture"
      : product.stockRisk.level === "CRITICAL"
        ? "Couverture critique"
        : product.stockRisk.level === "LOW"
          ? "Couverture faible"
          : product.stockRisk.level === "NO_RECENT_SALES"
            ? "Sans ventes récentes"
            : "Couverture saine";

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <Link
            href="/admin/products"
            className="inline-flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-blue-900"
          >
            <ArrowLeft className="h-4 w-4" /> Retour aux produits
          </Link>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <h1 className="text-3xl font-semibold text-slate-950">
              {product.name}
            </h1>
            <LifecycleBadge value={product.lifecycleStatus} />
          </div>
          <p className="mt-2 text-sm text-slate-500">
            SKU {product.sku}
            {product.barcode ? ` · EAN ${product.barcode}` : ""}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline" className="rounded-xl">
            <Link
              href={`/admin/products?${new URLSearchParams({
                q: product.sku,
                edit: product.id,
                ...(product.lifecycleStatus === "ARCHIVED"
                  ? { view: "archived" }
                  : {}),
              }).toString()}`}
            >
              <Pencil className="h-4 w-4" /> Modifier dans le catalogue
            </Link>
          </Button>
          {product.lifecycleStatus === "ARCHIVED" ? (
            <Button
              disabled={pending}
              onClick={() => runLifecycleAction("restore")}
              className="rounded-xl bg-blue-950 text-white"
            >
              <ArchiveRestore className="h-4 w-4" /> Désarchiver
            </Button>
          ) : (
            <Button
              disabled={pending}
              onClick={() => setConfirmArchive(true)}
              variant="outline"
              className="rounded-xl border-rose-200 text-rose-700 hover:bg-rose-50"
            >
              <Archive className="h-4 w-4" /> Archiver
            </Button>
          )}
        </div>
      </header>

      {feedback ? (
        <div className="rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
          {feedback}
        </div>
      ) : null}

      <nav className="flex gap-1 overflow-x-auto rounded-2xl border bg-white p-1.5 text-sm font-semibold text-slate-600">
        {[
          ["information", "Informations"],
          ["stock", "Prix & stock"],
          ["images", "Images"],
          ["visibility", "Visibilité"],
          ["options", "Options"],
        ].map(([href, label]) => (
          <a
            key={href}
            href={`#${href}`}
            className="whitespace-nowrap rounded-xl px-4 py-2 hover:bg-slate-50 hover:text-blue-900"
          >
            {label}
          </a>
        ))}
      </nav>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <article className="rounded-[24px] border bg-white p-5">
          <p className="text-xs font-semibold text-slate-500">Prix actuel</p>
          <p className="mt-2 text-2xl font-semibold">
            {money.format(product.price)}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Référence {money.format(product.regularPrice)}
          </p>
        </article>
        <article className="rounded-[24px] border bg-white p-5">
          <p className="text-xs font-semibold text-slate-500">
            Stock disponible
          </p>
          <p className="mt-2 text-2xl font-semibold">
            {number.format(product.stock)}
          </p>
          <p className="mt-1 text-xs text-slate-500">{riskLabel}</p>
        </article>
        <article className="rounded-[24px] border bg-white p-5">
          <p className="text-xs font-semibold text-slate-500">
            Ventes sur 30 jours
          </p>
          <p className="mt-2 text-2xl font-semibold">
            {number.format(product.unitsSold30d)}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            {product.stockRisk.daysOfCover === null
              ? "Couverture non calculable"
              : `${product.stockRisk.daysOfCover.toFixed(1)} jours de couverture`}
          </p>
        </article>
        <article className="rounded-[24px] border bg-white p-5">
          <p className="text-xs font-semibold text-slate-500">
            Commandes historiques
          </p>
          <p className="mt-2 text-2xl font-semibold">
            {number.format(product.orderCount)}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Conservées après archivage
          </p>
        </article>
      </section>

      <section
        id="information"
        className="scroll-mt-24 rounded-[28px] border bg-white p-6"
      >
        <div className="flex items-center gap-3">
          <ClipboardList className="h-5 w-5 text-blue-800" />
          <h2 className="text-xl font-semibold">Informations</h2>
        </div>
        <div className="mt-6 grid gap-6 lg:grid-cols-[1.35fr_.65fr]">
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-[.12em] text-slate-400">
              Description courte
            </h3>
            <p className="mt-2 whitespace-pre-line text-sm leading-7 text-slate-700">
              {product.shortDescription ||
                product.description ||
                "Aucune description courte."}
            </p>
            <h3 className="mt-5 text-xs font-semibold uppercase tracking-[.12em] text-slate-400">
              Description complète
            </h3>
            <p className="mt-2 whitespace-pre-line text-sm leading-7 text-slate-700">
              {product.fullDescription || "Aucune description complète."}
            </p>
          </div>
          <dl className="space-y-3 rounded-2xl bg-slate-50 p-5 text-sm">
            <div>
              <dt className="text-xs text-slate-500">Marque</dt>
              <dd className="mt-1 font-semibold">
                {product.brandTitle || "Sans marque"}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500">Catégories actives</dt>
              <dd className="mt-1 font-semibold">
                {product.categories.map((item) => item.title).join(", ") ||
                  "Aucune"}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500">Slug</dt>
              <dd className="mt-1 break-all font-mono text-xs">
                {product.slug}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500">Dernière modification</dt>
              <dd className="mt-1 font-semibold">
                {dateTime.format(new Date(product.updatedAt))}
              </dd>
            </div>
          </dl>
        </div>
      </section>

      <section
        id="stock"
        className="scroll-mt-24 rounded-[28px] border bg-white p-6"
      >
        <div className="flex items-center gap-3">
          <Boxes className="h-5 w-5 text-blue-800" />
          <div>
            <h2 className="text-xl font-semibold">Prix & stock</h2>
            <p className="mt-1 text-sm text-slate-500">
              Chaque variation de stock est traçable et liée à son motif.
            </p>
          </div>
        </div>
        <div className="mt-6 grid gap-6 xl:grid-cols-[.72fr_1.28fr]">
          <InventoryAdjustment productId={product.id} />
          <div className="min-w-0 overflow-hidden rounded-[24px] border border-slate-200">
            <div className="border-b bg-slate-50 px-4 py-3">
              <h3 className="font-semibold">Historique des mouvements</h3>
            </div>
            {product.movements.length ? (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[740px] text-left text-sm">
                  <thead className="text-[11px] uppercase tracking-[.08em] text-slate-500">
                    <tr>
                      <th className="px-4 py-3">Date</th>
                      <th className="px-3 py-3">Motif</th>
                      <th className="px-3 py-3">Variation</th>
                      <th className="px-3 py-3">Solde</th>
                      <th className="px-3 py-3">Auteur / Référence</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {product.movements.map((movement) => (
                      <tr key={movement.id}>
                        <td className="px-4 py-3 text-xs text-slate-500">
                          {dateTime.format(new Date(movement.createdAt))}
                        </td>
                        <td className="px-3 py-3">
                          <span className="font-semibold">
                            {movementLabels[movement.reason] || movement.reason}
                          </span>
                          {movement.note ? (
                            <p
                              className="mt-1 max-w-56 truncate text-xs text-slate-500"
                              title={movement.note}
                            >
                              {movement.note}
                            </p>
                          ) : null}
                        </td>
                        <td
                          className={cn(
                            "px-3 py-3 font-semibold",
                            movement.quantityDelta > 0
                              ? "text-emerald-700"
                              : movement.quantityDelta < 0
                                ? "text-rose-700"
                                : "text-slate-500",
                          )}
                        >
                          {movement.quantityDelta > 0 ? (
                            <ArrowUp className="mr-1 inline h-3.5 w-3.5" />
                          ) : movement.quantityDelta < 0 ? (
                            <ArrowDown className="mr-1 inline h-3.5 w-3.5" />
                          ) : null}
                          {movement.quantityDelta > 0 ? "+" : ""}
                          {movement.quantityDelta}
                        </td>
                        <td className="px-3 py-3">
                          {movement.previousQuantity} →{" "}
                          <strong>{movement.newQuantity}</strong>
                        </td>
                        <td className="px-3 py-3 text-xs text-slate-600">
                          {movement.actorName ||
                            movement.actorEmail ||
                            "Système"}
                          {movement.relatedOrder ? (
                            <Link
                              href={`/admin/orders?search=${encodeURIComponent(movement.relatedOrder.orderNumber)}`}
                              className="mt-1 block font-semibold text-blue-700"
                            >
                              {movement.relatedOrder.orderNumber}
                            </Link>
                          ) : null}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="px-5 py-12 text-center text-sm text-slate-500">
                Aucun mouvement enregistré.
              </div>
            )}
          </div>
        </div>
      </section>

      <section
        id="images"
        className="scroll-mt-24 rounded-[28px] border bg-white p-6"
      >
        <div className="flex items-center gap-3">
          <ImageOff className="h-5 w-5 text-blue-800" />
          <div>
            <h2 className="text-xl font-semibold">Images</h2>
            <p className="mt-1 text-sm text-slate-500">
              {product.imageCount} visuel(s), dans l’ordre de diffusion.
            </p>
          </div>
        </div>
        {product.images.length ? (
          <div className="mt-6 grid grid-cols-2 gap-4 md:grid-cols-4 xl:grid-cols-6">
            {product.images.map((image, index) => (
              <figure
                key={image.id}
                className="overflow-hidden rounded-2xl border bg-slate-50"
              >
                <div className="relative aspect-square">
                  <Image
                    src={resolveImageUrl(image.url)}
                    alt={image.altText || product.name}
                    fill
                    unoptimized
                    sizes="14rem"
                    className="object-contain p-2"
                  />
                </div>
                <figcaption className="border-t px-3 py-2 text-xs text-slate-500">
                  {index === 0 || image.isPrimary
                    ? "Image principale"
                    : `Image ${index + 1}`}
                </figcaption>
              </figure>
            ))}
          </div>
        ) : (
          <div className="mt-6 rounded-2xl border border-dashed p-12 text-center text-sm text-slate-500">
            Aucune image.
          </div>
        )}
      </section>

      <section
        id="visibility"
        className="scroll-mt-24 rounded-[28px] border bg-white p-6"
      >
        <div className="flex items-center gap-3">
          <ShieldCheck className="h-5 w-5 text-blue-800" />
          <h2 className="text-xl font-semibold">Visibilité & promotion</h2>
        </div>
        <div className="mt-6 grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl border p-5">
            <p className="text-xs font-semibold text-slate-500">Cycle de vie</p>
            <div className="mt-3">
              <LifecycleBadge value={product.lifecycleStatus} />
            </div>
            <p className="mt-3 text-xs leading-5 text-slate-500">
              Seuls les produits actifs, non archivés, sont visibles et
              achetables.
            </p>
          </div>
          <div className="rounded-2xl border p-5">
            <p className="text-xs font-semibold text-slate-500">Mis en avant</p>
            <p className="mt-3 flex items-center gap-2 font-semibold">
              {product.isFeatured ? (
                <>
                  <Check className="h-4 w-4 text-emerald-600" /> Oui
                </>
              ) : (
                "Non"
              )}
            </p>
            <p className="mt-3 text-xs leading-5 text-slate-500">
              Alimente les sections automatiques de la Homepage sans remplacer
              les sélections manuelles.
            </p>
          </div>
          <div className="rounded-2xl border p-5">
            <p className="text-xs font-semibold text-slate-500">
              Promotion produit
            </p>
            <p className="mt-3 font-semibold">
              {product.promotionActive
                ? `Active · -${product.discount} %`
                : product.isPromotion
                  ? "Planifiée ou inactive"
                  : "Aucune"}
            </p>
            <p className="mt-3 text-xs leading-5 text-slate-500">
              {product.promotionStartsAt
                ? `Début : ${dateTime.format(new Date(product.promotionStartsAt))}`
                : "Sans date de début"}
              <br />
              {product.promotionEndsAt
                ? `Fin : ${dateTime.format(new Date(product.promotionEndsAt))}`
                : "Sans date de fin"}
            </p>
          </div>
        </div>
      </section>

      <section
        id="options"
        className="scroll-mt-24 rounded-[28px] border bg-white p-6"
      >
        <div className="flex items-center gap-3">
          <Package className="h-5 w-5 text-blue-800" />
          <div>
            <h2 className="text-xl font-semibold">Options & variantes</h2>
            <p className="mt-1 text-sm text-slate-500">
              Structure prête pour les tailles, formats, couleurs et références
              dédiées.
            </p>
          </div>
        </div>
        {product.variants.length ? (
          <div className="mt-6 overflow-x-auto rounded-2xl border">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="bg-slate-50 text-[11px] uppercase tracking-[.08em] text-slate-500">
                <tr>
                  <th className="px-4 py-3">Variante</th>
                  <th className="px-3 py-3">SKU / EAN</th>
                  <th className="px-3 py-3">Options</th>
                  <th className="px-3 py-3">Prix</th>
                  <th className="px-3 py-3">Stock</th>
                  <th className="px-3 py-3">Statut</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {product.variants.map((variant) => (
                  <tr key={variant.id}>
                    <td className="px-4 py-3 font-semibold">{variant.title}</td>
                    <td className="px-3 py-3 text-xs">
                      {variant.sku}
                      <br />
                      {variant.barcode || "—"}
                    </td>
                    <td className="px-3 py-3 text-xs text-slate-600">
                      {[
                        [variant.option1Name, variant.option1Value],
                        [variant.option2Name, variant.option2Value],
                        [variant.option3Name, variant.option3Value],
                      ]
                        .filter((pair) => pair[0] && pair[1])
                        .map((pair) => `${pair[0]} : ${pair[1]}`)
                        .join(" · ") || "—"}
                    </td>
                    <td className="px-3 py-3 font-semibold">
                      {money.format(variant.salePrice ?? variant.regularPrice)}
                    </td>
                    <td className="px-3 py-3">{variant.stock}</td>
                    <td className="px-3 py-3">
                      {variant.isActive ? "Active" : "Inactive"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="mt-6 rounded-2xl border border-dashed p-10 text-center">
            <Package className="mx-auto h-8 w-8 text-slate-300" />
            <p className="mt-3 font-semibold">Aucune variante</p>
            <p className="mt-1 text-sm text-slate-500">
              Ce produit utilise actuellement sa référence et son stock
              principal.
            </p>
          </div>
        )}
      </section>

      <Dialog open={confirmArchive} onOpenChange={setConfirmArchive}>
        <DialogContent className="rounded-[26px] sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Archiver « {product.name} » ?</DialogTitle>
            <DialogDescription className="leading-6">
              Le produit disparaîtra de la boutique, mais ses commandes,
              catégories et mouvements de stock resteront conservés.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline" className="rounded-xl">
                Annuler
              </Button>
            </DialogClose>
            <Button
              disabled={pending}
              onClick={() => runLifecycleAction("archive")}
              className="rounded-xl bg-rose-600 text-white hover:bg-rose-700"
            >
              <Archive className="h-4 w-4" />
              {pending ? "Archivage…" : "Archiver"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
