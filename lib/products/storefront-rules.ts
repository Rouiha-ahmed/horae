import type { Prisma } from "@prisma/client";

/** Single visibility contract used by every public product query. */
export const sellableProductWhere = {
  lifecycleStatus: "ACTIVE",
  isActive: true,
  archivedAt: null,
} satisfies Prisma.ProductWhereInput;

/** Product-level promotion window. PromoCode remains an order-level concern. */
export const activeProductPromotionWhere = (
  now = new Date(),
): Prisma.ProductWhereInput => ({
  isPromotion: true,
  discount: { gt: 0 },
  AND: [
    { OR: [{ promotionStartsAt: null }, { promotionStartsAt: { lte: now } }] },
    { OR: [{ promotionEndsAt: null }, { promotionEndsAt: { gt: now } }] },
  ],
});
