"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  Archive,
  ArchiveRestore,
  Boxes,
  Check,
  ChevronLeft,
  ChevronRight,
  Copy,
  Eye,
  ImageOff,
  MoreHorizontal,
  PackageSearch,
  Pencil,
  Plus,
  Search,
  X,
} from "lucide-react";
import {
  useActionState,
  useEffect,
  useState,
  useTransition,
  type FormEvent,
  type MouseEvent,
} from "react";

import {
  archiveProductAction,
  bulkProductAction,
  duplicateProductAction,
  restoreProductAction,
  saveProductAction,
  type ProductMutationState,
} from "@/app/admin/products/actions";
import ImageDropInput from "@/components/admin/ImageDropInput";
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
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";
import { resolveImageUrl } from "@/lib/image";
import type {
  AdminProductRow,
  AdminProductsOperationsData,
  ProductView,
} from "@/lib/products/admin-data";
import type { ProductIssue, StockRiskLevel } from "@/lib/products/domain";
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
const numberFormatter = new Intl.NumberFormat("fr-MA");
const dateFormatter = new Intl.DateTimeFormat("fr-MA", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

const lifecycleLabels = {
  DRAFT: "Brouillon",
  ACTIVE: "Actif",
  INACTIVE: "Inactif",
  ARCHIVED: "Archivé",
} as const;
const issueActionLabels: Record<ProductIssue["recommendedAction"], string> = {
  RESTOCK: "Réapprovisionner",
  VIEW_STOCK: "Voir stock",
  FIX_PRICE: "Corriger",
  ADD_IMAGE: "Ajouter image",
  REPLACE_IMAGE: "Remplacer",
  CLASSIFY: "Classer",
  DISABLE_PROMOTION: "Désactiver",
  EDIT: "Modifier",
};

function LifecycleBadge({
  value,
}: {
  value: AdminProductRow["lifecycleStatus"];
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
        "inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset",
        tone,
      )}
    >
      {lifecycleLabels[value]}
    </span>
  );
}

function StockRiskBadge({
  level,
  days,
}: {
  level: StockRiskLevel;
  days: number | null;
}) {
  const config =
    level === "OUT_OF_STOCK"
      ? ["Rupture", "bg-rose-50 text-rose-700 ring-rose-200"]
      : level === "CRITICAL"
        ? [
            days === null ? "Critique" : `${days.toFixed(1)} j`,
            "bg-red-50 text-red-700 ring-red-200",
          ]
        : level === "LOW"
          ? [
              days === null ? "Faible" : `${days.toFixed(1)} j`,
              "bg-amber-50 text-amber-700 ring-amber-200",
            ]
          : level === "NO_RECENT_SALES"
            ? [
                "Sans ventes récentes",
                "bg-slate-100 text-slate-600 ring-slate-200",
              ]
            : [
                days === null ? "Sain" : `${days.toFixed(0)} j`,
                "bg-emerald-50 text-emerald-700 ring-emerald-200",
              ];
  return (
    <span
      className={cn(
        "inline-flex whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset",
        config[1],
      )}
    >
      {config[0]}
    </span>
  );
}

function IssueBadge({ issue }: { issue: ProductIssue | null }) {
  if (!issue)
    return <span className="text-xs text-slate-400">Aucune anomalie</span>;
  return (
    <span
      title={issueActionLabels[issue.recommendedAction]}
      className={cn(
        "inline-flex max-w-44 truncate rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset",
        issue.severity === "CRITICAL"
          ? "bg-rose-50 text-rose-700 ring-rose-200"
          : "bg-amber-50 text-amber-700 ring-amber-200",
      )}
    >
      {issue.message}
    </span>
  );
}

function ProductForm({
  product,
  data,
  onSaved,
}: {
  product: AdminProductRow | null;
  data: AdminProductsOperationsData;
  onSaved: (message: string) => void;
}) {
  const [state, formAction, pending] = useActionState(
    saveProductAction,
    initialState,
  );
  useEffect(() => {
    if (state.success && state.revision) onSaved(state.message);
  }, [onSaved, state.message, state.revision, state.success]);
  return (
    <form action={formAction} className="flex min-h-0 flex-1 flex-col">
      {product ? <input type="hidden" name="id" value={product.id} /> : null}
      <div className="flex-1 space-y-5 overflow-y-auto px-6 py-6 sm:px-8">
        {state.message && !state.success ? (
          <div
            role="alert"
            className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700"
          >
            {state.message}
          </div>
        ) : null}
        <label className="block space-y-2 text-sm font-semibold text-slate-900">
          <span>Nom du produit *</span>
          <Input
            name="name"
            required
            defaultValue={product?.name || ""}
            className="h-11 rounded-2xl border-slate-200 bg-slate-50"
          />
        </label>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block space-y-2 text-sm font-semibold">
            <span>SKU *</span>
            <Input
              name="sku"
              required
              defaultValue={product?.sku || ""}
              className="h-11 rounded-2xl border-slate-200 bg-slate-50 uppercase"
            />
          </label>
          <label className="block space-y-2 text-sm font-semibold">
            <span>EAN / code-barres</span>
            <Input
              name="barcode"
              defaultValue={product?.barcode || ""}
              className="h-11 rounded-2xl border-slate-200 bg-slate-50"
            />
          </label>
        </div>
        <label className="block space-y-2 text-sm font-semibold">
          <span>Description courte</span>
          <Textarea
            name="description"
            defaultValue={product?.description || ""}
            maxLength={1000}
            className="min-h-24 rounded-2xl border-slate-200 bg-slate-50"
          />
        </label>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block space-y-2 text-sm font-semibold">
            <span>Prix de vente (MAD)</span>
            <Input
              name="price"
              type="number"
              min="0"
              step="0.01"
              defaultValue={product?.price ?? 0}
              className="h-11 rounded-2xl border-slate-200 bg-slate-50"
            />
          </label>
          <label className="block space-y-2 text-sm font-semibold">
            <span>Prix de référence</span>
            <Input
              name="regularPrice"
              type="number"
              min="0"
              step="0.01"
              defaultValue={product?.regularPrice ?? 0}
              className="h-11 rounded-2xl border-slate-200 bg-slate-50"
            />
          </label>
        </div>
        {!product ? (
          <label className="block space-y-2 text-sm font-semibold">
            <span>Stock initial</span>
            <Input
              name="initialStock"
              type="number"
              min="0"
              step="1"
              defaultValue="0"
              className="h-11 rounded-2xl border-slate-200 bg-slate-50"
            />
            <span className="block text-xs font-normal text-slate-500">
              Les changements ultérieurs passent par le registre de stock.
            </span>
          </label>
        ) : null}
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block space-y-2 text-sm font-semibold">
            <span>Cycle de vie</span>
            <select
              name="lifecycleStatus"
              defaultValue={product?.lifecycleStatus || "DRAFT"}
              className="h-11 w-full rounded-2xl border border-slate-200 bg-slate-50 px-3"
            >
              <option value="DRAFT">Brouillon</option>
              <option value="ACTIVE">Actif</option>
              <option value="INACTIVE">Inactif</option>
              {product?.lifecycleStatus === "ARCHIVED" ? (
                <option value="ARCHIVED">Archivé</option>
              ) : null}
            </select>
          </label>
          <label className="block space-y-2 text-sm font-semibold">
            <span>Badge commercial</span>
            <select
              name="merchandisingStatus"
              defaultValue={product?.merchandisingStatus || "new"}
              className="h-11 w-full rounded-2xl border border-slate-200 bg-slate-50 px-3"
            >
              <option value="new">Nouveau</option>
              <option value="hot">Populaire</option>
              <option value="sale">Promotion</option>
            </select>
          </label>
        </div>
        <label className="block space-y-2 text-sm font-semibold">
          <span>Marque</span>
          <select
            name="brandId"
            defaultValue={product?.brandId || ""}
            className="h-11 w-full rounded-2xl border border-slate-200 bg-slate-50 px-3"
          >
            <option value="">Aucune marque</option>
            {data.brands.map((brand) => (
              <option key={brand.id} value={brand.id}>
                {brand.title}
              </option>
            ))}
          </select>
        </label>
        <fieldset className="space-y-2">
          <legend className="text-sm font-semibold">Catégories</legend>
          <div className="grid max-h-48 gap-2 overflow-y-auto rounded-2xl border border-slate-200 bg-slate-50 p-3 sm:grid-cols-2">
            {data.categories.map((category) => (
              <label
                key={category.id}
                className={cn(
                  "flex items-center gap-2 rounded-xl bg-white px-3 py-2 text-sm",
                  category.parentId && "ml-3",
                )}
              >
                <input
                  type="checkbox"
                  name="categoryIds"
                  value={category.id}
                  defaultChecked={product?.categories.some(
                    (item) => item.id === category.id,
                  )}
                />
                {category.parentId ? "↳ " : ""}
                {category.title}
              </label>
            ))}
          </div>
        </fieldset>
        <label className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
          <span>
            <strong className="block text-sm">Mis en avant</strong>
            <span className="text-xs text-slate-500">
              Utilisable par les sections Homepage automatiques.
            </span>
          </span>
          <input
            type="checkbox"
            name="isFeatured"
            defaultChecked={product?.isFeatured}
            className="h-5 w-5 accent-blue-700"
          />
        </label>
        <div className="space-y-3 rounded-2xl border border-slate-200 p-4">
          <label className="flex items-center justify-between">
            <span>
              <strong className="block text-sm">Promotion produit</strong>
              <span className="text-xs text-slate-500">
                Distincte des codes promo de commande.
              </span>
            </span>
            <input
              type="checkbox"
              name="isPromotion"
              defaultChecked={product?.isPromotion}
              className="h-5 w-5 accent-blue-700"
            />
          </label>
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="space-y-1 text-xs font-semibold">
              <span>Remise %</span>
              <Input
                name="discount"
                type="number"
                min="0"
                max="99"
                defaultValue={product?.discount || 0}
              />
            </label>
            <label className="space-y-1 text-xs font-semibold">
              <span>Début</span>
              <Input
                name="promotionStartsAt"
                type="datetime-local"
                defaultValue={product?.promotionStartsAt?.slice(0, 16) || ""}
              />
            </label>
            <label className="space-y-1 text-xs font-semibold">
              <span>Fin</span>
              <Input
                name="promotionEndsAt"
                type="datetime-local"
                defaultValue={product?.promotionEndsAt?.slice(0, 16) || ""}
              />
            </label>
          </div>
        </div>
        <ImageDropInput
          id={`product-images-${product?.id || "new"}`}
          name="imageFiles"
          label={
            product?.primaryImageUrl
              ? "Remplacer la galerie"
              : "Images du produit"
          }
          helper="Jusqu’à 6 images optimisées. La première devient l’image principale."
          multiple
          maxFiles={6}
          existingImageUrls={
            product?.primaryImageUrl
              ? [resolveImageUrl(product.primaryImageUrl)]
              : []
          }
        />
      </div>
      <div className="flex flex-col-reverse gap-3 border-t border-slate-200 px-6 py-4 sm:flex-row sm:justify-end sm:px-8">
        <DialogClose asChild>
          <Button type="button" variant="outline" className="h-11 rounded-2xl">
            Annuler
          </Button>
        </DialogClose>
        <Button
          type="submit"
          disabled={pending}
          className="h-11 rounded-2xl bg-shop_btn_dark_green px-6 text-white"
        >
          {pending
            ? "Enregistrement…"
            : product
              ? "Enregistrer"
              : "Créer le brouillon"}
        </Button>
      </div>
    </form>
  );
}

function QuickPreview({
  product,
  onEdit,
  onArchive,
  runMutation,
}: {
  product: AdminProductRow;
  onEdit: () => void;
  onArchive: () => void;
  runMutation: (task: () => Promise<ProductMutationState>) => void;
}) {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex-1 space-y-6 overflow-y-auto px-6 py-6 sm:px-8">
        <div className="flex gap-4">
          <div className="relative h-28 w-24 shrink-0 overflow-hidden rounded-2xl border border-slate-200 bg-slate-50">
            {product.primaryImageUrl ? (
              <Image
                src={resolveImageUrl(product.primaryImageUrl)}
                alt={product.name}
                fill
                unoptimized
                sizes="6rem"
                className="object-contain p-2"
              />
            ) : (
              <ImageOff className="absolute inset-0 m-auto h-7 w-7 text-slate-300" />
            )}
          </div>
          <div>
            <h2 className="text-xl font-semibold text-slate-950">
              {product.name}
            </h2>
            <p className="mt-2 text-xs text-slate-500">
              SKU {product.sku}
              {product.barcode ? ` · EAN ${product.barcode}` : ""}
            </p>
            <div className="mt-3">
              <LifecycleBadge value={product.lifecycleStatus} />
            </div>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {[
            [
              "Prix",
              money.format(
                product.promotionActive ? product.price : product.regularPrice,
              ),
            ],
            ["Stock", `${product.stock}`],
            ["Ventes 30 j", `${product.unitsSold30d}`],
            [
              "Couverture",
              product.stockRisk.daysOfCover === null
                ? "Non calculable"
                : `${product.stockRisk.daysOfCover.toFixed(1)} jours`,
            ],
          ].map(([label, value]) => (
            <div key={label} className="rounded-2xl bg-slate-50 p-3">
              <p className="text-xs text-slate-500">{label}</p>
              <p className="mt-1 font-semibold">{value}</p>
            </div>
          ))}
        </div>
        <div>
          <h3 className="text-sm font-semibold">Classement commercial</h3>
          <dl className="mt-3 space-y-2 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-slate-500">Marque</dt>
              <dd>{product.brandTitle || "Sans marque"}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-slate-500">Catégories</dt>
              <dd className="text-right">
                {product.categories.map((item) => item.title).join(", ") ||
                  "Aucune"}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-500">Promotion</dt>
              <dd>
                {product.promotionActive
                  ? `-${product.discount} %`
                  : product.isPromotion
                    ? "Planifiée / expirée"
                    : "Non"}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-500">Mis en avant</dt>
              <dd>{product.isFeatured ? "Oui" : "Non"}</dd>
            </div>
          </dl>
        </div>
        <div>
          <h3 className="text-sm font-semibold">Anomalies</h3>
          {product.issues.length ? (
            <ul className="mt-3 space-y-2">
              {product.issues.map((issue) => (
                <li
                  key={issue.type}
                  className={cn(
                    "rounded-2xl border px-4 py-3 text-sm",
                    issue.severity === "CRITICAL"
                      ? "border-rose-200 bg-rose-50 text-rose-800"
                      : "border-amber-200 bg-amber-50 text-amber-800",
                  )}
                >
                  <div className="flex items-center justify-between gap-3">
                    <span>
                      <strong>{issue.message}</strong>
                      <span className="mt-1 block text-xs">
                        Action : {issueActionLabels[issue.recommendedAction]}
                      </span>
                    </span>
                    {issue.recommendedAction === "RESTOCK" ||
                    issue.recommendedAction === "VIEW_STOCK" ? (
                      <Button
                        asChild
                        variant="outline"
                        size="sm"
                        className="shrink-0 rounded-xl bg-white"
                      >
                        <Link href={`/admin/products/${product.id}#stock`}>
                          Ouvrir
                        </Link>
                      </Button>
                    ) : (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={onEdit}
                        className="shrink-0 rounded-xl bg-white"
                      >
                        Corriger
                      </Button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 rounded-2xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
              Aucune anomalie actionnable.
            </p>
          )}
        </div>
        <p className="text-xs text-slate-400">
          Dernière modification :{" "}
          {dateFormatter.format(new Date(product.updatedAt))}
        </p>
      </div>
      <div className="flex flex-wrap gap-2 border-t border-slate-200 px-6 py-4 sm:px-8">
        <Button variant="outline" onClick={onEdit} className="rounded-xl">
          <Pencil className="h-4 w-4" />
          Modifier
        </Button>
        <Button
          asChild
          className="rounded-xl bg-shop_btn_dark_green text-white"
        >
          <Link href={`/admin/products/${product.id}`}>
            Voir la fiche complète
          </Link>
        </Button>
        {product.lifecycleStatus === "ARCHIVED" ? (
          <Button
            variant="outline"
            onClick={() => runMutation(() => restoreProductAction(product.id))}
            className="rounded-xl"
          >
            <ArchiveRestore className="h-4 w-4" />
            Désarchiver
          </Button>
        ) : (
          <Button
            variant="outline"
            onClick={onArchive}
            className="rounded-xl text-rose-600"
          >
            <Archive className="h-4 w-4" />
            Archiver
          </Button>
        )}
      </div>
    </div>
  );
}

const viewTabs: Array<{
  value: ProductView;
  label: string;
  key: keyof AdminProductsOperationsData["counters"];
}> = [
  { value: "all", label: "Tous", key: "all" },
  { value: "action-required", label: "À traiter", key: "actionRequired" },
  { value: "stock-risk", label: "Risque stock", key: "stockRisk" },
  { value: "promotion", label: "Promotions", key: "promotion" },
  { value: "featured", label: "Mis en avant", key: "featured" },
  { value: "draft", label: "Brouillons", key: "draft" },
  { value: "archived", label: "Archivés", key: "archived" },
];

export default function ProductManager({
  data,
}: {
  data: AdminProductsOperationsData;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const requestedEditor =
    data.rows.find((row) => row.id === params.get("edit")) ?? null;
  const [searchValue, setSearchValue] = useState(data.filters.query);
  const [selected, setSelected] = useState<string[]>([]);
  const [preview, setPreview] = useState<AdminProductRow | null>(null);
  const [editor, setEditor] = useState<AdminProductRow | null>(requestedEditor);
  const [editorOpen, setEditorOpen] = useState(Boolean(requestedEditor));
  const [archiveTarget, setArchiveTarget] = useState<AdminProductRow | null>(
    null,
  );
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [pendingBulkArchive, setPendingBulkArchive] = useState<FormData | null>(
    null,
  );
  const [pending, startTransition] = useTransition();
  const [bulkPending, startBulkTransition] = useTransition();
  const executeBulkAction = (formData: FormData) =>
    startBulkTransition(async () => {
      setError("");
      const response = await bulkProductAction(initialState, formData);
      if (response.success) {
        setNotice(response.message);
        if (response.bulk?.incompatible.length) {
          setError(
            `Non modifiés : ${response.bulk.incompatible
              .map((item) => `${item.name} (${item.reason})`)
              .join(" · ")}`,
          );
        }
        setSelected([]);
        router.refresh();
      } else {
        setError(response.message);
      }
    });
  const bulkAction = (formData: FormData) => {
    if (formData.get("action") === "ARCHIVE") {
      setPendingBulkArchive(formData);
      return;
    }
    executeBulkAction(formData);
  };
  const updateQuery = (updates: Record<string, string | null>) => {
    const next = new URLSearchParams(params.toString());
    next.delete("page");
    for (const [key, value] of Object.entries(updates)) {
      if (!value || value === "all" || (key === "sort" && value === "updated"))
        next.delete(key);
      else next.set(key, value);
    }
    startTransition(() =>
      router.push(`${pathname}${next.size ? `?${next}` : ""}`),
    );
  };
  const search = (event: FormEvent) => {
    event.preventDefault();
    updateQuery({ q: searchValue.trim() || null });
  };
  const pageHref = (page: number) => {
    const next = new URLSearchParams(params.toString());
    if (page <= 1) next.delete("page");
    else next.set("page", String(page));
    return `${pathname}${next.size ? `?${next}` : ""}`;
  };
  const runMutation = (task: () => Promise<ProductMutationState>) =>
    startTransition(async () => {
      setError("");
      const response = await task();
      if (response.success) {
        setNotice(response.message);
        setArchiveTarget(null);
        setPreview(null);
        router.refresh();
      } else setError(response.message);
    });
  const openEdit = (product: AdminProductRow) => {
    setEditor(product);
    setPreview(null);
    setEditorOpen(true);
  };
  const toggleAll = () =>
    setSelected(
      selected.length === data.rows.length
        ? []
        : data.rows.map((row) => row.id),
    );
  const start = data.pagination.filteredCount
    ? (data.pagination.currentPage - 1) * data.pagination.pageSize + 1
    : 0;
  const end = Math.min(
    data.pagination.currentPage * data.pagination.pageSize,
    data.pagination.filteredCount,
  );
  const currentView = data.filters.view;
  const activeFilters = [
    data.filters.lifecycle !== "all",
    Boolean(data.filters.brandId),
    Boolean(data.filters.categoryId),
    data.filters.stock !== "all",
    data.filters.promotion !== "all",
    data.filters.issue !== "all",
  ].filter(Boolean).length;
  const stop = (event: MouseEvent) => event.stopPropagation();
  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[.18em] text-slate-400">
            <Boxes className="h-4 w-4" />
            Catalogue
          </div>
          <h1 className="mt-2 text-3xl font-semibold text-slate-950">
            Produits
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            Pilotez la qualité commerciale, le stock, les promotions et la
            visibilité du catalogue.
          </p>
        </div>
        <Button
          onClick={() => {
            setEditor(null);
            setEditorOpen(true);
          }}
          className="h-11 rounded-2xl bg-shop_btn_dark_green px-5 text-white"
        >
          <Plus className="h-4 w-4" />
          Ajouter un produit
        </Button>
      </header>
      {notice ? (
        <div
          role="status"
          className="flex items-center justify-between rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800"
        >
          {notice}
          <button onClick={() => setNotice("")}>
            <X className="h-4 w-4" />
          </button>
        </div>
      ) : null}
      {error ? (
        <div
          role="alert"
          className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800"
        >
          {error}
        </div>
      ) : null}
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-[24px] border bg-white p-4">
          <p className="text-xs font-semibold text-slate-500">
            Produits actifs
          </p>
          <p className="mt-2 text-2xl font-semibold">
            {numberFormatter.format(data.counters.active)}
          </p>
        </div>
        <button
          onClick={() => updateQuery({ view: "action-required" })}
          className="rounded-[24px] border bg-white p-4 text-left"
        >
          <p className="text-xs font-semibold text-slate-500">À traiter</p>
          <p className="mt-2 text-2xl font-semibold text-rose-700">
            {data.counters.actionRequired}
          </p>
        </button>
        <button
          onClick={() => updateQuery({ view: "stock-risk" })}
          className="rounded-[24px] border bg-white p-4 text-left"
        >
          <p className="text-xs font-semibold text-slate-500">Risque stock</p>
          <p className="mt-2 text-2xl font-semibold text-amber-700">
            {data.counters.stockRisk}
          </p>
        </button>
        <button
          onClick={() => updateQuery({ view: "promotion" })}
          className="rounded-[24px] border bg-white p-4 text-left"
        >
          <p className="text-xs font-semibold text-slate-500">
            Promotions actives
          </p>
          <p className="mt-2 text-2xl font-semibold text-violet-700">
            {data.counters.promotion}
          </p>
        </button>
      </section>
      <section className="overflow-hidden rounded-[28px] border border-white/80 bg-white shadow-[0_24px_70px_-50px_rgba(15,23,42,.4)]">
        <div className="flex gap-1 overflow-x-auto border-b border-slate-200 px-4 pt-2">
          {viewTabs.map((tab) => (
            <button
              key={tab.value}
              onClick={() => updateQuery({ view: tab.value })}
              className={cn(
                "whitespace-nowrap border-b-2 px-3 py-3 text-sm font-semibold",
                currentView === tab.value
                  ? "border-blue-800 text-blue-900"
                  : "border-transparent text-slate-500",
              )}
            >
              {tab.label}{" "}
              <span className="ml-1 rounded-full bg-slate-100 px-2 py-0.5 text-xs">
                {data.counters[tab.key]}
              </span>
            </button>
          ))}
        </div>
        <div className="space-y-3 border-b border-slate-200 p-4">
          <div className="flex flex-col gap-3 lg:flex-row">
            <form onSubmit={search} className="relative min-w-0 flex-1">
              <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                value={searchValue}
                onChange={(event) => setSearchValue(event.target.value)}
                placeholder="Rechercher un produit, SKU, EAN, marque, catégorie..."
                className="h-11 rounded-2xl border-slate-200 bg-slate-50 pl-11"
              />
            </form>
            <select
              value={data.filters.lifecycle}
              onChange={(e) => updateQuery({ lifecycle: e.target.value })}
              className="h-11 rounded-2xl border border-slate-200 px-3 text-sm"
            >
              <option value="all">Statut : Tous</option>
              <option value="DRAFT">Brouillon</option>
              <option value="ACTIVE">Actif</option>
              <option value="INACTIVE">Inactif</option>
              <option value="ARCHIVED">Archivé</option>
            </select>
            <select
              value={data.filters.categoryId}
              onChange={(e) => updateQuery({ category: e.target.value })}
              className="h-11 max-w-52 rounded-2xl border border-slate-200 px-3 text-sm"
            >
              <option value="">Catégorie : Toutes</option>
              <option value="unassigned">Sans catégorie active</option>
              {data.categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.parentId ? "↳ " : ""}
                  {category.title}
                </option>
              ))}
            </select>
            <select
              value={data.filters.brandId}
              onChange={(e) => updateQuery({ brand: e.target.value })}
              className="h-11 max-w-48 rounded-2xl border border-slate-200 px-3 text-sm"
            >
              <option value="">Marque : Toutes</option>
              <option value="unassigned">Sans marque</option>
              {data.brands.map((brand) => (
                <option key={brand.id} value={brand.id}>
                  {brand.title}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-wrap gap-3">
            <select
              value={data.filters.stock}
              onChange={(e) => updateQuery({ stock: e.target.value })}
              className="h-10 rounded-xl border border-slate-200 px-3 text-sm"
            >
              <option value="all">Stock : Tous</option>
              <option value="out">Rupture</option>
              <option value="risk">Couverture à risque</option>
              <option value="healthy">Sain</option>
              <option value="no-sales">Sans ventes récentes</option>
            </select>
            <select
              value={data.filters.promotion}
              onChange={(e) => updateQuery({ promotion: e.target.value })}
              className="h-10 rounded-xl border border-slate-200 px-3 text-sm"
            >
              <option value="all">Promotion : Toutes</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive / planifiée</option>
              <option value="expired">Expirée</option>
            </select>
            {currentView === "action-required" ? (
              <select
                value={data.filters.issue}
                onChange={(e) => updateQuery({ issue: e.target.value })}
                className="h-10 rounded-xl border border-slate-200 px-3 text-sm"
              >
                <option value="all">Anomalie : Toutes</option>
                <option value="OUT_OF_STOCK">Rupture</option>
                <option value="VERY_LOW_COVERAGE">Couverture critique</option>
                <option value="MISSING_PRICE">Prix manquant</option>
                <option value="MISSING_IMAGE">Image manquante</option>
                <option value="MISSING_CATEGORY">Catégorie manquante</option>
                <option value="EXPIRED_PROMOTION">Promotion terminée</option>
              </select>
            ) : null}
            <select
              value={data.filters.sort}
              onChange={(e) => updateQuery({ sort: e.target.value })}
              className="ml-auto h-10 rounded-xl border border-slate-200 px-3 text-sm"
            >
              <option value="updated">Dernière modification</option>
              <option value="risk">Urgence</option>
              <option value="name-asc">Nom A-Z</option>
              <option value="name-desc">Nom Z-A</option>
              <option value="price-asc">Prix croissant</option>
              <option value="price-desc">Prix décroissant</option>
              <option value="stock">Stock</option>
            </select>
            {activeFilters ? (
              <Button
                variant="ghost"
                onClick={() => router.push(pathname)}
                className="h-10 rounded-xl text-blue-700"
              >
                Effacer {activeFilters} filtre(s)
              </Button>
            ) : null}
          </div>
        </div>
        {pending ? <div className="h-1 animate-pulse bg-blue-700" /> : null}
        {selected.length ? (
          <form
            action={bulkAction}
            className="flex flex-wrap items-center gap-3 border-b border-blue-200 bg-blue-50 px-4 py-3"
          >
            <strong className="text-sm text-blue-900">
              {selected.length} sélectionné(s)
            </strong>
            {selected.map((id) => (
              <input key={id} type="hidden" name="productIds" value={id} />
            ))}
            <select
              name="action"
              className="h-9 rounded-xl border border-blue-200 bg-white px-3 text-sm"
            >
              <option value="DEACTIVATE">Désactiver</option>
              <option value="ACTIVATE">Activer</option>
              <option value="FEATURE_ON">Ajouter Mis en avant</option>
              <option value="FEATURE_OFF">Retirer Mis en avant</option>
              <option value="ARCHIVE">Archiver</option>
            </select>
            <Button
              type="submit"
              disabled={bulkPending}
              className="h-9 rounded-xl bg-blue-900 text-white"
            >
              {bulkPending ? "Application…" : "Appliquer"}
            </Button>
            <button
              type="button"
              onClick={() => setSelected([])}
              className="ml-auto text-xs text-blue-700"
            >
              Annuler la sélection
            </button>
          </form>
        ) : null}
        {data.rows.length ? (
          <>
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full min-w-[1320px] text-left text-sm">
                <thead className="bg-slate-50 text-[11px] uppercase tracking-[.1em] text-slate-500">
                  <tr>
                    <th className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={selected.length === data.rows.length}
                        onChange={toggleAll}
                        aria-label="Tout sélectionner"
                      />
                    </th>
                    <th className="px-3 py-3">Produit</th>
                    <th className="px-3 py-3">Catégorie</th>
                    <th className="px-3 py-3">Marque</th>
                    <th className="px-3 py-3">Prix</th>
                    <th className="px-3 py-3">Stock disponible</th>
                    <th className="px-3 py-3">Risque stock</th>
                    <th className="px-3 py-3">Statut</th>
                    <th className="px-3 py-3">Promotion</th>
                    <th className="px-3 py-3">Mis en avant</th>
                    <th className="px-3 py-3">À traiter</th>
                    <th className="px-3 py-3">Dernière modification</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {data.rows.map((product) => (
                    <tr
                      key={product.id}
                      onClick={() => setPreview(product)}
                      className="cursor-pointer hover:bg-slate-50"
                    >
                      <td onClick={stop} className="px-4 py-3">
                        <input
                          type="checkbox"
                          checked={selected.includes(product.id)}
                          onChange={() =>
                            setSelected((current) =>
                              current.includes(product.id)
                                ? current.filter((id) => id !== product.id)
                                : [...current, product.id],
                            )
                          }
                          aria-label={`Sélectionner ${product.name}`}
                        />
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-3">
                          <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-xl border bg-white">
                            {product.primaryImageUrl ? (
                              <Image
                                src={resolveImageUrl(product.primaryImageUrl)}
                                alt=""
                                fill
                                unoptimized
                                sizes="3rem"
                                className="object-contain p-1"
                              />
                            ) : (
                              <ImageOff className="absolute inset-0 m-auto h-4 w-4 text-slate-300" />
                            )}
                          </div>
                          <div className="max-w-72">
                            <p className="line-clamp-2 font-semibold text-slate-900">
                              {product.name}
                            </p>
                            <p className="mt-1 text-xs text-slate-500">
                              SKU : {product.sku}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-3 text-xs text-slate-600">
                        {product.categories
                          .map((item) => item.title)
                          .join(", ") || "—"}
                      </td>
                      <td className="px-3 py-3">{product.brandTitle || "—"}</td>
                      <td className="px-3 py-3 font-semibold">
                        {money.format(
                          product.promotionActive
                            ? product.price
                            : product.regularPrice,
                        )}
                      </td>
                      <td className="px-3 py-3 font-semibold">
                        {product.stock}
                      </td>
                      <td className="px-3 py-3">
                        <StockRiskBadge
                          level={product.stockRisk.level}
                          days={product.stockRisk.daysOfCover}
                        />
                      </td>
                      <td className="px-3 py-3">
                        <LifecycleBadge value={product.lifecycleStatus} />
                      </td>
                      <td className="px-3 py-3">
                        {product.promotionActive ? (
                          <span className="rounded-full bg-violet-50 px-2.5 py-1 text-xs font-semibold text-violet-700">
                            -{product.discount} %
                          </span>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="px-3 py-3">
                        {product.isFeatured ? (
                          <Check className="h-4 w-4 text-emerald-600" />
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="px-3 py-3">
                        <IssueBadge issue={product.primaryIssue} />
                      </td>
                      <td className="px-3 py-3 text-xs text-slate-500">
                        {dateFormatter.format(new Date(product.updatedAt))}
                      </td>
                      <td onClick={stop} className="px-4 py-3">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setPreview(product)}
                            className="rounded-xl"
                          >
                            <Eye className="h-4 w-4" />
                            Voir
                          </Button>
                          <Popover>
                            <PopoverTrigger asChild>
                              <Button
                                variant="outline"
                                size="icon-sm"
                                className="rounded-xl"
                              >
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent
                              align="end"
                              className="w-52 rounded-2xl p-2"
                            >
                              <button
                                onClick={() => openEdit(product)}
                                className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm hover:bg-slate-50"
                              >
                                <Pencil className="h-4 w-4" />
                                Modifier
                              </button>
                              <Link
                                href={`/admin/products/${product.id}`}
                                className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm hover:bg-slate-50"
                              >
                                <Eye className="h-4 w-4" />
                                Fiche complète
                              </Link>
                              <button
                                onClick={() =>
                                  runMutation(() =>
                                    duplicateProductAction(product.id),
                                  )
                                }
                                className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm hover:bg-slate-50"
                              >
                                <Copy className="h-4 w-4" />
                                Dupliquer
                              </button>
                              {product.lifecycleStatus === "ARCHIVED" ? (
                                <button
                                  onClick={() =>
                                    runMutation(() =>
                                      restoreProductAction(product.id),
                                    )
                                  }
                                  className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm"
                                >
                                  <ArchiveRestore className="h-4 w-4" />
                                  Désarchiver
                                </button>
                              ) : (
                                <button
                                  onClick={() => setArchiveTarget(product)}
                                  className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm text-rose-600 hover:bg-rose-50"
                                >
                                  <Archive className="h-4 w-4" />
                                  Archiver
                                </button>
                              )}
                            </PopoverContent>
                          </Popover>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="divide-y divide-slate-200 md:hidden">
              {data.rows.map((product) => (
                <article
                  key={product.id}
                  onClick={() => setPreview(product)}
                  className="p-4"
                >
                  <div className="flex gap-3">
                    <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl border bg-white">
                      {product.primaryImageUrl ? (
                        <Image
                          src={resolveImageUrl(product.primaryImageUrl)}
                          alt=""
                          fill
                          unoptimized
                          className="object-contain p-1"
                        />
                      ) : (
                        <ImageOff className="absolute inset-0 m-auto h-5 w-5 text-slate-300" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex justify-between gap-2">
                        <h2 className="line-clamp-2 font-semibold">
                          {product.name}
                        </h2>
                        <input
                          onClick={stop}
                          type="checkbox"
                          checked={selected.includes(product.id)}
                          onChange={() =>
                            setSelected((current) =>
                              current.includes(product.id)
                                ? current.filter((id) => id !== product.id)
                                : [...current, product.id],
                            )
                          }
                        />
                      </div>
                      <p className="mt-1 text-xs text-slate-500">
                        {product.sku} · {product.brandTitle || "Sans marque"}
                      </p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <LifecycleBadge value={product.lifecycleStatus} />
                        <StockRiskBadge
                          level={product.stockRisk.level}
                          days={product.stockRisk.daysOfCover}
                        />
                        <IssueBadge issue={product.primaryIssue} />
                      </div>
                      <div className="mt-3 flex justify-between text-sm">
                        <strong>{money.format(product.price)}</strong>
                        <span>{product.stock} en stock</span>
                      </div>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </>
        ) : (
          <div className="px-5 py-20 text-center">
            {currentView === "action-required" ? (
              <Check className="mx-auto h-9 w-9 text-emerald-500" />
            ) : (
              <PackageSearch className="mx-auto h-9 w-9 text-slate-300" />
            )}
            <h2 className="mt-4 font-semibold">
              {currentView === "action-required"
                ? "Aucun produit à traiter"
                : "Aucun produit trouvé"}
            </h2>
            <p className="mt-2 text-sm text-slate-500">
              {currentView === "action-required"
                ? "La qualité opérationnelle du catalogue est à jour."
                : "Modifiez la recherche ou les filtres."}
            </p>
          </div>
        )}
        <footer className="flex flex-col gap-3 border-t border-slate-200 px-4 py-4 text-sm text-slate-500 sm:flex-row sm:items-center sm:justify-between">
          <p>
            Affichage de {start} à {end} sur {data.pagination.filteredCount}{" "}
            produits
          </p>
          <div className="flex items-center gap-2">
            <select
              value={data.pagination.pageSize}
              onChange={(e) => updateQuery({ pageSize: e.target.value })}
              className="h-9 rounded-xl border border-slate-200"
            >
              <option value="10">10 / page</option>
              <option value="20">20 / page</option>
              <option value="50">50 / page</option>
            </select>
            <Button
              asChild
              variant="outline"
              size="icon-sm"
              className="rounded-xl"
            >
              <Link
                href={pageHref(Math.max(1, data.pagination.currentPage - 1))}
                aria-label="Page précédente"
              >
                <ChevronLeft className="h-4 w-4" />
              </Link>
            </Button>
            <span className="rounded-xl bg-blue-900 px-3 py-1.5 text-xs font-semibold text-white">
              {data.pagination.currentPage}/{data.pagination.totalPages}
            </span>
            <Button
              asChild
              variant="outline"
              size="icon-sm"
              className="rounded-xl"
            >
              <Link
                href={pageHref(
                  Math.min(
                    data.pagination.totalPages,
                    data.pagination.currentPage + 1,
                  ),
                )}
                aria-label="Page suivante"
              >
                <ChevronRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        </footer>
      </section>

      <Dialog open={editorOpen} onOpenChange={setEditorOpen}>
        <DialogContent className="!bottom-0 !left-auto !right-0 !top-0 flex !h-dvh !w-full !max-w-2xl !translate-x-0 !translate-y-0 flex-col gap-0 !rounded-none border-y-0 border-r-0 border-l p-0">
          <DialogHeader className="border-b px-6 py-5 pr-14 sm:px-8">
            <DialogTitle>
              {editor ? "Modifier le produit" : "Ajouter un produit"}
            </DialogTitle>
            <DialogDescription>
              Les brouillons restent invisibles. Un produit actif exige un prix,
              une image et une catégorie active.
            </DialogDescription>
          </DialogHeader>
          {editorOpen ? (
            <ProductForm
              key={editor?.id || "new"}
              product={editor}
              data={data}
              onSaved={(message) => {
                setNotice(message);
                setEditorOpen(false);
                router.refresh();
              }}
            />
          ) : null}
        </DialogContent>
      </Dialog>
      <Dialog
        open={Boolean(preview)}
        onOpenChange={(open) => !open && setPreview(null)}
      >
        <DialogContent className="!bottom-0 !left-auto !right-0 !top-0 flex !h-dvh !w-full !max-w-xl !translate-x-0 !translate-y-0 flex-col gap-0 !rounded-none border-y-0 border-r-0 border-l p-0">
          <DialogHeader className="border-b px-6 py-5 pr-14 sm:px-8">
            <DialogTitle>Aperçu rapide</DialogTitle>
            <DialogDescription>
              Informations opérationnelles essentielles, sans quitter le
              catalogue.
            </DialogDescription>
          </DialogHeader>
          {preview ? (
            <QuickPreview
              product={preview}
              onEdit={() => openEdit(preview)}
              onArchive={() => setArchiveTarget(preview)}
              runMutation={runMutation}
            />
          ) : null}
        </DialogContent>
      </Dialog>
      <Dialog
        open={Boolean(archiveTarget)}
        onOpenChange={(open) => !open && setArchiveTarget(null)}
      >
        <DialogContent className="rounded-[26px] sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Archiver « {archiveTarget?.name} » ?</DialogTitle>
            <DialogDescription className="leading-6">
              Le produit ne sera plus commercialisé mais restera disponible dans
              l’administration, les commandes historiques et le registre de
              stock.
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
              onClick={() =>
                archiveTarget &&
                runMutation(() => archiveProductAction(archiveTarget.id))
              }
              className="rounded-xl bg-rose-600 text-white hover:bg-rose-700"
            >
              <Archive className="h-4 w-4" />
              Archiver
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog
        open={Boolean(pendingBulkArchive)}
        onOpenChange={(open) => !open && setPendingBulkArchive(null)}
      >
        <DialogContent className="rounded-[26px] sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Archiver {selected.length} produit(s) ?</DialogTitle>
            <DialogDescription className="leading-6">
              Ces produits ne seront plus commercialisés. Ils resteront
              disponibles dans l’administration, les commandes historiques et le
              registre de stock.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline" className="rounded-xl">
                Annuler
              </Button>
            </DialogClose>
            <Button
              disabled={bulkPending}
              onClick={() => {
                if (!pendingBulkArchive) return;
                executeBulkAction(pendingBulkArchive);
                setPendingBulkArchive(null);
              }}
              className="rounded-xl bg-rose-600 text-white hover:bg-rose-700"
            >
              <Archive className="h-4 w-4" />
              {bulkPending ? "Archivage…" : "Archiver la sélection"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
