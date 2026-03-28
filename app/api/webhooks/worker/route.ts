/**
 * POST /api/webhooks/worker
 *
 * Receives status updates from the worker service. Responsibilities:
 * 1. Verify HMAC-SHA256 signature with timestamp replay protection
 * 2. Update job item status via RPC (enforces valid state transitions)
 * 3. Auto-refund on failure is handled by the RPC function
 *
 * Security measures:
 * - HMAC-SHA256 signature verification (shared secret)
 * - Timestamp replay protection (5-minute window)
 * - Nonce included in signature to prevent replay
 * - Only accepts status updates for valid job items
 * - Generic error responses
 * - No Supabase service role key exposed to worker
 */
import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import crypto from "crypto";

// ── Constants ──────────────────────────────────────────────────────
const TIMESTAMP_TOLERANCE_SECONDS = 300; // 5 minutes
const VALID_STATUSES = ["processing", "completed", "failed"] as const;

export async function POST(request: NextRequest) {
  try {
    return await handleWebhook(request);
  } catch (err) {
    console.error("[webhook/worker] unhandled error:", err);
    return NextResponse.json(
      { error: "Internal server error." },
      { status: 500 }
    );
  }
}

async function handleWebhook(request: NextRequest) {
  // ── Verify HMAC signature ──
  const webhookSecret = process.env.WORKER_WEBHOOK_SECRET;
  if (!webhookSecret) {
    console.error("[webhook/worker] WORKER_WEBHOOK_SECRET not configured");
    return NextResponse.json(
      { error: "Webhook not configured." },
      { status: 500 }
    );
  }

  const signature = request.headers.get("x-signature");
  const timestamp = request.headers.get("x-timestamp");
  const nonce = request.headers.get("x-nonce");

  if (!signature || !timestamp || !nonce) {
    return NextResponse.json(
      { error: "Missing authentication headers." },
      { status: 401 }
    );
  }

  // ── Timestamp replay protection ──
  const requestTimestamp = parseInt(timestamp, 10);
  if (isNaN(requestTimestamp)) {
    return NextResponse.json(
      { error: "Invalid timestamp." },
      { status: 401 }
    );
  }

  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - requestTimestamp) > TIMESTAMP_TOLERANCE_SECONDS) {
    return NextResponse.json(
      { error: "Request expired." },
      { status: 401 }
    );
  }

  // ── Parse body ──
  let rawBody: string;
  try {
    rawBody = await request.text();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  // ── Verify signature ──
  const signaturePayload = `${timestamp}.${nonce}.${rawBody}`;
  const expectedSignature = crypto
    .createHmac("sha256", webhookSecret)
    .update(signaturePayload)
    .digest("hex");

  const signatureBuffer = Buffer.from(signature, "hex");
  const expectedBuffer = Buffer.from(expectedSignature, "hex");

  if (
    signatureBuffer.length !== expectedBuffer.length ||
    !crypto.timingSafeEqual(signatureBuffer, expectedBuffer)
  ) {
    return NextResponse.json(
      { error: "Invalid signature." },
      { status: 401 }
    );
  }

  // ── Parse verified body ──
  let body: unknown;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  if (typeof body !== "object" || body === null) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const payload = body as Record<string, unknown>;

  // ── Validate payload ──
  const jobItemId = typeof payload.job_item_id === "string" ? payload.job_item_id : "";
  const status = typeof payload.status === "string" ? payload.status : "";

  if (!jobItemId) {
    return NextResponse.json(
      { error: "Missing job_item_id." },
      { status: 400 }
    );
  }

  // Validate UUID format
  const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!UUID_REGEX.test(jobItemId)) {
    return NextResponse.json(
      { error: "Invalid job_item_id format." },
      { status: 400 }
    );
  }

  if (!VALID_STATUSES.includes(status as typeof VALID_STATUSES[number])) {
    return NextResponse.json(
      { error: `Invalid status. Must be one of: ${VALID_STATUSES.join(", ")}` },
      { status: 400 }
    );
  }

  // Optional fields
  const outputData =
    typeof payload.output_data === "object" && payload.output_data !== null
      ? payload.output_data
      : null;

  const outputRefs = Array.isArray(payload.output_refs)
    ? payload.output_refs.filter((r): r is string => typeof r === "string")
    : null;

  const errorMessage =
    typeof payload.error_message === "string" ? payload.error_message : null;

  // ── Update via RPC ──
  const admin = getSupabaseAdmin();

  const { data: rpcResult, error: rpcError } = await admin.rpc(
    "update_job_item_status",
    {
      p_job_item_id: jobItemId,
      p_status: status,
      p_output_data: outputData,
      p_output_refs: outputRefs,
      p_error_message: errorMessage,
    }
  );

  if (rpcError) {
    console.error("[webhook/worker] RPC error:", rpcError.message);

    // Handle specific errors
    if (rpcError.message.includes("not found")) {
      return NextResponse.json(
        { error: "Job item not found." },
        { status: 404 }
      );
    }

    if (rpcError.message.includes("terminal state") || rpcError.message.includes("Invalid transition")) {
      return NextResponse.json(
        { error: "Invalid status transition." },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { error: "Failed to update job status." },
      { status: 500 }
    );
  }

  return NextResponse.json({
    success: true,
    job_item_id: jobItemId,
    status,
    request_status: rpcResult?.request_status,
  });
}
