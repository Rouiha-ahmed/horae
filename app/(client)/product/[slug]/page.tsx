import AddToCartButton from "@/components/AddToCartButton";
import Container from "@/components/Container";
import FavoriteButton from "@/components/FavoriteButton";
import ImageView from "@/components/ImageView";
import PriceView from "@/components/PriceView";
import ProductCharacteristics from "@/components/ProductCharacteristics";
import { getAllProductSlugs, getProductBySlug } from "@/lib/queries";
import { CornerDownLeft, StarIcon, Truck } from "lucide-react";
import { notFound } from "next/navigation";
import React from "react";
import { FaRegQuestionCircle } from "react-icons/fa";
import { FiShare2 } from "react-icons/fi";
import { RxBorderSplit } from "react-icons/rx";
import { TbTruckDelivery } from "react-icons/tb";

export const revalidate = 300;

export async function generateStaticParams() {
  const slugs = await getAllProductSlugs();

  return slugs.map((slug) => ({ slug }));
}

const SingleProductPage = async ({
  params,
}: {
  params: Promise<{ slug: string }>;
}) => {
  const { slug } = await params;
  const product = await getProductBySlug(slug);
  if (!product) {
    return notFound();
  }
  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_8%_0%,rgba(33,143,205,0.22),transparent_34rem),linear-gradient(180deg,#04101c,#02060b)] text-[#edf7ff]">
      <Container className="grid gap-10 py-10 md:grid-cols-2 md:gap-14 md:py-16 lg:min-h-[calc(100vh-120px)] lg:items-center">
        {product?.images && (
          <ImageView images={product?.images} isStock={product?.stock} />
        )}
        <div className="flex w-full flex-col gap-6 lg:pr-10">
          <div className="space-y-4">
            <p className="horae-kicker flex items-center gap-3 text-shop_light_green before:h-px before:w-8 before:bg-shop_light_green">
              {product?.brand?.title || "Collection HORAE"}
            </p>
            <h1 className="font-editorial text-[clamp(2.8rem,5vw,5.4rem)] font-light uppercase leading-[0.94] tracking-[-0.06em] text-[#edf7ff]">{product?.name}</h1>
            <p className="max-w-xl text-sm leading-7 tracking-wide text-white/48">
              {product?.description}
            </p>
          <div className="flex items-center gap-1 pt-2 text-xs text-white/50">
            {[...Array(5)].map((_, index) => (
              <StarIcon
                key={index}
                size={12}
                className="text-shop_light_green"
                fill={"#38BDF8"}
              />
            ))}
            <p className="font-semibold">{`(120)`}</p>
          </div>
        </div>
        <div className="space-y-3 border-y border-white/12 py-6">
          <PriceView
            price={product?.price}
            discount={product?.discount}
            regularPrice={product?.regularPrice}
            salePrice={product?.salePrice}
            className="text-lg font-semibold text-white"
          />
          <p
            className={`inline-block rounded-full border px-3 py-1 text-center text-[9px] font-semibold uppercase tracking-[0.14em] ${product?.stock === 0 ? "border-rose-400/40 text-rose-300" : "border-shop_light_green/45 text-shop_light_green"}`}
          >
            {(product?.stock as number) > 0 ? "En stock" : "Rupture de stock"}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <AddToCartButton product={product} className="h-12 rounded-full border-shop_light_green bg-shop_light_green text-[#02101b] hover:bg-transparent hover:text-shop_light_green" />
          <FavoriteButton showProduct={true} product={product} />
        </div>
        <ProductCharacteristics product={product} />
        <div className="grid grid-cols-2 gap-3 border-b border-white/12 py-5 text-white/50 sm:grid-cols-4">
          <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.08em] hover:text-shop_light_green hoverEffect">
            <RxBorderSplit className="text-lg" />
            <p>Comparer la couleur</p>
          </div>
          <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.08em] hover:text-shop_light_green hoverEffect">
            <FaRegQuestionCircle className="text-lg" />
            <p>Poser une question</p>
          </div>
          <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.08em] hover:text-shop_light_green hoverEffect">
            <TbTruckDelivery className="text-lg" />
            <p>Livraison et retour</p>
          </div>
          <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.08em] hover:text-shop_light_green hoverEffect">
            <FiShare2 className="text-lg" />
            <p>Partager</p>
          </div>
        </div>
        <div className="grid overflow-hidden rounded-[22px] border border-white/12 bg-white/[0.025] sm:grid-cols-2">
          <div className="flex items-center gap-3 border-b border-white/12 p-4 sm:border-b-0 sm:border-r">
            <Truck size={24} className="text-shop_orange" />
            <div>
              <p className="font-editorial text-lg font-semibold text-white">
                Livraison gratuite
              </p>
              <p className="text-xs leading-5 text-white/40">
                Entrez votre code postal pour verifier la disponibilite.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3 p-4">
            <CornerDownLeft size={24} className="text-shop_orange" />
            <div>
              <p className="font-editorial text-lg font-semibold text-white">
                Retour de livraison
              </p>
              <p className="text-xs leading-5 text-white/40">
                Retour gratuit sous 30 jours.{" "}
                <span className="underline underline-offset-2">Details</span>
              </p>
            </div>
          </div>
        </div>
        </div>
      </Container>
    </div>
  );
};

export default SingleProductPage;
