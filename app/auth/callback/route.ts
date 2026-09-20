import { NextResponse, type NextRequest } from "next/server";
import bcrypt from "bcryptjs";
import { Query } from "node-appwrite";
import { APPWRITE_SESSION_COOKIE, createAdminClient, createSessionAccount } from "@/lib/appwrite/server";
import { createProfile, findOne } from "@/lib/appwrite/data";

function safeNext(value: string | null) {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.includes("://")) return "/dashboard";
  return value;
}

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const userId = url.searchParams.get("userId");
  const secret = url.searchParams.get("secret");
  const next = safeNext(url.searchParams.get("next"));
  if (!userId || !secret) return NextResponse.redirect(new URL("/auth/auth-code-error", request.url));

  try {
    const session = await createAdminClient().account.createSession({ userId, secret });
    const oauthUser = await createSessionAccount(session.secret).get();
    const existingProfile = await findOne("profiles", [Query.equal("user_id", userId)]);
    if (!existingProfile) {
      const baseUsername = (oauthUser.email?.split("@")[0] || "creator").replace(/[^a-zA-Z0-9_]/g, "").slice(0, 40) || "creator";
      const username = `${baseUsername}_${userId.slice(-6)}`;
      const fullName = oauthUser.name || baseUsername;
      await createProfile(userId, {
        user_id: userId,
        username,
        username_hash: await bcrypt.hash(username, 12),
        first_name: fullName.split(" ")[0] || "Creator",
        last_name: fullName.split(" ").slice(1).join(" ") || "",
        full_name: fullName,
        email: oauthUser.email || "",
        credits_balance: 1000,
      });
    }
    const response = NextResponse.redirect(new URL(next, request.url));
    response.cookies.set(APPWRITE_SESSION_COOKIE, session.secret, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: Math.max(60, Math.floor((new Date(session.expire).getTime() - Date.now()) / 1000)),
    });
    return response;
  } catch {
    return NextResponse.redirect(new URL("/auth/auth-code-error", request.url));
  }
}
