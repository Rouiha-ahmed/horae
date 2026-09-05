"use client";

import useStore from "@/store";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect } from "react";
import { motion, useReducedMotion } from "motion/react";
import { Check, Home, Package, ShoppingBag } from "lucide-react";
import Link from "next/link";

const SuccessPageContent = () => {
  const { resetCart } = useStore();
  const searchParams = useSearchParams();
  const orderNumber = searchParams.get("orderNumber");
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    if (orderNumber) {
      resetCart();
    }
  }, [orderNumber, resetCart]);
  return (
    <div className="horae-page flex min-h-[72vh] items-center justify-center p-5 py-16">
      <motion.div
        initial={reduceMotion ? false : { opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="flex w-full max-w-2xl flex-col gap-8 rounded-[28px] border border-white/10 bg-[#071522]/72 p-8 text-center md:p-12"
      >
        <motion.div
          initial={reduceMotion ? false : { scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
          className="mx-auto mb-2 flex h-20 w-20 items-center justify-center rounded-full border border-shop_light_green bg-shop_btn_dark_green/25"
        >
          <Check className="text-white w-10 h-10" />
        </motion.div>

        <p className="horae-kicker text-shop_light_green">Merci</p>
        <h1 className="font-editorial mb-2 text-5xl font-light uppercase text-shop_dark_green md:text-6xl">
          Commande confirmee !
        </h1>
        <div className="space-y-4 mb-4 text-left">
          <p className="text-gray-700">
            Merci pour votre achat. Votre commande est en cours de traitement
            et sera expediee bientot. Un e-mail de confirmation avec les details
            de la commande vous sera envoye.
          </p>
          <p className="text-gray-700">
            Numero de commande :{" "}
            <span className="font-semibold text-shop_light_green">{orderNumber}</span>
          </p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Link
            href="/"
            className="horae-button"
          >
            <Home className="w-5 h-5 mr-2" />
            Accueil
          </Link>
          <Link
            href="/orders"
            className="horae-outline-button"
          >
            <Package className="w-5 h-5 mr-2" />
            Commandes
          </Link>
          <Link
            href="/"
            className="horae-button"
          >
            <ShoppingBag className="w-5 h-5 mr-2" />
            Boutique
          </Link>
        </div>
      </motion.div>
    </div>
  );
};

const SuccessPage = () => {
  return (
    <Suspense fallback={<div>Chargement...</div>}>
      <SuccessPageContent />
    </Suspense>
  );
};

export default SuccessPage;
