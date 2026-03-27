/**
 * Server-only Supabase admin client using the service role key.
 * NEVER import this in client components or expose to the browser.
 * Used for privileged operations like inserting profiles after auth.signUp.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let _adminClient: SupabaseClient | null = null;

/**
 * Returns the Supabase admin client. Throws at request time (not build time)
 * if required environment variables are missing or malformed.
 */
export function getSupabaseAdmin(): SupabaseClient {
  if (_adminClient) return _adminClient;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || supabaseUrl === "your-project-url.supabase.co") {
    throw new Error(
      "[admin] NEXT_PUBLIC_SUPABASE_URL is missing or still set to the placeholder value. " +
      "Set it to your project API URL, e.g. https://xxxx.supabase.co"
    );
  }

  // Catch the common mistake of pasting the dashboard URL instead of the API URL
  // Dashboard: https://supabase.com/dashboard/project/xxxx  ← WRONG
  // API URL:   https://xxxx.supabase.co                     ← CORRECT
  if (supabaseUrl.includes("supabase.com/dashboard")) {
    throw new Error(
      "[admin] NEXT_PUBLIC_SUPABASE_URL is set to the Supabase dashboard URL, not the project API URL. " +
      `Got: "${supabaseUrl}". ` +
      "Use the project ref URL instead: https://xxxx.supabase.co " +
      "(find it in Supabase Dashboard → Project Settings → API → Project URL)"
    );
  }

  if (!supabaseUrl.startsWith("https://")) {
    throw new Error(
      `[admin] NEXT_PUBLIC_SUPABASE_URL must start with https://. Got: "${supabaseUrl}"`
    );
  }

  if (!serviceRoleKey) {
    throw new Error(
      "[admin] SUPABASE_SERVICE_ROLE_KEY is not set. " +
      "Find it in Supabase Dashboard → Project Settings → API → service_role key."
    );
  }

  if (!serviceRoleKey.startsWith("eyJ")) {
    throw new Error(
      "[admin] SUPABASE_SERVICE_ROLE_KEY looks invalid (should start with 'eyJ'). " +
      "Copy it from Supabase Dashboard → Project Settings → API."
    );
  }

  _adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  return _adminClient;
}
