import Link from "next/link";

import HomeFeaturedCategories from "@/components/home/HomeFeaturedCategories";
import HomeSectionHeading from "@/components/home/HomeSectionHeading";
import type { HomepageDynamicSection } from "@/lib/homepage-sections";

type CategorySectionRendererProps = {
  section: HomepageDynamicSection;
};

export default function CategorySectionRenderer({ section }: CategorySectionRendererProps) {
  const categories = section.categories || [];

  if (!categories.length) {
    return null;
  }

  const action =
    section.ctaLabel && section.ctaLink ? (
      <Link
        href={section.ctaLink}
        className="horae-outline-button"
      >
        {section.ctaLabel}
      </Link>
    ) : null;

  return (
    <section id={section.key} className="scroll-mt-28">
      <HomeSectionHeading title={section.title} subtitle={section.subtitle} action={action} />
      <HomeFeaturedCategories categories={categories} />
    </section>
  );
}
