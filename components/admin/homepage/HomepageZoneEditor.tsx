"use client";

import Image from "next/image";
import { useMemo, useState, useTransition } from "react";
import {
  Archive,
  Check,
  ChevronDown,
  ChevronUp,
  Copy,
  ImagePlus,
  Loader2,
  Plus,
  Search,
  X,
} from "lucide-react";

import {
  searchHomepageProductsAction,
  uploadHomepageImageAction,
} from "@/app/admin/homepage/actions";
import type {
  HomepageDraftHeroSlide,
  HomepageDraftSection,
  HomepageEditorData,
  HomepageWorkspaceSnapshot,
} from "@/lib/homepage-workspace";
import { cn } from "@/lib/utils";

const inputClass =
  "h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100";
const textareaClass = `${inputClass} h-auto min-h-24 py-3`;

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-xs font-semibold text-slate-700">{label}</span>
      {children}
      {hint ? <span className="block text-[11px] leading-4 text-slate-400">{hint}</span> : null}
    </label>
  );
}

function Toggle({ checked, onChange, label, description }: { checked: boolean; onChange: (checked: boolean) => void; label: string; description?: string }) {
  return (
    <button type="button" onClick={() => onChange(!checked)} className="flex w-full items-center justify-between gap-4 text-left">
      <span>
        <span className="block text-sm font-semibold text-slate-800">{label}</span>
        {description ? <span className="mt-0.5 block text-xs leading-5 text-slate-500">{description}</span> : null}
      </span>
      <span className={cn("relative h-6 w-11 shrink-0 rounded-full transition", checked ? "bg-blue-600" : "bg-slate-200")}>
        <span className={cn("absolute top-0.5 size-5 rounded-full bg-white shadow transition", checked ? "left-[22px]" : "left-0.5")} />
      </span>
    </button>
  );
}

const configOf = (section: HomepageDraftSection) =>
  section.config && typeof section.config === "object" && !Array.isArray(section.config)
    ? (section.config as Record<string, unknown>)
    : {};

const stringValue = (value: unknown) => (typeof value === "string" ? value : "");
const stringArray = (value: unknown) =>
  Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];

function DestinationEditor({
  value,
  onChange,
  catalogue,
}: {
  value: string | null;
  onChange: (value: string | null) => void;
  catalogue: HomepageEditorData["catalogue"];
}) {
  const kind = value?.startsWith("/product/")
    ? "product"
    : value?.startsWith("/category/")
      ? "category"
      : value?.startsWith("/brand/")
        ? "brand"
        : value?.startsWith("/") || !value
          ? "page"
          : "external";

  const switchKind = (next: string) => {
    if (next === "product") onChange(catalogue.products[0] ? `/product/${catalogue.products[0].slug}` : null);
    else if (next === "category") onChange(catalogue.categories[0] ? `/category/${catalogue.categories[0].slug}` : null);
    else if (next === "brand") onChange(catalogue.brands[0] ? `/brand/${catalogue.brands[0].slug}` : null);
    else if (next === "external") onChange("https://");
    else onChange("/shop");
  };

  return (
    <div className="grid gap-2 sm:grid-cols-2">
      <select value={kind} onChange={(event) => switchKind(event.target.value)} className={inputClass}>
        <option value="page">Page interne</option>
        <option value="product">Produit</option>
        <option value="category">Catégorie</option>
        <option value="brand">Marque</option>
        <option value="external">URL externe</option>
      </select>
      {kind === "page" ? (
        <select value={value || "/shop"} onChange={(event) => onChange(event.target.value)} className={inputClass}>
          <option value="/">Accueil</option>
          <option value="/shop">Boutique</option>
          <option value="/deal">Promotions</option>
          <option value="/#contact">Contact</option>
        </select>
      ) : kind === "product" ? (
        <select value={value || ""} onChange={(event) => onChange(event.target.value)} className={inputClass}>
          {catalogue.products.map((product) => <option key={product.id} value={`/product/${product.slug}`}>{product.name}</option>)}
        </select>
      ) : kind === "category" ? (
        <select value={value || ""} onChange={(event) => onChange(event.target.value)} className={inputClass}>
          {catalogue.categories.map((category) => <option key={category.id} value={`/category/${category.slug}`}>{category.title}</option>)}
        </select>
      ) : kind === "brand" ? (
        <select value={value || ""} onChange={(event) => onChange(event.target.value)} className={inputClass}>
          {catalogue.brands.map((brand) => <option key={brand.id} value={`/brand/${brand.slug}`}>{brand.title}</option>)}
        </select>
      ) : (
        <input value={value || ""} onChange={(event) => onChange(event.target.value || null)} placeholder="https://exemple.ma" className={inputClass} />
      )}
    </div>
  );
}

function SectionBasics({
  section,
  onPatch,
  catalogue,
}: {
  section: HomepageDraftSection;
  onPatch: (patch: Partial<HomepageDraftSection>) => void;
  catalogue: HomepageEditorData["catalogue"];
}) {
  return (
    <div className="space-y-4">
      <Field label="Titre de la section">
        <input value={section.title} onChange={(event) => onPatch({ title: event.target.value })} className={inputClass} />
      </Field>
      {section.type !== "hero" ? (
        <Field label="Sous-titre (optionnel)">
          <textarea value={section.subtitle || ""} onChange={(event) => onPatch({ subtitle: event.target.value || null })} rows={2} className={textareaClass} />
        </Field>
      ) : null}
      {!(["hero", "reassurance", "newsletter", "social_links"] as string[]).includes(section.type) ? (
        <>
          <Field label="Texte du bouton (optionnel)">
            <input value={section.ctaLabel || ""} onChange={(event) => onPatch({ ctaLabel: event.target.value || null })} className={inputClass} />
          </Field>
          <Field label="Destination du bouton">
            <DestinationEditor value={section.ctaLink} onChange={(ctaLink) => onPatch({ ctaLink })} catalogue={catalogue} />
          </Field>
        </>
      ) : null}
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
        <Toggle checked={section.isActive} onChange={(isActive) => onPatch({ isActive })} label="Section active" description="Une section inactive reste enregistrée mais n'est pas rendue." />
      </div>
      <details className="rounded-xl border border-slate-200 bg-white p-4">
        <summary className="cursor-pointer text-sm font-semibold text-slate-700">Programmer la visibilité (optionnel)</summary>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <Field label="Visible à partir du">
            <input type="datetime-local" value={section.startsAt?.slice(0, 16) || ""} onChange={(event) => onPatch({ startsAt: event.target.value ? new Date(event.target.value).toISOString() : null })} className={inputClass} />
          </Field>
          <Field label="Visible jusqu'au">
            <input type="datetime-local" value={section.endsAt?.slice(0, 16) || ""} onChange={(event) => onPatch({ endsAt: event.target.value ? new Date(event.target.value).toISOString() : null })} className={inputClass} />
          </Field>
        </div>
      </details>
    </div>
  );
}

function HeroEditor({
  snapshot,
  onChange,
  catalogue,
}: {
  snapshot: HomepageWorkspaceSnapshot;
  onChange: (snapshot: HomepageWorkspaceSnapshot) => void;
  catalogue: HomepageEditorData["catalogue"];
}) {
  const visibleSlides = snapshot.heroSlides.filter((slide) => !slide.archivedAt).sort((a, b) => a.sortOrder - b.sortOrder);
  const [selectedId, setSelectedId] = useState(visibleSlides[0]?.id || "");
  const [uploadError, setUploadError] = useState("");
  const [uploading, startUpload] = useTransition();
  const slide = visibleSlides.find((item) => item.id === selectedId) || visibleSlides[0];

  const replace = (heroSlides: HomepageDraftHeroSlide[]) => onChange({ ...snapshot, heroSlides });
  const patch = (id: string, update: Partial<HomepageDraftHeroSlide>) =>
    replace(snapshot.heroSlides.map((item) => (item.id === id ? { ...item, ...update } : item)));
  const move = (id: string, direction: -1 | 1) => {
    const index = visibleSlides.findIndex((item) => item.id === id);
    const target = index + direction;
    if (target < 0 || target >= visibleSlides.length) return;
    const reordered = [...visibleSlides];
    [reordered[index], reordered[target]] = [reordered[target], reordered[index]];
    const order = new Map(reordered.map((item, itemIndex) => [item.id, itemIndex]));
    replace(snapshot.heroSlides.map((item) => ({ ...item, sortOrder: order.get(item.id) ?? item.sortOrder })));
  };

  if (!slide) {
    return (
      <button type="button" onClick={() => {
        const id = crypto.randomUUID();
        replace([...snapshot.heroSlides, { id, badge: null, title: "Nouveau slide", subtitle: null, ctaLabel: "Découvrir", ctaHref: "/shop", imageUrl: null, altText: null, sortOrder: 0, isActive: true, archivedAt: null, startsAt: null, endsAt: null }]);
        setSelectedId(id);
      }} className="w-full rounded-xl border border-dashed border-blue-300 bg-blue-50 p-5 text-sm font-semibold text-blue-700">Ajouter le premier slide</button>
    );
  }

  return (
    <div className="space-y-5">
      <div className="space-y-2">
        {visibleSlides.map((item, index) => (
          <button key={item.id} type="button" onClick={() => setSelectedId(item.id)} className={cn("flex w-full items-center gap-3 rounded-xl border p-2.5 text-left", item.id === slide.id ? "border-blue-400 bg-blue-50" : "border-slate-200 bg-white")}>
            <div className="relative size-12 overflow-hidden rounded-lg bg-slate-100">
              {item.imageUrl ? <Image src={item.imageUrl} alt={item.altText || item.title} fill unoptimized className="object-cover" /> : <ImagePlus className="absolute left-1/2 top-1/2 size-5 -translate-x-1/2 -translate-y-1/2 text-slate-400" />}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-slate-900">{item.title}</p>
              <p className={cn("text-xs", item.isActive ? "text-emerald-600" : "text-slate-400")}>{item.isActive ? "Actif" : "Inactif"}</p>
            </div>
            <span className="flex gap-1">
              <span role="button" tabIndex={0} onClick={(event) => { event.stopPropagation(); move(item.id, -1); }} className="rounded-md p-1 text-slate-400 hover:bg-white"><ChevronUp className="size-4" /></span>
              <span role="button" tabIndex={0} onClick={(event) => { event.stopPropagation(); move(item.id, 1); }} className="rounded-md p-1 text-slate-400 hover:bg-white"><ChevronDown className="size-4" /></span>
            </span>
            <span className="text-[10px] text-slate-400">{index + 1}</span>
          </button>
        ))}
        <button type="button" onClick={() => {
          const id = crypto.randomUUID();
          replace([...snapshot.heroSlides, { id, badge: null, title: "Nouveau slide", subtitle: null, ctaLabel: "Découvrir", ctaHref: "/shop", imageUrl: null, altText: null, sortOrder: visibleSlides.length, isActive: true, archivedAt: null, startsAt: null, endsAt: null }]);
          setSelectedId(id);
        }} className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-blue-300 p-3 text-sm font-semibold text-blue-700"><Plus className="size-4" /> Ajouter un slide</button>
      </div>

      <div className="border-t border-slate-200 pt-5">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-900">Éditer le slide sélectionné</h3>
          <div className="flex gap-1">
            <button type="button" onClick={() => {
              const id = crypto.randomUUID();
              const copy = { ...slide, id, title: `${slide.title} — copie`, sortOrder: visibleSlides.length, archivedAt: null };
              replace([...snapshot.heroSlides, copy]); setSelectedId(id);
            }} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100" aria-label="Dupliquer"><Copy className="size-4" /></button>
            <button type="button" onClick={() => patch(slide.id, { archivedAt: new Date().toISOString(), isActive: false })} className="rounded-lg p-2 text-rose-500 hover:bg-rose-50" aria-label="Archiver"><Archive className="size-4" /></button>
          </div>
        </div>
        <div className="space-y-4">
          <Field label="Badge (optionnel)"><input value={slide.badge || ""} onChange={(event) => patch(slide.id, { badge: event.target.value || null })} className={inputClass} /></Field>
          <Field label="Titre"><textarea rows={2} value={slide.title} onChange={(event) => patch(slide.id, { title: event.target.value })} className={textareaClass} /></Field>
          <Field label="Sous-titre"><textarea rows={3} value={slide.subtitle || ""} onChange={(event) => patch(slide.id, { subtitle: event.target.value || null })} className={textareaClass} /></Field>
          <Field label="Texte du bouton"><input value={slide.ctaLabel || ""} onChange={(event) => patch(slide.id, { ctaLabel: event.target.value || null })} className={inputClass} /></Field>
          <Field label="Destination"><DestinationEditor value={slide.ctaHref} onChange={(ctaHref) => patch(slide.id, { ctaHref })} catalogue={catalogue} /></Field>
          <Field label="Image" hint="JPG, PNG ou WebP, 5 Mo maximum. L'image est optimisée automatiquement.">
            <div className="rounded-xl border border-slate-200 p-3">
              {slide.imageUrl ? <div className="relative mb-3 h-28 overflow-hidden rounded-lg bg-slate-100"><Image src={slide.imageUrl} alt={slide.altText || slide.title} fill unoptimized className="object-cover" /></div> : null}
              <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50">
                {uploading ? <Loader2 className="size-4 animate-spin" /> : <ImagePlus className="size-4" />} {slide.imageUrl ? "Remplacer l'image" : "Choisir une image"}
                <input type="file" accept="image/*" className="sr-only" disabled={uploading} onChange={(event) => {
                  const file = event.target.files?.[0]; if (!file) return;
                  startUpload(async () => {
                    setUploadError("");
                    const formData = new FormData(); formData.set("image", file); formData.set("title", slide.title);
                    const result = await uploadHomepageImageAction(formData);
                    if (result.ok) patch(slide.id, { imageUrl: result.url });
                    else setUploadError(result.message);
                  });
                }} />
              </label>
              {uploadError ? <p className="mt-2 text-xs font-medium text-rose-600">{uploadError}</p> : null}
            </div>
          </Field>
          <Field label="Texte alternatif" hint="Décrivez l'image pour l'accessibilité."><input value={slide.altText || ""} onChange={(event) => patch(slide.id, { altText: event.target.value || null })} className={inputClass} /></Field>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4"><Toggle checked={slide.isActive} onChange={(isActive) => patch(slide.id, { isActive })} label="Slide actif" /></div>
          <details className="rounded-xl border border-slate-200 p-4"><summary className="cursor-pointer text-sm font-semibold">Programmer la visibilité</summary><div className="mt-4 grid gap-3 sm:grid-cols-2"><Field label="Du"><input type="datetime-local" value={slide.startsAt?.slice(0, 16) || ""} onChange={(event) => patch(slide.id, { startsAt: event.target.value ? new Date(event.target.value).toISOString() : null })} className={inputClass} /></Field><Field label="Au"><input type="datetime-local" value={slide.endsAt?.slice(0, 16) || ""} onChange={(event) => patch(slide.id, { endsAt: event.target.value ? new Date(event.target.value).toISOString() : null })} className={inputClass} /></Field></div></details>
        </div>
      </div>
    </div>
  );
}

type ProductOption = HomepageEditorData["catalogue"]["products"][number];

function ProductSectionEditor({ section, onPatch, catalogue }: { section: HomepageDraftSection; onPatch: (patch: Partial<HomepageDraftSection>) => void; catalogue: HomepageEditorData["catalogue"] }) {
  const config = configOf(section);
  const sourceType = stringValue(config.sourceType) || "featured";
  const manual = sourceType === "manual_selection";
  const selectedIds = stringArray(config.productIds);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ProductOption[]>(catalogue.products);
  const [searching, startSearch] = useTransition();
  const updateConfig = (patch: Record<string, unknown>) => onPatch({ config: { ...config, ...patch } });
  const knownProducts = useMemo(() => new Map([...catalogue.products, ...results].map((product) => [product.id, product])), [catalogue.products, results]);

  const runSearch = () => startSearch(async () => {
    const result = await searchHomepageProductsAction(query);
    if (result.ok) setResults(result.products);
  });

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-2 rounded-xl bg-slate-100 p-1">
        <button type="button" onClick={() => updateConfig({ sourceType: sourceType === "manual_selection" ? "featured" : sourceType })} className={cn("rounded-lg px-3 py-3 text-xs font-semibold", !manual ? "bg-white text-blue-700 shadow-sm" : "text-slate-500")}>Source automatique</button>
        <button type="button" onClick={() => updateConfig({ sourceType: "manual_selection" })} className={cn("rounded-lg px-3 py-3 text-xs font-semibold", manual ? "bg-white text-blue-700 shadow-sm" : "text-slate-500")}>Sélection manuelle</button>
      </div>
      {!manual ? (
        <div className="space-y-4">
          <Field label="Règle de sélection"><select value={sourceType} onChange={(event) => updateConfig({ sourceType: event.target.value })} className={inputClass}><option value="discounted">Promotions actives</option><option value="best_sellers">Meilleures ventes réelles</option><option value="newest">Nouveautés</option><option value="featured">Produits mis en avant</option><option value="by_category">Par catégorie</option><option value="by_brand">Par marque</option><option value="by_tag">Par tag</option></select></Field>
          {sourceType === "by_category" ? <Field label="Catégorie"><select value={stringValue(config.categoryId)} onChange={(event) => updateConfig({ categoryId: event.target.value || null })} className={inputClass}><option value="">Sélectionner</option>{catalogue.categories.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}</select></Field> : null}
          {sourceType === "by_brand" ? <Field label="Marque"><select value={stringValue(config.brandId)} onChange={(event) => updateConfig({ brandId: event.target.value || null })} className={inputClass}><option value="">Sélectionner</option>{catalogue.brands.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}</select></Field> : null}
          {sourceType === "by_tag" ? <Field label="Tag"><select value={stringValue(config.tagId)} onChange={(event) => updateConfig({ tagId: event.target.value || null })} className={inputClass}><option value="">Sélectionner</option>{catalogue.tags.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}</select></Field> : null}
          {(sourceType === "best_sellers" || sourceType === "newest") ? <Field label="Période d'analyse (jours)"><input type="number" min={1} max={365} value={typeof config.periodDays === "number" ? config.periodDays : 30} onChange={(event) => updateConfig({ periodDays: Number(event.target.value) || 30 })} className={inputClass} /></Field> : null}
          <Field label="Tri"><select value={stringValue(config.sortBy) || "updatedAt"} onChange={(event) => updateConfig({ sortBy: event.target.value })} className={inputClass}><option value="updatedAt">Dernière modification</option><option value="createdAt">{"Date d'ajout"}</option><option value="price">Prix</option><option value="discount">Remise</option><option value="name">Nom</option></select></Field>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex gap-2"><div className="relative flex-1"><Search className="absolute left-3 top-3.5 size-4 text-slate-400" /><input value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); runSearch(); } }} placeholder="Rechercher par nom, SKU ou marque" className={`${inputClass} pl-9`} /></div><button type="button" onClick={runSearch} className="rounded-xl border border-slate-200 px-3 text-xs font-semibold">{searching ? <Loader2 className="size-4 animate-spin" /> : "Rechercher"}</button></div>
          {selectedIds.length ? <div className="space-y-2"><p className="text-xs font-semibold text-slate-600">Produits sélectionnés ({selectedIds.length})</p>{selectedIds.map((id) => { const product = knownProducts.get(id); return <div key={id} className="flex items-center gap-2 rounded-lg bg-blue-50 p-2 text-xs"><Check className="size-4 text-blue-600" /><span className="min-w-0 flex-1 truncate font-medium">{product?.name || "Produit sélectionné"}</span><button type="button" onClick={() => updateConfig({ productIds: selectedIds.filter((item) => item !== id) })}><X className="size-4 text-slate-400" /></button></div>; })}</div> : null}
          <div className="max-h-64 space-y-2 overflow-y-auto pr-1">{results.map((product) => { const selected = selectedIds.includes(product.id); return <button key={product.id} type="button" onClick={() => updateConfig({ productIds: selected ? selectedIds.filter((id) => id !== product.id) : [...selectedIds, product.id] })} className={cn("flex w-full items-center gap-3 rounded-xl border p-2 text-left", selected ? "border-blue-300 bg-blue-50" : "border-slate-200 bg-white")}><div className="relative size-10 overflow-hidden rounded-lg bg-slate-100">{product.imageUrl ? <Image src={product.imageUrl} alt="" fill unoptimized className="object-cover" /> : null}</div><div className="min-w-0 flex-1"><p className="truncate text-xs font-semibold">{product.name}</p><p className="text-[11px] text-slate-400">{product.brandTitle || "Sans marque"} · Stock {product.stock}</p></div>{selected ? <Check className="size-4 text-blue-600" /> : <Plus className="size-4 text-slate-400" />}</button>; })}</div>
        </div>
      )}
      <div className="grid gap-4 sm:grid-cols-2"><Field label="Nombre de produits"><input type="number" min={1} max={30} value={section.limit || 8} onChange={(event) => onPatch({ limit: Math.max(1, Math.min(30, Number(event.target.value) || 1)) })} className={inputClass} /></Field><Field label="Disposition"><select value={section.layout || "carousel"} onChange={(event) => { onPatch({ layout: event.target.value, config: { ...config, layout: event.target.value } }); }} className={inputClass}><option value="carousel">Carrousel</option><option value="grid">Grille</option><option value="compact">Compact</option></select></Field></div>
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4"><Toggle checked={config.excludeOutOfStock !== false} onChange={(excludeOutOfStock) => updateConfig({ excludeOutOfStock })} label="Exclure les produits en rupture" /></div>
    </div>
  );
}

function SelectionGrid({ items, selected, onChange }: { items: Array<{ id: string; title: string }>; selected: string[]; onChange: (ids: string[]) => void }) {
  return <div className="max-h-72 space-y-2 overflow-y-auto rounded-xl border border-slate-200 p-2">{items.map((item) => { const active = selected.includes(item.id); return <button key={item.id} type="button" onClick={() => onChange(active ? selected.filter((id) => id !== item.id) : [...selected, item.id])} className={cn("flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm", active ? "bg-blue-50 font-semibold text-blue-700" : "hover:bg-slate-50")}><span className={cn("flex size-5 items-center justify-center rounded border", active ? "border-blue-500 bg-blue-500 text-white" : "border-slate-300")}>{active ? <Check className="size-3.5" /> : null}</span>{item.title}</button>; })}</div>;
}

function TrustEditor({ snapshot, onChange }: { snapshot: HomepageWorkspaceSnapshot; onChange: (snapshot: HomepageWorkspaceSnapshot) => void }) {
  const items = snapshot.trustItems.filter((item) => !item.archivedAt).sort((a, b) => a.sortOrder - b.sortOrder);
  const patch = (id: string, update: Partial<(typeof items)[number]>) => onChange({ ...snapshot, trustItems: snapshot.trustItems.map((item) => item.id === id ? { ...item, ...update } : item) });
  return <div className="space-y-3">{items.map((item) => <div key={item.id} className="space-y-3 rounded-xl border border-slate-200 p-3"><div className="flex items-center gap-2"><input value={item.title} onChange={(event) => patch(item.id, { title: event.target.value })} className={`${inputClass} flex-1`} /><button type="button" onClick={() => patch(item.id, { archivedAt: new Date().toISOString(), isActive: false })} className="p-2 text-rose-500"><Archive className="size-4" /></button></div><textarea value={item.description} onChange={(event) => patch(item.id, { description: event.target.value })} rows={2} className={textareaClass} /><div className="grid grid-cols-[1fr_auto] gap-2"><select value={item.icon} onChange={(event) => patch(item.id, { icon: event.target.value })} className={inputClass}><option value="truck">Livraison</option><option value="shield">Garantie</option><option value="wallet">Paiement</option><option value="headset">Service client</option><option value="return">Retours</option></select><button type="button" onClick={() => patch(item.id, { isActive: !item.isActive })} className={cn("rounded-xl px-3 text-xs font-semibold", item.isActive ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500")}>{item.isActive ? "Actif" : "Inactif"}</button></div></div>)}<button type="button" onClick={() => onChange({ ...snapshot, trustItems: [...snapshot.trustItems, { id: crypto.randomUUID(), title: "Nouvel engagement", description: "Description", icon: "shield", sortOrder: items.length, isActive: true, archivedAt: null }] })} className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-blue-300 p-3 text-sm font-semibold text-blue-700"><Plus className="size-4" /> Ajouter un engagement</button></div>;
}

function LinksEditor({ snapshot, onChange, social = false }: { snapshot: HomepageWorkspaceSnapshot; onChange: (snapshot: HomepageWorkspaceSnapshot) => void; social?: boolean }) {
  const rows = social ? snapshot.socialLinks : snapshot.links.filter((link) => link.group !== "header");
  const visible = rows.filter((item) => !item.archivedAt).sort((a, b) => a.sortOrder - b.sortOrder);
  const patch = (id: string, update: Record<string, unknown>) => social
    ? onChange({ ...snapshot, socialLinks: snapshot.socialLinks.map((item) => item.id === id ? { ...item, ...update } : item) })
    : onChange({ ...snapshot, links: snapshot.links.map((item) => item.id === id ? { ...item, ...update } : item) });
  return <div className="space-y-3">{visible.map((item) => <div key={item.id} className="space-y-2 rounded-xl border border-slate-200 p-3"><div className="flex gap-2"><input value={item.title} onChange={(event) => patch(item.id, { title: event.target.value })} className={inputClass} /><button type="button" onClick={() => patch(item.id, { archivedAt: new Date().toISOString(), isActive: false })} className="p-2 text-rose-500"><Archive className="size-4" /></button></div>{social ? <input value={"platform" in item ? item.platform : ""} onChange={(event) => patch(item.id, { platform: event.target.value })} placeholder="Plateforme" className={inputClass} /> : <select value={"group" in item ? item.group : "footer_quick"} onChange={(event) => patch(item.id, { group: event.target.value })} className={inputClass}><option value="footer_quick">Footer rapide</option><option value="footer_legal">Footer légal</option><option value="header">Header</option></select>}<input value={item.href} onChange={(event) => patch(item.id, { href: event.target.value })} placeholder="https://… ou /page" className={inputClass} /><Toggle checked={item.isActive} onChange={(isActive) => patch(item.id, { isActive })} label="Lien actif" /></div>)}<button type="button" onClick={() => { const id = crypto.randomUUID(); if (social) onChange({ ...snapshot, socialLinks: [...snapshot.socialLinks, { id, platform: "instagram", title: "Instagram", href: "https://instagram.com/", sortOrder: visible.length, openInNewTab: true, isActive: true, archivedAt: null }] }); else onChange({ ...snapshot, links: [...snapshot.links, { id, group: "footer_quick", title: "Nouveau lien", href: "/", sortOrder: visible.length, openInNewTab: false, isActive: true, archivedAt: null }] }); }} className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-blue-300 p-3 text-sm font-semibold text-blue-700"><Plus className="size-4" /> Ajouter un lien</button></div>;
}

export default function HomepageZoneEditor({
  snapshot,
  selectedZone,
  onChange,
  catalogue,
}: {
  snapshot: HomepageWorkspaceSnapshot;
  selectedZone: string;
  onChange: (snapshot: HomepageWorkspaceSnapshot) => void;
  catalogue: HomepageEditorData["catalogue"];
}) {
  const section = snapshot.sections.find((item) => item.id === selectedZone);
  const updateSettings = (patch: Partial<HomepageWorkspaceSnapshot["settings"]>) => onChange({ ...snapshot, settings: { ...snapshot.settings, ...patch } });
  const patchSection = (patch: Partial<HomepageDraftSection>) => section && onChange({ ...snapshot, sections: snapshot.sections.map((item) => item.id === section.id ? { ...item, ...patch } : item) });
  const updateSectionConfig = (patch: Record<string, unknown>) => section && patchSection({ config: { ...configOf(section), ...patch } });

  if (selectedZone === "announcement") {
    return <div className="space-y-5"><div><h2 className="text-lg font-bold text-slate-950">{"Barre d'annonce"}</h2><p className="mt-1 text-xs text-slate-500">Message court affiché au-dessus de la navigation.</p></div><Field label="Message"><textarea rows={3} value={snapshot.settings.announcementText} onChange={(event) => updateSettings({ announcementText: event.target.value })} className={textareaClass} /></Field><Field label="Destination"><DestinationEditor value={snapshot.settings.announcementHref} onChange={(announcementHref) => updateSettings({ announcementHref })} catalogue={catalogue} /></Field><div className="rounded-xl border border-slate-200 bg-slate-50 p-4"><Toggle checked={snapshot.settings.announcementEnabled} onChange={(announcementEnabled) => updateSettings({ announcementEnabled })} label="Barre d'annonce active" /></div></div>;
  }

  if (selectedZone === "footer") {
    return <div className="space-y-5"><div><h2 className="text-lg font-bold">Footer</h2><p className="mt-1 text-xs text-slate-500">Informations et liens utiles affichés en bas du site.</p></div><Field label="Titre"><input value={snapshot.settings.footerAboutTitle} onChange={(event) => updateSettings({ footerAboutTitle: event.target.value })} className={inputClass} /></Field><Field label="Description"><textarea value={snapshot.settings.footerAboutDescription} onChange={(event) => updateSettings({ footerAboutDescription: event.target.value })} rows={3} className={textareaClass} /></Field><Field label="Copyright"><input value={snapshot.settings.footerCopyrightText} onChange={(event) => updateSettings({ footerCopyrightText: event.target.value })} className={inputClass} /></Field><div className="border-t border-slate-200 pt-5"><h3 className="mb-3 text-sm font-bold">Liens du footer</h3><LinksEditor snapshot={snapshot} onChange={onChange} /></div></div>;
  }

  if (selectedZone === "social") {
    return <div className="space-y-5"><div><h2 className="text-lg font-bold">Réseaux sociaux</h2><p className="mt-1 text-xs text-slate-500">Liens publics vers vos comptes officiels.</p></div><LinksEditor snapshot={snapshot} onChange={onChange} social /></div>;
  }

  if (!section) return <div className="rounded-xl border border-dashed border-slate-200 p-8 text-center text-sm text-slate-500">Sélectionnez une zone à éditer.</div>;
  const config = configOf(section);

  return (
    <div className="space-y-6">
      <div><p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-blue-600">Section sélectionnée</p><h2 className="mt-1 text-lg font-bold text-slate-950">{section.title}</h2></div>
      <SectionBasics section={section} onPatch={patchSection} catalogue={catalogue} />
      <div className="border-t border-slate-200 pt-6">
        {section.type === "hero" ? <HeroEditor snapshot={snapshot} onChange={onChange} catalogue={catalogue} /> : null}
        {section.type === "product_list" ? <ProductSectionEditor section={section} onPatch={patchSection} catalogue={catalogue} /> : null}
        {section.type === "category_list" ? <div className="space-y-4"><Toggle checked={Boolean(config.featuredOnly)} onChange={(featuredOnly) => updateSectionConfig({ featuredOnly })} label="Sélection automatique" description="Utiliser les catégories marquées comme vedettes dans le catalogue." />{!config.featuredOnly ? <SelectionGrid items={catalogue.categories} selected={stringArray(config.categoryIds)} onChange={(categoryIds) => updateSectionConfig({ categoryIds })} /> : null}<Field label="Nombre de catégories"><input type="number" min={1} max={24} value={section.limit || 8} onChange={(event) => patchSection({ limit: Number(event.target.value) || 8 })} className={inputClass} /></Field></div> : null}
        {section.type === "brand_list" ? <div className="space-y-4"><p className="text-xs text-slate-500">Sans sélection, toutes les marques actives sont utilisées. Sélectionnez des marques pour créer une liste éditoriale.</p><SelectionGrid items={catalogue.brands} selected={stringArray(config.brandIds)} onChange={(brandIds) => updateSectionConfig({ brandIds })} /><Field label="Nombre de marques"><input type="number" min={1} max={24} value={section.limit || 12} onChange={(event) => patchSection({ limit: Number(event.target.value) || 12 })} className={inputClass} /></Field></div> : null}
        {section.type === "reassurance" ? <TrustEditor snapshot={snapshot} onChange={onChange} /> : null}
        {section.type === "newsletter" ? <div className="space-y-4"><Field label="Titre"><input value={snapshot.settings.newsletterTitle} onChange={(event) => updateSettings({ newsletterTitle: event.target.value })} className={inputClass} /></Field><Field label="Description"><textarea value={snapshot.settings.newsletterDescription} onChange={(event) => updateSettings({ newsletterDescription: event.target.value })} rows={3} className={textareaClass} /></Field><Field label="Texte du bouton"><input value={snapshot.settings.newsletterButtonLabel} onChange={(event) => updateSettings({ newsletterButtonLabel: event.target.value })} className={inputClass} /></Field></div> : null}
        {section.type === "custom_banner" ? <div className="space-y-4"><Field label="Badge"><input value={stringValue(config.badge)} onChange={(event) => updateSectionConfig({ badge: event.target.value })} className={inputClass} /></Field><Field label="Description"><textarea value={stringValue(config.description)} onChange={(event) => updateSectionConfig({ description: event.target.value })} rows={3} className={textareaClass} /></Field><Field label="Texte mis en avant"><input value={stringValue(config.highlightText)} onChange={(event) => updateSectionConfig({ highlightText: event.target.value })} className={inputClass} /></Field></div> : null}
        {section.type === "links_group" ? <LinksEditor snapshot={snapshot} onChange={onChange} /> : null}
        {section.type === "social_links" ? <LinksEditor snapshot={snapshot} onChange={onChange} social /> : null}
        {section.type === "rich_text" ? <Field label="Contenu"><textarea rows={8} value={stringValue(config.content)} onChange={(event) => updateSectionConfig({ content: event.target.value })} className={textareaClass} /></Field> : null}
        {section.type === "custom_html" ? <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs leading-5 text-amber-800">{"L'édition HTML brute reste volontairement désactivée dans cet éditeur visuel pour éviter l'injection de contenu non sûr."}</div> : null}
      </div>
    </div>
  );
}
