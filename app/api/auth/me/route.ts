import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET() {
  const supabase = await createClient();

  // getUser() validates the session server-side via the Supabase Auth server
  // (unlike getSession() which only reads client-side storage and can be spoofed)
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return NextResponse.json({ user: null }, { status: 401 });
  }

  // Fetch profile from profiles table
  const { data: profile } = await supabase
    .from("profiles")
    .select("username, first_name, last_name, full_name")
    .eq("user_id", user.id)
    .maybeSingle();

  // Only return safe, non-sensitive fields.
  // Intentionally omit app_metadata (contains provider/role internals) and
  // raw user_metadata except for fields we explicitly need client-side.
  return NextResponse.json({
    user: {
      id: user.id,
      email: user.email,
      created_at: user.created_at,
      // Only safe user_metadata fields needed by the UI (avatar, display name from OAuth)
      user_metadata: {
        avatar_url: (user.user_metadata?.avatar_url as string) ?? null,
        full_name: (user.user_metadata?.full_name as string) ?? null,
      },
      // Profile fields (null if not yet created e.g. OAuth users)
      username: profile?.username ?? null,
      first_name: profile?.first_name ?? null,
      last_name: profile?.last_name ?? null,
      full_name: profile?.full_name ?? (user.user_metadata?.full_name as string) ?? null,
    },
  });
}
