"use server";

import { Prisma } from "@prisma/client";
import { revalidatePath, revalidateTag } from "next/cache";

import { getAdminDataTag, requireAdmin } from "@/lib/admin";
import {
  deleteStoredAsset,
  isUploadedFile,
  saveOptimizedImage,
} from "@/lib/admin-media";
import {
  findSimilarCategory,
  validateCategoryPlacement,
  type CategoryPlacementRecord,
} from "@/lib/categories";
import { prisma } from "@/lib/prisma";

export type CategoryMutationState = {
  success: boolean;
  message: string;
  revision: number;
};

const failure = (message: string, revision = Date.now()): CategoryMutationState => ({
  success: false,
  message,
  revision,
});

const success = (message: string): CategoryMutationState => ({
  success: true,
  message,
  revision: Date.now(),
});

const read = (formData: FormData, key: string) => {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
};

const checked = (formData: FormData, key: string) => formData.get(key) === "on";

const slugify = (value: string) =>
  value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "categorie";

async function uniqueSlug(title: string) {
  const base = slugify(title);
  let candidate = base;
  let suffix = 2;
  while (await prisma.category.findUnique({ where: { slug: candidate }, select: { id: true } })) {
    candidate = `${base}-${suffix++}`;
  }
  return candidate;
}

const refreshCategories = (slugs: string[] = []) => {
  revalidateTag(getAdminDataTag(), "max");
  revalidatePath("/admin", "layout");
  revalidatePath("/", "layout");
  for (const slug of slugs) revalidatePath(`/category/${slug}`);
};

const categoryPlacementSelect = {
  id: true,
  title: true,
  parentId: true,
  isActive: true,
  archivedAt: true,
} as const;

const actionMessage = (error: unknown, fallback: string) =>
  error instanceof Error ? error.message : fallback;

async function audit(
  tx: Prisma.TransactionClient,
  identity: Awaited<ReturnType<typeof requireAdmin>>,
  action: string,
  entityId: string,
  metadata?: Prisma.InputJsonValue
) {
  await tx.adminAuditLog.create({
    data: {
      actorUserId: identity.userId,
      actorEmail: identity.email,
      action,
      entity: "category",
      entityId,
      metadata,
    },
  });
}

export async function saveCategoryAction(
  previousState: CategoryMutationState,
  formData: FormData
): Promise<CategoryMutationState> {
  const identity = await requireAdmin();
  const revision = previousState.revision + 1;
  const id = read(formData, "id") || null;
  const title = read(formData, "title");
  const parentId = read(formData, "parentId") || null;
  const description = read(formData, "description") || null;
  const isActive = checked(formData, "isActive");
  const isFeatured = checked(formData, "isFeatured");
  const removeImage = checked(formData, "removeImage");
  const imageFile = formData.get("imageFile");

  if (!title) return failure("Le nom de la catégorie est obligatoire.", revision);
  if (title.length > 100) return failure("Le nom est limité à 100 caractères.", revision);
  if (description && description.length > 500) {
    return failure("La description est limitée à 500 caractères.", revision);
  }

  const [allCategories, existing] = await Promise.all([
    prisma.category.findMany({ select: categoryPlacementSelect }),
    id
      ? prisma.category.findUnique({
          where: { id },
          select: { id: true, slug: true, imageUrl: true, archivedAt: true, parentId: true },
        })
      : Promise.resolve(null),
  ]);

  if (id && !existing) return failure("Cette catégorie n’existe plus.", revision);
  if (existing?.archivedAt) {
    return failure("Désarchivez cette catégorie avant de la modifier.", revision);
  }

  const duplicate = findSimilarCategory(title, allCategories, id || undefined);
  if (duplicate) {
    return failure(`Une catégorie similaire existe déjà : ${duplicate.title}.`, revision);
  }

  try {
    validateCategoryPlacement({
      categoryId: id || undefined,
      parentId,
      isActive,
      categories: allCategories,
    });
  } catch (error) {
    return failure(actionMessage(error, "Hiérarchie invalide."), revision);
  }

  let uploaded: Awaited<ReturnType<typeof saveOptimizedImage>> | null = null;
  try {
    if (isUploadedFile(imageFile)) {
      uploaded = await saveOptimizedImage(imageFile, "categories", title);
    }
    const slug = existing?.slug || (await uniqueSlug(title));

    await prisma.$transaction(
      async (tx) => {
        const candidates = await tx.category.findMany({ select: categoryPlacementSelect });
        const transactionDuplicate = findSimilarCategory(title, candidates, id || undefined);
        if (transactionDuplicate) {
          throw new Error(`Une catégorie similaire existe déjà : ${transactionDuplicate.title}.`);
        }
        validateCategoryPlacement({
          categoryId: id || undefined,
          parentId,
          isActive,
          categories: candidates as CategoryPlacementRecord[],
        });

        if (id) {
          await tx.category.update({
            where: { id },
            data: {
              title,
              description,
              parentId,
              isActive,
              featured: isFeatured,
              ...(uploaded?.url
                ? { imageUrl: uploaded.url }
                : removeImage
                  ? { imageUrl: null }
                  : {}),
            },
          });
          await audit(tx, identity, "category.updated", id, {
            title,
            parentId,
            isActive,
            isFeatured,
          });
        } else {
          const lastSibling = await tx.category.aggregate({
            where: { parentId, archivedAt: null },
            _max: { range: true },
          });
          const created = await tx.category.create({
            data: {
              title,
              slug,
              description,
              parentId,
              range: (lastSibling._max.range ?? -1) + 1,
              isActive,
              featured: isFeatured,
              imageUrl: uploaded?.url || null,
            },
          });
          await audit(tx, identity, "category.created", created.id, {
            title,
            parentId,
            isActive,
            isFeatured,
          });
        }
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
    );

    if ((uploaded?.url || removeImage) && existing?.imageUrl) {
      await deleteStoredAsset(existing.imageUrl);
    }
    refreshCategories([slug]);
    return success(id ? "Catégorie mise à jour." : "Catégorie ajoutée.");
  } catch (error) {
    if (uploaded?.url) await deleteStoredAsset(uploaded.url);
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034") {
      return failure("Une autre modification a eu lieu. Rechargez puis réessayez.", revision);
    }
    return failure(actionMessage(error, "Impossible d’enregistrer la catégorie."), revision);
  }
}

export async function setCategoryFlagsAction(
  id: string,
  values: { isActive?: boolean; isFeatured?: boolean }
): Promise<CategoryMutationState> {
  const identity = await requireAdmin();
  try {
    const category = await prisma.category.findUnique({
      where: { id },
      select: { slug: true, archivedAt: true, parentId: true },
    });
    if (!category) throw new Error("Cette catégorie n’existe plus.");
    if (category.archivedAt) throw new Error("Désarchivez la catégorie avant de la modifier.");

    if (values.isActive && category.parentId) {
      const parent = await prisma.category.findUnique({
        where: { id: category.parentId },
        select: { isActive: true, archivedAt: true },
      });
      if (!parent || parent.archivedAt || !parent.isActive) {
        throw new Error("Activez d’abord la catégorie parente.");
      }
    }

    await prisma.$transaction(async (tx) => {
      await tx.category.update({ where: { id }, data: values });
      await audit(tx, identity, "category.flags_updated", id, values);
    });
    refreshCategories([category.slug]);
    return success("Statut mis à jour.");
  } catch (error) {
    return failure(actionMessage(error, "Impossible de modifier le statut."));
  }
}

export async function archiveCategoryAction(id: string): Promise<CategoryMutationState> {
  const identity = await requireAdmin();
  try {
    const category = await prisma.category.findUnique({
      where: { id },
      select: { slug: true, archivedAt: true, children: { select: { id: true, slug: true } } },
    });
    if (!category) throw new Error("Cette catégorie n’existe plus.");
    if (category.archivedAt) throw new Error("Cette catégorie est déjà archivée.");
    const ids = [id, ...category.children.map((child) => child.id)];
    const now = new Date();
    await prisma.$transaction(async (tx) => {
      await tx.category.updateMany({
        where: { id: { in: ids }, archivedAt: null },
        data: {
          archivedAt: now,
          archivedBy: identity.userId || identity.email || "admin",
          isActive: false,
          featured: false,
        },
      });
      await audit(tx, identity, "category.archived", id, {
        categoryIds: ids,
        associationsPreserved: true,
      });
    });
    refreshCategories([category.slug, ...category.children.map((child) => child.slug)]);
    return success(
      ids.length > 1
        ? "Catégorie et sous-catégories archivées. Les produits sont conservés."
        : "Catégorie archivée. Les produits sont conservés."
    );
  } catch (error) {
    return failure(actionMessage(error, "Impossible d’archiver la catégorie."));
  }
}

export async function restoreCategoryAction(id: string): Promise<CategoryMutationState> {
  const identity = await requireAdmin();
  try {
    const category = await prisma.category.findUnique({
      where: { id },
      select: {
        slug: true,
        parentId: true,
        archivedAt: true,
        archivedBy: true,
        children: {
          where: { archivedAt: { not: null } },
          select: { id: true, slug: true, archivedAt: true, archivedBy: true },
        },
      },
    });
    if (!category) throw new Error("Cette catégorie n’existe plus.");
    if (!category.archivedAt) throw new Error("Cette catégorie n’est pas archivée.");
    if (category.slug && ["promotions", "promos", "best-sellers", "best-seller", "meilleures-ventes", "new-arrivals", "nouveautes", "nouveaux-produits"].includes(category.slug)) {
      throw new Error("Cette ancienne catégorie est remplacée par une collection automatique et ne peut pas être restaurée.");
    }
    if (category.parentId) {
      const parent = await prisma.category.findUnique({
        where: { id: category.parentId },
        select: { archivedAt: true },
      });
      if (!parent || parent.archivedAt) {
        throw new Error("Désarchivez d’abord la catégorie parente.");
      }
    }
    const batchChildren = category.children.filter(
      (child) =>
        child.archivedBy === category.archivedBy &&
        child.archivedAt?.getTime() === category.archivedAt?.getTime()
    );
    const ids = [id, ...batchChildren.map((child) => child.id)];
    await prisma.$transaction(async (tx) => {
      await tx.category.updateMany({
        where: { id: { in: ids } },
        data: { archivedAt: null, archivedBy: null },
      });
      await audit(tx, identity, "category.restored", id, { categoryIds: ids });
    });
    refreshCategories([category.slug, ...batchChildren.map((child) => child.slug)]);
    return success("Catégorie désarchivée. Réactivez-la quand elle est prête.");
  } catch (error) {
    return failure(actionMessage(error, "Impossible de désarchiver la catégorie."));
  }
}

export async function reorderCategoriesAction(
  orderedIdsByParent: Array<{ parentId: string | null; ids: string[] }>
): Promise<CategoryMutationState> {
  const identity = await requireAdmin();
  try {
    const rows = await prisma.category.findMany({
      where: { archivedAt: null },
      select: { id: true, parentId: true },
    });
    const expected = new Map<string, string[]>();
    for (const row of rows) {
      const key = row.parentId || "root";
      expected.set(key, [...(expected.get(key) || []), row.id]);
    }
    for (const group of orderedIdsByParent) {
      const key = group.parentId || "root";
      const expectedIds = expected.get(key) || [];
      if (
        group.ids.length !== expectedIds.length ||
        new Set(group.ids).size !== group.ids.length ||
        group.ids.some((id) => !expectedIds.includes(id))
      ) {
        throw new Error("L’ordre reçu ne correspond plus au catalogue. Rechargez la page.");
      }
    }
    const providedKeys = new Set(
      orderedIdsByParent.map((group) => group.parentId || "root")
    );
    for (const [key, ids] of expected) {
      if (ids.length && !providedKeys.has(key)) {
        throw new Error("L’ordre reçu est incomplet. Rechargez la page.");
      }
    }

    await prisma.$transaction(async (tx) => {
      for (const group of orderedIdsByParent) {
        for (const [range, id] of group.ids.entries()) {
          await tx.category.update({ where: { id }, data: { range } });
        }
      }
      await audit(tx, identity, "category.reordered", "catalogue", {
        groups: orderedIdsByParent,
      });
    });
    refreshCategories();
    return success("Nouvel ordre enregistré.");
  } catch (error) {
    return failure(actionMessage(error, "Impossible d’enregistrer l’ordre."));
  }
}
