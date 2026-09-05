"use client";

import { AlertTriangle, Menu, Package, ShoppingBag } from "lucide-react";

import AdminUserButton from "@/components/admin/AdminUserButton";
import { Button } from "@/components/ui/button";
import type { AdminSidebarItem } from "@/components/admin/AdminSidebar";

type AdminHeaderProps = {
  items: AdminSidebarItem[];
  activeSection: string;
  displayName: string;
  pendingOrders: number;
  lowStockProducts: number;
  expiringPromoCodes: number;
  onOpenMobileMenu: () => void;
};

export default function AdminHeader({
  items,
  activeSection,
  pendingOrders,
  lowStockProducts,
  expiringPromoCodes,
  onOpenMobileMenu,
}: AdminHeaderProps) {
  const activeItem = items.find((item) => item.id === activeSection) || items[0];
  const hasAlerts = pendingOrders > 0 || lowStockProducts > 0 || expiringPromoCodes > 0;

  return (
    <header className="sticky top-0 z-30 border-b border-black/10 bg-[#F5F5F0]/92 backdrop-blur-md">
      <div className="flex h-12 items-center gap-3 px-4 md:px-6 lg:px-8">
        {/* Mobile menu */}
        <Button
          type="button"
          size="icon-sm"
          variant="outline"
          aria-label="Ouvrir le menu"
          className="shrink-0 rounded-xl border-slate-200 lg:hidden"
          onClick={onOpenMobileMenu}
        >
          <Menu className="h-4 w-4" />
        </Button>

        {/* Section label */}
        <span className="text-sm font-semibold text-slate-700">
          {activeItem.label}
        </span>

        <span className="hidden text-slate-300 sm:inline">·</span>
        <span className="hidden text-[10px] font-semibold uppercase tracking-[0.16em] text-shop_light_green sm:inline">HORAE Admin</span>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Compact alert pills */}
        <div className="hidden items-center gap-2 sm:flex">
          {pendingOrders > 0 && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700 ring-1 ring-inset ring-amber-200">
              <ShoppingBag className="h-3 w-3" />
              {pendingOrders}
            </span>
          )}
          {lowStockProducts > 0 && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 ring-1 ring-inset ring-emerald-200">
              <Package className="h-3 w-3" />
              {lowStockProducts}
            </span>
          )}
          {expiringPromoCodes > 0 && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-50 px-2.5 py-1 text-xs font-semibold text-rose-700 ring-1 ring-inset ring-rose-200">
              <AlertTriangle className="h-3 w-3" />
              {expiringPromoCodes}
            </span>
          )}
        </div>

        {/* User avatar */}
        <div className="shrink-0">
          <AdminUserButton size="sm" />
        </div>
      </div>

      {/* Mobile alert strip */}
      {hasAlerts && (
        <div className="flex items-center gap-2 border-t border-slate-100 bg-slate-50/80 px-4 py-1.5 sm:hidden">
          {pendingOrders > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-700 ring-1 ring-inset ring-amber-200">
              <ShoppingBag className="h-2.5 w-2.5" />
              {pendingOrders} a traiter
            </span>
          )}
          {lowStockProducts > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 ring-1 ring-inset ring-emerald-200">
              <Package className="h-2.5 w-2.5" />
              {lowStockProducts} stock
            </span>
          )}
          {expiringPromoCodes > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2 py-0.5 text-[11px] font-semibold text-rose-700 ring-1 ring-inset ring-rose-200">
              <AlertTriangle className="h-2.5 w-2.5" />
              {expiringPromoCodes} promos
            </span>
          )}
        </div>
      )}
    </header>
  );
}
