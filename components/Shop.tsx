"use client";
import { BRANDS_QUERYResult, Category, Product } from "@/types";
import { startTransition, useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import Container from "./Container";
import Title from "./Title";
import CategoryList from "./shop/CategoryList";
import BrandList from "./shop/BrandList";
import PriceList from "./shop/PriceList";
import SortSelect from "./shop/SortSelect";
import { Loader2 } from "lucide-react";
import NoProductAvailable from "./NoProductAvailable";
import ProductCard from "./ProductCard";
import { fetchWithRetry } from "@/lib/fetchWithRetry";
import type { SortOption } from "@/lib/queries";

interface Props {
  categories: Category[];
  brands: BRANDS_QUERYResult;
  initialProducts: Product[];
  initialSelectedCategory?: string | null;
  initialSelectedBrand?: string | null;
  initialSelectedPrice?: string | null;
  initialSearchTerm?: string;
}

const getShopCacheKey = ({
  selectedCategories,
  selectedBrands,
  selectedPrice,
  searchTerm,
  sortBy,
}: {
  selectedCategories: string[];
  selectedBrands: string[];
  selectedPrice?: string | null;
  searchTerm?: string;
  sortBy?: SortOption;
}) =>
  JSON.stringify({
    selectedCategories: [...selectedCategories].sort(),
    selectedBrands: [...selectedBrands].sort(),
    selectedPrice: selectedPrice || "",
    searchTerm: searchTerm || "",
    sortBy: sortBy || "relevance",
  });

const parsePriceRange = (selectedPrice: string | null) => {
  if (!selectedPrice) return { minPrice: null, maxPrice: null };
  const [min, max] = selectedPrice.split("-").map(Number);
  return {
    minPrice: Number.isFinite(min) ? min : null,
    maxPrice: Number.isFinite(max) ? max : null,
  };
};

const Shop = ({
  categories,
  brands,
  initialProducts,
  initialSelectedCategory = null,
  initialSelectedBrand = null,
  initialSelectedPrice = null,
  initialSearchTerm = "",
}: Props) => {
  const [isFilterPending, startFilterTransition] = useTransition();
  const searchTerm = initialSearchTerm.trim();

  const initCategories = useMemo(
    () => (initialSelectedCategory ? [initialSelectedCategory] : []),
    [initialSelectedCategory]
  );
  const initBrands = useMemo(
    () => (initialSelectedBrand ? [initialSelectedBrand] : []),
    [initialSelectedBrand]
  );

  const [selectedCategories, setSelectedCategories] = useState<string[]>(initCategories);
  const [selectedBrands, setSelectedBrands] = useState<string[]>(initBrands);
  const [selectedPrice, setSelectedPrice] = useState<string | null>(initialSelectedPrice);
  const [sortBy, setSortBy] = useState<SortOption>("relevance");

  const initialCacheKey = getShopCacheKey({
    selectedCategories: initCategories,
    selectedBrands: initBrands,
    selectedPrice: initialSelectedPrice,
    searchTerm,
    sortBy: "relevance",
  });
  const cacheRef = useRef(new Map<string, Product[]>([[initialCacheKey, initialProducts]]));
  const [products, setProducts] = useState<Product[]>(initialProducts);
  const [loading, setLoading] = useState(false);
  const requestIdRef = useRef(0);

  const cacheKey = getShopCacheKey({ selectedCategories, selectedBrands, selectedPrice, searchTerm, sortBy });

  useEffect(() => { setSelectedCategories(initCategories); }, [initCategories]);
  useEffect(() => { setSelectedBrands(initBrands); }, [initBrands]);
  useEffect(() => { setSelectedPrice(initialSelectedPrice); }, [initialSelectedPrice]);

  useEffect(() => {
    cacheRef.current.set(initialCacheKey, initialProducts);
    setProducts(initialProducts);
    setLoading(false);
  }, [initialCacheKey, initialProducts]);

  const fetchProducts = useCallback(async () => {
    const cached = cacheRef.current.get(cacheKey);
    if (cached) {
      setProducts(cached);
      setLoading(false);
      return;
    }

    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    setLoading(true);

    try {
      const { minPrice, maxPrice } = parsePriceRange(selectedPrice);
      const params = new URLSearchParams();
      if (selectedCategories.length) params.set("categories", selectedCategories.join(","));
      if (selectedBrands.length) params.set("brands", selectedBrands.join(","));
      if (searchTerm) params.set("q", searchTerm);
      if (sortBy && sortBy !== "relevance") params.set("sort", sortBy);
      if (minPrice !== null && maxPrice !== null) {
        params.set("minPrice", String(minPrice));
        params.set("maxPrice", String(maxPrice));
      }

      const data = await fetchWithRetry(
        async () => {
          const res = await fetch(`/api/products/search?${params.toString()}`);
          if (!res.ok) throw new Error(`Failed: ${res.status}`);
          return (await res.json()) as Product[];
        },
        { retries: 1, retryDelayMs: 400 }
      );

      if (requestIdRef.current === requestId) {
        cacheRef.current.set(cacheKey, data || []);
        setProducts(data || []);
      }
    } catch (error) {
      if (requestIdRef.current === requestId) {
        console.error("Shop fetch error", error);
        setProducts([]);
      }
    } finally {
      if (requestIdRef.current === requestId) setLoading(false);
    }
  }, [cacheKey, searchTerm, selectedBrands, selectedCategories, selectedPrice, sortBy]);

  useEffect(() => { fetchProducts(); }, [fetchProducts]);

  const toggleCategory = (slug: string) => {
    startFilterTransition(() => {
      setSelectedCategories((prev) =>
        prev.includes(slug) ? prev.filter((s) => s !== slug) : [...prev, slug]
      );
    });
  };

  const toggleBrand = (slug: string) => {
    startFilterTransition(() => {
      setSelectedBrands((prev) =>
        prev.includes(slug) ? prev.filter((s) => s !== slug) : [...prev, slug]
      );
    });
  };

  const hasActiveFilters =
    selectedCategories.length > 0 ||
    selectedBrands.length > 0 ||
    selectedPrice !== null ||
    !!searchTerm;

  const showInitialLoader = loading && !products.length;
  const showInlineLoading = (loading || isFilterPending) && products.length > 0;

  const activeBadges = [
    ...selectedCategories.map((s) => ({
      label: categories.find((c) => c.slug?.current === s)?.title || s,
      onRemove: () => startFilterTransition(() => setSelectedCategories((p) => p.filter((x) => x !== s))),
    })),
    ...selectedBrands.map((s) => ({
      label: brands.find((b) => b.slug?.current === s)?.title || s,
      onRemove: () => startFilterTransition(() => setSelectedBrands((p) => p.filter((x) => x !== s))),
    })),
  ];

  return (
    <div className="horae-page pb-24 pt-3">
      <div className="mx-3 overflow-hidden rounded-[28px] border border-white/10 bg-[radial-gradient(circle_at_16%_0%,rgba(55,176,237,0.42),transparent_38%),linear-gradient(118deg,#0a456d,#02070d_68%)] text-[#edf7ff]">
        <Container className="flex min-h-[300px] flex-col justify-end py-12 md:min-h-[380px] md:py-16">
          <p className="horae-kicker text-shop_light_green">La boutique</p>
          <h1 className="horae-display mt-5 max-w-5xl">Le rituel,<br />à votre mesure.</h1>
          <p className="mt-7 max-w-xl text-sm leading-7 text-white/48">
            Explorez notre collection avec précision — par besoin, maison ou gamme de prix.
          </p>
        </Container>
      </div>
      <Container className="mt-10 md:mt-16">
        {/* Header row */}
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4 border-b border-white/10 pb-5">
          <Title className="font-editorial text-3xl font-light uppercase tracking-[-0.045em] md:text-4xl">
            Trouvez les produits selon vos besoins
          </Title>
          {hasActiveFilters && (
            <button
              onClick={() => {
                startTransition(() => {
                  setSelectedCategories([]);
                  setSelectedBrands([]);
                  setSelectedPrice(null);
                });
              }}
              className="text-[10px] font-semibold uppercase tracking-[0.14em] text-shop_dark_green underline decoration-shop_light_green underline-offset-4 hover:text-shop_light_green"
            >
              Reinitialiser les filtres
            </button>
          )}
        </div>

        {/* Active filter badges */}
        {activeBadges.length > 0 && (
          <div className="mb-4 flex flex-wrap gap-2">
            {activeBadges.map((badge) => (
              <span
                key={badge.label}
                className="inline-flex items-center gap-1.5 rounded-full border border-shop_light_green/40 bg-shop_light_green/8 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.1em] text-shop_light_green"
              >
                {badge.label}
                <button
                  onClick={badge.onRemove}
                  className="ml-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-shop_light_green/15 hover:bg-shop_light_green/30"
                >
                  <svg viewBox="0 0 8 8" className="h-2 w-2 stroke-shop_light_green stroke-2">
                    <line x1="1" y1="1" x2="7" y2="7" /><line x1="7" y1="1" x2="1" y2="7" />
                  </svg>
                </button>
              </span>
            ))}
          </div>
        )}

        <div className="flex flex-col gap-8 md:flex-row md:gap-10">
          {/* Sidebar */}
          <aside className="overflow-hidden rounded-[24px] border border-white/10 bg-[#071522]/72 md:sticky md:top-28 md:min-w-64 md:self-start">
            <CategoryList
              categories={categories}
              selectedCategories={selectedCategories}
              onToggle={toggleCategory}
              onReset={() => startFilterTransition(() => setSelectedCategories([]))}
            />
            <BrandList
              brands={brands}
              selectedBrands={selectedBrands}
              onToggle={toggleBrand}
              onReset={() => startFilterTransition(() => setSelectedBrands([]))}
            />
            <PriceList
              setSelectedPrice={(v) => startFilterTransition(() => setSelectedPrice(v))}
              selectedPrice={selectedPrice}
            />
          </aside>

          {/* Products */}
          <div className="min-w-0 flex-1">
            <div className="mb-7">
              <SortSelect
                value={sortBy}
                onChange={(v) => startFilterTransition(() => setSortBy(v))}
                total={products.length}
              />
            </div>
            <div className="relative">
              {showInitialLoader ? (
                <div className="flex flex-col items-center justify-center gap-3 p-20">
                  <Loader2 className="h-10 w-10 animate-spin text-shop_light_green" />
                  <p className="font-semibold tracking-wide text-shop_dark_green">
                    Chargement des produits...
                  </p>
                </div>
              ) : products.length > 0 ? (
                <>
                  {showInlineLoading && (
                    <div className="sticky top-0 z-10 mb-3 flex justify-end">
                      <div className="inline-flex items-center gap-2 rounded-full border border-shop_light_green/30 bg-[#071522]/95 px-3 py-1.5 text-xs font-medium text-shop_dark_green shadow-sm backdrop-blur-xl">
                        <Loader2 className="h-3.5 w-3.5 animate-spin text-shop_light_green" />
                        Mise a jour...
                      </div>
                    </div>
                  )}
                  <div
                    className={`grid grid-cols-2 gap-x-3 gap-y-9 transition-opacity lg:grid-cols-3 xl:grid-cols-4 ${showInlineLoading ? "opacity-60" : "opacity-100"}`}
                  >
                    {products.map((product) => (
                      <ProductCard key={product._id} product={product} />
                    ))}
                  </div>
                </>
              ) : (
                <NoProductAvailable className="mt-0 rounded-[24px] border border-white/10 bg-white/[0.03]" />
              )}
            </div>
          </div>
        </div>
      </Container>
    </div>
  );
};

export default Shop;
