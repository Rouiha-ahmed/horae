import { NextRequest, NextResponse } from "next/server";

import { getAdminIdentity } from "@/lib/admin";
import { expireDueLoyaltyPoints } from "@/lib/services/loyalty";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const authorization = request.headers.get("authorization");
  const configuredSecret = process.env.CRON_SECRET;
  const cronAuthorized = Boolean(
    configuredSecret && authorization === `Bearer ${configuredSecret}`,
  );
  const identity = cronAuthorized ? null : await getAdminIdentity();

  if (!cronAuthorized && !identity?.isAdmin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await expireDueLoyaltyPoints(
    cronAuthorized
      ? { label: "system:cron" }
      : {
          userId: identity?.userId,
          email: identity?.email,
          label: identity?.displayName,
        },
  );
  return NextResponse.json({ ok: true, ...result });
}
