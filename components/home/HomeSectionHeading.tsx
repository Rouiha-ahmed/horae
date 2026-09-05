import type { ReactNode } from "react";

type HomeSectionHeadingProps = {
  title: string;
  subtitle?: string | null;
  action?: ReactNode;
};

export default function HomeSectionHeading({
  title,
  subtitle,
  action,
}: HomeSectionHeadingProps) {
  return (
    <div className="mb-8 flex flex-wrap items-end justify-between gap-5 border-b border-white/10 pb-5 md:mb-10">
      <div className="space-y-2">
        <p className="horae-kicker text-shop_light_green">Selection HORAE</p>
        <h2 className="font-editorial text-[clamp(2.3rem,5vw,4.35rem)] font-light uppercase leading-[0.94] tracking-[-0.055em] text-shop_dark_green">
          {title}
        </h2>
        {subtitle ? (
          <p className="max-w-2xl text-[13px] leading-6 text-lightColor">{subtitle}</p>
        ) : null}
      </div>
      {action}
    </div>
  );
}
