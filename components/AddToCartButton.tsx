"use client";
import { Product } from "@/types";
import { Button } from "./ui/button";
import { cn } from "@/lib/utils";
import { ShoppingBag } from "lucide-react";
import useStore from "@/store";
import toast from "react-hot-toast";
import PriceFormatter from "./PriceFormatter";
import QuantityButtons from "./QuantityButtons";

interface Props {
  product: Product;
  className?: string;
}

const AddToCartButton = ({ product, className }: Props) => {
  const addItem = useStore((state) => state.addItem);
  const getItemCount = useStore((state) => state.getItemCount);
  const hasHydrated = useStore((state) => state.hasHydrated);
  const itemCount = hasHydrated ? getItemCount(product._id) : 0;

  const handleAddToCart = () => {
    if (!hasHydrated) {
      return;
    }

    addItem(product);
    toast.success(`${product.name?.substring(0, 24)} ajouté au panier`);
  };
  return (
    <div className="w-full h-12 flex items-center">
      {itemCount ? (
        <div className="text-sm w-full">
          <div className="flex items-center justify-between">
            <span className="text-xs text-darkColor/80">Quantite</span>
            <QuantityButtons product={product} />
          </div>
          <div className="flex items-center justify-between border-t pt-1">
            <span className="text-xs font-semibold">Sous-total</span>
            <PriceFormatter
              amount={product.price ? product.price * itemCount : 0}
            />
          </div>
        </div>
      ) : (
        <Button
          onClick={handleAddToCart}
          className={cn(
            "h-10 w-full rounded-full border border-shop_light_green/40 bg-shop_btn_dark_green px-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-white shadow-none hover:border-shop_light_green hover:bg-shop_light_green hover:text-[#02101b] hoverEffect",
            className
          )}
        >
          <ShoppingBag className="hidden sm:inline-flex h-4 w-4 shrink-0" />
          <span className="text-center whitespace-normal sm:whitespace-nowrap">
            Ajouter au panier
          </span>
        </Button>
      )}
    </div>
  );
};

export default AddToCartButton;
