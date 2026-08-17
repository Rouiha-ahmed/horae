import assert from "node:assert/strict";
import test from "node:test";

import {
  findSimilarBrand,
  getPotentialBrandDuplicateGroups,
  normalizeBrandName,
} from "../lib/brands";

test("normalizeBrandName unifies safe spacing, case, hyphen and apostrophe variants", () => {
  assert.equal(normalizeBrandName("  La   Roche-Posay "), "la roche posay");
  assert.equal(normalizeBrandName("LA ROCHE–POSAY"), "la roche posay");
  assert.equal(normalizeBrandName("L’Oréal"), normalizeBrandName("l'oreal"));
});

test("findSimilarBrand detects deterministic duplicates across every lifecycle state", () => {
  const brands = [
    { id: "active", title: "Vichy", lifecycle: "active" },
    { id: "archived", title: "La Roche-Posay", lifecycle: "archived" },
  ];

  assert.equal(findSimilarBrand(" la roche posay ", brands)?.id, "archived");
  assert.equal(findSimilarBrand("Vichy", brands, "active"), undefined);
  assert.equal(findSimilarBrand("Uriage", brands), undefined);
});

test("duplicate quality groups remain conservative", () => {
  const groups = getPotentialBrandDuplicateGroups([
    { id: "1", title: "A-Derma" },
    { id: "2", title: "a derma" },
    { id: "3", title: "Bioderma" },
  ]);

  assert.deepEqual(groups.map((group) => group.map((brand) => brand.id)), [["1", "2"]]);
});
