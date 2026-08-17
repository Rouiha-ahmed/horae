import assert from "node:assert/strict";
import test from "node:test";

import {
  findSimilarCategory,
  normalizeCategoryName,
  validateCategoryPlacement,
} from "../lib/categories";

const categories = [
  { id: "root", title: "Soins Visage", parentId: null, isActive: true, archivedAt: null },
  { id: "child", title: "Sérums", parentId: "root", isActive: true, archivedAt: null },
  { id: "inactive", title: "Corps", parentId: null, isActive: false, archivedAt: null },
  { id: "archived", title: "PROMOS", parentId: null, isActive: false, archivedAt: new Date() },
];

test("normalizes accents, punctuation, dashes and spacing for duplicate checks", () => {
  assert.equal(normalizeCategoryName("  Soins—Visagé  "), "soins visage");
  assert.equal(normalizeCategoryName("L’HYGIÈNE_dentaire"), "l hygiene dentaire");
});

test("finds equivalent names across active and archived records", () => {
  assert.equal(findSimilarCategory("promos", categories)?.id, "archived");
  assert.equal(findSimilarCategory("Soins-visage", categories)?.id, "root");
});

test("allows a child under an active top-level category", () => {
  assert.doesNotThrow(() =>
    validateCategoryPlacement({ parentId: "root", isActive: true, categories })
  );
});

test("rejects self-parenting, third levels and archived parents", () => {
  assert.throws(
    () => validateCategoryPlacement({ categoryId: "root", parentId: "root", isActive: true, categories }),
    /propre parent/
  );
  assert.throws(
    () => validateCategoryPlacement({ parentId: "child", isActive: true, categories }),
    /Deux niveaux maximum/
  );
  assert.throws(
    () => validateCategoryPlacement({ parentId: "archived", isActive: false, categories }),
    /archivée/
  );
});

test("rejects an active child under an inactive parent and moving a parent below another", () => {
  assert.throws(
    () => validateCategoryPlacement({ parentId: "inactive", isActive: true, categories }),
    /Activez d’abord/
  );
  assert.throws(
    () => validateCategoryPlacement({ categoryId: "root", parentId: "inactive", isActive: false, categories }),
    /sous-catégories/
  );
});
