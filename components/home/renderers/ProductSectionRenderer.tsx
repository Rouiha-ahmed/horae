import Link from "next/link";

import ProductCard from "@/components/ProductCard";
import HomeProductShelf from "@/components/home/HomeProductShelf";
import HomeSectionHeading from "@/components/home/HomeSectionHeading";
import type { HomepageDynamicSection } from "@/lib/homepage-sections";

type ProductSectionRendererProps = {
  section: HomepageDynamicSection;
};

const getEmptyMessage = (section: HomepageDynamicSection) =>
  typeof section.config.emptyMessage === "string" && section.config.emptyMessage.trim()
    ? section.config.emptyMessage
    : "Aucun produit n'est disponible pour cette section.";

const isCompactLayout = (layout: string | null | undefined) => layout === "compact";
const isCarouselLayout = (layout: string | null | undefined) => layout === "carousel";

export default function ProductSectionRenderer({ section }: ProductSectionRendererProps) {
  const products = section.products || [];
  const hideIfEmpty = section.productConfig?.hideIfEmpty ?? true;
  const layout = section.productConfig?.layout || section.layout || "grid";
  const emptyMessage = getEmptyMessage(section);

  if (!products.length && hideIfEmpty) {
    return null;
  }

  const action =
    section.ctaLabel && section.ctaLink ? (
      <Link
        href={section.ctaLink}
        className="horae-outline-button"
      >
        {section.ctaLabel}
      </Link>
    ) : null;

  return (
    <section id={section.key} className="scroll-mt-28">
      <HomeSectionHeading title={section.title} subtitle={section.subtitle} action={action} />

      {!products.length ? (
        <div className="rounded-[24px] border border-dashed border-shop_light_green/35 bg-white/[0.03] px-5 py-14 text-center text-sm text-lightColor">
          {emptyMessage}
        </div>
      ) : isCarouselLayout(layout) ? (
        <div className="flex gap-3 overflow-x-auto pb-4">
          {products.map((product) => (
            <div key={product._id} className="min-w-[220px] flex-1 md:min-w-[250px]">
              <ProductCard product={product} />
            </div>
          ))}
        </div>
      ) : isCompactLayout(layout) ? (
        <div className="grid grid-cols-2 gap-x-3 gap-y-9 md:grid-cols-3 lg:grid-cols-4">
          {products.map((product) => (
            <ProductCard key={product._id} product={product} />
          ))}
        </div>
      ) : (
        <HomeProductShelf products={products} emptyMessage={emptyMessage} />
      )}
    </section>
  );
}
