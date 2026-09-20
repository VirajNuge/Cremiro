import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { Query } from "node-appwrite";
import { APPWRITE_CONTENT_WORKER_FUNCTION_ID } from "@/lib/appwrite/config";
import { createRequestTransaction, failRequestAndRefund, listRows } from "@/lib/appwrite/data";
import { createAdminClient, getCurrentAccount } from "@/lib/appwrite/server";
import type { RequestRow } from "@/lib/appwrite/types";
import { sanitizeString, validateGenerateRequest } from "@/lib/validation";

const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 10;
const MAX_CONCURRENT_REQUESTS = 3;
const CREDIT_COSTS: Record<string, number> = { viral_clip: 1, social_text: 0, blog_post: 5, ai_image: 5 };
const ipAttempts = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(ip: string) {
  const now = Date.now();
  const record = ipAttempts.get(ip);
  if (!record || record.resetAt < now) {
    ipAttempts.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return true;
  }
  if (record.count >= RATE_LIMIT_MAX) return false;
  record.count += 1;
  return true;
}

export async function POST(request: NextRequest) {
  try {
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
    if (!checkRateLimit(ip)) return NextResponse.json({ error: "Too many requests. Please try again later." }, { status: 429 });
    const user = await getCurrentAccount();
    if (!user) return NextResponse.json({ error: "You must be logged in to generate content." }, { status: 401 });
    const raw = (await request.json()) as Record<string, unknown>;
    const validation = validateGenerateRequest(raw);
    if (!validation.ok) return NextResponse.json({ error: validation.message }, { status: 400 });
    const { youtubeUrl, videoId, items, totalCredits } = validation.data!;

    const active = await listRows<RequestRow>("requests", [
      Query.equal("user_id", user.$id),
      Query.equal("status", ["pending", "processing"]),
      Query.limit(MAX_CONCURRENT_REQUESTS + 1),
    ]);
    const recent = active.rows.filter((row) => !row.$createdAt || Date.now() - new Date(row.$createdAt).getTime() < 30 * 60 * 1000);
    if (recent.length >= MAX_CONCURRENT_REQUESTS) {
      return NextResponse.json({ error: `You can have at most ${MAX_CONCURRENT_REQUESTS} active requests. Please wait for current jobs to finish.` }, { status: 429 });
    }

    const jobItemsPayload: Array<{ job_type: string; credits_cost: number; platform: string | null; style: string | null; input_data: Record<string, unknown> }> = [];
    for (const item of items) {
      const creditPerUnit = CREDIT_COSTS[item.job_type] ?? 0;
      if (item.job_type === "viral_clip" && item.platforms) {
        const styles = Array.isArray(item.styles) && item.styles.length ? item.styles : [item.style ?? "minimalist"];
        for (const platform of item.platforms) {
          for (let styleIndex = 0; styleIndex < styles.length; styleIndex++) {
            for (let clipIndex = 0; clipIndex < item.quantity; clipIndex++) {
              jobItemsPayload.push({
                job_type: item.job_type,
                credits_cost: styleIndex === 0 ? creditPerUnit : 0,
                platform,
                style: styles[styleIndex],
                input_data: { video_id: videoId, clip_index: clipIndex },
              });
            }
          }
        }
      } else {
        for (let index = 0; index < item.quantity; index++) {
          jobItemsPayload.push({ job_type: item.job_type, credits_cost: creditPerUnit, platform: null, style: null, input_data: { video_id: videoId } });
        }
      }
    }

    const idempotencyKey = typeof raw.idempotency_key === "string" && raw.idempotency_key.length > 0 ? sanitizeString(raw.idempotency_key) : crypto.randomUUID();
    const created = await createRequestTransaction({
      userId: user.$id,
      youtubeUrl,
      totalCredits,
      inputData: { video_id: videoId, items, style: items.find((item) => item.job_type === "viral_clip")?.style ?? null },
      jobItems: jobItemsPayload,
      idempotencyKey,
    });
    if (created.already_exists) return NextResponse.json({ success: true, request_id: created.request_id, message: "Request already submitted." });

    try {
      await createAdminClient().functions.createExecution({
        functionId: APPWRITE_CONTENT_WORKER_FUNCTION_ID,
        body: JSON.stringify({ request_id: created.request_id }),
        async: true,
      });
    } catch (error) {
      console.error("[generate] Appwrite worker dispatch failed", error instanceof Error ? error.name : "unknown");
      await failRequestAndRefund(created.request_id, user.$id, "Failed to start processing. Credits have been refunded.").catch(() => undefined);
      return NextResponse.json({ error: "Failed to start processing. Credits have been refunded." }, { status: 502 });
    }

    return NextResponse.json({ success: true, request_id: created.request_id, job_item_ids: created.job_item_ids, credits_deducted: totalCredits, balance_after: created.balance_after });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message.includes("Insufficient credits")) return NextResponse.json({ error: "Insufficient credits. Please purchase more credits to continue." }, { status: 400 });
    if (message.includes("at most 95")) return NextResponse.json({ error: message }, { status: 400 });
    console.error("[generate] request failed", error instanceof Error ? error.name : "unknown");
    return NextResponse.json({ error: "An unexpected error occurred. Please try again." }, { status: 500 });
  }
}
