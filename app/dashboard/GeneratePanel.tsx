"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import { createClient } from "@/lib/supabase/client";

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
      <svg className="w-[18px] h-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
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
      <svg className="w-[18px] h-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
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
      <svg className="w-[18px] h-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
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
    label: "Single AI Image",
    credits: 5,
    description: "Custom thumbnail or promotional image from key moments",
    maxQty: 5,
    icon: (
      <svg className="w-[18px] h-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
        <circle cx="8.5" cy="8.5" r="1.5" />
        <polyline points="21 15 16 10 5 21" />
      </svg>
    ),
  },
];

const CREDIT_COSTS: Record<string, number> = Object.fromEntries(
  CONTENT_TYPES.map((ct) => [ct.key, ct.credits])
);

/* ------------------------------------------------------------------ */
/*  Platform Options (replaces format toggle)                          */
/* ------------------------------------------------------------------ */

interface PlatformOption {
  key: string;
  label: string;
  ratio: string;
  icon: React.ReactNode;
}

const PLATFORM_OPTIONS: PlatformOption[] = [
  {
    key: "tiktok",
    label: "TikTok",
    ratio: "9:16",
    icon: (
      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
        <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1-2.89-2.89 2.89 2.89 0 0 1 2.89-2.89c.28 0 .54.04.79.1v-3.5a6.37 6.37 0 0 0-.79-.05A6.34 6.34 0 0 0 3.15 15a6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.34-6.34V8.69a8.28 8.28 0 0 0 4.76 1.51v-3.5a4.83 4.83 0 0 1-1-.01z" />
      </svg>
    ),
  },
  {
    key: "reels",
    label: "Reels",
    ratio: "9:16",
    icon: (
      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 2.982c2.937 0 3.285.011 4.445.064a6.087 6.087 0 0 1 2.042.379 3.408 3.408 0 0 1 1.265.823 3.408 3.408 0 0 1 .823 1.265 6.087 6.087 0 0 1 .379 2.042c.053 1.16.064 1.508.064 4.445s-.011 3.285-.064 4.445a6.087 6.087 0 0 1-.379 2.042 3.643 3.643 0 0 1-2.088 2.088 6.087 6.087 0 0 1-2.042.379c-1.16.053-1.508.064-4.445.064s-3.285-.011-4.445-.064a6.087 6.087 0 0 1-2.042-.379 3.408 3.408 0 0 1-1.265-.823 3.408 3.408 0 0 1-.823-1.265 6.087 6.087 0 0 1-.379-2.042c-.053-1.16-.064-1.508-.064-4.445s.011-3.285.064-4.445a6.087 6.087 0 0 1 .379-2.042 3.408 3.408 0 0 1 .823-1.265 3.408 3.408 0 0 1 1.265-.823 6.087 6.087 0 0 1 2.042-.379c1.16-.053 1.508-.064 4.445-.064M12 1c-2.987 0-3.362.013-4.535.066a8.074 8.074 0 0 0-2.67.51 5.392 5.392 0 0 0-1.949 1.27 5.392 5.392 0 0 0-1.27 1.949 8.074 8.074 0 0 0-.51 2.67C1.013 8.638 1 9.013 1 12s.013 3.362.066 4.535a8.074 8.074 0 0 0 .51 2.67 5.392 5.392 0 0 0 1.27 1.949 5.392 5.392 0 0 0 1.949 1.27 8.074 8.074 0 0 0 2.67.51C8.638 22.987 9.013 23 12 23s3.362-.013 4.535-.066a8.074 8.074 0 0 0 2.67-.51 5.625 5.625 0 0 0 3.219-3.219 8.074 8.074 0 0 0 .51-2.67C22.987 15.362 23 14.987 23 12s-.013-3.362-.066-4.535a8.074 8.074 0 0 0-.51-2.67 5.392 5.392 0 0 0-1.27-1.949 5.392 5.392 0 0 0-1.949-1.27 8.074 8.074 0 0 0-2.67-.51C15.362 1.013 14.987 1 12 1z" />
        <path d="M17.5 7.5 14 4H10l3.5 3.5H10l-3.5-3.5H4v3.5L7.5 11 4 14.5V17h2.5L10 13.5 13.5 17h3l-3.5-3.5L16.5 10l-3.5-3.5H17.5z" opacity="0.6" />
      </svg>
    ),
  },
  {
    key: "shorts",
    label: "Shorts",
    ratio: "9:16",
    icon: (
      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
        <path d="M10 14.65v-5.3L15 12l-5 2.65zm7.77-4.33-1.2-.5L18 9.06c1.84-.96 2.53-3.23 1.56-5.06s-3.24-2.53-5.07-1.56L6 6.94c-1.29.68-2.07 2.04-2 3.49.07 1.42.93 2.67 2.22 3.25.03.01 1.2.5 1.2.5L6 14.93c-1.83.97-2.53 3.24-1.56 5.07.97 1.83 3.24 2.53 5.07 1.56l8.5-4.5c1.29-.68 2.06-2.04 1.99-3.49-.07-1.42-.94-2.68-2.23-3.25z" />
      </svg>
    ),
  },
  {
    key: "linkedin",
    label: "LinkedIn",
    ratio: "4:5",
    icon: (
      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
        <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
      </svg>
    ),
  },
  {
    key: "twitter",
    label: "X / Twitter",
    ratio: "16:9",
    icon: (
      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
      </svg>
    ),
  },
];

const STYLE_PRESETS = [
  { key: "minimalist", label: "The Minimalist" },
  { key: "fast_talker", label: "The Fast-Talker" },
  { key: "cinematic", label: "The Cinematic" },
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

function IconMinus({ className = "w-3.5 h-3.5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}

function IconPlus({ className = "w-3.5 h-3.5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}

function IconZap({ className = "w-[18px] h-[18px]" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/*  GeneratePanel Component                                            */
/* ------------------------------------------------------------------ */

export default function GeneratePanel() {
  // URL state
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [urlError, setUrlError] = useState<string | null>(null);
  const [urlValid, setUrlValid] = useState(false);

  // Content type selections: key -> quantity
  const [selectedTypes, setSelectedTypes] = useState<Record<string, number>>({});

  // Platform selection & style (only for video clips)
  const [selectedPlatforms, setSelectedPlatforms] = useState<Record<string, boolean>>({});
  const [style, setStyle] = useState<string>("minimalist");

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

  // Content type selection handlers
  const toggleType = (key: string) => {
    setSelectedTypes((prev) => {
      const next = { ...prev };
      if (next[key] !== undefined) {
        delete next[key];
      } else {
        next[key] = 1;
      }
      return next;
    });
  };

  const updateQuantity = (key: string, delta: number) => {
    const ct = CONTENT_TYPES.find((c) => c.key === key);
    if (!ct) return;
    setSelectedTypes((prev) => {
      const current = prev[key] ?? 1;
      const next = Math.max(1, Math.min(ct.maxQty, current + delta));
      return { ...prev, [key]: next };
    });
  };

  // Credit calculation
  const totalCredits = useMemo(() => {
    return Object.entries(selectedTypes).reduce((sum, [key, qty]) => {
      return sum + (CREDIT_COSTS[key] ?? 0) * qty;
    }, 0);
  }, [selectedTypes]);

  const selectedCount = Object.keys(selectedTypes).length;
  const hasVideoClips = selectedTypes["viral_clip"] !== undefined;
  const selectedPlatformCount = Object.values(selectedPlatforms).filter(Boolean).length;
  const canGenerate = urlValid && selectedCount > 0 && (!hasVideoClips || selectedPlatformCount > 0);

  const togglePlatform = (key: string) => {
    setSelectedPlatforms((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleGenerate = useCallback(async () => {
    if (!canGenerate) return;

    setGenState({
      submitting: true,
      requestId: null,
      jobItems: [],
      error: null,
      creditsAfter: null,
    });

    // Build the items payload matching server validation
    const items = Object.entries(selectedTypes).map(([key, qty]) => {
      const item: Record<string, unknown> = {
        job_type: key,
        quantity: qty,
      };

      if (key === "viral_clip") {
        item.platforms = Object.entries(selectedPlatforms)
          .filter(([, active]) => active)
          .map(([k]) => k);
        item.style = style;
      }

      return item;
    });

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

      // Reconstruct the flat ordered list of { job_type, platform } that the API
      // expands on the server (mirrors the expansion logic in /api/generate/route.ts).
      const expandedMeta: Array<{ job_type: string; platform: string | null }> = [];
      for (const item of items) {
        const jobType = item.job_type as string;
        if (jobType === "viral_clip" && Array.isArray(item.platforms)) {
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
  }, [canGenerate, youtubeUrl, selectedTypes, selectedPlatforms, style]);

  return (
    <div className="max-w-4xl mx-auto px-6 py-8">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="mb-8"
      >
        <h1
          className="text-[28px] md:text-[32px] font-bold leading-tight"
          style={{ color: "#16423c" }}
        >
          Generate Content
        </h1>
        <p className="text-[15px] mt-0.5" style={{ color: "#fd6333" }}>
          Transform any YouTube video into multi-format content.
        </p>
      </motion.div>

      {/* ── Section: YouTube URL Input ── */}
      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.08, duration: 0.35 }}
        className="bg-white rounded-2xl p-5 border border-gray-100/80 mb-6"
      >
        <label className="block text-sm font-medium text-gray-700 mb-2">
          YouTube URL
        </label>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <input
              type="text"
              value={youtubeUrl}
              onChange={(e) => handleUrlChange(e.target.value)}
              placeholder="https://www.youtube.com/watch?v=..."
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-opacity-50 text-sm pr-10"
            />
            {urlValid && (
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-green-500">
                <IconCheck />
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={handlePaste}
            className="flex items-center gap-1.5 px-4 py-3 rounded-lg font-semibold text-white text-sm transition-all hover:opacity-90"
            style={{ backgroundColor: "#fd6333" }}
          >
            <IconClipboard />
            Paste
          </button>
        </div>
        {urlError && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-red-500 text-xs mt-2"
          >
            {urlError}
          </motion.p>
        )}
      </motion.div>

      {/* ── Section: Content Type Selection ── */}
      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.16, duration: 0.35 }}
        className="bg-white rounded-2xl p-5 border border-gray-100/80 mb-6"
      >
        <h2 className="text-[15px] font-semibold mb-3" style={{ color: "#16423c" }}>
          Select Content Types
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {CONTENT_TYPES.map((ct, i) => {
            const isSelected = selectedTypes[ct.key] !== undefined;
            const qty = selectedTypes[ct.key] ?? 1;

            return (
              <motion.div
                key={ct.key}
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.08 * i, duration: 0.35 }}
                whileHover={{ y: -2, boxShadow: "0 8px 24px rgba(0,0,0,0.06)" }}
                whileTap={{ scale: 0.98 }}
                onClick={() => toggleType(ct.key)}
                role="checkbox"
                aria-checked={isSelected}
                tabIndex={0}
                onKeyDown={(e) => { if (e.key === " " || e.key === "Enter") { e.preventDefault(); toggleType(ct.key); } }}
                className={`rounded-2xl p-4 text-left w-full cursor-pointer transition-all duration-150 select-none ${
                  isSelected
                    ? "border-2 shadow-sm bg-white"
                    : "border border-gray-200 bg-white hover:border-gray-300"
                }`}
                style={isSelected ? { borderColor: "#fd6333" } : undefined}
              >
                {/* Top row: icon + label + credit badge */}
                <div className="flex items-start justify-between mb-1.5">
                  <div className="flex items-center gap-2">
                    <div
                      className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                      style={{ backgroundColor: "#fd63330f" }}
                    >
                      <span style={{ color: "#fd6333" }}>{ct.icon}</span>
                    </div>
                    <span
                      className="text-[13px] font-semibold leading-tight"
                      style={{ color: "#16423c" }}
                    >
                      {ct.label}
                    </span>
                  </div>
                  {ct.credits === 0 ? (
                    <span className="bg-green-50 text-green-700 text-[11px] font-bold px-2 py-0.5 rounded-full flex-shrink-0">
                      FREE
                    </span>
                  ) : (
                    <span className="bg-gray-100 text-gray-600 text-[11px] font-medium px-2 py-0.5 rounded-full flex-shrink-0">
                      {ct.credits} {ct.credits === 1 ? "credit" : "credits"}
                    </span>
                  )}
                </div>

                {/* Description */}
                <p className="text-xs text-gray-400 leading-relaxed mt-1.5">
                  {ct.description}
                </p>

                {/* Quantity stepper (when selected) */}
                {isSelected && ct.maxQty > 1 && (
                  <div
                    className="flex items-center mt-3 pt-3 border-t border-gray-100"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <span className="text-[11px] text-gray-400 mr-auto">Quantity</span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        updateQuantity(ct.key, -1);
                      }}
                      disabled={qty <= 1}
                      className="w-7 h-7 rounded-lg border border-gray-200 flex items-center justify-center text-sm font-medium hover:bg-gray-50 transition-colors disabled:opacity-30"
                    >
                      <IconMinus />
                    </button>
                    <span
                      className="text-[13px] font-semibold mx-3 min-w-[1.5rem] text-center"
                      style={{ color: "#16423c" }}
                    >
                      {qty}
                    </span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        updateQuantity(ct.key, 1);
                      }}
                      disabled={qty >= ct.maxQty}
                      className="w-7 h-7 rounded-lg border border-gray-200 flex items-center justify-center text-sm font-medium hover:bg-gray-50 transition-colors disabled:opacity-30"
                    >
                      <IconPlus />
                    </button>
                  </div>
                )}
              </motion.div>
            );
          })}
        </div>
      </motion.div>

      {/* ── Section: Format & Style (only when video clips selected) ── */}
      {hasVideoClips && (
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.08, duration: 0.35 }}
          className="bg-white rounded-2xl p-5 border border-gray-100/80 mb-6"
        >
          <h2 className="text-[15px] font-semibold mb-4" style={{ color: "#16423c" }}>
            Platforms & Style
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            {/* Platform Selection */}
            <div>
              <p className="text-[12px] font-medium text-gray-500 uppercase tracking-wide mb-2">
                Target Platforms
              </p>
              <div className="flex gap-2 flex-wrap">
                {PLATFORM_OPTIONS.map((plat) => {
                  const isActive = !!selectedPlatforms[plat.key];
                  return (
                    <button
                      key={plat.key}
                      type="button"
                      onClick={() => togglePlatform(plat.key)}
                      className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-center cursor-pointer transition-all duration-150 ${
                        isActive
                          ? "border-2 shadow-sm bg-white"
                          : "border border-gray-200 hover:border-gray-300 bg-white"
                      }`}
                      style={isActive ? { borderColor: "#fd6333" } : undefined}
                    >
                      <span style={{ color: isActive ? "#fd6333" : "#9ca3af" }}>
                        {plat.icon}
                      </span>
                      <span
                        className="text-[13px] font-medium"
                        style={{ color: isActive ? "#16423c" : "#6b7280" }}
                      >
                        {plat.label}
                      </span>
                      <span className="text-[10px] text-gray-400 ml-0.5">
                        {plat.ratio}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Style Preset */}
            <div>
              <p className="text-[12px] font-medium text-gray-500 uppercase tracking-wide mb-2">
                Style Preset
              </p>
              <div className="flex gap-2 flex-wrap">
                {STYLE_PRESETS.map((preset) => {
                  const isActive = style === preset.key;
                  return (
                    <button
                      key={preset.key}
                      type="button"
                      onClick={() => setStyle(preset.key)}
                      className={`px-4 py-2 rounded-full text-[13px] font-medium cursor-pointer transition-all duration-150 ${
                        isActive
                          ? "text-white shadow-sm"
                          : "border border-gray-200 bg-white text-gray-600 hover:bg-gray-50"
                      }`}
                      style={isActive ? { backgroundColor: "#fd6333" } : undefined}
                    >
                      {preset.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </motion.div>
      )}

      {/* ── Section: Credit Summary & Generate Button ── */}
      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.24, duration: 0.35 }}
        className="bg-white rounded-2xl p-5 border border-gray-100/80"
      >
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-5">
          {/* Breakdown */}
          <div className="flex-1">
            <h2 className="text-[15px] font-semibold mb-3" style={{ color: "#16423c" }}>
              Credit Summary
            </h2>
            {selectedCount === 0 ? (
              <p className="text-[13px] text-gray-400">
                Select content types above to see credit breakdown.
              </p>
            ) : (
              <div className="space-y-1.5">
                {Object.entries(selectedTypes).map(([key, qty]) => {
                  const ct = CONTENT_TYPES.find((c) => c.key === key);
                  if (!ct) return null;
                  const lineCost = ct.credits * qty;
                  return (
                    <div key={key} className="flex items-center justify-between text-[13px]">
                      <span className="text-gray-600">
                        {qty} x {ct.label}
                      </span>
                      <span className="font-medium" style={{ color: "#16423c" }}>
                        {lineCost === 0 ? "Free" : `${lineCost} credits`}
                      </span>
                    </div>
                  );
                })}
                <div className="pt-2 mt-2 border-t border-gray-100 flex items-center justify-between">
                  <span className="text-[13px] font-semibold text-gray-700">Total</span>
                  <span className="text-[20px] font-bold" style={{ color: "#16423c" }}>
                    {totalCredits} {totalCredits === 1 ? "Credit" : "Credits"}
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Generate Button */}
        <button
          type="button"
          onClick={handleGenerate}
          disabled={!canGenerate || genState.submitting}
          className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl font-semibold text-white text-[15px] transition-all hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
          style={{ backgroundColor: "#fd6333" }}
        >
          {genState.submitting ? (
            <>
              <div
                className="w-[18px] h-[18px] border-2 border-white/30 border-t-white rounded-full animate-spin"
              />
              Submitting...
            </>
          ) : (
            <>
              <IconZap className="w-[18px] h-[18px]" />
              Generate Content
            </>
          )}
        </button>

        {!canGenerate && !genState.submitting && (
          <p className="text-[12px] text-gray-400 text-center mt-2">
            {!urlValid && selectedCount === 0
              ? "Enter a YouTube URL and select at least one content type."
              : !urlValid
              ? "Enter a valid YouTube URL to continue."
              : selectedCount === 0
              ? "Select at least one content type."
              : hasVideoClips && selectedPlatformCount === 0
              ? "Select at least one target platform for your video clips."
              : ""}
          </p>
        )}
      </motion.div>

      {/* ── Error Display ── */}
      <AnimatePresence>
        {genState.error && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.25 }}
            className="bg-red-50 border border-red-200 rounded-2xl p-4 mt-6 flex items-start gap-3"
          >
            <svg className="w-4 h-4 mt-0.5 flex-shrink-0 text-red-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <line x1="15" y1="9" x2="9" y2="15" />
              <line x1="9" y1="9" x2="15" y2="15" />
            </svg>
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-semibold text-red-700">Generation failed</p>
              <p className="text-[12px] text-red-600 mt-0.5">{genState.error}</p>
            </div>
            <button
              onClick={() => setGenState((prev) => ({ ...prev, error: null }))}
              className="text-red-400 hover:text-red-600 flex-shrink-0"
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
            className="bg-white rounded-2xl p-5 border border-gray-100/80 mt-6"
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-[15px] font-semibold" style={{ color: "#16423c" }}>
                Processing Jobs
              </h2>
              {genState.creditsAfter !== null && (
                <span className="text-[12px] text-gray-400">
                  Balance after: <span className="font-semibold" style={{ color: "#16423c" }}>{genState.creditsAfter.toLocaleString()}</span> credits
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
                  <div className="flex items-center justify-between text-[11px] text-gray-400 mb-1">
                    <span>{done} of {total} complete</span>
                    <span>{pct}%</span>
                  </div>
                  <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
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
                    className="flex items-center gap-3 px-3 py-2.5 rounded-xl border border-gray-100 bg-gray-50/50"
                  >
                    {/* Status indicator */}
                    <div className="flex-shrink-0">
                      {job.status === "processing" ? (
                        <div
                          className="w-5 h-5 border-2 border-t-transparent rounded-full animate-spin"
                          style={{ borderColor: statusColor, borderTopColor: "transparent" }}
                        />
                      ) : job.status === "completed" ? (
                        <div className="w-5 h-5 rounded-full flex items-center justify-center" style={{ backgroundColor: statusColor }}>
                          <svg className="w-3 h-3 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                        </div>
                      ) : job.status === "failed" ? (
                        <div className="w-5 h-5 rounded-full flex items-center justify-center" style={{ backgroundColor: statusColor }}>
                          <svg className="w-3 h-3 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="18" y1="6" x2="6" y2="18" />
                            <line x1="6" y1="6" x2="18" y2="18" />
                          </svg>
                        </div>
                      ) : (
                        <div
                          className="w-5 h-5 rounded-full border-2"
                          style={{ borderColor: statusColor }}
                        />
                      )}
                    </div>

                    {/* Job info */}
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-medium" style={{ color: "#16423c" }}>
                        {ct?.label ?? job.job_type}
                        {job.platform && (
                          <span className="text-gray-400 font-normal ml-1.5">
                            / {job.platform}
                          </span>
                        )}
                      </p>
                      {job.error_message && (
                        <p className="text-[11px] text-red-500 mt-0.5 truncate">
                          {job.error_message}
                        </p>
                      )}
                    </div>

                    {/* Status badge */}
                    <span
                      className="text-[11px] font-semibold px-2 py-0.5 rounded-full flex-shrink-0"
                      style={{
                        color: statusColor,
                        backgroundColor: `${statusColor}14`,
                      }}
                    >
                      {statusLabel}
                    </span>
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
                onClick={() => {
                  setGenState({
                    submitting: false,
                    requestId: null,
                    jobItems: [],
                    error: null,
                    creditsAfter: null,
                  });
                  setYoutubeUrl("");
                  setUrlValid(false);
                  setUrlError(null);
                  setSelectedTypes({});
                  setSelectedPlatforms({});
                  setStyle("minimalist");
                }}
                className="w-full mt-4 flex items-center justify-center gap-2 py-3 rounded-xl font-semibold text-[14px] border-2 transition-all hover:bg-gray-50"
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
  );
}
