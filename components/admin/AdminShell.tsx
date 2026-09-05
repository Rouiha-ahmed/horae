"use client";

import { useMemo, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";

import AdminHeader from "@/components/admin/AdminHeader";
import AdminSidebar, { buildAdminSidebarItems } from "@/components/admin/AdminSidebar";
import { cn } from "@/lib/utils";

type AdminShellProps = {
  displayName: string;
  email: string | null;
  pendingOrders: number;
  lowStockProducts: number;
  expiringPromoCodes: number;
  children: ReactNode;
};

const expandedPaddingClass = "lg:pl-[17.5rem]";
const collapsedPaddingClass = "lg:pl-[6.5rem]";

export default function AdminShell({
  displayName,
  email,
  pendingOrders,
  lowStockProducts,
  expiringPromoCodes,
  children,
}: AdminShellProps) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const items = useMemo(
    () =>
      buildAdminSidebarItems({
        pendingOrders,
        expiringPromoCodes,
      }),
    [expiringPromoCodes, pendingOrders]
  );

  const activeSection =
    items.find(
      (item) =>
        item.href === "/admin"
          ? pathname === item.href
          : pathname === item.href || pathname.startsWith(`${item.href}/`)
    )?.id || "dashboard";

  return (
    <div
      className="horae-admin min-h-screen text-slate-900"
      style={{
        backgroundImage:
          "radial-gradient(circle at top left, rgba(184, 163, 106, 0.14), transparent 28%), linear-gradient(180deg, #f8f8f3 0%, #f0efe8 100%)",
      }}
    >
      <AdminSidebar
        items={items}
        activeSection={activeSection}
        collapsed={collapsed}
        mobileOpen={mobileOpen}
        displayName={displayName}
        email={email}
        onToggleCollapsed={() => setCollapsed((current) => !current)}
        onMobileOpenChange={setMobileOpen}
      />

      <div
        className={cn(
          "min-h-screen transition-[padding] duration-300 ease-out",
          expandedPaddingClass,
          collapsed && collapsedPaddingClass
        )}
      >
        <AdminHeader
          items={items}
          activeSection={activeSection}
          displayName={displayName}
          pendingOrders={pendingOrders}
          lowStockProducts={lowStockProducts}
          expiringPromoCodes={expiringPromoCodes}
          onOpenMobileMenu={() => setMobileOpen(true)}
        />

        <main className="px-4 pb-10 pt-7 md:px-6 lg:px-8">
          <div className="mx-auto max-w-[1500px]">{children}</div>
        </main>
      </div>
    </div>
  );
}
