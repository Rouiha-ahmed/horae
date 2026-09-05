import { Product } from "@/types";
import React from "react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "./ui/accordion";

const ProductCharacteristics = ({
  product,
}: {
  product: Product | null | undefined;
}) => {
  return (
    <Accordion type="single" collapsible className="border-y border-white/12 text-white">
      <AccordionItem value="item-1" className="border-none">
        <AccordionTrigger className="py-4 text-[10px] font-semibold uppercase tracking-[0.14em] text-white/70 hover:text-shop_light_green hover:no-underline">{product?.name}: Caracteristiques</AccordionTrigger>
        <AccordionContent className="space-y-2 text-xs text-white/48">
          <p className="flex items-center justify-between">
            Marque:{" "}
            <span className="font-semibold tracking-wide">
              {product?.brand?.title || "N/D"}
            </span>
          </p>
          <p className="flex items-center justify-between">
            Collection:{" "}
            <span className="font-semibold tracking-wide">2025</span>
          </p>
          <p className="flex items-center justify-between">
            Stock:{" "}
            <span className="font-semibold tracking-wide">
              {product?.stock ? "Disponible" : "Rupture de stock"}
            </span>
          </p>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
};

export default ProductCharacteristics;
