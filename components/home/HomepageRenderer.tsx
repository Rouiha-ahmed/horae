import Link from "next/link";
import type { ReactNode } from "react";

import Container from "@/components/Container";
import HomeBrandsGrid from "@/components/home/HomeBrandsGrid";
import HomeFeaturedCategories from "@/components/home/HomeFeaturedCategories";
import HomeHeroCarousel from "@/components/home/HomeHeroCarousel";
import HomeLoyaltyBanner from "@/components/home/HomeLoyaltyBanner";
import HomeNewsletter from "@/components/home/HomeNewsletter";
import HomeProductShelf from "@/components/home/HomeProductShelf";
import HomeSectionHeading from "@/components/home/HomeSectionHeading";
import HomeTrustGrid from "@/components/home/HomeTrustGrid";
import SectionRenderer from "@/components/home/renderers/SectionRenderer";
import type { HomepageDynamicSection } from "@/lib/homepage-sections";
import type { StorefrontHomeData } from "@/lib/storefront";

const legacyManagedDynamicSectionKeys = new Set([
  "home-hero",
  "featured-categories",
  "promotions",
  "best-sellers",
  "new-arrivals",
  "brands",
  "reassurance",
  "trust",
  "loyalty-banner",
  "newsletter",
  "footer-quick-links",
  "social-links",
]);

type HomepageRenderSlot = {
  id: string;
  order: number;
  element: ReactNode;
};

const shouldUseFullDynamicHomepage = (sections: HomepageDynamicSection[]) =>
  sections.some(
    (section) =>
      section.type !== "product_list" ||
      legacyManagedDynamicSectionKeys.has(section.key)
  );

const renderCustomProductSection = (section: {
  id: string;
  title: string;
  subtitle: string | null;
  slug: string;
  products: Parameters<typeof HomeProductShelf>[0]["products"];
}) => (
  <section id={section.slug} className="scroll-mt-28">
    <HomeSectionHeading title={section.title} subtitle={section.subtitle} />
    <HomeProductShelf
      products={section.products}
      emptyMessage="Aucun produit n'est disponible pour cette section."
    />
  </section>
);

export default function HomepageRenderer({ data }: { data: StorefrontHomeData }) {
  const settings = data.settings;
  const dynamicSections = data.dynamicSections || [];
  const customProductSections = data.customProductSections || [];
  const useFullDynamicHomepage =
    data.hasDynamicSections && shouldUseFullDynamicHomepage(dynamicSections);

  if (data.hasDynamicSections && dynamicSections.length === 0) {
    return <div className="min-h-12 bg-shop_light_bg/35" />;
  }

  if (useFullDynamicHomepage && dynamicSections.length > 0) {
    const fullDynamicSlots: HomepageRenderSlot[] = dynamicSections.map((section) => ({
      id: `dynamic-section-${section.id}`,
      order: Number.isFinite(section.order) ? section.order : 999,
      element: <SectionRenderer section={section} />,
    }));
    const customSlots: HomepageRenderSlot[] = customProductSections.map((section) => ({
      id: `custom-product-section-${section.id}`,
      order: Number.isFinite(section.order) ? section.order : 999,
      element: renderCustomProductSection(section),
    }));
    const mergedDynamicSlots = [...fullDynamicSlots, ...customSlots].sort(
      (left, right) => left.order - right.order || left.id.localeCompare(right.id)
    );

    return (
      <div className="bg-shop_light_bg/35">
        <Container className="space-y-10 pb-12 pt-4 md:space-y-16 md:pb-16 md:pt-6">
          {data.hasError ? (
            <div className="mt-5 rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              Certaines sections n&apos;ont pas pu etre chargees depuis la base de donnees. Un
              affichage de secours est utilise.
            </div>
          ) : null}

          {mergedDynamicSlots.map((slot) => (
            <div key={slot.id}>{slot.element}</div>
          ))}
        </Container>
      </div>
    );
  }

  const injectedProductSections = dynamicSections.filter(
    (section) =>
      section.type === "product_list" &&
      !legacyManagedDynamicSectionKeys.has(section.key)
  );

  const legacySlots: HomepageRenderSlot[] = [
    {
      id: "legacy-hero",
      order: 10,
      element: (
        <HomeHeroCarousel slides={data.heroSlides} autoplayMs={settings.heroAutoplayMs} />
      ),
    },
    {
      id: "legacy-categories",
      order: 20,
      element: (
        <section id="categories" className="scroll-mt-28">
          <HomeSectionHeading
            title={settings.featuredCategoriesTitle}
            subtitle={settings.featuredCategoriesSubtitle}
            action={
              <Link
                href="/shop"
                className="inline-flex items-center rounded-md border border-shop_light_green/45 bg-white px-4 py-2 text-sm font-semibold text-shop_dark_green transition-colors hover:border-shop_dark_green hover:text-shop_btn_dark_green"
              >
                Voir tout
              </Link>
            }
          />
          <HomeFeaturedCategories categories={data.featuredCategories} />
        </section>
      ),
    },
    {
      id: "legacy-promotions",
      order: 30,
      element: (
        <section>
          <HomeSectionHeading
            title={settings.promotionsTitle}
            subtitle={settings.promotionsSubtitle}
            action={
              <Link
                href="/deal"
                className="inline-flex items-center rounded-md bg-shop_dark_green px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-shop_btn_dark_green"
              >
                Voir les deals
              </Link>
            }
          />
          <HomeProductShelf
            products={data.promotionalProducts}
            emptyMessage="Aucune promotion disponible actuellement."
          />
        </section>
      ),
    },
    {
      id: "legacy-best-sellers",
      order: 40,
      element: (
        <section>
          <HomeSectionHeading
            title={settings.bestSellersTitle}
            subtitle={settings.bestSellersSubtitle}
          />
          <HomeProductShelf
            products={data.bestSellerProducts}
            emptyMessage="Les meilleures ventes apparaitront ici apres les premieres commandes."
          />
        </section>
      ),
    },
    {
      id: "legacy-new-arrivals",
      order: 50,
      element: (
        <section>
          <HomeSectionHeading
            title={settings.newArrivalsTitle}
            subtitle={settings.newArrivalsSubtitle}
          />
          <HomeProductShelf
            products={data.newArrivalProducts}
            emptyMessage="Aucune nouveaute n'est disponible pour le moment."
          />
        </section>
      ),
    },
    {
      id: "legacy-brands",
      order: 60,
      element: (
        <section>
          <HomeSectionHeading
            title={settings.brandsTitle}
            subtitle={settings.brandsSubtitle}
          />
          <HomeBrandsGrid brands={data.brands} />
        </section>
      ),
    },
    {
      id: "legacy-reassurance",
      order: 70,
      element: (
        <section>
          <HomeSectionHeading
            title={settings.trustTitle}
            subtitle={settings.trustSubtitle}
          />
          <HomeTrustGrid items={data.trustItems} />
        </section>
      ),
    },
    {
      id: "legacy-loyalty",
      order: 80,
      element: (
        <HomeLoyaltyBanner
          badge={settings.loyaltyBadge}
          title={settings.loyaltyTitle}
          description={settings.loyaltyDescription}
          ctaLabel={settings.loyaltyCtaLabel}
          ctaHref={settings.loyaltyCtaHref}
          highlightText={settings.loyaltyHighlightText}
          imageUrl={settings.loyaltyImageUrl}
        />
      ),
    },
    {
      id: "legacy-newsletter",
      order: 90,
      element: (
        <HomeNewsletter
          title={settings.newsletterTitle}
          description={settings.newsletterDescription}
          placeholder={settings.newsletterPlaceholder}
          buttonLabel={settings.newsletterButtonLabel}
          successMessage={settings.newsletterSuccessMessage}
          errorMessage={settings.newsletterErrorMessage}
        />
      ),
    },
  ];

  const dynamicSlots: HomepageRenderSlot[] = injectedProductSections.map((section) => ({
    id: `dynamic-product-${section.id}`,
    order: Number.isFinite(section.order) ? section.order : 35,
    element: <SectionRenderer section={section} />,
  }));
  const customProductSlots: HomepageRenderSlot[] = customProductSections.map((section) => ({
    id: `custom-product-${section.id}`,
    order: Number.isFinite(section.order) ? section.order : 35,
    element: renderCustomProductSection(section),
  }));

  const mergedSlots = [...legacySlots, ...dynamicSlots, ...customProductSlots].sort(
    (left, right) => left.order - right.order || left.id.localeCompare(right.id)
  );

  return (
    <div className="bg-shop_light_bg/35">
      <Container className="space-y-10 pb-12 pt-4 md:space-y-16 md:pb-16 md:pt-6">
        {data.hasError ? (
          <div className="mt-5 rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            Certaines sections n&apos;ont pas pu etre chargees depuis la base de donnees. Un
            affichage de secours est utilise.
          </div>
        ) : null}

        {mergedSlots.map((slot) => (
          <div key={slot.id}>{slot.element}</div>
        ))}
      </Container>
    </div>
  );
}
