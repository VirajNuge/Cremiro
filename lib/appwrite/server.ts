import { Account, Client, Functions, Storage, TablesDB, Users } from "node-appwrite";
import { cookies } from "next/headers";
import type { NextRequest } from "next/server";
import {
  APPWRITE_DATABASE_ID,
  APPWRITE_ENDPOINT,
  APPWRITE_PROJECT_ID,
  assertAppwriteConfig,
} from "./config";

export const APPWRITE_SESSION_COOKIE = "cremiro_appwrite_session";

export function createAdminClient() {
  assertAppwriteConfig(true);
  const client = new Client()
    .setEndpoint(APPWRITE_ENDPOINT)
    .setProject(APPWRITE_PROJECT_ID)
    .setKey(process.env.APPWRITE_API_KEY!);

  return {
    client,
    account: new Account(client),
    tables: new TablesDB(client),
    storage: new Storage(client),
    functions: new Functions(client),
    users: new Users(client),
  };
}

export async function getSessionSecret() {
  const cookieStore = await cookies();
  return cookieStore.get(APPWRITE_SESSION_COOKIE)?.value ?? null;
}

export async function getCurrentAccount() {
  const session = await getSessionSecret();
  if (!session) return null;

  try {
    const client = new Client()
      .setEndpoint(APPWRITE_ENDPOINT)
      .setProject(APPWRITE_PROJECT_ID)
      .setSession(session);
    return await new Account(client).get();
  } catch {
    return null;
  }
}

export async function getAccountFromRequest(request: NextRequest) {
  const session = request.cookies.get(APPWRITE_SESSION_COOKIE)?.value;
  if (!session) return null;
  try {
    const client = new Client()
      .setEndpoint(APPWRITE_ENDPOINT)
      .setProject(APPWRITE_PROJECT_ID)
      .setSession(session);
    return await new Account(client).get();
  } catch {
    return null;
  }
}

export function createSessionAccount(sessionSecret: string) {
  assertAppwriteConfig();
  const client = new Client()
    .setEndpoint(APPWRITE_ENDPOINT)
    .setProject(APPWRITE_PROJECT_ID)
    .setSession(sessionSecret);
  return new Account(client);
}

export function getSiteUrl() {
  return process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
}

export { APPWRITE_DATABASE_ID };
