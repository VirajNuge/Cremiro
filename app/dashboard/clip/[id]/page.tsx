"use client";

import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { useParams, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { createClient } from "@/lib/appwrite/client";
import { useAuth } from "@/contexts/AuthContext";
import SubtitleOverlay, {
  type WordEntry,
  type SubtitleStyle,
} from "@/app/components/SubtitleOverlay";
import TranscriptEditor from "@/app/components/TranscriptEditor";
import SafeZoneOverlay, {
  type SafeZonePlatform,
} from "@/app/components/SafeZoneOverlay";

// ─── Types ─────────────────────────────────────────────────────────────────────

interface ClipData {
  jobItemId: string;
  videoUrl: string;
  words: WordEntry[];
  style: SubtitleStyle;
  platform: string;
}

type ExportState = "idle" | "loading" | "done" | "error";

// ─── Hook-3s threshold ────────────────────────────────────────────────────────
const HOOK_SECONDS = 3.0;

// ─── Component ─────────────────────────────────────────────────────────────────

export default function ClipStudioPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const appwrite = useRef(createClient()).current;

  // ── Data loading ─────────────────────────────────────────────────────────────
  const [clip, setClip] = useState<ClipData | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    (async () => {
      const { data, error } = await appwrite
        .from("job_items")
        .select("id, output_refs, output_data, requests!inner(user_id)")
        .eq("id", id)
        .single();

      if (error || !data) {
        setLoadError("Clip not found.");
        return;
      }

      // Auth guard — only the owner can edit
      const ownerId = (data as any).requests?.user_id;
      if (user && ownerId && ownerId !== user.id) {
        setLoadError("You don't have permission to edit this clip.");
        return;
      }

      const outputData = (data as any).output_data ?? {};
      const clips = outputData.clips ?? [];
      const style: SubtitleStyle = clips[0]?.style ?? "minimalist";
      const words: WordEntry[] = (outputData.words ?? []).map((w: any) => ({
        text: w.text ?? "",
        start: w.start ?? 0,
        end: w.end ?? 0,
        highlight: w.highlight,
        emoji: w.emoji,
      }));
      const videoUrl: string = (data as any).output_refs?.[0] ?? "";

      setClip({
        jobItemId: id,
        videoUrl,
        words,
        style,
        platform: clips[0]?.platform ?? "tiktok",
      });
    })();
  }, [id, user]);

  // ── Editable state (soft-edit — no server roundtrip) ─────────────────────────
  const [words, setWords] = useState<WordEntry[]>([]);
  const [style, setStyle] = useState<SubtitleStyle>("minimalist");
  const [yPosition, setYPosition] = useState<number>(0.85);
  const [headlineText, setHeadlineText] = useState<string>("");
  const [headlineY] = useState<number>(0.08);
  const [safeZonePlatform, setSafeZonePlatform] = useState<SafeZonePlatform | null>(null);

  useEffect(() => {
    if (clip) {
      setWords(clip.words);
      setStyle(clip.style);
    }
  }, [clip]);

  // ── Video ref ─────────────────────────────────────────────────────────────────
  const videoRef = useRef<HTMLVideoElement>(null);

  // ── Hook Lab ──────────────────────────────────────────────────────────────────
  const [hookSuggestions, setHookSuggestions] = useState<string[]>([]);
  const [hookLoading, setHookLoading] = useState(false);
  const [hookError, setHookError] = useState<string | null>(null);

  const hookSnippet = words
    .filter((w) => w.start < HOOK_SECONDS)
    .map((w) => w.text)
    .join(" ");

  const rewriteHook = useCallback(async () => {
    if (!hookSnippet.trim()) return;
    setHookLoading(true);
    setHookError(null);
    setHookSuggestions([]);
    try {
      const res = await fetch("/api/hook-rewrite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transcript_snippet: hookSnippet }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Rewrite failed");
      setHookSuggestions(json.suggestions ?? []);
    } catch (e: any) {
      setHookError(e.message ?? "Unknown error");
    } finally {
      setHookLoading(false);
    }
  }, [hookSnippet]);

  const applyHookSuggestion = useCallback(
    (suggestion: string) => {
      // Replace words in the hook window (start < 3s) with the new suggestion tokens
      const suggestionWords = suggestion.split(/\s+/).filter(Boolean);
      const hookWords = words.filter((w) => w.start < HOOK_SECONDS);
      const rest = words.filter((w) => w.start >= HOOK_SECONDS);

      // Redistribute timing evenly across the original hook window
      const hookStart = hookWords[0]?.start ?? 0;
      const hookEnd = hookWords[hookWords.length - 1]?.end ?? HOOK_SECONDS;
      const hookDuration = hookEnd - hookStart;
      const perWord = hookDuration / Math.max(1, suggestionWords.length);

      const newHookWords: WordEntry[] = suggestionWords.map((text, i) => ({
        text,
        start: hookStart + i * perWord,
        end: hookStart + (i + 1) * perWord - 0.02,
        highlight: i < 3,
      }));

      setWords([...newHookWords, ...rest]);
      setHookSuggestions([]);
    },
    [words]
  );

  // ── Export ────────────────────────────────────────────────────────────────────
  const [exportState, setExportState] = useState<ExportState>("idle");
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);

  const handleExport = useCallback(async () => {
    if (!clip) return;
    setExportState("loading");
    setExportError(null);
    setDownloadUrl(null);
    try {
      const body: Record<string, unknown> = {
        job_item_id: clip.jobItemId,
        words,
        video_url: clip.videoUrl,
        style_config: { y_position: yPosition },
      };
      if (headlineText.trim()) {
        body.headline_overlay = { text: headlineText.trim(), y_position: headlineY };
      }
      const res = await fetch("/api/export-clip", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Export failed");
      setDownloadUrl(json.download_url ?? null);
      setExportState("done");
    } catch (e: any) {
      setExportError(e.message ?? "Export failed");
      setExportState("error");
    }
  }, [clip, words, yPosition, headlineText, headlineY]);

  // ── Loading / error states ────────────────────────────────────────────────────
  if (loadError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#fafafa]">
        <div className="text-center">
          <p className="text-[#374151] font-medium mb-3">{loadError}</p>
          <button
            onClick={() => router.push("/dashboard")}
            className="text-[#fd6333] text-[13px] underline"
          >
            ← Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  if (!clip) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#fafafa]">
        <div className="flex flex-col items-center gap-3">
          <svg
            className="animate-spin w-6 h-6 text-[#fd6333]"
            viewBox="0 0 24 24"
            fill="none"
          >
            <path
              d="M21 12a9 9 0 1 1-6.219-8.56"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
            />
          </svg>
          <p className="text-[13px] text-[#9ca3af]">Loading clip…</p>
        </div>
      </div>
    );
  }

  // ─── Render ────────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-screen bg-[#fafafa] overflow-hidden">
      {/* ── Top bar ──────────────────────────────────────────────────────────── */}
      <header className="h-12 flex-shrink-0 bg-white border-b border-gray-100 flex items-center px-4 gap-3 z-30">
        <button
          onClick={() => router.push("/dashboard")}
          className="w-7 h-7 flex items-center justify-center rounded-lg text-[#9ca3af] hover:text-[#374151] hover:bg-gray-50 transition-colors"
          title="Back to Dashboard"
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M19 12H5M12 5l-7 7 7 7" />
          </svg>
        </button>

        <div className="w-px h-4 bg-gray-100" />

        <span className="text-[13px] font-semibold text-[#16423c] truncate">
          Clip Studio
        </span>

        <span className="text-[11px] text-[#9ca3af] font-mono truncate hidden sm:block">
          {clip.jobItemId.slice(0, 8)}…
        </span>

        <div className="ml-auto flex items-center gap-2">
          {/* Export button */}
          <button
            onClick={handleExport}
            disabled={exportState === "loading"}
            className="h-8 px-4 rounded-lg bg-[#fd6333] text-white text-[12px] font-semibold flex items-center gap-1.5 hover:bg-[#e5572d] disabled:opacity-60 transition-colors"
          >
            {exportState === "loading" ? (
              <>
                <svg
                  className="animate-spin w-3 h-3"
                  viewBox="0 0 24 24"
                  fill="none"
                >
                  <path
                    d="M21 12a9 9 0 1 1-6.219-8.56"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                  />
                </svg>
                Exporting…
              </>
            ) : (
              <>
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="7 10 12 15 17 10" />
                  <line x1="12" y1="15" x2="12" y2="3" />
                </svg>
                Export & Burn
              </>
            )}
          </button>

          {/* Download link after export */}
          <AnimatePresence>
            {exportState === "done" && downloadUrl && (
              <motion.a
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                href={downloadUrl}
                download
                className="h-8 px-3 rounded-lg bg-[#16423c] text-white text-[12px] font-semibold flex items-center gap-1.5 hover:bg-[#0f2e28] transition-colors"
              >
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="7 10 12 15 17 10" />
                  <line x1="12" y1="15" x2="12" y2="3" />
                </svg>
                Download MP4
              </motion.a>
            )}
          </AnimatePresence>

          {exportState === "error" && exportError && (
            <span className="text-[11px] text-red-500 max-w-[200px] truncate">
              {exportError}
            </span>
          )}
        </div>
      </header>

      {/* ── Three-pane workspace ──────────────────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden">
        {/* ── LEFT: Transcript Editor ──────────────────────────────────────────── */}
        <aside className="w-[280px] flex-shrink-0 border-r border-gray-100 bg-white flex flex-col overflow-hidden">
          {/* Hook-3s banner */}
          <div className="px-4 pt-3 pb-2 border-b border-gray-50 flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-[#fd6333]" />
            <span className="text-[11px] font-semibold text-[#374151]">
              Transcript
            </span>
            <span className="ml-auto text-[10px] text-[#9ca3af]">
              Hook:{" "}
              <span className="text-[#fd6333] font-semibold">
                0 – {HOOK_SECONDS}s
              </span>
            </span>
          </div>
          <div className="flex-1 overflow-y-auto">
            <TranscriptEditorWithHookHighlight
              videoRef={videoRef}
              words={words}
              onWordsChange={setWords}
            />
          </div>
        </aside>

        {/* ── CENTER: Video Preview ─────────────────────────────────────────────── */}
        <main className="flex-1 flex flex-col items-center justify-center bg-[#111] overflow-hidden relative">
          {/* Safe-zone toggle bar */}
          <div className="absolute top-3 left-1/2 -translate-x-1/2 flex items-center gap-1 bg-black/40 backdrop-blur-sm rounded-full px-3 py-1.5 z-30">
            <span className="text-[10px] text-white/60 mr-1 font-medium">
              Safe Zone:
            </span>
            {(["tiktok", "reels", "shorts"] as const).map((p) => (
              <button
                key={p}
                onClick={() =>
                  setSafeZonePlatform((prev) => (prev === p ? null : p))
                }
                className={`px-2 py-0.5 rounded-full text-[10px] font-semibold transition-colors ${
                  safeZonePlatform === p
                    ? "bg-[#fd6333] text-white"
                    : "text-white/60 hover:text-white"
                }`}
              >
                {p === "tiktok"
                  ? "TikTok"
                  : p === "reels"
                  ? "Reels"
                  : "Shorts"}
              </button>
            ))}
          </div>

          {/* Video + canvas overlay */}
          <div
            className="relative"
            style={{
              // Maintain 9:16 aspect ratio, max height = viewport - header
              maxHeight: "calc(100vh - 48px - 32px)",
              aspectRatio: "9/16",
            }}
          >
            <video
              ref={videoRef}
              src={clip.videoUrl}
              controls
              playsInline
              className="w-full h-full object-cover rounded-xl"
              crossOrigin="anonymous"
            />
            <SubtitleOverlay
              videoRef={videoRef}
              words={words}
              style={style}
              yPositionOverride={yPosition}
              headlineText={headlineText || undefined}
              headlineY={headlineY}
              className="absolute inset-0 rounded-xl"
            />
            {safeZonePlatform && (
              <SafeZoneOverlay
                platform={safeZonePlatform}
                className="rounded-xl"
              />
            )}
          </div>
        </main>

        {/* ── RIGHT: Styling & Variations Lab ──────────────────────────────────── */}
        <aside className="w-[280px] flex-shrink-0 border-l border-gray-100 bg-white flex flex-col overflow-y-auto">
          <div className="px-4 pt-4 pb-3 border-b border-gray-50">
            <span className="text-[11px] font-semibold text-[#374151]">
              Styling & Controls
            </span>
          </div>

          <div className="flex flex-col gap-5 px-4 py-4">
            {/* ── Style switcher ── */}
            <section>
              <p className="text-[11px] font-semibold text-[#374151] uppercase tracking-wider mb-2">
                Subtitle Style
              </p>
              <div className="flex flex-col gap-1.5">
                {(["fast_talker", "minimalist", "cinematic"] as const).map(
                  (s) => (
                    <button
                      key={s}
                      onClick={() => setStyle(s)}
                      className={`w-full text-left px-3 py-2 rounded-xl border text-[12px] font-medium transition-colors ${
                        style === s
                          ? "border-[#16423c] bg-[#16423c0a] text-[#16423c]"
                          : "border-gray-100 text-[#6b7280] hover:border-gray-200"
                      }`}
                    >
                      {s === "fast_talker"
                        ? "Fast Talker"
                        : s === "minimalist"
                        ? "Minimalist"
                        : "Cinematic"}
                    </button>
                  )
                )}
              </div>
            </section>

            {/* ── Margin slider ── */}
            <section>
              <p className="text-[11px] font-semibold text-[#374151] uppercase tracking-wider mb-2">
                Subtitle Position
              </p>
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-[#9ca3af]">Top</span>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.01}
                  value={yPosition}
                  onChange={(e) => setYPosition(parseFloat(e.target.value))}
                  className="flex-1 accent-[#fd6333]"
                />
                <span className="text-[10px] text-[#9ca3af]">Bot</span>
              </div>
              <p className="text-[10px] text-[#9ca3af] mt-1 text-center">
                Y = {Math.round(yPosition * 100)}%
              </p>
            </section>

            <div className="h-px bg-gray-50" />

            {/* ── Headline Overlay ── */}
            <section>
              <p className="text-[11px] font-semibold text-[#374151] uppercase tracking-wider mb-2">
                Headline Overlay
              </p>
              <input
                type="text"
                placeholder="STOP SCROLLING"
                maxLength={80}
                value={headlineText}
                onChange={(e) => setHeadlineText(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-gray-100 text-[12px] text-[#374151] placeholder-gray-300 outline-none focus:border-[#fd6333] transition-colors bg-white"
              />
              <p className="text-[10px] text-[#9ca3af] mt-1">
                Appears at the top of the video (burn-in on export)
              </p>
            </section>

            <div className="h-px bg-gray-50" />

            {/* ── Hook Lab ── */}
            <section>
              <div className="flex items-center gap-2 mb-2">
                <div className="w-2 h-2 rounded-full bg-[#fd6333]" />
                <p className="text-[11px] font-semibold text-[#374151] uppercase tracking-wider">
                  Hook Lab
                </p>
                <span className="ml-auto text-[9px] text-[#9ca3af]">
                  first {HOOK_SECONDS}s
                </span>
              </div>

              {/* Current hook snippet preview */}
              <div className="bg-[#fd63330a] border border-[#fd633320] rounded-xl px-3 py-2 mb-2.5">
                <p className="text-[11px] text-[#374151] leading-relaxed line-clamp-3">
                  {hookSnippet || (
                    <span className="text-gray-300 italic">
                      No words in the first 3 seconds
                    </span>
                  )}
                </p>
              </div>

              <button
                onClick={rewriteHook}
                disabled={hookLoading || !hookSnippet.trim()}
                className="w-full h-8 rounded-xl bg-[#16423c] text-white text-[12px] font-semibold flex items-center justify-center gap-1.5 hover:bg-[#0f2e28] disabled:opacity-50 transition-colors"
              >
                {hookLoading ? (
                  <>
                    <svg
                      className="animate-spin w-3 h-3"
                      viewBox="0 0 24 24"
                      fill="none"
                    >
                      <path
                        d="M21 12a9 9 0 1 1-6.219-8.56"
                        stroke="currentColor"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                      />
                    </svg>
                    Generating…
                  </>
                ) : (
                  <>
                    <svg
                      width="11"
                      height="11"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M12 2L2 7l10 5 10-5-10-5z" />
                      <path d="M2 17l10 5 10-5" />
                      <path d="M2 12l10 5 10-5" />
                    </svg>
                    AI Rewrite Hook
                  </>
                )}
              </button>

              {hookError && (
                <p className="text-[11px] text-red-500 mt-1.5">{hookError}</p>
              )}

              {/* Suggestions */}
              <AnimatePresence>
                {hookSuggestions.length > 0 && (
                  <motion.div
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="flex flex-col gap-2 mt-2.5"
                  >
                    <p className="text-[10px] text-[#9ca3af] font-medium">
                      Click to apply:
                    </p>
                    {hookSuggestions.map((s, i) => (
                      <button
                        key={i}
                        onClick={() => applyHookSuggestion(s)}
                        className="w-full text-left bg-white border border-gray-100 hover:border-[#fd6333] hover:bg-[#fd63330a] rounded-xl px-3 py-2 text-[11px] text-[#374151] leading-relaxed transition-colors"
                      >
                        {s}
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </section>
          </div>
        </aside>
      </div>
    </div>
  );
}

// ─── TranscriptEditorWithHookHighlight ─────────────────────────────────────────
//
// Thin wrapper around TranscriptEditor that visually highlights words in the
// hook window (start < 3s) with an orange dot in the word chip.
//
// TranscriptEditor doesn't expose per-word styling, so we inject a small
// visual banner above the editor to indicate the hook zone.

interface TEHHProps {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  words: WordEntry[];
  onWordsChange: (updated: WordEntry[]) => void;
}

function TranscriptEditorWithHookHighlight({
  videoRef,
  words,
  onWordsChange,
}: TEHHProps) {
  const hookWordCount = words.filter((w) => w.start < HOOK_SECONDS).length;

  return (
    <div className="flex flex-col h-full">
      {/* Hook word count banner */}
      {hookWordCount > 0 && (
        <div className="mx-3 mt-2 mb-0 bg-[#fd63330a] border border-[#fd633220] rounded-xl px-3 py-1.5 flex items-center gap-1.5">
          <div className="w-1.5 h-1.5 rounded-full bg-[#fd6333] flex-shrink-0" />
          <span className="text-[10px] text-[#fd6333] font-semibold">
            {hookWordCount} words in hook (0–{HOOK_SECONDS}s)
          </span>
        </div>
      )}
      <div className="flex-1 min-h-0">
        <TranscriptEditor
          videoRef={videoRef}
          words={words}
          onWordsChange={onWordsChange}
          className="h-full"
        />
      </div>
    </div>
  );
}
