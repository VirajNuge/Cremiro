import { ID, Permission, Query, Role } from "node-appwrite";
import { APPWRITE_DATABASE_ID, APPWRITE_TABLES } from "./config";
import { createAdminClient } from "./server";
import type { AppwriteRow, JobItemRow, ProfileRow, RequestRow } from "./types";

export const MAX_TRANSACTION_JOB_ITEMS = 95;

function jsonColumn(value: unknown) {
  return JSON.stringify(value ?? {});
}

export function userReadPermission(userId: string) {
  return Permission.read(Role.user(userId));
}

export function userWritePermission(userId: string) {
  return Permission.update(Role.user(userId));
}

export function userRowPermissions(userId: string) {
  return [userReadPermission(userId), userWritePermission(userId)];
}

export function tableId(name: keyof typeof APPWRITE_TABLES) {
  return APPWRITE_TABLES[name];
}

export async function getRow<T extends AppwriteRow>(
  table: keyof typeof APPWRITE_TABLES,
  rowId: string,
  queries: string[] = [],
) {
  const { tables } = createAdminClient();
  return tables.getRow({
    databaseId: APPWRITE_DATABASE_ID,
    tableId: tableId(table),
    rowId,
    queries,
  }) as unknown as Promise<T>;
}

export async function listRows<T extends AppwriteRow>(
  table: keyof typeof APPWRITE_TABLES,
  queries: string[] = [],
) {
  const { tables } = createAdminClient();
  return tables.listRows({
    databaseId: APPWRITE_DATABASE_ID,
    tableId: tableId(table),
    queries,
  }) as unknown as Promise<{ rows: T[]; total: number }>;
}

export async function findOne<T extends AppwriteRow>(
  table: keyof typeof APPWRITE_TABLES,
  queries: string[],
) {
  const result = await listRows<T>(table, [...queries, Query.limit(1)]);
  return result.rows[0] ?? null;
}

export async function createProfile(userId: string, data: Omit<ProfileRow, "$id">) {
  const { tables } = createAdminClient();
  return tables.createRow({
    databaseId: APPWRITE_DATABASE_ID,
    tableId: tableId("profiles"),
    rowId: userId,
    data,
    permissions: userRowPermissions(userId),
  }) as unknown as Promise<ProfileRow>;
}

export async function createRequestTransaction(args: {
  userId: string;
  youtubeUrl: string;
  totalCredits: number;
  inputData: Record<string, unknown>;
  jobItems: Array<{
    job_type: string;
    credits_cost: number;
    platform?: string | null;
    style?: string | null;
    input_data: Record<string, unknown>;
  }>;
  idempotencyKey: string;
}) {
  if (args.jobItems.length > MAX_TRANSACTION_JOB_ITEMS) {
    throw new Error(`A request may contain at most ${MAX_TRANSACTION_JOB_ITEMS} job items.`);
  }

  const existing = await findOne<RequestRow>("requests", [
    Query.equal("idempotency_key", args.idempotencyKey),
  ]);
  if (existing) return { request_id: existing.$id, already_exists: true };

  const profile = await findOne<ProfileRow>("profiles", [
    Query.equal("user_id", args.userId),
  ]);
  if (!profile) throw new Error("Profile not found for user.");
  if (profile.credits_balance < args.totalCredits) {
    throw new Error("Insufficient credits.");
  }

  const requestId = ID.unique();
  const jobItemIds = args.jobItems.map(() => ID.unique());
  const admin = createAdminClient();
  const transaction = await admin.tables.createTransaction({ ttl: 60 });
  const newBalance = profile.credits_balance - args.totalCredits;

  try {
    await admin.tables.updateRow({
      databaseId: APPWRITE_DATABASE_ID,
      tableId: tableId("profiles"),
      rowId: profile.$id,
      data: { credits_balance: newBalance },
      transactionId: transaction.$id,
    });
    await admin.tables.createRow({
      databaseId: APPWRITE_DATABASE_ID,
      tableId: tableId("requests"),
      rowId: requestId,
      data: {
        user_id: args.userId,
        youtube_url: args.youtubeUrl,
        status: "pending",
        total_credits: args.totalCredits,
        input_data: jsonColumn(args.inputData),
        idempotency_key: args.idempotencyKey,
        created_at: new Date().toISOString(),
        worker_stage: "prepare",
        worker_cursor: 0,
      },
      permissions: userRowPermissions(args.userId),
      transactionId: transaction.$id,
    });
    await admin.tables.createRow({
      databaseId: APPWRITE_DATABASE_ID,
      tableId: tableId("creditTransactions"),
      rowId: ID.unique(),
      data: {
        user_id: args.userId,
        delta: -args.totalCredits,
        reason: "content_generation",
        balance_after: newBalance,
        request_id: requestId,
        job_item_id: null,
      },
      permissions: userRowPermissions(args.userId),
      transactionId: transaction.$id,
    });
    for (const [index, item] of args.jobItems.entries()) {
      await admin.tables.createRow({
        databaseId: APPWRITE_DATABASE_ID,
        tableId: tableId("jobItems"),
        rowId: jobItemIds[index],
        data: {
          request_id: requestId,
          user_id: args.userId,
          job_type: item.job_type,
          status: "pending",
          credits_cost: item.credits_cost,
          platform: item.platform ?? null,
          style: item.style ?? null,
          input_data: jsonColumn(item.input_data),
          output_data: null,
          output_file_ids: [],
          error_message: null,
        },
        permissions: userRowPermissions(args.userId),
        transactionId: transaction.$id,
      });
    }
    await admin.tables.updateTransaction({
      transactionId: transaction.$id,
      commit: true,
    });
  } catch (error) {
    await admin.tables.updateTransaction({
      transactionId: transaction.$id,
      rollback: true,
    }).catch(() => undefined);
    throw error;
  }

  return {
    request_id: requestId,
    job_item_ids: jobItemIds,
    credits_deducted: args.totalCredits,
    balance_after: newBalance,
    already_exists: false,
  };
}

export function rowToLegacy(row: AppwriteRow) {
  const jsonFields = ["input_data", "output_data", "error_data", "refund_data"];
  const parsed = { ...row };
  for (const field of jsonFields) {
    if (typeof parsed[field] === "string") {
      try { parsed[field] = JSON.parse(parsed[field] as string); } catch { /* keep malformed legacy data */ }
    }
  }
  return {
    ...parsed,
    id: row.$id,
    created_at: row.$createdAt,
    updated_at: row.$updatedAt,
    output_refs: Array.isArray(parsed.output_file_ids)
      ? parsed.output_file_ids.map((id) => `/api/media/${id}`)
      : parsed.output_refs,
  };
}

export async function failRequestAndRefund(requestId: string, userId: string, message: string) {
  const admin = createAdminClient();
  const jobs = await listRows<JobItemRow>("jobItems", [
    Query.equal("request_id", requestId),
    Query.equal("user_id", userId),
    Query.limit(MAX_TRANSACTION_JOB_ITEMS),
  ]);
  const refundable = jobs.rows.filter((job) => job.status !== "completed" && !job.refunded_at);
  if (refundable.length === 0) return;
  const profile = await findOne<ProfileRow>("profiles", [Query.equal("user_id", userId)]);
  if (!profile) throw new Error("Profile not found for refund.");
  const refundAmount = refundable.reduce((total, job) => total + Number(job.credits_cost || 0), 0);
  const transaction = await admin.tables.createTransaction({ ttl: 60 });
  try {
    await admin.tables.updateRow({
      databaseId: APPWRITE_DATABASE_ID,
      tableId: tableId("profiles"),
      rowId: profile.$id,
      data: { credits_balance: profile.credits_balance + refundAmount },
      transactionId: transaction.$id,
    });
    for (const job of refundable) {
      await admin.tables.updateRow({
        databaseId: APPWRITE_DATABASE_ID,
        tableId: tableId("jobItems"),
        rowId: job.$id,
        data: {
          status: "failed",
          error_message: message,
          refunded_at: new Date().toISOString(),
        },
        transactionId: transaction.$id,
      });
    }
    await admin.tables.createRow({
      databaseId: APPWRITE_DATABASE_ID,
      tableId: tableId("creditTransactions"),
      rowId: ID.unique(),
      data: {
        user_id: userId,
        delta: refundAmount,
        reason: "job_refund",
        balance_after: profile.credits_balance + refundAmount,
        request_id: requestId,
        job_item_id: null,
      },
      permissions: userRowPermissions(userId),
      transactionId: transaction.$id,
    });
    await admin.tables.updateRow({
      databaseId: APPWRITE_DATABASE_ID,
      tableId: tableId("requests"),
      rowId: requestId,
      data: { status: "failed" },
      transactionId: transaction.$id,
    });
    await admin.tables.updateTransaction({ transactionId: transaction.$id, commit: true });
  } catch (error) {
    await admin.tables.updateTransaction({ transactionId: transaction.$id, rollback: true }).catch(() => undefined);
    throw error;
  }
}
