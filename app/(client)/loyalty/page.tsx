import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { Crown, Shield, Medal, Sparkles, CheckCircle2, Gift, Star, Zap, ArrowRight } from "lucide-react";
import Link from "next/link";
import Container from "@/components/Container";
import {
  getMyLoyaltyData,
} from "@/lib/queries";
import {
  TIER_LABELS,
  TIER_BENEFITS,
  TIER_THRESHOLDS,
  getPointsToNextTier,
} from "@/lib/loyalty";
import { cn } from "@/lib/utils";
import type { ElementType } from "react";
import type { LoyaltyTier } from "@prisma/client";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Ma carte fidélité",
};

// ─── tier visuals ─────────────────────────────────────────────────────────────

const TIER_STYLE: Record<LoyaltyTier, {
  gradient: string; text: string; icon: ElementType;
  ring: string; bar: string; badge: string; glow: string;
}> = {
  bronze: {
    gradient: "from-[#242424] to-[#0A0A0A]",
    text:     "text-white",
    icon:     Shield,
    ring:     "ring-amber-300/40",
    bar:      "bg-[#0A0A0A]",
    badge:    "bg-black text-white ring-black/10",
    glow:     "shadow-[0_24px_64px_-30px_rgba(10,10,10,0.55)]",
  },
  silver: {
    gradient: "from-[#d8d7d0] to-[#a8a69f]",
    text:     "text-black",
    icon:     Medal,
    ring:     "ring-slate-300/40",
    bar:      "bg-[#a8a69f]",
    badge:    "bg-[#d8d7d0] text-black ring-black/10",
    glow:     "shadow-[0_24px_64px_-20px_rgba(100,116,139,0.45)]",
  },
  gold: {
    gradient: "from-[#c5b37c] to-[#B8A36A]",
    text:     "text-black",
    icon:     Crown,
    ring:     "ring-shop_light_green/60",
    bar:      "bg-[#B8A36A]",
    badge:    "bg-shop_light_green text-black ring-black/10",
    glow:     "shadow-[0_24px_64px_-20px_rgba(234,179,8,0.55)]",
  },
};

const ALL_TIERS: LoyaltyTier[] = ["bronze", "silver", "gold"];

const dateFormatter = new Intl.DateTimeFormat("fr-MA", {
  day: "2-digit", month: "long", year: "numeric",
});

export default async function LoyaltyPage() {
  const { userId } = await auth();
  if (!userId) return redirect("/");

  const data = await getMyLoyaltyData(userId);

  // If no user record yet (first visit before any order), show the program info only
  const tier     = data?.loyaltyTier ?? "bronze";
  const points   = data?.loyaltyPoints ?? 0;
  const cardNum  = data?.loyaltyCardNumber ?? "—";
  const fullName = data?.fullName ?? "";
  const totalSpent = data?.totalSpent ?? 0;
  const memberSince = data?.createdAt ?? null;

  const style    = TIER_STYLE[tier];
  const TierIcon = style.icon;
  const { nextTier, pointsNeeded, progressPct } = getPointsToNextTier(points);
  const benefits = TIER_BENEFITS[tier];

  const initials = fullName
    ? fullName.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase()
    : "?";

  return (
    <div className="horae-page pb-24">
      <Container className="py-12 md:py-16">

        {/* ─── Page header ─── */}
        <div className="mb-12 border-b border-white/10 pb-8">
          <div className="horae-kicker inline-flex items-center gap-2 text-shop_light_green">
            <Star className="h-3.5 w-3.5" />
            Programme de fidélité HORAE
          </div>
          <h1 className="font-editorial mt-3 text-5xl font-light uppercase tracking-[-0.055em] text-shop_dark_green md:text-7xl">
            Ma Carte Fidélité
          </h1>
          <p className="mt-2 max-w-xl text-sm text-slate-500">
            Gagnez des points à chaque achat livré et déverrouillez des avantages exclusifs.
          </p>
        </div>

        <div className="grid gap-8 lg:grid-cols-[minmax(0,1.1fr)_360px]">

          {/* ══ LEFT COLUMN ══ */}
          <div className="space-y-6">

            {/* ─── Loyalty Card ─── */}
            <div
              className={cn(
                "relative overflow-hidden rounded-[28px] bg-gradient-to-br p-8",
                "ring-2 transition-all duration-300",
                style.gradient, style.ring, style.glow
              )}
            >
              {/* decorative circles */}
              <div className="pointer-events-none absolute -right-12 -top-12 h-56 w-56 rounded-full bg-white/10" />
              <div className="pointer-events-none absolute -bottom-10 -left-10 h-40 w-40 rounded-full bg-white/10" />
              <div className="pointer-events-none absolute right-20 bottom-6 h-20 w-20 rounded-full bg-black/5" />

              {/* top row */}
              <div className="relative flex items-start justify-between">
                <div>
                  <p className={cn("text-[11px] font-black uppercase tracking-[0.25em] opacity-75", style.text)}>
                    HORAE
                  </p>
                  <p className={cn("mt-1 text-[11px] uppercase tracking-wider opacity-50", style.text)}>
                    Carte de fidélité
                  </p>
                </div>
                <div className={cn("flex items-center gap-2 rounded-2xl bg-white/20 px-3.5 py-1.5 backdrop-blur-sm", style.text)}>
                  <TierIcon className="h-4 w-4" />
                  <span className="text-sm font-bold">{TIER_LABELS[tier]}</span>
                </div>
              </div>

              {/* avatar + name */}
              <div className="relative mt-8 flex items-center gap-4">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white/25 text-2xl font-black text-white backdrop-blur-sm">
                  {initials}
                </div>
                <div>
                  <p className={cn("text-xl font-bold", style.text)}>{fullName || "Mon compte"}</p>
                  {memberSince && (
                    <p className={cn("text-xs opacity-60", style.text)}>
                      Membre depuis {dateFormatter.format(new Date(memberSince))}
                    </p>
                  )}
                </div>
              </div>

              {/* card number + points */}
              <div className="relative mt-8 flex items-end justify-between">
                <div>
                  <p className={cn("font-mono text-lg font-bold tracking-[0.2em]", style.text)}>
                    {cardNum}
                  </p>
                  <p className={cn("mt-1 text-[11px] uppercase tracking-wider opacity-55", style.text)}>
                    Numéro de carte
                  </p>
                </div>
                <div className="text-right">
                  <p className={cn("text-4xl font-black", style.text)}>
                    {points.toLocaleString("fr-MA")}
                  </p>
                  <p className={cn("text-[11px] uppercase tracking-wider opacity-55", style.text)}>
                    points
                  </p>
                </div>
              </div>

              {/* divider + total spent */}
              <div className={cn("relative mt-6 border-t border-white/20 pt-4 flex items-center justify-between text-[11px] opacity-65", style.text)}>
                <span>Total dépensé : <strong>{totalSpent.toLocaleString("fr-MA")} MAD</strong></span>
                <Sparkles className="h-3.5 w-3.5" />
              </div>
            </div>

            {/* ─── Progress to next tier ─── */}
            <div className="rounded-[24px] border border-white/10 bg-[#071522]/70 p-6">
              <h2 className="text-sm font-bold text-slate-700">
                Progression vers le prochain palier
              </h2>

              {nextTier ? (
                <>
                  <div className="mt-5 flex items-center justify-between text-sm">
                    <span className={cn("inline-flex items-center gap-1.5 font-semibold", TIER_STYLE[tier].badge.split(" ").filter(c => c.startsWith("text")).join(" "))}>
                      {TIER_LABELS[tier]}
                    </span>
                    <span className={cn("inline-flex items-center gap-1.5 font-semibold", TIER_STYLE[nextTier].badge.split(" ").filter(c => c.startsWith("text")).join(" "))}>
                      {TIER_LABELS[nextTier]}
                    </span>
                  </div>
                  <div className="mt-2 h-3 overflow-hidden rounded-full bg-slate-100">
                    <div
                      className={cn("h-full rounded-full transition-all duration-700", style.bar)}
                      style={{ width: `${progressPct}%` }}
                    />
                  </div>
                  <div className="mt-3 flex items-start justify-between gap-4">
                    <p className="text-sm text-slate-600">
                      Encore{" "}
                      <strong className="text-shop_btn_dark_green">{pointsNeeded} points</strong>{" "}
                      pour atteindre le tier <strong>{TIER_LABELS[nextTier]}</strong>
                    </p>
                    <p className="shrink-0 text-xs text-slate-400">
                      ≈ {Math.ceil(pointsNeeded / 10) * 100} MAD d&apos;achat
                    </p>
                  </div>
                </>
              ) : (
                <div className="mt-4 flex items-center gap-3 border border-shop_light_green/30 bg-shop_light_green/10 px-5 py-4">
                  <Crown className="h-5 w-5 text-shop_light_green" />
                  <div>
                    <p className="text-sm font-bold text-shop_dark_green">Tier Gold atteint — félicitations !</p>
                    <p className="text-xs text-lightColor">Vous bénéficiez de tous les avantages VIP.</p>
                  </div>
                </div>
              )}

              {/* rule reminder */}
              <div className="mt-5 flex flex-wrap items-center gap-3 rounded-2xl bg-shop_btn_dark_green/5 px-4 py-3.5">
                <Zap className="h-4 w-4 shrink-0 text-shop_btn_dark_green" />
                <p className="text-xs text-shop_dark_green">
                  <strong>100 MAD</strong> dépensés (livré + payé) = <strong>10 points</strong>
                  {" "}&bull;{" "}
                  <strong className="text-amber-600">300 pts → Argent</strong>
                  {" "}&bull;{" "}
                  <strong className="text-shop_light_green">600 pts → Gold</strong>
                </p>
              </div>
            </div>

            {/* ─── Current tier benefits ─── */}
            <div className="rounded-[24px] border border-white/10 bg-[#071522]/70 p-6">
              <div className="flex items-center gap-2">
                <TierIcon className="h-4 w-4 text-shop_btn_dark_green" />
                <h2 className="text-sm font-bold text-slate-700">
                  Vos avantages {TIER_LABELS[tier]}
                </h2>
              </div>
              <ul className="mt-4 space-y-2.5">
                {benefits.map((b) => (
                  <li key={b} className="flex items-start gap-2.5 text-sm text-slate-700">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-shop_light_green" />
                    {b}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* ══ RIGHT COLUMN ══ */}
          <div className="space-y-5">

            {/* ─── All tiers roadmap ─── */}
            <div className="rounded-[24px] border border-white/10 bg-[#071522]/70 p-6">
              <h2 className="mb-4 text-sm font-bold text-slate-700">Les 3 paliers</h2>

              <div className="space-y-3">
                {ALL_TIERS.map((t) => {
                  const s = TIER_STYLE[t];
                  const Icon = s.icon;
                  const isActive = t === tier;
                  const threshold = TIER_THRESHOLDS[t];
                  const tierBenefits = TIER_BENEFITS[t];

                  return (
                    <div
                      key={t}
                      className={cn(
                        "relative overflow-hidden rounded-[22px] border p-4 transition-all",
                        isActive
                          ? cn("border-transparent bg-gradient-to-br ring-2", s.gradient, s.ring)
                          : "border-slate-200 bg-slate-50/60"
                      )}
                    >
                      {isActive && (
                        <div className="pointer-events-none absolute -right-6 -top-6 h-24 w-24 rounded-full bg-white/15" />
                      )}
                      <div className="relative flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <div className={cn(
                            "flex h-9 w-9 items-center justify-center rounded-xl",
                            isActive ? "bg-white/25" : "bg-white"
                          )}>
                            <Icon className={cn("h-4 w-4", isActive ? s.text : "text-slate-500")} />
                          </div>
                          <div>
                            <p className={cn("text-sm font-bold", isActive ? s.text : "text-slate-700")}>
                              Tier {TIER_LABELS[t]}
                            </p>
                            <p className={cn("text-xs", isActive ? cn(s.text, "opacity-70") : "text-slate-400")}>
                              {threshold === 0 ? "Dès l'inscription" : `À partir de ${threshold} points`}
                            </p>
                          </div>
                        </div>
                        {isActive && (
                          <span className="rounded-full bg-white/30 px-2.5 py-1 text-[10px] font-bold text-white backdrop-blur-sm">
                            Actuel
                          </span>
                        )}
                      </div>
                      <div className={cn("relative mt-3 space-y-1", isActive ? "opacity-90" : "")}>
                        {tierBenefits.slice(0, 2).map((b) => (
                          <p key={b} className={cn("flex items-start gap-1.5 text-xs", isActive ? s.text : "text-slate-500")}>
                            <CheckCircle2 className="mt-0.5 h-3 w-3 shrink-0" />
                            {b}
                          </p>
                        ))}
                        {tierBenefits.length > 2 && (
                          <p className={cn("text-xs opacity-60", isActive ? s.text : "text-slate-400")}>
                            + {tierBenefits.length - 2} autre(s) avantage(s)
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* ─── How it works ─── */}
            <div className="rounded-[24px] border border-white/10 bg-[#071522]/70 p-6">
              <div className="flex items-center gap-2 mb-4">
                <Gift className="h-4 w-4 text-shop_btn_dark_green" />
                <h2 className="text-sm font-bold text-slate-700">Comment ça marche ?</h2>
              </div>
              <ol className="space-y-4">
                {[
                  {
                    n: "1",
                    title: "Faites vos achats",
                    desc: "Commandez vos produits préférés sur HORAE.",
                  },
                  {
                    n: "2",
                    title: "Commande livrée & payée",
                    desc: "Les points sont crédités uniquement à la livraison effective.",
                  },
                  {
                    n: "3",
                    title: "100 MAD = 10 points",
                    desc: "Points calculés automatiquement sur le montant total.",
                  },
                  {
                    n: "4",
                    title: "Montez en tier",
                    desc: "300 pts → Argent · 600 pts → Gold et avantages VIP.",
                  },
                ].map((step) => (
                  <li key={step.n} className="flex items-start gap-3">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-shop_btn_dark_green/10 text-xs font-bold text-shop_btn_dark_green">
                      {step.n}
                    </span>
                    <div>
                      <p className="text-sm font-semibold text-slate-800">{step.title}</p>
                      <p className="mt-0.5 text-xs text-slate-500">{step.desc}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </div>

            {/* ─── CTA ─── */}
            <Link
              href="/shop"
              className="flex items-center justify-between rounded-[20px] border border-shop_light_green/35 bg-sky-400/[0.04] px-5 py-4 transition hover:bg-shop_light_green/10"
            >
              <div>
                <p className="text-sm font-bold text-shop_dark_green">Gagnez plus de points</p>
                <p className="mt-0.5 text-xs text-slate-500">Découvrir nos produits</p>
              </div>
              <ArrowRight className="h-4 w-4 text-shop_btn_dark_green" />
            </Link>
          </div>
        </div>
      </Container>
    </div>
  );
}
