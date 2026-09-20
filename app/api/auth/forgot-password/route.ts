import { NextRequest, NextResponse } from "next/server";
import { createAdminClient, getSiteUrl } from "@/lib/appwrite/server";
import { sanitizeString, validateEmail } from "@/lib/validation";

const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 5;
const ipAttempts = new Map<string, { count: number; resetAt: number }>();
const GENERIC_SUCCESS = { message: "If an account with that email exists, you'll receive a reset link shortly." };

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
    if (!checkRateLimit(ip)) return NextResponse.json(GENERIC_SUCCESS);
    const raw = (await request.json()) as Record<string, unknown>;
    const email = sanitizeString(raw.email).toLowerCase();
    if (!validateEmail(email).ok) return NextResponse.json(GENERIC_SUCCESS);
    await createAdminClient().account.createRecovery({
      email,
      url: `${getSiteUrl()}/reset-password`,
    });
    return NextResponse.json(GENERIC_SUCCESS);
  } catch {
    return NextResponse.json(GENERIC_SUCCESS);
  }
}
