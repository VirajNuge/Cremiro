export const APPWRITE_ENDPOINT =
  process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT || "https://cloud.appwrite.io/v1";

export const APPWRITE_PROJECT_ID = process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID || "";
export const APPWRITE_DATABASE_ID = process.env.APPWRITE_DATABASE_ID || "cremiro";
export const APPWRITE_MEDIA_BUCKET_ID = process.env.APPWRITE_MEDIA_BUCKET_ID || "media";
export const APPWRITE_CONTENT_WORKER_FUNCTION_ID =
  process.env.APPWRITE_CONTENT_WORKER_FUNCTION_ID || "content-worker";

export const APPWRITE_TABLES = {
  profiles: process.env.APPWRITE_PROFILES_TABLE_ID || "profiles",
  requests: process.env.APPWRITE_REQUESTS_TABLE_ID || "requests",
  jobItems: process.env.APPWRITE_JOB_ITEMS_TABLE_ID || "job_items",
  creditTransactions:
    process.env.APPWRITE_CREDIT_TRANSACTIONS_TABLE_ID || "credit_transactions",
} as const;

export function assertAppwriteConfig(requireServerKey = false) {
  if (!APPWRITE_PROJECT_ID) {
    throw new Error("NEXT_PUBLIC_APPWRITE_PROJECT_ID is not configured.");
  }
  if (requireServerKey && !process.env.APPWRITE_API_KEY) {
    throw new Error("APPWRITE_API_KEY is not configured on the server.");
  }
}
