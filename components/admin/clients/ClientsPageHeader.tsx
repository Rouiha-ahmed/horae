import { Bell, CircleHelp, Search, UsersRound } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import ClientsNav from "@/components/admin/clients/ClientsNav";

export default function ClientsPageHeader({
  description,
  actions,
}: {
  description: string;
  actions?: ReactNode;
}) {
  return (
    <section className="rounded-[28px] border border-white/80 bg-white/88 p-5 shadow-[0_18px_60px_-48px_rgba(15,23,42,0.45)] backdrop-blur md:p-6">
      <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
        <div className="flex min-w-0 items-start gap-4">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-cyan-50 text-cyan-600 ring-1 ring-cyan-100">
            <UsersRound className="h-5 w-5" />
          </span>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-[#0f1d42] md:text-[30px]">
              Clients &amp; fidélité
            </h1>
            <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-500">{description}</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <form action="/admin/clients/list" className="relative min-w-[240px] flex-1 xl:w-[320px]">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              name="search"
              aria-label="Rechercher un client"
              placeholder="Rechercher (nom, email, téléphone…)"
              className="h-10 w-full rounded-2xl border border-slate-200 bg-white pl-10 pr-4 text-xs outline-none transition focus:border-[#162e6e] focus:ring-4 focus:ring-blue-100"
            />
          </form>
          <Link href="/admin/clients/quality" aria-label="Notifications clients" className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 hover:text-blue-600"><Bell className="h-4 w-4" /></Link>
          <a href="mailto:support@zayna.ma?subject=Aide%20Clients%20%26%20fid%C3%A9lit%C3%A9" aria-label="Aide Clients et fidélité" className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 hover:text-blue-600"><CircleHelp className="h-4 w-4" /></a>
          {actions}
        </div>
      </div>
      <div className="mt-5 border-t border-slate-100 pt-3">
        <ClientsNav />
      </div>
    </section>
  );
}
