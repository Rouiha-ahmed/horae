import { Product } from "@/types";
import useStore from "@/store";
import { Button } from "./ui/button";
import { Minus, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import toast from "react-hot-toast";

interface Props {
  product: Product;
  className?: string;
}
const QuantityButtons = ({ product, className }: Props) => {
  const addItem = useStore((state) => state.addItem);
  const removeItem = useStore((state) => state.removeItem);
  const getItemCount = useStore((state) => state.getItemCount);
  const hasHydrated = useStore((state) => state.hasHydrated);
  const itemCount = hasHydrated ? getItemCount(product?._id) : 0;

  const handleRemoveProduct = () => {
    removeItem(product?._id);
    if (itemCount <= 1) {
      toast.success(`${product?.name?.substring(0, 20)} retiré du panier`);
    }
  };

  const handleAddToCart = () => {
    if (!hasHydrated) {
      return;
    }

    addItem(product);
  };

  return (
    <div className={cn("flex items-center gap-1 pb-1 text-base", className)}>
      <Button
        onClick={handleRemoveProduct}
        variant="outline"
        size="icon"
        disabled={!hasHydrated || itemCount === 0}
        className="h-6 w-6 rounded-full border-white/15 bg-white/[0.03] text-white hover:bg-shop_light_green/20 hoverEffect"
      >
        <Minus />
      </Button>
      <span className="font-semibold text-sm w-6 text-center text-darkColor">
        {itemCount}
      </span>
      <Button
        onClick={handleAddToCart}
        variant="outline"
        size="icon"
        disabled={!hasHydrated}
        className="h-6 w-6 rounded-full border-white/15 bg-white/[0.03] text-white hover:bg-shop_light_green/20 hoverEffect"
      >
        <Plus />
      </Button>
    </div>
  );
};

export default QuantityButtons;
