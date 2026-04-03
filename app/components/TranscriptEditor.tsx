"use client";

/**
 * TranscriptEditor — interactive word-level transcript sidebar.
 *
 * Features:
 *   • Click a word → seeks video to that word's start time
 *   • Click-active word highlights based on videoRef.currentTime
 *   • contentEditable word chips for inline text editing
 *   • Edits update the local words state (lifted via onWordsChange)
 *   • The canvas SubtitleOverlay reads the same words array so subtitles
 *     update instantly with no re-render of the video
 */

import React, {
  useRef,
  useEffect,
  useState,
  useCallback,
  useLayoutEffect,
} from "react";
import { type WordEntry } from "./SubtitleOverlay";

// ─── Props ────────────────────────────────────────────────────────────────────

interface TranscriptEditorProps {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  words: WordEntry[];
  onWordsChange: (updated: WordEntry[]) => void;
  className?: string;
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function TranscriptEditor({
  videoRef,
  words,
  onWordsChange,
  className,
}: TranscriptEditorProps) {
  const [activeIdx, setActiveIdx] = useState<number>(-1);
  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  const [editValue, setEditValue] = useState<string>("");
  const activeRef = useRef<HTMLButtonElement | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number | null>(null);

  // rAF loop — track which word is active based on currentTime
  useEffect(() => {
    const loop = () => {
      const video = videoRef.current;
      if (video) {
        const t = video.currentTime;
        let found = -1;
        for (let i = 0; i < words.length; i++) {
          if (t >= words[i].start && t <= words[i].end + 0.05) {
            found = i;
            break;
          }
        }
        if (found !== activeIdx) setActiveIdx(found);
      }
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [videoRef, words, activeIdx]);

  // Auto-scroll active word into view
  useLayoutEffect(() => {
    if (activeRef.current) {
      activeRef.current.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }
  }, [activeIdx]);

  // Seek video to a word
  const seekTo = useCallback(
    (idx: number) => {
      const video = videoRef.current;
      if (video && words[idx]) {
        video.currentTime = words[idx].start;
      }
    },
    [videoRef, words]
  );

  // Commit inline edit
  const commitEdit = useCallback(
    (idx: number, newText: string) => {
      const trimmed = newText.trim();
      if (!trimmed) return; // don't allow empty word
      const updated = words.map((w, i) =>
        i === idx ? { ...w, text: trimmed } : w
      );
      onWordsChange(updated);
      setEditingIdx(null);
    },
    [words, onWordsChange]
  );

  // Toggle highlight on a word
  const toggleHighlight = useCallback(
    (idx: number) => {
      const updated = words.map((w, i) =>
        i === idx ? { ...w, highlight: !w.highlight } : w
      );
      onWordsChange(updated);
    },
    [words, onWordsChange]
  );

  // Set emoji on a word (cycle through common emoji or clear)
  const EMOJIS = ["💰", "🔥", "💪", "🤯", "✅", "👇", "🎯", "⚡"];
  const cycleEmoji = useCallback(
    (idx: number) => {
      const cur = words[idx]?.emoji;
      const next = cur
        ? EMOJIS[(EMOJIS.indexOf(cur) + 1) % EMOJIS.length] ?? undefined
        : EMOJIS[0];
      // After full cycle, clear
      const cleared = cur && EMOJIS.indexOf(cur) === EMOJIS.length - 1 ? undefined : next;
      const updated = words.map((w, i) =>
        i === idx ? { ...w, emoji: cleared } : w
      );
      onWordsChange(updated);
    },
    [words, onWordsChange]
  );

  if (!words.length) {
    return (
      <div
        className={`flex flex-col items-center justify-center gap-2 text-[12px] text-[#9ca3af] py-8 ${className ?? ""}`}
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
        <span>No transcript available</span>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={`flex flex-col h-full overflow-hidden ${className ?? ""}`}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-100 shrink-0">
        <span className="text-[11px] font-bold text-[#16423c] uppercase tracking-wide">
          Transcript
        </span>
        <span className="text-[10px] text-[#9ca3af]">{words.length} words</span>
      </div>

      {/* Helper hint */}
      <div className="px-4 py-2 text-[10px] text-[#9ca3af] bg-gray-50/60 border-b border-gray-100 shrink-0 leading-relaxed">
        Click word to seek · Double-click to edit · Right-click for emoji/highlight
      </div>

      {/* Word chips */}
      <div className="flex-1 overflow-y-auto px-3 py-3">
        <div className="flex flex-wrap gap-1.5">
          {words.map((word, idx) => {
            const isActive = idx === activeIdx;
            const isEditing = editingIdx === idx;

            return (
              <div key={idx} className="relative group/word">
                {isEditing ? (
                  <input
                    autoFocus
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    onBlur={() => commitEdit(idx, editValue)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") { e.preventDefault(); commitEdit(idx, editValue); }
                      if (e.key === "Escape") setEditingIdx(null);
                    }}
                    className="px-2 py-0.5 rounded-md text-[12px] border border-[#fd6333] outline-none bg-white text-[#16423c] font-semibold min-w-[32px] w-auto"
                    style={{ width: `${Math.max(editValue.length * 8 + 16, 40)}px` }}
                  />
                ) : (
                  <button
                    ref={isActive ? activeRef : null}
                    onClick={() => seekTo(idx)}
                    onDoubleClick={() => {
                      setEditingIdx(idx);
                      setEditValue(word.text);
                    }}
                    className={`
                      relative px-2 py-0.5 rounded-md text-[12px] font-medium transition-all select-none
                      ${isActive
                        ? "bg-[#fd6333] text-white shadow-sm scale-105"
                        : word.highlight
                        ? "bg-[#fd63330f] text-[#fd6333] border border-[#fd633340]"
                        : "bg-gray-100 text-[#374151] hover:bg-gray-200"
                      }
                    `}
                  >
                    {word.text}
                    {word.emoji && (
                      <span className="ml-0.5 text-[10px]">{word.emoji}</span>
                    )}
                    {/* Timing badge on hover */}
                    <span className="absolute -top-5 left-1/2 -translate-x-1/2 bg-[#1f2937] text-white text-[9px] px-1.5 py-0.5 rounded whitespace-nowrap opacity-0 group-hover/word:opacity-100 transition-opacity pointer-events-none z-10">
                      {word.start.toFixed(2)}s
                    </span>
                  </button>
                )}

                {/* Context actions (visible on hover, not during edit) */}
                {!isEditing && (
                  <div className="absolute -bottom-5 left-1/2 -translate-x-1/2 flex gap-0.5 opacity-0 group-hover/word:opacity-100 transition-opacity z-20 pointer-events-none group-hover/word:pointer-events-auto">
                    {/* Highlight toggle */}
                    <button
                      onClick={(e) => { e.stopPropagation(); toggleHighlight(idx); }}
                      title="Toggle highlight"
                      className={`w-4 h-4 rounded text-[8px] flex items-center justify-center transition-colors ${word.highlight ? "bg-[#fd6333] text-white" : "bg-white border border-gray-200 text-[#9ca3af] hover:text-[#fd6333]"}`}
                    >
                      ★
                    </button>
                    {/* Emoji cycle */}
                    <button
                      onClick={(e) => { e.stopPropagation(); cycleEmoji(idx); }}
                      title="Add/cycle emoji"
                      className="w-4 h-4 rounded bg-white border border-gray-200 text-[8px] flex items-center justify-center hover:border-[#fd6333] text-[#9ca3af] hover:text-[#fd6333] transition-colors"
                    >
                      {word.emoji ? word.emoji : "✦"}
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Footer: export JSON */}
      <div className="px-4 py-2.5 border-t border-gray-100 shrink-0 flex items-center justify-between">
        <span className="text-[10px] text-[#9ca3af]">Edits update overlay live</span>
        <button
          onClick={() => {
            const blob = new Blob([JSON.stringify(words, null, 2)], { type: "application/json" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = "transcript.json";
            a.click();
            URL.revokeObjectURL(url);
          }}
          className="text-[10px] font-semibold text-[#16423c] hover:text-[#fd6333] transition-colors flex items-center gap-1"
        >
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
          Export JSON
        </button>
      </div>
    </div>
  );
}
