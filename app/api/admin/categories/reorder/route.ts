import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin, getAdminDataTag } from "@/lib/admin";
import { revalidatePath, revalidateTag } from "next/cache";

export async function POST(request: Request) {
  const identity = await requireAdmin();

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const idsValue = body && typeof body === "object" && "ids" in body ? body.ids : null;

  if (!Array.isArray(idsValue)) {
    return NextResponse.json({ error: "Missing ids array" }, { status: 400 });
  }

  const ids = idsValue.filter((id: unknown): id is string => typeof id === "string");

  if (!ids.length) {
    return NextResponse.json({ error: "No ids provided" }, { status: 400 });
  }

  try {
    const rootCategories = await prisma.category.findMany({
      where: { parentId: null, archivedAt: null },
      select: { id: true },
    });
    const expectedIds = rootCategories.map((category) => category.id);
    if (
      ids.length !== expectedIds.length ||
      new Set(ids).size !== ids.length ||
      ids.some((id) => !expectedIds.includes(id))
    ) {
      return NextResponse.json(
        { error: "Category list is stale or contains invalid hierarchy entries." },
        { status: 409 }
      );
    }

    await prisma.$transaction(async (tx) => {
      for (const [index, id] of ids.entries()) {
        await tx.category.update({ where: { id }, data: { range: index } });
      }
      await tx.adminAuditLog.create({
        data: {
          actorUserId: identity.userId,
          actorEmail: identity.email,
          action: "category.reordered",
          entity: "category",
          entityId: "catalogue",
          metadata: { parentId: null, ids },
        },
      });
    });

    revalidateTag(getAdminDataTag(), "max");
    revalidatePath("/admin", "layout");
    revalidatePath("/", "layout");

    return NextResponse.json({ status: "ok" });
  } catch {
    return NextResponse.json({ error: "Failed to update order" }, { status: 500 });
  }
}
