import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/appwrite/server";

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const userId = url.searchParams.get("userId");
  const secret = url.searchParams.get("secret");
  if (!userId || !secret) return NextResponse.redirect(new URL("/login?verified=0", request.url));
  try {
    await createAdminClient().account.updateVerification({ userId, secret });
    return NextResponse.redirect(new URL("/login?verified=1", request.url));
  } catch {
    return NextResponse.redirect(new URL("/login?verified=0", request.url));
  }
}
