import { Client, ID, Storage, TablesDB, Databases } from "node-appwrite";

const endpoint = process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT || "https://cloud.appwrite.io/v1";
const projectId = process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID;
const apiKey = process.env.APPWRITE_API_KEY;
const databaseId = process.env.APPWRITE_DATABASE_ID || "cremiro";

if (!projectId || !apiKey) {
  throw new Error("Set NEXT_PUBLIC_APPWRITE_PROJECT_ID and APPWRITE_API_KEY before running appwrite:setup.");
}

const client = new Client().setEndpoint(endpoint).setProject(projectId).setKey(apiKey);
const tables = new TablesDB(client);
const storage = new Storage(client);
const databases = new Databases(client);

async function ensure(action, label) {
  try { return await action(); }
  catch (error) {
    if (error?.code === 409) return null;
    throw new Error(`${label}: ${error?.message || error}`);
  }
}

await ensure(() => databases.create({ databaseId, name: "cremiro" }), "create database");

const tableDefinitions = {
  profiles: [
    ["user_id", "string", 36], ["username", "string", 64], ["username_hash", "string", 255],
    ["first_name", "string", 128], ["last_name", "string", 128], ["full_name", "string", 255],
    ["email", "email", 255], ["credits_balance", "integer"],
  ],
  requests: [
    ["user_id", "string", 36], ["youtube_url", "url", 2048], ["status", "string", 32],
    ["total_credits", "integer"], ["input_data", "longtext", 100000], ["idempotency_key", "string", 128], ["created_at", "datetime"],
    ["worker_stage", "string", 32], ["worker_cursor", "integer"],
  ],
  job_items: [
    ["request_id", "string", 36], ["user_id", "string", 36], ["job_type", "string", 32],
    ["status", "string", 32], ["credits_cost", "integer"], ["platform", "string", 64],
    ["style", "string", 64], ["input_data", "longtext", 100000], ["output_data", "longtext", 100000],
    ["output_file_ids", "string", 36, true], ["error_message", "longtext", 10000],
    ["started_at", "datetime"], ["completed_at", "datetime"], ["refunded_at", "datetime"], ["refund_txn_id", "string", 36],
  ],
  credit_transactions: [
    ["user_id", "string", 36], ["delta", "integer"], ["balance_after", "integer"],
    ["reason", "string", 64], ["request_id", "string", 36], ["job_item_id", "string", 36],
  ],
};

const indexes = {
  profiles: [["username_unique", "unique", ["username"]], ["user_id_unique", "unique", ["user_id"]], ["email_key", "key", ["email"]]],
  requests: [["user_status", "key", ["user_id", "status"]], ["created_at_key", "key", ["created_at"]], ["idempotency_unique", "unique", ["idempotency_key"]]],
  job_items: [["request_key", "key", ["request_id"]], ["user_status", "key", ["user_id", "status"]]],
  credit_transactions: [["user_key", "key", ["user_id"]], ["request_key", "key", ["request_id"]]],
};

for (const [tableId, columns] of Object.entries(tableDefinitions)) {
  await ensure(() => tables.createTable({ databaseId, tableId, name: tableId, rowSecurity: true }), `create table ${tableId}`);
  for (const [key, type, size, array] of columns) {
    const params = { databaseId, tableId, key, required: false, ...(size ? { size } : {}), ...(array ? { array: true } : {}) };
    const method = type === "email" ? "createEmailColumn" : type === "url" ? "createUrlColumn" : type === "longtext" ? "createLongtextColumn" : type === "datetime" ? "createDatetimeColumn" : type === "integer" ? "createIntegerColumn" : "createStringColumn";
    await ensure(() => tables[method](params), `create ${tableId}.${key}`);
  }
  for (const [key, type, columns] of indexes[tableId]) {
    await ensure(() => tables.createIndex({ databaseId, tableId, key, type, columns }), `create index ${tableId}.${key}`);
  }
}

await ensure(() => storage.createBucket({
  bucketId: process.env.APPWRITE_MEDIA_BUCKET_ID || "media",
  name: "media",
  fileSecurity: true,
  maximumFileSize: 50 * 1024 * 1024,
  allowedFileExtensions: ["mp4", "mov", "webm", "jpg", "jpeg", "png", "webp"],
}), "create media bucket");

console.log(`Appwrite schema ready: ${databaseId}`);
