"use client";

import { motion } from "framer-motion";
import { useState, useMemo } from "react";

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
/*  Format & Style Options                                             */
/* ------------------------------------------------------------------ */

const FORMAT_OPTIONS = [
  { key: "9:16", label: "Vertical", subtitle: "TikTok, Reels, Shorts" },
  { key: "4:5", label: "Square-ish", subtitle: "LinkedIn, Facebook" },
  { key: "16:9", label: "Landscape", subtitle: "YouTube, Twitter" },
];

const STYLE_PRESETS = [
  { key: "minimalist", label: "The Minimalist" },
  { key: "fast_talker", label: "The Fast-Talker" },
  { key: "cinematic", label: "The Cinematic" },
];

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

  // Format & style (only for video clips)
  const [format, setFormat] = useState<string>("9:16");
  const [style, setStyle] = useState<string>("minimalist");

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
  const canGenerate = urlValid && selectedCount > 0;

  const handleGenerate = () => {
    // Placeholder — backend integration pending
    alert("Generation queued. Backend integration coming soon.");
  };

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
              <motion.button
                key={ct.key}
                type="button"
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.08 * i, duration: 0.35 }}
                whileHover={{ y: -2, boxShadow: "0 8px 24px rgba(0,0,0,0.06)" }}
                whileTap={{ scale: 0.98 }}
                onClick={() => toggleType(ct.key)}
                className={`rounded-2xl p-4 text-left w-full cursor-pointer transition-all duration-150 ${
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
              </motion.button>
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
            Format & Style
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            {/* Format Toggle */}
            <div>
              <p className="text-[12px] font-medium text-gray-500 uppercase tracking-wide mb-2">
                Aspect Ratio
              </p>
              <div className="flex gap-2">
                {FORMAT_OPTIONS.map((opt) => {
                  const isActive = format === opt.key;
                  return (
                    <button
                      key={opt.key}
                      type="button"
                      onClick={() => setFormat(opt.key)}
                      className={`flex-1 px-3 py-3 rounded-xl text-center cursor-pointer transition-all duration-150 ${
                        isActive
                          ? "border-2 shadow-sm bg-white"
                          : "border border-gray-200 hover:border-gray-300 bg-white"
                      }`}
                      style={isActive ? { borderColor: "#fd6333" } : undefined}
                    >
                      <span
                        className="text-[13px] font-semibold block"
                        style={{ color: "#16423c" }}
                      >
                        {opt.label}
                      </span>
                      <span className="text-[11px] text-gray-400 mt-0.5 block">
                        {opt.subtitle}
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
          disabled={!canGenerate}
          className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl font-semibold text-white text-[15px] transition-all hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
          style={{ backgroundColor: "#fd6333" }}
        >
          <IconZap className="w-[18px] h-[18px]" />
          Generate Content
        </button>

        {!canGenerate && (
          <p className="text-[12px] text-gray-400 text-center mt-2">
            {!urlValid && selectedCount === 0
              ? "Enter a YouTube URL and select at least one content type."
              : !urlValid
              ? "Enter a valid YouTube URL to continue."
              : "Select at least one content type."}
          </p>
        )}
      </motion.div>
    </div>
  );
}
