"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

const items = [
  { href: "/admin/clients", label: "Vue d’ensemble", exact: true },
  { href: "/admin/clients/list", label: "Liste clients" },
  { href: "/admin/clients/segments", label: "Segments" },
  { href: "/admin/clients/quality", label: "Qualité" },
  { href: "/admin/clients/settings", label: "Paramètres fidélité" },
];

export default function ClientsNav() {
  const pathname = usePathname();
  return (
    <nav className="-mx-1 flex gap-1 overflow-x-auto px-1" aria-label="Clients et fidélité">
      {items.map((item) => {
        const active = item.exact ? pathname === item.href : pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "shrink-0 rounded-xl px-3.5 py-2 text-xs font-semibold transition-colors",
              active
                ? "bg-[#162e6e] text-white shadow-sm"
                : "text-slate-500 hover:bg-slate-100 hover:text-slate-900",
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
