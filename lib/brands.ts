export const normalizeBrandName = (value: string) =>
  value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("fr")
    .replace(/[\u2010-\u2015\u2212_-]+/g, " ")
    .replace(/[\u2018\u2019\u02bc'`]+/g, " ")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

export type BrandDuplicateCandidate = {
  id: string;
  title: string;
};

export const findSimilarBrand = <T extends BrandDuplicateCandidate>(
  title: string,
  brands: T[],
  excludeId?: string
) => {
  const normalizedTitle = normalizeBrandName(title);

  if (!normalizedTitle) {
    return undefined;
  }

  return brands.find(
    (brand) =>
      brand.id !== excludeId && normalizeBrandName(brand.title) === normalizedTitle
  );
};

export const getPotentialBrandDuplicateGroups = <T extends BrandDuplicateCandidate>(
  brands: T[]
) => {
  const groups = new Map<string, T[]>();

  for (const brand of brands) {
    const key = normalizeBrandName(brand.title);

    if (!key) {
      continue;
    }

    groups.set(key, [...(groups.get(key) || []), brand]);
  }

  return Array.from(groups.values()).filter((group) => group.length > 1);
};
