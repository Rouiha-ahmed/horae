"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import {
  AlertCircle,
  Check,
  CloudUpload,
  Eye,
  LayoutGrid,
  Loader2,
  RefreshCw,
} from "lucide-react";

import {
  publishHomepageDraftAction,
  saveHomepageDraftAction,
} from "@/app/admin/homepage/actions";
import HomepageDraftPreview, {
  HomepageViewportSwitch,
  type HomepagePreviewViewport,
} from "@/components/admin/homepage/HomepageDraftPreview";
import HomepageOrganizer from "@/components/admin/homepage/HomepageOrganizer";
import HomepageZoneEditor from "@/components/admin/homepage/HomepageZoneEditor";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { HomepageDynamicSection } from "@/lib/homepage-sections";
import type {
  HomepageDraftSection,
  HomepageEditorData,
  HomepageWorkspaceSnapshot,
} from "@/lib/homepage-workspace";
import { cn } from "@/lib/utils";

const sectionTypeLabel: Record<HomepageDraftSection["type"], string> = {
  hero: "Hero",
  product_list: "Produits",
  category_list: "Catégories",
  brand_list: "Marques",
  reassurance: "Réassurance",
  newsletter: "Newsletter",
  custom_banner: "Fidélité / Bannière",
  links_group: "Liens",
  social_links: "Réseaux sociaux",
  custom_html: "HTML personnalisé",
  rich_text: "Texte riche",
};

const countChanges = (
  draft: HomepageWorkspaceSnapshot,
  published: HomepageWorkspaceSnapshot
) => {
  let changes = JSON.stringify(draft.settings) === JSON.stringify(published.settings) ? 0 : 1;
  const pairs: Array<[Array<{ id: string }>, Array<{ id: string }>]> = [
    [draft.sections, published.sections],
    [draft.heroSlides, published.heroSlides],
    [draft.trustItems, published.trustItems],
    [draft.links, published.links],
    [draft.socialLinks, published.socialLinks],
  ];
  for (const [draftItems, publishedItems] of pairs) {
    const left = new Map(draftItems.map((item) => [item.id, JSON.stringify(item)]));
    const right = new Map(publishedItems.map((item) => [item.id, JSON.stringify(item)]));
    for (const id of new Set([...left.keys(), ...right.keys()])) {
      if (left.get(id) !== right.get(id)) changes += 1;
    }
  }
  return changes;
};

type SaveState = "idle" | "saving" | "saved" | "error" | "conflict";

export default function HomepageVisualEditor({ data }: { data: HomepageEditorData }) {
  const initialZone = data.snapshot.sections.find((section) => section.type === "hero" && !section.archivedAt)?.id || "announcement";
  const [snapshot, setSnapshot] = useState(data.snapshot);
  const [publishedSnapshot, setPublishedSnapshot] = useState(data.publishedSnapshot);
  const [previewSections, setPreviewSections] = useState<HomepageDynamicSection[]>(data.previewSections);
  const [selectedZone, setSelectedZone] = useState(initialZone);
  const [viewport, setViewport] = useState<HomepagePreviewViewport>("desktop");
  const [organizerOpen, setOrganizerOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [saveMessage, setSaveMessage] = useState("");
  const [revision, setRevision] = useState(0);
  const [lastSavedRevision, setLastSavedRevision] = useState(0);
  const [isPublishing, startPublishing] = useTransition();

  const snapshotRef = useRef(snapshot);
  const revisionRef = useRef(revision);
  const versionRef = useRef(data.draftVersion);
  const lastSavedRevisionRef = useRef(0);
  const lastSaveSucceededRef = useRef(true);
  const saveChainRef = useRef<Promise<boolean>>(Promise.resolve(true));

  useEffect(() => { snapshotRef.current = snapshot; }, [snapshot]);
  useEffect(() => { revisionRef.current = revision; }, [revision]);

  const updateSnapshot = useCallback((next: HomepageWorkspaceSnapshot) => {
    snapshotRef.current = next;
    setSnapshot(next);
    setRevision((current) => {
      const nextRevision = current + 1;
      revisionRef.current = nextRevision;
      return nextRevision;
    });
    setSaveState("idle");
  }, []);

  const persist = useCallback(async (payload: HomepageWorkspaceSnapshot, payloadRevision: number) => {
    setSaveState("saving");
    setSaveMessage("");
    const result = await saveHomepageDraftAction(payload, versionRef.current);
    if (!result.ok) {
      lastSaveSucceededRef.current = false;
      if (result.reason === "conflict") {
        setSaveState("conflict");
        setSaveMessage("Le brouillon a été modifié ailleurs. Rechargez avant de continuer.");
      } else {
        setSaveState("error");
        setSaveMessage(result.message || "Impossible d'enregistrer le brouillon.");
      }
      return false;
    }

    lastSaveSucceededRef.current = true;
    versionRef.current = result.version;
    lastSavedRevisionRef.current = Math.max(lastSavedRevisionRef.current, payloadRevision);
    setLastSavedRevision((current) => Math.max(current, payloadRevision));
    if (payloadRevision === revisionRef.current) {
      setPreviewSections(result.previewSections);
      setSaveState("saved");
    }
    return true;
  }, []);

  const enqueueSave = useCallback((payload: HomepageWorkspaceSnapshot, payloadRevision: number) => {
    saveChainRef.current = saveChainRef.current
      .catch(() => false)
      .then(() => persist(payload, payloadRevision));
    return saveChainRef.current;
  }, [persist]);

  useEffect(() => {
    if (!revision) return;
    const timeout = window.setTimeout(() => {
      void enqueueSave(snapshot, revision);
    }, 850);
    return () => window.clearTimeout(timeout);
  }, [enqueueSave, revision, snapshot]);

  const unpublishedChanges = useMemo(
    () => countChanges(snapshot, publishedSnapshot),
    [snapshot, publishedSnapshot]
  );

  const zones = useMemo(() => [
    { id: "announcement", label: "Barre d'annonce" },
    ...snapshot.sections
      .filter((section) => !section.archivedAt)
      .sort((left, right) => left.order - right.order)
      .map((section) => ({ id: section.id, label: section.title || sectionTypeLabel[section.type] })),
    { id: "footer", label: "Footer" },
    { id: "social", label: "Réseaux sociaux" },
  ], [snapshot.sections]);

  const effectiveSelectedZone = zones.some((zone) => zone.id === selectedZone)
    ? selectedZone
    : zones[0]?.id || "announcement";

  const publish = () => startPublishing(async () => {
    if (revisionRef.current > lastSavedRevisionRef.current) {
      await enqueueSave(snapshotRef.current, revisionRef.current);
    } else {
      await saveChainRef.current;
    }
    if (!lastSaveSucceededRef.current) return;

    const result = await publishHomepageDraftAction(versionRef.current);
    if (!result.ok) {
      setSaveState(result.reason === "conflict" ? "conflict" : "error");
      setSaveMessage("message" in result ? result.message : "La publication a échoué.");
      return;
    }
    setPublishedSnapshot(snapshotRef.current);
    setSaveState("saved");
    setSaveMessage("Homepage publiée avec succès.");
  });

  const saveLabel = saveState === "saving"
    ? "Modifications en cours…"
    : saveState === "saved"
      ? "Modifications enregistrées en brouillon"
      : saveState === "error"
        ? "Échec de l'enregistrement"
        : saveState === "conflict"
          ? "Conflit de version"
          : revision > lastSavedRevision
            ? "Modifications non enregistrées"
            : "Brouillon à jour";

  return (
    <div className="-m-4 min-h-[calc(100vh-4rem)] bg-[#f6f8fc] sm:-m-6 lg:-m-8">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-400"><span>Homepage</span><span>›</span><span>Zayna Admin</span></div>
              <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-950">Éditeur de la homepage</h1>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button type="button" onClick={() => setPreviewOpen(true)} className="inline-flex h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50"><Eye className="size-4" /> Prévisualiser</button>
              <button type="button" onClick={publish} disabled={isPublishing || !unpublishedChanges || saveState === "conflict"} className="inline-flex h-11 items-center gap-2 rounded-xl bg-[#12377d] px-5 text-sm font-semibold text-white shadow-sm hover:bg-[#0d2c68] disabled:cursor-not-allowed disabled:opacity-50">{isPublishing ? <Loader2 className="size-4 animate-spin" /> : <CloudUpload className="size-4" />} Publier</button>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <label className="flex items-center gap-2 text-xs font-semibold text-slate-500"><span>Page</span><select className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-800"><option>Accueil</option></select></label>
              <label className="flex items-center gap-2 text-xs font-semibold text-slate-500"><span>Zone</span><select value={effectiveSelectedZone} onChange={(event) => setSelectedZone(event.target.value)} className="h-10 max-w-56 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-800">{zones.map((zone) => <option key={zone.id} value={zone.id}>{zone.label}</option>)}</select></label>
              <span className="inline-flex h-9 items-center gap-2 rounded-full bg-emerald-50 px-3 text-xs font-semibold text-emerald-700"><span className="size-2 rounded-full bg-emerald-500" /> Site publié</span>
              {unpublishedChanges ? <span className="inline-flex h-9 items-center rounded-full bg-amber-50 px-3 text-xs font-semibold text-amber-700">{unpublishedChanges} modification{unpublishedChanges > 1 ? "s" : ""} non publiée{unpublishedChanges > 1 ? "s" : ""}</span> : null}
            </div>
            <div className="flex items-center gap-2"><HomepageViewportSwitch value={viewport} onChange={setViewport} /><button type="button" onClick={() => setOrganizerOpen(true)} className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700"><LayoutGrid className="size-4" /> Organiser</button></div>
          </div>

          <div className={cn("mt-3 flex items-center gap-2 text-xs", saveState === "error" || saveState === "conflict" ? "text-rose-600" : saveState === "saved" ? "text-emerald-600" : "text-slate-500")}>
            {saveState === "saving" ? <Loader2 className="size-4 animate-spin" /> : saveState === "error" || saveState === "conflict" ? <AlertCircle className="size-4" /> : <Check className="size-4" />}
            <span>{saveLabel}{saveMessage ? ` — ${saveMessage}` : ""}</span>
            {saveState === "error" ? <button type="button" onClick={() => void enqueueSave(snapshotRef.current, revisionRef.current)} className="inline-flex items-center gap-1 font-semibold underline"><RefreshCw className="size-3" /> Réessayer</button> : null}
            {saveState === "conflict" ? <button type="button" onClick={() => window.location.reload()} className="font-semibold underline">Recharger</button> : null}
          </div>
        </div>
      </header>

      <div className="grid min-h-[calc(100vh-232px)] xl:h-[calc(100vh-232px)] xl:min-h-[680px] xl:grid-cols-[minmax(350px,0.36fr)_minmax(0,0.64fr)]">
        <aside className="border-r border-slate-200 bg-white p-5 sm:p-6 xl:overflow-y-auto">
          <HomepageZoneEditor snapshot={snapshot} selectedZone={effectiveSelectedZone} onChange={updateSnapshot} catalogue={data.catalogue} />
        </aside>
        <section className="flex min-h-[680px] flex-col overflow-hidden bg-slate-100">
          <div className="flex items-center justify-between border-b border-slate-200 bg-white px-5 py-3"><div><p className="text-sm font-semibold text-slate-800">Aperçu du brouillon</p><p className="text-xs text-slate-400">Ce contenu n&apos;est pas encore visible dans la boutique.</p></div><Link href="/" target="_blank" className="text-xs font-semibold text-blue-700 hover:underline">Voir la boutique publiée ↗</Link></div>
          <HomepageDraftPreview snapshot={snapshot} sections={previewSections} selectedZone={effectiveSelectedZone} viewport={viewport} className="min-h-0 flex-1" />
        </section>
      </div>

      <HomepageOrganizer open={organizerOpen} onOpenChange={setOrganizerOpen} snapshot={snapshot} onChange={updateSnapshot} onSelect={setSelectedZone} />
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="h-[94vh] max-w-[96vw] grid-rows-[auto_minmax(0,1fr)] gap-0 overflow-hidden p-0 sm:max-w-[96vw]">
          <DialogHeader className="flex-row items-center justify-between border-b border-slate-200 px-5 py-3 pr-14"><DialogTitle>Aperçu de la Homepage en brouillon</DialogTitle><HomepageViewportSwitch value={viewport} onChange={setViewport} /></DialogHeader>
          <HomepageDraftPreview snapshot={snapshot} sections={previewSections} selectedZone={effectiveSelectedZone} viewport={viewport} className="min-h-0 flex-1" />
        </DialogContent>
      </Dialog>
    </div>
  );
}
