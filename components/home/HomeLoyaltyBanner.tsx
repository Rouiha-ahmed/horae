import Image from "next/image";
import Link from "next/link";

import { sanitizePublicImageUrl } from "@/lib/image";

type HomeLoyaltyBannerProps = {
  badge: string;
  title: string;
  description: string;
  ctaLabel: string;
  ctaHref: string;
  highlightText: string;
  imageUrl: string | null;
};

export default function HomeLoyaltyBanner({
  badge,
  title,
  description,
  ctaLabel,
  ctaHref,
  highlightText,
  imageUrl,
}: HomeLoyaltyBannerProps) {
  const resolvedImageUrl = sanitizePublicImageUrl(
    imageUrl,
    "/carte-fideliteEEEEE.png"
  );

  return (
    <section className="relative isolate overflow-hidden rounded-[28px] border border-white/10 bg-[#02070d] text-[#edf7ff] shadow-[0_34px_90px_-54px_rgba(56,189,248,0.68)]">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_78%_30%,rgba(56,189,248,0.28),transparent_28%),linear-gradient(110deg,#0a3656,#02070d_70%)]" />

      <div className="relative grid min-h-[440px] items-center gap-8 p-7 md:grid-cols-[1.05fr_0.95fr] md:px-14 md:py-12">
        <div className="space-y-6">
          <p className="horae-kicker inline-flex items-center gap-3 text-shop_light_green before:h-px before:w-8 before:bg-shop_light_green">
            {badge}
          </p>
          <h2 className="font-editorial max-w-2xl text-[clamp(2.6rem,5.5vw,5rem)] font-light uppercase leading-[0.94] tracking-[-0.06em] text-white">
            {title}
          </h2>
          <p className="max-w-xl text-sm leading-7 text-white/52">{description}</p>

          <div className="flex flex-wrap items-center gap-3 pt-1">
            <Link
              href={ctaHref}
              className="horae-button"
            >
              {ctaLabel}
            </Link>
            <span className="inline-flex border-l border-shop_light_green px-4 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-white/65">
              {highlightText}
            </span>
          </div>
        </div>

        <div className="relative min-h-64 md:min-h-[350px]">
          {resolvedImageUrl ? (
            <Image
              src={resolvedImageUrl}
              alt={title}
              fill
              unoptimized
              sizes="(min-width: 1024px) 30rem, 100vw"
              className="object-contain"
            />
          ) : (
            <div className="flex h-full items-center justify-center rounded-[22px] border border-dashed border-shop_light_green/35 bg-white/[0.03] text-sm text-lightColor">
              Image de fidelite indisponible
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
