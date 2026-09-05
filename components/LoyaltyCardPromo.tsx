import Image from "next/image";
import Link from "next/link";
import React from "react";

const LoyaltyCardPromo = () => {
  return (
    <section className="my-8 md:my-10">
      <div className="relative overflow-hidden rounded-[24px] border border-shop_light_green/25 bg-[#071522] text-[#edf7ff]">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(184,163,106,0.28),transparent_42%),radial-gradient(circle_at_bottom_left,rgba(245,245,240,0.08),transparent_40%)]" />
        <div className="relative grid gap-5 md:grid-cols-[0.95fr,1.25fr] items-center p-5 md:p-8">
          <div className="space-y-3 md:space-y-4">
            <p className="horae-kicker inline-flex border-l border-shop_light_green px-3 text-shop_light_green">
              Carte Fidelite HORAE
            </p>
            <h2 className="font-editorial text-4xl font-medium leading-none text-white md:text-6xl">
              Demandez la carte et cumulez des avantages a chaque commande
            </h2>
            <p className="max-w-xl text-sm leading-7 text-white/50 md:text-base">
              Profitez d&apos;offres exclusives, de reductions reservees aux membres
              et d&apos;un suivi personnalise pour votre routine beaute et bien-etre.
            </p>
            <div className="flex flex-wrap items-center gap-3 pt-1">
              <Link
                href="/#contact"
                className="horae-button"
              >
                Demander ma carte
              </Link>
              <span className="border border-white/15 px-4 py-2 text-xs font-medium text-white/65 md:text-sm">
                Livraison rapide partout au Maroc
              </span>
            </div>
          </div>

          <div className="relative">
            <Image
              src="/carte-fideliteEEEEE.png"
              alt="Promotion carte fidelite HORAE"
              width={1600}
              height={900}
              className="h-64 w-full object-contain object-center md:h-[420px] lg:h-[500px]"
            />
          </div>
        </div>
      </div>
    </section>
  );
};

export default LoyaltyCardPromo;
