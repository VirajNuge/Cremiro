"use client";

/**
 * SubtitleOverlay — transparent canvas absolutely positioned over a <video>.
 *
 * Driven by a requestAnimationFrame loop synced to video.currentTime.
 * Renders the active word(s) in Hormozi style: bold Impact, yellow fill,
 * thick black outline, emoji suffix if present.
 *
 * Props:
 *   videoRef  — ref to the <video> element to sync against
 *   words     — word-level timing array (from output_data.words)
 *   style     — "fast_talker" | "minimalist" | "cinematic" (maps to render style)
 */

import React, { useRef, useEffect, useCallback } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface WordEntry {
  text: string;
  start: number;  // seconds relative to clip start
  end: number;
  emoji?: string;
  highlight?: boolean;
}

export type SubtitleStyle = "fast_talker" | "minimalist" | "cinematic";

interface RenderConfig {
  fontFamily: string;
  fontSize: number;       // base pt; scaled by canvas height
  fillColor: string;
  outlineColor: string;
  outlineWidth: number;
  bold: boolean;
  yFraction: number;      // 0–1, where 1 = bottom
  highlightFill: string;
}

const STYLE_CONFIGS: Record<SubtitleStyle, RenderConfig> = {
  fast_talker: {
    fontFamily: "Impact, Arial Black, sans-serif",
    fontSize: 0.065,   // fraction of canvas height
    fillColor: "#FFFF00",
    outlineColor: "#000000",
    outlineWidth: 6,
    bold: false,        // Impact is already heavy
    yFraction: 0.82,
    highlightFill: "#FD6333",
  },
  minimalist: {
    fontFamily: "Arial, Helvetica, sans-serif",
    fontSize: 0.048,
    fillColor: "#FFFFFF",
    outlineColor: "#000000",
    outlineWidth: 4,
    bold: false,
    yFraction: 0.88,
    highlightFill: "#FFFF00",
  },
  cinematic: {
    fontFamily: "Georgia, 'Times New Roman', serif",
    fontSize: 0.042,
    fillColor: "#FFFFFF",
    outlineColor: "#000000",
    outlineWidth: 3,
    bold: false,
    yFraction: 0.88,
    highlightFill: "#FD6333",
  },
};

// ─── Phrase grouping ─────────────────────────────────────────────────────────
// Combine up to MAX_PHRASE_WORDS into a single displayed phrase so we don't
// flash one word at a time (fast_talker) or show too many words (minimalist).

const MAX_PHRASE_WORDS: Record<SubtitleStyle, number> = {
  fast_talker: 3,
  minimalist: 5,
  cinematic: 6,
};

interface Phrase {
  text: string;
  emoji?: string;
  start: number;
  end: number;
  hasHighlight: boolean;
}

function buildPhrases(words: WordEntry[], style: SubtitleStyle): Phrase[] {
  const maxWords = MAX_PHRASE_WORDS[style];
  const phrases: Phrase[] = [];
  let i = 0;
  while (i < words.length) {
    const chunk = words.slice(i, i + maxWords);
    phrases.push({
      text: chunk.map((w) => w.text).join(" "),
      emoji: chunk.find((w) => w.emoji)?.emoji,
      start: chunk[0].start,
      end: chunk[chunk.length - 1].end,
      hasHighlight: chunk.some((w) => w.highlight),
    });
    i += maxWords;
  }
  return phrases;
}

// ─── Component ───────────────────────────────────────────────────────────────

interface SubtitleOverlayProps {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  words: WordEntry[];
  style?: SubtitleStyle;
  className?: string;
  /** 0–1 fraction; overrides STYLE_CONFIGS[style].yFraction when set */
  yPositionOverride?: number;
  /** Static headline text rendered at the top of the canvas (e.g. "STOP SCROLLING") */
  headlineText?: string;
  /** 0–1 fraction for headline Y position (default 0.08) */
  headlineY?: number;
}

export default function SubtitleOverlay({
  videoRef,
  words,
  style = "fast_talker",
  className,
  yPositionOverride,
  headlineText,
  headlineY = 0.08,
}: SubtitleOverlayProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number | null>(null);
  const phrasesRef = useRef<Phrase[]>([]);
  const lastPhraseIdxRef = useRef<number>(-1);

  // Rebuild phrases whenever words/style changes
  useEffect(() => {
    phrasesRef.current = buildPhrases(words, style);
    lastPhraseIdxRef.current = -1;
  }, [words, style]);

  const drawFrame = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Match canvas size to rendered video element size
    const { clientWidth: w, clientHeight: h } = video;
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }

    ctx.clearRect(0, 0, w, h);

    const t = video.currentTime;
    const config = STYLE_CONFIGS[style];
    const phrases = phrasesRef.current;

    // ── Headline overlay (static, always visible) ─────────────────────
    if (headlineText) {
      const hlFontSize = Math.round(h * 0.055);
      ctx.font = `bold ${hlFontSize}px Impact, Arial Black, sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      const hlX = w / 2;
      const hlY = h * headlineY;
      ctx.strokeStyle = "#000000";
      ctx.lineWidth = 6;
      ctx.lineJoin = "round";
      ctx.strokeText(headlineText, hlX, hlY);
      ctx.fillStyle = "#FFFFFF";
      ctx.fillText(headlineText, hlX, hlY);
    }

    // ── Subtitles ─────────────────────────────────────────────────────
    // Find the active phrase
    const activePhrase = phrases.find((p) => t >= p.start && t <= p.end + 0.05);
    if (!activePhrase) return;

    const fontSize = Math.round(h * config.fontSize);
    const fontWeight = config.bold ? "bold " : "";
    ctx.font = `${fontWeight}${fontSize}px ${config.fontFamily}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    const displayText = activePhrase.emoji
      ? `${activePhrase.text} ${activePhrase.emoji}`
      : activePhrase.text;

    const x = w / 2;
    // yPositionOverride (0–1) takes precedence over style default
    const yFraction =
      yPositionOverride !== undefined
        ? Math.max(0, Math.min(1, yPositionOverride))
        : config.yFraction;
    const y = h * yFraction;

    // Outline
    ctx.strokeStyle = config.outlineColor;
    ctx.lineWidth = config.outlineWidth;
    ctx.lineJoin = "round";
    ctx.strokeText(displayText, x, y);

    // Fill — use highlightFill if any word in phrase is flagged
    ctx.fillStyle = activePhrase.hasHighlight ? config.highlightFill : config.fillColor;
    ctx.fillText(displayText, x, y);
  }, [videoRef, style, yPositionOverride, headlineText, headlineY]);

  useEffect(() => {
    const loop = () => {
      drawFrame();
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [drawFrame]);

  return (
    <canvas
      ref={canvasRef}
      className={className}
      style={{
        position: "absolute",
        inset: 0,
        pointerEvents: "none",
        width: "100%",
        height: "100%",
      }}
    />
  );
}
