import { Product } from "@/types";
import { urlFor } from "@/lib/image";
import Image from "next/image";
import React from "react";
import Link from "next/link";
import { Flame } from "lucide-react";
import PriceView from "./PriceView";
import Title from "./Title";
import ProductSideMenu from "./ProductSideMenu";
import AddToCartButton from "./AddToCartButton";

type CategoryItem =
  | string
  | {
      title?: string;
      name?: string;
    }
  | null
  | undefined;

const getCategoryLabel = (cat: CategoryItem): string => {
  if (typeof cat === "string") return cat;
  if (cat && typeof cat === "object") {
    return cat.title || cat.name || "";
  }
  return "";
};

const ProductCard = React.memo(function ProductCard({
  product,
}: {
  product: Product;
}) {
  const categoryText = Array.isArray(product?.categories)
    ? product.categories
        .map((cat) => getCategoryLabel(cat as CategoryItem))
        .filter((value) => value.trim() !== "")
        .join(", ")
    : "";

  return (
    <article className="group flex h-full min-w-0 flex-col overflow-hidden rounded-[24px] border border-white/10 bg-[#071522]/70 p-2 transition-all duration-500 hover:-translate-y-1 hover:border-shop_light_green/50 hover:shadow-[0_26px_65px_-40px_rgba(56,189,248,0.76)]">
      <div className="relative overflow-hidden rounded-[18px] bg-[radial-gradient(circle_at_50%_20%,rgba(45,151,211,0.18),transparent_58%),#050e17]">
        <Link
          href={`/product/${product?.slug?.current}`}
          className="block aspect-[4/5]"
        >
          {product?.images?.[0] ? (
            <Image
              src={urlFor(product.images[0]).url()}
              alt={product?.name || "Produit"}
              width={500}
              height={500}
              sizes="(min-width: 1280px) 16rem, (min-width: 1024px) 20vw, (min-width: 768px) 33vw, 50vw"
              className={`h-full w-full object-contain p-5 transition-transform duration-700 ease-[cubic-bezier(.22,1,.36,1)] ${
                product?.stock !== 0 ? "group-hover:scale-[1.045]" : "opacity-45 grayscale"
              }`}
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-xs text-lightColor">
              Image indisponible
            </div>
          )}
        </Link>

        <ProductSideMenu product={product} />

        <div className="absolute left-2 top-2 z-10">
          {product?.status === "sale" || (product?.discount || 0) > 0 ? (
            <p className="rounded-full bg-shop_light_green px-2.5 py-1 text-[8px] font-bold uppercase tracking-[0.14em] text-[#02101b]">
              Edition prix doux
            </p>
          ) : (
            <Link
              href="/deal"
              className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-white/10 bg-black/35 text-shop_orange backdrop-blur-sm"
            >
              <Flame size={14} fill="#38BDF8" className="text-shop_orange" />
            </Link>
          )}
        </div>
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-2 px-2 pb-2 pt-4">
        {categoryText && (
          <p className="horae-kicker truncate text-[9px] text-lightColor/80">
            {categoryText}
          </p>
        )}

        <Title className="font-editorial line-clamp-2 min-h-[2.6rem] break-words text-[1.04rem] font-medium uppercase leading-[1.22] tracking-[-0.035em] text-shop_dark_green md:text-[1.1rem]">
          {product?.name}
        </Title>

        <div className="min-w-0">
          <PriceView
            price={product?.price}
            discount={product?.discount}
            regularPrice={product?.regularPrice}
            salePrice={product?.salePrice}
            className="min-w-0"
          />
        </div>

        <div className="mt-auto pt-2">
          <AddToCartButton
            product={product}
            className="mt-1 w-full rounded-full border border-shop_light_green/40 bg-shop_btn_dark_green text-white"
          />
        </div>
      </div>
    </article>
  );
});

export default ProductCard;
