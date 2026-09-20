import { NextResponse } from "next/server";
import { Query } from "node-appwrite";
import { getCurrentAccount } from "@/lib/appwrite/server";
import { findOne } from "@/lib/appwrite/data";
import type { ProfileRow } from "@/lib/appwrite/types";

export async function GET() {
  const user = await getCurrentAccount();
  if (!user) return NextResponse.json({ user: null }, { status: 401 });

  const profile = await findOne<ProfileRow>("profiles", [Query.equal("user_id", user.$id)]);
  return NextResponse.json({
    user: {
      id: user.$id,
      email: user.email,
      email_confirmed_at: user.emailVerification ? user.$updatedAt : null,
      created_at: user.$createdAt,
      user_metadata: {
        avatar_url: (user.prefs as { avatar_url?: string } | undefined)?.avatar_url ?? null,
        full_name: user.name ?? null,
      },
      username: profile?.username ?? null,
      first_name: profile?.first_name ?? null,
      last_name: profile?.last_name ?? null,
      full_name: profile?.full_name ?? user.name ?? null,
      credits_balance: profile?.credits_balance ?? 0,
    },
  });
}
