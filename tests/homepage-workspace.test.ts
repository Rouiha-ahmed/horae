import assert from "node:assert/strict";
import test from "node:test";

import { parseProductSectionConfig } from "../lib/homepage-sections";
import {
  countHomepageChanges,
  validateHomepageSnapshot,
  type HomepageWorkspaceSnapshot,
} from "../lib/homepage-workspace";

const snapshot = (): HomepageWorkspaceSnapshot => ({
  schemaVersion: 4,
  settings: {
    announcementText: "Livraison offerte",
  } as HomepageWorkspaceSnapshot["settings"],
  sections: [
    {
      id: "hero",
      key: "hero",
      type: "hero",
      title: "Hero",
      subtitle: null,
      isActive: true,
      archivedAt: null,
      startsAt: null,
      endsAt: null,
      order: 0,
      layout: null,
      theme: null,
      ctaLabel: null,
      ctaLink: null,
      limit: null,
      config: {},
    },
  ],
  heroSlides: [
    {
      id: "slide",
      badge: null,
      title: "Routine peau",
      subtitle: null,
      ctaLabel: "Découvrir",
      ctaHref: "/product/effaclar-duo",
      imageUrl: "/static-assets/homepage/hero.webp",
      altText: "Produits de soin disposés sur fond clair",
      sortOrder: 0,
      isActive: true,
      archivedAt: null,
      startsAt: null,
      endsAt: null,
    },
  ],
  trustItems: [],
  links: [],
  socialLinks: [],
});

test("Homepage draft differences count real changed records", () => {
  const published = snapshot();
  const draft = structuredClone(published);
  draft.heroSlides[0].title = "Nouvelle routine";
  draft.sections[0].order = 2;

  assert.equal(countHomepageChanges(draft, published), 2);
  assert.equal(countHomepageChanges(published, published), 0);
});

test("Homepage validation accepts generated internal destinations and valid scheduling", () => {
  const draft = snapshot();
  draft.heroSlides[0].startsAt = "2026-08-15T08:00:00.000Z";
  draft.heroSlides[0].endsAt = "2026-08-31T23:59:00.000Z";

  assert.equal(validateHomepageSnapshot(draft).heroSlides[0].ctaHref, "/product/effaclar-duo");
});

test("Homepage validation rejects unsafe external destinations", () => {
  const draft = snapshot();
  draft.heroSlides[0].ctaHref = "javascript:alert(1)";

  assert.throws(() => validateHomepageSnapshot(draft), /slide Hero/i);
});

test("Homepage validation rejects inverted schedules and missing image alt text", () => {
  const scheduled = snapshot();
  scheduled.sections[0].startsAt = "2026-09-01T00:00:00.000Z";
  scheduled.sections[0].endsAt = "2026-08-01T00:00:00.000Z";
  assert.throws(() => validateHomepageSnapshot(scheduled), /période/i);

  const inaccessible = snapshot();
  inaccessible.heroSlides[0].altText = null;
  assert.throws(() => validateHomepageSnapshot(inaccessible), /slide Hero/i);
});

test("Automatic product configuration keeps commercial period and stock rules", () => {
  const config = parseProductSectionConfig(
    {
      sourceType: "best_sellers",
      periodDays: 30,
      excludeOutOfStock: true,
      limit: 8,
      layout: "carousel",
    },
    null,
    null
  );

  assert.equal(config.sourceType, "best_sellers");
  assert.equal(config.periodDays, 30);
  assert.equal(config.excludeOutOfStock, true);
  assert.equal(config.limit, 8);
});

test("Archiving remains reversible data, never a destructive removal", () => {
  const draft = snapshot();
  draft.sections[0].archivedAt = "2026-08-14T12:00:00.000Z";
  draft.sections[0].isActive = false;

  const validated = validateHomepageSnapshot(draft);
  assert.equal(validated.sections.length, 1);
  assert.equal(validated.sections[0].archivedAt, "2026-08-14T12:00:00.000Z");
});
