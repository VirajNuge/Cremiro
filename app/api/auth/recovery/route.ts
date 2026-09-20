import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/appwrite/server";
import { validatePassword } from "@/lib/validation";

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const userId = typeof body.userId === "string" ? body.userId : "";
    const secret = typeof body.secret === "string" ? body.secret : "";
    const password = typeof body.password === "string" ? body.password : "";
    if (!userId || !secret) return NextResponse.json({ error: "This reset link is invalid or expired." }, { status: 400 });
    const check = validatePassword(password);
    if (!check.ok) return NextResponse.json({ error: check.message }, { status: 400 });
    await createAdminClient().account.updateRecovery({ userId, secret, password });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "This reset link is invalid or expired." }, { status: 400 });
  }
}
