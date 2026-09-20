import { NextResponse } from "next/server";

/**
 * Kept as a compatibility endpoint for older clients. Appwrite Functions now
 * write status rows directly with the server SDK, so HMAC worker callbacks are
 * intentionally disabled.
 */
export async function POST() {
  return NextResponse.json({ error: "Worker callbacks are no longer supported." }, { status: 410 });
}
