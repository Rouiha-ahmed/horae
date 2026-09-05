"use client";
import { Product } from "@/types";
import useStore from "@/store";
import { cn } from "@/lib/utils";
import { Heart } from "lucide-react";
import Link from "next/link";
import React from "react";
import toast from "react-hot-toast";

const FavoriteButton = ({
  showProduct = false,
  product,
  className,
  iconClassName,
}: {
  showProduct?: boolean;
  product?: Product | null | undefined;
  className?: string;
  iconClassName?: string;
}) => {
  const favoriteProduct = useStore((state) => state.favoriteProduct);
  const addToFavorite = useStore((state) => state.addToFavorite);
  const hasHydrated = useStore((state) => state.hasHydrated);
  const safeFavorites = hasHydrated ? favoriteProduct : [];
  const existingProduct = safeFavorites.find(
    (item) => item._id === product?._id
  );

  const handleFavorite = (e: React.MouseEvent<HTMLSpanElement>) => {
    e.preventDefault();
    if (product?._id) {
      addToFavorite(product).then(() => {
        toast.success(
          existingProduct
            ? "Product removed successfully!"
            : "Product added successfully!"
        );
      });
    }
  };
  return (
    <>
      {!showProduct ? (
        <Link
          href={"/wishlist"}
          className={cn(
            "group relative inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/[0.035] text-white/65 shadow-[0_10px_24px_-20px_rgba(20,142,207,0.9)] transition-all duration-300 ease-out hover:-translate-y-0.5 hover:border-shop_light_green/70 hover:text-shop_light_green",
            className
          )}
        >
          <Heart className={cn("h-4.5 w-4.5", iconClassName)} />
          <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-shop_light_green px-1 text-[9px] font-semibold text-black">
            {safeFavorites.length ? safeFavorites.length : 0}
          </span>
        </Link>
      ) : (
        <button
          onClick={handleFavorite}
          disabled={!hasHydrated}
          className="group relative rounded-full border border-shop_light_green/60 p-2 hover:border-shop_light_green hover:text-shop_light_green hoverEffect"
        >
          {existingProduct ? (
            <Heart
              fill="#38BDF8"
              className="text-shop_light_green/80 group-hover:text-shop_light_green hoverEffect mt-.5 w-5 h-5"
            />
          ) : (
            <Heart className="text-shop_light_green/80 group-hover:text-shop_light_green hoverEffect mt-.5 w-5 h-5" />
          )}
        </button>
      )}
    </>
  );
};

export default FavoriteButton;
