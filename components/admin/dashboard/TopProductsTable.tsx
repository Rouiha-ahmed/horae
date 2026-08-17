"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowUpRight } from "lucide-react";

import type { PilotageProductRow } from "@/lib/dashboard/admin-data";
import { cn } from "@/lib/utils";

const currency = new Intl.NumberFormat("fr-MA", {
  style: "currency",
  currency: "MAD",
  maximumFractionDigits: 0,
});
const number = new Intl.NumberFormat("fr-MA");

export default function TopProductsTable({ products }: { products: PilotageProductRow[] }) {
  const [sortBy, setSortBy] = useState<"revenue" | "units">("revenue");
  const rows = useMemo(
    () =>
      [...products]
        .sort((left, right) => right[sortBy] - left[sortBy])
        .slice(0, 5),
    [products, sortBy],
  );

  return (
    <div>
      <div className="mb-4 flex rounded-xl bg-slate-100 p-1" aria-label="Classement des produits">
        {(["revenue", "units"] as const).map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => setSortBy(value)}
            aria-pressed={sortBy === value}
            className={cn(
              "flex-1 rounded-lg px-3 py-2 text-xs font-semibold",
              sortBy === value ? "bg-white text-blue-900 shadow-sm" : "text-slate-500",
            )}
          >
            {value === "revenue" ? "Par CA" : "Par unités"}
          </button>
        ))}
      </div>
      {rows.length ? (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[500px] text-left text-sm">
            <thead className="text-[11px] uppercase tracking-[.08em] text-slate-500">
              <tr><th className="pb-3">Produit</th><th className="pb-3">CA</th><th className="pb-3">Unités</th><th className="pb-3">Tendance</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((product, index) => {
                const trend = sortBy === "revenue" ? product.revenueTrend : product.unitsTrend;
                return (
                  <tr key={`${product.productId || product.name}-${index}`}>
                    <td className="py-3 pr-3 font-semibold text-slate-900">
                      {product.href ? (
                        <Link href={product.href} className="inline-flex items-center gap-1 hover:text-blue-700 hover:underline">
                          {product.name}<ArrowUpRight className="h-3.5 w-3.5" />
                        </Link>
                      ) : product.name}
                    </td>
                    <td className="py-3 pr-3">{currency.format(product.revenue)}</td>
                    <td className="py-3 pr-3">{number.format(product.units)}</td>
                    <td className={cn("py-3 font-semibold", trend > 0 ? "text-emerald-700" : trend < 0 ? "text-rose-700" : "text-slate-500")}>{trend > 0 ? "+" : ""}{number.format(Math.round(trend))} %</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : <p className="rounded-2xl border border-dashed border-slate-300 px-4 py-8 text-center text-sm text-slate-500">Aucune vente encaissée sur cette période.</p>}
    </div>
  );
}
