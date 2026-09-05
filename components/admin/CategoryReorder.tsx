"use client";

import React from "react";

type Category = { id: string; title: string; sortOrder?: number };

export default function CategoryReorder({
  categories,
}: {
  categories: Category[];
}) {
  const [items, setItems] = React.useState<Category[]>(
    [...categories].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
  );
  const [saving, setSaving] = React.useState(false);

  const move = (index: number, delta: number) => {
    const next = [...items];
    const to = index + delta;
    if (to < 0 || to >= next.length) return;
    const tmp = next[to];
    next[to] = next[index];
    next[index] = tmp;
    setItems(next);
  };

  const save = async () => {
    setSaving(true);
    try {
      const ids = items.map((i) => i.id);
      const res = await fetch("/api/admin/categories/reorder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids }),
      });

      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        alert(payload?.error || "Failed to save order");
        setSaving(false);
        return;
      }

      // reload to reflect changes
      window.location.reload();
    } catch (e) {
      console.error(e);
      alert("Failed to save order");
      setSaving(false);
    }
  };

  if (!items.length) return null;

  return (
    <div className="mb-6 rounded-[18px] border border-slate-200 bg-white p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Reorder categories</h3>
        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="rounded-md bg-shop_btn_dark_green px-3 py-1 text-xs text-white disabled:opacity-50"
        >
          {saving ? "Saving..." : "Save order"}
        </button>
      </div>

      <ul className="mt-3 space-y-2">
        {items.map((cat, i) => (
          <li
            key={cat.id}
            className="flex items-center justify-between rounded-lg border border-slate-100 px-3 py-2"
          >
            <div className="text-sm">{cat.title}</div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => move(i, -1)}
                className="rounded-md bg-slate-100 px-2 py-1 text-xs"
              >
                ↑
              </button>
              <button
                type="button"
                onClick={() => move(i, 1)}
                className="rounded-md bg-slate-100 px-2 py-1 text-xs"
              >
                ↓
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
