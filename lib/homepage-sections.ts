import type { HomepageSectionType } from "@prisma/client";

import type { Brand, Category, Product } from "@/types";

export const homepageSectionTypes = [
  "hero",
  "product_list",
  "category_list",
  "brand_list",
  "reassurance",
  "newsletter",
  "custom_banner",
  "links_group",
  "social_links",
  "custom_html",
  "rich_text",
] as const;

export const productSectionSourceTypes = [
  "manual_selection",
  "by_category",
  "by_brand",
  "by_tag",
  "discounted",
  "best_sellers",
  "newest",
  "featured",
] as const;

export const productSectionLayouts = ["grid", "carousel", "compact"] as const;
export const productSectionSortByOptions = [
  "createdAt",
  "updatedAt",
  "price",
  "discount",
  "name",
] as const;
export const sortOrderOptions = ["asc", "desc"] as const;

export type HomepageSectionTypeValue = (typeof homepageSectionTypes)[number];
export type HomepageProductSourceTypeValue = (typeof productSectionSourceTypes)[number];
export type HomepageProductSectionLayout = (typeof productSectionLayouts)[number];
export type HomepageProductSortBy = (typeof productSectionSortByOptions)[number];
export type HomepageSortOrder = (typeof sortOrderOptions)[number];

export type HomepageSectionRecord = {
  id: string;
  key: string;
  type: HomepageSectionType;
  title: string;
  subtitle: string | null;
  isActive: boolean;
  order: number;
  layout: string | null;
  theme: string | null;
  ctaLabel: string | null;
  ctaLink: string | null;
  limit: number | null;
  config: unknown;
};

export type HomepageSectionOption = {
  value: HomepageSectionTypeValue;
  label: string;
};

export type HomepageProductSourceOption = {
  value: HomepageProductSourceTypeValue;
  label: string;
};

export const homepageSectionTypeOptions: HomepageSectionOption[] = [
  { value: "hero", label: "Hero" },
  { value: "product_list", label: "Section produits" },
  { value: "category_list", label: "Liste de categories" },
  { value: "brand_list", label: "Liste de marques" },
  { value: "reassurance", label: "Reassurance" },
  { value: "newsletter", label: "Newsletter" },
  { value: "custom_banner", label: "Banniere personnalisee" },
  { value: "links_group", label: "Groupe de liens" },
  { value: "social_links", label: "Reseaux sociaux" },
  { value: "custom_html", label: "HTML personnalise" },
  { value: "rich_text", label: "Texte riche" },
];

export const homepageProductSourceOptions: HomepageProductSourceOption[] = [
  { value: "manual_selection", label: "Selection manuelle" },
  { value: "by_category", label: "Par categorie" },
  { value: "by_brand", label: "Par marque" },
  { value: "by_tag", label: "Par tag" },
  { value: "discounted", label: "Produits en promotion" },
  { value: "best_sellers", label: "Meilleures ventes" },
  { value: "newest", label: "Nouveautes" },
  { value: "featured", label: "Produits mis en avant" },
];

export type StorefrontRenderableLink = {
  id: string;
  title: string;
  href: string;
  sortOrder: number;
  openInNewTab: boolean;
  group?: "header" | "footer_quick" | "footer_legal";
};

export type StorefrontRenderableSocialLink = {
  id: string;
  platform: string;
  title: string;
  href: string;
  sortOrder: number;
  openInNewTab: boolean;
};

export type StorefrontRenderableHeroSlide = {
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

export type StorefrontRenderableTrustItem = {
  id: string;
  title: string;
  description: string;
  icon: string;
  sortOrder: number;
};

export type HomepageProductSectionConfig = {
  sourceType: HomepageProductSourceTypeValue;
  productIds: string[];
  categoryId: string | null;
  brandId: string | null;
  tagId: string | null;
  limit: number | null;
  layout: HomepageProductSectionLayout;
  sortBy: HomepageProductSortBy | null;
  sortOrder: HomepageSortOrder;
  hideIfEmpty: boolean;
  excludeOutOfStock: boolean;
  periodDays: number | null;
};

export type HomepageDynamicSection = {
  id: string;
  key: string;
  type: HomepageSectionTypeValue;
  title: string;
  subtitle: string | null;
  order: number;
  layout: string | null;
  theme: string | null;
  ctaLabel: string | null;
  ctaLink: string | null;
  limit: number | null;
  config: Record<string, unknown>;
  productConfig?: HomepageProductSectionConfig;
  products?: Product[];
  categories?: Category[];
  brands?: Brand[];
  heroSlides?: StorefrontRenderableHeroSlide[];
  trustItems?: StorefrontRenderableTrustItem[];
  links?: StorefrontRenderableLink[];
  socialLinks?: StorefrontRenderableSocialLink[];
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

const asString = (value: unknown) => (typeof value === "string" ? value.trim() : "");

const asNullableString = (value: unknown) => {
  const normalized = asString(value);
  return normalized || null;
};

const asBoolean = (value: unknown, fallback = false) =>
  typeof value === "boolean" ? value : fallback;

const asInteger = (
  value: unknown,
  options: {
    fallback: number | null;
    min?: number;
    max?: number;
  }
) => {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return options.fallback;
  }

  const normalized = Math.trunc(value);
  if (typeof options.min === "number" && normalized < options.min) {
    return options.min;
  }

  if (typeof options.max === "number" && normalized > options.max) {
    return options.max;
  }

  return normalized;
};

const asStringArray = (value: unknown) => {
  if (!Array.isArray(value)) {
    return [];
  }

  const seen = new Set<string>();
  const items: string[] = [];

  for (const item of value) {
    const normalized = asString(item);
    if (!normalized || seen.has(normalized)) {
      continue;
    }
    seen.add(normalized);
    items.push(normalized);
  }

  return items;
};

const isProductSourceType = (value: string): value is HomepageProductSourceTypeValue =>
  (productSectionSourceTypes as readonly string[]).includes(value);

const isProductLayout = (value: string): value is HomepageProductSectionLayout =>
  (productSectionLayouts as readonly string[]).includes(value);

const isProductSortBy = (value: string): value is HomepageProductSortBy =>
  (productSectionSortByOptions as readonly string[]).includes(value);

const isSortOrder = (value: string): value is HomepageSortOrder =>
  (sortOrderOptions as readonly string[]).includes(value);

export const parseSectionConfigObject = (config: unknown) => (isRecord(config) ? config : {});

export const parseProductSectionConfig = (
  config: unknown,
  sectionLimit: number | null,
  sectionLayout: string | null
): HomepageProductSectionConfig => {
  const parsed = parseSectionConfigObject(config);
  const sourceTypeInput = asString(parsed.sourceType);
  const layoutInput = asString(parsed.layout) || asString(sectionLayout);
  const sortByInput = asString(parsed.sortBy);
  const sortOrderInput = asString(parsed.sortOrder);

  const limitFromConfig = asInteger(parsed.limit, {
    fallback: null,
    min: 1,
    max: 30,
  });
  const periodDays = asInteger(parsed.periodDays, {
    fallback: null,
    min: 1,
    max: 365,
  });

  return {
    sourceType: isProductSourceType(sourceTypeInput) ? sourceTypeInput : "featured",
    productIds: asStringArray(parsed.productIds),
    categoryId: asNullableString(parsed.categoryId),
    brandId: asNullableString(parsed.brandId),
    tagId: asNullableString(parsed.tagId),
    limit:
      limitFromConfig ??
      asInteger(sectionLimit, {
        fallback: 10,
        min: 1,
        max: 30,
      }),
    layout: isProductLayout(layoutInput) ? layoutInput : "grid",
    sortBy: isProductSortBy(sortByInput) ? sortByInput : null,
    sortOrder: isSortOrder(sortOrderInput) ? sortOrderInput : "desc",
    hideIfEmpty: asBoolean(parsed.hideIfEmpty, true),
    excludeOutOfStock: asBoolean(parsed.excludeOutOfStock, true),
    periodDays,
  };
};

export const sanitizeSectionKey = (value: string) =>
  value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

export const ensureSectionKey = (value: string, fallback: string) => {
  const normalized = sanitizeSectionKey(value);
  return normalized || sanitizeSectionKey(fallback) || `section-${Date.now()}`;
};

export const isKnownHomepageSectionType = (value: string): value is HomepageSectionTypeValue =>
  (homepageSectionTypes as readonly string[]).includes(value);
