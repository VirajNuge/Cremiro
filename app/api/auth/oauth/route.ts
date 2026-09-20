import { NextRequest, NextResponse } from "next/server";
import { OAuthProvider } from "node-appwrite";
import { createAdminClient, getSiteUrl } from "@/lib/appwrite/server";

function safeNext(value: string | null) {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.includes("://")) return "/dashboard";
  return value;
}

export async function GET(request: NextRequest) {
  const next = safeNext(new URL(request.url).searchParams.get("next"));
  const siteUrl = getSiteUrl();
  const callback = `${siteUrl}/auth/callback?next=${encodeURIComponent(next)}`;
  const failure = `${siteUrl}/login?error=oauth_failed`;
  const url = await createAdminClient().account.createOAuth2Token({
    provider: OAuthProvider.Google,
    success: callback,
    failure,
  });
  return NextResponse.redirect(url);
}
