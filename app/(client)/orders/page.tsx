import Container from "@/components/Container";
import OrderStatusAutoRefresh from "@/components/OrderStatusAutoRefresh";
import OrdersComponent from "@/components/OrdersComponent";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Table, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getMyLoyaltyData, getMyOrders } from "@/lib/queries";
import { TIER_LABELS, getPointsToNextTier } from "@/lib/loyalty";
import { auth } from "@clerk/nextjs/server";
import { Crown, FileX, Medal, Shield, Star } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import React from "react";
import type { LoyaltyTier } from "@prisma/client";

const TIER_COLORS: Record<LoyaltyTier, { gradient: string; text: string; pill: string }> = {
  bronze: {
    gradient: "from-[#232323] to-[#0A0A0A]",
    text: "text-white",
    pill: "bg-black text-white ring-1 ring-black/10",
  },
  silver: {
    gradient: "from-[#d8d7d0] to-[#a8a69f]",
    text: "text-black",
    pill: "bg-[#d8d7d0] text-black ring-1 ring-black/10",
  },
  gold: {
    gradient: "from-[#c5b37c] to-[#B8A36A]",
    text: "text-black",
    pill: "bg-shop_light_green text-black ring-1 ring-black/10",
  },
};

const TIER_ICONS: Record<LoyaltyTier, React.ElementType> = {
  bronze: Shield,
  silver: Medal,
  gold: Crown,
};

export const dynamic = "force-dynamic";

const OrdersPage = async () => {
  const { userId } = await auth();
  if (!userId) {
    return redirect("/");
  }

  const [orders, loyalty] = await Promise.all([
    getMyOrders(userId),
    getMyLoyaltyData(userId),
  ]);

  const tier = loyalty?.loyaltyTier ?? "bronze";
  const points = loyalty?.loyaltyPoints ?? 0;
  const tierColors = TIER_COLORS[tier];
  const TierIcon = TIER_ICONS[tier];
  const { nextTier, pointsNeeded, progressPct } = getPointsToNextTier(points);

  return (
    <div className="horae-page pb-24">
      <OrderStatusAutoRefresh />
      <Container className="py-12 md:py-16">
        <div className="mb-10 border-b border-white/10 pb-8">
          <p className="horae-kicker text-shop_light_green">Votre espace</p>
          <h1 className="font-editorial mt-3 text-5xl font-light uppercase tracking-[-0.055em] md:text-7xl">Mes commandes.</h1>
        </div>
        {/* ─── Loyalty mini-banner ─── */}
        <Link
          href="/loyalty"
          className="mb-8 flex items-center gap-4 overflow-hidden rounded-[24px] border border-shop_light_green/35 p-px transition hover:border-shop_light_green"
        >
          <div className="flex w-full items-center gap-4 rounded-[23px] bg-[#071522]/82 px-5 py-4">
            {/* tier card swatch */}
            <div className={`hidden sm:flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br ${tierColors.gradient}`}>
              <TierIcon className="h-5 w-5 text-white" />
            </div>

            {/* info */}
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold ${tierColors.pill}`}>
                  <TierIcon className="h-3 w-3" />
                  {TIER_LABELS[tier]}
                </span>
                <span className="text-sm font-bold text-shop_dark_green">
                  {points.toLocaleString("fr-MA")} points
                </span>
              </div>
              {nextTier ? (
                <div className="mt-2 flex items-center gap-2">
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100">
                    <div
                      className="h-full rounded-full bg-shop_btn_dark_green transition-all"
                      style={{ width: `${progressPct}%` }}
                    />
                  </div>
                  <p className="shrink-0 text-[11px] text-slate-500">
                    {pointsNeeded} pts → {TIER_LABELS[nextTier]}
                  </p>
                </div>
              ) : (
                <p className="mt-1 text-[11px] font-semibold text-shop_light_green">
                  Tier Gold atteint — tous les avantages VIP débloqués !
                </p>
              )}
            </div>

            {/* CTA */}
            <div className="hidden shrink-0 items-center gap-1.5 rounded-xl bg-shop_btn_dark_green/10 px-3 py-2 text-xs font-semibold text-shop_btn_dark_green sm:flex">
              <Star className="h-3.5 w-3.5" />
              Voir ma carte
            </div>
          </div>
        </Link>
        {orders?.length ? (
          <Card className="w-full overflow-hidden rounded-[24px] border border-white/10 bg-[#071522]/70 shadow-none">
            <CardHeader className="border-b border-shop_light_green/15">
              <CardTitle className="text-xl text-shop_dark_green">
                Liste des commandes
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea>
                <Table>
                  <TableHeader className="bg-shop_light_green/5">
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="w-25 md:w-auto text-[11px] uppercase tracking-wide text-shop_dark_green/80">
                        Numero de commande
                      </TableHead>
                      <TableHead className="hidden md:table-cell text-[11px] uppercase tracking-wide text-shop_dark_green/80">
                        Date
                      </TableHead>
                      <TableHead className="text-[11px] uppercase tracking-wide text-shop_dark_green/80">
                        Client
                      </TableHead>
                      <TableHead className="hidden sm:table-cell text-[11px] uppercase tracking-wide text-shop_dark_green/80">
                        Email
                      </TableHead>
                      <TableHead className="text-[11px] uppercase tracking-wide text-shop_dark_green/80">
                        Total
                      </TableHead>
                      <TableHead className="text-[11px] uppercase tracking-wide text-shop_dark_green/80">
                        Statut
                      </TableHead>
                      <TableHead className="text-[11px] uppercase tracking-wide text-shop_dark_green/80">
                        Paiement
                      </TableHead>
                      <TableHead className="hidden sm:table-cell text-[11px] uppercase tracking-wide text-shop_dark_green/80">
                        Numero de facture
                      </TableHead>
                      <TableHead className="text-center text-[11px] uppercase tracking-wide text-shop_dark_green/80">
                        Action
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <OrdersComponent orders={orders} />
                </Table>
                <ScrollBar orientation="horizontal" />
              </ScrollArea>
            </CardContent>
          </Card>
        ) : (
          <div className="flex flex-col items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
            <FileX className="h-24 w-24 text-gray-400 mb-4" />
            <h2 className="text-2xl font-medium text-shop_dark_green">
              Aucune commande trouvee
            </h2>
            <p className="mt-2 max-w-md text-center text-sm text-lightColor">
              Vous n&apos;avez pas encore passe de commande. Commencez vos
              achats pour voir vos commandes ici !
            </p>
            <Button asChild className="horae-button mt-6">
              <Link href="/">Parcourir les produits</Link>
            </Button>
          </div>
        )}
      </Container>
    </div>
  );
};

export default OrdersPage;
