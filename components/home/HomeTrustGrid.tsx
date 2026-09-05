import {
  Headset,
  ShieldCheck,
  Truck,
  Wallet,
  RotateCcw,
  type LucideIcon,
} from "lucide-react";

import type { StorefrontTrustItem } from "@/lib/storefront";

const iconMap: Record<string, LucideIcon> = {
  truck: Truck,
  shield: ShieldCheck,
  headset: Headset,
  wallet: Wallet,
  return: RotateCcw,
};

type HomeTrustGridProps = {
  items: StorefrontTrustItem[];
};

export default function HomeTrustGrid({ items }: HomeTrustGridProps) {
  if (!items.length) {
    return null;
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {items.map((item) => {
        const Icon = iconMap[item.icon] || ShieldCheck;

        return (
          <article
            key={item.id}
            className="rounded-[24px] border border-white/10 bg-[#071522]/65 p-6 transition-all duration-300 hover:-translate-y-1 hover:border-shop_light_green/50"
          >
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-shop_light_green/45 text-shop_dark_green">
              <Icon className="h-4.5 w-4.5" />
            </span>
            <h3 className="font-editorial mt-5 text-xl font-semibold text-shop_dark_green">{item.title}</h3>
            <p className="mt-2 text-[13px] leading-6 text-lightColor">{item.description}</p>
          </article>
        );
      })}
    </div>
  );
}
