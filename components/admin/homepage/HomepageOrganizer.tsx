"use client";

import { useState } from "react";
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
import { Archive, Copy, GripVertical, Plus, RotateCcw } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type {
  HomepageDraftSection,
  HomepageWorkspaceSnapshot,
} from "@/lib/homepage-workspace";
import { cn } from "@/lib/utils";

const sectionLabels: Record<HomepageDraftSection["type"], string> = {
  hero: "Hero",
  product_list: "Section produits",
  category_list: "Catégories",
  brand_list: "Marques",
  reassurance: "Réassurance",
  newsletter: "Newsletter",
  custom_banner: "Bannière / Fidélité",
  links_group: "Groupe de liens",
  social_links: "Réseaux sociaux",
  custom_html: "HTML personnalisé",
  rich_text: "Texte riche",
};

const addableTypes: HomepageDraftSection["type"][] = [
  "product_list",
  "category_list",
  "brand_list",
  "custom_banner",
  "reassurance",
  "newsletter",
  "links_group",
  "social_links",
  "rich_text",
];

const makeSection = (
  type: HomepageDraftSection["type"],
  order: number
): HomepageDraftSection => {
  const id = crypto.randomUUID();
  const title = sectionLabels[type];
  const config: Record<string, unknown> =
    type === "product_list"
      ? {
          sourceType: "featured",
          productIds: [],
          layout: "carousel",
          hideIfEmpty: true,
          excludeOutOfStock: true,
        }
      : type === "category_list"
        ? { featuredOnly: true, categoryIds: [] }
        : type === "brand_list"
          ? { brandIds: [] }
          : type === "rich_text"
            ? { content: "Votre contenu" }
            : {};
  return {
    id,
    key: `section-${id.slice(0, 8)}`,
    type,
    title,
    subtitle: null,
    isActive: true,
    archivedAt: null,
    startsAt: null,
    endsAt: null,
    order,
    layout: type === "product_list" ? "carousel" : null,
    theme: null,
    ctaLabel: null,
    ctaLink: null,
    limit: type === "product_list" ? 8 : null,
    config,
  };
};

function Switch({ checked }: { checked: boolean }) {
  return (
    <span
      className={cn(
        "relative inline-flex h-6 w-11 shrink-0 rounded-full transition",
        checked ? "bg-blue-600" : "bg-slate-200"
      )}
    >
      <span
        className={cn(
          "absolute top-0.5 size-5 rounded-full bg-white shadow-sm transition",
          checked ? "left-[22px]" : "left-0.5"
        )}
      />
    </span>
  );
}

function SortableSectionRow({
  section,
  onSelect,
  onToggle,
  onDuplicate,
  onArchive,
}: {
  section: HomepageDraftSection;
  onSelect: () => void;
  onToggle: () => void;
  onDuplicate: () => void;
  onArchive: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: section.id });
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        "flex items-center gap-2 rounded-xl border border-slate-200 bg-white p-3",
        isDragging && "relative z-10 shadow-xl"
      )}
    >
      <button
        type="button"
        className="cursor-grab rounded-lg p-2 text-slate-400 hover:bg-slate-100 active:cursor-grabbing"
        aria-label={`Déplacer ${section.title}`}
        {...attributes}
        {...listeners}
      >
        <GripVertical className="size-4" />
      </button>
      <button type="button" onClick={onSelect} className="min-w-0 flex-1 text-left">
        <span className="block truncate text-sm font-semibold text-slate-900">{section.title}</span>
        <span className="block text-xs text-slate-500">{sectionLabels[section.type]}</span>
      </button>
      <button type="button" onClick={onToggle} aria-label="Activer ou désactiver">
        <Switch checked={section.isActive} />
      </button>
      <button
        type="button"
        onClick={onDuplicate}
        className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-900"
        aria-label="Dupliquer"
      >
        <Copy className="size-4" />
      </button>
      <button
        type="button"
        onClick={onArchive}
        className="rounded-lg p-2 text-slate-500 hover:bg-rose-50 hover:text-rose-600"
        aria-label="Archiver"
      >
        <Archive className="size-4" />
      </button>
    </div>
  );
}

export default function HomepageOrganizer({
  open,
  onOpenChange,
  snapshot,
  onChange,
  onSelect,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  snapshot: HomepageWorkspaceSnapshot;
  onChange: (snapshot: HomepageWorkspaceSnapshot) => void;
  onSelect: (sectionId: string) => void;
}) {
  const [newType, setNewType] = useState<HomepageDraftSection["type"]>("product_list");
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );
  const visible = snapshot.sections
    .filter((section) => !section.archivedAt)
    .sort((left, right) => left.order - right.order);
  const archived = snapshot.sections
    .filter((section) => Boolean(section.archivedAt))
    .sort((left, right) => left.order - right.order);

  const replaceSections = (sections: HomepageDraftSection[]) =>
    onChange({ ...snapshot, sections });

  const patchSection = (id: string, patch: Partial<HomepageDraftSection>) =>
    replaceSections(
      snapshot.sections.map((section) => (section.id === id ? { ...section, ...patch } : section))
    );

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    const oldIndex = visible.findIndex((section) => section.id === active.id);
    const newIndex = visible.findIndex((section) => section.id === over.id);
    const moved = arrayMove(visible, oldIndex, newIndex).map((section, index) => ({
      ...section,
      order: index,
    }));
    replaceSections([...moved, ...archived.map((section, index) => ({ ...section, order: moved.length + index }))]);
  };

  const duplicate = (section: HomepageDraftSection) => {
    const id = crypto.randomUUID();
    const copy: HomepageDraftSection = {
      ...section,
      id,
      key: `section-${id.slice(0, 8)}`,
      title: `${section.title} — copie`,
      order: visible.length,
      archivedAt: null,
    };
    replaceSections([...snapshot.sections, copy]);
    onSelect(copy.id);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-hidden p-0 sm:max-w-2xl">
        <DialogHeader className="border-b border-slate-200 px-6 py-5">
          <DialogTitle>Organiser la homepage</DialogTitle>
          <DialogDescription>
            Glissez les sections pour définir leur ordre public. Les changements restent en brouillon.
          </DialogDescription>
        </DialogHeader>

        <div className="overflow-y-auto px-6 py-5">
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
            <SortableContext items={visible.map((section) => section.id)} strategy={verticalListSortingStrategy}>
              <div className="space-y-2">
                {visible.map((section) => (
                  <SortableSectionRow
                    key={section.id}
                    section={section}
                    onSelect={() => {
                      onSelect(section.id);
                      onOpenChange(false);
                    }}
                    onToggle={() => patchSection(section.id, { isActive: !section.isActive })}
                    onDuplicate={() => duplicate(section)}
                    onArchive={() =>
                      patchSection(section.id, {
                        archivedAt: new Date().toISOString(),
                        isActive: false,
                      })
                    }
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>

          <div className="mt-5 flex gap-2 rounded-xl border border-dashed border-blue-200 bg-blue-50/60 p-3">
            <select
              value={newType}
              onChange={(event) => setNewType(event.target.value as HomepageDraftSection["type"])}
              className="h-10 min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-3 text-sm"
            >
              {addableTypes.map((type) => (
                <option key={type} value={type}>{sectionLabels[type]}</option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => {
                const section = makeSection(newType, visible.length);
                replaceSections([...snapshot.sections, section]);
                onSelect(section.id);
                onOpenChange(false);
              }}
              className="inline-flex h-10 items-center gap-2 rounded-lg bg-[#12377d] px-4 text-sm font-semibold text-white hover:bg-[#0d2c68]"
            >
              <Plus className="size-4" /> Ajouter
            </button>
          </div>

          {archived.length ? (
            <div className="mt-7 border-t border-slate-200 pt-5">
              <p className="mb-3 text-sm font-semibold text-slate-900">Éléments archivés ({archived.length})</p>
              <div className="space-y-2">
                {archived.map((section) => (
                  <div key={section.id} className="flex items-center gap-3 rounded-xl bg-slate-50 p-3">
                    <Archive className="size-4 text-slate-400" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-slate-700">{section.title}</p>
                      <p className="text-xs text-slate-400">{sectionLabels[section.type]}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => patchSection(section.id, { archivedAt: null, isActive: true })}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700"
                    >
                      <RotateCcw className="size-3.5" /> Désarchiver
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
