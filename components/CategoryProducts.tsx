"use client";

import { useEffect, useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";

import { getCategoryIcon } from "@/lib/category-icons";
import { cn } from "@/lib/utils";
import { Category, Product } from "@/types";
import NoProductAvailable from "./NoProductAvailable";
import ProductCard from "./ProductCard";

interface Props {
  categories: Category[];
  slug: string;
  initialProducts?: Product[];
}

const CategoryProducts = ({ categories, slug, initialProducts = [] }: Props) => {
  const [currentSlug, setCurrentSlug] = useState(slug);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const handleCategoryChange = (newSlug: string) => {
    if (!newSlug || newSlug === currentSlug || isPending) return;
    startTransition(() => {
      setCurrentSlug(newSlug);
      router.push(`/category/${newSlug}`, { scroll: false });
    });
  };

  useEffect(() => {
    categories.forEach((category) => {
      const nextSlug = category.slug?.current;
      if (nextSlug) router.prefetch(`/category/${nextSlug}`);
    });
  }, [categories, router]);

  useEffect(() => {
    setCurrentSlug(slug);
  }, [slug]);

  const showInlineLoading = isPending || currentSlug !== slug;

  return (
    <div className="flex flex-col gap-8 md:flex-row md:items-start md:gap-10">
      {/* Sidebar */}
      <aside className="w-full shrink-0 md:sticky md:top-32 md:w-56">
        <div className="overflow-hidden rounded-[24px] border border-white/10 bg-[#071522]/72">
          <div className="border-b border-white/10 px-5 py-4">
            <p className="horae-kicker text-shop_light_green">
              Categories
            </p>
          </div>
          <nav className="p-3">
            {categories.map((item) => {
              const Icon = getCategoryIcon(item.title || "");
              const categorySlug = item.slug?.current || "";
              const isActive = categorySlug === currentSlug;

              return (
                <button
                  key={item._id}
                  type="button"
                  onClick={() => handleCategoryChange(categorySlug)}
                  disabled={isPending}
                  className={cn(
                    "flex w-full items-center gap-2.5 border-b border-white/8 px-2 py-3 text-left text-xs font-semibold capitalize transition-all duration-200",
                    isActive
                      ? "border-shop_light_green text-shop_dark_green"
                      : "text-lightColor hover:border-shop_light_green/50 hover:text-shop_dark_green"
                  )}
                >
                  <Icon
                    className={cn(
                      "h-4 w-4 shrink-0",
                      isActive ? "text-shop_light_green" : "text-white/30"
                    )}
                  />
                  {item.title}
                </button>
              );
            })}
          </nav>
        </div>
      </aside>

      {/* Products grid */}
      <div className="min-w-0 flex-1">
        {showInlineLoading && (
          <div className="mb-4 flex justify-center md:justify-start">
            <div className="inline-flex items-center gap-2 rounded-full border border-shop_light_green/30 bg-[#071522]/95 px-4 py-1.5 text-xs font-medium text-shop_dark_green shadow-sm">
              <Loader2 className="h-3.5 w-3.5 animate-spin text-shop_light_green" />
              Chargement...
            </div>
          </div>
        )}

        {initialProducts.length > 0 ? (
          <div
            className={cn(
              "grid grid-cols-2 gap-x-3 gap-y-9 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5",
              showInlineLoading ? "opacity-50" : "opacity-100"
            )}
          >
            {initialProducts.map((product) => (
              <ProductCard key={product._id} product={product} />
            ))}
          </div>
        ) : (
          <NoProductAvailable selectedTab={currentSlug} className="mt-0 w-full" />
        )}
      </div>
    </div>
  );
};

export default CategoryProducts;
