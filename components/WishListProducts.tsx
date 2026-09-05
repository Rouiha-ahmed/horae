"use client";

import useStore from "@/store";
import { useState } from "react";
import Container from "./Container";
import { Heart, X } from "lucide-react";
import { Button } from "./ui/button";
import Link from "next/link";
import { Product } from "@/types";
import toast from "react-hot-toast";
import Image from "next/image";
import { urlFor } from "@/lib/image";
import PriceFormatter from "./PriceFormatter";
import AddToCartButton from "./AddToCartButton";

const WishListProducts = () => {
  const [visibleProducts, setVisibleProducts] = useState(7);
  const favoriteProduct = useStore((state) => state.favoriteProduct);
  const removeFromFavorite = useStore((state) => state.removeFromFavorite);
  const resetFavorite = useStore((state) => state.resetFavorite);
  const hasHydrated = useStore((state) => state.hasHydrated);
  const safeFavorites = hasHydrated ? favoriteProduct : [];
  const loadMore = () => {
    setVisibleProducts((prev) => Math.min(prev + 5, safeFavorites.length));
  };

  const handleResetWishlist = () => {
    const confirmReset = window.confirm(
      "Voulez-vous vraiment reinitialiser votre liste de souhaits ?"
    );
    if (confirmReset) {
      resetFavorite();
      toast.success("Liste de souhaits reinitialisee avec succes");
    }
  };

  return (
    <div className="horae-page">
    <Container className="pb-24">
      <div className="border-b border-white/10 pb-8 pt-12 md:pb-10 md:pt-16">
        <p className="horae-kicker text-shop_light_green">Pièces choisies</p>
        <h1 className="font-editorial mt-3 text-5xl font-light uppercase tracking-[-0.055em] md:text-7xl">
          Mes favoris.
        </h1>
      </div>
      {!hasHydrated ? (
        <div className="flex min-h-100 flex-col items-center justify-center space-y-3 px-4 text-center">
          <Heart className="h-12 w-12 text-muted-foreground" strokeWidth={1.5} />
          <div className="space-y-2">
            <h2 className="text-2xl font-semibold tracking-tight">
              Chargement de votre liste de souhaits
            </h2>
            <p className="text-sm text-muted-foreground">
              Nous recuperons vos produits enregistres.
            </p>
          </div>
        </div>
      ) : safeFavorites.length > 0 ? (
        <>
          <div className="mt-10 overflow-x-auto rounded-[24px] border border-white/10 bg-[#071522]/70">
            <table className="w-full border-collapse">
              <thead className="border-b">
                <tr className="bg-black/[0.03] text-[9px] uppercase tracking-[0.16em] text-lightColor">
                  <th className="p-4 text-left">Image</th>
                  <th className="hidden p-4 text-left md:table-cell">
                    Categorie
                  </th>
                  <th className="hidden p-4 text-left md:table-cell">Statut</th>
                  <th className="p-4 text-left">Prix</th>
                  <th className="p-4 text-center md:text-left">Action</th>
                </tr>
              </thead>
              <tbody>
                {safeFavorites
                  ?.slice(0, visibleProducts)
                  ?.map((product: Product) => (
                    <tr key={product?._id} className="border-b border-white/10 last:border-b-0">
                      <td className="flex items-center gap-3 px-4 py-4">
                        <X
                          onClick={() => {
                            removeFromFavorite(product?._id);
                            toast.success("Produit retire de la liste de souhaits");
                          }}
                          size={18}
                          className="hover:text-red-600 hover:cursor-pointer hoverEffect"
                        />
                        {product?.images && (
                          <Link
                            href={`/product/${product?.slug?.current}`}
                            className="group hidden overflow-hidden rounded-xl border border-white/10 bg-[#050e17] md:inline-flex"
                          >
                            <Image
                              src={urlFor(product?.images[0]).url()}
                              alt={"product image"}
                              width={80}
                              height={80}
                              className="h-20 w-20 object-contain transition-transform duration-500 group-hover:scale-105"
                            />
                          </Link>
                        )}
                        <p className="font-editorial line-clamp-1 text-base font-medium uppercase">{product?.name}</p>
                      </td>
                      <td className="p-2 capitalize hidden md:table-cell">
                        {product?.categories && (
                          <p className="uppercase line-clamp-1 text-xs font-medium">
                            {product.categories.map((cat) => cat).join(", ")}
                          </p>
                        )}
                      </td>
                      <td className="p-2 capitalize hidden md:table-cell">
                        <span
                          className={`${
                            (product?.stock as number) > 0
                              ? "text-green-600"
                              : "text-red-600"
                          } font-medium text-sm`}
                        >
                          {(product?.stock as number) > 0
                            ? "En stock"
                            : "Rupture de stock"}
                        </span>
                      </td>
                      <td className="p-2">
                        <PriceFormatter amount={product?.price} />
                      </td>
                      <td className="p-2">
                        <AddToCartButton product={product} className="w-full rounded-full" />
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
          <div className="flex items-center gap-2">
            {visibleProducts < safeFavorites.length && (
              <div className="my-5">
                <Button variant="outline" onClick={loadMore}>
                  Voir plus
                </Button>
              </div>
            )}
            {visibleProducts > 10 && (
              <div className="my-5">
                <Button
                  onClick={() => setVisibleProducts(10)}
                  variant="outline"
                >
                  Voir moins
                </Button>
              </div>
            )}
          </div>
          {safeFavorites.length > 0 && (
            <Button
              onClick={handleResetWishlist}
              className="mb-5 font-semibold"
              variant="destructive"
              size="lg"
            >
              Reinitialiser la liste
            </Button>
          )}
        </>
      ) : (
        <div className="flex min-h-100 flex-col items-center justify-center space-y-6 px-4 text-center">
          <div className="relative mb-4">
            <div className="absolute -top-1 -right-1 h-4 w-4 animate-ping rounded-full bg-muted-foreground/20" />
            <Heart
              className="h-12 w-12 text-muted-foreground"
              strokeWidth={1.5}
            />
          </div>
          <div className="space-y-2">
            <h2 className="text-2xl font-semibold tracking-tight">
              Votre liste de souhaits est vide
            </h2>
            <p className="text-sm text-muted-foreground">
              Les produits ajoutes a votre liste apparaitront ici
            </p>
          </div>
            <Button asChild className="horae-button">
            <Link href="/shop">Continuer vos achats</Link>
          </Button>
        </div>
      )}
    </Container>
    </div>
  );
};

export default WishListProducts;
