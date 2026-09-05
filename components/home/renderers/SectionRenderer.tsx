import BannerSectionRenderer from "@/components/home/renderers/BannerSectionRenderer";
import BrandSectionRenderer from "@/components/home/renderers/BrandSectionRenderer";
import CategorySectionRenderer from "@/components/home/renderers/CategorySectionRenderer";
import HeroSectionRenderer from "@/components/home/renderers/HeroSectionRenderer";
import LinksGroupRenderer from "@/components/home/renderers/LinksGroupRenderer";
import NewsletterSectionRenderer from "@/components/home/renderers/NewsletterSectionRenderer";
import ProductSectionRenderer from "@/components/home/renderers/ProductSectionRenderer";
import ReassuranceSectionRenderer from "@/components/home/renderers/ReassuranceSectionRenderer";
import SocialLinksRenderer from "@/components/home/renderers/SocialLinksRenderer";
import type { HomepageDynamicSection } from "@/lib/homepage-sections";

type SectionRendererProps = {
  section: HomepageDynamicSection;
};

export default function SectionRenderer({ section }: SectionRendererProps) {
  if (section.type === "hero") {
    return <HeroSectionRenderer section={section} />;
  }

  if (section.type === "product_list") {
    return <ProductSectionRenderer section={section} />;
  }

  if (section.type === "category_list") {
    return <CategorySectionRenderer section={section} />;
  }

  if (section.type === "brand_list") {
    return <BrandSectionRenderer section={section} />;
  }

  if (section.type === "reassurance") {
    return <ReassuranceSectionRenderer section={section} />;
  }

  if (section.type === "newsletter") {
    return <NewsletterSectionRenderer section={section} />;
  }

  if (section.type === "custom_banner") {
    return <BannerSectionRenderer section={section} />;
  }

  if (section.type === "links_group") {
    return <LinksGroupRenderer section={section} />;
  }

  if (section.type === "social_links") {
    return <SocialLinksRenderer section={section} />;
  }

  if (section.type === "custom_html") {
    const html = section.config.html;
    if (typeof html !== "string" || !html.trim()) {
      console.warn(`Homepage section "${section.key}" ignored: empty custom_html payload.`);
      return null;
    }

    return (
      <section id={section.key} className="scroll-mt-28 rounded-[28px] border border-white/10 bg-[#071522]/70 p-6 shadow-[0_24px_55px_-38px_rgba(56,189,248,0.45)] md:p-8">
        <div
          className="prose prose-slate max-w-none"
          dangerouslySetInnerHTML={{ __html: html }}
        />
      </section>
    );
  }

  if (section.type === "rich_text") {
    const content = section.config.content;
    if (typeof content !== "string" || !content.trim()) {
      console.warn(`Homepage section "${section.key}" ignored: empty rich_text payload.`);
      return null;
    }

    const blocks = content
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);

    return (
      <section id={section.key} className="scroll-mt-28 rounded-[28px] border border-white/10 bg-[#071522]/70 p-6 shadow-[0_24px_55px_-38px_rgba(56,189,248,0.45)] md:p-8">
        <h2 className="text-[1.5rem] font-bold tracking-[-0.02em] text-shop_dark_green md:text-[1.85rem]">
          {section.title}
        </h2>
        {section.subtitle ? <p className="mt-2 text-sm text-lightColor">{section.subtitle}</p> : null}
        <div className="mt-4 space-y-3 text-sm leading-7 text-lightColor">
          {blocks.map((line, index) => (
            <p key={`${section.id}-${index}`}>{line}</p>
          ))}
        </div>
      </section>
    );
  }

  console.warn(`Homepage section "${section.key}" ignored: unknown type "${section.type}".`);
  return null;
}
