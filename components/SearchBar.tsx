"use client";

import { urlFor } from "@/lib/image";
import { cn } from "@/lib/utils";
import { fetchWithRetry } from "@/lib/fetchWithRetry";
import { Product } from "@/types";
import { ArrowRight, Loader2, Search, X } from "lucide-react";
import Image from "next/image";
import React, { Suspense, useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

type SearchSuggestion = Pick<
  Product,
  "_id" | "name" | "slug" | "price" | "discount" | "stock" | "images"
>;

const moneyFormatter = new Intl.NumberFormat("fr-MA", {
  style: "currency",
  currency: "MAD",
  maximumFractionDigits: 0,
});

interface SearchBarProps {
  mode?: "all" | "desktop" | "mobile";
  onDesktopActiveChange?: (isActive: boolean) => void;
  alwaysOpenDesktop?: boolean;
  className?: string;
}

const SearchBarFallback = ({
  mode = "all",
  alwaysOpenDesktop = false,
  className,
}: Pick<SearchBarProps, "mode" | "alwaysOpenDesktop" | "className">) => {
  const showDesktopSearch = mode !== "mobile";
  const showMobileSearch = mode !== "desktop";

  return (
    <>
      {showDesktopSearch ? (
        <div className={cn("relative hidden md:block", className)}>
          {alwaysOpenDesktop ? (
            <div className="flex h-11 w-full items-center rounded-full border border-white/15 bg-white/[0.04] px-4 text-xs text-white/40">
              <Search className="mr-2 h-4.5 w-4.5" />
              Rechercher un produit...
            </div>
          ) : (
            <div className="flex h-10 w-10 items-center justify-center rounded-full border border-white/15 bg-white/[0.04] text-white/55">
              <Search className="h-4.5 w-4.5" />
            </div>
          )}
        </div>
      ) : null}

      {showMobileSearch ? (
        <div className="md:hidden inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/15 bg-white/[0.04] text-white/55">
          <Search className="h-4.5 w-4.5" />
        </div>
      ) : null}
    </>
  );
};

const SearchBarContent = ({
  mode = "all",
  onDesktopActiveChange,
  alwaysOpenDesktop = false,
  className,
}: SearchBarProps) => {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const desktopWrapperRef = useRef<HTMLDivElement>(null);
  const desktopInputRef = useRef<HTMLInputElement>(null);
  const mobileInputRef = useRef<HTMLInputElement>(null);
  const searchRequestIdRef = useRef(0);
  const suggestionCacheRef = useRef(new Map<string, SearchSuggestion[]>());
  const initialQuery = pathname === "/shop" ? searchParams?.get("q") || "" : "";

  const [query, setQuery] = useState(initialQuery);
  const [isDesktopOpen, setIsDesktopOpen] = useState(alwaysOpenDesktop || !!initialQuery);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [isDesktopFocused, setIsDesktopFocused] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [suggestions, setSuggestions] = useState<SearchSuggestion[]>([]);
  const showDesktopSearch = mode !== "mobile";
  const showMobileSearch = mode !== "desktop";

  useEffect(() => {
    if (!alwaysOpenDesktop) {
      return;
    }

    setIsDesktopOpen(true);
  }, [alwaysOpenDesktop]);

  useEffect(() => {
    if (!isDesktopOpen) return;
    const timer = window.setTimeout(() => {
      desktopInputRef.current?.focus();
    }, 120);
    return () => window.clearTimeout(timer);
  }, [isDesktopOpen]);

  useEffect(() => {
    if (!isMobileOpen) return;
    const timer = window.setTimeout(() => {
      mobileInputRef.current?.focus();
    }, 120);
    return () => window.clearTimeout(timer);
  }, [isMobileOpen]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        desktopWrapperRef.current &&
        !desktopWrapperRef.current.contains(event.target as Node)
      ) {
        setIsDesktopFocused(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    const searchValue = query.trim();
    if (!searchValue) {
      setSuggestions([]);
      setIsSearching(false);
      return;
    }

    const cacheKey = searchValue.toLowerCase();
    const cachedSuggestions = suggestionCacheRef.current.get(cacheKey);
    if (cachedSuggestions) {
      setSuggestions(cachedSuggestions);
      setIsSearching(false);
      return;
    }

    const requestId = searchRequestIdRef.current + 1;
    searchRequestIdRef.current = requestId;

    const timer = window.setTimeout(async () => {
      setIsSearching(true);
      try {
        const data = await fetchWithRetry(
          async () => {
            const params = new URLSearchParams({
              q: searchValue,
              limit: "6",
            });
            const response = await fetch(`/api/products/search?${params.toString()}`);

            if (!response.ok) {
              throw new Error(`Failed to fetch suggestions: ${response.status}`);
            }

            return (await response.json()) as SearchSuggestion[];
          },
          { retries: 1, retryDelayMs: 300 }
        );
        if (searchRequestIdRef.current === requestId) {
          const cache = suggestionCacheRef.current;
          if (cache.size >= 50) {
            cache.delete(cache.keys().next().value!);
          }
          cache.set(cacheKey, data || []);
          setSuggestions(data || []);
        }
      } catch (error) {
        if (searchRequestIdRef.current === requestId) {
          console.error("Search suggestion fetching Error", error);
          setSuggestions([]);
        }
      } finally {
        if (searchRequestIdRef.current === requestId) {
          setIsSearching(false);
        }
      }
    }, 220);

    return () => window.clearTimeout(timer);
  }, [query]);

  const trimmedQuery = query.trim();
  const hasSearchQuery = trimmedQuery.length > 0;
  const showDesktopDropdown =
    isDesktopOpen && isDesktopFocused && hasSearchQuery;
  const showMobileDropdown = isMobileOpen && hasSearchQuery;

  useEffect(() => {
    if (!onDesktopActiveChange) return;

    onDesktopActiveChange(isDesktopOpen || isDesktopFocused);
  }, [isDesktopFocused, isDesktopOpen, onDesktopActiveChange]);

  useEffect(() => {
    return () => {
      onDesktopActiveChange?.(false);
    };
  }, [onDesktopActiveChange]);

  const getDisplayPrice = (product: SearchSuggestion) => {
    const basePrice = product.price ?? 0;
    if (!product.discount || product.discount <= 0) {
      return basePrice;
    }
    return basePrice - basePrice * (product.discount / 100);
  };

  const handleQueryChange = (value: string) => {
    setQuery(value);
    if (!value.trim()) {
      setSuggestions([]);
      setIsSearching(false);
    }
  };

  const clearSearch = () => {
    setQuery("");
    setSuggestions([]);
    setIsSearching(false);
    if (pathname === "/shop") {
      router.push("/shop");
    }
  };

  const goToSearch = () => {
    if (!trimmedQuery) {
      router.push("/shop");
      return;
    }
    setIsDesktopFocused(false);
    router.push(`/shop?q=${encodeURIComponent(trimmedQuery)}`);
  };

  const onDesktopSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    goToSearch();
  };

  const onMobileSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    goToSearch();
    setSuggestions([]);
    setIsMobileOpen(false);
  };

  const handleSuggestionClick = (product: SearchSuggestion) => {
    const slug = product.slug?.current;
    if (!slug) return;
    setQuery("");
    setSuggestions([]);
    setIsSearching(false);
    setIsDesktopFocused(false);
    setIsDesktopOpen(false);
    setIsMobileOpen(false);
    router.push(`/product/${slug}`);
  };

  const openDesktopSearch = () => {
    setIsDesktopOpen(true);
    setIsDesktopFocused(true);
  };

  const closeDesktopWhenEmpty = () => {
    window.setTimeout(() => {
      setIsDesktopFocused(false);
      if (!trimmedQuery && !alwaysOpenDesktop) setIsDesktopOpen(false);
    }, 120);
  };

  const renderSuggestions = (mode: "desktop" | "mobile") => {
    const shouldRender =
      mode === "desktop" ? showDesktopDropdown : showMobileDropdown;

    if (!shouldRender) return null;

    return (
      <div
        className={
          mode === "desktop"
            ? "absolute left-0 right-0 top-[calc(100%+10px)] z-50 overflow-hidden rounded-2xl border border-shop_light_green/30 bg-[#071522]/96 shadow-[0_24px_44px_-30px_rgba(22,133,194,0.95)] backdrop-blur-xl animate-in fade-in zoom-in-95 duration-200"
            : "mt-2 overflow-hidden rounded-2xl border border-shop_light_green/30 bg-[#071522] shadow-[0_20px_36px_-30px_rgba(22,133,194,0.85)]"
        }
      >
        <div className="max-h-80 overflow-y-auto p-2 scrollbar-hide">
          {isSearching ? (
            <div className="flex items-center justify-center gap-2 p-4 text-sm text-lightColor">
              <Loader2 className="h-4 w-4 animate-spin" />
              Recherche en cours...
            </div>
          ) : suggestions.length > 0 ? (
            suggestions.map((product) => (
              <button
                key={product._id}
                type="button"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => handleSuggestionClick(product)}
                className="group/item flex w-full items-center gap-3 rounded-xl p-2 text-left transition-all duration-200 hover:bg-shop_light_bg/80"
              >
                <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-lg border border-shop_light_green/30 bg-shop_light_bg">
                  {product.images?.[0] ? (
                    <Image
                      src={urlFor(product.images[0]).url()}
                      alt={product.name || "Produit"}
                      fill
                      sizes="48px"
                      className="object-contain p-1.5 transition-transform duration-300 group-hover/item:scale-105"
                    />
                  ) : (
                    <span className="flex h-full items-center justify-center text-[10px] text-lightColor">
                      No image
                    </span>
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-darkColor">
                    {product.name || "Produit sans nom"}
                  </p>
                  <p className="truncate text-xs text-lightColor">
                    {typeof product.price === "number"
                      ? moneyFormatter.format(getDisplayPrice(product))
                      : "Prix indisponible"}
                    {typeof product.stock === "number"
                      ? ` | Stock ${Math.max(product.stock, 0)}`
                      : ""}
                  </p>
                </div>

                <ArrowRight className="h-3.5 w-3.5 text-lightColor transition-all duration-200 group-hover/item:translate-x-0.5 group-hover/item:text-shop_dark_green" />
              </button>
            ))
          ) : (
            <p className="p-4 text-center text-sm text-lightColor">
              Aucun produit trouve pour &quot;{trimmedQuery}&quot;.
            </p>
          )}
        </div>

        <button
          type="button"
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => {
            goToSearch();
            if (mode === "mobile") {
              setIsMobileOpen(false);
            }
          }}
          className="mx-2 mb-2 mt-1 inline-flex w-[calc(100%-1rem)] items-center justify-center gap-1 rounded-xl border border-shop_light_green/40 bg-shop_light_bg/70 px-3 py-2 text-xs font-semibold text-shop_dark_green transition-colors duration-200 hover:bg-shop_light_bg"
        >
          Voir tous les resultats
          <ArrowRight className="h-3.5 w-3.5" />
        </button>
      </div>
    );
  };

  return (
    <>
      {showDesktopSearch ? (
        <div
          ref={desktopWrapperRef}
          className={cn("relative hidden md:block", className)}
        >
          <form
            onSubmit={onDesktopSubmit}
          className={`group relative flex h-10 items-center overflow-hidden rounded-full border bg-white/[0.04] backdrop-blur-md transition-[width,box-shadow,border-color,background-color] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] ${
              alwaysOpenDesktop
                ? "h-11 w-full border-white/15 px-1"
                : isDesktopOpen
                  ? "w-64 xl:w-80 border-shop_dark_green/35 shadow-[0_12px_24px_-18px_rgba(31,60,136,0.65)]"
                  : "w-10 border-shop_light_green/45 shadow-[0_10px_20px_-18px_rgba(31,60,136,0.6)] hover:border-shop_light_green/80 hover:shadow-[0_10px_20px_-16px_rgba(77,182,198,0.7)]"
            }`}
          >
            <button
              type={alwaysOpenDesktop ? "submit" : "button"}
              onClick={() => {
                if (!isDesktopOpen) {
                  openDesktopSearch();
                  return;
                }
                if (trimmedQuery) {
                  goToSearch();
                }
              }}
              className="inline-flex h-10 w-10 items-center justify-center text-white/55 hover:text-shop_light_green hoverEffect"
              aria-label="Rechercher"
            >
              <Search className="h-4.5 w-4.5 group-hover:scale-105 transition-transform duration-300" />
            </button>
            <input
              ref={desktopInputRef}
              value={query}
              onFocus={() => setIsDesktopFocused(true)}
              onChange={(event) => handleQueryChange(event.target.value)}
              onBlur={closeDesktopWhenEmpty}
              onKeyDown={(event) => {
                if (event.key === "Escape") {
                  setIsDesktopFocused(false);
                  setIsDesktopOpen(false);
                }
              }}
              placeholder="Rechercher un produit..."
              className={`h-full bg-transparent text-xs text-white placeholder:text-white/35 outline-none transition-[width,opacity,padding] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] ${
                alwaysOpenDesktop
                  ? "w-full px-1 pr-20 opacity-100"
                  : isDesktopOpen
                    ? "w-full pr-20 opacity-100"
                    : "w-0 pr-0 opacity-0"
              }`}
            />
            {isDesktopOpen || alwaysOpenDesktop ? (
              <button
                type="submit"
                className={`absolute right-2 inline-flex h-7 w-7 items-center justify-center rounded-md border transition-all duration-300 ${
                  trimmedQuery
                    ? "border-shop_light_green bg-shop_light_green text-black hover:bg-transparent hover:text-shop_light_green hover:translate-x-0.5"
                    : "border-white/15 bg-white/[0.04] text-white/35"
                }`}
                aria-label="Lancer la recherche"
              >
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            ) : null}
            {(isDesktopOpen || alwaysOpenDesktop) && query ? (
              <button
                type="button"
                onClick={() => {
                  clearSearch();
                  desktopInputRef.current?.focus();
                }}
                className="absolute right-10 inline-flex h-6 w-6 items-center justify-center rounded-full text-lightColor hover:bg-shop_light_green/20 hover:text-shop_dark_green hoverEffect"
                aria-label="Effacer la recherche"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            ) : null}
          </form>
          {renderSuggestions("desktop")}
        </div>
      ) : null}

      {showMobileSearch ? (
        <button
          type="button"
          onClick={() => setIsMobileOpen(true)}
          className="md:hidden inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/15 bg-white/[0.04] text-white/70 hover:border-shop_light_green hover:text-shop_light_green hoverEffect"
          aria-label="Ouvrir la recherche"
        >
          <Search className="h-4.5 w-4.5" />
        </button>
      ) : null}

      {showMobileSearch && isMobileOpen ? (
        <>
          <button
            type="button"
            className="fixed inset-0 z-[60] bg-black/25 backdrop-blur-[1px] md:hidden animate-in fade-in duration-200"
            onClick={() => {
              setIsMobileOpen(false);
              setSuggestions([]);
            }}
            aria-label="Fermer la recherche"
          />
          <div className="fixed left-4 right-4 top-20 z-[70] rounded-2xl border border-shop_light_green/35 bg-[#071522]/96 p-3 shadow-xl backdrop-blur-xl md:hidden animate-in fade-in zoom-in-95 duration-200">
            <form onSubmit={onMobileSubmit} className="flex items-center gap-2">
              <div className="flex h-10 flex-1 items-center gap-2 rounded-xl border border-shop_light_green/35 px-3">
                <Search className="h-4 w-4 text-lightColor" />
                <input
                  ref={mobileInputRef}
                  value={query}
                  onChange={(event) => handleQueryChange(event.target.value)}
                  placeholder="Rechercher un produit..."
                  className="h-full w-full bg-transparent text-sm text-darkColor placeholder:text-lightColor/80 outline-none"
                />
              </div>
              {query ? (
                <button
                  type="button"
                  onClick={clearSearch}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-shop_light_green/35 text-lightColor hover:text-shop_dark_green hoverEffect"
                  aria-label="Effacer la recherche"
                >
                  <X className="h-4 w-4" />
                </button>
              ) : null}
              <button
                type="submit"
                className="inline-flex h-10 items-center gap-1 rounded-full bg-shop_btn_dark_green px-4 text-sm font-semibold text-white hover:bg-shop_light_green hover:text-[#02101b] hoverEffect"
              >
                OK
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            </form>
            {renderSuggestions("mobile")}
          </div>
        </>
      ) : null}
    </>
  );
};

const SearchBar = (props: SearchBarProps) => (
  <Suspense
    fallback={
      <SearchBarFallback
        mode={props.mode}
        alwaysOpenDesktop={props.alwaysOpenDesktop}
        className={props.className}
      />
    }
  >
    <SearchBarContent {...props} />
  </Suspense>
);

export default SearchBar;
