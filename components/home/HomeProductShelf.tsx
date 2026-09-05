import ProductCard from "@/components/ProductCard";
import type { Product } from "@/types";

type HomeProductShelfProps = {
  products: Product[];
  emptyMessage: string;
};

export default function HomeProductShelf({
  products,
  emptyMessage,
}: HomeProductShelfProps) {
  if (!products.length) {
    return (
      <div className="rounded-[24px] border border-dashed border-shop_light_green/35 bg-white/[0.03] px-5 py-14 text-center text-sm text-lightColor">
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-x-3 gap-y-8 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
      {products.map((product) => (
        <ProductCard key={product._id} product={product} />
      ))}
    </div>
  );
}
