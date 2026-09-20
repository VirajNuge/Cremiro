import { NextRequest, NextResponse } from "next/server";
import { APPWRITE_CONTENT_WORKER_FUNCTION_ID } from "@/lib/appwrite/config";
import { getRow } from "@/lib/appwrite/data";
import { createAdminClient, getCurrentAccount } from "@/lib/appwrite/server";
import type { JobItemRow } from "@/lib/appwrite/types";

export async function POST(request: NextRequest) {
  const user = await getCurrentAccount();
  if (!user) return NextResponse.json({ error: "You must be logged in to export clips." }, { status: 401 });
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const jobItemId = typeof body.job_item_id === "string" ? body.job_item_id : "";
    const words = Array.isArray(body.words) ? body.words : [];
    if (!jobItemId || !words.length) return NextResponse.json({ error: "job_item_id and words are required." }, { status: 400 });
    const job = await getRow<JobItemRow>("jobItems", jobItemId);
    if (job.user_id !== user.$id || job.job_type !== "viral_clip") return NextResponse.json({ error: "Job item not found." }, { status: 404 });
    const fileId = job.output_file_ids?.[0];
    if (!fileId) return NextResponse.json({ error: "Clip has not finished rendering yet." }, { status: 409 });

    const admin = createAdminClient();
    const currentInput = typeof job.input_data === "string"
      ? JSON.parse(job.input_data)
      : job.input_data;
    await admin.tables.updateRow({
      databaseId: process.env.APPWRITE_DATABASE_ID || "cremiro",
      tableId: process.env.APPWRITE_JOB_ITEMS_TABLE_ID || "job_items",
      rowId: jobItemId,
      data: {
        input_data: {
          ...(currentInput && typeof currentInput === "object" ? currentInput : {}),
          export_words: words,
          export_style_config: body.style_config ?? null,
          export_headline_overlay: body.headline_overlay ?? null,
          export_source_file_id: fileId,
        },
      },
    });
    await admin.functions.createExecution({
      functionId: APPWRITE_CONTENT_WORKER_FUNCTION_ID,
      body: JSON.stringify({ stage: "export", job_item_id: jobItemId }),
      async: true,
    });

    // The clean output remains immediately downloadable while the optional burn-in
    // render runs. The worker replaces output_file_ids when the render completes.
    return NextResponse.json({ download_url: `/api/media/${fileId}` });
  } catch {
    return NextResponse.json({ error: "Export failed. Please try again." }, { status: 500 });
  }
}
