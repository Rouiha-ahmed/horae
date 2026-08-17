import { notFound } from "next/navigation";

import ProductDetail from "@/components/admin/products/ProductDetail";
import { getAdminProductDetail } from "@/lib/products/admin-data";

export default async function AdminProductDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const product = await getAdminProductDetail(id);
  if (!product) notFound();
  return <ProductDetail product={product} />;
}
