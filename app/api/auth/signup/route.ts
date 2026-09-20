import { ID } from "node-appwrite";
import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { createAdminClient } from "@/lib/appwrite/server";
import { createProfile, findOne } from "@/lib/appwrite/data";
import { Query } from "node-appwrite";
import {
  sanitizeString,
  validateEmail,
  validatePassword,
  validateUsername,
  validateName,
} from "@/lib/validation";

const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 5;
const ipAttempts = new Map<string, { count: number; resetAt: number }>();
const GENERIC_ERROR = "Unable to create account. Please check your details and try again.";

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
    if (!checkRateLimit(ip)) {
      return NextResponse.json({ error: "Too many requests. Please try again later." }, { status: 429 });
    }

    const raw = (await request.json()) as Record<string, unknown>;
    const email = sanitizeString(raw.email).toLowerCase();
    const password = typeof raw.password === "string" ? raw.password : "";
    const username = sanitizeString(raw.username).toLowerCase();
    const firstName = sanitizeString(raw.firstName);
    const lastName = sanitizeString(raw.lastName);

    const emailCheck = validateEmail(email);
    if (!emailCheck.ok) return NextResponse.json({ error: emailCheck.message }, { status: 400 });
    const passwordCheck = validatePassword(password);
    if (!passwordCheck.ok) return NextResponse.json({ error: passwordCheck.message }, { status: 400 });
    const usernameCheck = validateUsername(username);
    if (!usernameCheck.ok) return NextResponse.json({ error: usernameCheck.message }, { status: 400 });
    const firstNameCheck = validateName(firstName, "First name");
    if (!firstNameCheck.ok) return NextResponse.json({ error: firstNameCheck.message }, { status: 400 });
    const lastNameCheck = validateName(lastName, "Last name");
    if (!lastNameCheck.ok) return NextResponse.json({ error: lastNameCheck.message }, { status: 400 });
    if (!raw.captchaToken) return NextResponse.json({ error: "CAPTCHA verification is required." }, { status: 400 });

    const existingUsername = await findOne("profiles", [Query.equal("username", username)]);
    if (existingUsername) return NextResponse.json({ error: GENERIC_ERROR }, { status: 400 });

    const admin = createAdminClient();
    const fullName = `${firstName} ${lastName}`;
    const userId = ID.unique();
    const user = await admin.users.create({ userId, email, password, name: fullName });

    try {
      await createProfile(user.$id, {
        user_id: user.$id,
        username,
        username_hash: await bcrypt.hash(username, 12),
        first_name: firstName,
        last_name: lastName,
        full_name: fullName,
        email,
        credits_balance: 1000,
      });

      // Appwrite sends verification mail only from an authenticated account session.
      const session = await admin.account.createEmailPasswordSession({ email, password });
      const { createSessionAccount, getSiteUrl } = await import("@/lib/appwrite/server");
      const sessionAccount = createSessionAccount(session.secret);
      await sessionAccount.createVerification({ url: `${getSiteUrl()}/auth/verify` });
      await sessionAccount.deleteSession({ sessionId: "current" }).catch(() => undefined);
    } catch (profileError) {
      console.error("[signup] profile or verification setup failed");
      await admin.users.delete({ userId: user.$id }).catch(() => undefined);
      throw profileError;
    }

    return NextResponse.json({ message: "Account created. Please check your email to verify your account." }, { status: 201 });
  } catch (error) {
    console.error("[signup] request failed", error instanceof Error ? error.name : "unknown");
    return NextResponse.json({ error: GENERIC_ERROR }, { status: 400 });
  }
}
