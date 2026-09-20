import { NextRequest, NextResponse } from "next/server";
import { Query } from "node-appwrite";
import { getCurrentAccount } from "@/lib/appwrite/server";
import { listRows, rowToLegacy, tableId } from "@/lib/appwrite/data";
import { APPWRITE_DATABASE_ID } from "@/lib/appwrite/config";
import { createAdminClient } from "@/lib/appwrite/server";

const TABLES = new Set(["profiles", "requests", "job_items", "credit_transactions"]);
const TABLE_KEYS = {
  profiles: "profiles",
  requests: "requests",
  job_items: "jobItems",
  credit_transactions: "creditTransactions",
} as const;

function normalizeFilters(raw: unknown) {
  if (!Array.isArray(raw)) return [];
  return raw.filter((item): item is { field: string; values: unknown[] } =>
    !!item && typeof item === "object" &&
    typeof (item as { field?: unknown }).field === "string" &&
    Array.isArray((item as { values?: unknown }).values)
  );
}

function toQueries(filters: Array<{ field: string; values: unknown[] }>) {
  return filters.map((filter) => Query.equal(filter.field, filter.values));
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ table: string }> },
) {
  const { table } = await params;
  if (!TABLES.has(table)) return NextResponse.json({ error: "Unknown table" }, { status: 404 });

  const account = await getCurrentAccount();
  if (!account) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const filters = normalizeFilters(JSON.parse(request.nextUrl.searchParams.get("filters") || "[]"));
  const userScoped = ["profiles", "requests", "job_items", "credit_transactions"].includes(table);
  const userField = table === "profiles" ? "user_id" : "user_id";
  if (userScoped) filters.push({ field: userField, values: [account.$id] });

  try {
    const result = await listRows(TABLE_KEYS[table as keyof typeof TABLE_KEYS], [
      ...toQueries(filters),
      Query.limit(100),
    ]);
    const rows = result.rows.map((row) => rowToLegacy(row) as Record<string, unknown>);

    if (table === "job_items" && request.nextUrl.searchParams.get("select")?.includes("requests")) {
      const { tables } = createAdminClient();
      for (const row of rows) {
        const requestRow = await tables.getRow({
          databaseId: APPWRITE_DATABASE_ID,
          tableId: tableId("requests"),
          rowId: String(row.request_id),
        }).catch(() => null);
        row.requests = requestRow ? { user_id: requestRow.user_id } : null;
      }
    }

    return NextResponse.json({ data: rows, error: null });
  } catch (error) {
    console.error("[appwrite/data] list failed", error);
    return NextResponse.json({ data: [], error: "Unable to load data." }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ table: string }> },
) {
  const { table } = await params;
  if (table !== "job_items") return NextResponse.json({ error: "Updates are not allowed" }, { status: 405 });

  const account = await getCurrentAccount();
  if (!account) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => null) as {
    filters?: unknown;
    data?: Record<string, unknown>;
  } | null;
  const filters = normalizeFilters(body?.filters);
  const idFilter = filters.find((filter) => filter.field === "id" || filter.field === "$id");
  const rowId = idFilter?.values[0];
  if (typeof rowId !== "string" || !body?.data) {
    return NextResponse.json({ error: "A job item ID and update data are required." }, { status: 400 });
  }

  try {
    const { tables } = createAdminClient();
    const existing = await tables.getRow({
      databaseId: APPWRITE_DATABASE_ID,
      tableId: tableId("jobItems"),
      rowId,
    });
    if (existing.user_id !== account.$id) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const allowed = { output_data: JSON.stringify(body.data.output_data ?? {}) };
    const updated = await tables.updateRow({
      databaseId: APPWRITE_DATABASE_ID,
      tableId: tableId("jobItems"),
      rowId,
      data: allowed,
    });
    return NextResponse.json({ data: rowToLegacy(updated), error: null });
  } catch (error) {
    console.error("[appwrite/data] update failed", error);
    return NextResponse.json({ error: "Unable to update data." }, { status: 500 });
  }
}
