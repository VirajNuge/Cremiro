/**
 * POST /api/auth/forgot-password
 *
 * Sends a password reset email via Supabase Auth.
 * Always returns 200 regardless of whether the email exists — prevents
 * user enumeration (attacker cannot tell if an account exists).
 *
 * Security:
 * - Rate limited per IP
 * - Input validation before any Supabase call
 * - Generic success response always returned
 */
import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { sanitizeString, validateEmail } from "@/lib/validation";

const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 5; // 5 reset requests per minute per IP
const ipAttempts = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const record = ipAttempts.get(ip);
  if (!record || record.resetAt < now) {
    // Evict stale entries to prevent unbounded Map growth
    if (ipAttempts.size > 10_000) {
      for (const [key, val] of ipAttempts) {
        if (val.resetAt < now) ipAttempts.delete(key);
      }
    }
    ipAttempts.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return true;
  }
  if (record.count >= RATE_LIMIT_MAX) return false;
  record.count++;
  return true;
}

const GENERIC_SUCCESS = {
  message: "If an account with that email exists, you'll receive a reset link shortly.",
};

export async function POST(request: NextRequest) {
  try {
    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      request.headers.get("x-real-ip") ??
      "unknown";

    if (!checkRateLimit(ip)) {
      // Still return 200 to prevent enumeration via timing
      return NextResponse.json(GENERIC_SUCCESS);
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid request." }, { status: 400 });
    }

    if (typeof body !== "object" || body === null) {
      return NextResponse.json({ error: "Invalid request." }, { status: 400 });
    }

    const raw = body as Record<string, unknown>;
    const email = sanitizeString(raw.email);

    const emailCheck = validateEmail(email);
    if (!emailCheck.ok) {
      // Return generic — don't reveal why it failed
      return NextResponse.json(GENERIC_SUCCESS);
    }

    // Determine redirect URL for the reset link in the email
    const siteUrl =
      process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
    const redirectTo = `${siteUrl}/reset-password`;

    // Use a lightweight SSR client (no cookies needed — just sending email)
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() { return []; },
          setAll() {},
        },
      }
    );

    // Fire and forget — we never reveal whether this succeeded
    await supabase.auth.resetPasswordForEmail(email, { redirectTo });

    return NextResponse.json(GENERIC_SUCCESS);
  } catch (err) {
    console.error("[forgot-password] unhandled error:", err);
    // Always return generic success to prevent enumeration
    return NextResponse.json(GENERIC_SUCCESS);
  }
}
