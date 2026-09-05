import Image from "next/image";
import Link from "next/link";

import { BadgePercent, ChevronRight } from "lucide-react";

import { getCategoryIcon } from "@/lib/category-icons";
import { urlFor } from "@/lib/image";
import type { Category } from "@/types";

type HomeFeaturedCategoriesProps = {
  categories: Category[];
};

export default function HomeFeaturedCategories({ categories }: HomeFeaturedCategoriesProps) {
  if (!categories.length) {
    return (
      <div className="rounded-[24px] border border-dashed border-shop_light_green/35 bg-white/[0.03] px-5 py-14 text-center text-sm text-lightColor">
        Aucune categorie mise en avant pour le moment.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
      {categories.map((category) => {
        const Icon = getCategoryIcon(category.title || "");
        const slug = category.slug?.current;

        return (
          <Link
            key={category._id}
            href={slug ? `/category/${slug}` : "/shop"}
            className="group overflow-hidden rounded-[22px] border border-white/10 bg-[#071522]/72 transition-all duration-500 hover:-translate-y-1 hover:border-shop_light_green/55 hover:shadow-[0_22px_55px_-34px_rgba(56,189,248,0.72)]"
          >
            <div className="relative aspect-[4/3] overflow-hidden bg-[radial-gradient(circle_at_50%_20%,rgba(45,151,211,0.2),transparent_60%),#06101a]">
              {category.image ? (
                <Image
                  src={urlFor(category.image).url()}
                  alt={category.title || "Categorie"}
                  fill
                  sizes="(min-width: 1280px) 21rem, (min-width: 640px) 50vw, 100vw"
                  className="object-contain p-4 transition-transform duration-700 ease-[cubic-bezier(.22,1,.36,1)] group-hover:scale-110"
                />
              ) : (
                <div className="flex h-full items-center justify-center text-shop_dark_green/70">
                  <Icon className="h-8 w-8" />
                </div>
              )}
            </div>

            <div className="space-y-2 border-t border-white/8 p-3.5">
              <div className="flex items-center justify-between gap-2">
                <h3 className="font-editorial line-clamp-1 text-[1rem] font-medium uppercase tracking-[-0.03em] text-shop_dark_green">
                  {category.title || "Categorie"}
                </h3>
                <span className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-white/15 text-shop_dark_green transition-colors duration-300 group-hover:border-shop_light_green group-hover:bg-shop_light_green group-hover:text-[#02101b]">
                  <ChevronRight className="h-3 w-3" />
                </span>
              </div>

              <div className="inline-flex items-center gap-1.5 text-[9px] font-semibold uppercase tracking-[0.12em] text-lightColor">
                <BadgePercent className="h-3 w-3" />
                {category.productCount || 0} produit(s)
              </div>
            </div>
          </Link>
        );
      })}
    </div>
  );
}
