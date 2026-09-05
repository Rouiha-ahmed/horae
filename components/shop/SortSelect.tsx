import { ArrowUpDown, ChevronDown } from "lucide-react";
import type { SortOption } from "@/lib/queries";

const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: "relevance",  label: "Pertinence" },
  { value: "price_asc",  label: "Prix croissant" },
  { value: "price_desc", label: "Prix décroissant" },
  { value: "name_asc",   label: "Nom A → Z" },
  { value: "name_desc",  label: "Nom Z → A" },
];

interface Props {
  value: SortOption;
  onChange: (value: SortOption) => void;
  total: number;
}

export default function SortSelect({ value, onChange, total }: Props) {
  return (
    <div className="flex items-center justify-between gap-3">
      <p className="text-sm text-lightColor">
        <span className="font-semibold text-shop_dark_green">{total}</span>{" "}
        produit{total !== 1 ? "s" : ""}
      </p>

      <div className="relative inline-flex items-center">
        <div className="pointer-events-none absolute left-3.5 flex items-center">
          <ArrowUpDown className="h-3.5 w-3.5 text-shop_light_green" />
        </div>
        <select
          value={value}
          onChange={(e) => onChange(e.target.value as SortOption)}
          className="cursor-pointer appearance-none rounded-full border border-white/12 bg-[#071522] py-2 pl-9 pr-9 text-xs font-semibold text-shop_dark_green outline-none transition-colors hover:border-shop_light_green focus:border-shop_light_green focus:ring-2 focus:ring-shop_light_green/20"
        >
          {SORT_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        <div className="pointer-events-none absolute right-3 flex items-center">
          <ChevronDown className="h-3.5 w-3.5 text-shop_light_green" />
        </div>
      </div>
    </div>
  );
}
