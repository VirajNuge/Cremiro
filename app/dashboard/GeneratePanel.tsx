"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import OutputStudio from "./OutputStudio";

/* ------------------------------------------------------------------ */
/*  Loading Screen                                                     */
/* ------------------------------------------------------------------ */

const LOADING_STAGES = [
  "Fetching video metadata",
  "Extracting transcript",
  "Identifying viral moments",
  "Rendering clips",
  "Writing captions & blog",
];

function LoadingScreen({ onComplete }: { onComplete: () => void }) {
  const [stageIdx, setStageIdx] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setStageIdx((prev) => {
        if (prev < LOADING_STAGES.length - 1) return prev + 1;
        clearInterval(interval);
        setTimeout(onComplete, 500); // Wait briefly on 100%
        return prev;
      });
    }, 1800);
    return () => clearInterval(interval);
  }, [onComplete]);

  const progressPct = ((stageIdx + 1) / LOADING_STAGES.length) * 100;

  return (
    <div className="w-full h-[100dvh] flex flex-col items-center justify-center font-sans text-[#f5f5f5]" style={{ backgroundColor: "#0F0F0F" }}>
      <div className="w-12 h-12 border-4 border-white/10 border-t-[#fd6333] rounded-full animate-spin mb-8" />
      
      <div className="h-8 relative w-full flex justify-center mb-2 overflow-hidden">
        <AnimatePresence mode="wait">
          <motion.div
            key={stageIdx}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.3 }}
            className="text-[18px] font-bold absolute"
          >
            {LOADING_STAGES[stageIdx]}
          </motion.div>
        </AnimatePresence>
      </div>

      <div className="text-[13px] font-medium mb-6" style={{ color: "rgba(255,255,255,0.4)" }}>
        Stage {stageIdx + 1} of {LOADING_STAGES.length}
      </div>

      <div className="w-64 h-1 bg-white/10 rounded-full overflow-hidden mb-4">
        <motion.div 
          className="h-full rounded-full" 
          style={{ backgroundColor: "#fd6333" }}
          initial={{ width: "0%" }}
          animate={{ width: `${progressPct}%` }}
          transition={{ duration: 0.5, ease: "easeOut" }}
        />
      </div>

      <div className="text-[12px] font-medium" style={{ color: "rgba(255,255,255,0.25)" }}>
        ~2–3 minutes remaining
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  YouTube URL Validation                                             */
/* ------------------------------------------------------------------ */

const YOUTUBE_REGEX =
  /^(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/(?:watch\?v=|shorts\/|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})(?:\S*)?$/;

function validateYouTubeUrl(url: string): boolean {
  return YOUTUBE_REGEX.test(url.trim());
}

/* ------------------------------------------------------------------ */
/*  Content Type Definitions                                           */
/* ------------------------------------------------------------------ */

interface ContentType {
  key: string;
  label: string;
  credits: number;
  description: string;
  maxQty: number;
  icon: React.ReactNode;
}

const CONTENT_TYPES: ContentType[] = [
  {
    key: "viral_clip",
    label: "Viral Video Clip",
    credits: 1,
    description: "AI-cropped, subtitled short-form clip optimized for virality",
    maxQty: 20,
    icon: (
      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18" />
        <line x1="7" y1="2" x2="7" y2="22" />
        <line x1="17" y1="2" x2="17" y2="22" />
        <line x1="2" y1="12" x2="22" y2="12" />
        <line x1="2" y1="7" x2="7" y2="7" />
        <line x1="2" y1="17" x2="7" y2="17" />
        <line x1="17" y1="7" x2="22" y2="7" />
        <line x1="17" y1="17" x2="22" y2="17" />
      </svg>
    ),
  },
  {
    key: "social_text",
    label: "Social Text / Threads",
    credits: 0,
    description: "Platform-ready captions and threads from transcript",
    maxQty: 1,
    icon: (
      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
      </svg>
    ),
  },
  {
    key: "blog_post",
    label: "SEO Blog Post",
    credits: 5,
    description: "Long-form article optimized for search from video content",
    maxQty: 5,
    icon: (
      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="16" y1="13" x2="8" y2="13" />
        <line x1="16" y1="17" x2="8" y2="17" />
        <polyline points="10 9 9 9 8 9" />
      </svg>
    ),
  },
  {
    key: "ai_image",
    label: "Visual Post",
    credits: 5,
    description: "Custom AI-generated image for each post",
    maxQty: 5,
    icon: (
      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
        <circle cx="8.5" cy="8.5" r="1.5" />
        <polyline points="21 15 16 10 5 21" />
      </svg>
    ),
  },
];

/* ------------------------------------------------------------------ */
/*  Platform Options                                                   */
/* ------------------------------------------------------------------ */

interface PlatformOption {
  key: string;
  label: string;
  icon: React.ReactNode;
}

const PLATFORM_OPTIONS: PlatformOption[] = [
  {
    key: "tiktok",
    label: "TikTok",
    icon: (
      <svg className="w-[15px] h-[15px]" viewBox="0 0 24 24" fill="currentColor">
        <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1-2.89-2.89 2.89 2.89 0 0 1 2.89-2.89c.28 0 .54.04.79.1v-3.5a6.37 6.37 0 0 0-.79-.05A6.34 6.34 0 0 0 3.15 15a6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.34-6.34V8.69a8.28 8.28 0 0 0 4.76 1.51v-3.5a4.83 4.83 0 0 1-1-.01z" />
      </svg>
    ),
  },
  {
    key: "reels",
    label: "Reels",
    icon: (
      <svg className="w-[15px] h-[15px]" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 2.982c2.937 0 3.285.011 4.445.064a6.087 6.087 0 0 1 2.042.379 3.408 3.408 0 0 1 1.265.823 3.408 3.408 0 0 1 .823 1.265 6.087 6.087 0 0 1 .379 2.042c.053 1.16.064 1.508.064 4.445s-.011 3.285-.064 4.445a6.087 6.087 0 0 1-.379 2.042 3.643 3.643 0 0 1-2.088 2.088 6.087 6.087 0 0 1-2.042.379c-1.16.053-1.508.064-4.445.064s-3.285-.011-4.445-.064a6.087 6.087 0 0 1-2.042-.379 3.408 3.408 0 0 1-1.265-.823 3.408 3.408 0 0 1-.823-1.265 6.087 6.087 0 0 1-.379-2.042c-.053-1.16-.064-1.508-.064-4.445s.011-3.285.064-4.445a6.087 6.087 0 0 1 .379-2.042 3.408 3.408 0 0 1 .823-1.265 3.408 3.408 0 0 1 1.265-.823 6.087 6.087 0 0 1 2.042-.379c1.16-.053 1.508-.064 4.445-.064M12 1c-2.987 0-3.362.013-4.535.066a8.074 8.074 0 0 0-2.67.51 5.392 5.392 0 0 0-1.949 1.27 5.392 5.392 0 0 0-1.27 1.949 8.074 8.074 0 0 0-.51 2.67C1.013 8.638 1 9.013 1 12s.013 3.362.066 4.535a8.074 8.074 0 0 0 .51 2.67 5.392 5.392 0 0 0 1.27 1.949 5.392 5.392 0 0 0 1.949 1.27 8.074 8.074 0 0 0 2.67.51C8.638 22.987 9.013 23 12 23s3.362-.013 4.535-.066a8.074 8.074 0 0 0 2.67-.51 5.625 5.625 0 0 0 3.219-3.219 8.074 8.074 0 0 0 .51-2.67C22.987 15.362 23 14.987 23 12s-.013-3.362-.066-4.535a8.074 8.074 0 0 0-.51-2.67 5.392 5.392 0 0 0-1.27-1.949 5.392 5.392 0 0 0-1.949-1.27 8.074 8.074 0 0 0-2.67-.51C15.362 1.013 14.987 1 12 1z" />
        <path d="M17.5 7.5 14 4H10l3.5 3.5H10l-3.5-3.5H4v3.5L7.5 11 4 14.5V17h2.5L10 13.5 13.5 17h3l-3.5-3.5L16.5 10l-3.5-3.5H17.5z" opacity="0.6" />
      </svg>
    ),
  },
  {
    key: "shorts",
    label: "Shorts",
    icon: (
      <svg className="w-[15px] h-[15px]" viewBox="0 0 24 24" fill="currentColor">
        <path d="M10 14.65v-5.3L15 12l-5 2.65zm7.77-4.33-1.2-.5L18 9.06c1.84-.96 2.53-3.23 1.56-5.06s-3.24-2.53-5.07-1.56L6 6.94c-1.29.68-2.07 2.04-2 3.49.07 1.42.93 2.67 2.22 3.25.03.01 1.2.5 1.2.5L6 14.93c-1.83.97-2.53 3.24-1.56 5.07.97 1.83 3.24 2.53 5.07 1.56l8.5-4.5c1.29-.68 2.06-2.04 1.99-3.49-.07-1.42-.94-2.68-2.23-3.25z" />
      </svg>
    ),
  },
  {
    key: "twitter",
    label: "X / Twitter",
    icon: (
      <svg className="w-[15px] h-[15px]" viewBox="0 0 24 24" fill="currentColor">
        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
      </svg>
    ),
  },
  {
    key: "linkedin",
    label: "LinkedIn",
    icon: (
      <svg className="w-[15px] h-[15px]" viewBox="0 0 24 24" fill="currentColor">
        <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
      </svg>
    ),
  },
];

const STYLE_PRESETS = [
  { key: "minimalist", label: "Minimalist" },
  { key: "fast_talker", label: "Fast-Talker" },
  { key: "cinematic", label: "Cinematic" },
];

/* ------------------------------------------------------------------ */
/*  Job Status Types                                                   */
/* ------------------------------------------------------------------ */

type JobStatus = "pending" | "processing" | "completed" | "failed";

interface JobItem {
  id: string;
  job_type: string;
  status: JobStatus;
  platform: string | null;
  output_data: Record<string, unknown> | null;
  output_refs: string[] | null;
  error_message: string | null;
}

interface GenerateState {
  submitting: boolean;
  requestId: string | null;
  jobItems: JobItem[];
  error: string | null;
  creditsAfter: number | null;
}

const STATUS_LABELS: Record<JobStatus, string> = {
  pending: "Queued",
  processing: "Processing",
  completed: "Done",
  failed: "Failed",
};

const STATUS_COLORS: Record<JobStatus, string> = {
  pending: "#9ca3af",
  processing: "#fd6333",
  completed: "#22c55e",
  failed: "#ef4444",
};

/* ------------------------------------------------------------------ */
/*  Icons                                                              */
/* ------------------------------------------------------------------ */

function IconClipboard({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
      <rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
    </svg>
  );
}

function IconCheck({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function IconMinus({ className = "w-3 h-3" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}

function IconPlus({ className = "w-3 h-3" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}

function IconZap({ className = "w-[16px] h-[16px]" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/*  UI Helpers                                                         */
/* ------------------------------------------------------------------ */

function SelectionCircle({ selected, size = 20 }: { selected: boolean; size?: number }) {
  if (selected) {
    return (
      <div
        className="rounded-full flex items-center justify-center flex-shrink-0 transition-all duration-200"
        style={{ width: size, height: size, backgroundColor: "#fd6333" }}
      >
        <svg width={size * 0.55} height={size * 0.55} viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="20 6 9 17 4 12" />
        </svg>
      </div>
    );
  }
  return (
    <div
      className="rounded-full border-2 flex-shrink-0 transition-all duration-200"
      style={{ width: size, height: size, borderColor: "#d4d4d8", backgroundColor: "#ffffff" }}
    />
  );
}

function QtyStepper({
  value,
  min = 1,
  max = 20,
  onChange,
}: {
  value: number;
  min?: number;
  max?: number;
  onChange: (val: number) => void;
}) {
  return (
    <div className="flex items-center" onClick={(e) => e.stopPropagation()}>
      <button
        type="button"
        onClick={() => onChange(Math.max(min, value - 1))}
        disabled={value <= min}
        className="w-7 h-7 rounded-lg border border-[#e4e4e7] bg-white flex items-center justify-center hover:bg-[#f4f4f5] transition-colors disabled:opacity-30"
      >
        <IconMinus />
      </button>
      <span className="text-[13px] font-bold mx-2.5 min-w-[1.5rem] text-center" style={{ color: "#16423c" }}>
        {value}
      </span>
      <button
        type="button"
        onClick={() => onChange(Math.min(max, value + 1))}
        disabled={value >= max}
        className="w-7 h-7 rounded-lg border border-[#e4e4e7] bg-white flex items-center justify-center hover:bg-[#f4f4f5] transition-colors disabled:opacity-30"
      >
        <IconPlus />
      </button>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Text Output Panel                                                  */
/* ------------------------------------------------------------------ */

function TextOutputPanel({
  jobType,
  outputData,
}: {
  jobType: string;
  outputData: Record<string, unknown>;
}) {
  const [copied, setCopied] = useState(false);

  const getText = (): string => {
    if (jobType === "social_text") {
      const parts = outputData.thread_parts as string[] | undefined;
      if (parts?.length) return parts.join("\n\n---\n\n");
      return (outputData.full_transcript as string) ?? "";
    }
    if (jobType === "blog_post") {
      const sections = outputData.sections as Array<{ title: string; content: string }> | undefined;
      if (sections?.length) {
        return sections.map((s) => `## ${s.title}\n\n${s.content}`).join("\n\n");
      }
      return (outputData.full_transcript as string) ?? "";
    }
    return JSON.stringify(outputData, null, 2);
  };

  const text = getText();

  const handleCopy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const blob = new Blob([text], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = jobType === "blog_post" ? "blog-post.md" : "social-text.txt";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: "auto" }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      className="border-t border-gray-100 px-3 pb-3 pt-2.5 bg-white"
    >
      <pre className="text-[11px] text-gray-600 whitespace-pre-wrap leading-relaxed max-h-48 overflow-y-auto bg-[#fafafa] rounded-lg p-2.5 mb-2 border border-[#f0f0f0]">
        {text || "No content generated."}
      </pre>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={handleCopy}
          className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-[12px] font-semibold border transition-all hover:bg-gray-50"
          style={{ borderColor: "#fd6333", color: "#fd6333" }}
        >
          {copied ? (
            <>
              <IconCheck className="w-3.5 h-3.5" />
              Copied!
            </>
          ) : (
            <>
              <IconClipboard className="w-3.5 h-3.5" />
              Copy
            </>
          )}
        </button>
        <button
          type="button"
          onClick={handleDownload}
          className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-[12px] font-semibold border transition-all hover:bg-gray-50"
          style={{ borderColor: "#e4e4e7", color: "#71717a" }}
        >
          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="7 10 12 15 17 10" />
            <line x1="12" y1="15" x2="12" y2="3" />
          </svg>
          Download
        </button>
      </div>
    </motion.div>
  );
}

/* ------------------------------------------------------------------ */
/*  GeneratePanel Component                                            */
/* ------------------------------------------------------------------ */

export default function GeneratePanel() {
  const [uiScreen, setUiScreen] = useState<"input" | "loading" | "output">("input");

  // URL state
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [urlError, setUrlError] = useState<string | null>(null);
  const [urlValid, setUrlValid] = useState(false);

  // Hero card interactive pattern
  const [heroMouse, setHeroMouse] = useState({ x: -999, y: -999 });

  // Page background interactive pattern
  const [pageMouse, setPageMouse] = useState({ x: -999, y: -999 });

  // Card 1: Video Clipping
  const [videoClipSelected, setVideoClipSelected] = useState(false);
  const [videoClipPlatforms, setVideoClipPlatforms] = useState<Record<string, boolean>>({});
  const [videoStyle, setVideoStyle] = useState<string>("minimalist");
  const [videoQty, setVideoQty] = useState(1);

  // Card 2: Social Media Posts
  const [socialTextSelected, setSocialTextSelected] = useState(false);
  const [visualPostSelected, setVisualPostSelected] = useState(false);
  const [visualPostQty, setVisualPostQty] = useState(1);
  const [socialPlatforms, setSocialPlatforms] = useState<Record<string, boolean>>({});

  // Card 3: SEO Blog Post
  const [blogPostSelected, setBlogPostSelected] = useState(false);
  const [blogPostQty, setBlogPostQty] = useState(1);

  // Generation state
  const [genState, setGenState] = useState<GenerateState>({
    submitting: false,
    requestId: null,
    jobItems: [],
    error: null,
    creditsAfter: null,
  });

  const supabaseRef = useRef(createClient());

  // ── Realtime subscription for job status updates ──
  useEffect(() => {
    if (!genState.requestId || genState.jobItems.length === 0) return;

    const supabase = supabaseRef.current;
    const jobItemIds = genState.jobItems.map((j) => j.id);

    const channel = supabase
      .channel(`job_items_${genState.requestId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "job_items",
          filter: `request_id=eq.${genState.requestId}`,
        },
        (payload) => {
          const updated = payload.new as Record<string, unknown>;
          const updatedId = updated.id as string;

          if (!jobItemIds.includes(updatedId)) return;

          setGenState((prev) => ({
            ...prev,
            jobItems: prev.jobItems.map((item) =>
              item.id === updatedId
                ? {
                    ...item,
                    status: updated.status as JobStatus,
                    output_data: (updated.output_data as Record<string, unknown>) ?? null,
                    output_refs: (updated.output_refs as string[]) ?? null,
                    error_message: (updated.error_message as string) ?? null,
                  }
                : item
            ),
          }));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [genState.requestId, genState.jobItems.length]);

  // URL handlers
  const handleUrlChange = (value: string) => {
    setYoutubeUrl(value);
    if (!value.trim()) {
      setUrlError(null);
      setUrlValid(false);
      return;
    }
    if (validateYouTubeUrl(value)) {
      setUrlValid(true);
      setUrlError(null);
    } else {
      setUrlValid(false);
      setUrlError("Please enter a valid YouTube or Shorts URL.");
    }
  };

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      handleUrlChange(text);
    } catch {
      setUrlError("Unable to read clipboard. Please paste the URL manually.");
    }
  };

  const toggleVideoClipPlatform = (key: string) => {
    setVideoClipPlatforms((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const toggleSocialPlatform = (key: string) => {
    setSocialPlatforms((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const canGenerate =
    urlValid &&
    ((videoClipSelected && Object.values(videoClipPlatforms).some(Boolean)) ||
      socialTextSelected ||
      (visualPostSelected && Object.values(socialPlatforms).some(Boolean)) ||
      blogPostSelected);

  const handleGenerate = useCallback(async () => {
    if (!canGenerate) return;
    setUiScreen("loading");

    setGenState({
      submitting: true,
      requestId: null,
      jobItems: [],
      error: null,
      creditsAfter: null,
    });

    const items: Array<Record<string, unknown>> = [];

    if (videoClipSelected) {
      items.push({
        job_type: "viral_clip",
        quantity: videoQty,
        platforms: Object.entries(videoClipPlatforms)
          .filter(([, v]) => v)
          .map(([k]) => k),
        style: videoStyle,
      });
    }
    if (socialTextSelected) {
      items.push({ job_type: "social_text", quantity: 1 });
    }
    if (visualPostSelected) {
      items.push({
        job_type: "ai_image",
        quantity: visualPostQty,
        platforms: Object.entries(socialPlatforms)
          .filter(([, v]) => v)
          .map(([k]) => k),
      });
    }
    if (blogPostSelected) {
      items.push({ job_type: "blog_post", quantity: blogPostQty });
    }

    try {
      const response = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          youtubeUrl: youtubeUrl.trim(),
          items,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setGenState((prev) => ({
          ...prev,
          submitting: false,
          error: data.error || "An unexpected error occurred.",
        }));
        return;
      }

      const expandedMeta: Array<{ job_type: string; platform: string | null }> = [];
      for (const item of items) {
        const jobType = item.job_type as string;
        if ((jobType === "viral_clip" || jobType === "ai_image") && Array.isArray(item.platforms)) {
          for (const platform of item.platforms as string[]) {
            for (let i = 0; i < (item.quantity as number); i++) {
              expandedMeta.push({ job_type: jobType, platform });
            }
          }
        } else {
          for (let i = 0; i < (item.quantity as number); i++) {
            expandedMeta.push({ job_type: jobType, platform: null });
          }
        }
      }

      const jobItemIds: string[] = data.job_item_ids ?? [];
      const initialJobItems: JobItem[] = jobItemIds.map((id: string, i: number) => ({
        id,
        job_type: expandedMeta[i]?.job_type ?? "unknown",
        status: "pending" as JobStatus,
        platform: expandedMeta[i]?.platform ?? null,
        output_data: null,
        output_refs: null,
        error_message: null,
      }));

      setGenState({
        submitting: false,
        requestId: data.request_id,
        jobItems: initialJobItems,
        error: null,
        creditsAfter: data.balance_after ?? null,
      });
    } catch {
      setGenState((prev) => ({
        ...prev,
        submitting: false,
        error: "Network error. Please check your connection and try again.",
      }));
    }
  }, [
    canGenerate,
    youtubeUrl,
    videoClipSelected,
    videoClipPlatforms,
    videoQty,
    videoStyle,
    socialTextSelected,
    visualPostSelected,
    visualPostQty,
    socialPlatforms,
    blogPostSelected,
    blogPostQty,
  ]);

  const resetGeneration = () => {
    setVideoClipSelected(false);
    setVideoClipPlatforms({});
    setVideoStyle("minimalist");
    setVideoQty(1);
    setSocialTextSelected(false);
    setVisualPostSelected(false);
    setVisualPostQty(1);
    setSocialPlatforms({});
    setBlogPostSelected(false);
    setBlogPostQty(1);
    setYoutubeUrl("");
    setUrlValid(false);
    setUrlError(null);
    setGenState({
      submitting: false,
      requestId: null,
      jobItems: [],
      error: null,
      creditsAfter: null,
    });
    setUiScreen("input");
  };

  const anySocialSelected = socialTextSelected || visualPostSelected;

  const totalCredits =
    (videoClipSelected ? 1 : 0) +
    (visualPostSelected ? 5 * visualPostQty : 0) +
    (blogPostSelected ? 5 * blogPostQty : 0);

  if (uiScreen === "loading") {
    return <LoadingScreen onComplete={() => setUiScreen("output")} />;
  }

  if (uiScreen === "output") {
    return (
      <OutputStudio 
        onBack={() => {
          resetGeneration();
        }} 
      />
    );
  }

  return (
    <div
      className={`relative overflow-hidden bg-gradient-to-b from-[#fafafa] to-white ${youtubeUrl ? 'min-h-screen flex flex-col py-6 pb-12' : 'h-[100svh] flex items-center justify-center'}`}
      onMouseMove={(e) => {
        const rect = e.currentTarget.getBoundingClientRect();
        setPageMouse({ x: e.clientX - rect.left, y: e.clientY - rect.top });
      }}
      onMouseLeave={() => setPageMouse({ x: -999, y: -999 })}
    >
      {/* Page dot grid */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: "radial-gradient(circle at 1px 1px, rgba(0,0,0,0.055) 1px, transparent 0)",
          backgroundSize: "28px 28px",
        }}
      />
      {/* Page mouse spotlight */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: `radial-gradient(circle 380px at ${pageMouse.x}px ${pageMouse.y}px, rgba(253,99,51,0.09) 0%, transparent 70%)`,
        }}
      />
      <div className={`relative z-10 w-full max-w-2xl mx-auto px-6 font-sans`}>

        {/* ── Step 1: YouTube URL Input ── */}
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="mb-4"
        >
          <div
            className="rounded-[18px] p-5 relative overflow-hidden"
            style={{ backgroundColor: "#16423c" }}
            onMouseMove={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              setHeroMouse({ x: e.clientX - rect.left, y: e.clientY - rect.top });
            }}
            onMouseLeave={() => setHeroMouse({ x: -999, y: -999 })}
          >
            {/* Dot grid pattern */}
            <div
              className="absolute inset-0 pointer-events-none"
              style={{
                backgroundImage: "radial-gradient(circle at 1px 1px, rgba(255,255,255,0.07) 1px, transparent 0)",
                backgroundSize: "22px 22px",
              }}
            />
            {/* Mouse spotlight */}
            <div
              className="absolute inset-0 pointer-events-none transition-opacity duration-300"
              style={{
                background: `radial-gradient(circle 220px at ${heroMouse.x}px ${heroMouse.y}px, rgba(253,99,51,0.18) 0%, transparent 70%)`,
              }}
            />
            {/* Edge vignette for depth */}
            <div
              className="absolute inset-0 pointer-events-none rounded-[18px]"
              style={{
                boxShadow: "inset 0 0 60px rgba(0,0,0,0.25)",
              }}
            />

            {/* Content */}
            <div className="relative z-10">
            <div className="mb-4">
              <h1 className="text-[20px] font-bold leading-tight flex items-center gap-2 text-white">
                Generate Content
                <span style={{ color: "#fd6333" }}>✦</span>
              </h1>
              <p className="text-[12px] mt-1 font-medium" style={{ color: "rgba(255,255,255,0.5)" }}>
                Transform any YouTube video into multi-format content.
              </p>
            </div>

            <div className="flex gap-2">
              <div className="relative flex-1">
                <input
                  type="text"
                  value={youtubeUrl}
                  onChange={(e) => handleUrlChange(e.target.value)}
                  placeholder="https://www.youtube.com/watch?v=..."
                  className="w-full py-3 px-4 rounded-xl focus:outline-none transition-colors text-[13px] pr-10 placeholder-[rgba(255,255,255,0.3)]"
                  style={{
                    backgroundColor: "rgba(255,255,255,0.08)",
                    border: "1px solid rgba(255,255,255,0.12)",
                    color: "white",
                  }}
                />
                <AnimatePresence>
                  {urlValid && (
                    <motion.span
                      initial={{ scale: 0, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      exit={{ scale: 0, opacity: 0 }}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-[#22c55e]"
                    >
                      <IconCheck className="w-4 h-4" />
                    </motion.span>
                  )}
                </AnimatePresence>
              </div>
              <button
                type="button"
                onClick={handlePaste}
                className="flex items-center gap-1.5 px-4 py-3 rounded-xl font-bold text-white text-[13px] transition-all hover:opacity-90 flex-shrink-0"
                style={{ backgroundColor: "#fd6333" }}
              >
                <IconClipboard className="w-3.5 h-3.5" />
                Paste
              </button>
            </div>
            {urlError && (
              <motion.p
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                className="text-[#f87171] text-[12px] mt-2 font-medium"
              >
                {urlError}
              </motion.p>
            )}
            </div>
          </div>
        </motion.div>

        {/* ── Step 2: Content Sections ── */}
        <AnimatePresence>
          {urlValid && (
            <motion.div
              initial="hidden"
              animate="visible"
              exit="hidden"
              variants={{
                visible: {
                  transition: { staggerChildren: 0.07 },
                },
              }}
              className="space-y-2.5"
            >
              {/* Card 1: Video Clipping */}
              <motion.div
                variants={{
                  hidden: { opacity: 0, y: 16 },
                  visible: { opacity: 1, y: 0 },
                }}
                className={`rounded-xl transition-all duration-200 cursor-pointer overflow-hidden ${
                  videoClipSelected
                    ? "border-2 border-[#fd6333] bg-white"
                    : "border border-[#e5e7eb] bg-white hover:bg-[#fafafa]"
                }`}
                onClick={() => setVideoClipSelected(!videoClipSelected)}
              >
                <div className="px-4 py-3.5 flex items-center gap-3">
                  <SelectionCircle selected={videoClipSelected} size={20} />
                  <span className="text-[10px] font-bold tracking-[0.15em] uppercase rounded-md px-1.5 py-0.5" style={{ color: "#fd6333", backgroundColor: "#fd63330f" }}>
                    01
                  </span>
                  <div
                    className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{ backgroundColor: "#fd63330f", color: "#fd6333" }}
                  >
                    {CONTENT_TYPES[0].icon}
                  </div>
                  <div className="flex-1">
                    <h3 className="text-[14px] font-bold" style={{ color: "#16423c" }}>
                      Video Clipping
                    </h3>
                  </div>
                  <span className="rounded-full px-2.5 py-0.5 text-[11px] font-semibold" style={{ backgroundColor: "#f4f4f5", color: "#52525b" }}>
                    1 Credit
                  </span>
                </div>
                <AnimatePresence>
                  {videoClipSelected && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      onClick={(e) => e.stopPropagation()}
                      className="cursor-default"
                    >
                      <div className="px-4 pb-4 pt-0 space-y-3">
                        <div className="border-t border-[#f0f0f0] w-full" />
                        {/* Platforms */}
                        <div>
                          <p className="text-[10px] font-bold text-[#a1a1aa] tracking-[0.12em] uppercase mb-2">
                            Platforms
                          </p>
                          <div className="flex gap-2">
                            {PLATFORM_OPTIONS.map((plat) => {
                              const isPlatSelected = !!videoClipPlatforms[plat.key];
                              return (
                                <button
                                  key={plat.key}
                                  type="button"
                                  title={plat.label}
                                  onClick={() => toggleVideoClipPlatform(plat.key)}
                                  className={`w-9 h-9 rounded-full flex items-center justify-center cursor-pointer transition-all ${
                                    isPlatSelected ? "border-2" : "border bg-white hover:bg-gray-50"
                                  }`}
                                  style={{
                                    borderColor: isPlatSelected ? "#fd6333" : "#e4e4e7",
                                    backgroundColor: isPlatSelected ? "#fd63330f" : undefined,
                                    color: isPlatSelected ? "#fd6333" : "#a1a1aa",
                                  }}
                                >
                                  {plat.icon}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                        <div className="border-t border-[#f0f0f0] w-full" />
                        {/* Style */}
                        <div>
                          <p className="text-[10px] font-bold text-[#a1a1aa] tracking-[0.12em] uppercase mb-2">
                            Style
                          </p>
                          <div className="flex gap-1.5 flex-wrap">
                            {STYLE_PRESETS.map((preset) => {
                              const isStyleSelected = videoStyle === preset.key;
                              return (
                                <button
                                  key={preset.key}
                                  type="button"
                                  onClick={() => setVideoStyle(preset.key)}
                                  className={`rounded-full px-3 py-1.5 text-[12px] font-medium transition-all ${
                                    isStyleSelected ? "border border-transparent" : "border border-[#e4e4e7] bg-white hover:bg-gray-50"
                                  }`}
                                  style={{
                                    backgroundColor: isStyleSelected ? "#16423c" : undefined,
                                    color: isStyleSelected ? "#ffffff" : "#71717a",
                                  }}
                                >
                                  {preset.label}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                        <div className="border-t border-[#f0f0f0] w-full" />
                        {/* Quantity */}
                        <div className="flex items-center justify-between">
                          <p className="text-[10px] font-bold text-[#a1a1aa] tracking-[0.12em] uppercase">
                            Quantity
                          </p>
                          <QtyStepper value={videoQty} max={20} onChange={setVideoQty} />
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>

              {/* Card 2: Social Media Posts */}
              <motion.div
                variants={{
                  hidden: { opacity: 0, y: 16 },
                  visible: { opacity: 1, y: 0 },
                }}
                className={`rounded-xl transition-all duration-200 overflow-hidden ${
                  anySocialSelected
                    ? "border-2 border-[#fd6333] bg-white"
                    : "border border-[#e5e7eb] bg-white"
                }`}
              >
                <div className="px-4 py-3.5 flex items-center gap-3 cursor-pointer" onClick={() => setSocialTextSelected(!socialTextSelected)}>
                  <SelectionCircle selected={anySocialSelected} size={20} />
                  <span className="text-[10px] font-bold tracking-[0.15em] uppercase rounded-md px-1.5 py-0.5" style={{ color: "#fd6333", backgroundColor: "#fd63330f" }}>
                    02
                  </span>
                  <div
                    className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{ backgroundColor: "#fd63330f", color: "#fd6333" }}
                  >
                    {CONTENT_TYPES[1].icon}
                  </div>
                  <div className="flex-1">
                    <h3 className="text-[14px] font-bold" style={{ color: "#16423c" }}>
                      Social Media Posts
                    </h3>
                  </div>
                </div>

                <div className="px-4 pb-4">
                  <div className="rounded-xl border border-[#f0f0f0] overflow-hidden">
                    {/* Sub-row A: Social Text */}
                    <div
                      className="p-3 cursor-pointer border-b border-[#f0f0f0] hover:bg-[#fafafa] transition-colors"
                      onClick={() => setSocialTextSelected(!socialTextSelected)}
                    >
                      <div className="flex items-center gap-3">
                        <SelectionCircle selected={socialTextSelected} size={18} />
                        <div className="flex-1">
                          <div className="text-[13px] font-semibold" style={{ color: "#16423c" }}>Social Text</div>
                          <div className="text-[11px] mt-0.5" style={{ color: "#a1a1aa" }}>Captions & threads — all platforms</div>
                        </div>
                        <div className="bg-[#f0fdf4] text-[#16a34a] rounded-full px-2.5 py-0.5 text-[10px] font-bold">FREE</div>
                      </div>
                      <AnimatePresence>
                        {socialTextSelected && (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: "auto" }}
                            exit={{ opacity: 0, height: 0 }}
                            className="overflow-hidden"
                          >
                            <div className="pt-3 flex items-center gap-2 pl-[29px]">
                              <div className="flex gap-1">
                                {PLATFORM_OPTIONS.map(plat => (
                                  <div key={plat.key} className="w-6 h-6 rounded-full bg-[#fd63330f] flex items-center justify-center" style={{ color: "#fd6333" }}>
                                    <div className="scale-[0.7]">{plat.icon}</div>
                                  </div>
                                ))}
                              </div>
                              <span className="text-[11px] font-medium ml-1" style={{ color: "#a1a1aa" }}>All platforms</span>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>

                    {/* Sub-row B: Visual Post */}
                    <div
                      className="p-3 cursor-pointer hover:bg-[#fafafa] transition-colors"
                      onClick={() => setVisualPostSelected(!visualPostSelected)}
                    >
                      <div className="flex items-center gap-3">
                        <SelectionCircle selected={visualPostSelected} size={18} />
                        <div className="flex-1">
                          <div className="text-[13px] font-semibold" style={{ color: "#16423c" }}>Visual Post</div>
                          <div className="text-[11px] mt-0.5" style={{ color: "#a1a1aa" }}>AI-generated image per post</div>
                        </div>
                        <div className="bg-[#f4f4f5] text-[#52525b] rounded-full px-2.5 py-0.5 text-[10px] font-semibold">+5 Credits</div>
                      </div>
                      <AnimatePresence>
                        {visualPostSelected && (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: "auto" }}
                            exit={{ opacity: 0, height: 0 }}
                            className="overflow-hidden"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <div className="pt-3 pl-[29px] space-y-3">
                              <div>
                                <p className="text-[10px] font-bold text-[#a1a1aa] tracking-[0.12em] uppercase mb-2">
                                  Platforms
                                </p>
                                <div className="flex gap-2">
                                  {PLATFORM_OPTIONS.map((plat) => {
                                    const isPlatSelected = !!socialPlatforms[plat.key];
                                    return (
                                      <button
                                        key={plat.key}
                                        type="button"
                                        title={plat.label}
                                        onClick={() => toggleSocialPlatform(plat.key)}
                                        className={`w-9 h-9 rounded-full flex items-center justify-center cursor-pointer transition-all ${
                                          isPlatSelected ? "border-2" : "border bg-white hover:bg-gray-50"
                                        }`}
                                        style={{
                                          borderColor: isPlatSelected ? "#fd6333" : "#e4e4e7",
                                          backgroundColor: isPlatSelected ? "#fd63330f" : undefined,
                                          color: isPlatSelected ? "#fd6333" : "#a1a1aa",
                                        }}
                                      >
                                        {plat.icon}
                                      </button>
                                    );
                                  })}
                                </div>
                              </div>
                              <div className="flex items-center justify-between">
                                <p className="text-[10px] font-bold text-[#a1a1aa] tracking-[0.12em] uppercase">
                                  Quantity
                                </p>
                                <QtyStepper value={visualPostQty} max={5} onChange={setVisualPostQty} />
                              </div>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  </div>
                </div>
              </motion.div>

              {/* Card 3: SEO Blog Post */}
              <motion.div
                variants={{
                  hidden: { opacity: 0, y: 16 },
                  visible: { opacity: 1, y: 0 },
                }}
                className={`rounded-xl transition-all duration-200 cursor-pointer overflow-hidden ${
                  blogPostSelected
                    ? "border-2 border-[#fd6333] bg-white"
                    : "border border-[#e5e7eb] bg-white hover:bg-[#fafafa]"
                }`}
                onClick={() => setBlogPostSelected(!blogPostSelected)}
              >
                <div className="px-4 py-3.5 flex items-center gap-3">
                  <SelectionCircle selected={blogPostSelected} size={20} />
                  <span className="text-[10px] font-bold tracking-[0.15em] uppercase rounded-md px-1.5 py-0.5" style={{ color: "#fd6333", backgroundColor: "#fd63330f" }}>
                    03
                  </span>
                  <div
                    className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{ backgroundColor: "#fd63330f", color: "#fd6333" }}
                  >
                    {CONTENT_TYPES[2].icon}
                  </div>
                  <div className="flex-1">
                    <h3 className="text-[14px] font-bold" style={{ color: "#16423c" }}>
                      SEO Blog Post
                    </h3>
                  </div>
                  <span className="rounded-full px-2.5 py-0.5 text-[11px] font-semibold" style={{ backgroundColor: "#f4f4f5", color: "#52525b" }}>
                    5 Credits
                  </span>
                </div>
                <AnimatePresence>
                  {blogPostSelected && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      onClick={(e) => e.stopPropagation()}
                      className="cursor-default"
                    >
                      <div className="px-4 pb-4 pt-0">
                        <div className="border-t border-[#f0f0f0] w-full mb-3" />
                        <div className="flex items-center justify-between">
                          <p className="text-[10px] font-bold text-[#a1a1aa] tracking-[0.12em] uppercase">
                            Quantity
                          </p>
                          <QtyStepper value={blogPostQty} max={5} onChange={setBlogPostQty} />
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>

              {/* ── Credit Summary & Generate Button ── */}
              <motion.div
                variants={{
                  hidden: { opacity: 0, y: 16 },
                  visible: { opacity: 1, y: 0 },
                }}
                className="pt-1"
              >
                {(videoClipSelected || anySocialSelected || blogPostSelected) && (
                  <div className="rounded-xl border border-[#e4e4e7] bg-[#fafafa] px-4 py-3.5 mb-3">
                    <div className="space-y-0">
                      {videoClipSelected && (
                        <div className="flex justify-between items-center py-1.5 border-b border-[#f0f0f0] last:border-0">
                          <span className="text-[13px]" style={{ color: "#71717a" }}>Video Clipping</span>
                          <span className="text-[13px] font-bold" style={{ color: "#16423c" }}>1 Credit</span>
                        </div>
                      )}
                      {socialTextSelected && (
                        <div className="flex justify-between items-center py-1.5 border-b border-[#f0f0f0] last:border-0">
                          <span className="text-[13px]" style={{ color: "#71717a" }}>Social Text</span>
                          <span className="text-[13px] font-bold" style={{ color: "#22c55e" }}>Free</span>
                        </div>
                      )}
                      {visualPostSelected && (
                        <div className="flex justify-between items-center py-1.5 border-b border-[#f0f0f0] last:border-0">
                          <span className="text-[13px]" style={{ color: "#71717a" }}>Visual Post ×{visualPostQty}</span>
                          <span className="text-[13px] font-bold" style={{ color: "#16423c" }}>{5 * visualPostQty} Credits</span>
                        </div>
                      )}
                      {blogPostSelected && (
                        <div className="flex justify-between items-center py-1.5 border-b border-[#f0f0f0] last:border-0">
                          <span className="text-[13px]" style={{ color: "#71717a" }}>SEO Blog Post ×{blogPostQty}</span>
                          <span className="text-[13px] font-bold" style={{ color: "#16423c" }}>{5 * blogPostQty} Credits</span>
                        </div>
                      )}
                      <div className="pt-2 flex justify-between items-center">
                        <span className="text-[11px] font-semibold text-[#a1a1aa] uppercase tracking-wider">Total</span>
                        <span className="text-[22px] font-black" style={{ color: "#16423c" }}>
                          {totalCredits} <span className="text-[14px] font-bold">Credits</span>
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                <button
                  type="button"
                  onClick={handleGenerate}
                  disabled={!canGenerate || genState.submitting}
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-white text-[15px] tracking-wide transition-all hover:opacity-95 disabled:opacity-40 disabled:cursor-not-allowed"
                  style={{ backgroundColor: "#fd6333", boxShadow: "0 6px 24px rgba(253, 99, 51, 0.32)" }}
                >
                  {genState.submitting ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Submitting...
                    </>
                  ) : (
                    <>
                      <IconZap className="w-4 h-4" />
                      Generate Content
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => setUiScreen("output")}
                  className="w-full mt-2 text-center text-[11px] font-medium transition-colors hover:opacity-80"
                  style={{ color: "rgba(253,99,51,0.6)" }}
                >
                  Preview Output Studio →
                </button>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Error Display ── */}
        <AnimatePresence>
          {genState.error && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.25 }}
              className="bg-[#fef2f2] border border-[#fecaca] rounded-xl p-3.5 mt-4 flex items-start gap-3"
            >
              <svg className="w-4 h-4 mt-0.5 flex-shrink-0 text-[#ef4444]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <line x1="15" y1="9" x2="9" y2="15" />
                <line x1="9" y1="9" x2="15" y2="15" />
              </svg>
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-semibold text-[#b91c1c]">Generation failed</p>
                <p className="text-[12px] text-[#dc2626] mt-0.5">{genState.error}</p>
              </div>
              <button
                onClick={() => setGenState((prev) => ({ ...prev, error: null }))}
                className="text-[#f87171] hover:text-[#dc2626] flex-shrink-0"
                aria-label="Dismiss error"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Job Status Progress ── */}
        <AnimatePresence>
          {genState.requestId && genState.jobItems.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.35 }}
              className="bg-white rounded-xl p-5 border border-[#e4e4e7] mt-5"
            >
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-[14px] font-bold" style={{ color: "#16423c" }}>
                  Processing Jobs
                </h2>
                {genState.creditsAfter !== null && (
                  <span className="text-[12px] text-[#6b7280]">
                    Balance: <span className="font-semibold" style={{ color: "#16423c" }}>{genState.creditsAfter.toLocaleString()}</span>
                  </span>
                )}
              </div>

              {/* Progress bar */}
              {(() => {
                const total = genState.jobItems.length;
                const done = genState.jobItems.filter((j) => j.status === "completed" || j.status === "failed").length;
                const pct = total > 0 ? Math.round((done / total) * 100) : 0;
                return (
                  <div className="mb-4">
                    <div className="flex items-center justify-between text-[11px] font-medium text-[#9ca3af] mb-1.5">
                      <span>{done} of {total} complete</span>
                      <span>{pct}%</span>
                    </div>
                    <div className="w-full h-1 bg-[#f4f4f4] rounded-full overflow-hidden">
                      <motion.div
                        className="h-full rounded-full"
                        style={{ backgroundColor: "#fd6333" }}
                        initial={{ width: 0 }}
                        animate={{ width: `${pct}%` }}
                        transition={{ duration: 0.4, ease: "easeOut" }}
                      />
                    </div>
                  </div>
                );
              })()}

              {/* Job item list */}
              <div className="space-y-2">
                {genState.jobItems.map((job, idx) => {
                  const ct = CONTENT_TYPES.find((c) => c.key === job.job_type);
                  const statusColor = STATUS_COLORS[job.status];
                  const statusLabel = STATUS_LABELS[job.status];

                  return (
                    <motion.div
                      key={job.id}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.05 * idx, duration: 0.25 }}
                      className="rounded-xl border border-[#f0f0f0] bg-white overflow-hidden"
                    >
                      {/* ── Job row ── */}
                      <div className="flex items-center gap-3 px-3.5 py-2.5">
                        {/* Status indicator */}
                        <div className="flex-shrink-0">
                          {job.status === "processing" ? (
                            <div
                              className="w-4 h-4 border-2 border-t-transparent rounded-full animate-spin"
                              style={{ borderColor: statusColor, borderTopColor: "transparent" }}
                            />
                          ) : job.status === "completed" ? (
                            <div className="w-4 h-4 rounded-full flex items-center justify-center" style={{ backgroundColor: statusColor }}>
                              <IconCheck className="w-2.5 h-2.5 text-white" />
                            </div>
                          ) : job.status === "failed" ? (
                            <div className="w-4 h-4 rounded-full flex items-center justify-center" style={{ backgroundColor: statusColor }}>
                              <svg className="w-2.5 h-2.5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                <line x1="18" y1="6" x2="6" y2="18" />
                                <line x1="6" y1="6" x2="18" y2="18" />
                              </svg>
                            </div>
                          ) : (
                            <div
                              className="w-4 h-4 rounded-full border-2"
                              style={{ borderColor: statusColor }}
                            />
                          )}
                        </div>

                        {/* Job info */}
                        <div className="flex-1 min-w-0">
                          <p className="text-[13px] font-semibold" style={{ color: "#16423c" }}>
                            {ct?.label ?? job.job_type}
                            {job.platform && (
                              <span className="font-normal ml-1.5" style={{ color: "#a1a1aa" }}>
                                / {PLATFORM_OPTIONS.find((p) => p.key === job.platform)?.label || job.platform}
                              </span>
                            )}
                          </p>
                          {job.error_message && (
                            <p className="text-[11px] text-[#ef4444] mt-0.5 truncate">
                              {job.error_message}
                            </p>
                          )}
                        </div>

                        {/* Status badge */}
                        <span
                          className="text-[10px] font-bold px-2.5 py-0.5 rounded-full flex-shrink-0 uppercase tracking-[0.08em]"
                          style={{
                            color: statusColor,
                            backgroundColor: `${statusColor}14`,
                          }}
                        >
                          {statusLabel}
                        </span>
                      </div>

                      {/* ── Output panel (completed viral_clip) ── */}
                      {job.status === "completed" && job.job_type === "viral_clip" && job.output_refs && job.output_refs.length > 0 && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: "auto" }}
                          transition={{ duration: 0.3, ease: "easeOut" }}
                          className="border-t border-[#f0f0f0] px-3.5 pb-3.5 pt-3 bg-[#fafafa]"
                        >
                          <video
                            src={job.output_refs[0]}
                            controls
                            playsInline
                            className="w-full rounded-xl bg-black"
                            style={{ maxHeight: "320px" }}
                          />
                          <a
                            href={job.output_refs[0]}
                            download
                            target="_blank"
                            rel="noopener noreferrer"
                            className="mt-2.5 flex items-center justify-center gap-2 w-full py-2 rounded-xl text-[13px] font-bold border-2 transition-all hover:bg-white bg-white"
                            style={{ borderColor: "#fd6333", color: "#fd6333" }}
                          >
                            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                              <polyline points="7 10 12 15 17 10" />
                              <line x1="12" y1="15" x2="12" y2="3" />
                            </svg>
                            Download {job.platform ? `(${PLATFORM_OPTIONS.find((p) => p.key === job.platform)?.label || job.platform})` : ""}
                          </a>
                        </motion.div>
                      )}

                      {/* ── Output panel (completed text outputs) ── */}
                      {job.status === "completed" && (job.job_type === "social_text" || job.job_type === "blog_post") && job.output_data && (
                        <TextOutputPanel jobType={job.job_type} outputData={job.output_data} />
                      )}
                    </motion.div>
                  );
                })}
              </div>

              {/* New Generation button (when all done) */}
              {genState.jobItems.length > 0 &&
                genState.jobItems.every((j) => j.status === "completed" || j.status === "failed") && (
                <motion.button
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2, duration: 0.3 }}
                  type="button"
                  onClick={resetGeneration}
                  className="w-full mt-4 flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-[14px] border-2 transition-all hover:bg-[#fd63330f]"
                  style={{ borderColor: "#fd6333", color: "#fd6333" }}
                >
                  <IconZap className="w-4 h-4" />
                  New Generation
                </motion.button>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
