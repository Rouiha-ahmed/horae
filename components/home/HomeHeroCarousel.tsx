"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion, type Variants } from "motion/react";

import { resolveImageUrl } from "@/lib/image";
import type { StorefrontHeroSlide } from "@/lib/storefront";

type HomeHeroCarouselProps = {
  slides: StorefrontHeroSlide[];
  autoplayMs: number;
};

const cinematicEase = [0.22, 1, 0.36, 1] as const;

const textContainerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { delayChildren: 0.14, staggerChildren: 0.075 },
  },
  exit: {
    opacity: 0,
    transition: { duration: 0.34, staggerChildren: 0.025, staggerDirection: -1 },
  },
};

const textItemVariants: Variants = {
  hidden: { opacity: 0, y: 13 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.58, ease: cinematicEase },
  },
  exit: {
    opacity: 0,
    y: 8,
    transition: { duration: 0.28, ease: cinematicEase },
  },
};

export default function HomeHeroCarousel({ slides, autoplayMs }: HomeHeroCarouselProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [timerVersion, setTimerVersion] = useState(0);
  const reduceMotion = useReducedMotion();
  const transitionDuration = reduceMotion ? 0 : 1;

  const selectSlide = useCallback(
    (index: number) => {
      if (!slides.length) return;
      setSelectedIndex((index + slides.length) % slides.length);
      setTimerVersion((version) => version + 1);
    },
    [slides.length]
  );

  const moveSlide = useCallback(
    (direction: number) => {
      selectSlide(selectedIndex + direction);
    },
    [selectSlide, selectedIndex]
  );

  useEffect(() => {
    if (slides.length < 2) return;

    let timeoutId: number | undefined;
    const delay = Math.max(autoplayMs || 5000, 2000);

    const scheduleNext = () => {
      if (timeoutId) window.clearTimeout(timeoutId);
      if (document.visibilityState === "hidden") return;

      timeoutId = window.setTimeout(() => {
        setSelectedIndex((current) => (current + 1) % slides.length);
      }, delay);
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden" && timeoutId) {
        window.clearTimeout(timeoutId);
      } else {
        scheduleNext();
      }
    };

    scheduleNext();
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      if (timeoutId) window.clearTimeout(timeoutId);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [autoplayMs, selectedIndex, slides.length, timerVersion]);

  useEffect(() => {
    if (slides.length < 2) return;
    const nextSlide = slides[(selectedIndex + 1) % slides.length];
    const nextImageUrl = resolveImageUrl(nextSlide?.imageUrl || "");

    if (nextImageUrl) {
      const preloadedImage = new window.Image();
      preloadedImage.src = nextImageUrl;
    }
  }, [selectedIndex, slides]);

  const activeSlide = slides[selectedIndex];
  const nextSlide = slides[(selectedIndex + 1) % slides.length];
  const activeImageUrl = useMemo(
    () => resolveImageUrl(activeSlide?.imageUrl || ""),
    [activeSlide?.imageUrl]
  );
  const nextImageUrl = useMemo(
    () => resolveImageUrl(nextSlide?.imageUrl || ""),
    [nextSlide?.imageUrl]
  );

  if (!activeSlide) return null;

  return (
    <section
      className="pt-0"
      tabIndex={0}
      aria-roledescription="carrousel"
      aria-label="Sélection HORAE"
      onKeyDown={(event) => {
        if (event.key === "ArrowLeft") {
          event.preventDefault();
          moveSlide(-1);
        }
        if (event.key === "ArrowRight") {
          event.preventDefault();
          moveSlide(1);
        }
      }}
    >
      <article className="relative isolate min-h-[760px] overflow-hidden rounded-[28px] border border-white/10 bg-[#02060b] text-[#edf7ff] shadow-[0_46px_120px_-58px_rgba(19,141,206,0.72)] sm:min-h-[800px] lg:min-h-[650px] xl:min-h-[690px]">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_2%,rgba(58,174,233,0.50),transparent_32%),radial-gradient(circle_at_54%_42%,rgba(18,93,151,0.34),transparent_30%),linear-gradient(117deg,#0a4a73_0%,#061b31_35%,#02060b_72%)]" />
        <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(1,5,10,0.08),transparent_48%,rgba(1,4,8,0.74))]" />
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-sky-200/35 to-transparent" />

        <div className="absolute inset-0 grid grid-rows-[310px_1fr] gap-1 px-6 pb-24 pt-7 sm:grid-rows-[320px_1fr] sm:px-9 sm:pt-10 lg:grid-cols-[0.78fr_1.37fr_0.52fr] lg:grid-rows-1 lg:items-center lg:gap-5 lg:px-12 lg:pb-20 lg:pt-14 xl:grid-cols-[0.7fr_1.42fr_0.55fr] xl:px-14">
          <div className="relative z-20 min-h-0 lg:h-full">
            <AnimatePresence initial={false} mode="sync">
              <motion.div
                key={`copy-${activeSlide.id}`}
                className="absolute inset-0 flex max-w-[29rem] flex-col items-start justify-center overflow-hidden"
                variants={reduceMotion ? undefined : textContainerVariants}
                initial={reduceMotion ? { opacity: 1 } : "hidden"}
                animate={reduceMotion ? { opacity: 1 } : "visible"}
                exit={reduceMotion ? { opacity: 0 } : "exit"}
              >
                {activeSlide.badge ? (
                  <motion.p
                    variants={reduceMotion ? undefined : textItemVariants}
                    className="mb-8 inline-flex rounded-full border border-sky-200/15 bg-sky-950/40 px-3 py-1.5 text-[8px] font-medium uppercase tracking-[0.14em] text-sky-100/80 backdrop-blur-md"
                  >
                    {activeSlide.badge}
                  </motion.p>
                ) : null}

                <motion.p
                  variants={reduceMotion ? undefined : textItemVariants}
                  className="mb-4 text-[9px] font-medium uppercase tracking-[0.16em] text-sky-100/48"
                >
                  HR-{String(selectedIndex + 1).padStart(2, "0")} · Collection
                </motion.p>

                <motion.h1
                  variants={reduceMotion ? undefined : textItemVariants}
                  className="max-w-[11ch] text-[clamp(2.45rem,4vw,3.9rem)] font-light uppercase leading-[0.96] tracking-[-0.065em] text-white"
                >
                  {activeSlide.title}
                </motion.h1>

                {activeSlide.subtitle ? (
                  <motion.p
                    variants={reduceMotion ? undefined : textItemVariants}
                    className="mt-5 line-clamp-3 max-w-sm text-[12px] font-light leading-6 text-sky-50/55"
                  >
                    {activeSlide.subtitle}
                  </motion.p>
                ) : null}

                {activeSlide.ctaLabel && activeSlide.ctaHref ? (
                  <motion.div variants={reduceMotion ? undefined : textItemVariants} className="mt-6">
                    <Link href={activeSlide.ctaHref} className="horae-button">
                      {activeSlide.ctaLabel}
                      <ArrowRight className="h-3.5 w-3.5" />
                    </Link>
                  </motion.div>
                ) : null}
              </motion.div>
            </AnimatePresence>
          </div>

          <div className="relative z-10 h-full min-h-0">
            <AnimatePresence initial={false} mode="sync">
              <motion.div
                key={`image-${activeSlide.id}`}
                className="absolute inset-0"
                initial={reduceMotion ? { opacity: 1 } : { opacity: 0, scale: 1.04, y: -10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.96, y: 10 }}
                transition={{ duration: transitionDuration, ease: cinematicEase }}
              >
                {activeImageUrl ? (
                  <Image
                    src={activeImageUrl}
                    alt={activeSlide.altText || activeSlide.title}
                    fill
                    priority={selectedIndex === 0}
                    unoptimized
                    sizes="(min-width: 1280px) 48vw, (min-width: 1024px) 52vw, 100vw"
                    className="object-contain object-center drop-shadow-[0_40px_48px_rgba(0,0,0,0.5)]"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center rounded-[24px] border border-dashed border-sky-200/20 text-xs text-white/40">
                    Image indisponible
                  </div>
                )}
              </motion.div>
            </AnimatePresence>
          </div>

          <aside className="relative z-20 hidden h-full items-center justify-end lg:flex">
            {slides.length > 1 ? (
            <AnimatePresence initial={false} mode="sync">
              <motion.button
                key={`preview-${nextSlide.id}`}
                type="button"
                onClick={() => moveSlide(1)}
                className="group w-full max-w-[168px] text-left"
                initial={reduceMotion ? false : { opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 8 }}
                transition={{ duration: reduceMotion ? 0 : 0.62, ease: cinematicEase }}
                aria-label={`Afficher ${nextSlide.title}`}
              >
                <p className="mb-3 text-right text-[8px] font-medium uppercase tracking-[0.16em] text-shop_light_green">
                  À suivre
                </p>
                <span className="relative block aspect-[1.55/1] overflow-hidden rounded-[18px] border border-white/10 bg-white/[0.04] shadow-[0_18px_40px_-22px_rgba(0,0,0,0.9)]">
                  {nextImageUrl ? (
                    <Image
                      src={nextImageUrl}
                      alt=""
                      fill
                      unoptimized
                      sizes="168px"
                      className="object-contain p-2.5 opacity-72 transition duration-500 group-hover:scale-105 group-hover:opacity-100"
                    />
                  ) : null}
                  <span className="absolute inset-0 bg-gradient-to-t from-black/35 to-transparent" />
                  <span className="absolute bottom-2.5 right-2.5 inline-flex h-7 w-7 items-center justify-center rounded-full bg-shop_light_green text-[#02101b]">
                    <ArrowRight className="h-3.5 w-3.5" />
                  </span>
                </span>
                <span className="mt-3 block line-clamp-2 text-right text-[9px] font-medium uppercase leading-4 tracking-[0.11em] text-white/42">
                  {nextSlide.title}
                </span>
              </motion.button>
            </AnimatePresence>
            ) : (
              <p className="inline-flex items-center gap-2 self-start pt-2 text-[8px] font-medium uppercase tracking-[0.16em] text-shop_light_green lg:self-center lg:pt-0">
                <span className="h-1.5 w-1.5 rounded-full bg-shop_light_green shadow-[0_0_12px_rgba(56,189,248,0.9)]" />
                Disponible
              </p>
            )}
          </aside>
        </div>

        {slides.length > 1 ? (
          <div className="absolute inset-x-6 bottom-7 z-30 grid grid-cols-[1fr_auto_1fr] items-center gap-4 sm:inset-x-9 lg:inset-x-12 xl:inset-x-14">
            <button
              type="button"
              onClick={() => moveSlide(-1)}
              className="group inline-flex min-w-0 items-center gap-2 justify-self-start text-[8px] font-medium uppercase tracking-[0.15em] text-white/42 transition hover:text-white"
              aria-label="Slide précédent"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              <span className="hidden max-w-32 truncate sm:block">Précédent</span>
            </button>

            <div className="flex items-center gap-1.5" aria-label="Sélectionner un slide">
              {slides.map((slide, index) => (
                <button
                  key={slide.id}
                  type="button"
                  onClick={() => selectSlide(index)}
                  className="group flex h-8 items-center"
                  aria-label={`Afficher le slide ${index + 1}: ${slide.title}`}
                  aria-current={selectedIndex === index ? "true" : undefined}
                >
                  <span
                    className={`block h-px rounded-full transition-all duration-500 ${
                      selectedIndex === index
                        ? "w-8 bg-shop_light_green"
                        : "w-2.5 bg-white/25 group-hover:bg-white/60"
                    }`}
                  />
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={() => moveSlide(1)}
              className="group inline-flex min-w-0 items-center gap-2 justify-self-end text-[8px] font-medium uppercase tracking-[0.15em] text-white/42 transition hover:text-white"
              aria-label="Slide suivant"
            >
              <span className="hidden max-w-32 truncate text-right sm:block">Suivant</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>
        ) : null}

        <p className="sr-only" aria-live="polite">
          Slide {selectedIndex + 1} sur {slides.length}: {activeSlide.title}
        </p>
      </article>
    </section>
  );
}
