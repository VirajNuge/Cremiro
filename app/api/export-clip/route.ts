/**
 * POST /api/export-clip
 *
 * Burns edited subtitle words into the clip video using the Modal worker.
 * Returns a signed download URL for the final exported video.
 *
 * Flow:
 *   1. Authenticate the user
 *   2. Validate body: { job_item_id, words }
 *   3. Fetch the job item (verify ownership + get output_refs)
 *   4. Forward to worker /export-clip endpoint
 *   5. Return { download_url } from worker
 *
 * Security:
 *   - Server-side only — WORKER_URL / WORKER_WEBHOOK_SECRET never exposed
 *   - Ownership check: job item must belong to the authenticated user's requests
 *   - HMAC-signed dispatch (same contract as /api/generate)
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import crypto from "crypto";

// Matches SubtitleOverlay.tsx WordEntry
interface WordEntry {
  text: string;
  start: number;
  end: number;
  emoji?: string;
  highlight?: boolean;
}

interface StyleConfig {
  /** 0–1 fraction; overrides the style's default vertical subtitle position */
  y_position?: number;
  font?: string;
  primary_color?: string;
}

interface HeadlineOverlay {
  /** Text to burn at the top of the video (e.g. "STOP SCROLLING") */
  text: string;
  /** 0–1 fraction from top; default 0.08 */
  y_position?: number;
}

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(request: NextRequest) {
  try {
    return await handleExportClip(request);
  } catch (err) {
    console.error("[export-clip] unhandled error:", err);
    return NextResponse.json(
      { error: "An unexpected error occurred. Please try again." },
      { status: 500 }
    );
  }
}

async function handleExportClip(request: NextRequest) {
  // ── Authentication ──────────────────────────────────────────────
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json(
      { error: "You must be logged in to export clips." },
      { status: 401 }
    );
  }

  // ── Parse body ───────────────────────────────────────────────────
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  if (typeof body !== "object" || body === null) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const raw = body as Record<string, unknown>;

  // ── Validate job_item_id ─────────────────────────────────────────
  const jobItemId =
    typeof raw.job_item_id === "string" ? raw.job_item_id.trim() : "";
  if (!jobItemId || !UUID_REGEX.test(jobItemId)) {
    return NextResponse.json(
      { error: "Invalid or missing job_item_id." },
      { status: 400 }
    );
  }

  // ── Validate words[] ─────────────────────────────────────────────
  if (!Array.isArray(raw.words) || raw.words.length === 0) {
    return NextResponse.json(
      { error: "words must be a non-empty array." },
      { status: 400 }
    );
  }

  const words = raw.words as WordEntry[];
  for (const w of words) {
    if (
      typeof w.text !== "string" ||
      typeof w.start !== "number" ||
      typeof w.end !== "number"
    ) {
      return NextResponse.json(
        { error: "Each word must have text (string), start (number), end (number)." },
        { status: 400 }
      );
    }
  }

  // ── Optional style_config ─────────────────────────────────────────
  let styleConfig: StyleConfig | undefined;
  if (raw.style_config !== undefined && raw.style_config !== null) {
    if (typeof raw.style_config !== "object" || Array.isArray(raw.style_config)) {
      return NextResponse.json({ error: "style_config must be an object." }, { status: 400 });
    }
    const sc = raw.style_config as Record<string, unknown>;
    if (sc.y_position !== undefined) {
      const yp = Number(sc.y_position);
      if (isNaN(yp) || yp < 0 || yp > 1) {
        return NextResponse.json(
          { error: "style_config.y_position must be a number between 0 and 1." },
          { status: 400 }
        );
      }
    }
    styleConfig = sc as StyleConfig;
  }

  // ── Optional headline_overlay ──────────────────────────────────────
  let headlineOverlay: HeadlineOverlay | undefined;
  if (raw.headline_overlay !== undefined && raw.headline_overlay !== null) {
    if (typeof raw.headline_overlay !== "object" || Array.isArray(raw.headline_overlay)) {
      return NextResponse.json({ error: "headline_overlay must be an object." }, { status: 400 });
    }
    const ho = raw.headline_overlay as Record<string, unknown>;
    if (typeof ho.text !== "string" || ho.text.trim() === "") {
      return NextResponse.json(
        { error: "headline_overlay.text must be a non-empty string." },
        { status: 400 }
      );
    }
    if (ho.text.toString().length > 200) {
      return NextResponse.json(
        { error: "headline_overlay.text must be 200 characters or fewer." },
        { status: 400 }
      );
    }
    if (ho.y_position !== undefined) {
      const yp = Number(ho.y_position);
      if (isNaN(yp) || yp < 0 || yp > 1) {
        return NextResponse.json(
          { error: "headline_overlay.y_position must be a number between 0 and 1." },
          { status: 400 }
        );
      }
    }
    headlineOverlay = { text: String(ho.text).trim(), y_position: ho.y_position !== undefined ? Number(ho.y_position) : undefined };
  }

  // ── Fetch job item + verify ownership ────────────────────────────
  const admin = getSupabaseAdmin();

  const { data: jobItem, error: jobError } = await admin
    .from("job_items")
    .select(
      "id, output_refs, output_data, job_type, request_id, requests!inner(user_id)"
    )
    .eq("id", jobItemId)
    .single();

  if (jobError || !jobItem) {
    return NextResponse.json({ error: "Job item not found." }, { status: 404 });
  }

  // Type the joined data safely
  const jobItemTyped = jobItem as {
    id: string;
    output_refs: string[] | null;
    output_data: Record<string, unknown> | null;
    job_type: string;
    request_id: string;
    requests: { user_id: string } | { user_id: string }[];
  };

  // Normalize the joined requests row (could be object or array depending on Supabase client)
  const requestOwner = Array.isArray(jobItemTyped.requests)
    ? jobItemTyped.requests[0]
    : jobItemTyped.requests;

  if (!requestOwner || requestOwner.user_id !== user.id) {
    return NextResponse.json({ error: "Job item not found." }, { status: 404 });
  }

  if (jobItemTyped.job_type !== "viral_clip") {
    return NextResponse.json(
      { error: "Only viral_clip job items support subtitle export." },
      { status: 400 }
    );
  }

  const outputRefs = jobItemTyped.output_refs;
  if (!outputRefs || outputRefs.length === 0) {
    return NextResponse.json(
      { error: "Clip has not finished rendering yet. Please wait for the job to complete." },
      { status: 409 }
    );
  }

  // Use the first output ref as the clean source video URL
  const videoUrl = outputRefs[0];

  // ── Dispatch to worker ───────────────────────────────────────────
  const workerUrl = process.env.WORKER_URL;
  const webhookSecret = process.env.WORKER_WEBHOOK_SECRET;

  if (!workerUrl || !webhookSecret) {
    console.error("[export-clip] WORKER_URL or WORKER_WEBHOOK_SECRET not configured");
    return NextResponse.json(
      { error: "Service temporarily unavailable. Please try again later." },
      { status: 503 }
    );
  }

  const dispatchPayload = {
    job_item_id: jobItemId,
    words,
    video_url: videoUrl,
    ...(styleConfig !== undefined ? { style_config: styleConfig } : {}),
    ...(headlineOverlay !== undefined ? { headline_overlay: headlineOverlay } : {}),
  };

  const timestamp = Math.floor(Date.now() / 1000).toString();
  const nonce = crypto.randomUUID();
  const signaturePayload = `${timestamp}.${nonce}.${JSON.stringify(dispatchPayload)}`;
  const signature = crypto
    .createHmac("sha256", webhookSecret)
    .update(signaturePayload)
    .digest("hex");

  let workerData: { download_url?: string; error?: string };
  try {
    const workerResponse = await fetch(`${workerUrl}/export-clip`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-signature": signature,
        "x-timestamp": timestamp,
        "x-nonce": nonce,
      },
      body: JSON.stringify(dispatchPayload),
      signal: AbortSignal.timeout(300_000), // 5 min — FFmpeg burn-in can take time
    });

    if (!workerResponse.ok) {
      const errorText = await workerResponse.text().catch(() => "Unknown error");
      console.error(
        "[export-clip] worker returned error:",
        workerResponse.status,
        errorText
      );
      return NextResponse.json(
        { error: "Export failed. Please try again." },
        { status: 502 }
      );
    }

    workerData = (await workerResponse.json()) as {
      download_url?: string;
      error?: string;
    };
  } catch (fetchError) {
    console.error("[export-clip] worker fetch error:", fetchError);
    return NextResponse.json(
      { error: "Export service unreachable. Please try again later." },
      { status: 502 }
    );
  }

  if (workerData.error || !workerData.download_url) {
    console.error("[export-clip] worker error response:", workerData.error);
    return NextResponse.json(
      { error: workerData.error ?? "Export failed." },
      { status: 500 }
    );
  }

  return NextResponse.json({ download_url: workerData.download_url });
}
