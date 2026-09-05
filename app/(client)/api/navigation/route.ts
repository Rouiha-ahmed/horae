import { NextResponse } from "next/server";
import { unstable_cache } from "next/cache";

import { getAdminIdentity } from "@/lib/admin";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const getNavContext = unstable_cache(
  async (userId: string) => {
    const ordersCount = await prisma.order.count({ where: { clerkUserId: userId } });
    return { ordersCount };
  },
  ["nav-context"],
  { revalidate: 30 }
);

export async function GET() {
  try {
    const identity = await getAdminIdentity();

    if (!identity.userId) {
      return NextResponse.json(
        { ordersCount: 0, isAdmin: false },
        { headers: { "Cache-Control": "private, max-age=10" } }
      );
    }

    const { ordersCount } = await getNavContext(identity.userId);

    return NextResponse.json(
      { ordersCount, isAdmin: identity.isAdmin },
      { headers: { "Cache-Control": "private, max-age=30" } }
    );
  } catch (error) {
    console.error("Failed to load navigation context:", error);
    return NextResponse.json(
      { ordersCount: 0, isAdmin: false },
      { status: 200, headers: { "Cache-Control": "private, max-age=5" } }
    );
  }
}
