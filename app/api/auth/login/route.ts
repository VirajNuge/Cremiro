import { NextRequest, NextResponse } from "next/server";
import { createAdminClient, APPWRITE_SESSION_COOKIE } from "@/lib/appwrite/server";
import { sanitizeString, validateEmail } from "@/lib/validation";

const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 10;
const ipAttempts = new Map<string, { count: number; resetAt: number }>();
const GENERIC_ERROR = "Invalid email or password. Please try again.";

function checkRateLimit(ip: string) {
  const now = Date.now();
  const record = ipAttempts.get(ip);
  if (!record || record.resetAt < now) {
    ipAttempts.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return true;
  }
  if (record.count >= RATE_LIMIT_MAX) return false;
  record.count += 1;
  return true;
}

export async function POST(request: NextRequest) {
  try {
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
    if (!checkRateLimit(ip)) return NextResponse.json({ error: "Too many requests. Please try again later." }, { status: 429 });

    const raw = (await request.json()) as Record<string, unknown>;
    const email = sanitizeString(raw.email).toLowerCase();
    const password = typeof raw.password === "string" ? raw.password : "";
    const emailCheck = validateEmail(email);
    if (!emailCheck.ok || password.length < 8 || password.length > 128) {
      return NextResponse.json({ error: GENERIC_ERROR }, { status: 400 });
    }
    if (!raw.captchaToken) return NextResponse.json({ error: "CAPTCHA verification is required." }, { status: 400 });

    const session = await createAdminClient().account.createEmailPasswordSession({ email, password });
    const response = NextResponse.json({ success: true });
    response.cookies.set(APPWRITE_SESSION_COOKIE, session.secret, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: Math.max(60, Math.floor((new Date(session.expire).getTime() - Date.now()) / 1000)),
    });
    return response;
  } catch {
    return NextResponse.json({ error: GENERIC_ERROR }, { status: 401 });
  }
}
