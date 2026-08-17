"use client";

import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import Image from "next/image";
import Link from "next/link";
import {
  Archive,
  ArchiveRestore,
  Boxes,
  Check,
  ChevronDown,
  ChevronRight,
  FolderTree,
  GripVertical,
  Home,
  ImageOff,
  Info,
  Pencil,
  Plus,
  Search,
  Tags,
} from "lucide-react";
import {
  useActionState,
  useEffect,
  useMemo,
  useState,
  useTransition,
} from "react";

import {
  archiveCategoryAction,
  reorderCategoriesAction,
  restoreCategoryAction,
  saveCategoryAction,
  setCategoryFlagsAction,
  type CategoryMutationState,
} from "@/app/admin/categories/actions";
import ImageDropInput from "@/components/admin/ImageDropInput";
import HomeFeaturedCategories from "@/components/home/HomeFeaturedCategories";
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
import { cn } from "@/lib/utils";

export type CategoryManagerItem = {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  imageUrl: string | null;
  parentId: string | null;
  sortOrder: number;
  isActive: boolean;
  isFeatured: boolean;
  archivedAt: string | null;
  archivedBy: string | null;
  updatedAt: string;
  productCount: number;
  orphanRiskCount: number;
  products: Array<{ id: string; name: string }>;
};

export type CategoryManagerData = {
  metrics: {
    totalCategories: number;
    activeCategories: number;
    featuredCategories: number;
    emptyCategories: number;
    uncategorizedProducts: number;
    archivedCategories: number;
  };
  categories: CategoryManagerItem[];
  duplicateGroups: Array<Array<{ id: string; title: string }>>;
};

type Tab = "all" | "homepage" | "empty" | "archived";

const initialState: CategoryMutationState = { success: false, message: "", revision: 0 };
const numberFormatter = new Intl.NumberFormat("fr-MA");
const dateFormatter = new Intl.DateTimeFormat("fr-MA", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

function Toggle({
  checked,
  label,
  disabled,
  onChange,
}: {
  checked: boolean;
  label: string;
  disabled?: boolean;
  onChange: () => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={onChange}
      className={cn(
        "relative inline-flex h-6 w-11 items-center rounded-full transition focus-visible:outline-none focus-visible:ring-4 disabled:opacity-50",
        checked ? "bg-emerald-500 focus-visible:ring-emerald-200" : "bg-slate-300 focus-visible:ring-slate-200"
      )}
    >
      <span className={cn("h-4 w-4 rounded-full bg-white shadow transition", checked ? "translate-x-6" : "translate-x-1")} />
    </button>
  );
}

function CategoryDrawerForm({
  category,
  categories,
  onSaved,
}: {
  category: CategoryManagerItem | null;
  categories: CategoryManagerItem[];
  onSaved: (message: string) => void;
}) {
  const [state, formAction, pending] = useActionState(saveCategoryAction, initialState);
  useEffect(() => {
    if (state.success && state.revision) onSaved(state.message);
  }, [onSaved, state.message, state.revision, state.success]);

  const children = category
    ? categories.filter((item) => item.parentId === category.id && !item.archivedAt)
    : [];
  const possibleParents = categories.filter(
    (item) =>
      !item.parentId &&
      !item.archivedAt &&
      item.id !== category?.id &&
      (item.isActive || item.id === category?.parentId)
  );

  return (
    <form action={formAction} className="flex min-h-0 flex-1 flex-col">
      {category ? <input type="hidden" name="id" value={category.id} /> : null}
      <div className="flex-1 space-y-5 overflow-y-auto px-6 py-6 sm:px-8">
        {state.message && !state.success ? (
          <div role="alert" className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {state.message}
          </div>
        ) : null}
        <label className="block space-y-2 text-sm font-semibold text-slate-900">
          <span>Nom de la catégorie <span className="text-rose-500">*</span></span>
          <Input name="title" required maxLength={100} defaultValue={category?.title || ""} className="h-11 rounded-2xl border-slate-200 bg-slate-50" />
        </label>
        <label className="block space-y-2 text-sm font-semibold text-slate-900">
          <span>Catégorie parente</span>
          <select
            name="parentId"
            defaultValue={category?.parentId || ""}
            disabled={children.length > 0}
            className="h-11 w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 text-sm font-normal text-slate-700 disabled:opacity-60"
          >
            <option value="">Aucune — catégorie principale</option>
            {possibleParents.map((parent) => <option key={parent.id} value={parent.id}>{parent.title}</option>)}
          </select>
          {children.length ? <span className="block text-xs font-normal text-slate-500">Une catégorie avec des sous-catégories reste au premier niveau.</span> : null}
        </label>
        <label className="block space-y-2 text-sm font-semibold text-slate-900">
          <span>Description courte</span>
          <Textarea name="description" maxLength={500} defaultValue={category?.description || ""} className="min-h-28 rounded-2xl border-slate-200 bg-slate-50" />
        </label>
        <ImageDropInput
          id={`category-image-${category?.id || "new"}`}
          name="imageFile"
          label={category?.imageUrl ? "Remplacer l’image" : "Image de catégorie"}
          helper="Image optimisée automatiquement. Une image est recommandée pour la Homepage."
          existingImageUrls={category?.imageUrl ? [resolveImageUrl(category.imageUrl)] : []}
          maxFiles={1}
        />
        {category?.imageUrl ? (
          <label className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
            <input type="checkbox" name="removeImage" className="mt-0.5 h-4 w-4" />
            <span><strong className="block text-slate-800">Retirer l’image actuelle</strong>Le visuel sera supprimé après l’enregistrement.</span>
          </label>
        ) : null}
        <label className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
          <span><strong className="block text-sm text-slate-900">Visible sur la boutique</strong><span className="text-xs text-slate-500">Contrôle la navigation et les pages publiques.</span></span>
          <input type="checkbox" name="isActive" defaultChecked={category?.isActive ?? true} className="h-5 w-5 accent-emerald-600" />
        </label>
        <label className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
          <span><strong className="block text-sm text-slate-900">Afficher sur la Homepage</strong><span className="text-xs text-slate-500">Indépendant de la visibilité boutique.</span></span>
          <input type="checkbox" name="isFeatured" defaultChecked={category?.isFeatured ?? false} className="h-5 w-5 accent-emerald-600" />
        </label>
        {category ? (
          <div className="rounded-2xl border border-slate-200 p-4">
            <div className="flex items-center justify-between gap-3">
              <div><p className="text-sm font-semibold text-slate-900">Produits liés</p><p className="text-xs text-slate-500">{category.productCount} produit(s)</p></div>
              <Link href={`/admin/products?category=${encodeURIComponent(category.id)}`} className="text-xs font-semibold text-blue-700 hover:underline">Voir les produits →</Link>
            </div>
            {children.length ? <div className="mt-4 flex flex-wrap gap-2">{children.map((child) => <span key={child.id} className="rounded-full bg-blue-50 px-3 py-1 text-xs text-blue-700">{child.title}</span>)}</div> : null}
          </div>
        ) : null}
      </div>
      <div className="flex flex-col-reverse gap-3 border-t border-slate-200 px-6 py-4 sm:flex-row sm:justify-end sm:px-8">
        <DialogClose asChild><Button type="button" variant="outline" className="h-11 rounded-2xl px-5">Annuler</Button></DialogClose>
        <Button type="submit" disabled={pending} className="h-11 rounded-2xl bg-shop_btn_dark_green px-6 text-white hover:bg-shop_dark_green">
          {pending ? "Enregistrement…" : category ? "Enregistrer les modifications" : "Ajouter la catégorie"}
        </Button>
      </div>
    </form>
  );
}

function SortableCategory({ category, depth = 0 }: { category: CategoryManagerItem; depth?: number }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: category.id });
  return (
    <div ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition }} className={cn("flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-3 py-3", isDragging && "z-10 shadow-xl")}>
      <button type="button" {...attributes} {...listeners} className="cursor-grab touch-none text-slate-400 active:cursor-grabbing" aria-label={`Déplacer ${category.title}`}><GripVertical className="h-5 w-5" /></button>
      {depth ? <span className="text-slate-300">└</span> : <FolderTree className="h-4 w-4 text-blue-600" />}
      <span className="font-medium text-slate-800">{category.title}</span>
      <span className="ml-auto text-xs text-slate-400">{category.productCount} produit(s)</span>
    </div>
  );
}

function Organizer({ categories, onSaved }: { categories: CategoryManagerItem[]; onSaved: (message: string) => void }) {
  const initialGroups = useMemo(() => {
    const activeRows = categories.filter((category) => !category.archivedAt);
    const result = new Map<string, CategoryManagerItem[]>();
    result.set("root", activeRows.filter((item) => !item.parentId).sort((a, b) => a.sortOrder - b.sortOrder));
    for (const parent of result.get("root") || []) {
      result.set(parent.id, activeRows.filter((item) => item.parentId === parent.id).sort((a, b) => a.sortOrder - b.sortOrder));
    }
    return result;
  }, [categories]);
  const [groups, setGroups] = useState(initialGroups);
  const [pending, startTransition] = useTransition();
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );
  const findGroup = (id: string) => Array.from(groups.entries()).find(([, items]) => items.some((item) => item.id === id))?.[0];
  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    const activeGroup = findGroup(String(active.id));
    const overGroup = findGroup(String(over.id));
    if (!activeGroup || activeGroup !== overGroup) return;
    const items = groups.get(activeGroup) || [];
    setGroups(new Map(groups).set(activeGroup, arrayMove(items, items.findIndex((item) => item.id === active.id), items.findIndex((item) => item.id === over.id))));
  };
  const ordered = Array.from(groups.entries()).map(([key, items]) => ({ parentId: key === "root" ? null : key, ids: items.map((item) => item.id) }));
  const featured = (groups.get("root") || [])
    .filter((item) => item.isActive && item.isFeatured)
    .map((item) => ({ _id: item.id, title: item.title, slug: { current: item.slug }, productCount: item.productCount, image: item.imageUrl ? { _key: `${item.id}-image`, _type: "image" as const, url: item.imageUrl, asset: { _ref: item.id, _type: "reference" as const, url: item.imageUrl } } : null }));

  return (
    <div className="grid min-h-0 flex-1 gap-6 overflow-y-auto p-6 lg:grid-cols-[minmax(0,1fr)_minmax(360px,0.9fr)]">
      <div>
        <p className="text-sm text-slate-500">Glissez les lignes dans leur niveau. Le parent d’une sous-catégorie se modifie depuis sa fiche.</p>
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
          <div className="mt-5 space-y-4">
            <SortableContext items={(groups.get("root") || []).map((item) => item.id)} strategy={verticalListSortingStrategy}>
              {(groups.get("root") || []).map((parent) => (
                <div key={parent.id} className="space-y-2">
                  <SortableCategory category={parent} />
                  {(groups.get(parent.id) || []).length ? (
                    <div className="ml-8 space-y-2 border-l border-dashed border-slate-300 pl-4"><SortableContext items={(groups.get(parent.id) || []).map((item) => item.id)} strategy={verticalListSortingStrategy}>{(groups.get(parent.id) || []).map((child) => <SortableCategory key={child.id} category={child} depth={1} />)}</SortableContext></div>
                  ) : null}
                </div>
              ))}
            </SortableContext>
          </div>
        </DndContext>
        <Button disabled={pending} onClick={() => startTransition(async () => { const result = await reorderCategoriesAction(ordered); if (result.success) onSaved(result.message); })} className="mt-6 h-11 rounded-2xl bg-shop_btn_dark_green px-6 text-white">
          {pending ? "Enregistrement…" : "Enregistrer l’ordre"}
        </Button>
      </div>
      <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-5">
        <div className="flex items-center gap-2"><Home className="h-4 w-4 text-blue-600" /><h3 className="font-semibold text-slate-900">Aperçu Homepage</h3></div>
        <p className="mt-1 text-xs text-slate-500">Le vrai composant storefront, avec les catégories actives et mises en avant.</p>
        <div className="pointer-events-none mt-5 rounded-2xl bg-white p-4"><HomeFeaturedCategories categories={featured} /></div>
      </div>
    </div>
  );
}

const metricCards = [
  { key: "activeCategories", label: "Catégories actives", icon: Check, tone: "bg-emerald-50 text-emerald-700" },
  { key: "featuredCategories", label: "Sur la Homepage", icon: Home, tone: "bg-cyan-50 text-cyan-700" },
  { key: "emptyCategories", label: "Catégories vides", icon: FolderTree, tone: "bg-amber-50 text-amber-700" },
  { key: "uncategorizedProducts", label: "Produits non classés", icon: Boxes, tone: "bg-rose-50 text-rose-700" },
  { key: "archivedCategories", label: "Archivées", icon: Archive, tone: "bg-violet-50 text-violet-700" },
] as const;

export default function CategoryManager({ data }: { data: CategoryManagerData }) {
  const [tab, setTab] = useState<Tab>("all");
  const [query, setQuery] = useState("");
  const [expanded, setExpanded] = useState(() => new Set(data.categories.filter((item) => !item.parentId).map((item) => item.id)));
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerCategory, setDrawerCategory] = useState<CategoryManagerItem | null>(null);
  const [archiveTarget, setArchiveTarget] = useState<CategoryManagerItem | null>(null);
  const [organizerOpen, setOrganizerOpen] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  const roots = useMemo(() => data.categories.filter((item) => !item.parentId).sort((a, b) => a.sortOrder - b.sortOrder), [data.categories]);
  const matchesTab = (item: CategoryManagerItem) =>
    tab === "archived" ? Boolean(item.archivedAt) : !item.archivedAt && (tab === "homepage" ? item.isFeatured : tab === "empty" ? item.productCount === 0 : true);
  const normalizedQuery = query.trim().toLocaleLowerCase("fr");
  const visibleRoots = roots.filter((root) => {
    const children = data.categories.filter((item) => item.parentId === root.id);
    const queryMatches = !normalizedQuery || root.title.toLocaleLowerCase("fr").includes(normalizedQuery) || children.some((child) => child.title.toLocaleLowerCase("fr").includes(normalizedQuery));
    return queryMatches && (matchesTab(root) || children.some(matchesTab));
  });
  const runMutation = (task: () => Promise<CategoryMutationState>) => startTransition(async () => {
    setError("");
    const result = await task();
    if (result.success) { setNotice(result.message); window.location.reload(); }
    else setError(result.message);
  });

  const renderRow = (category: CategoryManagerItem, depth = 0) => (
    <tr key={category.id} className="border-t border-slate-200 hover:bg-slate-50/70">
      <td className="px-4 py-3">
        <div className={cn("flex items-center gap-3", depth && "pl-8")}>
          {!depth && data.categories.some((item) => item.parentId === category.id && matchesTab(item)) ? (
            <button type="button" onClick={() => setExpanded((current) => { const next = new Set(current); if (next.has(category.id)) next.delete(category.id); else next.add(category.id); return next; })} className="text-slate-400" aria-label={`${expanded.has(category.id) ? "Réduire" : "Développer"} ${category.title}`}>
              {expanded.has(category.id) ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            </button>
          ) : <span className="w-4 text-slate-300">{depth ? "└" : ""}</span>}
          <div className="relative h-10 w-12 shrink-0 overflow-hidden rounded-xl border border-slate-200 bg-white">
            {category.imageUrl ? <Image src={resolveImageUrl(category.imageUrl)} alt="" fill unoptimized sizes="3rem" className="object-contain p-1" /> : <ImageOff className="absolute inset-0 m-auto h-4 w-4 text-slate-300" />}
          </div>
          <div><p className="font-semibold text-slate-900">{category.title}</p><p className="max-w-sm truncate text-xs text-slate-500">{category.description || (depth ? "Sous-catégorie" : "Catégorie principale")}</p></div>
        </div>
      </td>
      <td className="px-4 py-3"><Link href={`/admin/products?category=${encodeURIComponent(category.id)}`} className="font-semibold text-blue-700 hover:underline">{category.productCount} produit(s)</Link></td>
      <td className="px-4 py-3"><Toggle checked={category.isActive} disabled={Boolean(category.archivedAt) || pending} label={`Visibilité de ${category.title}`} onChange={() => runMutation(() => setCategoryFlagsAction(category.id, { isActive: !category.isActive }))} /></td>
      <td className="px-4 py-3"><Toggle checked={category.isFeatured} disabled={Boolean(category.archivedAt) || pending} label={`Homepage de ${category.title}`} onChange={() => runMutation(() => setCategoryFlagsAction(category.id, { isFeatured: !category.isFeatured }))} /></td>
      <td className="px-4 py-3 text-xs text-slate-500">{dateFormatter.format(new Date(category.updatedAt))}</td>
      <td className="px-4 py-3"><div className="flex justify-end gap-2">
        {category.archivedAt ? (category.archivedBy?.startsWith("system:commercial-collection") ? <span className="rounded-full bg-violet-50 px-3 py-1.5 text-xs font-semibold text-violet-700">Collection automatique</span> : <Button variant="outline" size="sm" onClick={() => runMutation(() => restoreCategoryAction(category.id))} className="rounded-xl"><ArchiveRestore className="h-4 w-4" />Désarchiver</Button>) : <>
          <Button variant="outline" size="icon-sm" onClick={() => { setDrawerCategory(category); setDrawerOpen(true); }} className="rounded-xl" aria-label={`Modifier ${category.title}`}><Pencil className="h-4 w-4" /></Button>
          <Button variant="outline" size="icon-sm" onClick={() => setArchiveTarget(category)} className="rounded-xl text-rose-600" aria-label={`Archiver ${category.title}`}><Archive className="h-4 w-4" /></Button>
        </>}
      </div></td>
    </tr>
  );

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
        <div><div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-400"><Tags className="h-4 w-4" />Catalogue</div><h1 className="mt-2 text-3xl font-semibold text-slate-950">Catégories</h1><p className="mt-2 text-sm text-slate-600">Structurez le catalogue en deux niveaux, contrôlez sa visibilité et consultez les produits associés.</p></div>
        <div className="flex gap-2"><Button variant="outline" onClick={() => setOrganizerOpen(true)} className="h-11 rounded-2xl"><GripVertical className="h-4 w-4" />Organiser</Button><Button onClick={() => { setDrawerCategory(null); setDrawerOpen(true); }} className="h-11 rounded-2xl bg-shop_btn_dark_green px-5 text-white"><Plus className="h-4 w-4" />Ajouter une catégorie</Button></div>
      </header>
      {notice ? <div role="status" className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{notice}</div> : null}
      {error ? <div role="alert" className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{error}</div> : null}
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">{metricCards.map(({ key, label, icon: Icon, tone }) => <button type="button" key={key} onClick={() => { if (key === "featuredCategories") setTab("homepage"); else if (key === "emptyCategories") setTab("empty"); else if (key === "archivedCategories") setTab("archived"); }} className="rounded-[24px] border border-white/80 bg-white/95 p-4 text-left shadow-[0_20px_55px_-44px_rgba(15,23,42,.4)]"><div className="flex justify-between"><div><p className="text-xs font-semibold text-slate-500">{label}</p><p className="mt-2 text-2xl font-semibold text-slate-950">{numberFormatter.format(data.metrics[key])}</p></div><span className={cn("flex h-10 w-10 items-center justify-center rounded-2xl", tone)}><Icon className="h-4 w-4" /></span></div></button>)}</section>
      <section className="overflow-hidden rounded-[28px] border border-white/80 bg-white/95 shadow-[0_26px_80px_-56px_rgba(15,23,42,.42)]">
        <div className="flex flex-col gap-3 border-b border-slate-200 p-4 lg:flex-row lg:items-center lg:justify-between"><div className="flex flex-wrap gap-1">{([['all','Toutes',data.metrics.totalCategories],['homepage','Homepage',data.metrics.featuredCategories],['empty','Vides',data.metrics.emptyCategories],['archived','Archivées',data.metrics.archivedCategories]] as const).map(([value,label,count]) => <button key={value} type="button" onClick={() => setTab(value)} className={cn("rounded-xl px-3 py-2 text-sm font-semibold", tab === value ? "bg-blue-50 text-blue-800" : "text-slate-500 hover:bg-slate-50")}>{label} <span className="ml-1 rounded-full bg-white px-2 py-0.5 text-xs">{count}</span></button>)}</div><div className="relative w-full lg:max-w-sm"><Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Rechercher une catégorie…" className="h-11 rounded-2xl border-slate-200 bg-slate-50 pl-11" /></div></div>
        {visibleRoots.length ? <div className="overflow-x-auto"><table className="w-full min-w-[940px] text-left text-sm"><thead className="bg-slate-50/80 text-[11px] uppercase tracking-[.12em] text-slate-500"><tr><th className="px-4 py-3">Catégorie</th><th className="px-4 py-3">Produits</th><th className="px-4 py-3">Active</th><th className="px-4 py-3">Homepage</th><th className="px-4 py-3">Mise à jour</th><th className="px-4 py-3 text-right">Actions</th></tr></thead><tbody>{visibleRoots.flatMap((root) => { const children = data.categories.filter((item) => item.parentId === root.id && matchesTab(item) && (!normalizedQuery || root.title.toLowerCase().includes(normalizedQuery) || item.title.toLowerCase().includes(normalizedQuery))).sort((a,b) => a.sortOrder-b.sortOrder); const rows = [renderRow(root)]; if (expanded.has(root.id) || normalizedQuery) rows.push(...children.map((child) => renderRow(child,1))); return rows; })}</tbody></table></div> : <div className="px-5 py-16 text-center"><FolderTree className="mx-auto h-8 w-8 text-slate-300" /><p className="mt-4 font-semibold">Aucune catégorie trouvée</p><p className="mt-2 text-sm text-slate-500">Modifiez l’onglet ou la recherche.</p></div>}
      </section>
      <section className="rounded-[24px] border border-blue-200 bg-blue-50/60 p-4 text-sm text-blue-900"><div className="flex gap-3"><Info className="mt-0.5 h-5 w-5 shrink-0" /><div><p className="font-semibold">Promotions, Best sellers et Nouveautés sont des collections automatiques.</p><p className="mt-1 text-xs leading-5 text-blue-700">Elles reposent sur les prix, les dates et les ventes réelles. Les anciennes catégories commerciales ont été archivées et leurs associations historiques conservées.</p>{data.duplicateGroups.length ? <p className="mt-2 text-xs font-semibold text-violet-700">Doublons potentiels à vérifier : {data.duplicateGroups.map((group) => group.map((item) => item.title).join(" / ")).join(" · ")}</p> : null}</div></div></section>

      <Dialog open={drawerOpen} onOpenChange={setDrawerOpen}><DialogContent className="!bottom-0 !left-auto !right-0 !top-0 flex !h-dvh !w-full !max-w-xl !translate-x-0 !translate-y-0 flex-col gap-0 !rounded-none border-y-0 border-r-0 border-l border-slate-200 p-0"><DialogHeader className="border-b border-slate-200 px-6 py-5 pr-14 sm:px-8"><DialogTitle>{drawerCategory ? `Modifier — ${drawerCategory.title}` : "Ajouter une catégorie"}</DialogTitle><DialogDescription>La hiérarchie est limitée à une catégorie principale et une sous-catégorie.</DialogDescription></DialogHeader>{drawerOpen ? <CategoryDrawerForm key={drawerCategory?.id || "new"} category={drawerCategory} categories={data.categories} onSaved={(message) => { setNotice(message); setDrawerOpen(false); window.location.reload(); }} /> : null}</DialogContent></Dialog>
      <Dialog open={Boolean(archiveTarget)} onOpenChange={(open) => !open && setArchiveTarget(null)}><DialogContent className="rounded-[26px] sm:max-w-md"><DialogHeader><DialogTitle>Archiver « {archiveTarget?.title} » ?</DialogTitle><DialogDescription className="leading-6">La catégorie ne sera plus visible. Ses associations produits restent intactes{archiveTarget && data.categories.some((item) => item.parentId === archiveTarget.id && !item.archivedAt) ? " et ses sous-catégories seront archivées avec elle" : ""}.</DialogDescription></DialogHeader>{archiveTarget?.orphanRiskCount ? <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800"><strong>{archiveTarget.orphanRiskCount} produit(s)</strong> n’auront plus d’autre catégorie active après cette opération.</div> : <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">Tous les produits concernés gardent une autre catégorie active.</div>}<DialogFooter><DialogClose asChild><Button variant="outline" className="rounded-xl">Annuler</Button></DialogClose><Button onClick={() => archiveTarget && runMutation(() => archiveCategoryAction(archiveTarget.id))} disabled={pending} className="rounded-xl bg-rose-600 text-white hover:bg-rose-700"><Archive className="h-4 w-4" />Archiver</Button></DialogFooter></DialogContent></Dialog>
      <Dialog open={organizerOpen} onOpenChange={setOrganizerOpen}><DialogContent className="flex max-h-[92vh] !w-[min(1180px,calc(100%-2rem))] !max-w-none flex-col gap-0 overflow-hidden rounded-[28px] p-0"><DialogHeader className="border-b border-slate-200 px-6 py-5 pr-14"><DialogTitle>Organiser les catégories</DialogTitle><DialogDescription>L’ordre est enregistré directement dans le catalogue. La publication de la Homepage reste gérée dans son éditeur.</DialogDescription></DialogHeader>{organizerOpen ? <Organizer categories={data.categories} onSaved={(message) => { setNotice(message); setOrganizerOpen(false); window.location.reload(); }} /> : null}</DialogContent></Dialog>
    </div>
  );
}
