import { NextResponse } from "next/server";
import { Query } from "node-appwrite";
import { failRequestAndRefund, listRows } from "@/lib/appwrite/data";
import type { RequestRow } from "@/lib/appwrite/types";

export async function POST(request: Request) {
  if (!process.env.APPWRITE_API_KEY || request.headers.get("x-appwrite-key") !== process.env.APPWRITE_API_KEY) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const cutoff = Date.now() - 30 * 60 * 1000;
  const rows = await listRows<RequestRow>("requests", [Query.equal("status", ["pending", "processing"]), Query.limit(100)]);
  let refunded = 0;
  for (const row of rows.rows) {
    if (row.$createdAt && new Date(row.$createdAt).getTime() < cutoff) {
      await failRequestAndRefund(row.$id, row.user_id, "Job timed out. Credits have been refunded.").catch(() => undefined);
      refunded += 1;
    }
  }
  return NextResponse.json({ ok: true, stale_requests: refunded });
}
