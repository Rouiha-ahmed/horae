import BrandManager, {
  type BrandManagerData,
} from "@/components/admin/brands/BrandManager";
import {
  getAdminBrandsPageData,
  parseAdminBrandFilters,
} from "@/lib/admin-pages";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const getQueryValue = (
  searchParams: Record<string, string | string[] | undefined>,
  key: string
) => {
  const value = searchParams[key];
  return Array.isArray(value) ? value[0] : value;
};

export default async function AdminBrandsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const resolvedSearchParams = await searchParams;
  const filters = parseAdminBrandFilters(resolvedSearchParams);
  const data = await getAdminBrandsPageData(filters);
  const clientData: BrandManagerData = {
    ...data,
    brands: data.brands.map((brand) => ({
      ...brand,
      archivedAt: brand.archivedAt?.toISOString() || null,
      updatedAt: brand.updatedAt.toISOString(),
    })),
    filters: {
      query: filters.query,
      status: filters.status,
      association: filters.association,
      sort: filters.sort,
    },
  };

  return (
    <BrandManager
      data={clientData}
      statusMessage={getQueryValue(resolvedSearchParams, "status")}
      errorMessage={getQueryValue(resolvedSearchParams, "error")}
    />
  );
}
