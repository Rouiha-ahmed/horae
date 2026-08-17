import { Prisma, type InventoryMovementReason } from "@prisma/client";

import { prisma } from "@/lib/prisma";

export type InventoryActor = {
  userId?: string | null;
  email?: string | null;
  name?: string | null;
};

export type InventoryAdjustmentInput = {
  productId: string;
  quantityDelta: number;
  reason: InventoryMovementReason;
  actor?: InventoryActor;
  note?: string | null;
  relatedOrderId?: string | null;
  idempotencyKey?: string | null;
};

export async function adjustInventoryInTransaction(
  tx: Prisma.TransactionClient,
  input: InventoryAdjustmentInput,
) {
  if (!Number.isInteger(input.quantityDelta) || input.quantityDelta === 0) {
    throw new Error("La variation de stock doit être un entier non nul.");
  }
  if (input.idempotencyKey) {
    const existing = await tx.inventoryMovement.findUnique({
      where: { idempotencyKey: input.idempotencyKey },
    });
    if (existing) return existing;
  }

  const rows =
    input.quantityDelta < 0
      ? await tx.$queryRaw<Array<{ stock: number }>>(Prisma.sql`
        UPDATE "Product"
        SET "stock" = "stock" + ${input.quantityDelta}, "updatedAt" = CURRENT_TIMESTAMP
        WHERE "id" = ${input.productId} AND "stock" >= ${Math.abs(input.quantityDelta)}
        RETURNING "stock"
      `)
      : await tx.$queryRaw<Array<{ stock: number }>>(Prisma.sql`
        UPDATE "Product"
        SET "stock" = "stock" + ${input.quantityDelta}, "updatedAt" = CURRENT_TIMESTAMP
        WHERE "id" = ${input.productId}
        RETURNING "stock"
      `);

  if (!rows.length) {
    const product = await tx.product.findUnique({
      where: { id: input.productId },
      select: { id: true, stock: true },
    });
    if (!product) throw new Error("Produit introuvable.");
    throw new Error(
      `Stock insuffisant : ${product.stock} unité(s) disponible(s).`,
    );
  }
  const newQuantity = rows[0].stock;
  if (
    input.quantityDelta > 0 &&
    (input.reason === "RESTOCK" || input.reason === "INITIAL_BALANCE")
  ) {
    await tx.product.update({
      where: { id: input.productId },
      data: { lastRestockedAt: new Date() },
    });
  }
  return tx.inventoryMovement.create({
    data: {
      productId: input.productId,
      previousQuantity: newQuantity - input.quantityDelta,
      quantityDelta: input.quantityDelta,
      newQuantity,
      reason: input.reason,
      note: input.note?.trim() || null,
      actorUserId: input.actor?.userId || null,
      actorEmail: input.actor?.email || null,
      actorName: input.actor?.name || null,
      relatedOrderId: input.relatedOrderId || null,
      idempotencyKey: input.idempotencyKey || null,
    },
  });
}

export const adjustInventory = (input: InventoryAdjustmentInput) =>
  prisma.$transaction((tx) => adjustInventoryInTransaction(tx, input), {
    isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
  });
