import Container from "@/components/Container";
import ProductCard from "@/components/ProductCard";
import { Product } from "@/types";
import { getDealProducts } from "@/lib/queries";
import React from "react";

export const revalidate = 300;

const DealPage = async () => {
  const products = await getDealProducts();
  return (
    <div className="horae-page pb-24">
      <div className="mx-3 mt-3 overflow-hidden rounded-[28px] border border-white/10 bg-[radial-gradient(circle_at_16%_0%,rgba(55,176,237,0.42),transparent_38%),linear-gradient(118deg,#0a456d,#02070d_68%)] text-[#edf7ff]">
        <Container className="flex min-h-[300px] flex-col justify-end py-12 md:min-h-[380px] md:py-16">
          <p className="horae-kicker text-shop_light_green">Sélection confidentielle</p>
          <h1 className="horae-display mt-5">Les offres<br />du moment.</h1>
        </Container>
      </div>
      <Container className="pt-14 md:pt-20">
        <div className="grid grid-cols-2 gap-x-3 gap-y-9 md:grid-cols-3 lg:grid-cols-5">
          {products?.map((product) => (
            <ProductCard key={product?._id} product={product as unknown as Product} />
          ))}
        </div>
      </Container>
    </div>
  );
};

export default DealPage;
