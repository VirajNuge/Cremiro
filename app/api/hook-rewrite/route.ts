/**
 * POST /api/hook-rewrite
 *
 * Uses Gemini 2.5 Pro to rewrite the opening hook of a video transcript
 * for maximum virality. Returns 1–3 alternative opening sentences.
 *
 * Body: { transcript_snippet: string }   — first ~3s of words joined as text
 * Response: { suggestions: string[] }
 *
 * Security: requires authenticated user session.
 */
import { NextRequest, NextResponse } from "next/server";
import { getCurrentAccount } from "@/lib/appwrite/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

export async function POST(request: NextRequest) {
  try {
    return await handleHookRewrite(request);
  } catch (err) {
    console.error("[hook-rewrite] unhandled error:", err);
    return NextResponse.json(
      { error: "An unexpected error occurred. Please try again." },
      { status: 500 }
    );
  }
}

async function handleHookRewrite(request: NextRequest) {
  // ── Auth ─────────────────────────────────────────────────────────
  const user = await getCurrentAccount();
  if (!user) {
    return NextResponse.json(
      { error: "You must be logged in to use the Hook Rewriter." },
      { status: 401 }
    );
  }

  // ── Parse body ───────────────────────────────────────────────────
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const raw = body as Record<string, unknown>;
  const snippet =
    typeof raw.transcript_snippet === "string"
      ? raw.transcript_snippet.trim()
      : "";

  if (!snippet || snippet.length < 5) {
    return NextResponse.json(
      { error: "transcript_snippet must be at least 5 characters." },
      { status: 400 }
    );
  }

  if (snippet.length > 1000) {
    return NextResponse.json(
      { error: "transcript_snippet must be 1000 characters or fewer." },
      { status: 400 }
    );
  }

  // ── Gemini call ──────────────────────────────────────────────────
  const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY ?? process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error("[hook-rewrite] GEMINI_API_KEY not configured");
    return NextResponse.json(
      { error: "Hook Rewriter is temporarily unavailable." },
      { status: 503 }
    );
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: "gemini-2.5-pro" });

  const prompt = `You are a viral short-form video editor specializing in TikTok and Instagram Reels hooks.

The user's current opening line is:
"${snippet}"

Rewrite this as 3 alternative opening hooks that:
- Start with a provocative question, shocking stat, or bold claim
- Are concise (under 15 words each)  
- Create immediate curiosity or FOMO
- Sound natural when spoken aloud

Return ONLY a JSON array of 3 strings, no explanation, no markdown:
["hook 1", "hook 2", "hook 3"]`;

  let suggestions: string[] = [];
  try {
    const result = await model.generateContent(prompt);
    const text = result.response.text().trim();

    // Strip markdown code fences if present
    const cleaned = text.replace(/^```[a-z]*\n?/i, "").replace(/\n?```$/i, "").trim();

    const parsed = JSON.parse(cleaned);
    if (
      Array.isArray(parsed) &&
      parsed.every((s): s is string => typeof s === "string")
    ) {
      suggestions = parsed.slice(0, 3);
    } else {
      throw new Error("Unexpected response shape from Gemini");
    }
  } catch (err) {
    console.error("[hook-rewrite] Gemini error:", err);
    return NextResponse.json(
      { error: "Hook Rewriter failed. Please try again." },
      { status: 502 }
    );
  }

  return NextResponse.json({ suggestions });
}
