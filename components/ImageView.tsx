"use client";
import { AppImage } from "@/types";
import { urlFor } from "@/lib/image";
import { AnimatePresence, motion } from "motion/react";
import Image from "next/image";
import React, { useState } from "react";

interface Props {
  images?: AppImage[];
  isStock?: number | undefined;
}

const ImageView = ({ images = [], isStock }: Props) => {
  const [active, setActive] = useState(images[0] || null);

  if (!active) {
    return null;
  }

  return (
    <div className="w-full space-y-3 md:space-y-4">
      <AnimatePresence mode="wait">
        <motion.div
          key={active._key}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.5 }}
          className="group relative min-h-[420px] w-full overflow-hidden rounded-[28px] border border-white/10 bg-[radial-gradient(circle_at_50%_35%,rgba(56,189,248,0.22),transparent_40%),#06111d] md:min-h-[620px]"
        >
          <Image
            src={urlFor(active).url()}
            alt="Produit"
            fill
            priority
            unoptimized
            sizes="(min-width: 768px) 50vw, 100vw"
            className={`object-contain p-5 transition-transform duration-700 ease-[cubic-bezier(.22,1,.36,1)] group-hover:scale-[1.025] ${
              isStock === 0 ? "opacity-50" : ""
            }`}
          />
        </motion.div>
      </AnimatePresence>
      <div className="grid h-16 grid-cols-6 gap-2 md:h-20">
        {images.map((image) => (
          <button
            key={image._key}
            onClick={() => setActive(image)}
            className={`overflow-hidden rounded-xl border bg-white/[0.03] transition-opacity ${active._key === image._key ? "border-shop_light_green opacity-100" : "border-white/10 opacity-50 hover:opacity-90"}`}
          >
            <Image
              src={urlFor(image).url()}
              alt={`Thumbnail ${image._key}`}
              width={100}
              height={100}
              sizes="80px"
              unoptimized
              className="w-full h-auto object-contain"
            />
          </button>
        ))}
      </div>
    </div>
  );
};

export default ImageView;
