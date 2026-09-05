import {
  HomepageSectionType,
  Prisma,
  SiteLinkGroup,
} from "@prisma/client";

import type { HomepageDynamicSection } from "@/lib/homepage-sections";
import {
  resolveDynamicHomepageSections,
  type HomepageBuilderSettings,
  type HomepageSectionSource,
} from "@/lib/storefront-homepage-builder";
import type { StorefrontSettingsContent } from "@/lib/storefront";
import { prisma } from "@/lib/prisma";
import { sellableProductWhere } from "@/lib/products/storefront-rules";

export const HOMEPAGE_WORKSPACE_ID = "default";
export const HOMEPAGE_WORKSPACE_SCHEMA_VERSION = 4;

export type HomepageDraftSection = HomepageSectionSource & {
  isActive: boolean;
  archivedAt: string | null;
  startsAt: string | null;
  endsAt: string | null;
};

export type HomepageDraftHeroSlide = {
  id: string;
  badge: string | null;
  title: string;
  subtitle: string | null;
  ctaLabel: string | null;
  ctaHref: string | null;
  imageUrl: string | null;
  altText: string | null;
  sortOrder: number;
  isActive: boolean;
  archivedAt: string | null;
  startsAt: string | null;
  endsAt: string | null;
};

export type HomepageDraftTrustItem = {
  id: string;
  title: string;
  description: string;
  icon: string;
  sortOrder: number;
  isActive: boolean;
  archivedAt: string | null;
};

export type HomepageDraftLink = {
  id: string;
  group: "header" | "footer_quick" | "footer_legal";
  title: string;
  href: string;
  sortOrder: number;
  openInNewTab: boolean;
  isActive: boolean;
  archivedAt: string | null;
};

export type HomepageDraftSocialLink = {
  id: string;
  platform: string;
  title: string;
  href: string;
  sortOrder: number;
  openInNewTab: boolean;
  isActive: boolean;
  archivedAt: string | null;
};

export type HomepageWorkspaceSnapshot = {
  schemaVersion: 4;
  settings: StorefrontSettingsContent;
  sections: HomepageDraftSection[];
  heroSlides: HomepageDraftHeroSlide[];
  trustItems: HomepageDraftTrustItem[];
  links: HomepageDraftLink[];
  socialLinks: HomepageDraftSocialLink[];
};

export type HomepageEditorData = {
  snapshot: HomepageWorkspaceSnapshot;
  publishedSnapshot: HomepageWorkspaceSnapshot;
  previewSections: HomepageDynamicSection[];
  draftVersion: number;
  publishedVersion: number;
  unpublishedChanges: number;
  draftUpdatedAt: string;
  publishedAt: string | null;
  catalogue: {
    categories: Array<{ id: string; title: string; slug: string; imageUrl: string | null }>;
    brands: Array<{ id: string; title: string; slug: string; imageUrl: string | null }>;
    tags: Array<{ id: string; title: string }>;
    products: Array<{
      id: string;
      name: string;
      slug: string;
      stock: number;
      imageUrl: string | null;
      brandTitle: string | null;
    }>;
  };
};

type WorkspaceDb = Prisma.TransactionClient | typeof prisma;

const toIso = (value: Date | null | undefined) => value?.toISOString() || null;
const asDate = (value: string | null) => (value ? new Date(value) : null);
const jsonValue = (value: unknown): Prisma.InputJsonValue =>
  value && typeof value === "object" ? (value as Prisma.InputJsonValue) : {};

const defaultSections = (settings?: StorefrontSettingsContent): HomepageDraftSection[] => [
  {
    id: "homepage-default-hero",
    key: "hero",
    type: "hero",
    title: "Hero",
    subtitle: null,
    isActive: true,
    archivedAt: null,
    startsAt: null,
    endsAt: null,
    order: 10,
    layout: null,
    theme: null,
    ctaLabel: null,
    ctaLink: null,
    limit: null,
    config: { autoplayMs: settings?.heroAutoplayMs || 5000 },
  },
  {
    id: "homepage-default-categories",
    key: "categories",
    type: "category_list",
    title: settings?.featuredCategoriesTitle || "Catégories populaires",
    subtitle: settings?.featuredCategoriesSubtitle || null,
    isActive: true,
    archivedAt: null,
    startsAt: null,
    endsAt: null,
    order: 20,
    layout: "carousel",
    theme: null,
    ctaLabel: "Voir tout",
    ctaLink: "/shop",
    limit: settings?.featuredCategoriesLimit || 8,
    config: { featuredOnly: true },
  },
  {
    id: "homepage-default-promotions",
    key: "promotions",
    type: "product_list",
    title: settings?.promotionsTitle || "Promotions du moment",
    subtitle: settings?.promotionsSubtitle || null,
    isActive: true,
    archivedAt: null,
    startsAt: null,
    endsAt: null,
    order: 30,
    layout: "grid",
    theme: null,
    ctaLabel: "Voir les deals",
    ctaLink: "/deal",
    limit: settings?.promotionsLimit || 10,
    config: {
      sourceType: "discounted",
      layout: "grid",
      excludeOutOfStock: true,
      hideIfEmpty: false,
    },
  },
  {
    id: "homepage-default-best-sellers",
    key: "meilleures-ventes",
    type: "product_list",
    title: settings?.bestSellersTitle || "Meilleures ventes",
    subtitle: settings?.bestSellersSubtitle || null,
    isActive: true,
    archivedAt: null,
    startsAt: null,
    endsAt: null,
    order: 40,
    layout: "grid",
    theme: null,
    ctaLabel: null,
    ctaLink: null,
    limit: settings?.bestSellersLimit || 10,
    config: {
      sourceType: "best_sellers",
      layout: "grid",
      periodDays: 30,
      excludeOutOfStock: true,
      hideIfEmpty: false,
    },
  },
  {
    id: "homepage-default-newest",
    key: "nouveautes",
    type: "product_list",
    title: settings?.newArrivalsTitle || "Nouveautés",
    subtitle: settings?.newArrivalsSubtitle || null,
    isActive: true,
    archivedAt: null,
    startsAt: null,
    endsAt: null,
    order: 50,
    layout: "grid",
    theme: null,
    ctaLabel: null,
    ctaLink: null,
    limit: settings?.newArrivalsLimit || 10,
    config: {
      sourceType: "newest",
      layout: "grid",
      periodDays: null,
      excludeOutOfStock: true,
      hideIfEmpty: false,
    },
  },
  {
    id: "homepage-default-brands",
    key: "marques",
    type: "brand_list",
    title: settings?.brandsTitle || "Nos marques partenaires",
    subtitle: settings?.brandsSubtitle || null,
    isActive: true,
    archivedAt: null,
    startsAt: null,
    endsAt: null,
    order: 60,
    layout: "carousel",
    theme: null,
    ctaLabel: null,
    ctaLink: null,
    limit: settings?.brandsLimit || 12,
    config: {},
  },
  {
    id: "homepage-default-reassurance",
    key: "reassurance",
    type: "reassurance",
    title: settings?.trustTitle || "Nos engagements",
    subtitle: settings?.trustSubtitle || null,
    isActive: true,
    archivedAt: null,
    startsAt: null,
    endsAt: null,
    order: 70,
    layout: null,
    theme: null,
    ctaLabel: null,
    ctaLink: null,
    limit: null,
    config: {},
  },
  {
    id: "homepage-default-loyalty",
    key: "loyalty-banner",
    type: "custom_banner",
    title: settings?.loyaltyTitle || "Programme fidélité",
    subtitle: settings?.loyaltyDescription || null,
    isActive: true,
    archivedAt: null,
    startsAt: null,
    endsAt: null,
    order: 80,
    layout: null,
    theme: null,
    ctaLabel: settings?.loyaltyCtaLabel || null,
    ctaLink: settings?.loyaltyCtaHref || null,
    limit: null,
    config: {},
  },
  {
    id: "homepage-default-newsletter",
    key: "newsletter",
    type: "newsletter",
    title: settings?.newsletterTitle || "Newsletter",
    subtitle: settings?.newsletterDescription || null,
    isActive: true,
    archivedAt: null,
    startsAt: null,
    endsAt: null,
    order: 90,
    layout: null,
    theme: null,
    ctaLabel: null,
    ctaLink: null,
    limit: null,
    config: {},
  },
];

const capturePublishedSnapshot = async (
  db: WorkspaceDb,
  settingsRecord: Awaited<ReturnType<typeof prisma.storefrontSettings.findUnique>>
): Promise<HomepageWorkspaceSnapshot> => {
  if (!settingsRecord) {
    throw new Error("Les réglages de la boutique sont introuvables.");
  }

  const [sectionRows, legacyProductSections, heroSlides, trustItems, links, socialLinks] = await Promise.all([
    db.homepageSection.findMany({
      orderBy: [{ order: "asc" }, { createdAt: "asc" }],
      select: {
        id: true,
        key: true,
        type: true,
        title: true,
        subtitle: true,
        isActive: true,
        archivedAt: true,
        startsAt: true,
        endsAt: true,
        order: true,
        layout: true,
        theme: true,
        ctaLabel: true,
        ctaLink: true,
        limit: true,
        config: true,
      },
    }),
    db.homepageProductSection.findMany({
      where: { isActive: true },
      orderBy: [{ order: "asc" }, { createdAt: "asc" }],
      include: {
        items: {
          orderBy: [{ order: "asc" }, { createdAt: "asc" }],
          select: { productId: true },
        },
      },
    }),
    db.homeHeroSlide.findMany({ orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] }),
    db.homeTrustItem.findMany({ orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] }),
    db.siteLink.findMany({ orderBy: [{ group: "asc" }, { sortOrder: "asc" }] }),
    db.siteSocialLink.findMany({ orderBy: [{ sortOrder: "asc" }] }),
  ]);

  const { id: _settingsId, createdAt: _createdAt, updatedAt: _updatedAt, ...settings } =
    settingsRecord;
  void _settingsId;
  void _createdAt;
  void _updatedAt;

  return {
    schemaVersion: HOMEPAGE_WORKSPACE_SCHEMA_VERSION,
    settings,
    sections: [
      ...(sectionRows.length
      ? sectionRows.map((section) => ({
          ...section,
          archivedAt: toIso(section.archivedAt),
          startsAt: toIso(section.startsAt),
          endsAt: toIso(section.endsAt),
        }))
      : defaultSections(settings)),
      ...legacyProductSections.map((section) => ({
        id: `migrated-${section.id}`,
        key: `editorial-${section.slug}`,
        type: "product_list" as const,
        title: section.title,
        subtitle: section.subtitle,
        isActive: section.isActive,
        archivedAt: null,
        startsAt: null,
        endsAt: null,
        order: section.order,
        layout: "grid",
        theme: null,
        ctaLabel: null,
        ctaLink: null,
        limit: Math.max(section.items.length, 1),
        config: {
          sourceType: "manual_selection",
          productIds: section.items.map((item) => item.productId),
          layout: "grid",
          hideIfEmpty: true,
          excludeOutOfStock: false,
        },
      })),
    ],
    heroSlides: (heroSlides.length ? heroSlides : [{
      id: "homepage-default-slide",
      badge: "Nouveautés beauté",
      title: "Vos essentiels para, livrés en 24/48h",
      subtitle: "Découvrez une sélection de produits adaptés à chaque routine soin et bien-être.",
      ctaLabel: "Explorer la boutique",
      ctaHref: "/shop",
      imageUrl: "/static-assets/banner/banner_1.webp",
      altText: "Bannière Hero HORAE",
      sortOrder: 0,
      isActive: true,
      archivedAt: null,
      startsAt: null,
      endsAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    }]).map((slide) => ({
      id: slide.id,
      badge: slide.badge,
      title: slide.title,
      subtitle: slide.subtitle,
      ctaLabel: slide.ctaLabel,
      ctaHref: slide.ctaHref,
      imageUrl: slide.imageUrl,
      altText: slide.altText,
      sortOrder: slide.sortOrder,
      isActive: slide.isActive,
      archivedAt: toIso(slide.archivedAt),
      startsAt: toIso(slide.startsAt),
      endsAt: toIso(slide.endsAt),
    })),
    trustItems: (trustItems.length ? trustItems : [
      { id: "homepage-default-trust-delivery", title: "Livraison rapide", description: "Expédition partout au Maroc avec suivi en ligne.", icon: "truck", sortOrder: 0, isActive: true, archivedAt: null, createdAt: new Date(), updatedAt: new Date() },
      { id: "homepage-default-trust-products", title: "Produits vérifiés", description: "Sélection rigoureuse de références dermo-cosmétiques.", icon: "shield", sortOrder: 1, isActive: true, archivedAt: null, createdAt: new Date(), updatedAt: new Date() },
      { id: "homepage-default-trust-support", title: "Support dédié", description: "Une équipe disponible pour vous accompagner avant achat.", icon: "headset", sortOrder: 2, isActive: true, archivedAt: null, createdAt: new Date(), updatedAt: new Date() },
      { id: "homepage-default-trust-payment", title: "Paiement flexible", description: "Carte ou paiement à la livraison selon éligibilité.", icon: "wallet", sortOrder: 3, isActive: true, archivedAt: null, createdAt: new Date(), updatedAt: new Date() },
    ]).map((item) => ({
      id: item.id,
      title: item.title,
      description: item.description,
      icon: item.icon,
      sortOrder: item.sortOrder,
      isActive: item.isActive,
      archivedAt: toIso(item.archivedAt),
    })),
    links: (links.length ? links : [
      { id: "homepage-default-link-home", group: "header" as const, title: "Accueil", href: "/", sortOrder: 0, openInNewTab: false, isActive: true, archivedAt: null, createdAt: new Date(), updatedAt: new Date() },
      { id: "homepage-default-link-shop", group: "header" as const, title: "Boutique", href: "/shop", sortOrder: 1, openInNewTab: false, isActive: true, archivedAt: null, createdAt: new Date(), updatedAt: new Date() },
      { id: "homepage-default-link-deals", group: "header" as const, title: "Promotions", href: "/deal", sortOrder: 2, openInNewTab: false, isActive: true, archivedAt: null, createdAt: new Date(), updatedAt: new Date() },
      { id: "homepage-default-link-contact", group: "header" as const, title: "Contact", href: "/#contact", sortOrder: 3, openInNewTab: false, isActive: true, archivedAt: null, createdAt: new Date(), updatedAt: new Date() },
      { id: "homepage-default-footer-about", group: "footer_quick" as const, title: "À propos", href: "/about", sortOrder: 0, openInNewTab: false, isActive: true, archivedAt: null, createdAt: new Date(), updatedAt: new Date() },
      { id: "homepage-default-footer-shop", group: "footer_quick" as const, title: "Boutique", href: "/shop", sortOrder: 1, openInNewTab: false, isActive: true, archivedAt: null, createdAt: new Date(), updatedAt: new Date() },
      { id: "homepage-default-footer-terms", group: "footer_legal" as const, title: "Conditions générales", href: "/terms", sortOrder: 0, openInNewTab: false, isActive: true, archivedAt: null, createdAt: new Date(), updatedAt: new Date() },
      { id: "homepage-default-footer-privacy", group: "footer_legal" as const, title: "Politique de confidentialité", href: "/privacy", sortOrder: 1, openInNewTab: false, isActive: true, archivedAt: null, createdAt: new Date(), updatedAt: new Date() },
    ]).map((link) => ({
      id: link.id,
      group: link.group,
      title: link.title,
      href: link.href,
      sortOrder: link.sortOrder,
      openInNewTab: link.openInNewTab,
      isActive: link.isActive,
      archivedAt: toIso(link.archivedAt),
    })),
    socialLinks: (socialLinks.length ? socialLinks : [
      { id: "homepage-default-social-facebook", platform: "facebook", title: "Facebook", href: "https://www.facebook.com/", sortOrder: 0, openInNewTab: true, isActive: true, archivedAt: null, createdAt: new Date(), updatedAt: new Date() },
      { id: "homepage-default-social-instagram", platform: "instagram", title: "Instagram", href: "https://www.instagram.com/", sortOrder: 1, openInNewTab: true, isActive: true, archivedAt: null, createdAt: new Date(), updatedAt: new Date() },
      { id: "homepage-default-social-tiktok", platform: "tiktok", title: "TikTok", href: "https://www.tiktok.com/", sortOrder: 2, openInNewTab: true, isActive: true, archivedAt: null, createdAt: new Date(), updatedAt: new Date() },
    ]).map((link) => ({
      id: link.id,
      platform: link.platform,
      title: link.title,
      href: link.href,
      sortOrder: link.sortOrder,
      openInNewTab: link.openInNewTab,
      isActive: link.isActive,
      archivedAt: toIso(link.archivedAt),
    })),
  };
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

const upgradeHomepageSnapshot = (
  value: Prisma.JsonValue,
  { untouched }: { untouched: boolean }
) => {
  if (
    !isRecord(value) ||
    (value.schemaVersion !== 1 && value.schemaVersion !== 2 && value.schemaVersion !== 3) ||
    !Array.isArray(value.sections)
  ) {
    return { changed: false, value };
  }

  const settings = isRecord(value.settings) ? value.settings : {};
  const sourceSchemaVersion = value.schemaVersion;
  const textSetting = (key: string, fallback: string) =>
    typeof settings[key] === "string" && settings[key].trim()
      ? settings[key]
      : fallback;
  const nullableTextSetting = (key: string) =>
    typeof settings[key] === "string" && settings[key].trim() ? settings[key] : null;
  const hasLoyalty = value.sections.some(
    (section) => isRecord(section) && section.id === "homepage-default-loyalty"
  );
  const sections = value.sections.map((section) => {
    if (!isRecord(section)) return section;

    let nextSection = section;
    if (untouched) {
      const defaultOrderById: Record<string, number> = {
        "homepage-default-hero": 10,
        "homepage-default-categories": 20,
        "homepage-default-promotions": 30,
        "homepage-default-best-sellers": 40,
        "homepage-default-newest": 50,
        "homepage-default-brands": 60,
        "homepage-default-reassurance": 70,
        "homepage-default-loyalty": 80,
        "homepage-default-newsletter": 90,
      };
      const defaultOrder = defaultOrderById[String(section.id)];
      if (typeof defaultOrder === "number") {
        nextSection = { ...nextSection, order: defaultOrder };
      }
    }

    if (section.id === "homepage-default-newsletter") {
      nextSection = {
        ...nextSection,
        ...(section.title === "Newsletter"
          ? { title: textSetting("newsletterTitle", "Newsletter") }
          : {}),
        ...(section.subtitle === null
          ? { subtitle: nullableTextSetting("newsletterDescription") }
          : {}),
      };
    }

    if (
      untouched &&
      (sourceSchemaVersion === 1 || sourceSchemaVersion === 2) &&
      typeof section.id === "string" &&
      section.id.startsWith("migrated-") &&
      typeof section.order === "number"
    ) {
      nextSection = { ...nextSection, order: section.order - 25 };
    }

    if (
      untouched &&
      [
        "homepage-default-promotions",
        "homepage-default-best-sellers",
        "homepage-default-newest",
      ].includes(String(section.id)) &&
      isRecord(section.config)
    ) {
      nextSection = {
        ...nextSection,
        config: { ...section.config, hideIfEmpty: false },
      };
    }

    if (untouched && section.id === "homepage-default-promotions") {
      nextSection = {
        ...nextSection,
        layout: "grid",
        ctaLabel: "Voir les deals",
        limit:
          typeof settings.promotionsLimit === "number" ? settings.promotionsLimit : 10,
        config: {
          ...(isRecord(nextSection.config) ? nextSection.config : {}),
          layout: "grid",
        },
      };
    }

    if (
      untouched &&
      (section.id === "homepage-default-best-sellers" ||
        section.id === "homepage-default-newest")
    ) {
      const limitKey = section.id === "homepage-default-best-sellers"
        ? "bestSellersLimit"
        : "newArrivalsLimit";
      nextSection = {
        ...nextSection,
        layout: "grid",
        ctaLabel: null,
        ctaLink: null,
        limit: typeof settings[limitKey] === "number" ? settings[limitKey] : 10,
        config: {
          ...(isRecord(nextSection.config) ? nextSection.config : {}),
          layout: "grid",
          ...(section.id === "homepage-default-newest" ? { periodDays: null } : {}),
        },
      };
    }

    if (untouched && section.id === "homepage-default-brands") {
      nextSection = {
        ...nextSection,
        limit: typeof settings.brandsLimit === "number" ? settings.brandsLimit : 12,
      };
    }

    if (
      untouched &&
      typeof section.id === "string" &&
      section.id.startsWith("migrated-")
    ) {
      nextSection = {
        ...nextSection,
        layout: "grid",
        config: {
          ...(isRecord(nextSection.config) ? nextSection.config : {}),
          layout: "grid",
          excludeOutOfStock: false,
        },
      };
    }

    return nextSection;
  });

  if (!hasLoyalty) {
    sections.push({
      id: "homepage-default-loyalty",
      key: "loyalty-banner",
      type: "custom_banner",
      title: textSetting("loyaltyTitle", "Programme fidélité"),
      subtitle: nullableTextSetting("loyaltyDescription"),
      isActive: true,
      archivedAt: null,
      startsAt: null,
      endsAt: null,
      order: 80,
      layout: null,
      theme: null,
      ctaLabel: nullableTextSetting("loyaltyCtaLabel"),
      ctaLink: nullableTextSetting("loyaltyCtaHref"),
      limit: null,
      config: {},
    });
  }

  sections.sort((left, right) => {
    const leftOrder = isRecord(left) && typeof left.order === "number" ? left.order : 999;
    const rightOrder = isRecord(right) && typeof right.order === "number" ? right.order : 999;
    return leftOrder - rightOrder;
  });

  return {
    changed: true,
    value: {
      ...value,
      schemaVersion: HOMEPAGE_WORKSPACE_SCHEMA_VERSION,
      sections,
    } as Prisma.JsonObject,
  };
};

const validDate = (value: unknown) => {
  if (value === null) return true;
  return typeof value === "string" && !Number.isNaN(new Date(value).getTime());
};

const validHref = (value: string | null, allowIncomplete = false) => {
  if (!value) return true;
  if (value.startsWith("/")) return true;
  if (allowIncomplete && (value === "https://" || value === "http://")) return true;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
};

export const validateHomepageSnapshot = (
  value: unknown,
  options: { allowIncomplete?: boolean } = {}
): HomepageWorkspaceSnapshot => {
  if (!isRecord(value) || value.schemaVersion !== HOMEPAGE_WORKSPACE_SCHEMA_VERSION) {
    throw new Error("Le brouillon Homepage utilise un format invalide.");
  }
  if (!isRecord(value.settings)) {
    throw new Error("Les réglages généraux du brouillon sont invalides.");
  }
  if (
    !Array.isArray(value.sections) ||
    !Array.isArray(value.heroSlides) ||
    !Array.isArray(value.trustItems) ||
    !Array.isArray(value.links) ||
    !Array.isArray(value.socialLinks)
  ) {
    throw new Error("Le contenu du brouillon Homepage est incomplet.");
  }

  const snapshot = value as unknown as HomepageWorkspaceSnapshot;
  const sectionIds = new Set<string>();
  const sectionKeys = new Set<string>();
  for (const section of snapshot.sections) {
    if (
      !section.id ||
      !section.key ||
      !section.title.trim() ||
      !Object.values(HomepageSectionType).includes(section.type as HomepageSectionType) ||
      !validDate(section.archivedAt) ||
      !validDate(section.startsAt) ||
      !validDate(section.endsAt)
    ) {
      throw new Error("Une section contient des informations invalides.");
    }
    if (sectionIds.has(section.id) || sectionKeys.has(section.key)) {
      throw new Error("Chaque section doit être unique.");
    }
    if (!options.allowIncomplete && section.startsAt && section.endsAt && new Date(section.startsAt) >= new Date(section.endsAt)) {
      throw new Error(`La période de la section « ${section.title} » est invalide.`);
    }
    if (!validHref(section.ctaLink, options.allowIncomplete)) {
      throw new Error(`Le lien de la section « ${section.title} » est invalide.`);
    }
    sectionIds.add(section.id);
    sectionKeys.add(section.key);
  }

  for (const slide of snapshot.heroSlides) {
    if (!slide.id || !slide.title.trim() || !validHref(slide.ctaHref, options.allowIncomplete) || (!options.allowIncomplete && slide.imageUrl && !slide.altText?.trim())) {
      throw new Error("Un slide Hero contient des informations invalides.");
    }
    if (!validDate(slide.archivedAt) || !validDate(slide.startsAt) || !validDate(slide.endsAt)) {
      throw new Error(`La période du slide « ${slide.title} » est invalide.`);
    }
    if (!options.allowIncomplete && slide.startsAt && slide.endsAt && new Date(slide.startsAt) >= new Date(slide.endsAt)) {
      throw new Error(`La période du slide « ${slide.title} » est invalide.`);
    }
  }

  for (const link of [...snapshot.links, ...snapshot.socialLinks]) {
    if (!link.id || !link.title.trim() || !validHref(link.href, options.allowIncomplete)) {
      throw new Error("Un lien du brouillon est invalide.");
    }
  }

  return snapshot;
};

const comparable = (value: unknown) => JSON.stringify(value);

export const countHomepageChanges = (
  draft: HomepageWorkspaceSnapshot,
  published: HomepageWorkspaceSnapshot
) => {
  let changes = comparable(draft.settings) === comparable(published.settings) ? 0 : 1;
  const collections: Array<[
    Array<{ id: string }>,
    Array<{ id: string }>,
  ]> = [
    [draft.sections, published.sections],
    [draft.heroSlides, published.heroSlides],
    [draft.trustItems, published.trustItems],
    [draft.links, published.links],
    [draft.socialLinks, published.socialLinks],
  ];

  for (const [draftItems, publishedItems] of collections) {
    const draftById = new Map(draftItems.map((item) => [item.id, comparable(item)]));
    const publishedById = new Map(publishedItems.map((item) => [item.id, comparable(item)]));
    for (const id of new Set([...draftById.keys(), ...publishedById.keys()])) {
      if (draftById.get(id) !== publishedById.get(id)) changes += 1;
    }
  }
  return changes;
};

export const ensureHomepageWorkspace = async () => {
  const current = await prisma.homepageWorkspace.findUnique({
    where: { id: HOMEPAGE_WORKSPACE_ID },
  });
  if (current) {
    const draft = upgradeHomepageSnapshot(current.draft, {
      untouched: current.draftUpdatedBy === null,
    });
    const published = upgradeHomepageSnapshot(current.published, {
      untouched: current.publishedBy === null,
    });
    if (!draft.changed && !published.changed) return current;

    return prisma.homepageWorkspace.update({
      where: { id: HOMEPAGE_WORKSPACE_ID },
      data: {
        draft: draft.value as Prisma.InputJsonValue,
        published: published.value as Prisma.InputJsonValue,
      },
    });
  }

  return prisma.$transaction(async (tx) => {
    const raced = await tx.homepageWorkspace.findUnique({
      where: { id: HOMEPAGE_WORKSPACE_ID },
    });
    if (raced) return raced;

    const settings = await tx.storefrontSettings.upsert({
      where: { id: "default" },
      create: { id: "default" },
      update: {},
    });
    const snapshot = await capturePublishedSnapshot(tx, settings);
    return tx.homepageWorkspace.create({
      data: {
        id: HOMEPAGE_WORKSPACE_ID,
        draft: snapshot as unknown as Prisma.InputJsonValue,
        published: snapshot as unknown as Prisma.InputJsonValue,
        publishedAt: new Date(),
      },
    });
  });
};

const builderSettings = (settings: StorefrontSettingsContent): HomepageBuilderSettings => ({
  heroAutoplayMs: settings.heroAutoplayMs,
  featuredCategoriesLimit: settings.featuredCategoriesLimit,
  promotionsLimit: settings.promotionsLimit,
  bestSellersLimit: settings.bestSellersLimit,
  newArrivalsLimit: settings.newArrivalsLimit,
  brandsLimit: settings.brandsLimit,
  loyaltyBadge: settings.loyaltyBadge,
  loyaltyTitle: settings.loyaltyTitle,
  loyaltyDescription: settings.loyaltyDescription,
  loyaltyCtaLabel: settings.loyaltyCtaLabel,
  loyaltyCtaHref: settings.loyaltyCtaHref,
  loyaltyHighlightText: settings.loyaltyHighlightText,
  loyaltyImageUrl: settings.loyaltyImageUrl,
  newsletterTitle: settings.newsletterTitle,
  newsletterDescription: settings.newsletterDescription,
  newsletterPlaceholder: settings.newsletterPlaceholder,
  newsletterButtonLabel: settings.newsletterButtonLabel,
  newsletterSuccessMessage: settings.newsletterSuccessMessage,
  newsletterErrorMessage: settings.newsletterErrorMessage,
});

export const resolveHomepageDraftPreview = async (snapshot: HomepageWorkspaceSnapshot) => {
  const activeSections = snapshot.sections
    .filter((section) => section.isActive && !section.archivedAt)
    .sort((left, right) => left.order - right.order);
  const activeSlides = snapshot.heroSlides
    .filter((slide) => slide.isActive && !slide.archivedAt)
    .sort((left, right) => left.sortOrder - right.sortOrder);
  const activeTrustItems = snapshot.trustItems
    .filter((item) => item.isActive && !item.archivedAt)
    .sort((left, right) => left.sortOrder - right.sortOrder);
  const activeLinks = snapshot.links
    .filter((link) => link.isActive && !link.archivedAt)
    .sort((left, right) => left.sortOrder - right.sortOrder);
  const activeSocial = snapshot.socialLinks
    .filter((link) => link.isActive && !link.archivedAt)
    .sort((left, right) => left.sortOrder - right.sortOrder);

  return resolveDynamicHomepageSections({
    sections: activeSections,
    settings: builderSettings(snapshot.settings),
    shell: {
      headerLinks: activeLinks.filter((link) => link.group === "header"),
      footerQuickLinks: activeLinks.filter((link) => link.group === "footer_quick"),
      footerLegalLinks: activeLinks.filter((link) => link.group === "footer_legal"),
      socialLinks: activeSocial,
    },
    content: { heroSlides: activeSlides, trustItems: activeTrustItems },
  });
};

export const getPublishedHomepageRenderData = async () => {
  const workspace = await ensureHomepageWorkspace();
  const snapshot = validateHomepageSnapshot(workspace.published);

  return {
    snapshot,
    sections: await resolveHomepageDraftPreview(snapshot),
  };
};

export const getHomepageEditorData = async (): Promise<HomepageEditorData> => {
  const workspace = await ensureHomepageWorkspace();
  const snapshot = validateHomepageSnapshot(workspace.draft, { allowIncomplete: true });
  const published = validateHomepageSnapshot(workspace.published);
  const selectedProductIds = snapshot.sections.flatMap((section) => {
    if (!isRecord(section.config) || !Array.isArray(section.config.productIds)) return [];
    return section.config.productIds.filter((id): id is string => typeof id === "string");
  });
  const pickerProductSelect = {
    id: true,
    name: true,
    slug: true,
    stock: true,
    brand: { select: { title: true } },
    images: { orderBy: { sortOrder: "asc" as const }, take: 1, select: { url: true } },
  } as const;

  const [previewSections, categories, brands, tags, recentProducts, selectedProducts] = await Promise.all([
    resolveHomepageDraftPreview(snapshot),
    prisma.category.findMany({
      where: {
        archivedAt: null,
        isActive: true,
        OR: [
          { parentId: null },
          { parent: { is: { archivedAt: null, isActive: true } } },
        ],
      },
      orderBy: [{ range: "asc" }, { title: "asc" }],
      select: { id: true, title: true, slug: true, imageUrl: true },
    }),
    prisma.brand.findMany({
      where: { archivedAt: null, isActive: true },
      orderBy: { title: "asc" },
      select: { id: true, title: true, slug: true, imageUrl: true },
    }),
    prisma.tag.findMany({ orderBy: { title: "asc" }, select: { id: true, title: true } }),
    prisma.product.findMany({
      where: sellableProductWhere,
      orderBy: [{ updatedAt: "desc" }],
      take: 60,
      select: pickerProductSelect,
    }),
    selectedProductIds.length
      ? prisma.product.findMany({
          where: { id: { in: selectedProductIds }, ...sellableProductWhere },
          select: pickerProductSelect,
        })
      : Promise.resolve([]),
  ]);
  const products = Array.from(
    new Map([...selectedProducts, ...recentProducts].map((product) => [product.id, product])).values()
  );

  return {
    snapshot,
    publishedSnapshot: published,
    previewSections,
    draftVersion: workspace.draftVersion,
    publishedVersion: workspace.publishedVersion,
    unpublishedChanges: countHomepageChanges(snapshot, published),
    draftUpdatedAt: workspace.draftUpdatedAt.toISOString(),
    publishedAt: toIso(workspace.publishedAt),
    catalogue: {
      categories,
      brands,
      tags,
      products: products.map((product) => ({
        id: product.id,
        name: product.name,
        slug: product.slug,
        stock: product.stock,
        imageUrl: product.images[0]?.url || null,
        brandTitle: product.brand?.title || null,
      })),
    },
  };
};

export const saveHomepageDraft = async ({
  input,
  expectedVersion,
  actorUserId,
}: {
  input: unknown;
  expectedVersion: number;
  actorUserId: string | null;
}) => {
  const snapshot = validateHomepageSnapshot(input, { allowIncomplete: true });
  const current = await ensureHomepageWorkspace();
  if (current.draftVersion !== expectedVersion) {
    return { ok: false as const, reason: "conflict" as const, version: current.draftVersion };
  }

  const updated = await prisma.homepageWorkspace.updateMany({
    where: { id: HOMEPAGE_WORKSPACE_ID, draftVersion: expectedVersion },
    data: {
      draft: snapshot as unknown as Prisma.InputJsonValue,
      draftVersion: { increment: 1 },
      draftUpdatedAt: new Date(),
      draftUpdatedBy: actorUserId,
    },
  });
  if (!updated.count) {
    const latest = await prisma.homepageWorkspace.findUniqueOrThrow({
      where: { id: HOMEPAGE_WORKSPACE_ID },
      select: { draftVersion: true },
    });
    return { ok: false as const, reason: "conflict" as const, version: latest.draftVersion };
  }

  const workspace = await prisma.homepageWorkspace.findUniqueOrThrow({
    where: { id: HOMEPAGE_WORKSPACE_ID },
  });
  const published = validateHomepageSnapshot(workspace.published);
  return {
    ok: true as const,
    version: workspace.draftVersion,
    unpublishedChanges: countHomepageChanges(snapshot, published),
    savedAt: workspace.draftUpdatedAt.toISOString(),
    previewSections: await resolveHomepageDraftPreview(snapshot),
  };
};

const applySnapshot = async (tx: Prisma.TransactionClient, snapshot: HomepageWorkspaceSnapshot) => {
  await tx.storefrontSettings.upsert({
    where: { id: "default" },
    create: { id: "default", ...snapshot.settings },
    update: snapshot.settings,
  });

  const sectionIds = snapshot.sections.map((section) => section.id);
  await tx.homepageSection.deleteMany({
    where: sectionIds.length ? { id: { notIn: sectionIds } } : {},
  });
  for (const section of snapshot.sections) {
    const data = {
      key: section.key,
      type: section.type as HomepageSectionType,
      title: section.title,
      subtitle: section.subtitle,
      isActive: section.isActive,
      archivedAt: asDate(section.archivedAt),
      startsAt: asDate(section.startsAt),
      endsAt: asDate(section.endsAt),
      order: section.order,
      layout: section.layout,
      theme: section.theme,
      ctaLabel: section.ctaLabel,
      ctaLink: section.ctaLink,
      limit: section.limit,
      config: jsonValue(section.config),
    };
    await tx.homepageSection.upsert({
      where: { id: section.id },
      create: { id: section.id, ...data },
      update: data,
    });
    await tx.homepageSectionProduct.deleteMany({ where: { sectionId: section.id } });
    const config = isRecord(section.config) ? section.config : {};
    const productIds = Array.isArray(config.productIds)
      ? config.productIds.filter((id): id is string => typeof id === "string")
      : [];
    if (productIds.length) {
      await tx.homepageSectionProduct.createMany({
        data: productIds.map((productId, sortOrder) => ({ sectionId: section.id, productId, sortOrder })),
        skipDuplicates: true,
      });
    }
  }

  const slideIds = snapshot.heroSlides.map((slide) => slide.id);
  await tx.homeHeroSlide.deleteMany({ where: slideIds.length ? { id: { notIn: slideIds } } : {} });
  for (const slide of snapshot.heroSlides) {
    const data = {
      badge: slide.badge,
      title: slide.title,
      subtitle: slide.subtitle,
      ctaLabel: slide.ctaLabel,
      ctaHref: slide.ctaHref,
      imageUrl: slide.imageUrl,
      altText: slide.altText,
      sortOrder: slide.sortOrder,
      isActive: slide.isActive,
      archivedAt: asDate(slide.archivedAt),
      startsAt: asDate(slide.startsAt),
      endsAt: asDate(slide.endsAt),
    };
    await tx.homeHeroSlide.upsert({ where: { id: slide.id }, create: { id: slide.id, ...data }, update: data });
  }

  const trustIds = snapshot.trustItems.map((item) => item.id);
  await tx.homeTrustItem.deleteMany({ where: trustIds.length ? { id: { notIn: trustIds } } : {} });
  for (const item of snapshot.trustItems) {
    const data = {
      title: item.title,
      description: item.description,
      icon: item.icon,
      sortOrder: item.sortOrder,
      isActive: item.isActive,
      archivedAt: asDate(item.archivedAt),
    };
    await tx.homeTrustItem.upsert({ where: { id: item.id }, create: { id: item.id, ...data }, update: data });
  }

  const linkIds = snapshot.links.map((link) => link.id);
  await tx.siteLink.deleteMany({ where: linkIds.length ? { id: { notIn: linkIds } } : {} });
  for (const link of snapshot.links) {
    const data = {
      group: link.group as SiteLinkGroup,
      title: link.title,
      href: link.href,
      sortOrder: link.sortOrder,
      openInNewTab: link.openInNewTab,
      isActive: link.isActive,
      archivedAt: asDate(link.archivedAt),
    };
    await tx.siteLink.upsert({ where: { id: link.id }, create: { id: link.id, ...data }, update: data });
  }

  const socialIds = snapshot.socialLinks.map((link) => link.id);
  await tx.siteSocialLink.deleteMany({ where: socialIds.length ? { id: { notIn: socialIds } } : {} });
  for (const link of snapshot.socialLinks) {
    const data = {
      platform: link.platform,
      title: link.title,
      href: link.href,
      sortOrder: link.sortOrder,
      openInNewTab: link.openInNewTab,
      isActive: link.isActive,
      archivedAt: asDate(link.archivedAt),
    };
    await tx.siteSocialLink.upsert({ where: { id: link.id }, create: { id: link.id, ...data }, update: data });
  }

  // Legacy manual Homepage product sections are preserved for rollback but no
  // longer rendered after their content has been unified in HomepageSection.
  await tx.homepageProductSection.updateMany({ data: { isActive: false } });
};

export const publishHomepageDraft = async ({
  expectedVersion,
  actor,
}: {
  expectedVersion: number;
  actor: { userId: string | null; email: string | null; displayName: string };
}) => {
  const current = await ensureHomepageWorkspace();
  if (current.draftVersion !== expectedVersion) {
    return { ok: false as const, reason: "conflict" as const, version: current.draftVersion };
  }
  const snapshot = validateHomepageSnapshot(current.draft);
  const published = validateHomepageSnapshot(current.published);
  const changes = countHomepageChanges(snapshot, published);

  await prisma.$transaction(async (tx) => {
    const locked = await tx.homepageWorkspace.updateMany({
      where: {
        id: HOMEPAGE_WORKSPACE_ID,
        draftVersion: expectedVersion,
        publishedVersion: current.publishedVersion,
      },
      data: {
        published: snapshot as unknown as Prisma.InputJsonValue,
        publishedVersion: { increment: 1 },
        publishedAt: new Date(),
        publishedBy: actor.userId,
      },
    });
    if (!locked.count) throw new Error("CONCURRENT_HOMEPAGE_UPDATE");

    await applySnapshot(tx, snapshot);
    await tx.adminAuditLog.create({
      data: {
        actorUserId: actor.userId,
        actorEmail: actor.email,
        action: "homepage.publish",
        entity: "HomepageWorkspace",
        entityId: HOMEPAGE_WORKSPACE_ID,
        metadata: {
          draftVersion: expectedVersion,
          previousPublishedVersion: current.publishedVersion,
          changes,
          actorName: actor.displayName,
        },
      },
    });
  });

  const workspace = await prisma.homepageWorkspace.findUniqueOrThrow({
    where: { id: HOMEPAGE_WORKSPACE_ID },
  });
  return {
    ok: true as const,
    version: workspace.draftVersion,
    publishedVersion: workspace.publishedVersion,
    publishedAt: toIso(workspace.publishedAt),
  };
};

export const searchHomepageProducts = async (query: string) => {
  const normalized = query.trim().slice(0, 80);
  return prisma.product.findMany({
    where: {
      ...sellableProductWhere,
      ...(normalized
        ? {
            OR: [
              { name: { contains: normalized, mode: "insensitive" as const } },
              { sku: { contains: normalized, mode: "insensitive" as const } },
              { brand: { title: { contains: normalized, mode: "insensitive" as const } } },
            ],
          }
        : {}),
    },
    orderBy: [{ updatedAt: "desc" }],
    take: 30,
    select: {
      id: true,
      name: true,
      slug: true,
      stock: true,
      brand: { select: { title: true } },
      images: { orderBy: { sortOrder: "asc" }, take: 1, select: { url: true } },
    },
  }).then((products) =>
    products.map((product) => ({
      id: product.id,
      name: product.name,
      slug: product.slug,
      stock: product.stock,
      imageUrl: product.images[0]?.url || null,
      brandTitle: product.brand?.title || null,
    }))
  );
};
