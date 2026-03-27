import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Whitelist of safe internal redirect paths
function getSafeRedirectPath(next: string | null): string {
  const fallback = "/dashboard";
  if (!next) return fallback;
  // Only allow relative paths starting with / and no protocol/double-slash
  if (!next.startsWith("/") || next.startsWith("//") || next.includes("://")) {
    return fallback;
  }
  // Ensure it stays on the same origin by parsing
  try {
    const parsed = new URL(next, "http://localhost");
    return parsed.pathname + parsed.search;
  } catch {
    return fallback;
  }
}

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = getSafeRedirectPath(searchParams.get("next"));

  if (code) {
    // Build the redirect response first so we can set cookies on it
    const redirectResponse = NextResponse.redirect(`${origin}${next}`);

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll();
          },
          setAll(cookiesToSet) {
            // Write cookies to the outgoing response (not the request)
            cookiesToSet.forEach(({ name, value, options }) =>
              redirectResponse.cookies.set(name, value, options)
            );
          },
        },
      }
    );

    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      return redirectResponse;
    }

    // Log server-side (never log tokens)
    console.error("[auth/callback] exchangeCodeForSession error:", error.message);
  }

  // Return user to an error page
  return NextResponse.redirect(`${origin}/auth/auth-code-error`);
}
