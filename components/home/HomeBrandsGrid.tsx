import Image from "next/image";
import Link from "next/link";

import { urlFor } from "@/lib/image";
import type { BRANDS_QUERYResult } from "@/types";

type HomeBrandsGridProps = {
  brands: BRANDS_QUERYResult;
};

export default function HomeBrandsGrid({ brands }: HomeBrandsGridProps) {
  if (!brands.length) {
    return (
      <div className="rounded-[24px] border border-dashed border-shop_light_green/35 bg-white/[0.03] px-5 py-14 text-center text-sm text-lightColor">
        Les marques seront affichees ici une fois ajoutees dans votre catalogue.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
      {brands.map((brand) => {
        const slug = brand.slug?.current;
        return (
          <Link
            key={brand._id}
            href={slug ? `/shop?brand=${slug}` : "/shop"}
            className="group flex h-28 items-center justify-center rounded-[20px] border border-white/10 bg-white/[0.035] px-5 transition-all duration-300 hover:-translate-y-0.5 hover:border-shop_light_green/55 hover:bg-sky-400/[0.07]"
          >
            {brand.image ? (
              <Image
                src={urlFor(brand.image).url()}
                alt={brand.title || "Marque"}
                width={220}
                height={80}
                sizes="(min-width: 1024px) 12rem, 44vw"
                className="max-h-12 w-full grayscale object-contain opacity-65 transition-all duration-300 group-hover:scale-105 group-hover:grayscale-0 group-hover:opacity-100"
              />
            ) : (
              <span className="font-editorial line-clamp-2 text-center text-xl font-semibold text-shop_dark_green">
                {brand.title || "Marque"}
              </span>
            )}
          </Link>
        );
      })}
    </div>
  );
}
