import Link from "next/link";
import { Download, Plus, RefreshCw } from "lucide-react";

import PilotageDashboard from "@/components/admin/dashboard/PilotageDashboard";
import TodayDashboard from "@/components/admin/dashboard/TodayDashboard";
import {
  getAdminPilotageDashboard,
  getAdminTodayDashboard,
} from "@/lib/dashboard/admin-data";
import {
  DASHBOARD_PERIODS,
  parseDashboardMode,
  parseDashboardPeriod,
} from "@/lib/dashboard/domain";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const dayFormatter = new Intl.DateTimeFormat("fr-MA", {
  timeZone: "Africa/Casablanca",
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
});

export default async function AdminPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const mode = parseDashboardMode(params.mode);
  const period = parseDashboardPeriod(params.period);
  let loadError: string | null = null;
  let todayData = null;
  let pilotageData = null;

  try {
    if (mode === "today") todayData = await getAdminTodayDashboard();
    else pilotageData = await getAdminPilotageDashboard(period);
  } catch (error) {
    console.error("Failed to load admin dashboard", error);
    loadError = "Les données du Dashboard n’ont pas pu être chargées. Réessayez dans quelques instants.";
  }

  const generatedAt = todayData?.generatedAt || pilotageData?.generatedAt || new Date().toISOString();

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[.18em] text-slate-400">Vue d’ensemble</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">Dashboard</h1>
          <p className="mt-2 text-sm text-slate-600">
            {mode === "today"
              ? "Tour de contrôle quotidienne de la boutique"
              : "Pilotage de la performance et aide à la décision"}
          </p>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <nav className="inline-flex rounded-2xl border border-slate-200 bg-white p-1 shadow-sm" aria-label="Mode du Dashboard">
            <Link
              href="/admin"
              aria-current={mode === "today" ? "page" : undefined}
              className={cn(
                "rounded-xl px-5 py-2.5 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500",
                mode === "today" ? "bg-blue-900 text-white shadow-sm" : "text-slate-600 hover:bg-slate-50",
              )}
            >
              Aujourd’hui
            </Link>
            <Link
              href={`/admin?mode=pilotage&period=${period}`}
              aria-current={mode === "pilotage" ? "page" : undefined}
              className={cn(
                "rounded-xl px-5 py-2.5 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500",
                mode === "pilotage" ? "bg-blue-900 text-white shadow-sm" : "text-slate-600 hover:bg-slate-50",
              )}
            >
              Pilotage
            </Link>
          </nav>

          {mode === "today" ? (
            <div className="flex items-center gap-2">
              <span className="whitespace-nowrap rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-600">
                {dayFormatter.format(new Date(generatedAt))}
              </span>
              <Link href="/admin" title="Actualiser" aria-label="Actualiser le Dashboard" className="flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"><RefreshCw className="h-4 w-4" /></Link>
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-2">
              <form method="get" className="flex items-center gap-2">
                <input type="hidden" name="mode" value="pilotage" />
                <select name="period" defaultValue={period} aria-label="Période d’analyse" className="h-11 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700">
                  {DASHBOARD_PERIODS.map((value) => <option key={value} value={value}>{value} derniers jours</option>)}
                </select>
                <button type="submit" className="h-11 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50">Appliquer</button>
              </form>
              <span className="h-11 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-xs font-medium text-slate-500">vs période précédente</span>
              <Link href={`/admin/export/dashboard?period=${period}`} className="inline-flex h-11 items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50"><Download className="h-4 w-4" />Exporter</Link>
            </div>
          )}
        </div>
      </header>

      <div className="flex flex-wrap gap-2">
        <Link href="/admin/orders?sort=priority" className="inline-flex h-10 items-center gap-2 rounded-xl bg-shop_btn_dark_green px-4 text-sm font-semibold text-white hover:bg-shop_btn_dark_green/90"><RefreshCw className="h-4 w-4" />Traiter les commandes</Link>
        <Link href="/admin/products" className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50"><Plus className="h-4 w-4" />Ajouter un produit</Link>
      </div>

      {loadError ? (
        <div role="alert" className="rounded-[24px] border border-rose-200 bg-rose-50 px-5 py-8 text-center text-sm text-rose-800">
          <p className="font-semibold">Dashboard indisponible</p><p className="mt-2">{loadError}</p><Link href={mode === "today" ? "/admin" : `/admin?mode=pilotage&period=${period}`} className="mt-4 inline-flex items-center gap-2 font-semibold underline"><RefreshCw className="h-4 w-4" />Réessayer</Link>
        </div>
      ) : mode === "today" && todayData ? (
        <TodayDashboard data={todayData} />
      ) : pilotageData ? (
        <PilotageDashboard data={pilotageData} />
      ) : null}
    </div>
  );
}
