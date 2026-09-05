import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// CMI redirects the user here after a failed or cancelled payment (POST)
export async function POST() {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "";
  return NextResponse.redirect(`${baseUrl}/checkout?error=payment_failed`, {
    status: 303,
  });
}

// Fallback GET
export async function GET() {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "";
  return NextResponse.redirect(`${baseUrl}/checkout?error=payment_failed`, {
    status: 302,
  });
}
