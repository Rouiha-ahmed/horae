import { Prisma } from "@prisma/client";
import { unstable_cache } from "next/cache";

import { getAdminDataTag } from "@/lib/admin";
import { mapBrand, mapCategory, mapProduct } from "@/lib/data/mappers";
import { type HomepageDynamicSection } from "@/lib/homepage-sections";
import { buildHomepageSnapshotShell } from "@/lib/homepage-preview";
import { getPublishedHomepageRenderData } from "@/lib/homepage-workspace";
import { sanitizePublicImageUrl } from "@/lib/image";
import { prisma } from "@/lib/prisma";
import {
  activeProductPromotionWhere,
  sellableProductWhere,
} from "@/lib/products/storefront-rules";
import { buildDynamicHomepageSections } from "@/lib/storefront-homepage-builder";
import {
  getStorefrontCustomHomepageProductSections,
  type StorefrontCustomHomepageProductSection,
} from "@/lib/storefront-homepage-product-sections";
import type { BRANDS_QUERYResult, Category, Product } from "@/types";

const adminDataTag = getAdminDataTag();
const STOREFRONT_CONTENT_REVALIDATE = 300;

const productSelect = {
  id: true,
  name: true,
  slug: true,
  description: true,
  price: true,
  regularPrice: true,
  salePrice: true,
  discount: true,
  stock: true,
  status: true,
  isActive: true,
  isFeatured: true,
  isPromotion: true,
  promotionStartsAt: true,
  promotionEndsAt: true,
  images: {
    orderBy: {
      sortOrder: "asc" as const,
    },
    select: {
      id: true,
      url: true,
      altText: true,
    },
  },
  brand: {
    select: {
      id: true,
      title: true,
      slug: true,
      description: true,
      imageUrl: true,
    },
  },
  categories: {
    where: { category: { isActive: true, archivedAt: null } },
    include: {
      category: {
        select: {
          title: true,
        },
      },
    },
  },
};

const DEFAULT_HEADER_LINKS = [
  { title: "Accueil", href: "/", sortOrder: 0, openInNewTab: false },
  { title: "Boutique", href: "/shop", sortOrder: 1, openInNewTab: false },
  { title: "Promotions", href: "/deal", sortOrder: 2, openInNewTab: false },
  { title: "Contact", href: "/#contact", sortOrder: 3, openInNewTab: false },
];

const DEFAULT_FOOTER_QUICK_LINKS = [
  { title: "A propos", href: "/about", sortOrder: 0, openInNewTab: false },
  { title: "Contactez-nous", href: "/#contact", sortOrder: 1, openInNewTab: false },
  { title: "Boutique", href: "/shop", sortOrder: 2, openInNewTab: false },
];

const DEFAULT_FOOTER_LEGAL_LINKS = [
  { title: "Conditions generales", href: "/terms", sortOrder: 0, openInNewTab: false },
  {
    title: "Politique de confidentialite",
    href: "/privacy",
    sortOrder: 1,
    openInNewTab: false,
  },
];

const DEFAULT_SOCIAL_LINKS = [
  {
    platform: "facebook",
    title: "Facebook",
    href: "https://www.facebook.com/",
    sortOrder: 0,
    openInNewTab: true,
  },
  {
    platform: "instagram",
    title: "Instagram",
    href: "https://www.instagram.com/",
    sortOrder: 1,
    openInNewTab: true,
  },
  {
    platform: "tiktok",
    title: "TikTok",
    href: "https://www.tiktok.com/",
    sortOrder: 2,
    openInNewTab: true,
  },
];

const DEFAULT_HERO_SLIDES: StorefrontHeroSlide[] = [
  {
    id: "fallback-hero-1",
    badge: "Nouveautes beaute",
    title: "Vos essentiels para, livres en 24/48h",
    subtitle:
      "Decouvrez une selection de produits adaptes a chaque routine soin et bien-etre.",
    ctaLabel: "Explorer la boutique",
    ctaHref: "/shop",
    imageUrl: "/static-assets/banner/banner_1.webp",
    altText: "Banniere hero Zayna",
    sortOrder: 0,
  },
];

const DEFAULT_TRUST_ITEMS: StorefrontTrustItem[] = [
  {
    id: "fallback-trust-1",
    title: "Livraison rapide",
    description: "Expedition partout au Maroc avec suivi en ligne.",
    icon: "truck",
    sortOrder: 0,
  },
  {
    id: "fallback-trust-2",
    title: "Produits verifies",
    description: "Selection rigoureuse de references dermo-cosmetiques.",
    icon: "shield",
    sortOrder: 1,
  },
  {
    id: "fallback-trust-3",
    title: "Support dedie",
    description: "Une equipe disponible pour vous accompagner avant achat.",
    icon: "headset",
    sortOrder: 2,
  },
  {
    id: "fallback-trust-4",
    title: "Paiement flexible",
    description: "Carte, COD ou paiement en plusieurs fois selon eligibilite.",
    icon: "wallet",
    sortOrder: 3,
  },
];

const DEFAULT_SETTINGS: StorefrontSettingsContent = {
  announcementEnabled: true,
  announcementText: "Livraison gratuite partout au Maroc des 299 MAD d'achat.",
  announcementHref: "/shop",
  heroAutoplayMs: 5000,
  featuredCategoriesTitle: "Categories en vedette",
  featuredCategoriesSubtitle:
    "Retrouvez les univers les plus demandes par nos clientes.",
  promotionsTitle: "Promotions du moment",
  promotionsSubtitle: "Des remises actives sur une selection de produits.",
  bestSellersTitle: "Meilleures ventes",
  bestSellersSubtitle: "Les produits les plus commandes cette semaine.",
  newArrivalsTitle: "Nouveautes",
  newArrivalsSubtitle: "Les derniers ajouts de notre catalogue.",
  brandsTitle: "Marques partenaires",
  brandsSubtitle: "Des marques dermo-cosmetiques reconnues.",
  trustTitle: "Pourquoi commander chez Zayna",
  trustSubtitle: "Des engagements clairs pour une experience d'achat fluide.",
  loyaltyBadge: "Programme fidelite",
  loyaltyTitle: "Cumulez des avantages a chaque commande",
  loyaltyDescription:
    "Activez votre carte fidelite pour debloquer des offres reservees, des remises personnalisees et un suivi sur mesure.",
  loyaltyCtaLabel: "Demander ma carte",
  loyaltyCtaHref: "/#contact",
  loyaltyHighlightText: "Service client disponible 7j/7",
  loyaltyImageUrl: "/carte-fideliteEEEEE.png",
  newsletterTitle: "Restez informee des nouveautes",
  newsletterDescription:
    "Recevez nos conseils beaute, offres et lancements en avant-premiere.",
  newsletterPlaceholder: "Votre adresse e-mail",
  newsletterButtonLabel: "S'abonner",
  newsletterSuccessMessage: "Merci, votre inscription a bien ete prise en compte.",
  newsletterErrorMessage:
    "Impossible de valider votre inscription pour le moment.",
  footerAboutTitle: "A propos de Zayna",
  footerAboutDescription:
    "Votre parapharmacie en ligne pour une routine beaute et bien-etre complete.",
  footerQuickLinksTitle: "Liens rapides",
  footerLegalLinksTitle: "Informations legales",
  footerCategoriesTitle: "Categories",
  footerContactPhone: null,
  footerContactEmail: null,
  footerContactHours: null,
  footerCopyrightText: "ZAYNA. Tous droits reserves.",
  featuredCategoriesLimit: 8,
  promotionsLimit: 10,
  bestSellersLimit: 10,
  newArrivalsLimit: 10,
  brandsLimit: 12,
};

type ProductRecord = Prisma.ProductGetPayload<{
  select: typeof productSelect;
}>;

const storefrontSchemaEntities = [
  "StorefrontSettings",
  "HomeHeroSlide",
  "HomeTrustItem",
  "SiteLink",
  "SiteSocialLink",
  "NewsletterSubscription",
  "HomepageSection",
  "HomepageSectionProduct",
  "HomepageWorkspace",
  "HomepageProductSection",
  "HomepageProductSectionItem",
  "Tag",
  "ProductTag",
  "Category",
  "Brand",
  "Product",
];

const isStorefrontSchemaError = (error: unknown) => {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError)) {
    return false;
  }

  if (error.code !== "P2021" && error.code !== "P2022") {
    return false;
  }

  const meta = error.meta as Prisma.JsonObject | undefined;
  const rawTable =
    (typeof meta?.table === "string" && meta.table) ||
    (typeof meta?.column === "string" && meta.column) ||
    "";

  return storefrontSchemaEntities.some((entity) => rawTable.includes(entity));
};

export type StorefrontLink = {
  id: string;
  group: "header" | "footer_quick" | "footer_legal";
  title: string;
  href: string;
  sortOrder: number;
  openInNewTab: boolean;
};

export type StorefrontSocialLink = {
  id: string;
  platform: string;
  title: string;
  href: string;
  sortOrder: number;
  openInNewTab: boolean;
};

export type StorefrontHeroSlide = {
  id: string;
  badge: string | null;
  title: string;
  subtitle: string | null;
  ctaLabel: string | null;
  ctaHref: string | null;
  imageUrl: string | null;
  altText: string | null;
  sortOrder: number;
};

export type StorefrontTrustItem = {
  id: string;
  title: string;
  description: string;
  icon: string;
  sortOrder: number;
};

export type StorefrontSettingsContent = {
  announcementEnabled: boolean;
  announcementText: string;
  announcementHref: string | null;
  heroAutoplayMs: number;
  featuredCategoriesTitle: string;
  featuredCategoriesSubtitle: string;
  promotionsTitle: string;
  promotionsSubtitle: string;
  bestSellersTitle: string;
  bestSellersSubtitle: string;
  newArrivalsTitle: string;
  newArrivalsSubtitle: string;
  brandsTitle: string;
  brandsSubtitle: string;
  trustTitle: string;
  trustSubtitle: string;
  loyaltyBadge: string;
  loyaltyTitle: string;
  loyaltyDescription: string;
  loyaltyCtaLabel: string;
  loyaltyCtaHref: string;
  loyaltyHighlightText: string;
  loyaltyImageUrl: string | null;
  newsletterTitle: string;
  newsletterDescription: string;
  newsletterPlaceholder: string;
  newsletterButtonLabel: string;
  newsletterSuccessMessage: string;
  newsletterErrorMessage: string;
  footerAboutTitle: string;
  footerAboutDescription: string;
  footerQuickLinksTitle: string;
  footerLegalLinksTitle: string;
  footerCategoriesTitle: string;
  footerContactPhone: string | null;
  footerContactEmail: string | null;
  footerContactHours: string | null;
  footerCopyrightText: string;
  featuredCategoriesLimit: number;
  promotionsLimit: number;
  bestSellersLimit: number;
  newArrivalsLimit: number;
  brandsLimit: number;
};

export type StorefrontShellData = {
  settings: StorefrontSettingsContent;
  headerLinks: StorefrontLink[];
  footerQuickLinks: StorefrontLink[];
  footerLegalLinks: StorefrontLink[];
  socialLinks: StorefrontSocialLink[];
  navigationCategories: Category[];
  footerCategories: Category[];
};

export type StorefrontHomeData = StorefrontShellData & {
  heroSlides: StorefrontHeroSlide[];
  featuredCategories: Category[];
  promotionalProducts: Product[];
  bestSellerProducts: Product[];
  newArrivalProducts: Product[];
  brands: BRANDS_QUERYResult;
  trustItems: StorefrontTrustItem[];
  dynamicSections: HomepageDynamicSection[];
  hasDynamicSections: boolean;
  customProductSections: StorefrontCustomHomepageProductSection[];
  hasError: boolean;
};

const clampLimit = (value: number | null | undefined, fallback: number, max = 24) => {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return fallback;
  }

  if (value < 1) {
    return 1;
  }

  return Math.min(value, max);
};

const mapLink = (
  record: {
    id: string;
    group: "header" | "footer_quick" | "footer_legal";
    title: string;
    href: string;
    sortOrder: number;
    openInNewTab: boolean;
  },
  fallbackGroup?: "header" | "footer_quick" | "footer_legal"
): StorefrontLink => ({
  id: record.id,
  group: fallbackGroup || record.group,
  title: record.title,
  href: record.href,
  sortOrder: record.sortOrder,
  openInNewTab: record.openInNewTab,
});

const toCategory = (category: {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  range: number | null;
  featured: boolean;
  imageUrl: string | null;
  parentId?: string | null;
  parent?: {
    title: string;
  } | null;
  _count?: {
    products: number;
  };
}) => mapCategory(category);

const toProduct = (product: ProductRecord) => mapProduct(product);

const toBrand = (brand: {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  imageUrl: string | null;
}) => mapBrand(brand);

const normalizeSettings = (
  settings: Partial<StorefrontSettingsContent> | null | undefined
): StorefrontSettingsContent => ({
  ...DEFAULT_SETTINGS,
  ...(settings || {}),
  loyaltyImageUrl: sanitizePublicImageUrl(
    settings?.loyaltyImageUrl,
    DEFAULT_SETTINGS.loyaltyImageUrl || ""
  ),
  featuredCategoriesLimit: clampLimit(
    settings?.featuredCategoriesLimit,
    DEFAULT_SETTINGS.featuredCategoriesLimit,
    16
  ),
  promotionsLimit: clampLimit(settings?.promotionsLimit, DEFAULT_SETTINGS.promotionsLimit),
  bestSellersLimit: clampLimit(settings?.bestSellersLimit, DEFAULT_SETTINGS.bestSellersLimit),
  newArrivalsLimit: clampLimit(settings?.newArrivalsLimit, DEFAULT_SETTINGS.newArrivalsLimit),
  brandsLimit: clampLimit(settings?.brandsLimit, DEFAULT_SETTINGS.brandsLimit, 18),
  heroAutoplayMs:
    typeof settings?.heroAutoplayMs === "number" && settings.heroAutoplayMs >= 2000
      ? settings.heroAutoplayMs
      : DEFAULT_SETTINGS.heroAutoplayMs,
});

const fallbackHeaderLinks = () =>
  DEFAULT_HEADER_LINKS.map((link, index) => ({
    id: `fallback-header-${index}`,
    group: "header" as const,
    title: link.title,
    href: link.href,
    sortOrder: link.sortOrder,
    openInNewTab: link.openInNewTab,
  }));

const fallbackFooterQuickLinks = () =>
  DEFAULT_FOOTER_QUICK_LINKS.map((link, index) => ({
    id: `fallback-footer-quick-${index}`,
    group: "footer_quick" as const,
    title: link.title,
    href: link.href,
    sortOrder: link.sortOrder,
    openInNewTab: link.openInNewTab,
  }));

const fallbackFooterLegalLinks = () =>
  DEFAULT_FOOTER_LEGAL_LINKS.map((link, index) => ({
    id: `fallback-footer-legal-${index}`,
    group: "footer_legal" as const,
    title: link.title,
    href: link.href,
    sortOrder: link.sortOrder,
    openInNewTab: link.openInNewTab,
  }));

const fallbackSocialLinks = () =>
  DEFAULT_SOCIAL_LINKS.map((item, index) => ({
    id: `fallback-social-${index}`,
    platform: item.platform,
    title: item.title,
    href: item.href,
    sortOrder: item.sortOrder,
    openInNewTab: item.openInNewTab,
  }));

const buildFallbackShellData = (): StorefrontShellData => ({
  settings: DEFAULT_SETTINGS,
  headerLinks: fallbackHeaderLinks(),
  footerQuickLinks: fallbackFooterQuickLinks(),
  footerLegalLinks: fallbackFooterLegalLinks(),
  socialLinks: fallbackSocialLinks(),
  navigationCategories: [],
  footerCategories: [],
});

const fetchStorefrontShellData = async (): Promise<StorefrontShellData> => {
  // Fetch settings, links, social links, and categories in ONE round-trip.
  // Categories used for both nav (top 20) and footer (top 10) — one query, slice in JS.
  const [settingsRecord, rawLinks, rawSocialLinks, allCategoriesRaw] =
    await Promise.all([
      prisma.storefrontSettings.findUnique({
        where: { id: "default" },
      }),
      prisma.siteLink.findMany({
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
        select: {
          id: true, title: true, href: true, group: true,
          sortOrder: true, openInNewTab: true, isActive: true, archivedAt: true,
        },
      }),
      prisma.siteSocialLink.findMany({
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
        select: {
          id: true, platform: true, title: true, href: true,
          sortOrder: true, openInNewTab: true, isActive: true, archivedAt: true,
        },
      }),
      prisma.category.findMany({
        where: {
          isActive: true,
          archivedAt: null,
          OR: [
            { parentId: null },
            { parent: { is: { isActive: true, archivedAt: null } } },
          ],
        },
        orderBy: [{ range: "asc" }, { title: "asc" }],
        select: {
          id: true,
          title: true,
          slug: true,
          range: true,
          description: true,
          featured: true,
          imageUrl: true,
          parentId: true,
          _count: {
            select: {
              products: { where: { product: { is: sellableProductWhere } } },
            },
          },
        },
      }),
    ]);

  const navigationCategoriesRaw = allCategoriesRaw
    .filter((category) => !category.parentId)
    .flatMap((root) => [
      root,
      ...allCategoriesRaw.filter((category) => category.parentId === root.id),
    ])
    .slice(0, 20);
  const footerCategoriesRaw = navigationCategoriesRaw.slice(0, 10);

  const settings = normalizeSettings(settingsRecord);
  const activeLinks = rawLinks.filter((link) => link.isActive && !link.archivedAt);
  const activeSocialLinks = rawSocialLinks.filter((link) => link.isActive && !link.archivedAt);
  const linksByGroup = activeLinks.reduce<
    Record<"header" | "footer_quick" | "footer_legal", StorefrontLink[]>
  >(
    (accumulator, link) => {
      const mapped = mapLink(link);
      accumulator[mapped.group].push(mapped);
      return accumulator;
    },
    {
      header: [],
      footer_quick: [],
      footer_legal: [],
    }
  );

  return {
    settings,
    headerLinks: rawLinks.some((link) => link.group === "header")
      ? linksByGroup.header
      : fallbackHeaderLinks(),
    footerQuickLinks: rawLinks.some((link) => link.group === "footer_quick")
      ? linksByGroup.footer_quick
      : fallbackFooterQuickLinks(),
    footerLegalLinks: rawLinks.some((link) => link.group === "footer_legal")
      ? linksByGroup.footer_legal
      : fallbackFooterLegalLinks(),
    socialLinks: rawSocialLinks.length
      ? activeSocialLinks.map((item) => ({
          id: item.id,
          platform: item.platform,
          title: item.title,
          href: item.href,
          sortOrder: item.sortOrder,
          openInNewTab: item.openInNewTab,
        }))
      : fallbackSocialLinks(),
    navigationCategories: navigationCategoriesRaw.map(toCategory),
    footerCategories: footerCategoriesRaw.map(toCategory),
  };
};

const getCachedStorefrontShellData = unstable_cache(
  fetchStorefrontShellData,
  ["storefront-shell-data-v3"],
  {
    tags: [adminDataTag],
    revalidate: STOREFRONT_CONTENT_REVALIDATE,
  }
);

const fetchStorefrontHomeData = async (): Promise<StorefrontHomeData> => {
  const shell = await getCachedStorefrontShellData();

  try {
    const published = await getPublishedHomepageRenderData();
    const publishedShell = buildHomepageSnapshotShell(published.snapshot, shell);

    return {
      ...publishedShell,
      heroSlides: published.snapshot.heroSlides
        .filter((slide) => slide.isActive && !slide.archivedAt)
        .sort((left, right) => left.sortOrder - right.sortOrder),
      featuredCategories: [],
      promotionalProducts: [],
      bestSellerProducts: [],
      newArrivalProducts: [],
      brands: [],
      trustItems: published.snapshot.trustItems
        .filter((item) => item.isActive && !item.archivedAt)
        .sort((left, right) => left.sortOrder - right.sortOrder),
      dynamicSections: published.sections,
      hasDynamicSections: true,
      customProductSections: [],
      hasError: false,
    };
  } catch (error) {
    if (isStorefrontSchemaError(error)) {
      console.warn("Homepage workspace is not available yet, using normalized storefront data.");
    } else {
      console.error("Failed to resolve the published Homepage workspace:", error);
    }
  }

  const settings = shell.settings;
  const now = new Date();
  const commercialPeriodStart = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const [
    rawHeroSlides,
    rawTrustItems,
    featuredCategoriesRaw,
    promotionalProductsRaw,
    newArrivalProductsRaw,
    rawBrands,
    bestSellerGroups,
  ] = await Promise.all([
    prisma.homeHeroSlide.findMany({
      where: {
        isActive: true,
        archivedAt: null,
        AND: [
          { OR: [{ startsAt: null }, { startsAt: { lte: now } }] },
          { OR: [{ endsAt: null }, { endsAt: { gt: now } }] },
        ],
      },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    }),
    prisma.homeTrustItem.findMany({
      where: {
        isActive: true,
        archivedAt: null,
      },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    }),
    prisma.category.findMany({
      where: {
        featured: true,
        isActive: true,
        archivedAt: null,
        OR: [
          { parentId: null },
          { parent: { is: { isActive: true, archivedAt: null } } },
        ],
      },
      orderBy: [{ range: "asc" }, { title: "asc" }],
      select: {
        id: true,
        title: true,
        slug: true,
        description: true,
        range: true,
        featured: true,
        imageUrl: true,
        _count: {
          select: {
            products: {
              where: { product: { is: sellableProductWhere } },
            },
          },
        },
      },
      take: settings.featuredCategoriesLimit,
    }),
    prisma.product.findMany({
      where: {
        ...sellableProductWhere,
        stock: { gt: 0 },
        ...activeProductPromotionWhere(now),
      },
      orderBy: [{ discount: "desc" }, { updatedAt: "desc" }],
      select: productSelect,
      take: settings.promotionsLimit,
    }),
    prisma.product.findMany({
      where: { ...sellableProductWhere, stock: { gt: 0 } },
      orderBy: [{ createdAt: "desc" }],
      select: productSelect,
      take: settings.newArrivalsLimit,
    }),
    prisma.brand.findMany({
      where: {
        isActive: true,
        archivedAt: null,
      },
      orderBy: [{ title: "asc" }],
      select: {
        id: true,
        title: true,
        slug: true,
        description: true,
        imageUrl: true,
      },
      take: settings.brandsLimit,
    }),
    prisma.orderItem.groupBy({
      by: ["productId"],
      where: {
        productId: {
          not: null,
        },
        order: {
          paymentStatus: "paid",
          status: "delivered",
          orderDate: { gte: commercialPeriodStart },
        },
      },
      _sum: {
        quantity: true,
      },
      orderBy: {
        _sum: {
          quantity: "desc",
        },
      },
      take: settings.bestSellersLimit,
    }),
  ]);

  const bestSellerIds = bestSellerGroups
    .map((group) => group.productId)
    .filter((id): id is string => Boolean(id));
  const bestSellerProductsRaw = bestSellerIds.length
    ? await prisma.product.findMany({
        where: {
          id: {
            in: bestSellerIds,
          },
          ...sellableProductWhere,
          stock: { gt: 0 },
        },
        select: productSelect,
      })
    : [];

  const bestSellerMap = new Map(bestSellerProductsRaw.map((product) => [product.id, product]));
  const sortedBestSellerProducts = bestSellerIds
    .map((productId) => bestSellerMap.get(productId))
    .filter((product): product is ProductRecord => Boolean(product))
    .map(toProduct);

  const fallbackBestSellerProducts =
    sortedBestSellerProducts.length > 0
      ? sortedBestSellerProducts
      : promotionalProductsRaw.slice(0, settings.bestSellersLimit).map(toProduct);

  const featuredCategories =
    featuredCategoriesRaw.length > 0
      ? featuredCategoriesRaw.map(toCategory)
      : shell.navigationCategories
          .filter((category) => (category.productCount || 0) > 0)
          .slice(0, settings.featuredCategoriesLimit);

  let dynamicSections: HomepageDynamicSection[] = [];
  try {
    dynamicSections = await buildDynamicHomepageSections({
      shell: {
        headerLinks: shell.headerLinks,
        footerQuickLinks: shell.footerQuickLinks,
        footerLegalLinks: shell.footerLegalLinks,
        socialLinks: shell.socialLinks,
      },
      settings: {
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
      },
    });
  } catch (error) {
    if (isStorefrontSchemaError(error)) {
      console.warn("Homepage dynamic sections tables are not available yet, using legacy homepage.");
    } else {
      console.error("Failed to load dynamic homepage sections:", error);
    }
    dynamicSections = [];
  }

  let customProductSections: StorefrontCustomHomepageProductSection[] = [];
  try {
    customProductSections = await getStorefrontCustomHomepageProductSections();
  } catch (error) {
    if (isStorefrontSchemaError(error)) {
      console.warn(
        "Homepage product sections tables are not available yet, using legacy product sections."
      );
    } else {
      console.error("Failed to load custom homepage product sections:", error);
    }
    customProductSections = [];
  }

  return {
    ...shell,
    heroSlides:
      rawHeroSlides.length > 0
        ? rawHeroSlides.map((slide) => ({
            id: slide.id,
            badge: slide.badge,
            title: slide.title,
            subtitle: slide.subtitle,
            ctaLabel: slide.ctaLabel,
            ctaHref: slide.ctaHref,
            imageUrl: slide.imageUrl,
            altText: slide.altText,
            sortOrder: slide.sortOrder,
          }))
        : DEFAULT_HERO_SLIDES,
    featuredCategories,
    promotionalProducts: promotionalProductsRaw.map(toProduct),
    bestSellerProducts: fallbackBestSellerProducts,
    newArrivalProducts: newArrivalProductsRaw.map(toProduct),
    brands: rawBrands.map(toBrand),
    trustItems:
      rawTrustItems.length > 0
        ? rawTrustItems.map((item) => ({
            id: item.id,
            title: item.title,
            description: item.description,
            icon: item.icon,
            sortOrder: item.sortOrder,
          }))
        : DEFAULT_TRUST_ITEMS,
    dynamicSections,
    hasDynamicSections: dynamicSections.length > 0,
    customProductSections,
    hasError: false,
  };
};

const getCachedStorefrontHomeData = unstable_cache(
  fetchStorefrontHomeData,
  ["storefront-home-data-v3"],
  {
    tags: [adminDataTag],
    revalidate: STOREFRONT_CONTENT_REVALIDATE,
  }
);

export const getStorefrontShellData = async (): Promise<StorefrontShellData> => {
  try {
    return await getCachedStorefrontShellData();
  } catch (error) {
    if (isStorefrontSchemaError(error)) {
      console.warn("Storefront schema is not fully migrated yet, using fallback shell data.");
      return buildFallbackShellData();
    }

    console.error("Failed to load storefront shell data:", error);
    return buildFallbackShellData();
  }
};

export const getStorefrontHomeData = async (): Promise<StorefrontHomeData> => {
  try {
    return await getCachedStorefrontHomeData();
  } catch (error) {
    const schemaMismatch = isStorefrontSchemaError(error);

    if (schemaMismatch) {
      console.warn("Storefront schema is not fully migrated yet, using fallback homepage data.");
    } else {
      console.error("Failed to load storefront home data:", error);
    }
    const shell = await getStorefrontShellData();

    return {
      ...shell,
      heroSlides: DEFAULT_HERO_SLIDES,
      featuredCategories: [],
      promotionalProducts: [],
      bestSellerProducts: [],
      newArrivalProducts: [],
      brands: [],
      trustItems: DEFAULT_TRUST_ITEMS,
      dynamicSections: [],
      hasDynamicSections: false,
      customProductSections: [],
      hasError: !schemaMismatch,
    };
  }
};
