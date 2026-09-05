"use client";

import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import {
  ChevronLeft,
  House,
  LayoutDashboard,
  Package2,
  Percent,
  ShoppingBag,
  Store,
  Tag,
  Users,
  X,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import AdminUserButton from "@/components/admin/AdminUserButton";
import { cn } from "@/lib/utils";

export type AdminSidebarItem = {
  id: string;
  label: string;
  description: string;
  href: string;
  actionHref?: string;
  actionLabel?: string;
  icon: LucideIcon;
  badge?: number;
  badgeTone?: string;
};

export const buildAdminSidebarItems = (metrics: {
  pendingOrders: number;
  expiringPromoCodes: number;
}) => [
  {
    id: "dashboard",
    label: "Dashboard",
    description: "Vue globale, activite recente et raccourcis utiles",
    href: "/admin",
    actionHref: "/admin/orders",
    actionLabel: "Voir les commandes",
    icon: LayoutDashboard,
  },
  {
    id: "orders",
    label: "Commandes",
    description: "Suivi, details client et mise a jour des statuts",
    href: "/admin/orders",
    actionHref: "/admin/orders#orders-list",
    actionLabel: "Ouvrir la liste",
    icon: ShoppingBag,
    badge: metrics.pendingOrders || undefined,
    badgeTone: "bg-amber-400/15 text-amber-100 ring-amber-300/30",
  },
  {
    id: "homepage",
    label: "Homepage",
    description: "Contenu hero, liens, confiance et sections dynamiques",
    href: "/admin/homepage",
    actionHref: "/admin/homepage#general-settings",
    actionLabel: "Configurer l'accueil",
    icon: House,
  },
  {
    id: "products",
    label: "Produits",
    description: "Catalogue, photos, stock et mise en avant",
    href: "/admin/products",
    actionHref: "/admin/products#new-product",
    actionLabel: "Ajouter un produit",
    icon: Package2,
  },
  {
    id: "categories",
    label: "Categories",
    description: "Organisation des rayons et univers de vente",
    href: "/admin/categories",
    actionHref: "/admin/categories#new-category",
    actionLabel: "Ajouter une categorie",
    icon: Tag,
  },
  {
    id: "brands",
    label: "Marques",
    description: "Marques, logos et partenaires du catalogue",
    href: "/admin/brands",
    actionHref: "/admin/brands?drawer=create",
    actionLabel: "Ajouter une marque",
    icon: Store,
  },
  {
    id: "promos",
    label: "Codes promo",
    description: "Remises actives, expirations et campagnes",
    href: "/admin/promos",
    actionHref: "/admin/promos#new-promo",
    actionLabel: "Creer une promo",
    icon: Percent,
    badge: metrics.expiringPromoCodes || undefined,
    badgeTone: "bg-rose-400/15 text-rose-100 ring-rose-300/30",
  },
  {
    id: "clients",
    label: "Clients & fidélité",
    description: "Profils, fidélité, points et historique commandes",
    href: "/admin/clients",
    actionHref: "/admin/clients",
    actionLabel: "Voir les clients",
    icon: Users,
  },
] satisfies AdminSidebarItem[];

type AdminSidebarProps = {
  items: AdminSidebarItem[];
  activeSection: string;
  collapsed: boolean;
  mobileOpen: boolean;
  displayName: string;
  email: string | null;
  onToggleCollapsed: () => void;
  onMobileOpenChange: (next: boolean) => void;
};

const expandedWidthClass = "lg:w-[17.5rem]";
const collapsedWidthClass = "lg:w-[6.5rem]";

export default function AdminSidebar({
  items,
  activeSection,
  collapsed,
  mobileOpen,
  displayName,
  email,
  onToggleCollapsed,
  onMobileOpenChange,
}: AdminSidebarProps) {
  return (
    <>
      {mobileOpen ? (
        <button
          type="button"
          aria-label="Fermer le menu admin"
          className="fixed inset-0 z-40 bg-slate-950/55 backdrop-blur-[2px] lg:hidden"
          onClick={() => onMobileOpenChange(false)}
        />
      ) : null}

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-[17.5rem] flex-col border-r border-white/12 text-white shadow-[0_30px_90px_-50px_rgba(16,38,84,0.95)] transition-transform duration-300 ease-out lg:translate-x-0",
          expandedWidthClass,
          collapsed && collapsedWidthClass,
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        )}
        style={{
          backgroundImage:
            "radial-gradient(circle at top left, rgba(184,163,106,0.18), transparent 32%), linear-gradient(180deg, #14130f 0%, #0A0A0A 70%)",
        }}
      >
        <div className="relative flex h-full flex-col overflow-hidden">
          <div className="absolute inset-x-0 top-0 h-48 bg-[radial-gradient(circle_at_top_left,rgba(77,182,198,0.28),transparent_55%)]" />

          <div className="relative flex items-center justify-between gap-3 border-b border-white/10 px-4 py-4 lg:px-5">
            <div
              className={cn(
                "transition-all duration-300",
                collapsed ? "w-0 overflow-hidden opacity-0" : "opacity-100"
              )}
            >
              <p className="text-[9px] font-semibold uppercase tracking-[0.28em] text-shop_light_green">
                Espace Admin
              </p>
              <Link href="/admin" className="font-editorial mt-1 block text-2xl font-semibold tracking-[0.08em]">
                HORAE
              </Link>
            </div>

            <div className="flex items-center gap-2">
              <Button
                type="button"
                size="icon-sm"
                variant="ghost"
                aria-label={collapsed ? "Agrandir la barre laterale" : "Reduire la barre laterale"}
                className="hidden rounded-2xl border border-white/10 bg-white/8 text-white hover:bg-white/12 hover:text-white lg:inline-flex"
                onClick={onToggleCollapsed}
              >
                <ChevronLeft className={cn("h-4 w-4 transition-transform", collapsed && "rotate-180")} />
              </Button>
              <Button
                type="button"
                size="icon-sm"
                variant="ghost"
                aria-label="Fermer le menu"
                className="rounded-2xl border border-white/10 bg-white/8 text-white hover:bg-white/12 hover:text-white lg:hidden"
                onClick={() => onMobileOpenChange(false)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="relative flex-1 overflow-y-auto px-3 py-5 lg:px-4">
            <div
              className={cn(
                "mb-5 border border-white/12 bg-white/[0.04] p-4 transition-all duration-300",
                collapsed && "px-2 py-3"
              )}
            >
              <div className={cn("flex items-start gap-3", collapsed && "justify-center")}>
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white/10 ring-1 ring-white/12">
                  <Store className="h-5 w-5 text-shop_light_green" />
                </span>
                <div
                  className={cn(
                    "min-w-0 transition-all duration-300",
                    collapsed ? "w-0 overflow-hidden opacity-0" : "opacity-100"
                  )}
                >
                  <p className="text-sm font-semibold text-white">Boutique active</p>
                  <p className="mt-1 text-xs leading-5 text-white/65">
                    Pilotez commandes, catalogue et promotions depuis la meme interface.
                  </p>
                </div>
              </div>
            </div>

            <nav className="space-y-1.5" aria-label="Navigation admin">
              {items.map((item) => {
                const Icon = item.icon;
                const isActive = activeSection === item.id;

                return (
                  <Link
                    key={item.id}
                    href={item.href}
                    aria-current={isActive ? "page" : undefined}
                    className={cn(
                      "group flex items-center gap-3 rounded-[2px] px-3 py-3 text-sm transition-all duration-200",
                      isActive
                        ? "bg-shop_light_green text-black"
                        : "text-white/72 hover:bg-white/10 hover:text-white",
                      collapsed && "justify-center px-2"
                    )}
                    onClick={() => onMobileOpenChange(false)}
                  >
                    <span
                      className={cn(
                        "flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl transition-colors",
                        isActive
                          ? "bg-black/10 text-black"
                          : "bg-white/8 text-white/82 group-hover:bg-white/12 group-hover:text-white"
                      )}
                    >
                      <Icon className="h-5 w-5" />
                    </span>

                    <div
                      className={cn(
                        "min-w-0 flex-1 transition-all duration-300",
                        collapsed ? "w-0 overflow-hidden opacity-0" : "opacity-100"
                      )}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate font-semibold">{item.label}</span>
                        {item.badge ? (
                          <Badge
                            className={cn(
                              "rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset",
                              isActive
                                ? "bg-black/8 text-black ring-black/12"
                                : item.badgeTone || "bg-white/10 text-white ring-white/15"
                            )}
                          >
                            {item.badge}
                          </Badge>
                        ) : null}
                      </div>
                      <p className={cn("mt-0.5 truncate text-xs", isActive ? "text-black/60" : "text-white/50")}>
                        {item.description}
                      </p>
                    </div>
                  </Link>
                );
              })}
            </nav>
          </div>

          <div className="relative border-t border-white/10 px-3 py-4 lg:px-4">
            <div
              className={cn(
                "rounded-[24px] border border-white/12 bg-white/8 p-3 transition-all duration-300",
                collapsed && "px-2"
              )}
            >
              <div className={cn("flex items-center gap-3", collapsed && "justify-center")}>
                <div className="shrink-0 rounded-full border border-white/12 bg-white/10 p-1">
                  <AdminUserButton size="md" />
                </div>
                <div
                  className={cn(
                    "min-w-0 transition-all duration-300",
                    collapsed ? "w-0 overflow-hidden opacity-0" : "opacity-100"
                  )}
                >
                  <p className="truncate text-sm font-semibold text-white">{displayName}</p>
                  <p className="truncate text-xs text-white/55">{email || "Compte admin"}</p>
                </div>
              </div>

              {!collapsed ? (
                <Link
                  href="/"
                  className="mt-3 inline-flex w-full items-center justify-center rounded-2xl border border-white/12 bg-white/8 px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-white/12"
                >
                  Voir la boutique
                </Link>
              ) : null}
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}
