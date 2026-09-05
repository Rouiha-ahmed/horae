"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import ProductCard from "./ProductCard";
import NoProductAvailable from "./NoProductAvailable";
import { Loader2 } from "lucide-react";
import Container from "./Container";
import HomeTabbar from "./HomeTabbar";
import { Product } from "@/types";
import { fetchWithRetry } from "@/lib/fetchWithRetry";
import { getHomeTabCategories, type HomeCategory } from "@/lib/catalog";

type Props = {
  categories: HomeCategory[];
  initialProducts?: Product[];
  initialCategoryId?: string;
};

const ProductGrid = ({
  categories,
  initialProducts = [],
  initialCategoryId,
}: Props) => {
  const cacheRef = useRef(
    new Map<string, Product[]>(
      initialCategoryId ? [[initialCategoryId, initialProducts]] : []
    )
  );
  const [products, setProducts] = useState<Product[]>(initialProducts);
  const [loading, setLoading] = useState(false);
  const [isPending, startTransition] = useTransition();
  const tabCategories = useMemo(() => getHomeTabCategories(categories), [categories]);
  const fallbackCategoryId = tabCategories[0]?._id || "";

  const [selectedCategoryId, setSelectedCategoryId] = useState(
    initialCategoryId &&
      tabCategories.some((category) => category._id === initialCategoryId)
      ? initialCategoryId
      : fallbackCategoryId
  );

  useEffect(() => {
    if (!initialCategoryId) {
      return;
    }

    cacheRef.current.set(initialCategoryId, initialProducts);

    if (selectedCategoryId === initialCategoryId) {
      setProducts(initialProducts);
      setLoading(false);
    }
  }, [initialCategoryId, initialProducts, selectedCategoryId]);

  useEffect(() => {
    if (!tabCategories.length) {
      setSelectedCategoryId("");
      setProducts([]);
      setLoading(false);
      return;
    }

    if (
      !selectedCategoryId ||
      !tabCategories.some((category) => category._id === selectedCategoryId)
    ) {
      setSelectedCategoryId(fallbackCategoryId);
    }
  }, [fallbackCategoryId, selectedCategoryId, tabCategories]);

  useEffect(() => {
    if (!selectedCategoryId) {
      setProducts([]);
      setLoading(false);
      return;
    }

    const cachedProducts = cacheRef.current.get(selectedCategoryId);
    if (cachedProducts) {
      setProducts(cachedProducts);
      setLoading(false);
      return;
    }

    let cancelled = false;

    const fetchData = async () => {
      setLoading(true);
      try {
        const response = await fetchWithRetry(
          async () => {
            const res = await fetch(
              `/api/products/by-category?categoryId=${encodeURIComponent(selectedCategoryId)}`
            );

            if (!res.ok) {
              throw new Error(`Failed to fetch products: ${res.status}`);
            }

            return (await res.json()) as Product[];
          },
          { retries: 1, retryDelayMs: 400 }
        );

        if (!cancelled) {
          cacheRef.current.set(selectedCategoryId, response || []);
          setProducts(response || []);
        }
      } catch (error) {
        if (!cancelled) {
          console.error("Product fetching Error", error);
          setProducts([]);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };
    fetchData();

    return () => {
      cancelled = true;
    };
  }, [selectedCategoryId]);

  useEffect(() => {
    const uncachedCategoryIds = tabCategories
      .map((category) => category._id)
      .filter(
        (categoryId) =>
          categoryId &&
          categoryId !== selectedCategoryId &&
          !cacheRef.current.has(categoryId)
      )
      .slice(0, 3);

    if (!uncachedCategoryIds.length) {
      return;
    }

    let cancelled = false;

    const warmCategoryCache = async () => {
      for (const categoryId of uncachedCategoryIds) {
        if (cancelled || cacheRef.current.has(categoryId)) {
          continue;
        }

        try {
          const response = await fetch(
            `/api/products/by-category?categoryId=${encodeURIComponent(categoryId)}`
          );

          if (!response.ok) {
            continue;
          }

          const data = (await response.json()) as Product[];

          if (!cancelled) {
            cacheRef.current.set(categoryId, data || []);
          }
        } catch (error) {
          console.error("Product prefetch Error", error);
        }
      }
    };

    const warmOnIdle = () => {
      void warmCategoryCache();
    };

    if (
      typeof window !== "undefined" &&
      typeof window.requestIdleCallback === "function"
    ) {
      const idleId = window.requestIdleCallback(warmOnIdle);

      return () => {
        cancelled = true;
        window.cancelIdleCallback(idleId);
      };
    }

    const timer = globalThis.setTimeout(warmOnIdle, 600);

    return () => {
      cancelled = true;
      globalThis.clearTimeout(timer);
    };
  }, [selectedCategoryId, tabCategories]);

  const selectedCategoryTitle =
    tabCategories.find((category) => category._id === selectedCategoryId)
      ?.title || "Cette categorie";
  const showInitialLoader = loading && !products.length;
  const showInlineLoading = (loading || isPending) && products.length > 0;

  const handleCategorySelect = useCallback(
    (categoryId: string) => {
      startTransition(() => {
        setSelectedCategoryId(categoryId);
      });
    },
    [startTransition]
  );

  const tabCategoryItems = useMemo(
    () =>
      tabCategories.map((category) => ({
        _id: category._id,
        title: category.title || "",
        slug: category.slug.current,
      })),
    [tabCategories]
  );

  return (
    <Container id="categories" className="flex flex-col lg:px-0 my-10 scroll-mt-28">
      <HomeTabbar
        categories={tabCategoryItems}
        selectedCategoryId={selectedCategoryId}
        onCategorySelect={handleCategorySelect}
      />
      {showInitialLoader ? (
        <div className="flex flex-col items-center justify-center py-10 min-h-80 space-y-4 text-center bg-gray-100 rounded-lg w-full mt-10">
          <div className="flex items-center space-x-2 text-shop_light_green">
            <Loader2 className="w-5 h-5 animate-spin" />
            <span>Chargement des produits...</span>
          </div>
        </div>
      ) : products?.length ? (
        <>
          {showInlineLoading ? (
            <div className="mt-6 flex justify-end">
              <div className="inline-flex items-center gap-2 rounded-full border border-shop_light_green/30 bg-white/90 px-3 py-1.5 text-xs font-medium text-shop_dark_green shadow-sm">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Mise a jour de la selection...
              </div>
            </div>
          ) : null}
          <div className={`grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2.5 mt-10 transition-opacity ${showInlineLoading ? "opacity-70" : "opacity-100"}`}>
            {products?.map((product) => (
              <div key={product?._id}>
                <ProductCard product={product} />
              </div>
            ))}
          </div>
        </>
      ) : (
        <NoProductAvailable selectedTab={selectedCategoryTitle} />
      )}
    </Container>
  );
};

export default ProductGrid;
