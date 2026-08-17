"use server";

import { Prisma, type InventoryMovementReason, type ProductLifecycleStatus, type ProductStatus } from "@prisma/client";
import { revalidatePath, revalidateTag } from "next/cache";

import { getAdminDataTag, requireAdmin } from "@/lib/admin";
import { deleteStoredAssets, isUploadedFile, saveOptimizedImage } from "@/lib/admin-media";
import { adjustInventoryInTransaction } from "@/lib/inventory";
import { prisma } from "@/lib/prisma";
import { validateBulkProductAction, validateProductLifecycleTransition, type BulkProductAction } from "@/lib/products/domain";

export type ProductMutationState = {
  success: boolean;
  message: string;
  revision: number;
  productId?: string;
  bulk?: {
    selected: number;
    updated: number;
    incompatible: Array<{ id: string; name: string; reason: string }>;
  };
};

const result = (success: boolean, message: string, revision = Date.now(), extra: Partial<ProductMutationState> = {}): ProductMutationState => ({ success, message, revision, ...extra });
const read = (formData: FormData, key: string) => typeof formData.get(key) === "string" ? String(formData.get(key)).trim() : "";
const checked = (formData: FormData, key: string) => formData.get(key) === "on";
const list = (formData: FormData, key: string) => Array.from(new Set(formData.getAll(key).filter((item): item is string => typeof item === "string" && Boolean(item.trim())).map((item) => item.trim())));
const number = (formData: FormData, key: string, fallback = 0) => {
  const parsed = Number(read(formData, key));
  return Number.isFinite(parsed) ? parsed : fallback;
};
const date = (formData: FormData, key: string) => {
  const value = read(formData, key);
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) throw new Error("Une date de promotion est invalide.");
  return parsed;
};
const slugify = (value: string) => value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "produit";

async function uniqueSlug(name: string) {
  const base = slugify(name);
  let slug = base;
  let index = 2;
  while (await prisma.product.findUnique({ where: { slug }, select: { id: true } })) slug = `${base}-${index++}`;
  return slug;
}

const refreshProducts = (slug?: string) => {
  revalidateTag(getAdminDataTag(), "max");
  revalidatePath("/admin/products");
  revalidatePath("/admin", "layout");
  revalidatePath("/", "layout");
  revalidatePath("/shop");
  if (slug) revalidatePath(`/product/${slug}`);
};

const asLifecycle = (value: string): ProductLifecycleStatus =>
  (["DRAFT", "ACTIVE", "INACTIVE", "ARCHIVED"] as string[]).includes(value) ? value as ProductLifecycleStatus : "DRAFT";
const asMerchandising = (value: string): ProductStatus =>
  (["new", "hot", "sale"] as string[]).includes(value) ? value as ProductStatus : "new";

async function validateIdentifiers(sku: string, barcode: string | null, excludeId?: string) {
  const [productSku, variantSku, productBarcode, variantBarcode] = await Promise.all([
    prisma.product.findFirst({ where: { sku: { equals: sku, mode: "insensitive" }, ...(excludeId ? { id: { not: excludeId } } : {}) }, select: { id: true } }),
    prisma.productVariant.findFirst({ where: { sku: { equals: sku, mode: "insensitive" } }, select: { id: true } }),
    barcode ? prisma.product.findFirst({ where: { barcode, ...(excludeId ? { id: { not: excludeId } } : {}) }, select: { id: true } }) : Promise.resolve(null),
    barcode ? prisma.productVariant.findFirst({ where: { barcode }, select: { id: true } }) : Promise.resolve(null),
  ]);
  if (productSku || variantSku) throw new Error("Ce SKU est déjà utilisé.");
  if (productBarcode || variantBarcode) throw new Error("Cet EAN / code-barres est déjà utilisé.");
}

export async function saveProductAction(previous: ProductMutationState, formData: FormData): Promise<ProductMutationState> {
  const revision = previous.revision + 1;
  const identity = await requireAdmin();
  const id = read(formData, "id") || null;
  const name = read(formData, "name");
  const sku = read(formData, "sku").toUpperCase();
  const barcode = read(formData, "barcode") || null;
  const description = read(formData, "description") || null;
  const price = number(formData, "price");
  const regularPrice = Math.max(price, number(formData, "regularPrice", price));
  const discount = Math.trunc(number(formData, "discount"));
  const initialStock = Math.trunc(number(formData, "initialStock"));
  const lifecycleStatus = asLifecycle(read(formData, "lifecycleStatus"));
  const status = asMerchandising(read(formData, "merchandisingStatus"));
  const isFeatured = checked(formData, "isFeatured");
  const isPromotion = checked(formData, "isPromotion") && discount > 0;
  const categoryIds = list(formData, "categoryIds");
  const brandId = read(formData, "brandId") || null;
  const imageFiles = formData.getAll("imageFiles").filter(isUploadedFile);
  let promotionStartsAt: Date | null;
  let promotionEndsAt: Date | null;

  try {
    promotionStartsAt = date(formData, "promotionStartsAt");
    promotionEndsAt = date(formData, "promotionEndsAt");
  } catch (error) {
    return result(false, error instanceof Error ? error.message : "Dates invalides.", revision);
  }
  if (!name || name.length > 180) return result(false, "Le nom du produit est obligatoire et limité à 180 caractères.", revision);
  if (!sku || sku.length > 80) return result(false, "Le SKU est obligatoire et limité à 80 caractères.", revision);
  if (price < 0 || regularPrice < 0) return result(false, "Le prix ne peut pas être négatif.", revision);
  if (discount < 0 || discount >= 100) return result(false, "La remise doit être comprise entre 0 et 99 %.", revision);
  if (promotionStartsAt && promotionEndsAt && promotionStartsAt >= promotionEndsAt) return result(false, "La fin de promotion doit être postérieure au début.", revision);
  if (!id && initialStock < 0) return result(false, "Le stock initial ne peut pas être négatif.", revision);

  const existing = id ? await prisma.product.findUnique({ where: { id }, select: { id: true, slug: true, lifecycleStatus: true, archivedAt: true, stock: true, images: { select: { url: true } } } }) : null;
  if (id && !existing) return result(false, "Ce produit n’existe plus.", revision);
  try {
    if (existing) validateProductLifecycleTransition(existing.lifecycleStatus, lifecycleStatus);
    await validateIdentifiers(sku, barcode, id || undefined);
  } catch (error) {
    return result(false, error instanceof Error ? error.message : "Identifiants invalides.", revision);
  }

  const [categories, brand] = await Promise.all([
    categoryIds.length ? prisma.category.findMany({ where: { id: { in: categoryIds }, archivedAt: null, isActive: true }, select: { id: true } }) : Promise.resolve([]),
    brandId ? prisma.brand.findFirst({ where: { id: brandId, archivedAt: null, isActive: true }, select: { id: true } }) : Promise.resolve(null),
  ]);
  if (categories.length !== categoryIds.length) return result(false, "Une catégorie sélectionnée est inactive ou archivée.", revision);
  if (brandId && !brand) return result(false, "La marque sélectionnée est inactive ou archivée.", revision);
  if (lifecycleStatus === "ACTIVE") {
    if (price <= 0) return result(false, "Un produit actif doit avoir un prix valide.", revision);
    if (!categories.length) return result(false, "Un produit actif doit avoir au moins une catégorie active.", revision);
    if (!imageFiles.length && !existing?.images.length) return result(false, "Un produit actif doit avoir une image principale.", revision);
  }

  let uploaded: Awaited<ReturnType<typeof saveOptimizedImage>>[] = [];
  try {
    uploaded = await Promise.all(imageFiles.slice(0, 6).map((file) => saveOptimizedImage(file, "products", name)));
    const slug = existing?.slug || await uniqueSlug(name);
    const savedId = await prisma.$transaction(async (tx) => {
      const commercialData = {
        name,
        sku,
        barcode,
        description,
        shortDescription: description,
        price: new Prisma.Decimal(price),
        regularPrice: new Prisma.Decimal(regularPrice),
        salePrice: isPromotion ? new Prisma.Decimal(price) : null,
        discount: isPromotion ? discount : 0,
        lifecycleStatus,
        status: isPromotion ? "sale" as ProductStatus : status,
        isActive: lifecycleStatus === "ACTIVE",
        isFeatured,
        isPromotion,
        promotionStartsAt: isPromotion ? promotionStartsAt : null,
        promotionEndsAt: isPromotion ? promotionEndsAt : null,
        archivedAt: lifecycleStatus === "ARCHIVED" ? existing?.archivedAt || new Date() : null,
        archivedBy: lifecycleStatus === "ARCHIVED" ? identity.userId || identity.email || "admin" : null,
        brandId: brand?.id || null,
      };
      const product = existing
        ? await tx.product.update({ where: { id: existing.id }, data: commercialData, select: { id: true } })
        : await tx.product.create({ data: { ...commercialData, slug, stock: 0 }, select: { id: true } });

      await tx.productCategory.deleteMany({ where: { productId: product.id, category: { archivedAt: null } } });
      if (categories.length) await tx.productCategory.createMany({ data: categories.map((category) => ({ productId: product.id, categoryId: category.id })) });
      if (uploaded.length) {
        await tx.productImage.deleteMany({ where: { productId: product.id } });
        await tx.productImage.createMany({ data: uploaded.map((image, index) => ({ productId: product.id, url: image.url, altText: name, sortOrder: index, isPrimary: index === 0 })) });
      }
      if (!existing && initialStock > 0) {
        await adjustInventoryInTransaction(tx, { productId: product.id, quantityDelta: initialStock, reason: "INITIAL_BALANCE", actor: { userId: identity.userId, email: identity.email, name: identity.displayName }, note: "Stock initial à la création", idempotencyKey: `product:${product.id}:initial-balance` });
      }
      await tx.adminAuditLog.create({ data: { actorUserId: identity.userId, actorEmail: identity.email, action: existing ? "product.updated" : "product.created", entity: "Product", entityId: product.id, metadata: { lifecycleStatus, categoryIds, brandId, price, discount, isFeatured } } });
      return product.id;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

    if (uploaded.length && existing?.images.length) await deleteStoredAssets(existing.images.map((image) => image.url));
    refreshProducts(slug);
    return result(true, existing ? "Produit mis à jour." : "Produit créé en toute sécurité.", revision, { productId: savedId });
  } catch (error) {
    if (uploaded.length) await deleteStoredAssets(uploaded.map((image) => image.url));
    return result(false, error instanceof Error ? error.message : "Impossible d’enregistrer le produit.", revision);
  }
}

export async function archiveProductAction(id: string): Promise<ProductMutationState> {
  const identity = await requireAdmin();
  const product = await prisma.product.findUnique({ where: { id }, select: { slug: true, name: true, lifecycleStatus: true } });
  if (!product) return result(false, "Produit introuvable.");
  if (product.lifecycleStatus === "ARCHIVED") return result(false, "Ce produit est déjà archivé.");
  await prisma.$transaction(async (tx) => {
    await tx.product.update({ where: { id }, data: { lifecycleStatus: "ARCHIVED", isActive: false, archivedAt: new Date(), archivedBy: identity.userId || identity.email || "admin" } });
    await tx.adminAuditLog.create({ data: { actorUserId: identity.userId, actorEmail: identity.email, action: "product.archived", entity: "Product", entityId: id, metadata: { previousLifecycle: product.lifecycleStatus, orderHistoryPreserved: true } } });
  });
  refreshProducts(product.slug);
  return result(true, `« ${product.name} » a été archivé. L’historique est conservé.`);
}

export async function restoreProductAction(id: string): Promise<ProductMutationState> {
  const identity = await requireAdmin();
  const product = await prisma.product.findUnique({ where: { id }, select: { slug: true, name: true, lifecycleStatus: true } });
  if (!product) return result(false, "Produit introuvable.");
  if (product.lifecycleStatus !== "ARCHIVED") return result(false, "Ce produit n’est pas archivé.");
  await prisma.$transaction(async (tx) => {
    await tx.product.update({ where: { id }, data: { lifecycleStatus: "INACTIVE", isActive: false, archivedAt: null, archivedBy: null } });
    await tx.adminAuditLog.create({ data: { actorUserId: identity.userId, actorEmail: identity.email, action: "product.restored", entity: "Product", entityId: id, metadata: { restoredAs: "INACTIVE" } } });
  });
  refreshProducts(product.slug);
  return result(true, `« ${product.name} » a été désarchivé et reste inactif.`);
}

export async function duplicateProductAction(id: string): Promise<ProductMutationState> {
  const identity = await requireAdmin();
  const source = await prisma.product.findUnique({ where: { id }, include: { categories: { where: { category: { archivedAt: null, isActive: true } } } } });
  if (!source) return result(false, "Produit introuvable.");
  let suffix = 2;
  let sku = `${source.sku}-COPY`;
  while (await prisma.product.findUnique({ where: { sku }, select: { id: true } })) sku = `${source.sku}-COPY-${suffix++}`;
  const slug = await uniqueSlug(`${source.name} copie`);
  const duplicated = await prisma.$transaction(async (tx) => {
    const product = await tx.product.create({ data: {
      name: `${source.name} — copie`, slug, sku, description: source.description, shortDescription: source.shortDescription, fullDescription: source.fullDescription,
      price: source.price, regularPrice: source.regularPrice, salePrice: source.salePrice, discount: source.discount, stock: 0,
      status: source.status, lifecycleStatus: "DRAFT", isActive: false, isFeatured: false, isBestSeller: false, isNewArrival: false,
      isPromotion: source.isPromotion, promotionStartsAt: source.promotionStartsAt, promotionEndsAt: source.promotionEndsAt,
      brandId: source.brandId, seoTitle: source.seoTitle, seoDescription: source.seoDescription, seoKeywords: source.seoKeywords,
    } });
    if (source.categories.length) await tx.productCategory.createMany({ data: source.categories.map((item) => ({ productId: product.id, categoryId: item.categoryId })) });
    await tx.adminAuditLog.create({ data: { actorUserId: identity.userId, actorEmail: identity.email, action: "product.duplicated", entity: "Product", entityId: product.id, metadata: { sourceProductId: source.id, startedAs: "DRAFT", stockCopied: false, imagesCopied: false } } });
    return product;
  });
  refreshProducts();
  return result(true, "Copie créée en brouillon, sans stock ni image partagée.", Date.now(), { productId: duplicated.id });
}

export async function adjustProductInventoryAction(previous: ProductMutationState, formData: FormData): Promise<ProductMutationState> {
  const revision = previous.revision + 1;
  const identity = await requireAdmin();
  const productId = read(formData, "productId");
  const quantityDelta = Math.trunc(number(formData, "quantityDelta"));
  const reason = read(formData, "reason") as InventoryMovementReason;
  const allowed = new Set<InventoryMovementReason>(["MANUAL_ADJUSTMENT", "RESTOCK", "RETURN", "DAMAGE", "CORRECTION", "IMPORT"]);
  if (!allowed.has(reason)) return result(false, "Motif de mouvement invalide.", revision);
  if (!quantityDelta) return result(false, "Indiquez une variation de stock non nulle.", revision);
  try {
    await prisma.$transaction((tx) => adjustInventoryInTransaction(tx, { productId, quantityDelta, reason, note: read(formData, "note"), actor: { userId: identity.userId, email: identity.email, name: identity.displayName } }), { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    refreshProducts();
    return result(true, "Stock ajusté et mouvement enregistré.", revision);
  } catch (error) {
    return result(false, error instanceof Error ? error.message : "Ajustement impossible.", revision);
  }
}

export async function bulkProductAction(previous: ProductMutationState, formData: FormData): Promise<ProductMutationState> {
  const revision = previous.revision + 1;
  const identity = await requireAdmin();
  const ids = list(formData, "productIds").slice(0, 100);
  const action = read(formData, "action") as BulkProductAction;
  if (!ids.length) return result(false, "Sélectionnez au moins un produit.", revision);
  if (!(["ACTIVATE", "DEACTIVATE", "ARCHIVE", "FEATURE_ON", "FEATURE_OFF"] as string[]).includes(action)) return result(false, "Action groupée invalide.", revision);
  const products = await prisma.product.findMany({ where: { id: { in: ids } }, select: { id: true, name: true, lifecycleStatus: true, images: { take: 1, select: { id: true } }, categories: { where: { category: { archivedAt: null, isActive: true } }, take: 1, select: { categoryId: true } }, price: true } });
  const validation = validateBulkProductAction(products, action);
  if (action === "ACTIVATE") {
    const ready = [] as typeof validation.compatible;
    for (const product of validation.compatible) {
      const full = products.find((item) => item.id === product.id)!;
      if (Number(full.price) <= 0 || !full.images.length || !full.categories.length) validation.incompatible.push({ id: product.id, name: product.name, reason: "Prix, image ou catégorie active manquant" });
      else ready.push(product);
    }
    validation.compatible = ready;
  }
  const now = new Date();
  await prisma.$transaction(async (tx) => {
    if (validation.compatible.length) await tx.product.updateMany({ where: { id: { in: validation.compatible.map((item) => item.id) } }, data:
      action === "ACTIVATE" ? { lifecycleStatus: "ACTIVE", isActive: true, archivedAt: null, archivedBy: null } :
      action === "DEACTIVATE" ? { lifecycleStatus: "INACTIVE", isActive: false } :
      action === "ARCHIVE" ? { lifecycleStatus: "ARCHIVED", isActive: false, archivedAt: now, archivedBy: identity.userId || identity.email || "admin" } :
      action === "FEATURE_ON" ? { isFeatured: true } : { isFeatured: false }
    });
    await tx.adminAuditLog.create({ data: { actorUserId: identity.userId, actorEmail: identity.email, action: `product.bulk_${action.toLowerCase()}`, entity: "Product", entityId: "bulk", metadata: { selected: ids.length, updatedIds: validation.compatible.map((item) => item.id), incompatible: validation.incompatible } } });
  });
  refreshProducts();
  return result(true, `${validation.compatible.length} produit(s) mis à jour sur ${ids.length}.`, revision, { bulk: { selected: ids.length, updated: validation.compatible.length, incompatible: validation.incompatible } });
}
