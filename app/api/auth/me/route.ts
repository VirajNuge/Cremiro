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

  // Only return safe, non-sensitive fields
  return NextResponse.json({
    user: {
      id: user.id,
      email: user.email,
      created_at: user.created_at,
      app_metadata: user.app_metadata,
      user_metadata: user.user_metadata,
    },
  });
}
