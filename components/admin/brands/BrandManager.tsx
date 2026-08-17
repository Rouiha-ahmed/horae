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
  CircleOff,
  ImageOff,
  MoreHorizontal,
  PackageSearch,
  Pencil,
  Plus,
  Search,
  Store,
  Tags,
} from "lucide-react";
import {
  useActionState,
  useEffect,
  useState,
  useTransition,
  type FormEvent,
} from "react";

import {
  archiveBrandAction,
  saveBrandAction,
  setBrandActiveAction,
  unarchiveBrandAction,
  type BrandMutationState,
} from "@/app/admin/actions";
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
import { cn } from "@/lib/utils";

export type BrandManagerBrand = {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  imageUrl: string | null;
  isActive: boolean;
  archivedAt: string | null;
  archivedBy: string | null;
  updatedAt: string;
  productCount: number;
  products: Array<{ id: string; name: string }>;
};

export type BrandManagerData = {
  metrics: {
    totalBrands: number;
    activeBrands: number;
    brandsWithoutProducts: number;
    brandsWithoutLogo: number;
    brandlessProducts: number;
    archivedBrands: number;
  };
  brands: BrandManagerBrand[];
  duplicateGroups: Array<Array<{ id: string; title: string }>>;
  pagination: {
    currentPage: number;
    totalPages: number;
    pageSize: number;
    filteredCount: number;
  };
  filters: {
    query: string;
    status: "all" | "active" | "inactive" | "archived";
    association: "all" | "with-products" | "without-products";
    sort: "a-z" | "z-a";
  };
};

type BrandManagerProps = {
  data: BrandManagerData;
  statusMessage?: string;
  errorMessage?: string;
};

const initialMutationState: BrandMutationState = {
  success: false,
  message: "",
  revision: 0,
};

const dateFormatter = new Intl.DateTimeFormat("fr-MA", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

const numberFormatter = new Intl.NumberFormat("fr-MA");

const selectClassName =
  "h-11 rounded-2xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none transition focus:border-shop_btn_dark_green focus:ring-4 focus:ring-shop_light_green/15";

const productLabel = (count: number) => `${count} ${count === 1 ? "produit" : "produits"}`;

function BrandLogo({ brand, size = "md" }: { brand: BrandManagerBrand; size?: "sm" | "md" }) {
  const dimension = size === "sm" ? "h-12 w-16 rounded-xl" : "h-16 w-20 rounded-2xl";

  return (
    <div
      className={cn(
        "relative shrink-0 overflow-hidden border border-slate-200 bg-white",
        dimension
      )}
    >
      {brand.imageUrl ? (
        <Image
          src={resolveImageUrl(brand.imageUrl)}
          alt={`Logo ${brand.title}`}
          fill
          unoptimized
          sizes={size === "sm" ? "4rem" : "5rem"}
          className="object-contain p-2"
        />
      ) : (
        <span className="flex h-full w-full items-center justify-center text-slate-300">
          <ImageOff className="h-5 w-5" />
        </span>
      )}
    </div>
  );
}

function BrandStatus({ brand }: { brand: BrandManagerBrand }) {
  if (brand.archivedAt) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600 ring-1 ring-inset ring-slate-200">
        <span className="h-1.5 w-1.5 rounded-full bg-slate-400" />
        Archivée
      </span>
    );
  }

  return brand.isActive ? (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 ring-1 ring-inset ring-emerald-200">
      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
      Active
    </span>
  ) : (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700 ring-1 ring-inset ring-amber-200">
      <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
      Inactive
    </span>
  );
}

function BrandDrawerForm({
  brand,
  onSaved,
}: {
  brand: BrandManagerBrand | null;
  onSaved: (message: string) => void;
}) {
  const [state, formAction, pending] = useActionState(
    saveBrandAction,
    initialMutationState
  );

  useEffect(() => {
    if (state.success && state.revision > 0) {
      onSaved(state.message);
    }
  }, [onSaved, state.message, state.revision, state.success]);

  return (
    <form action={formAction} className="flex min-h-0 flex-1 flex-col">
      {brand ? <input type="hidden" name="id" value={brand.id} /> : null}

      <div className="flex-1 space-y-6 overflow-y-auto px-6 py-6 sm:px-8">
        {state.message && !state.success ? (
          <div role="alert" className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {state.message}
          </div>
        ) : null}

        <label className="block space-y-2 text-sm font-semibold text-slate-900">
          <span>
            Nom de la marque <span className="text-rose-500">*</span>
          </span>
          <Input
            name="title"
            required
            maxLength={100}
            defaultValue={brand?.title || ""}
            placeholder="Ex : Vichy"
            className="h-11 rounded-2xl border-slate-200 bg-slate-50"
          />
        </label>

        <label className="block space-y-2 text-sm font-semibold text-slate-900">
          <span>Description</span>
          <Textarea
            name="description"
            maxLength={500}
            defaultValue={brand?.description || ""}
            placeholder="Courte présentation de la marque."
            className="min-h-28 rounded-2xl border-slate-200 bg-slate-50"
          />
          <span className="block text-xs font-normal text-slate-500">
            Facultatif · 500 caractères maximum.
          </span>
        </label>

        <ImageDropInput
          id={`brand-image-${brand?.id || "new"}`}
          name="imageFile"
          label={brand?.imageUrl ? "Remplacer le logo" : "Logo de la marque"}
          helper="Le logo est contrôlé puis optimisé automatiquement. Un fond transparent est recommandé."
          accept="image/png,image/jpeg,image/webp"
          maxSizeMb={2}
          formatLabel="PNG, JPG ou WebP"
          existingImageUrls={brand?.imageUrl ? [resolveImageUrl(brand.imageUrl)] : []}
          maxFiles={1}
        />

        {brand?.imageUrl ? (
          <label className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
            <input
              type="checkbox"
              name="removeImage"
              className="mt-0.5 h-4 w-4 rounded border-slate-300 text-shop_btn_dark_green"
            />
            <span>
              <strong className="block font-semibold text-slate-800">Retirer le logo actuel</strong>
              Le logo sera supprimé seulement après l&apos;enregistrement.
            </span>
          </label>
        ) : null}

        <label className="flex items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
          <span>
            <strong className="block text-sm text-slate-900">Visible sur la boutique</strong>
            <span className="mt-1 block text-xs leading-5 text-slate-500">
              Ce statut est indépendant du nombre de produits et de la Homepage.
            </span>
          </span>
          <span className="relative inline-flex shrink-0 items-center">
            <input
              type="checkbox"
              name="isActive"
              defaultChecked={brand?.isActive ?? true}
              className="peer sr-only"
            />
            <span className="h-6 w-11 rounded-full bg-slate-300 transition peer-checked:bg-emerald-500 peer-focus-visible:ring-4 peer-focus-visible:ring-emerald-200" />
            <span className="absolute left-1 h-4 w-4 rounded-full bg-white shadow transition peer-checked:translate-x-5" />
          </span>
        </label>

        {brand ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-slate-900">Produits associés</p>
                <p className="mt-1 text-xs text-slate-500">{productLabel(brand.productCount)}</p>
              </div>
              <Link
                href={`/admin/products?brand=${encodeURIComponent(brand.id)}`}
                className="text-xs font-semibold text-shop_btn_dark_green hover:underline"
              >
                Voir tous les produits →
              </Link>
            </div>
            {brand.products.length ? (
              <ul className="mt-4 divide-y divide-slate-100 text-sm text-slate-600">
                {brand.products.map((product) => (
                  <li key={product.id} className="py-2.5">
                    {product.name}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-4 rounded-xl bg-slate-50 px-3 py-3 text-xs text-slate-500">
                Aucun produit associé pour le moment.
              </p>
            )}
          </div>
        ) : null}
      </div>

      <div className="flex flex-col-reverse gap-3 border-t border-slate-200 bg-white px-6 py-4 sm:flex-row sm:justify-end sm:px-8">
        <DialogClose asChild>
          <Button type="button" variant="outline" className="h-11 rounded-2xl px-5">
            Annuler
          </Button>
        </DialogClose>
        <Button
          type="submit"
          disabled={pending}
          className="h-11 rounded-2xl bg-shop_btn_dark_green px-6 text-white hover:bg-shop_dark_green"
        >
          {pending
            ? "Enregistrement…"
            : brand
              ? "Enregistrer les modifications"
              : "Ajouter la marque"}
        </Button>
      </div>
    </form>
  );
}

function BrandActions({
  brand,
  onEdit,
  onArchive,
}: {
  brand: BrandManagerBrand;
  onEdit: () => void;
  onArchive: () => void;
}) {
  return (
    <div className="flex items-center justify-end gap-2">
      {!brand.archivedAt ? (
        <Button
          type="button"
          variant="outline"
          size="icon-sm"
          onClick={onEdit}
          aria-label={`Modifier ${brand.title}`}
          className="rounded-xl border-slate-200 bg-white text-slate-600"
        >
          <Pencil className="h-4 w-4" />
        </Button>
      ) : null}

      <Popover>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            size="icon-sm"
            aria-label={`Actions pour ${brand.title}`}
            className="rounded-xl border-slate-200 bg-white text-slate-600"
          >
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-56 rounded-2xl border-slate-200 p-2 shadow-xl">
          <Link
            href={`/admin/products?brand=${encodeURIComponent(brand.id)}`}
            className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-slate-700 hover:bg-slate-50"
          >
            <Boxes className="h-4 w-4" />
            Voir les produits
          </Link>

          {brand.archivedAt ? (
            <form action={unarchiveBrandAction}>
              <input type="hidden" name="id" value={brand.id} />
              <button
                type="submit"
                className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm text-slate-700 hover:bg-slate-50"
              >
                <ArchiveRestore className="h-4 w-4" />
                Désarchiver
              </button>
            </form>
          ) : (
            <>
              <form action={setBrandActiveAction}>
                <input type="hidden" name="id" value={brand.id} />
                <input type="hidden" name="isActive" value={brand.isActive ? "false" : "true"} />
                <button
                  type="submit"
                  className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm text-slate-700 hover:bg-slate-50"
                >
                  {brand.isActive ? <CircleOff className="h-4 w-4" /> : <Check className="h-4 w-4" />}
                  {brand.isActive ? "Désactiver" : "Activer"}
                </button>
              </form>
              <button
                type="button"
                onClick={onArchive}
                className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm text-rose-600 hover:bg-rose-50"
              >
                <Archive className="h-4 w-4" />
                Archiver
              </button>
            </>
          )}
        </PopoverContent>
      </Popover>
    </div>
  );
}

const metricCards = [
  { key: "totalBrands", label: "Toutes les marques", helper: "Dans le catalogue", icon: Tags, tone: "bg-cyan-50 text-cyan-700 ring-cyan-200" },
  { key: "activeBrands", label: "Marques actives", helper: "Visibles et utilisables", icon: Check, tone: "bg-emerald-50 text-emerald-700 ring-emerald-200" },
  { key: "brandsWithoutProducts", label: "Marques sans produit", helper: "À compléter", icon: PackageSearch, tone: "bg-amber-50 text-amber-700 ring-amber-200" },
  { key: "brandsWithoutLogo", label: "Marques sans logo", helper: "Identité visuelle manquante", icon: ImageOff, tone: "bg-violet-50 text-violet-700 ring-violet-200" },
  { key: "brandlessProducts", label: "Produits sans marque", helper: "À associer", icon: Boxes, tone: "bg-rose-50 text-rose-700 ring-rose-200" },
] as const;

export default function BrandManager({ data, statusMessage, errorMessage }: BrandManagerProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pendingNavigation, startTransition] = useTransition();
  const [searchValue, setSearchValue] = useState(data.filters.query);
  const [drawerBrand, setDrawerBrand] = useState<BrandManagerBrand | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(searchParams.get("drawer") === "create");
  const [archiveTarget, setArchiveTarget] = useState<BrandManagerBrand | null>(null);
  const [notice, setNotice] = useState("");

  const updateQuery = (updates: Record<string, string | null>) => {
    const next = new URLSearchParams(searchParams.toString());
    next.delete("status");
    next.delete("error");
    next.delete("page");

    for (const [key, value] of Object.entries(updates)) {
      if (!value || value === "all" || value === "a-z") {
        next.delete(key);
      } else {
        next.set(key, value);
      }
    }

    startTransition(() => router.push(`${pathname}${next.size ? `?${next}` : ""}`));
  };

  const handleSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    updateQuery({ q: searchValue.trim() || null });
  };

  const openCreate = () => {
    setDrawerBrand(null);
    setDrawerOpen(true);
  };

  const openEdit = (brand: BrandManagerBrand) => {
    setDrawerBrand(brand);
    setDrawerOpen(true);
  };

  const pageHref = (page: number) => {
    const next = new URLSearchParams(searchParams.toString());
    next.delete("status");
    next.delete("error");
    if (page <= 1) next.delete("page");
    else next.set("page", String(page));
    return `${pathname}${next.size ? `?${next}` : ""}`;
  };

  const start = data.pagination.filteredCount
    ? (data.pagination.currentPage - 1) * data.pagination.pageSize + 1
    : 0;
  const end = Math.min(
    data.pagination.currentPage * data.pagination.pageSize,
    data.pagination.filteredCount
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
            <Store className="h-4 w-4" /> Catalogue
          </div>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">Marques</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
            Gérez les marques du catalogue, leur disponibilité, leurs logos et les produits associés.
          </p>
        </div>
        <Button
          id="new-brand"
          type="button"
          onClick={openCreate}
          className="h-11 rounded-2xl bg-shop_btn_dark_green px-5 text-white shadow-sm hover:bg-shop_dark_green"
        >
          <Plus className="h-4 w-4" />
          Ajouter une marque
        </Button>
      </div>

      {statusMessage || notice ? (
        <div role="status" className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          {notice || statusMessage}
        </div>
      ) : null}
      {errorMessage ? (
        <div role="alert" className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          {errorMessage}
        </div>
      ) : null}

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {metricCards.map(({ key, label, helper, icon: Icon, tone }) => (
          <div key={key} className="rounded-[24px] border border-white/80 bg-white/95 p-4 shadow-[0_20px_55px_-44px_rgba(15,23,42,0.4)]">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold text-slate-500">{label}</p>
                <p className="mt-2 text-2xl font-semibold text-slate-950">
                  {numberFormatter.format(data.metrics[key])}
                </p>
              </div>
              <span className={cn("flex h-10 w-10 items-center justify-center rounded-2xl ring-1 ring-inset", tone)}>
                <Icon className="h-4 w-4" />
              </span>
            </div>
            <p className="mt-2 text-xs text-slate-500">{helper}</p>
          </div>
        ))}
      </section>

      <section className="overflow-hidden rounded-[28px] border border-white/80 bg-white/95 shadow-[0_26px_80px_-56px_rgba(15,23,42,0.42)]">
        <div className="flex flex-col gap-3 border-b border-slate-200 p-4 lg:flex-row lg:items-center">
          <form onSubmit={handleSearch} className="relative min-w-0 flex-1 lg:max-w-xl">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              value={searchValue}
              onChange={(event) => setSearchValue(event.target.value)}
              placeholder="Rechercher une marque..."
              aria-label="Rechercher une marque"
              className="h-11 rounded-2xl border-slate-200 bg-slate-50 pl-11 pr-20"
            />
            <button type="submit" className="absolute right-2 top-1/2 -translate-y-1/2 rounded-xl px-3 py-1.5 text-xs font-semibold text-shop_btn_dark_green hover:bg-white">
              Chercher
            </button>
          </form>
          <select
            value={data.filters.status}
            onChange={(event) => updateQuery({ brandStatus: event.target.value })}
            className={selectClassName}
            aria-label="Filtrer par statut"
          >
            <option value="all">Statut : Tous</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
            <option value="archived">Archivée</option>
          </select>
          <select
            value={data.filters.association}
            onChange={(event) => updateQuery({ association: event.target.value })}
            className={selectClassName}
            aria-label="Filtrer par association produit"
          >
            <option value="all">Tous les produits</option>
            <option value="with-products">Avec produits</option>
            <option value="without-products">Sans produit</option>
          </select>
          <select
            value={data.filters.sort}
            onChange={(event) => updateQuery({ sort: event.target.value })}
            className={selectClassName}
            aria-label="Trier les marques"
          >
            <option value="a-z">Nom A-Z</option>
            <option value="z-a">Nom Z-A</option>
          </select>
        </div>

        {pendingNavigation ? (
          <div className="h-1 animate-pulse bg-shop_light_green" />
        ) : null}

        {data.brands.length ? (
          <>
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full min-w-[860px] text-left text-sm">
                <thead className="border-b border-slate-200 bg-slate-50/80 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                  <tr>
                    <th className="px-5 py-3.5">Marque</th>
                    <th className="px-4 py-3.5">Produits</th>
                    <th className="px-4 py-3.5">Statut</th>
                    <th className="px-4 py-3.5">Dernière modification</th>
                    <th className="px-5 py-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {data.brands.map((brand) => (
                    <tr key={brand.id} className="transition hover:bg-slate-50/70">
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-3">
                          <BrandLogo brand={brand} size="sm" />
                          <div className="min-w-0">
                            <p className="font-semibold text-slate-900">{brand.title}</p>
                            {brand.description ? (
                              <p className="mt-1 max-w-md truncate text-xs text-slate-500">{brand.description}</p>
                            ) : (
                              <p className="mt-1 text-xs text-slate-400">Sans description</p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <Link href={`/admin/products?brand=${encodeURIComponent(brand.id)}`} className="font-semibold text-blue-700 hover:underline">
                          {productLabel(brand.productCount)}
                        </Link>
                      </td>
                      <td className="px-4 py-3"><BrandStatus brand={brand} /></td>
                      <td className="px-4 py-3 text-sm text-slate-600">
                        {dateFormatter.format(new Date(brand.updatedAt))}
                      </td>
                      <td className="px-5 py-3"><BrandActions brand={brand} onEdit={() => openEdit(brand)} onArchive={() => setArchiveTarget(brand)} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="divide-y divide-slate-200 md:hidden">
              {data.brands.map((brand) => (
                <article key={brand.id} className="p-4">
                  <div className="flex items-start gap-3">
                    <BrandLogo brand={brand} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <h2 className="font-semibold text-slate-900">{brand.title}</h2>
                          <div className="mt-1"><BrandStatus brand={brand} /></div>
                        </div>
                        <BrandActions brand={brand} onEdit={() => openEdit(brand)} onArchive={() => setArchiveTarget(brand)} />
                      </div>
                      <Link href={`/admin/products?brand=${encodeURIComponent(brand.id)}`} className="mt-3 inline-block text-sm font-semibold text-blue-700 hover:underline">
                        {productLabel(brand.productCount)}
                      </Link>
                      <p className="mt-2 line-clamp-2 text-xs leading-5 text-slate-500">{brand.description || "Aucune description."}</p>
                      <p className="mt-2 text-[11px] text-slate-400">Mise à jour {dateFormatter.format(new Date(brand.updatedAt))}</p>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </>
        ) : (
          <div className="px-5 py-16 text-center">
            <Store className="mx-auto h-8 w-8 text-slate-300" />
            <p className="mt-4 font-semibold text-slate-900">Aucune marque trouvée</p>
            <p className="mt-2 text-sm text-slate-500">Modifiez la recherche ou les filtres actifs.</p>
          </div>
        )}

        <div className="flex flex-col gap-3 border-t border-slate-200 px-5 py-4 text-sm text-slate-500 sm:flex-row sm:items-center sm:justify-between">
          <p>Affichage de {start} à {end} sur {data.pagination.filteredCount} marques</p>
          <div className="flex items-center gap-2">
            <Button asChild variant="outline" size="icon-sm" className="rounded-xl" disabled={data.pagination.currentPage <= 1}>
              <Link href={pageHref(Math.max(1, data.pagination.currentPage - 1))} aria-label="Page précédente" aria-disabled={data.pagination.currentPage <= 1}>
                <ChevronLeft className="h-4 w-4" />
              </Link>
            </Button>
            <span className="rounded-xl bg-shop_btn_dark_green px-3 py-1.5 text-xs font-semibold text-white">
              {data.pagination.currentPage} / {data.pagination.totalPages}
            </span>
            <Button asChild variant="outline" size="icon-sm" className="rounded-xl" disabled={data.pagination.currentPage >= data.pagination.totalPages}>
              <Link href={pageHref(Math.min(data.pagination.totalPages, data.pagination.currentPage + 1))} aria-label="Page suivante" aria-disabled={data.pagination.currentPage >= data.pagination.totalPages}>
                <ChevronRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
      </section>

      <section className="rounded-[26px] border border-white/80 bg-white/90 p-5 shadow-[0_24px_70px_-56px_rgba(15,23,42,0.42)]">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-semibold text-slate-900">Qualité du catalogue</h2>
            <p className="mt-1 text-xs text-slate-500">Anomalies calculées directement depuis les associations actuelles.</p>
          </div>
          <span className="text-xs font-medium text-slate-500">{data.metrics.archivedBrands} marque(s) archivée(s)</span>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-800"><strong>{data.metrics.brandsWithoutLogo}</strong> marque(s) sans logo</div>
          <div className="rounded-2xl bg-orange-50 px-4 py-3 text-sm text-orange-800"><strong>{data.metrics.brandsWithoutProducts}</strong> marque(s) sans produit</div>
          <Link href="/admin/products?brand=unassigned" className="rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-800 hover:ring-1 hover:ring-rose-200"><strong>{data.metrics.brandlessProducts}</strong> produit(s) sans marque</Link>
          <div className="rounded-2xl bg-violet-50 px-4 py-3 text-sm text-violet-800"><strong>{data.duplicateGroups.length}</strong> doublon(s) potentiel(s)</div>
        </div>
        {data.duplicateGroups.length ? (
          <div className="mt-3 rounded-2xl border border-violet-100 bg-violet-50/50 px-4 py-3 text-xs text-violet-800">
            À vérifier : {data.duplicateGroups.map((group) => group.map((brand) => brand.title).join(" / ")).join(" · ")}. Aucune fusion automatique n&apos;est effectuée.
          </div>
        ) : null}
      </section>

      <Dialog open={drawerOpen} onOpenChange={setDrawerOpen}>
        <DialogContent
          showCloseButton
          className="!bottom-0 !left-auto !right-0 !top-0 flex !h-dvh !w-full !max-w-xl !translate-x-0 !translate-y-0 flex-col gap-0 !rounded-none border-y-0 border-r-0 border-l border-slate-200 bg-white p-0 sm:!max-w-xl"
        >
          <DialogHeader className="border-b border-slate-200 px-6 py-5 pr-14 text-left sm:px-8">
            <DialogTitle className="text-xl text-slate-950">{drawerBrand ? "Modifier la marque" : "Ajouter une marque"}</DialogTitle>
            <DialogDescription>
              {drawerBrand ? "Mettez à jour les informations sans toucher aux associations produits." : "Créez une marque disponible pour le catalogue."}
            </DialogDescription>
          </DialogHeader>
          {drawerOpen ? (
            <BrandDrawerForm
              key={drawerBrand?.id || "new"}
              brand={drawerBrand}
              onSaved={(message) => {
                setNotice(message);
                setDrawerOpen(false);
                router.refresh();
              }}
            />
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(archiveTarget)} onOpenChange={(open) => !open && setArchiveTarget(null)}>
        <DialogContent className="rounded-[26px] border-slate-200 sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Archiver la marque ?</DialogTitle>
            <DialogDescription className="leading-6">
              {archiveTarget?.title} ne sera plus disponible pour de nouvelles associations. Ses {archiveTarget ? productLabel(archiveTarget.productCount) : "produits"} resteront intacts.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-3">
            <DialogClose asChild><Button type="button" variant="outline" className="rounded-xl">Annuler</Button></DialogClose>
            {archiveTarget ? (
              <form action={archiveBrandAction}>
                <input type="hidden" name="id" value={archiveTarget.id} />
                <Button type="submit" className="rounded-xl bg-rose-600 text-white hover:bg-rose-700">
                  <Archive className="h-4 w-4" /> Archiver la marque
                </Button>
              </form>
            ) : null}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
