"use client";

import Link from "next/link";
import { motion } from "motion/react";
import { ArrowRight, PackageSearch, Sparkles } from "lucide-react";

import { cn } from "@/lib/utils";

const NoProductAvailable = ({
  selectedTab,
  className,
}: {
  selectedTab?: string;
  className?: string;
}) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      className={cn(
        "relative flex w-full flex-col items-center justify-center overflow-hidden rounded-[24px] border border-shop_light_green/25 bg-white/[0.03] px-6 py-16 text-center",
        className
      )}
    >
      {/* Background glow */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(77,182,198,0.07),transparent_65%)]" />

      {/* Icon */}
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 0.1, duration: 0.4 }}
        className="relative mb-6 flex h-20 w-20 items-center justify-center rounded-full border border-shop_light_green/45 bg-shop_light_green/10"
      >
        <PackageSearch className="h-9 w-9 text-shop_btn_dark_green" strokeWidth={1.5} />
        <span className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-shop_light_green shadow-sm">
          <Sparkles className="h-2.5 w-2.5 text-white" />
        </span>
      </motion.div>

      {/* Title */}
      <motion.h2
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15, duration: 0.4 }}
        className="text-xl font-bold tracking-tight text-shop_dark_green md:text-2xl"
      >
        Cette categorie se prepare
      </motion.h2>

      {/* Message */}
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.25, duration: 0.4 }}
        className="mt-3 max-w-sm text-sm leading-6 text-lightColor"
      >
        Nous n&apos;avons pas encore de produits disponibles
        {selectedTab ? (
          <>
            {" "}dans{" "}
            <span className="font-semibold capitalize text-shop_btn_dark_green">
              {selectedTab.replace(/-/g, " ")}
            </span>
          </>
        ) : null}
        . Notre equipe travaille activement pour enrichir cette selection — revenez tres bientot.
      </motion.p>

      {/* Divider */}
      <motion.div
        initial={{ scaleX: 0 }}
        animate={{ scaleX: 1 }}
        transition={{ delay: 0.35, duration: 0.4 }}
        className="my-6 h-px w-16 rounded-full bg-shop_light_green/30"
      />

      {/* CTA */}
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4, duration: 0.4 }}
        className="flex flex-col items-center gap-3 sm:flex-row"
      >
        <Link
          href="/shop"
          className="inline-flex items-center gap-2 rounded-full bg-shop_btn_dark_green px-5 py-2.5 text-sm font-semibold text-white shadow-[0_8px_24px_-10px_rgba(56,189,248,0.7)] transition-all hover:-translate-y-0.5 hover:bg-shop_light_green hover:text-[#02101b]"
        >
          Explorer la boutique
          <ArrowRight className="h-4 w-4" />
        </Link>
        <Link
          href="/#contact"
          className="inline-flex items-center gap-2 rounded-full border border-shop_light_green/30 bg-white/[0.03] px-5 py-2.5 text-sm font-semibold text-shop_dark_green transition-all hover:-translate-y-0.5 hover:border-shop_light_green/60"
        >
          Nous contacter
        </Link>
      </motion.div>
    </motion.div>
  );
};

export default NoProductAvailable;
