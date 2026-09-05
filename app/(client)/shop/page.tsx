import Shop from "@/components/Shop";
import { getAllBrands, getCategories, searchProducts } from "@/lib/queries";
import React from "react";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const getQueryValue = (
  searchParams: Record<string, string | string[] | undefined>,
  key: string
) => {
  const value = searchParams[key];
  return Array.isArray(value) ? value[0] : value;
};

export const revalidate = 300;

const ShopPage = async ({
  searchParams,
}: {
  searchParams: SearchParams;
}) => {
  const resolvedSearchParams = await searchParams;
  const initialSelectedCategory = getQueryValue(resolvedSearchParams, "category") || null;
  const initialSelectedBrand = getQueryValue(resolvedSearchParams, "brand") || null;
  const initialSearchTerm = getQueryValue(resolvedSearchParams, "q")?.trim() || "";

  const minPriceParam = getQueryValue(resolvedSearchParams, "minPrice");
  const maxPriceParam = getQueryValue(resolvedSearchParams, "maxPrice");
  const parsedMinPrice = minPriceParam ? Number(minPriceParam) : NaN;
  const parsedMaxPrice = maxPriceParam ? Number(maxPriceParam) : NaN;
  const hasPriceFilter =
    Number.isFinite(parsedMinPrice) && Number.isFinite(parsedMaxPrice);
  const initialSelectedPrice = hasPriceFilter
    ? `${parsedMinPrice}-${parsedMaxPrice}`
    : null;

  const [categories, brands, initialProducts] = await Promise.all([
    getCategories(),
    getAllBrands(),
    searchProducts({
      selectedCategories: initialSelectedCategory ? [initialSelectedCategory] : [],
      selectedBrands: initialSelectedBrand ? [initialSelectedBrand] : [],
      searchTerm: initialSearchTerm || undefined,
      minPrice: hasPriceFilter ? parsedMinPrice : null,
      maxPrice: hasPriceFilter ? parsedMaxPrice : null,
    }),
  ]);

  return (
    <div className="bg-shop_light_bg">
      <Shop
        categories={categories}
        brands={brands}
        initialProducts={initialProducts}
        initialSelectedCategory={initialSelectedCategory}
        initialSelectedBrand={initialSelectedBrand}
        initialSelectedPrice={initialSelectedPrice}
        initialSearchTerm={initialSearchTerm}
      />
    </div>
  );
};

export default ShopPage;
