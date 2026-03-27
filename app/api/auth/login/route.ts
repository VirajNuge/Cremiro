/**
 * POST /api/auth/login
 *
 * Server-side login handler. Responsibilities:
 * 1. Validate & sanitize inputs
 * 2. Call Supabase Auth signInWithPassword (which verifies bcrypt hash internally)
 * 3. Set the session cookie on the response
 * 4. Return generic errors to prevent user enumeration
 *
 * Security measures:
 * - All logic is server-side only
 * - Input validation before any DB call
 * - Generic error responses (no "wrong password" vs "no account" leakage)
 * - Rate limiting per IP
 * - Session cookie set via Supabase SSR (HttpOnly, Secure, SameSite)
 */
import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { sanitizeString, validateEmail } from "@/lib/validation";

// In-memory rate limiter (per IP)
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 10; // 10 login attempts per minute per IP
const ipAttempts = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const record = ipAttempts.get(ip);
  if (!record || record.resetAt < now) {
    ipAttempts.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return true;
  }
  if (record.count >= RATE_LIMIT_MAX) return false;
  record.count++;
  return true;
}

const GENERIC_ERROR = "Invalid email or password. Please try again.";

export async function POST(request: NextRequest) {
  try {
    return await handleLogin(request);
  } catch (err) {
    console.error("[login] unhandled error:", err);
    return NextResponse.json(
      { error: "An unexpected error occurred. Please try again." },
      { status: 500 }
    );
  }
}

async function handleLogin(request: NextRequest) {
  // Rate limiting
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    "unknown";

  if (!checkRateLimit(ip)) {
    return NextResponse.json(
      { error: "Too many requests. Please try again later." },
      { status: 429 }
    );
  }

  // Parse body
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
  const password = typeof raw.password === "string" ? raw.password : "";
  const captchaToken = typeof raw.captchaToken === "string" ? raw.captchaToken : "";

  // Validate
  const emailCheck = validateEmail(email);
  if (!emailCheck.ok) return NextResponse.json({ error: GENERIC_ERROR }, { status: 400 });
  if (!password || password.length < 8 || password.length > 128)
    return NextResponse.json({ error: GENERIC_ERROR }, { status: 400 });
  if (!captchaToken) {
    return NextResponse.json({ error: "CAPTCHA verification is required." }, { status: 400 });
  }

  // Build response first so we can write session cookies onto it
  const response = NextResponse.json({ success: true });

  // Create Supabase SSR client wired to set cookies on this response
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
    options: { captchaToken },
  });

  if (error) {
    // Generic — never reveal whether the account exists
    return NextResponse.json({ error: GENERIC_ERROR }, { status: 401 });
  }

  return response;
}
