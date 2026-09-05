import Logo from "@/components/Logo";
import Link from "next/link";
import React from "react";

const NotFoundPage = () => {
  return (
    <div className="horae-page flex min-h-screen flex-col items-center justify-center px-5 py-16 text-center">
      <div className="w-full max-w-xl space-y-10 border-y border-black/12 py-12">
        <div className="text-center">
          <Logo />

          <p className="horae-kicker mt-8 text-shop_light_green">Erreur 404</p>
          <h1 className="font-editorial mt-4 text-5xl font-medium text-gray-900 md:text-7xl">
            Le temps s&apos;est arrêté ici.
          </h1>
          <p className="mx-auto mt-5 max-w-md text-sm leading-7 text-gray-600">
            Cette page n&apos;existe plus ou son adresse a changé. Retrouvez la collection HORAE depuis la boutique.
          </p>
        </div>
        <div className="mt-8 space-y-6">
          <div className="grid gap-3 sm:grid-cols-2">
            <Link
              href="/"
              className="horae-button w-full"
            >
              Retour à l&apos;accueil
            </Link>
            <Link
              href="/shop"
              className="horae-outline-button w-full"
            >
              Explorer la boutique
            </Link>
          </div>
        </div>
        <div className="text-center">
          <p className="text-xs text-gray-500">
            Besoin d&apos;aide ?{" "}
            <Link
              href="/contact"
              className="font-semibold text-black underline decoration-shop_light_green underline-offset-4"
            >
              Contactez-nous
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default NotFoundPage;
