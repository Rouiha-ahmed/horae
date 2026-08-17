import ProductManager from "@/components/admin/products/ProductManager";
import {
  getAdminProductsOperationsData,
  parseAdminProductFilters,
} from "@/lib/products/admin-data";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function AdminProductsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const resolved = await searchParams;
  const filters = parseAdminProductFilters(resolved);
  const data = await getAdminProductsOperationsData(filters);
  return <ProductManager data={data} />;
}
