"use client";

import { useHydrated } from "@/hooks";
import { SignInButton, UserButton, useAuth } from "@clerk/nextjs";
import { LayoutDashboard, Logs, Star, UserRound } from "lucide-react";
import Link from "next/link";
import React, { useEffect, useState } from "react";
import CartIcon from "./CartIcon";
import FavoriteButton from "./FavoriteButton";
import SearchBar from "./SearchBar";
import SignIn from "./SignIn";

type NavigationContext = {
  ordersCount: number;
  isAdmin: boolean;
};

const iconButtonClassName =
  "group relative inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/[0.035] text-white/68 transition-all duration-300 ease-out hover:-translate-y-0.5 hover:border-shop_light_green/70 hover:bg-shop_light_green hover:text-[#02101b]";

const HeaderDesktopNav = () => {
  const { isLoaded, userId } = useAuth();
  const mounted = useHydrated();
  const [navigationContext, setNavigationContext] = useState<NavigationContext>({
    ordersCount: 0,
    isAdmin: false,
  });

  useEffect(() => {
    if (!isLoaded) return;

    if (!userId) {
      setNavigationContext({ ordersCount: 0, isAdmin: false });
      return;
    }

    let cancelled = false;

    const loadNavigationContext = async () => {
      try {
        // max-age=30 means the browser reuses the cached response for 30s
        // across soft navigations — no DB call until the cache expires
        const response = await fetch("/api/navigation", {
          cache: "default",
          next: { revalidate: 30 },
        } as RequestInit);

        if (!response.ok) throw new Error(`${response.status}`);

        const data = (await response.json()) as NavigationContext;
        if (!cancelled) {
          setNavigationContext({
            ordersCount: data.ordersCount || 0,
            isAdmin: Boolean(data.isAdmin),
          });
        }
      } catch {
        if (!cancelled) {
          setNavigationContext({ ordersCount: 0, isAdmin: false });
        }
      }
    };

    loadNavigationContext();
    return () => { cancelled = true; };
  }, [isLoaded, userId]);

  const isAuthReady = mounted && isLoaded;
  const isSignedIn = isAuthReady && Boolean(userId);
  const { ordersCount, isAdmin } = navigationContext;

  return (
    <>
      <div className="hidden items-center gap-2 lg:flex">
        <SearchBar mode="desktop" />
        <CartIcon className={iconButtonClassName} iconClassName="h-4.5 w-4.5" />
        <FavoriteButton className={iconButtonClassName} iconClassName="h-4.5 w-4.5" />

        {isSignedIn ? (
          <Link href="/orders" className={iconButtonClassName}>
            <Logs className="h-4.5 w-4.5" />
            <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-shop_btn_dark_green px-1 text-[10px] font-semibold text-white">
              {ordersCount}
            </span>
          </Link>
        ) : null}

        {isSignedIn ? (
          <Link
            href="/loyalty"
            title="Ma carte fidélité"
            className={iconButtonClassName}
          >
            <Star className="h-4.5 w-4.5" />
          </Link>
        ) : null}

        {isAdmin ? (
          <Link
            href="/admin"
            className="group inline-flex h-9 items-center gap-2 rounded-full border border-white/10 bg-white/[0.035] px-3 text-[9px] font-semibold uppercase tracking-[0.14em] text-white/70 transition-all duration-300 hover:-translate-y-0.5 hover:border-shop_light_green hover:text-shop_light_green"
          >
            <LayoutDashboard className="h-4 w-4" />
            Admin
          </Link>
        ) : null}

        {isAuthReady ? (
          isSignedIn ? (
            <div className="ml-1 rounded-full border border-white/10 bg-white/[0.035] p-0.5">
              <UserButton />
            </div>
          ) : (
            <SignIn className="h-9 rounded-full border border-shop_light_green/40 bg-transparent px-4 text-[9px] font-semibold uppercase tracking-[0.14em] text-white" />
          )
        ) : (
          <div className="h-9 w-20 rounded-full border border-white/10 bg-white/[0.04]" />
        )}
      </div>

      <div className="flex items-center gap-2 lg:hidden">
        <SearchBar mode="mobile" />
        <CartIcon className="h-9 w-9 border-white/15 bg-white/[0.04] text-white/75" iconClassName="h-4 w-4" />
        <FavoriteButton className="hidden h-9 w-9 border-white/15 bg-white/[0.04] text-white/75 sm:inline-flex" iconClassName="h-4 w-4" />

        {isAdmin ? (
          <Link
            href="/admin"
            className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/15 bg-white/[0.04] text-white/70"
          >
            <LayoutDashboard className="h-4 w-4" />
          </Link>
        ) : null}

        {isSignedIn ? (
          <Link
            href="/orders"
            className="relative inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/15 bg-white/[0.04] text-white/70"
          >
            <Logs className="h-4 w-4" />
            <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-shop_btn_dark_green px-1 text-[10px] font-semibold text-white">
              {ordersCount}
            </span>
          </Link>
        ) : null}

        {isSignedIn ? (
          <Link
            href="/loyalty"
            title="Ma carte fidélité"
            className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/15 bg-white/[0.04] text-white/70"
          >
            <Star className="h-4 w-4" />
          </Link>
        ) : null}

        {isAuthReady ? (
          isSignedIn ? (
            <UserButton />
          ) : (
            <SignInButton mode="modal">
              <button
                type="button"
                aria-label="Se connecter"
                className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/15 bg-white/[0.04] text-white/70 transition-colors hover:border-shop_light_green hover:text-shop_light_green"
              >
                <UserRound className="h-4 w-4" />
              </button>
            </SignInButton>
          )
        ) : (
          <div className="h-9 w-9 rounded-full border border-white/10 bg-white/[0.04]" />
        )}
      </div>
    </>
  );
};

export default HeaderDesktopNav;
