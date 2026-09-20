import { NextResponse } from "next/server";
import { APPWRITE_SESSION_COOKIE, createSessionAccount, getSessionSecret } from "@/lib/appwrite/server";

export async function POST() {
  const session = await getSessionSecret();
  if (session) await createSessionAccount(session).deleteSession({ sessionId: "current" }).catch(() => undefined);
  const response = NextResponse.json({ success: true });
  response.cookies.set(APPWRITE_SESSION_COOKIE, "", { httpOnly: true, expires: new Date(0), path: "/" });
  return response;
}
