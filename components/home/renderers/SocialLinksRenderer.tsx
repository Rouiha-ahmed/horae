import HomeSectionHeading from "@/components/home/HomeSectionHeading";
import SocialMedia from "@/components/SocialMedia";
import type { HomepageDynamicSection } from "@/lib/homepage-sections";

type SocialLinksRendererProps = {
  section: HomepageDynamicSection;
};

export default function SocialLinksRenderer({ section }: SocialLinksRendererProps) {
  const links = section.socialLinks || [];

  if (!links.length) {
    return null;
  }

  return (
    <section id={section.key} className="scroll-mt-28 rounded-[28px] border border-white/10 bg-[#071522]/70 p-6 shadow-[0_24px_55px_-38px_rgba(56,189,248,0.45)] md:p-8">
      <HomeSectionHeading title={section.title} subtitle={section.subtitle} />
      <SocialMedia
        links={links}
        className="text-darkColor/70"
        iconClassName="h-11 w-11 rounded-xl border-shop_light_green/30 hover:border-shop_light_green hover:text-shop_dark_green"
        tooltipClassName="bg-darkColor text-white"
      />
    </section>
  );
}
