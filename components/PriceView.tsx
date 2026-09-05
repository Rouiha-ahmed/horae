import { twMerge } from "tailwind-merge";
import { cn } from "@/lib/utils";
import PriceFormatter from "./PriceFormatter";

interface Props {
  price: number | undefined;
  discount: number | undefined;
  regularPrice?: number | null;
  salePrice?: number | null;
  className?: string;
}
const PriceView = ({ price, discount, regularPrice, salePrice, className }: Props) => {
  const safePrice = typeof price === "number" ? price : 0;
  const safeRegularPrice =
    typeof regularPrice === "number" && regularPrice > 0 ? regularPrice : safePrice;
  const safeSalePrice =
    typeof salePrice === "number" && salePrice > 0 && salePrice < safeRegularPrice
      ? salePrice
      : null;
  const currentPrice = safeSalePrice ?? safePrice;
  const oldPrice =
    safeSalePrice !== null
      ? safeRegularPrice
      : safePrice > 0 && typeof discount === "number" && discount > 0
        ? safePrice + (discount * safePrice) / 100
        : null;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex items-center gap-1.5">
        <PriceFormatter
          amount={currentPrice}
          className={cn("text-[13px] font-semibold tracking-[-0.01em] text-shop_dark_green", className)}
        />
        {oldPrice ? (
          <PriceFormatter
            amount={oldPrice}
            className={twMerge(
              "text-xs font-medium text-zinc-500 line-through",
              className
            )}
          />
        ) : null}
      </div>
      {discount && discount > 0 ? (
        <span className="rounded-full border border-shop_light_green/40 px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.1em] text-shop_light_green">
          -{discount}%
        </span>
      ) : null}
    </div>
  );
};

export default PriceView;
