"use client";
import { ShoppingCart } from "lucide-react";
import Link from "next/link";
import { motion } from "motion/react";
import { emptyCart } from "@/images";
import Image from "next/image";

export default function EmptyCart() {
  return (
    <div className="horae-page flex items-center justify-center p-5 py-16 md:py-24">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-xl space-y-8 rounded-[28px] border border-white/10 bg-[#071522]/72 p-8 text-center md:p-12"
      >
        <motion.div
          animate={{
            scale: [1, 1.1, 1],
            rotate: [0, 5, -5, 0],
          }}
          transition={{
            repeat: Infinity,
            duration: 5,
            ease: "easeInOut",
          }}
          className="relative w-48 h-48 mx-auto"
        >
          <Image
            src={emptyCart}
            alt="Panier vide"
            fill
            className="drop-shadow-lg"
            style={{ objectFit: "contain" }}
          />
          <motion.div
            animate={{
              x: [0, -10, 10, 0],
              y: [0, -5, 5, 0],
            }}
            transition={{
              repeat: Infinity,
              duration: 3,
              ease: "linear",
            }}
            className="absolute -right-4 -top-4 rounded-full bg-shop_light_green p-2"
          >
            <ShoppingCart size={24} className="text-white" />
          </motion.div>
        </motion.div>

        <div className="text-center space-y-4">
          <p className="horae-kicker text-shop_light_green">Votre sélection</p>
          <h2 className="font-editorial text-4xl font-light uppercase text-shop_dark_green md:text-5xl">
            Votre panier est vide
          </h2>
          <p className="text-gray-600">
            Vous n&apos;avez pas encore ajoute de produits a votre panier.
            Decouvrez nos meilleures selections !
          </p>
        </div>

        <div>
          <Link
            href="/"
            className="horae-outline-button w-full"
          >
            Decouvrir les produits
          </Link>
        </div>
      </motion.div>
    </div>
  );
}
