import { NextRequest, NextResponse } from "next/server";
import { Query } from "node-appwrite";
import { APPWRITE_MEDIA_BUCKET_ID } from "@/lib/appwrite/config";
import { listRows } from "@/lib/appwrite/data";
import { createAdminClient, getCurrentAccount } from "@/lib/appwrite/server";
import type { JobItemRow } from "@/lib/appwrite/types";

export async function GET(_request: NextRequest, context: { params: Promise<{ fileId: string }> }) {
  const account = await getCurrentAccount();
  if (!account) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { fileId } = await context.params;
  const jobs = await listRows<JobItemRow>("jobItems", [
    Query.equal("user_id", account.$id),
    Query.limit(100),
  ]);
  const ownsFile = jobs.rows.some((job) => Array.isArray(job.output_file_ids) && job.output_file_ids.includes(fileId));
  if (!ownsFile) return NextResponse.json({ error: "Not found" }, { status: 404 });

  try {
    const admin = createAdminClient();
    const [file, body] = await Promise.all([
      admin.storage.getFile({ bucketId: APPWRITE_MEDIA_BUCKET_ID, fileId }),
      admin.storage.getFileView({ bucketId: APPWRITE_MEDIA_BUCKET_ID, fileId }),
    ]);
    return new NextResponse(body, {
      headers: {
        "Content-Type": file.mimeType || "application/octet-stream",
        "Content-Length": String(body.byteLength),
        "Cache-Control": "private, max-age=60",
        "Content-Disposition": `inline; filename="${file.name.replace(/[\r\n\"]/g, "_")}"`,
      },
    });
  } catch {
    return NextResponse.json({ error: "Media is unavailable" }, { status: 404 });
  }
}
