/**
 * POST /api/generate
 *
 * Creates a content generation request. Responsibilities:
 * 1. Authenticate the user via session cookie
 * 2. Validate & sanitize inputs (YouTube URL, content types, platforms, style)
 * 3. Check user concurrency limits (max pending/processing requests)
 * 4. Atomically deduct credits and create request + job items via RPC
 * 5. Dispatch job items to the worker
 * 6. If worker dispatch fails, mark request as failed (triggers auto-refund via RPC)
 *
 * Security measures:
 * - Server-side only — no secrets exposed
 * - Input validation before any DB call
 * - Atomic credit deduction (FOR UPDATE row lock in RPC)
 * - Idempotency key to prevent double-charges on retries
 * - Per-IP rate limiting + per-user concurrency limiting
 * - Generic error messages
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { sanitizeString, validateGenerateRequest } from "@/lib/validation";
import crypto from "crypto";

// ── Rate limiting ──────────────────────────────────────────────────
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 10; // 10 generate requests per minute per IP
const ipAttempts = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const record = ipAttempts.get(ip);
  if (!record || record.resetAt < now) {
    ipAttempts.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return true;
  }
  if (record.count >= RATE_LIMIT_MAX) return false;
  record.count++;
  return true;
}

// ── Constants ──────────────────────────────────────────────────────
const MAX_CONCURRENT_REQUESTS = 3; // max pending/processing requests per user
const CREDIT_COSTS: Record<string, number> = {
  viral_clip: 1,
  social_text: 0,
  blog_post: 5,
  ai_image: 5,
};

export async function POST(request: NextRequest) {
  try {
    return await handleGenerate(request);
  } catch (err) {
    console.error("[generate] unhandled error:", err);
    return NextResponse.json(
      { error: "An unexpected error occurred. Please try again." },
      { status: 500 }
    );
  }
}

async function handleGenerate(request: NextRequest) {
  // ── Rate limiting ──
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    "unknown";

  if (!checkRateLimit(ip)) {
    return NextResponse.json(
      { error: "Too many requests. Please try again later." },
      { status: 429 }
    );
  }

  // ── Authentication ──
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json(
      { error: "You must be logged in to generate content." },
      { status: 401 }
    );
  }

  // ── Parse body ──
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

  // ── Validate ──
  const validation = validateGenerateRequest(raw);
  if (!validation.ok) {
    return NextResponse.json({ error: validation.message }, { status: 400 });
  }

  const { youtubeUrl, videoId, items, totalCredits } = validation.data!;

  // ── Concurrency check ──
  const admin = getSupabaseAdmin();

  // Only count requests created within the last 30 minutes to avoid
  // permanently-stuck rows (worker crash, missed callback, etc.) blocking new generations.
  const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();

  const { count: activeRequests, error: countError } = await admin
    .from("requests")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .in("status", ["pending", "processing"])
    .gte("created_at", thirtyMinutesAgo);

  if (countError) {
    console.error("[generate] concurrency check error:", countError.message);
    return NextResponse.json(
      { error: "An unexpected error occurred. Please try again." },
      { status: 500 }
    );
  }

  if ((activeRequests ?? 0) >= MAX_CONCURRENT_REQUESTS) {
    return NextResponse.json(
      { error: `You can have at most ${MAX_CONCURRENT_REQUESTS} active requests. Please wait for current jobs to finish.` },
      { status: 429 }
    );
  }

  // ── Build job items for RPC ──
  // Expand items with quantity > 1 into individual job items
  // For viral_clip: one job item per platform * quantity combination
  const jobItemsPayload: Array<{
    job_type: string;
    credits_cost: number;
    platform: string | null;
    style: string | null;
    input_data: Record<string, unknown>;
  }> = [];

  for (const item of items) {
    const creditPerUnit = CREDIT_COSTS[item.job_type] ?? 0;

    if (item.job_type === "viral_clip" && item.platforms) {
      // For clips: create one job item per clip per platform
      for (const platform of item.platforms) {
        for (let i = 0; i < item.quantity; i++) {
          jobItemsPayload.push({
            job_type: item.job_type,
            credits_cost: creditPerUnit,
            platform,
            style: item.style ?? "minimalist",
            input_data: { video_id: videoId, clip_index: i },
          });
        }
      }
    } else {
      // For non-clip types: one job item per quantity unit
      for (let i = 0; i < item.quantity; i++) {
        jobItemsPayload.push({
          job_type: item.job_type,
          credits_cost: creditPerUnit,
          platform: null,
          style: null,
          input_data: { video_id: videoId },
        });
      }
    }
  }

  // ── Generate idempotency key ──
  const idempotencyKey =
    typeof raw.idempotency_key === "string" && raw.idempotency_key.length > 0
      ? sanitizeString(raw.idempotency_key)
      : crypto.randomUUID();

  // ── Call RPC to atomically deduct credits and create request + job items ──
  const { data: rpcResult, error: rpcError } = await admin.rpc(
    "create_request_and_deduct",
    {
      p_user_id: user.id,
      p_youtube_url: youtubeUrl,
      p_total_credits: totalCredits,
      p_input_data: {
        video_id: videoId,
        items: items,
        style: items.find((i) => i.job_type === "viral_clip")?.style ?? null,
      },
      p_job_items: jobItemsPayload,
      p_idempotency_key: idempotencyKey,
    }
  );

  if (rpcError) {
    console.error("[generate] RPC error:", rpcError.message);

    // Handle specific RPC errors
    if (rpcError.message.includes("Insufficient credits")) {
      return NextResponse.json(
        { error: "Insufficient credits. Please purchase more credits to continue." },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: "An unexpected error occurred. Please try again." },
      { status: 500 }
    );
  }

  const requestId = rpcResult?.request_id;
  const jobItemIds: string[] = rpcResult?.job_item_ids ?? [];
  const alreadyExists = rpcResult?.already_exists ?? false;

  if (alreadyExists) {
    return NextResponse.json({
      success: true,
      request_id: requestId,
      message: "Request already submitted.",
    });
  }

  // ── Dispatch to worker ──
  const workerUrl = process.env.WORKER_URL;
  if (!workerUrl) {
    console.error("[generate] WORKER_URL not configured");
    // Mark all job items as failed (triggers auto-refund via RPC)
    for (const jobItemId of jobItemIds) {
      const { error: refundErr } = await admin.rpc("update_job_item_status", {
        p_job_item_id: jobItemId,
        p_status: "failed",
        p_error_message: "Worker service unavailable. Credits have been refunded.",
      });
      if (refundErr) {
        console.error("[generate] failed to mark job item as failed (refund may not have applied):", jobItemId, refundErr.message);
      }
    }
    return NextResponse.json(
      { error: "Service temporarily unavailable. Please try again later." },
      { status: 503 }
    );
  }

  // Sign the dispatch payload with HMAC for worker authentication
  const webhookSecret = process.env.WORKER_WEBHOOK_SECRET;
  if (!webhookSecret) {
    console.error("[generate] WORKER_WEBHOOK_SECRET not configured");
    for (const jobItemId of jobItemIds) {
      const { error: refundErr } = await admin.rpc("update_job_item_status", {
        p_job_item_id: jobItemId,
        p_status: "failed",
        p_error_message: "Worker service misconfigured. Credits have been refunded.",
      });
      if (refundErr) {
        console.error("[generate] failed to mark job item as failed (refund may not have applied):", jobItemId, refundErr.message);
      }
    }
    return NextResponse.json(
      { error: "Service temporarily unavailable. Please try again later." },
      { status: 503 }
    );
  }

  const dispatchPayload = {
    request_id: requestId,
    job_items: jobItemIds.map((id, i) => ({
      id,
      ...jobItemsPayload[i],
    })),
    youtube_url: youtubeUrl,
    video_id: videoId,
    callback_url: `${process.env.NEXT_PUBLIC_SITE_URL}/api/webhooks/worker`,
  };

  const timestamp = Math.floor(Date.now() / 1000).toString();
  const nonce = crypto.randomUUID();
  const signaturePayload = `${timestamp}.${nonce}.${JSON.stringify(dispatchPayload)}`;
  const signature = crypto
    .createHmac("sha256", webhookSecret)
    .update(signaturePayload)
    .digest("hex");

  try {
    const workerResponse = await fetch(`${workerUrl}/process`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Signature": signature,
        "X-Timestamp": timestamp,
        "X-Nonce": nonce,
      },
      body: JSON.stringify(dispatchPayload),
      signal: AbortSignal.timeout(10_000), // 10s timeout for dispatch
    });

    if (!workerResponse.ok) {
      const errorText = await workerResponse.text().catch(() => "Unknown error");
      console.error("[generate] worker dispatch failed:", workerResponse.status, errorText);

      // Mark all job items as failed (triggers auto-refund)
      for (const jobItemId of jobItemIds) {
        const { error: refundErr } = await admin.rpc("update_job_item_status", {
          p_job_item_id: jobItemId,
          p_status: "failed",
          p_error_message: "Failed to start processing. Credits have been refunded.",
        });
        if (refundErr) {
          console.error("[generate] failed to mark job item as failed (refund may not have applied):", jobItemId, refundErr.message);
        }
      }

      return NextResponse.json(
        { error: "Failed to start processing. Credits have been refunded." },
        { status: 502 }
      );
    }
  } catch (dispatchError) {
    console.error("[generate] worker dispatch error:", dispatchError);

    // Mark all job items as failed (triggers auto-refund)
    for (const jobItemId of jobItemIds) {
      const { error: refundErr } = await admin.rpc("update_job_item_status", {
        p_job_item_id: jobItemId,
        p_status: "failed",
        p_error_message: "Worker service unreachable. Credits have been refunded.",
      });
      if (refundErr) {
        console.error("[generate] failed to mark job item as failed (refund may not have applied):", jobItemId, refundErr.message);
      }
    }

    return NextResponse.json(
      { error: "Processing service unreachable. Credits have been refunded. Please try again later." },
      { status: 502 }
    );
  }

  return NextResponse.json({
    success: true,
    request_id: requestId,
    job_item_ids: jobItemIds,
    credits_deducted: totalCredits,
    balance_after: rpcResult?.balance_after,
  });
}
