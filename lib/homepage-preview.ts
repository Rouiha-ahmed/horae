import type { HomepageDynamicSection } from "@/lib/homepage-sections";
import type { HomepageWorkspaceSnapshot } from "@/lib/homepage-workspace";
import type { StorefrontHomeData, StorefrontShellData } from "@/lib/storefront";

export const HOMEPAGE_PREVIEW_MESSAGE = "zayna:homepage-preview:update";

export type HomepagePreviewPayload = {
  snapshot: HomepageWorkspaceSnapshot;
  sections: HomepageDynamicSection[];
  selectedZone: string;
};

export const mergeHomepageDraftSections = (
  snapshot: HomepageWorkspaceSnapshot,
  resolved: HomepageDynamicSection[]
) => {
  const byId = new Map(resolved.map((section) => [section.id, section]));

  return snapshot.sections
    .filter((section) => section.isActive && !section.archivedAt)
    .sort((left, right) => left.order - right.order)
    .map((draftSection) => {
      const section = byId.get(draftSection.id);
      if (!section) return null;

      const merged: HomepageDynamicSection = {
        ...section,
        title: draftSection.title,
        subtitle: draftSection.subtitle,
        order: draftSection.order,
        layout: draftSection.layout,
        theme: draftSection.theme,
        ctaLabel: draftSection.ctaLabel,
        ctaLink: draftSection.ctaLink,
        limit: draftSection.limit,
        config: {
          ...section.config,
          ...(draftSection.config && typeof draftSection.config === "object"
            ? draftSection.config
            : {}),
        },
      };

      if (draftSection.type === "hero") {
        merged.heroSlides = snapshot.heroSlides
          .filter((slide) => slide.isActive && !slide.archivedAt)
          .sort((left, right) => left.sortOrder - right.sortOrder);
      }

      if (draftSection.type === "reassurance") {
        merged.trustItems = snapshot.trustItems
          .filter((item) => item.isActive && !item.archivedAt)
          .sort((left, right) => left.sortOrder - right.sortOrder);
      }

      return merged;
    })
    .filter((section): section is HomepageDynamicSection => Boolean(section));
};

export const buildHomepageSnapshotShell = (
  snapshot: HomepageWorkspaceSnapshot,
  baseShell: StorefrontShellData
): StorefrontShellData => {
  const links = snapshot.links
    .filter((link) => link.isActive && !link.archivedAt)
    .sort((left, right) => left.sortOrder - right.sortOrder);
  const socialLinks = snapshot.socialLinks
    .filter((link) => link.isActive && !link.archivedAt)
    .sort((left, right) => left.sortOrder - right.sortOrder);

  return {
    ...baseShell,
    settings: snapshot.settings,
    headerLinks: links.filter((link) => link.group === "header"),
    footerQuickLinks: links.filter((link) => link.group === "footer_quick"),
    footerLegalLinks: links.filter((link) => link.group === "footer_legal"),
    socialLinks,
  };
};

export const buildHomepageDraftData = (
  snapshot: HomepageWorkspaceSnapshot,
  resolvedSections: HomepageDynamicSection[],
  baseShell: StorefrontShellData
): StorefrontHomeData => {
  const shell = buildHomepageSnapshotShell(snapshot, baseShell);
  const dynamicSections = mergeHomepageDraftSections(snapshot, resolvedSections);

  return {
    ...shell,
    heroSlides: snapshot.heroSlides
      .filter((slide) => slide.isActive && !slide.archivedAt)
      .sort((left, right) => left.sortOrder - right.sortOrder),
    featuredCategories: [],
    promotionalProducts: [],
    bestSellerProducts: [],
    newArrivalProducts: [],
    brands: [],
    trustItems: snapshot.trustItems
      .filter((item) => item.isActive && !item.archivedAt)
      .sort((left, right) => left.sortOrder - right.sortOrder),
    dynamicSections,
    hasDynamicSections: true,
    customProductSections: [],
    hasError: false,
  };
};
