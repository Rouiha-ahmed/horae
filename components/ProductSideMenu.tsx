"use client";
import { cn } from "@/lib/utils";
import { Product } from "@/types";
import useStore from "@/store";
import { Heart } from "lucide-react";
import toast from "react-hot-toast";

const ProductSideMenu = ({
  product,
  className,
}: {
  product: Product;
  className?: string;
}) => {
  const favoriteProduct = useStore((state) => state.favoriteProduct);
  const addToFavorite = useStore((state) => state.addToFavorite);
  const hasHydrated = useStore((state) => state.hasHydrated);
  const safeFavorites = hasHydrated ? favoriteProduct : [];
  const existingProduct = safeFavorites.find(
    (item) => item?._id === product?._id
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
    <div
      className={cn("absolute right-2 top-2 hover:cursor-pointer", className)}
    >
      <div
        onClick={hasHydrated ? handleFavorite : undefined}
        className={`rounded-full border p-2 backdrop-blur-sm hover:border-shop_light_green hover:bg-shop_light_green hover:text-[#02101b] hoverEffect ${existingProduct ? "border-shop_light_green bg-shop_light_green text-[#02101b]" : "border-white/10 bg-black/35 text-white/60"}`}
      >
        <Heart size={15} />
      </div>
    </div>
  );
};

export default ProductSideMenu;
