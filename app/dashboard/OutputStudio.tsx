"use client";

import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { motion, AnimatePresence, Reorder, useDragControls } from "framer-motion";

interface OutputStudioProps {
  onBack: () => void;
}

// ─── Block Editor Types ───────────────────────────────────────────────────────

type BlockType = 'h1' | 'h2' | 'h3' | 'paragraph' | 'youtube' | 'image' | 'blockquote' | 'pullquote' | 'callout';

interface Block {
  id: string;
  type: BlockType;
  content: string;
  url?: string;
  anchorId?: string;       // jump-link slug for h1/h2/h3 blocks
  dropCap?: boolean;       // first-letter drop cap for paragraph blocks
  calloutIcon?: string;    // emoji icon for callout blocks (default '💡')
  calloutColor?: string;   // bg color key for callout (default 'yellow')
  attribution?: string;    // citation line for blockquote/pullquote
}

// ─── Block Utilities ──────────────────────────────────────────────────────────

function genId(): string {
  return Math.random().toString(36).slice(2, 10);
}

function extractYouTubeId(url?: string): string | null {
  if (!url) return null;
  const m = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
  return m ? m[1] : null;
}

function sectionToBlocks(sections: { title: string; content: string }[]): Block[] {
  const result: Block[] = [];
  sections.forEach(s => {
    result.push({ id: genId(), type: 'h2', content: s.title });
    result.push({ id: genId(), type: 'paragraph', content: s.content });
  });
  return result;
}

// ─── Analytics Engine ─────────────────────────────────────────────────────────

const FILLER_WORDS = new Set([
  'the','a','an','is','are','was','were','be','been','being','have','has','had',
  'do','does','did','will','would','could','should','may','might','must','shall',
  'can','that','this','these','those','it','its','very','really','just','also',
  'quite','rather','actually','literally','basically','honestly','simply','i',
  'me','my','we','us','our','you','your','and','but','or','so','because','if',
  'when','while','like','only','even','still','then','to','of','in','for','on',
  'with','at','by','from','as','into','through','about','than','he','she','they',
  'them','his','her','their','what','which','who','how','all','each','both',
]);

function countSyllables(word: string): number {
  word = word.toLowerCase().replace(/[^a-z]/g, '');
  if (word.length <= 3) return 1;
  word = word.replace(/e$/, '');
  const v = word.match(/[aeiouy]{1,2}/g);
  return Math.max(1, v ? v.length : 1);
}

function getTextStats(text: string) {
  const words = text.split(/\s+/).filter(w => w.length > 0);
  const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
  const syllables = words.reduce((n, w) => n + countSyllables(w), 0);
  return { words: words.length, sentences: Math.max(1, sentences.length), syllables };
}

function computeReadingLevel(text: string): string {
  const { words, sentences, syllables } = getTextStats(text);
  if (words < 10) return 'N/A';
  const asl = words / sentences;
  const asw = syllables / words;
  const grade = Math.max(0, 0.39 * asl + 11.8 * asw - 15.59);
  if (grade <= 6) return 'Grade 6';
  if (grade <= 8) return 'Grade 8';
  if (grade <= 10) return 'Grade 10';
  if (grade <= 12) return 'Grade 12';
  return 'College';
}

function computeLexicalDensity(text: string): number {
  const words = text.toLowerCase().replace(/[^a-z\s]/g, '').split(/\s+/).filter(w => w.length > 0);
  if (words.length === 0) return 0;
  const content = words.filter(w => !FILLER_WORDS.has(w)).length;
  return Math.round((content / words.length) * 100);
}

interface SEOResult { score: number; wordCount: number; keywordDensity: number; readability: number; headingScore: number; }
interface GEOResult { score: number; grade: 'A'|'B'|'C'|'D'|'F'; topSuggestion: string; factualDensity: number; citationFormat: number; entityPresence: number; }

function computeSEOScore(blocks: Block[], keyword: string): SEOResult {
  const text = blocks.map(b => b.content).join(' ');
  const { words, sentences, syllables } = getTextStats(text);

  // Readability 0-20
  const asl = words / Math.max(1, sentences);
  const asw = syllables / Math.max(1, words);
  const ease = 206.835 - 1.015 * asl - 84.6 * asw;
  const readability = ease >= 60 ? 20 : ease >= 50 ? 16 : ease >= 40 ? 12 : ease >= 30 ? 8 : 4;

  // Word count 0-15
  const wordCount = words >= 300 && words <= 1500 ? 15 : words >= 200 ? 12 : words >= 100 ? 8 : 4;

  // Keyword density 0-20
  const kw = keyword.toLowerCase();
  const kwCount = text.toLowerCase().split(/\s+/).filter(w => w.includes(kw)).length;
  const density = words > 0 ? (kwCount / words) * 100 : 0;
  const keywordDensity = density >= 0.5 && density <= 2.5 ? 20 : density >= 0.3 ? 15 : density > 0 ? 8 : 0;

  // Heading structure 0-15
  const h1s = blocks.filter(b => b.type === 'h1').length;
  const h2s = blocks.filter(b => b.type === 'h2').length;
  const headingScore = (h1s === 1 ? 5 : 0) + (h2s >= 2 ? 7 : h2s >= 1 ? 4 : 0) + (h2s >= 1 && blocks[0]?.content?.toLowerCase().includes(kw) ? 3 : 0);

  // Sentence length 0-15
  const sentenceList = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
  const longRatio = sentenceList.length > 0 ? sentenceList.filter(s => s.split(/\s+/).length > 25).length / sentenceList.length : 0;
  const sentenceScore = longRatio <= 0.1 ? 15 : longRatio <= 0.2 ? 11 : longRatio <= 0.3 ? 7 : 3;

  const score = Math.min(100, readability + wordCount + keywordDensity + headingScore + sentenceScore);
  return { score, wordCount: words, keywordDensity: Math.round(density * 10) / 10, readability, headingScore };
}

function computeGEOScore(blocks: Block[]): GEOResult {
  const text = blocks.map(b => b.content).join(' ');
  const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);

  // Factual density 0-25
  const factIndicators = [/\d+%/, /\d+\s*(million|billion|thousand|k)/i, /\d{4}/, /\$\d+/, /according to/i, /study found/i, /research/i, /data shows?/i];
  const factualSentences = sentences.filter(s => factIndicators.some(p => p.test(s))).length;
  const factualDensity = Math.min(25, Math.round((factualSentences / Math.max(1, sentences.length)) * 25));

  // Citation format 0-25 (lists, definitions, headings)
  const h2count = blocks.filter(b => b.type === 'h2' || b.type === 'h3').length;
  const citationFormat = Math.min(25, h2count * 5 + (text.includes(':') ? 5 : 0) + (/"[^"]{15,}"/.test(text) ? 5 : 0));

  // Entity presence 0-25
  const numbers = (text.match(/\d+(\.\d+)?/g) || []).length;
  const entityPresence = Math.min(25, numbers * 3);

  // Statistical evidence 0-25
  const pcts = (text.match(/\d+(\.\d+)?%/g) || []).length;
  const statEvidence = Math.min(25, pcts * 6 + (text.match(/\d{4}/g) || []).length * 3);

  const score = Math.min(100, factualDensity + citationFormat + entityPresence + statEvidence);
  const grade: GEOResult['grade'] = score >= 90 ? 'A' : score >= 80 ? 'B' : score >= 70 ? 'C' : score >= 60 ? 'D' : 'F';

  const topSuggestion =
    factualDensity < 10 ? "Add data points and statistics to boost citability" :
    citationFormat < 10 ? "Use H2 headings to improve AI extractability" :
    entityPresence < 10 ? "Include more numbers and named entities" :
    "Great citability — add a quoted statistic to reach A grade";

  return { score, grade, topSuggestion, factualDensity, citationFormat, entityPresence };
}

const SLASH_COMMANDS: { id: string; label: string; type: BlockType; icon: string }[] = [
  { id: 'p',   label: 'Paragraph',  type: 'paragraph', icon: '¶' },
  { id: 'h1',  label: 'Heading 1',  type: 'h1',        icon: 'H1' },
  { id: 'h2',  label: 'Heading 2',  type: 'h2',        icon: 'H2' },
  { id: 'h3',  label: 'Heading 3',  type: 'h3',        icon: 'H3' },
  { id: 'yt',  label: 'YouTube',    type: 'youtube',   icon: '▶' },
  { id: 'img', label: 'Image',      type: 'image',     icon: '⬜' },
  { id: 'bq',  label: 'Block Quote',  type: 'blockquote', icon: '"' },
  { id: 'pq',  label: 'Pull Quote',   type: 'pullquote',  icon: '❝' },
  { id: 'co',  label: 'Callout',      type: 'callout',    icon: '💡' },
];

const GEO_FACTUAL_GROUNDING = [
  { claim: '"AI compute costs dropped ~40% per year"',    verified: true  },
  { claim: '"$2M budget in 2022 → $50K today"',          verified: true  },
  { claim: '"Multimodal AI reasoning across modalities"', verified: true  },
];

const CALLOUT_COLORS: Record<string, { bg: string; border: string; icon: string }> = {
  yellow: { bg: '#fffbeb', border: '#fcd34d', icon: '💡' },
  blue:   { bg: '#eff6ff', border: '#93c5fd', icon: '📘' },
  green:  { bg: '#f0fdf4', border: '#86efac', icon: '✅' },
  red:    { bg: '#fef2f2', border: '#fca5a5', icon: '⚠️' },
  purple: { bg: '#faf5ff', border: '#c4b5fd', icon: '✨' },
};

function formatTimeAgo(ts: number): string {
  const diff = Date.now() - ts;
  const m = Math.floor(diff / 60000);
  const h = Math.floor(diff / 3600000);
  if (m < 1) return 'Just now';
  if (m < 60) return `${m}m ago`;
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function parseInlineMarkdown(text: string): string {
  let result = text
    // Bold: **text**
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    // Italic: *text* (but not **)
    .replace(/(?<!\*)\*(?!\*)(.*?)(?<!\*)\*(?!\*)/g, '<em>$1</em>')
    // Link: [text](url)
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer" class="text-[#fd6333] underline hover:opacity-80">$1</a>');
  return result;
}

interface BlockItemProps {
  block: Block;
  isEditing: boolean;
  isToolbarVisible: boolean;
  isTypeMenuOpen: boolean;
  editedContent: Record<string, string>;
  setEditingSection: (id: string | null) => void;
  setEditedContent: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  setActiveBlocks: (updater: Block[] | ((prev: Block[]) => Block[])) => void;
  setBlockToolbarId: (id: string | null) => void;
  setBlockTypeMenuId: (id: string | null) => void;
  setSlashMenuPos: React.Dispatch<React.SetStateAction<{ x: number, y: number }>>;
  setSlashTargetId: React.Dispatch<React.SetStateAction<string | null>>;
  setSlashFilter: React.Dispatch<React.SetStateAction<string>>;
  setSlashMenuOpen: React.Dispatch<React.SetStateAction<boolean>>;
  formatToolbarBlockId: string | null;
  setFormatToolbarBlockId: (id: string | null) => void;
  linkInputBlockId: string | null;
  setLinkInputBlockId: (id: string | null) => void;
  linkInputValue: string;
  setLinkInputValue: (v: string) => void;
  anchorMenuId: string | null;
  setAnchorMenuId: (id: string | null) => void;
}

function BlockItem({
  block,
  isEditing,
  isToolbarVisible,
  isTypeMenuOpen,
  editedContent,
  setEditingSection,
  setEditedContent,
  setActiveBlocks,
  setBlockToolbarId,
  setBlockTypeMenuId,
  setSlashMenuPos,
  setSlashTargetId,
  setSlashFilter,
  setSlashMenuOpen,
  formatToolbarBlockId,
  setFormatToolbarBlockId,
  linkInputBlockId,
  setLinkInputBlockId,
  linkInputValue,
  setLinkInputValue,
  anchorMenuId,
  setAnchorMenuId,
}: BlockItemProps) {
  const dragControls = useDragControls();
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const applyInlineFormat = (format: 'bold' | 'italic' | 'link', blockId: string) => {
    const ta = textareaRef.current;
    if (!ta) return;
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const value = editedContent[blockId] ?? block.content;
    const selected = value.slice(start, end);
    if (!selected) return;

    let wrapped: string;
    if (format === 'bold') wrapped = `**${selected}**`;
    else if (format === 'italic') wrapped = `*${selected}*`;
    else {
      wrapped = `[${selected}](${linkInputValue || 'https://'})`;
      setLinkInputBlockId(null);
      setLinkInputValue('');
    }

    const newValue = value.slice(0, start) + wrapped + value.slice(end);
    setEditedContent(prev => ({ ...prev, [blockId]: newValue }));
    setTimeout(() => {
      ta.setSelectionRange(start + wrapped.length, start + wrapped.length);
      ta.focus();
    }, 0);
  };

  return (
    <Reorder.Item
      key={block.id}
      value={block}
      id={`block-${block.id}`}
      dragListener={false}
      dragControls={dragControls}
      className="relative group"
      whileDrag={{ scale: 1.01, boxShadow: "0 4px 20px rgba(0,0,0,0.08)", zIndex: 50 }}
    >
      {/* Block wrapper */}
      <div
        className="flex items-start gap-2 rounded-xl px-2 py-1 hover:bg-gray-50/60 transition-colors"
        onMouseEnter={() => setBlockToolbarId(block.id)}
        onMouseLeave={() => { setBlockToolbarId(null); setBlockTypeMenuId(null); }}
      >
        {/* Drag handle */}
        <div
          onPointerDown={(e) => dragControls.start(e)}
          className={`flex-shrink-0 mt-1 w-5 h-5 flex items-center justify-center rounded cursor-grab active:cursor-grabbing transition-opacity ${isToolbarVisible ? 'opacity-40 hover:opacity-80' : 'opacity-0'}`}
          style={{ touchAction: "none" }}
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor" className="text-gray-400 pointer-events-none">
            <circle cx="3" cy="2" r="1.2"/><circle cx="9" cy="2" r="1.2"/>
            <circle cx="3" cy="6" r="1.2"/><circle cx="9" cy="6" r="1.2"/>
            <circle cx="3" cy="10" r="1.2"/><circle cx="9" cy="10" r="1.2"/>
          </svg>
        </div>

        {/* Block content */}
        <div className="flex-1 min-w-0">
          {/* PARAGRAPH BLOCK */}
          {block.type === 'paragraph' && (
            isEditing ? (
              <div className="w-full">
                <AnimatePresence>
                  {formatToolbarBlockId === block.id && (
                    <motion.div
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 4 }}
                      className="flex items-center gap-0.5 bg-white border border-gray-200 rounded-xl shadow-lg px-1.5 py-1 mb-2 w-max"
                      onMouseDown={e => e.preventDefault()} // prevent textarea blur
                    >
                      <button
                        onMouseDown={e => { e.preventDefault(); applyInlineFormat('bold', block.id); }}
                        className="w-7 h-7 flex items-center justify-center rounded-lg text-[12px] font-bold text-[#374151] hover:bg-[#fd63330f] hover:text-[#fd6333] transition-colors"
                        title="Bold (⌘B)"
                      >B</button>
                      <button
                        onMouseDown={e => { e.preventDefault(); applyInlineFormat('italic', block.id); }}
                        className="w-7 h-7 flex items-center justify-center rounded-lg text-[12px] italic font-semibold text-[#374151] hover:bg-[#fd63330f] hover:text-[#fd6333] transition-colors"
                        title="Italic (⌘I)"
                      >I</button>
                      <div className="w-px h-4 bg-gray-200 mx-0.5" />
                      <button
                        onMouseDown={e => {
                          e.preventDefault();
                          if (linkInputBlockId === block.id) {
                            applyInlineFormat('link', block.id);
                          } else {
                            setLinkInputBlockId(block.id);
                            setLinkInputValue('https://');
                          }
                        }}
                        className={`w-7 h-7 flex items-center justify-center rounded-lg text-[11px] transition-colors ${linkInputBlockId === block.id ? 'bg-[#fd6333] text-white' : 'text-[#374151] hover:bg-[#fd63330f] hover:text-[#fd6333]'}`}
                        title="Link (⌘K)"
                      >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
                          <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
                        </svg>
                      </button>
                      {/* Link URL input */}
                      {linkInputBlockId === block.id && (
                        <motion.div
                          initial={{ opacity: 0, width: 0 }}
                          animate={{ opacity: 1, width: 'auto' }}
                          className="flex items-center gap-1 overflow-hidden ml-1"
                        >
                          <input
                            autoFocus
                            value={linkInputValue}
                            onChange={e => setLinkInputValue(e.target.value)}
                            onKeyDown={e => {
                              if (e.key === 'Enter') { e.preventDefault(); applyInlineFormat('link', block.id); }
                              if (e.key === 'Escape') { setLinkInputBlockId(null); setLinkInputValue(''); }
                            }}
                            placeholder="https://"
                            className="text-[11px] px-2 py-0.5 rounded-lg border border-gray-200 outline-none focus:border-[#fd6333] w-40 text-[#374151] placeholder-gray-300"
                          />
                          <button
                            onMouseDown={e => { e.preventDefault(); applyInlineFormat('link', block.id); }}
                            className="w-6 h-6 flex items-center justify-center rounded-lg bg-[#fd6333] text-white text-[10px] font-bold hover:opacity-90 transition-opacity"
                          >→</button>
                        </motion.div>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
                <textarea
                  ref={textareaRef}
                  autoFocus
                  onSelect={() => {
                    const ta = textareaRef.current;
                    if (!ta) return;
                    if (ta.selectionStart !== ta.selectionEnd) {
                      setFormatToolbarBlockId(block.id);
                    } else {
                      setFormatToolbarBlockId(null);
                      setLinkInputBlockId(null);
                    }
                  }}
                  value={editedContent[block.id] ?? block.content}
                  onChange={e => setEditedContent(prev => ({ ...prev, [block.id]: e.target.value }))}
                  onBlur={() => {
                    if (editedContent[block.id] !== undefined) {
                      setActiveBlocks((prev: Block[]) => prev.map(b => b.id === block.id ? { ...b, content: editedContent[block.id] } : b));
                    }
                    setEditingSection(null);
                    setFormatToolbarBlockId(null);
                    setLinkInputBlockId(null);
                  }}
                  onKeyDown={e => {
                    if ((e.metaKey || e.ctrlKey) && e.key === 'b') {
                      e.preventDefault();
                      applyInlineFormat('bold', block.id);
                    }
                    if ((e.metaKey || e.ctrlKey) && e.key === 'i') {
                      e.preventDefault();
                      applyInlineFormat('italic', block.id);
                    }
                    if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
                      e.preventDefault();
                      applyInlineFormat('link', block.id);
                    }
                    if (e.key === 'Escape') {
                      setEditingSection(null);
                      setFormatToolbarBlockId(null);
                      setLinkInputBlockId(null);
                    }
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      const newBlock: Block = { id: genId(), type: 'paragraph', content: '' };
                      setActiveBlocks((prev: Block[]) => {
                        const idx = prev.findIndex(b => b.id === block.id);
                        return [...prev.slice(0, idx + 1), newBlock, ...prev.slice(idx + 1)];
                      });
                      setEditingSection(newBlock.id);
                    }
                    if (e.key === '/') {
                      const val = editedContent[block.id] ?? block.content;
                      if (val === '' || val === '/') {
                        e.preventDefault();
                        const rect = (e.target as HTMLElement).getBoundingClientRect();
                        setSlashMenuPos({ x: rect.left, y: rect.bottom + 4 });
                        setSlashTargetId(block.id);
                        setSlashFilter('');
                        setSlashMenuOpen(true);
                      }
                    }
                  }}
                  className="w-full text-[14px] leading-relaxed text-[#374151] resize-none outline-none bg-transparent min-h-[24px]"
                  style={{ fontFamily: 'var(--font-merriweather), serif' }}
                  rows={3}
                />
              </div>
            ) : (
              <p
                onClick={() => {
                  setEditingSection(block.id);
                  setEditedContent(prev => ({ ...prev, [block.id]: block.content }));
                }}
                className={`text-[14px] leading-relaxed text-[#374151] cursor-text hover:bg-[#fd63330a] rounded-lg px-2 py-1 -mx-2 transition-colors min-h-[24px] ${block.dropCap ? 'drop-cap-active' : ''}`}
                style={{ fontFamily: 'var(--font-merriweather), serif' }}
              >
                {block.dropCap && block.content ? (
                  <span>
                    <span
                      style={{
                        fontFamily: 'var(--font-merriweather), serif',
                        fontSize: '3.5rem',
                        fontWeight: '700',
                        lineHeight: '0.8',
                        float: 'left',
                        marginRight: '0.15em',
                        marginTop: '0.05em',
                        color: '#16423c',
                      }}
                    >
                      {block.content[0]}
                    </span>
                    <span dangerouslySetInnerHTML={{ __html: parseInlineMarkdown(block.content.slice(1)) }} />
                  </span>
                ) : block.content 
                  ? <span dangerouslySetInnerHTML={{ __html: parseInlineMarkdown(block.content) }} />
                  : <span className="text-gray-300 italic">Empty paragraph — click to edit or type / for commands</span>
                }
              </p>
            )
          )}

          {/* HEADING BLOCKS (h1 / h2 / h3) */}
          {(block.type === 'h1' || block.type === 'h2' || block.type === 'h3') && (
            isEditing ? (
              <input
                autoFocus
                value={editedContent[block.id] ?? block.content}
                onChange={e => setEditedContent(prev => ({ ...prev, [block.id]: e.target.value }))}
                onBlur={() => {
                  if (editedContent[block.id] !== undefined) {
                    setActiveBlocks((prev: Block[]) => prev.map(b => b.id === block.id ? { ...b, content: editedContent[block.id] } : b));
                  }
                  setEditingSection(null);
                }}
                onKeyDown={e => {
                  if (e.key === 'Enter' || e.key === 'Escape') setEditingSection(null);
                }}
                className={`w-full bg-transparent border-b border-[#fd633340] outline-none text-[#16423c] font-bold ${block.type === 'h1' ? 'text-[22px]' : block.type === 'h2' ? 'text-[17px]' : 'text-[15px]'}`}
                style={{ fontFamily: 'var(--font-merriweather), serif' }}
              />
            ) : (
              <div
                onClick={() => {
                  setEditingSection(block.id);
                  setEditedContent(prev => ({ ...prev, [block.id]: block.content }));
                }}
                className={`cursor-text font-bold text-[#16423c] hover:bg-[#fd63330a] rounded-lg px-2 py-1 -mx-2 transition-colors ${block.type === 'h1' ? 'text-[22px]' : block.type === 'h2' ? 'text-[17px]' : 'text-[15px]'}`}
                style={{ fontFamily: 'var(--font-merriweather), serif' }}
              >
                <span className="flex items-center gap-2">
                  <span>{block.content || <span className="text-gray-300 italic font-normal text-[13px]">Empty heading</span>}</span>
                  {block.anchorId && (
                    <span className="text-[10px] font-mono text-[#fd633380] font-normal">#{block.anchorId}</span>
                  )}
                </span>
              </div>
            )
          )}

          {/* YOUTUBE BLOCK */}
          {block.type === 'youtube' && (
            <div className="w-full">
              {extractYouTubeId(block.url) ? (
                <div className="rounded-xl overflow-hidden border border-gray-100 shadow-sm">
                  <iframe
                    src={`https://www.youtube.com/embed/${extractYouTubeId(block.url)}`}
                    className="w-full aspect-video"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  />
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  <div className="flex items-center gap-3 bg-[#fd63330a] border border-[#fd633330] rounded-xl px-4 py-3">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="#fd6333"><path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1-2.89-2.89 2.89 2.89 0 0 1 2.89-2.89c.28 0 .54.04.79.1V9.01a6.27 6.27 0 0 0-.79-.05 6.34 6.34 0 0 0-6.34 6.34 6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.33-6.34V8.69a8.16 8.16 0 0 0 4.77 1.52V6.77a4.85 4.85 0 0 1-1-.08z"/></svg>
                    <input
                      placeholder="Paste YouTube URL here…"
                      value={block.url ?? ''}
                      onChange={e => setActiveBlocks((prev: Block[]) => prev.map(b => b.id === block.id ? { ...b, url: e.target.value } : b))}
                      className="flex-1 bg-transparent text-[13px] text-[#374151] outline-none placeholder-[#9ca3af]"
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* IMAGE PLACEHOLDER BLOCK */}
          {block.type === 'image' && (
            <div className="w-full">
              <button className="w-full flex items-center justify-center gap-3 bg-gray-50 border-2 border-dashed border-gray-200 hover:border-[#fd6333] hover:bg-[#fd63330a] rounded-xl py-8 transition-colors group/img">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="1.5" className="group-hover/img:stroke-[#fd6333] transition-colors"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                <span className="text-[13px] text-[#9ca3af] group-hover/img:text-[#fd6333] font-medium transition-colors">Click to insert image</span>
              </button>
            </div>
          )}

          {/* BLOCKQUOTE BLOCK */}
          {block.type === 'blockquote' && (
            <div className="border-l-[3px] border-[#fd6333] pl-4 py-1">
              {isEditing ? (
                <div className="flex flex-col gap-2">
                  <textarea
                    autoFocus
                    value={editedContent[block.id] ?? block.content}
                    onChange={e => setEditedContent(prev => ({ ...prev, [block.id]: e.target.value }))}
                    onBlur={() => {
                      if (editedContent[block.id] !== undefined) {
                        setActiveBlocks((prev: Block[]) => prev.map(b => b.id === block.id ? { ...b, content: editedContent[block.id] } : b));
                      }
                      setEditingSection(null);
                    }}
                    onKeyDown={e => { if (e.key === 'Escape') setEditingSection(null); }}
                    placeholder="Quote text…"
                    className="w-full text-[14px] leading-relaxed text-[#374151] italic resize-none outline-none bg-transparent min-h-[24px]"
                    style={{ fontFamily: 'var(--font-merriweather), serif' }}
                    rows={2}
                  />
                  <input
                    value={block.attribution ?? ''}
                    onChange={e => setActiveBlocks((prev: Block[]) => prev.map(b => b.id === block.id ? { ...b, attribution: e.target.value } : b))}
                    placeholder="— Attribution (optional)"
                    className="text-[11px] text-[#6b7280] bg-transparent outline-none border-b border-gray-100 pb-0.5"
                  />
                </div>
              ) : (
                <div
                  onClick={() => { setEditingSection(block.id); setEditedContent(prev => ({ ...prev, [block.id]: block.content })); }}
                  className="cursor-text"
                >
                  <p className="text-[14px] leading-relaxed text-[#374151] italic" style={{ fontFamily: 'var(--font-merriweather), serif' }}>
                    {block.content || <span className="text-gray-300 not-italic">Quote text — click to edit</span>}
                  </p>
                  {block.attribution && (
                    <p className="text-[11px] text-[#6b7280] mt-1">— {block.attribution}</p>
                  )}
                </div>
              )}
            </div>
          )}

          {/* PULLQUOTE BLOCK */}
          {block.type === 'pullquote' && (
            <div className="py-4 px-6 text-center border-t-2 border-b-2 border-[#16423c20] my-2">
              {isEditing ? (
                <div className="flex flex-col gap-2">
                  <textarea
                    autoFocus
                    value={editedContent[block.id] ?? block.content}
                    onChange={e => setEditedContent(prev => ({ ...prev, [block.id]: e.target.value }))}
                    onBlur={() => {
                      if (editedContent[block.id] !== undefined) {
                        setActiveBlocks((prev: Block[]) => prev.map(b => b.id === block.id ? { ...b, content: editedContent[block.id] } : b));
                      }
                      setEditingSection(null);
                    }}
                    onKeyDown={e => { if (e.key === 'Escape') setEditingSection(null); }}
                    placeholder="Pull quote text…"
                    className="w-full text-center text-[18px] font-semibold leading-snug text-[#16423c] resize-none outline-none bg-transparent"
                    style={{ fontFamily: 'var(--font-merriweather), serif' }}
                    rows={2}
                  />
                  <input
                    value={block.attribution ?? ''}
                    onChange={e => setActiveBlocks((prev: Block[]) => prev.map(b => b.id === block.id ? { ...b, attribution: e.target.value } : b))}
                    placeholder="— Attribution (optional)"
                    className="text-[11px] text-center text-[#6b7280] bg-transparent outline-none"
                  />
                </div>
              ) : (
                <div
                  onClick={() => { setEditingSection(block.id); setEditedContent(prev => ({ ...prev, [block.id]: block.content })); }}
                  className="cursor-text"
                >
                  <p className="text-[18px] font-semibold leading-snug text-[#16423c]" style={{ fontFamily: 'var(--font-merriweather), serif' }}>
                    {block.content
                      ? `❝ ${block.content} ❞`
                      : <span className="text-gray-300 text-[14px] font-normal">Pull quote — click to edit</span>
                    }
                  </p>
                  {block.attribution && (
                    <p className="text-[11px] text-[#6b7280] mt-2">— {block.attribution}</p>
                  )}
                </div>
              )}
            </div>
          )}

          {/* CALLOUT BLOCK */}
          {block.type === 'callout' && (() => {
            const color = block.calloutColor ?? 'yellow';
            const scheme = CALLOUT_COLORS[color] ?? CALLOUT_COLORS.yellow;
            const icons = ['💡','📘','✅','⚠️','✨','🎯','🔔','💪'];
            return (
              <div
                className="flex items-start gap-3 rounded-xl px-4 py-3 border"
                style={{ backgroundColor: scheme.bg, borderColor: scheme.border }}
              >
                {/* Emoji toggle */}
                <button
                  onClick={() => {
                    const cur = icons.indexOf(block.calloutIcon ?? scheme.icon);
                    setActiveBlocks((prev: Block[]) => prev.map(b => b.id === block.id ? { ...b, calloutIcon: icons[(cur + 1) % icons.length] } : b));
                  }}
                  className="text-[20px] leading-none flex-shrink-0 hover:scale-110 transition-transform"
                  title="Click to change icon"
                >
                  {block.calloutIcon ?? scheme.icon}
                </button>
                {/* Content */}
                <div className="flex-1 min-w-0">
                  {isEditing ? (
                    <textarea
                      autoFocus
                      value={editedContent[block.id] ?? block.content}
                      onChange={e => setEditedContent(prev => ({ ...prev, [block.id]: e.target.value }))}
                      onBlur={() => {
                        if (editedContent[block.id] !== undefined) {
                          setActiveBlocks((prev: Block[]) => prev.map(b => b.id === block.id ? { ...b, content: editedContent[block.id] } : b));
                        }
                        setEditingSection(null);
                      }}
                      onKeyDown={e => { if (e.key === 'Escape') setEditingSection(null); }}
                      placeholder="Callout text…"
                      className="w-full text-[13px] leading-relaxed text-[#374151] resize-none outline-none bg-transparent min-h-[20px]"
                      rows={2}
                    />
                  ) : (
                    <p
                      onClick={() => { setEditingSection(block.id); setEditedContent(prev => ({ ...prev, [block.id]: block.content })); }}
                      className="text-[13px] leading-relaxed text-[#374151] cursor-text"
                    >
                      {block.content || <span className="text-gray-300 italic">Callout text — click to edit</span>}
                    </p>
                  )}
                </div>
                {/* Color picker */}
                <div className="flex gap-1 flex-shrink-0">
                  {Object.entries(CALLOUT_COLORS).map(([key, s]) => (
                    <button
                      key={key}
                      onClick={() => setActiveBlocks((prev: Block[]) => prev.map(b => b.id === block.id ? { ...b, calloutColor: key } : b))}
                      className="w-3.5 h-3.5 rounded-full border transition-transform hover:scale-110"
                      style={{ backgroundColor: s.border, borderColor: (block.calloutColor ?? 'yellow') === key ? '#374151' : 'transparent' }}
                      title={key}
                    />
                  ))}
                </div>
              </div>
            );
          })()}
        </div>

        {/* Block toolbar (type switcher + delete) */}
        <div className={`flex-shrink-0 flex items-center gap-1 mt-1 transition-opacity ${isToolbarVisible ? 'opacity-100' : 'opacity-0'}`}>
          {/* Type switcher */}
          <div className="relative">
            <button
              onClick={e => { e.stopPropagation(); setBlockTypeMenuId(isTypeMenuOpen ? null : block.id); }}
              className="w-7 h-7 flex items-center justify-center rounded-lg border border-gray-200 bg-white text-[10px] font-bold text-[#6b7280] hover:border-[#fd6333] hover:text-[#fd6333] transition-colors"
            >
              {block.type === 'paragraph' ? 'P' : block.type === 'h1' ? 'H1' : block.type === 'h2' ? 'H2' : block.type === 'h3' ? 'H3' : block.type === 'youtube' ? '▶' : '⬜'}
            </button>
            {isTypeMenuOpen && (
              <>
                <div className="fixed inset-0 z-30" onClick={() => setBlockTypeMenuId(null)} />
                <div className="absolute right-0 top-full mt-1 z-40 bg-white border border-gray-200 rounded-xl shadow-xl p-1.5 w-40">
                  {SLASH_COMMANDS.map(cmd => (
                    <button
                      key={cmd.id}
                      onClick={() => {
                        setActiveBlocks((prev: Block[]) => prev.map(b => b.id === block.id ? { ...b, type: cmd.type } : b));
                        setBlockTypeMenuId(null);
                      }}
                      className={`w-full flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-[12px] font-medium transition-colors ${block.type === cmd.type ? 'bg-[#16423c] text-white' : 'text-[#374151] hover:bg-gray-50'}`}
                    >
                      <span className="w-6 text-center font-mono text-[11px] text-[#6b7280]">{cmd.icon}</span>
                      {cmd.label}
                    </button>
                  ))}
                      {block.type === 'paragraph' && (
                        <>
                          <div className="my-1 h-px bg-gray-100" />
                          <button
                            onClick={() => {
                              setActiveBlocks((prev: Block[]) => prev.map(b => b.id === block.id ? { ...b, dropCap: !b.dropCap } : b));
                              setBlockTypeMenuId(null);
                            }}
                            className={`w-full flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-[12px] font-medium transition-colors ${block.dropCap ? 'bg-[#16423c] text-white' : 'text-[#374151] hover:bg-gray-50'}`}
                          >
                            <span className="w-6 text-center font-serif text-[14px] font-bold">A</span>
                            Drop Cap
                          </button>
                        </>
                      )}
                    </div>
                  </>
                )}
              </div>
              {/* Anchor Button */}
              {(block.type === 'h1' || block.type === 'h2' || block.type === 'h3') && (
                <div className="relative">
                  <button
                    onClick={e => { e.stopPropagation(); setAnchorMenuId(anchorMenuId === block.id ? null : block.id); }}
                    className={`w-7 h-7 flex items-center justify-center rounded-lg border transition-colors text-[10px] font-mono font-bold ${block.anchorId ? 'border-[#fd6333] bg-[#fd63330f] text-[#fd6333]' : 'border-gray-200 bg-white text-[#6b7280] hover:border-[#fd6333] hover:text-[#fd6333]'}`}
                    title="Set anchor / jump link"
                  >#</button>
                  {anchorMenuId === block.id && (
                    <>
                      <div className="fixed inset-0 z-30" onClick={() => setAnchorMenuId(null)} />
                      <div className="absolute right-0 top-full mt-1 z-40 bg-white border border-gray-200 rounded-xl shadow-xl p-3 w-52">
                        <p className="text-[10px] text-[#6b7280] font-medium mb-1.5 uppercase tracking-wide">Anchor / Jump Link</p>
                        <div className="flex items-center gap-1">
                          <span className="text-[#fd6333] font-mono text-[12px]">#</span>
                          <input
                            autoFocus
                            value={block.anchorId ?? ''}
                            onChange={e => {
                              const slug = e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-');
                              setActiveBlocks((prev: Block[]) => prev.map(b => b.id === block.id ? { ...b, anchorId: slug } : b));
                            }}
                            placeholder="e.g. conclusion"
                            className="flex-1 text-[12px] text-[#374151] outline-none border-b border-gray-200 focus:border-[#fd6333] pb-0.5 bg-transparent"
                          />
                        </div>
                        {block.anchorId && (
                          <button
                            onClick={() => {
                              navigator.clipboard.writeText(`#${block.anchorId}`);
                            }}
                            className="mt-2 w-full text-[10px] text-[#6b7280] hover:text-[#fd6333] flex items-center gap-1 transition-colors"
                          >
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                            Copy #{block.anchorId}
                          </button>
                        )}
                      </div>
                    </>
                  )}
                </div>
              )}
              {/* Delete */}
              <button
            onClick={() => setActiveBlocks((prev: Block[]) => prev.filter(b => b.id !== block.id))}
            className="w-7 h-7 flex items-center justify-center rounded-lg border border-gray-200 bg-white text-[#9ca3af] hover:border-red-300 hover:text-red-400 transition-colors"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"/></svg>
          </button>
        </div>
      </div>

      {/* Image anchor between blocks */}
      <div className="flex items-center gap-2 my-1 opacity-0 group-hover:opacity-100 transition-opacity px-9">
        <div className="flex-1 h-px bg-gray-100" />
        <button
          onClick={() => {
            const newBlock: Block = { id: genId(), type: 'paragraph', content: '' };
            setActiveBlocks((prev: Block[]) => {
              const idx = prev.findIndex(b => b.id === block.id);
              return [...prev.slice(0, idx + 1), newBlock, ...prev.slice(idx + 1)];
            });
            setEditingSection(newBlock.id);
          }}
          className="w-6 h-6 rounded-full border border-dashed border-gray-300 hover:border-[#fd6333] flex items-center justify-center text-[#9ca3af] hover:text-[#fd6333] text-[14px] transition-colors"
        >+</button>
        <div className="flex-1 h-px bg-gray-100" />
      </div>
    </Reorder.Item>
  );
}

const DEMO_FAILED = "c2-Shorts";

const AI_SUGGESTED_TIMES: Record<string, string> = {
  TikTok: "Tue 7:15 PM",
  Reels: "Wed 6:30 PM",
  Shorts: "Thu 5:00 PM",
  master: "Mon 8:00 PM",
  twitter: "Wed 9:00 AM",
  linkedin: "Tue 8:30 AM",
  instagram: "Fri 7:00 PM",
  facebook: "Fri 6:00 PM",
  pinterest: "Thu 2:00 PM",
  blog: "Mon 10:00 AM",
};

const MOCK = {
  request: {
    id: "REQ-1234",
    creditsUsed: 7,
    creditsBalance: 143,
  },
  video: {
    title: "The Future of AI in 2025: What Nobody's Talking About",
    channel: "TechVision",
    duration: "42:18",
    url: "https://youtu.be/dQw4w9WgXcQ",
  },
  clusters: [
    {
      id: "c1",
      title: "The Hook",
      viralityScore: 94,
      status: "completed",
      hero: { duration: "2:34", label: "Standard Cut" },
      variations: [
        { platform: "TikTok", duration: "0:58", status: "completed" },
        { platform: "Reels", duration: "1:02", status: "completed" },
        { platform: "Shorts", duration: "0:47", status: "completed" },
      ],
      captions: {
        TikTok: "POV: AI just made your job 10x easier 🤯 This moment from the doc changed how I think about the future. Watch the full thing (link in bio) #AI #FutureOfWork #TechTok",
        Reels: "Nobody's talking about this AI shift 👇 Swipe up for the full 42-min documentary. #AIRevolution #Innovation #Reels",
        Shorts: "The AI stat that will blow your mind. Full video linked! #Shorts #AI #TechNews",
      } as Record<string, string>,
    },
    {
      id: "c2",
      title: "The Key Insight",
      viralityScore: 78,
      status: "processing",
      currentStage: "Rendering Variation #2...",
      hero: { duration: "1:47", label: "Highlight Cut" },
      variations: [
        { platform: "TikTok", duration: "0:45", status: "completed" },
        { platform: "Reels", duration: "0:50", status: "processing" },
        { platform: "Shorts", duration: "0:38", status: "pending" },
      ],
      captions: {
        TikTok: "The economics of intelligence are shifting faster than you think 📊 #AI #Economics #Innovation",
        Reels: "Coming soon...",
        Shorts: "Coming soon...",
      } as Record<string, string>,
    },
  ],
  social: {
    twitter: [
      {
        id: "t1",
        title: "The Technical Breakdown",
        status: "completed",
        posts: [
          "🤯 AI is about to change EVERYTHING in 2025. Here's what most people are missing:\n\n1/ Compute cost dropping 10x every 18 months\n2/ Multimodal AI is the real game changer\n3/ Your job isn't at risk — your *role* is\n\nThread 🧵",
          "2/ The cost curve is following solar energy's playbook. What cost $2M in 2022 runs for $50K today.\n\nThis isn't theoretical. Companies are already shipping products built on this economics shift.",
          "3/ The winners aren't building the biggest models. They're building the best integrations.\n\nSilent AI — embedded in every tool, every workflow, every decision — is already here.\n\n/end",
        ],
      },
      {
        id: "t2",
        title: "The Summary",
        status: "completed",
        posts: [
          "Just watched this 42-min AI documentary so you don't have to.\n\nThe single most important takeaway:\n\nThe future belongs to those who *direct* AI, not compete with it.\n\n🔗 Link in bio",
          "The shift isn't coming. It's already happened. Most people just haven't noticed yet.",
        ],
      },
    ],
    linkedin: [
      {
        id: "l1",
        title: "Thought Leadership Post",
        status: "completed",
        content: "After watching this documentary on AI's trajectory, three insights stood out:\n\n1. The democratization of compute is accelerating faster than industry reports suggest. What cost $1M in 2022 costs $50K today.\n\n2. The companies winning aren't building the biggest models — they're building the best integrations.\n\n3. The future belongs to those who learn to direct AI, not compete with it.\n\nWhat's your take on AI's role in your industry over the next 24 months?\n\n#AI #FutureOfWork #Leadership #Innovation",
      },
    ],
    instagram: [
      {
        id: "i1",
        title: "Engagement Caption",
        status: "completed",
        content: "🎬 Just dropped: everything you need to know about AI in 2025 condensed into one post.\n\nThe full documentary link is in bio — 42 minutes that will change how you think about the next decade.\n\nSave this for later 📌\n\n#AI #FutureOfWork #Technology #Innovation #AITrends #TechNews #ArtificialIntelligence",
      },
    ],
  },
  blog: {
    qualityScore: 87,
    readingLevel: "Grade 9",
    metaDescription: "A deep-dive into how AI cost curves are democratizing enterprise intelligence — and what it means for your workflow in 2025.",
    title: "The Future of AI in 2025: What Nobody's Talking About",
    keywords: ["artificial intelligence", "compute costs", "multimodal AI", "workflow automation", "AI integration", "future of work", "machine learning", "LLM"],
    keywordDensity: {
      "artificial intelligence": 3.2,
      "compute costs": 1.8,
      "multimodal AI": 1.4,
      "future of work": 1.1,
      "workflow automation": 0.9,
    },
    versions: [
      {
        id: "v1",
        template: "SEO Optimized",
        sections: [
          { title: "The Silent Revolution", content: "While headlines focus on dramatic AI breakthroughs, a quieter transformation is reshaping industries at their foundation. The democratization of compute — a trend accelerating faster than most analysts predict — is placing enterprise-grade AI capabilities in the hands of startups and individual creators alike." },
          { title: "The Economics of Intelligence", content: "The cost curve of AI inference has followed a trajectory reminiscent of solar energy: each doubling of capacity brings roughly a 40% reduction in cost. What required a $2M engineering budget in 2022 can be replicated today with open-source tools and $50K in cloud credits." },
          { title: "Multimodal AI: The Real Frontier", content: "Text-only AI was always a limited lens on human cognition. The rise of genuinely capable multimodal systems — models that see, hear, and reason across modalities simultaneously — represents the most significant capability jump since the transformer architecture itself." },
          { title: "What This Means for You", content: "The creators, marketers, and knowledge workers who will thrive in the AI-augmented economy share one trait: they're learning to direct AI with precision rather than compete with it on raw output volume. The skill premium is shifting from production to curation, from execution to vision." },
        ],
        blocks: sectionToBlocks([
          { title: "The Silent Revolution", content: "While headlines focus on dramatic AI breakthroughs, a quieter transformation is reshaping industries at their foundation. The democratization of compute — a trend accelerating faster than most analysts predict — is placing enterprise-grade AI capabilities in the hands of startups and individual creators alike." },
          { title: "The Economics of Intelligence", content: "The cost curve of AI inference has followed a trajectory reminiscent of solar energy: each doubling of capacity brings roughly a 40% reduction in cost. What required a $2M engineering budget in 2022 can be replicated today with open-source tools and $50K in cloud credits." },
          { title: "Multimodal AI: The Real Frontier", content: "Text-only AI was always a limited lens on human cognition. The rise of genuinely capable multimodal systems — models that see, hear, and reason across modalities simultaneously — represents the most significant capability jump since the transformer architecture itself." },
          { title: "What This Means for You", content: "The creators, marketers, and knowledge workers who will thrive in the AI-augmented economy share one trait: they're learning to direct AI with precision rather than compete with it on raw output volume. The skill premium is shifting from production to curation, from execution to vision." },
        ]),
      },
      {
        id: "v2",
        template: "Storytelling",
        sections: [
          { title: "A Quiet Shift", content: "It didn't arrive with fanfare. No press conference, no product launch event. The revolution in artificial intelligence crept into the world through server farms, API invoices, and the quiet hum of inference engines spinning up at a fraction of yesterday's cost." },
          { title: "The Price Nobody Predicted", content: "In 2022, training a frontier model cost the GDP of a small city. By 2025, the same capability sits behind a $20/month API key. The economists who study technology adoption call this an 'S-curve inflection'. Everyone else just calls it a surprise." },
          { title: "Seeing, Hearing, Thinking", content: "The moment AI stopped being a text box and started seeing images, listening to audio, and reasoning across modalities — that's when the real story began. Not a tool upgrade. A cognitive leap." },
          { title: "The New Skill", content: "The people quietly winning aren't the ones who know the most code. They're the ones who've learned a stranger skill: how to think alongside a machine. Curation over creation. Vision over execution. Direction over output." },
        ],
        blocks: sectionToBlocks([
          { title: "A Quiet Shift", content: "It didn't arrive with fanfare. No press conference, no product launch event. The revolution in artificial intelligence crept into the world through server farms, API invoices, and the quiet hum of inference engines spinning up at a fraction of yesterday's cost." },
          { title: "The Price Nobody Predicted", content: "In 2022, training a frontier model cost the GDP of a small city. By 2025, the same capability sits behind a $20/month API key. The economists who study technology adoption call this an 'S-curve inflection'. Everyone else just calls it a surprise." },
          { title: "Seeing, Hearing, Thinking", content: "The moment AI stopped being a text box and started seeing images, listening to audio, and reasoning across modalities — that's when the real story began. Not a tool upgrade. A cognitive leap." },
          { title: "The New Skill", content: "The people quietly winning aren't the ones who know the most code. They're the ones who've learned a stranger skill: how to think alongside a machine. Curation over creation. Vision over execution. Direction over output." },
        ]),
      },
    ],
  },
};

const MOCK_CAMPAIGNS = [
  {
    id: "camp1",
    title: "The Industry Secret",
    viralityScore: 94,
    status: "completed" as const,
    imageCount: 3,
    platforms: {
      twitter: {
        type: "thread",
        posts: [
          "🤯 AI is about to change EVERYTHING in 2025. Here's what most people are missing:\n\n1/ Compute cost dropping 10x every 18 months\n2/ Multimodal AI is the real game changer\n3/ Your job isn't at risk — your *role* is\n\nThread 🧵",
          "2/ The cost curve is following solar energy's playbook. What cost $2M in 2022 runs for $50K today.\n\nThis isn't theoretical. Companies are already shipping products built on this economics shift.",
          "3/ The winners aren't building the biggest models. They're building the best integrations.\n\nSilent AI — embedded in every tool, every workflow, every decision — is already here.\n\n/end",
        ],
      },
      instagram: {
        type: "carousel",
        slideCount: 4,
        caption: "Nobody's talking about this AI shift 👇\n\nSwipe through for the 4 things that will reshape your industry before 2026.",
        hashtags: "#AI #FutureOfWork #Innovation #TechNews #ArtificialIntelligence #AIRevolution",
      },
      linkedin: {
        type: "post",
        headline: "3 AI trends that most leaders are still missing in 2025",
        content: "After watching this documentary on AI's trajectory, three insights stood out:\n\n1. The democratization of compute is accelerating faster than industry reports suggest.\n\n2. The companies winning aren't building the biggest models — they're building the best integrations.\n\n3. The future belongs to those who learn to direct AI, not compete with it.",
      },
      facebook: {
        type: "post",
        content: "Just watched a 42-min AI documentary so you don't have to.\n\nThe single most important takeaway: The future belongs to those who *direct* AI, not compete with it.\n\nSave this post for your team meeting 👇",
      },
      pinterest: {
        type: "pin",
        pinTitle: "5 AI Trends Reshaping Work in 2025 [Infographic]",
        altText: "Infographic showing 5 key AI trends: compute cost drops, multimodal AI, silent AI integration, role evolution, and creator economy shift",
        caption: "The economics of intelligence are shifting. Here's what you need to know to stay ahead.",
      },
    },
  },
  {
    id: "camp2",
    title: "The Silent Revolution",
    viralityScore: 78,
    status: "processing" as const,
    imageCount: 2,
    platforms: {
      twitter: {
        type: "thread",
        posts: [
          "Just watched this 42-min AI documentary so you don't have to.\n\nThe single most important takeaway:\n\nThe future belongs to those who *direct* AI, not compete with it.\n\n🔗 Link in bio",
          "The shift isn't coming. It's already happened. Most people just haven't noticed yet.",
        ],
      },
      instagram: {
        type: "carousel",
        slideCount: 2,
        caption: "🎬 Everything you need to know about AI in 2025 condensed into 2 slides.\n\nSave this for later 📌",
        hashtags: "#AI #FutureOfWork #Technology #Innovation #AITrends",
      },
      linkedin: {
        type: "post",
        headline: "The AI shift that happened while we weren't looking",
        content: "What if the most important AI transition already happened — and most companies missed it?\n\nThe democratization of compute has created a new playing field. The question is: which side are you on?",
      },
      facebook: {
        type: "post",
        content: "The economics of AI just changed everything. Here's a quick breakdown of what it means for your business in 2025.",
      },
      pinterest: {
        type: "pin",
        pinTitle: "AI's Silent Revolution: What You Missed [2025 Guide]",
        altText: "Visual guide showing the timeline of AI democratization from 2022 to 2025",
        caption: "The revolution happened quietly. Here's your catch-up guide.",
      },
    },
  },
];

export default function OutputStudio({ onBack }: OutputStudioProps) {
  const [activeTab, setActiveTab] = useState<"clips" | "social" | "blog">("clips");
  const [blogTemplate, setBlogTemplate] = useState<string>("SEO Optimized");
  const [activeCaptions, setActiveCaptions] = useState<Record<string, string>>({
    c1: "TikTok",
    c2: "TikTok",
  });
  const [openCaptions, setOpenCaptions] = useState<Record<string, boolean>>({});
  const [gaugeAnimated, setGaugeAnimated] = useState(false);

  // New states
  const [selectedItems, setSelectedItems] = useState<Record<string, boolean>>({});
  const [scheduledTimes, setScheduledTimes] = useState<Record<string, string>>({});
  const [openSchedulePicker, setOpenSchedulePicker] = useState<string | null>(null);
  const [clusterTitles, setClusterTitles] = useState<Record<string, string>>(
    Object.fromEntries(MOCK.clusters.map(c => [c.id, c.title]))
  );
  const [editingTitle, setEditingTitle] = useState<string | null>(null);
  const [subtitleStyle, setSubtitleStyle] = useState<string>("Yellow Box");
  const [showWhyTooltip, setShowWhyTooltip] = useState<string | null>(null);

  // Social tab new states
  const [activeSocialFilter, setActiveSocialFilter] = useState<"twitter" | "instagram" | "pinterest" | "linkedin" | "facebook">("twitter");
  const [editingCampaignTitle, setEditingCampaignTitle] = useState<string | null>(null);
  const [campaignTitles, setCampaignTitles] = useState<Record<string, string>>(
    Object.fromEntries(MOCK_CAMPAIGNS.map(c => [c.id, c.title]))
  );

  // Blog tab states
  const [activeBlogVersion, setActiveBlogVersion] = useState<string>("v1");
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({ "0": true });
  const [editingSection, setEditingSection] = useState<string | null>(null);
  const [editedContent, setEditedContent] = useState<Record<string, string>>({});
  const [blogSchedulePlatform, setBlogSchedulePlatform] = useState<string>("WordPress");

  // Block editor states
  const [versionBlocks, setVersionBlocks] = useState<Record<string, Block[]>>(() => {
    const result: Record<string, Block[]> = {};
    MOCK.blog.versions.forEach(v => {
      result[v.id] = (v as { id: string; template: string; sections: {title:string;content:string}[]; blocks?: Block[] }).blocks ?? sectionToBlocks(v.sections);
    });
    return result;
  });
  const [slashMenuOpen, setSlashMenuOpen] = useState(false);
  const [slashMenuPos, setSlashMenuPos] = useState({ x: 0, y: 0 });
  const [slashFilter, setSlashFilter] = useState('');
  const [slashTargetId, setSlashTargetId] = useState<string | null>(null);
  const [blockToolbarId, setBlockToolbarId] = useState<string | null>(null);
  const [blockTypeMenuId, setBlockTypeMenuId] = useState<string | null>(null);
  const [formatToolbarBlockId, setFormatToolbarBlockId] = useState<string | null>(null);
  const [linkInputBlockId, setLinkInputBlockId] = useState<string | null>(null);
  const [linkInputValue, setLinkInputValue] = useState('');
  const [postMetaOpen, setPostMetaOpen] = useState(false);
  const [postMeta, setPostMeta] = useState({
    ogTitle: MOCK.blog.title ?? 'How AI Is Reshaping the Future of Work',
    ogDescription: MOCK.blog.metaDescription ?? '',
    ogImage: '',
    canonicalUrl: '',
  });
  const [snapshots, setSnapshots] = useState<Array<{ id: string; timestamp: number; label: string; blocks: Block[] }>>([]);
  const [anchorMenuId, setAnchorMenuId] = useState<string | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setGaugeAnimated(true), 300);
    return () => clearTimeout(t);
  }, []);

  const totalSelected = Object.values(selectedItems).filter(Boolean).length;

  // Blog analytics (computed from active blocks)
  const activeBlocks = useMemo(() => versionBlocks[activeBlogVersion] ?? [], [versionBlocks, activeBlogVersion]);
  const blogText = useMemo(() => activeBlocks.filter(b => ['paragraph','h1','h2','h3'].includes(b.type)).map(b => b.content).join(' '), [activeBlocks]);
  const seoResult = useMemo(() => computeSEOScore(activeBlocks, MOCK.blog.keywords[0]), [activeBlocks]);
  const geoResult = useMemo(() => computeGEOScore(activeBlocks), [activeBlocks]);
  const readingLevel = useMemo(() => computeReadingLevel(blogText), [blogText]);
  const lexicalDensity = useMemo(() => computeLexicalDensity(blogText), [blogText]);
  const tocItems = useMemo(() => activeBlocks.filter(b => b.type === 'h2' || b.type === 'h3'), [activeBlocks]);

  const setActiveBlocks = useCallback((updater: Block[] | ((prev: Block[]) => Block[])) => {
    setVersionBlocks(prev => ({
      ...prev,
      [activeBlogVersion]: typeof updater === 'function' ? updater(prev[activeBlogVersion] ?? []) : updater,
    }));
  }, [activeBlogVersion]);

  // Social campaign item key: "campId-platform" e.g. "camp1-twitter"
  const hasSocialConflict = (itemKey: string): boolean => {
    const time = scheduledTimes[itemKey];
    if (!time) return false;
    const parts = itemKey.split('-');
    const platform = parts.slice(1).join('-');
    return Object.entries(scheduledTimes).some(([k, t]) =>
      k !== itemKey && k.endsWith('-' + platform) && t === time
    );
  };

  const renderSchedulePopover = (itemKey: string, aiKey: string, rightAligned: boolean = false, isUp: boolean = false) => {
    if (openSchedulePicker !== itemKey) return null;
    const posClass = isUp ? 'bottom-full mb-1' : 'top-full mt-1';
    const alignClass = rightAligned ? 'right-0' : 'left-0';
    return (
      <>
        <div className="fixed inset-0 z-30" onClick={() => setOpenSchedulePicker(null)} />
        <div className={`absolute ${posClass} ${alignClass} bg-white border border-gray-200 rounded-xl shadow-lg p-3 z-40 w-[180px]`}>
          <div className="text-[11px] font-bold text-[#16423c] mb-2">Set Time</div>
          <input type="time" id={`time-${itemKey}`} className="w-full text-[12px] border border-gray-200 rounded-lg px-2 py-1.5 outline-none focus:border-[#fd6333]" />
          <button 
            onClick={() => {
              setScheduledTimes(prev => ({ ...prev, [itemKey]: AI_SUGGESTED_TIMES[aiKey] || "12:00 PM" }));
              setOpenSchedulePicker(null);
            }}
            className="w-full mt-1.5 text-[11px] text-[#fd6333] border border-[#fd633330] rounded-lg py-1 font-semibold hover:bg-[#fd63330f] flex items-center justify-center gap-1"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/></svg>
            AI Suggest
          </button>
          <button 
            onClick={() => {
              const val = (document.getElementById(`time-${itemKey}`) as HTMLInputElement)?.value;
              if (val) {
                setScheduledTimes(prev => ({ ...prev, [itemKey]: val }));
              }
              setOpenSchedulePicker(null);
            }}
            className="w-full mt-1 bg-[#16423c] text-white text-[11px] font-semibold rounded-lg py-1 hover:opacity-90"
          >
            Confirm
          </button>
        </div>
      </>
    );
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
      className="min-h-screen font-sans bg-gradient-to-b from-[#fafafa] to-white relative"
    >
      {/* Dot grid background */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: "radial-gradient(circle at 1px 1px, rgba(0,0,0,0.065) 1px, transparent 0)",
          backgroundSize: "28px 28px",
        }}
      />
      <div className="relative z-10">
      {/* Sticky Header */}
      <div className="sticky top-0 z-20 bg-white border-b border-gray-100/80 shadow-[0_1px_6px_rgba(0,0,0,0.06)]">
        <div className="max-w-[1200px] mx-auto px-6 h-[57px] flex items-center justify-between gap-4">
          {/* LEFT: back button + breadcrumbs */}
          <div className="flex items-center gap-3 shrink-0">
            <button
              onClick={onBack}
              className="text-[#9ca3af] hover:text-[#374151] transition-colors flex items-center justify-center p-1 rounded-md hover:bg-gray-50"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="m15 18-6-6 6-6" />
              </svg>
            </button>
            <div className="text-[12px] text-[#9ca3af] flex items-center gap-1.5">
              <span>Projects</span>
              <span>/</span>
              <span className="truncate max-w-[150px]">{MOCK.video.title}</span>
              <span>/</span>
              <span className="text-[#16423c] font-semibold">{MOCK.request.id}</span>
            </div>
          </div>

          {/* CENTER: source thumbnail + title */}
          <div className="flex items-center gap-3 shrink-1 min-w-0">
            <div className="w-[48px] h-[27px] rounded bg-[#1f2937] flex items-center justify-center shrink-0 relative overflow-hidden">
              <div className="w-4 h-4 rounded-full bg-[#fd6333] flex items-center justify-center">
                <svg viewBox="0 0 24 24" fill="#fff" className="w-2.5 h-2.5 ml-0.5">
                  <path d="M8 5v14l11-7z" />
                </svg>
              </div>
            </div>
            <div className="flex flex-col min-w-0">
              <span className="text-[13px] font-bold text-[#16423c] truncate max-w-[200px]" title={MOCK.video.title}>
                {MOCK.video.title}
              </span>
              <span className="text-[11px] text-[#9ca3af] truncate">{MOCK.video.channel}</span>
            </div>
          </div>

          {/* RIGHT: credit balance + export button */}
          <div className="flex items-center gap-4 shrink-0">
            <div className="bg-[#fd63330f] border border-[#fd633325] text-[#fd6333] text-[12px] font-bold px-3 py-1.5 rounded-full">
              {MOCK.request.creditsBalance} Credits
            </div>
            <button className="border border-[#e5e7eb] text-[#16423c] rounded-xl px-4 py-2 text-[13px] font-semibold hover:bg-gray-50 transition-colors">
              Export All
            </button>
          </div>
        </div>
      </div>

      {/* Sticky Tab Bar */}
      <div className="sticky top-[57px] z-10 bg-white border-b border-gray-100/80">
        <div className="max-w-[1200px] mx-auto px-6">
          <div className="flex gap-0">
            {[
              { id: "clips", label: "Clips & Variations", count: 2 },
              { id: "social", label: "Social Campaigns", count: 4 },
              { id: "blog", label: "Editorial Suite", count: 1 },
            ].map((tab) => {
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as "clips" | "social" | "blog")}
                  className={`px-6 py-3.5 text-[14px] font-semibold relative transition-colors ${
                    isActive ? "text-[#16423c]" : "text-[#9ca3af] hover:text-[#6b7280]"
                  }`}
                >
                  {tab.label}
                  <span className="bg-[#fd63330f] text-[#fd6333] text-[10px] font-bold px-1.5 py-0.5 rounded ml-1.5">
                    {tab.count}
                  </span>
                  {isActive && (
                    <motion.div
                      layoutId="outputTabUnderline"
                      className="absolute bottom-0 left-0 right-0 h-[2px] bg-[#fd6333] rounded-full"
                    />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Smart Schedule Command Bar */}
      <div className="bg-white/80 backdrop-blur-sm border-b border-gray-100/80 px-6 py-2.5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-[12px] text-[#6b7280] font-medium">{totalSelected} items selected</span>
          <span className="text-[12px] text-[#9ca3af] hidden sm:inline">· Tick clips, posts and blog to add to schedule</span>
        </div>
        <button className={`bg-[#16423c] text-white text-[12px] font-bold px-4 py-1.5 rounded-xl transition-all ${totalSelected === 0 ? 'opacity-40 cursor-not-allowed' : 'ring-2 ring-[#fd6333]/30'}`}>
          Smart Schedule
        </button>
      </div>

      {/* Scrollable Tab Content */}
      <div className="relative">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
          >
            {activeTab === "clips" && (
              <div className="max-w-[1200px] mx-auto px-6 py-6 flex flex-col gap-5">
                {MOCK.clusters.map((cluster) => {
                  const isOpen = openCaptions[cluster.id] || false;
                  const isClusterChecked = Object.keys(selectedItems).some(k => k.startsWith(cluster.id) && selectedItems[k]);
                  const currentStage = ('currentStage' in cluster) ? (cluster as any).currentStage : undefined;

                  return (
                    <div key={cluster.id} className="bg-white rounded-2xl border border-gray-100/80 shadow-[0_2px_12px_rgba(0,0,0,0.06)] flex flex-col">
                      {/* A. Identity Bar */}
                      <div className="px-5 py-3 flex items-center gap-3 border-b border-gray-50">
                        <div 
                          onClick={() => {
                            const next = { ...selectedItems };
                            const newVal = !isClusterChecked;
                            next[`${cluster.id}-master`] = newVal;
                            cluster.variations.forEach(v => {
                              next[`${cluster.id}-${v.platform}`] = newVal;
                            });
                            setSelectedItems(next);
                          }}
                          className={`w-4 h-4 rounded border-2 shrink-0 cursor-pointer flex items-center justify-center transition-colors ${
                            isClusterChecked ? 'border-[#16423c] bg-[#16423c]' : 'border-gray-300'
                          }`}
                        >
                          {isClusterChecked && <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>}
                        </div>

                        {editingTitle === cluster.id ? (
                          <input 
                            autoFocus
                            value={clusterTitles[cluster.id] || ''}
                            onChange={e => setClusterTitles(prev => ({ ...prev, [cluster.id]: e.target.value }))}
                            onBlur={() => setEditingTitle(null)}
                            onKeyDown={e => e.key === 'Enter' && setEditingTitle(null)}
                            className="text-[14px] font-bold text-[#16423c] bg-transparent border-b border-[#fd6333] outline-none w-[160px]"
                          />
                        ) : (
                          <span 
                            onClick={() => setEditingTitle(cluster.id)}
                            className="text-[14px] font-bold text-[#16423c] cursor-text truncate max-w-[160px]"
                          >
                            {clusterTitles[cluster.id] || cluster.title}
                          </span>
                        )}

                        <div className="relative flex items-center justify-center">
                          <div className="relative w-[32px] h-[32px] shrink-0">
                            <svg className="w-full h-full transform rotate-[135deg]" viewBox="0 0 100 100">
                              <circle cx="50" cy="50" r="40" stroke="#f0f0f0" strokeWidth="12" fill="none" pathLength="100" strokeDasharray="75 100" strokeLinecap="round" />
                              <motion.circle
                                cx="50"
                                cy="50"
                                r="40"
                                stroke="#fd6333"
                                strokeWidth="12"
                                fill="none"
                                pathLength="100"
                                strokeDasharray="75 100"
                                strokeLinecap="round"
                                initial={{ strokeDashoffset: 75 }}
                                animate={{ strokeDashoffset: gaugeAnimated ? 75 - cluster.viralityScore * 0.75 : 75 }}
                                transition={{ duration: 1, ease: "easeOut" }}
                              />
                            </svg>
                            <div className="absolute inset-0 flex items-center justify-center">
                              <span className="text-[11px] font-black text-[#16423c] leading-none mt-0.5">
                                {cluster.viralityScore}
                              </span>
                            </div>
                          </div>
                          <button 
                            className="absolute -right-2 -top-2 w-4 h-4 rounded-full bg-gray-100 text-[#9ca3af] text-[9px] font-bold flex items-center justify-center hover:bg-gray-200 z-10"
                            onMouseEnter={() => setShowWhyTooltip(cluster.id)}
                            onMouseLeave={() => setShowWhyTooltip(null)}
                          >
                            ?
                          </button>
                          {showWhyTooltip === cluster.id && (
                            <div className="absolute top-full left-0 mt-2 bg-[#1f2937] text-white text-[11px] rounded-lg p-3 w-[220px] z-30 shadow-xl pointer-events-none text-left whitespace-pre-wrap">
                              Score = (Hook Strength × 0.7) + (Trending Topic × 0.3){'\n\n'}Hook: 89 · Trending: 72
                            </div>
                          )}
                        </div>

                        <div className={`w-2 h-2 rounded-full shrink-0 ml-2 ${
                          cluster.status === "completed" ? "bg-[#22c55e]" :
                          cluster.status === "processing" ? "bg-[#3b82f6] animate-pulse" :
                          "bg-[#d1d5db]"
                        }`} />

                        {cluster.status === "processing" && currentStage && (
                          <span className="text-[11px] text-[#9ca3af] truncate">
                            {currentStage}
                          </span>
                        )}

                        {/* RIGHT Actions */}
                        <div className="ml-auto flex items-center gap-2 shrink-0">
                          <button className="w-8 h-8 rounded-lg border border-gray-200 text-[#9ca3af] hover:text-[#fd6333] hover:border-[#fd633330] flex items-center justify-center transition-colors" title="Schedule All">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                          </button>
                          <button className="w-8 h-8 rounded-lg border border-gray-200 text-[#9ca3af] hover:text-[#fd6333] hover:border-[#fd633330] flex items-center justify-center transition-colors" title="Zip All 4">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                          </button>
                          <button className="w-8 h-8 rounded-lg border border-gray-200 text-[#9ca3af] hover:text-red-400 hover:border-red-200 flex items-center justify-center transition-colors" title="Delete">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
                          </button>
                        </div>
                      </div>

                      {/* B. Processing banner */}
                      {cluster.status === "processing" && currentStage && (
                        <div className="bg-[#eff6ff] border-b border-[#bfdbfe] px-5 py-2 text-[11px] text-[#3b82f6] font-medium flex items-center gap-2">
                          <div className="w-1.5 h-1.5 rounded-full bg-[#3b82f6] animate-pulse" />
                          {currentStage}
                        </div>
                      )}

                      {/* C. Media Row */}
                      <div className="px-5 py-4 flex items-start gap-4 overflow-x-auto">
                        {/* Master Slot */}
                        <div className="flex flex-col gap-1 items-center shrink-0">
                          <div className={`w-[180px] h-[101px] rounded-xl bg-[#f4f4f5] relative overflow-hidden group cursor-pointer ${selectedItems[`${cluster.id}-master`] ? 'ring-2 ring-[#16423c]/40' : ''}`}>
                            <div 
                              onClick={() => setSelectedItems(prev => ({ ...prev, [`${cluster.id}-master`]: !prev[`${cluster.id}-master`] }))}
                              className={`absolute top-1.5 left-1.5 z-20 w-4 h-4 rounded border-2 cursor-pointer transition-all flex items-center justify-center ${selectedItems[`${cluster.id}-master`] ? 'border-[#16423c] bg-[#16423c]' : 'border-white/70 bg-black/20'}`}
                            >
                              {selectedItems[`${cluster.id}-master`] && <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>}
                            </div>

                            {cluster.status === "processing" ? (
                              <div className="absolute inset-0 animate-pulse bg-gray-200 flex flex-col items-center justify-center gap-2">
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="animate-spin"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
                              </div>
                            ) : (
                              <>
                                <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-0">
                                  <div className="w-[28px] h-[28px] rounded-full bg-[#fd6333] flex items-center justify-center">
                                    <svg viewBox="0 0 24 24" fill="#fff" className="w-3.5 h-3.5 ml-0.5"><path d="M8 5v14l11-7z" /></svg>
                                  </div>
                                </div>
                                <div className="bg-black/50 text-white text-[10px] px-1.5 py-0.5 rounded absolute bottom-2 right-2 backdrop-blur-sm z-10">
                                  {cluster.hero.duration}
                                </div>
                                <div className="bg-black/50 text-white text-[10px] px-1.5 py-0.5 rounded absolute bottom-2 left-2 backdrop-blur-sm z-10">
                                  {cluster.hero.label}
                                </div>
                                <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                                  <button className="w-6 h-6 rounded bg-white/90 shadow-sm flex items-center justify-center text-[#16423c] hover:bg-white transition-colors">
                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                                  </button>
                                  <button className="w-6 h-6 rounded bg-white/90 shadow-sm flex items-center justify-center text-[#16423c] hover:bg-white transition-colors">
                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>
                                  </button>
                                </div>
                                <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-20">
                                  <div className="absolute top-0 inset-x-0 h-[14px] bg-black/25 flex items-center px-1 space-x-1">
                                      <div className="w-1 h-1 rounded-full bg-white/50" />
                                      <div className="w-1 h-1 rounded-full bg-white/50" />
                                  </div>
                                  <div className="absolute bottom-0 inset-x-0 h-[16px] bg-black/25 flex items-end px-1 pb-1">
                                      <div className="w-4 h-1 bg-white/50 rounded-sm" />
                                  </div>
                                  <div className="absolute bottom-[16px] inset-x-[10%] h-[8px] border border-dashed border-white/50 rounded-sm" />
                                </div>
                              </>
                            )}

                            {/* Hover tooltip */}
                            <div className="absolute top-2 left-1/2 -translate-x-1/2 bg-[#1f2937] text-white text-[10px] rounded-lg px-2 py-1.5 w-[130px] z-30 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity flex flex-col gap-0.5 shadow-xl">
                              <div>1920×1080</div>
                              <div>142 words</div>
                              {cluster.status === "completed" && <div className="text-green-400">Face Tracked ✓</div>}
                            </div>
                          </div>

                          {/* Schedule badge */}
                          <div className="relative w-full">
                            {scheduledTimes[`${cluster.id}-master`] ? (
                              <button onClick={() => setOpenSchedulePicker(`${cluster.id}-master`)} className="bg-[#f0fdf4] text-[#16a34a] text-[10px] font-semibold px-1.5 py-0.5 rounded flex items-center gap-0.5 w-full justify-center">
                                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                                {scheduledTimes[`${cluster.id}-master`]}
                              </button>
                            ) : (
                              <button onClick={() => setOpenSchedulePicker(`${cluster.id}-master`)} className="text-[10px] text-[#9ca3af] italic flex items-center gap-0.5 w-full justify-center hover:text-[#16423c]">
                                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                                AI: {AI_SUGGESTED_TIMES.master}
                              </button>
                            )}
                            {renderSchedulePopover(`${cluster.id}-master`, "master")}
                          </div>
                        </div>

                        {/* Variation trio */}
                        <div className="flex gap-2">
                          {cluster.variations.map((v, i) => {
                            const itemKey = `${cluster.id}-${v.platform}`;
                            const isFailed = itemKey === DEMO_FAILED;
                            return (
                              <div key={i} className="flex flex-col gap-1 items-center shrink-0">
                                <div className={`w-[70px] h-[124px] rounded-xl bg-[#f4f4f5] relative overflow-hidden group cursor-pointer ${isFailed ? 'ring-2 ring-red-200' : selectedItems[itemKey] ? 'ring-2 ring-[#16423c]/40' : ''}`}>
                                  {!isFailed && (
                                    <div 
                                      onClick={() => setSelectedItems(prev => ({ ...prev, [itemKey]: !prev[itemKey] }))}
                                      className={`absolute top-1.5 left-1.5 z-20 w-4 h-4 rounded border-2 cursor-pointer transition-all flex items-center justify-center ${selectedItems[itemKey] ? 'border-[#16423c] bg-[#16423c]' : 'border-white/70 bg-black/20'}`}
                                    >
                                      {selectedItems[itemKey] && <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>}
                                    </div>
                                  )}

                                  {isFailed ? (
                                    <div className="absolute inset-0 bg-red-50 flex flex-col items-center justify-center gap-1 p-1 z-10">
                                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="text-red-400" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                                      <div className="text-[8px] text-red-400 font-semibold text-center leading-tight">Credits Refunded</div>
                                      <button className="mt-1 text-[9px] bg-white border border-red-200 text-red-400 rounded px-1.5 py-0.5 font-semibold hover:bg-red-50">Retry</button>
                                    </div>
                                  ) : cluster.status === "processing" || v.status === "processing" ? (
                                    <div className="absolute inset-0 animate-pulse bg-gray-200 flex flex-col items-center justify-center gap-2">
                                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="animate-spin"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
                                    </div>
                                  ) : v.status === "pending" ? (
                                    <div className="absolute inset-0 bg-gray-100 flex flex-col items-center justify-center gap-2">
                                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                                    </div>
                                  ) : (
                                    <>
                                      <div className="absolute top-1.5 right-1.5 bg-black/40 text-white text-[8px] font-bold px-1 py-0.5 rounded backdrop-blur-sm z-10">
                                        {v.platform === "TikTok" ? "TK" : v.platform === "Reels" ? "IG" : "YT"}
                                      </div>
                                      <div className="absolute top-1.5 left-1/2 -translate-x-1/2 bg-black/40 text-white text-[8px] rounded z-10 flex items-center gap-0.5 px-1 py-0.5 backdrop-blur-sm">
                                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg>
                                        FT
                                      </div>
                                      <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
                                        <div className="w-[20px] h-[20px] rounded-full bg-[#1f2937] flex items-center justify-center">
                                          <svg viewBox="0 0 24 24" fill="#fff" className="w-2.5 h-2.5 ml-0.5"><path d="M8 5v14l11-7z" /></svg>
                                        </div>
                                      </div>
                                      <div className="bg-black/50 text-white text-[10px] px-1.5 py-0.5 rounded absolute bottom-2 right-2 backdrop-blur-sm z-10">
                                        {v.duration}
                                      </div>
                                      <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-20">
                                        <div className="absolute top-0 inset-x-0 h-[12px] bg-black/25" />
                                        <div className="absolute right-0 top-[20%] bottom-[15%] w-[12px] bg-black/25" />
                                        <div className="absolute bottom-0 inset-x-0 h-[18px] bg-black/25" />
                                        <div className="absolute bottom-[20px] inset-x-[10%] h-[12px] border border-dashed border-white/50 rounded-sm" />
                                      </div>
                                    </>
                                  )}
                                  
                                  {/* Hover tooltip */}
                                  <div className="absolute top-2 left-1/2 -translate-x-1/2 bg-[#1f2937] text-white text-[10px] rounded-lg px-2 py-1.5 w-[120px] z-30 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity flex flex-col gap-0.5 shadow-xl">
                                    <div>1080×1920</div>
                                    <div>142 words</div>
                                    {(v.status === "completed" || cluster.status === "completed") && <div className="text-green-400">Face Tracked ✓</div>}
                                  </div>
                                </div>

                                {/* Schedule badge */}
                                <div className="relative w-full">
                                  {scheduledTimes[itemKey] ? (
                                    <button onClick={() => setOpenSchedulePicker(itemKey)} className="bg-[#f0fdf4] text-[#16a34a] text-[10px] font-semibold px-1.5 py-0.5 rounded flex items-center gap-0.5 w-full justify-center">
                                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                                      {scheduledTimes[itemKey]}
                                    </button>
                                  ) : (
                                    <button onClick={() => setOpenSchedulePicker(itemKey)} className="text-[10px] text-[#9ca3af] italic flex items-center gap-0.5 w-full justify-center hover:text-[#16423c]">
                                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                                      AI: {AI_SUGGESTED_TIMES[v.platform] || "8:00 PM"}
                                    </button>
                                  )}
                                  {renderSchedulePopover(itemKey, v.platform)}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      {/* D. Caption Drawer Toggle */}
                      <div 
                        className="border-t border-gray-50 px-5 py-2.5 flex items-center justify-between cursor-pointer hover:bg-gray-50/60 transition-colors"
                        onClick={() => setOpenCaptions(prev => ({ ...prev, [cluster.id]: !prev[cluster.id] }))}
                      >
                        <div className="flex items-center gap-2">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="4" y1="6" x2="20" y2="6"/><line x1="4" y1="12" x2="20" y2="12"/><line x1="4" y1="18" x2="12" y2="18"/>
                          </svg>
                          <span className="text-[12px] text-[#6b7280] font-medium">3 Platform-Tailored Captions Generated</span>
                        </div>
                        <svg 
                          width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                          className={`transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
                        >
                          <polyline points="6 9 12 15 18 9"/>
                        </svg>
                      </div>

                      {/* Expanded Caption Drawer */}
                      <AnimatePresence>
                        {isOpen && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.2 }}
                            className="overflow-hidden"
                          >
                            <div className="px-5 pb-4">
                              <div className="flex gap-2 mb-3">
                                {Object.keys(cluster.captions).map((plat) => {
                                  const isPlatformActive = activeCaptions[cluster.id] === plat || (!activeCaptions[cluster.id] && plat === 'TikTok');
                                  return (
                                    <button
                                      key={plat}
                                      onClick={() => setActiveCaptions((prev) => ({ ...prev, [cluster.id]: plat }))}
                                      className={`px-3 py-1 rounded-full text-[12px] font-semibold transition-colors border ${
                                        isPlatformActive
                                          ? "bg-[#fd63330f] border-[#fd633325] text-[#fd6333]"
                                          : "bg-white border-[#e5e7eb] text-[#6b7280] hover:bg-gray-50"
                                      }`}
                                    >
                                      {plat}
                                    </button>
                                  );
                                })}
                              </div>
                              <div className="bg-gray-50/60 rounded-xl p-3.5 text-[13px] text-[#374151] leading-relaxed relative group">
                                {cluster.captions[activeCaptions[cluster.id] || "TikTok"]}
                                
                                {(() => {
                                  const plat = activeCaptions[cluster.id] || "TikTok";
                                  const limit = plat === "Shorts" ? 500 : 2200;
                                  const len = (cluster.captions[plat] || "").length;
                                  return <div className="absolute bottom-2 right-10 text-[10px] text-[#9ca3af] bg-gray-50/60 px-1">{len} / {limit}</div>;
                                })()}

                                <button className="absolute bottom-2 right-2 p-1.5 rounded-lg bg-white border border-gray-200 shadow-sm opacity-0 group-hover:opacity-100 transition-opacity hover:bg-gray-50 text-[#16423c]" title="Copy">
                                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                                </button>
                                <button className="absolute top-2 right-2 p-1.5 rounded-lg bg-white border border-gray-200 shadow-sm opacity-0 group-hover:opacity-100 transition-opacity text-[#9ca3af] hover:text-[#16423c]" title="Edit">
                                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
                                </button>
                              </div>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>

                      {/* E. Subtitle Style Toggle */}
                      <div className="border-t border-gray-50 px-5 py-2.5 flex items-center gap-3">
                        <span className="text-[11px] text-[#9ca3af] font-medium">Subtitle Style:</span>
                        {["Yellow Box", "White Outline", "Bold Minimal"].map(style => (
                          <button 
                            key={style}
                            onClick={() => setSubtitleStyle(style)}
                            className={`px-2.5 py-1 text-[11px] rounded-full border font-semibold transition-colors ${subtitleStyle === style ? 'bg-[#16423c] text-white border-[#16423c]' : 'border-gray-200 text-[#6b7280] hover:bg-gray-50'}`}
                          >
                            {style}
                          </button>
                        ))}
                      </div>

                    </div>
                  );
                })}
              </div>
            )}

            {activeTab === "social" && (
              <div className="max-w-[1200px] mx-auto px-6 py-6 w-full">
              <div className="flex min-h-[600px] bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                {/* LEFT: Platform Icon Rail */}
                <div className="w-[64px] shrink-0 bg-white border-r border-gray-100 flex flex-col items-center gap-3 py-5">
                  {[
                    { id: "twitter", label: "X", ready: 2, icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" /></svg> },
                    { id: "instagram", label: "Instagram", ready: 2, icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="2" width="20" height="20" rx="5" ry="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/></svg> },
                    { id: "pinterest", label: "Pinterest", ready: 2, icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.373 0 0 5.373 0 12c0 5.084 3.163 9.426 7.627 11.174-.105-.949-.2-2.405.042-3.441.218-.937 1.407-5.965 1.407-5.965s-.359-.719-.359-1.782c0-1.668.967-2.914 2.171-2.914 1.023 0 1.518.769 1.518 1.69 0 1.029-.655 2.568-.994 3.995-.283 1.194.599 2.169 1.777 2.169 2.133 0 3.772-2.249 3.772-5.495 0-2.873-2.064-4.882-5.012-4.882-3.414 0-5.418 2.561-5.418 5.207 0 1.031.397 2.138.893 2.738a.36.36 0 0 1 .083.345l-.333 1.36c-.053.22-.174.267-.402.161-1.499-.698-2.436-2.889-2.436-4.649 0-3.785 2.75-7.262 7.929-7.262 4.163 0 7.398 2.967 7.398 6.931 0 4.136-2.607 7.464-6.227 7.464-1.216 0-2.359-.632-2.75-1.378l-.748 2.853c-.271 1.043-1.002 2.35-1.492 3.146C9.57 23.812 10.763 24 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0z"/></svg> },
                    { id: "linkedin", label: "LinkedIn", ready: 2, icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" /></svg> },
                    { id: "facebook", label: "Facebook", ready: 2, icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg> },
                  ].map(platform => (
                    <div key={platform.id} className="relative">
                      <button
                        onClick={() => setActiveSocialFilter(platform.id as "twitter" | "instagram" | "pinterest" | "linkedin" | "facebook")}
                        title={platform.label}
                        className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors cursor-pointer ${
                          activeSocialFilter === platform.id
                            ? "bg-[#fd63330f] border-2 border-[#fd6333] text-[#fd6333]"
                            : "bg-white border border-[#e5e7eb] text-[#9ca3af] hover:text-[#6b7280] hover:bg-gray-50"
                        }`}
                      >
                        {platform.icon}
                      </button>
                      <div className="absolute -top-1 -right-1 bg-[#fd6333] text-white text-[9px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
                        {platform.ready}
                      </div>
                    </div>
                  ))}
                </div>

                {/* RIGHT: Content Area */}
                <div className="flex-1 flex flex-col min-w-0 overflow-y-auto p-5 bg-[#fafafa]">
                  <div className="max-w-[900px] mx-auto w-full flex flex-col gap-5">
                    {MOCK_CAMPAIGNS.map(campaign => {
                      const pData = campaign.platforms[activeSocialFilter as keyof typeof campaign.platforms];
                      if (!pData) return null;

                      const itemKey = `${campaign.id}-${activeSocialFilter}`;
                      const isChecked = selectedItems[itemKey] || false;
                      const time = scheduledTimes[itemKey];
                      const hasConflict = hasSocialConflict(itemKey);

                      return (
                        <div key={campaign.id} className="bg-white rounded-2xl border border-gray-100/80 shadow-[0_2px_12px_rgba(0,0,0,0.06)] overflow-hidden flex flex-col">
                          {/* Card Header */}
                          <div className="px-6 py-6 border-b border-gray-50 flex items-center gap-4">
                            {editingCampaignTitle === campaign.id ? (
                              <input 
                                autoFocus
                                value={campaignTitles[campaign.id] || ''}
                                onChange={e => setCampaignTitles(prev => ({ ...prev, [campaign.id]: e.target.value }))}
                                onBlur={() => setEditingCampaignTitle(null)}
                                onKeyDown={e => e.key === 'Enter' && setEditingCampaignTitle(null)}
                                className="text-[16px] font-bold text-[#16423c] bg-transparent border-b border-[#fd6333] outline-none w-[250px]"
                              />
                            ) : (
                              <span 
                                onClick={() => setEditingCampaignTitle(campaign.id)}
                                className="text-[16px] font-bold text-[#16423c] cursor-text truncate max-w-[250px]"
                              >
                                {campaignTitles[campaign.id] || campaign.title}
                              </span>
                            )}

                            {/* Virality Gauge */}
                            <div className="relative flex items-center justify-center">
                              <div className="relative w-[36px] h-[36px] shrink-0">
                                <svg className="w-full h-full transform rotate-[135deg]" viewBox="0 0 100 100">
                                  <circle cx="50" cy="50" r="40" stroke="#f0f0f0" strokeWidth="12" fill="none" pathLength="100" strokeDasharray="75 100" strokeLinecap="round" />
                                  <motion.circle
                                    cx="50"
                                    cy="50"
                                    r="40"
                                    stroke="#fd6333"
                                    strokeWidth="12"
                                    fill="none"
                                    pathLength="100"
                                    strokeDasharray="75 100"
                                    strokeLinecap="round"
                                    initial={{ strokeDashoffset: 75 }}
                                    animate={{ strokeDashoffset: gaugeAnimated ? 75 - campaign.viralityScore * 0.75 : 75 }}
                                    transition={{ duration: 1, ease: "easeOut" }}
                                  />
                                </svg>
                                <div className="absolute inset-0 flex items-center justify-center">
                                  <span className="text-[12px] font-black text-[#16423c] leading-none mt-0.5">
                                    {campaign.viralityScore}
                                  </span>
                                </div>
                              </div>
                              <button 
                                className="absolute -right-2 -top-2 w-4 h-4 rounded-full bg-gray-100 text-[#9ca3af] text-[9px] font-bold flex items-center justify-center hover:bg-gray-200 z-10"
                                onMouseEnter={() => setShowWhyTooltip(campaign.id)}
                                onMouseLeave={() => setShowWhyTooltip(null)}
                              >
                                ?
                              </button>
                              {showWhyTooltip === campaign.id && (
                                <div className="absolute top-full left-0 mt-2 bg-[#1f2937] text-white text-[11px] rounded-lg p-3 w-[220px] z-30 shadow-xl pointer-events-none text-left whitespace-pre-wrap">
                                  Virality prediction based on cross-platform performance history.
                                </div>
                              )}
                            </div>

                            <div className={`w-2 h-2 rounded-full shrink-0 ${
                              campaign.status === "completed" ? "bg-[#22c55e]" :
                              campaign.status === "processing" ? "bg-[#3b82f6] animate-pulse" :
                              "bg-[#d1d5db]"
                            }`} />

                            <div className="ml-auto">
                              {activeSocialFilter === 'twitter' && (
                                <button className="text-[12px] font-semibold text-[#fd6333] hover:text-white hover:bg-[#fd6333] border border-[#fd6333] px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5">
                                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                                  Copy Thread
                                </button>
                              )}
                            </div>
                          </div>

                          {/* Card Content Based on Platform */}
                          <div className="px-6 py-5 pb-6">
                            {activeSocialFilter === "twitter" && 'posts' in pData && (
                              <div className="flex flex-col gap-0">
                                {(pData as {posts: string[]}).posts?.map((post: string, i: number) => (
                                  <React.Fragment key={i}>
                                    <div className="bg-white rounded-xl p-4 text-[14px] text-[#374151] leading-relaxed whitespace-pre-wrap border border-gray-100 shadow-[0_1px_4px_rgba(0,0,0,0.04)] relative group">
                                      {post}
                                      <div className="absolute bottom-2 right-2 text-[11px] text-[#9ca3af]">{post.length}/280</div>
                                      <button className="absolute top-2 right-2 p-1.5 rounded bg-white shadow-sm opacity-0 group-hover:opacity-100 hover:text-[#16423c] text-[#9ca3af] transition-all">
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                                      </button>
                                    </div>
                                    {i < (pData as {posts: string[]}).posts.length - 1 && <div className="border-l-2 border-dashed border-gray-200 ml-2 h-4 w-1 my-0.5"/>}
                                  </React.Fragment>
                                ))}
                              </div>
                            )}

                            {activeSocialFilter === "instagram" && 'slideCount' in pData && (
                              <div className="flex flex-col">
                                <div className="relative h-[120px] w-full max-w-[300px] mb-6 mx-auto">
                                  <div className="bg-gradient-to-br from-[#f093fb] to-[#f5576c] w-[200px] h-[120px] rounded-xl absolute left-1/2 -translate-x-[40%] translate-y-3 opacity-40 rotate-[6deg] shadow-sm" />
                                  <div className="bg-gradient-to-br from-[#f093fb] to-[#f5576c] w-[200px] h-[120px] rounded-xl absolute left-1/2 -translate-x-[45%] translate-y-1.5 opacity-70 rotate-[3deg] shadow-sm" />
                                  <div className="bg-gradient-to-br from-[#f093fb] to-[#f5576c] w-[200px] h-[120px] rounded-xl absolute left-1/2 -translate-x-1/2 opacity-100 shadow-md flex items-center justify-center">
                                    <span className="bg-black/50 text-white text-[12px] px-2.5 py-1 rounded-md font-bold backdrop-blur-sm shadow-sm">
                                      {(pData as {slideCount: number}).slideCount} Slides
                                    </span>
                                  </div>
                                </div>
                                {(pData as {caption?: string}).caption && <p className="text-[14px] text-[#374151] leading-relaxed whitespace-pre-wrap mb-3">{(pData as {caption?: string}).caption}</p>}
                                {(pData as {hashtags?: string}).hashtags && (
                                  <p className="text-[13px] mb-4">
                                    {(pData as {hashtags?: string}).hashtags?.split(' ').map((h: string, i: number) => <span key={i} className="text-[#fd6333] mr-1.5 font-medium">{h}</span>)}
                                  </p>
                                )}
                                <div className="text-[12px] text-[#16a34a] font-medium flex items-center gap-1.5 bg-[#f0fdf4] self-start px-3 py-1.5 rounded-lg border border-[#bbf7d0]">
                                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                                  Safe zones verified for {(pData as {slideCount: number}).slideCount} slides
                                </div>
                              </div>
                            )}

                            {activeSocialFilter === "linkedin" && 'headline' in pData && (
                              <div className="border border-gray-100 rounded-2xl overflow-hidden bg-white shadow-[0_2px_10px_rgba(0,0,0,0.02)]">
                                <div className="px-5 py-4 flex items-center gap-3 border-b border-gray-50">
                                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#667eea] to-[#764ba2]"/>
                                  <div>
                                    <div className="text-[14px] font-bold text-[#16423c]">You <span className="text-[#9ca3af] font-normal ml-1">· 2nd</span></div>
                                    <div className="text-[11px] text-[#9ca3af]">Just now · 🌐</div>
                                  </div>
                                </div>
                                <div className="px-5 pt-4 pb-2 text-[15px] font-bold text-[#16423c] leading-snug">{(pData as {headline: string}).headline}</div>
                                <div className="px-5 pb-4 text-[14px] text-[#374151] leading-relaxed whitespace-pre-wrap">{(pData as {content: string}).content}</div>
                                <div className="h-[140px] bg-gradient-to-br from-[#4facfe] to-[#00f2fe] flex items-center justify-center">
                                  <span className="text-white text-[12px] font-bold bg-black/20 px-3 py-1.5 rounded-lg backdrop-blur-sm">Featured Image Area</span>
                                </div>
                              </div>
                            )}

                            {activeSocialFilter === "facebook" && 'content' in pData && (
                              <div className="border border-gray-100 rounded-2xl overflow-hidden bg-white shadow-[0_2px_10px_rgba(0,0,0,0.02)]">
                                <div className="px-5 py-4 flex items-center gap-3 border-b border-gray-50">
                                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#667eea] to-[#764ba2]"/>
                                  <div>
                                    <div className="text-[14px] font-bold text-[#16423c]">You</div>
                                    <div className="text-[11px] text-[#9ca3af]">Just now · 🌎</div>
                                  </div>
                                </div>
                                <div className="px-5 py-4 text-[14px] text-[#374151] leading-relaxed whitespace-pre-wrap">{(pData as {content: string}).content}</div>
                                <div className="h-[160px] bg-gradient-to-br from-[#f093fb] to-[#f5576c] flex items-center justify-center">
                                  <span className="text-white text-[12px] font-bold bg-black/20 px-3 py-1.5 rounded-lg backdrop-blur-sm">Video / Image Focus</span>
                                </div>
                                <div className="px-5 py-3 border-t border-gray-50 flex gap-6 bg-gray-50/50">
                                  <span className="text-[13px] font-medium text-[#6b7280] flex items-center gap-1.5 hover:text-[#16423c] cursor-pointer transition-colors">👍 Like</span>
                                  <span className="text-[13px] font-medium text-[#6b7280] flex items-center gap-1.5 hover:text-[#16423c] cursor-pointer transition-colors">💬 Comment</span>
                                  <span className="text-[13px] font-medium text-[#6b7280] flex items-center gap-1.5 hover:text-[#16423c] cursor-pointer transition-colors">↗ Share</span>
                                </div>
                              </div>
                            )}

                            {activeSocialFilter === "pinterest" && 'pinTitle' in pData && (
                              <div className="flex flex-col gap-4">
                                <div>
                                  <label className="text-[12px] font-bold text-[#16423c] block mb-1.5">Pin Title</label>
                                  <input 
                                    defaultValue={(pData as {pinTitle: string}).pinTitle}
                                    className="w-full text-[14px] border border-gray-200 rounded-xl px-3.5 py-2.5 outline-none focus:border-[#fd6333] focus:ring-1 focus:ring-[#fd6333] text-[#374151] transition-shadow"
                                    placeholder="Enter pin title..."
                                  />
                                </div>
                                <div>
                                  <label className="text-[12px] font-bold text-[#16423c] block mb-1.5">Alt Text (SEO)</label>
                                  <textarea 
                                    defaultValue={(pData as {altText: string}).altText}
                                    className="w-full text-[14px] border border-gray-200 rounded-xl px-3.5 py-2.5 outline-none focus:border-[#fd6333] focus:ring-1 focus:ring-[#fd6333] text-[#374151] resize-none transition-shadow"
                                    rows={2}
                                    placeholder="Describe the image for search engines..."
                                  />
                                </div>
                                {(pData as {caption?: string}).caption && (
                                  <div className="text-[14px] text-[#374151] leading-relaxed bg-[#fafafa] rounded-xl p-4 border border-gray-100">
                                    {(pData as {caption?: string}).caption}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>

                          {/* Schedule Footer Row */}
                          <div className="mt-auto px-6 py-4 bg-gray-50/50 border-t border-gray-100 flex items-center gap-4 relative">
                            <div 
                              className={`w-5 h-5 rounded-md border-2 cursor-pointer flex items-center justify-center transition-colors shrink-0 ${isChecked ? 'border-[#16423c] bg-[#16423c]' : 'border-gray-300 hover:border-gray-400'}`}
                              onClick={() => setSelectedItems(prev => ({ ...prev, [itemKey]: !prev[itemKey] }))}
                            >
                              {isChecked && <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>}
                            </div>

                            <div className="flex-1 flex items-center gap-2">
                              {time ? (
                                hasConflict ? (
                                  <span className="text-[13px] font-semibold text-red-500 flex items-center gap-1.5 bg-red-50 px-2.5 py-1 rounded-md">
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                                    Conflict detected
                                  </span>
                                ) : (
                                  <span className="text-[13px] font-semibold text-[#16a34a] flex items-center gap-1.5 bg-[#f0fdf4] border border-[#bbf7d0] px-3 py-1 rounded-md">
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                                    {time}
                                  </span>
                                )
                              ) : (
                                <div className="flex items-center gap-1.5 text-[#9ca3af]">
                                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                                  <span className="text-[13px] italic">AI suggests: {AI_SUGGESTED_TIMES[activeSocialFilter]}</span>
                                </div>
                              )}
                            </div>

                            <div className="relative">
                              <button 
                                className="text-[13px] font-semibold text-[#16423c] bg-white border border-gray-200 px-4 py-1.5 rounded-lg hover:bg-gray-50 transition-colors shadow-sm"
                                onClick={(e) => { e.stopPropagation(); setOpenSchedulePicker(itemKey); }}
                              >
                                {time ? 'Change Time' : 'Set Time'}
                              </button>
                              {renderSchedulePopover(itemKey, activeSocialFilter, true, true)}
                            </div>
                          </div>

                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
              </div>
            )}

            {activeTab === "blog" && (
              <div className="max-w-[1200px] mx-auto px-6 py-8 flex gap-6 h-[calc(100vh-165px)] relative">
                
                {/* Slash command menu */}
                <AnimatePresence>
                  {slashMenuOpen && (
                    <>
                      <div className="fixed inset-0 z-40" onClick={() => setSlashMenuOpen(false)} />
                      <motion.div
                        initial={{ opacity: 0, y: -6, scale: 0.97 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -6, scale: 0.97 }}
                        transition={{ duration: 0.12 }}
                        className="fixed z-50 bg-white rounded-2xl border border-gray-200 shadow-2xl shadow-gray-200/60 p-2 w-52"
                        style={{ top: slashMenuPos.y, left: slashMenuPos.x }}
                      >
                        <div className="text-[10px] font-bold uppercase tracking-widest text-[#9ca3af] px-2 py-1 mb-1">BLOCKS</div>
                        {SLASH_COMMANDS.filter(c => c.label.toLowerCase().includes(slashFilter.toLowerCase())).map(cmd => (
                          <button
                            key={cmd.id}
                            onClick={() => {
                              if (slashTargetId) {
                                setActiveBlocks(prev => prev.map(b => b.id === slashTargetId ? { ...b, type: cmd.type, content: '' } : b));
                                setEditingSection(slashTargetId);
                              }
                              setSlashMenuOpen(false);
                            }}
                            className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-[13px] text-[#374151] hover:bg-gray-50 hover:text-[#16423c] font-medium transition-colors"
                          >
                            <span className="w-7 h-7 flex items-center justify-center bg-gray-100 rounded-lg text-[11px] font-mono font-bold text-[#6b7280]">{cmd.icon}</span>
                            {cmd.label}
                          </button>
                        ))}
                      </motion.div>
                    </>
                  )}
                </AnimatePresence>

                {/* LEFT SIDEBAR */}
                <div className="w-[192px] shrink-0 bg-white rounded-2xl border border-gray-100/80 shadow-[0_2px_12px_rgba(0,0,0,0.06)] p-4 flex flex-col gap-1 overflow-y-auto">
                  <div className="text-[10px] font-bold uppercase tracking-widest text-[#9ca3af] mb-2 px-1">TEMPLATE</div>
                  {[
                    { name: "SEO Optimized", vid: "v1" },
                    { name: "Storytelling", vid: "v2" },
                    { name: "Bullet Point Summary", vid: "v1" },
                    { name: "Tech Deep Dive", vid: "v2" },
                  ].map((tpl) => {
                    const currentTplName = MOCK.blog.versions.find(v => v.id === activeBlogVersion)?.template;
                    const isActive = currentTplName === tpl.name || (activeBlogVersion === tpl.vid && currentTplName !== "SEO Optimized" && currentTplName !== "Storytelling" && false); // Fallback: just use blogTemplate
                    const isReallyActive = blogTemplate === tpl.name || (MOCK.blog.versions.find(v => v.id === activeBlogVersion)?.template === tpl.name);
                    
                    return (
                      <button
                        key={tpl.name}
                        onClick={() => {
                          setActiveBlogVersion(tpl.vid);
                          setBlogTemplate(tpl.name);
                        }}
                        className={isReallyActive 
                          ? "bg-[#16423c] text-white font-semibold rounded-xl px-3 py-2 text-[13px] w-full text-left" 
                          : "text-[#374151] font-medium rounded-xl px-3 py-2 text-[13px] w-full text-left hover:bg-gray-50"}
                      >
                        {tpl.name}
                      </button>
                    );
                  })}
                  
                  {/* Table of Contents */}
                  {tocItems.length > 0 && (
                    <div className="mt-4 mb-1">
                      <div className="text-[10px] font-bold uppercase tracking-widest text-[#9ca3af] mb-2 px-1">CONTENTS</div>
                      <div className="flex flex-col gap-0.5">
                        {tocItems.map((block, i) => (
                          <a
                            key={block.id}
                            href={`#block-${block.id}`}
                            className={`text-[12px] font-medium text-[#374151] rounded-lg px-3 py-1 hover:bg-gray-50 hover:text-[#16423c] transition-colors truncate ${block.type === 'h3' ? 'pl-5 text-[11px] text-[#6b7280]' : ''}`}
                            onClick={e => {
                              e.preventDefault();
                              document.getElementById(`block-${block.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                            }}
                          >
                            {block.content || `Section ${i + 1}`}
                          </a>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="mt-auto" />
                  <button className="w-full rounded-xl bg-[#fd63330f] border border-[#fd633330] text-[#fd6333] text-[12px] font-semibold py-2.5 flex items-center justify-center gap-2 mt-auto shrink-0">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/>
                    </svg>
                    Generate New · 5 credits
                  </button>
                </div>

                {/* CENTER CANVAS */}
                <div className="flex-1 bg-white rounded-2xl border border-gray-100/80 shadow-[0_2px_12px_rgba(0,0,0,0.06)] flex flex-col overflow-y-auto">
                  
                  {/* Card Header */}
                  <div className="px-6 py-5 border-b border-gray-50 flex items-center gap-4">
                    <div 
                      onClick={() => setSelectedItems(prev => ({ ...prev, blog: !prev.blog }))}
                      className={`w-4 h-4 rounded border-2 shrink-0 cursor-pointer flex items-center justify-center transition-colors ${selectedItems.blog ? 'border-[#16423c] bg-[#16423c]' : 'border-gray-300'}`}
                    >
                      {selectedItems.blog && <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>}
                    </div>

                    {editingTitle === "blog-title" ? (
                      <input 
                        autoFocus
                        defaultValue={MOCK.blog.title}
                        onBlur={() => setEditingTitle(null)}
                        onKeyDown={e => e.key === 'Enter' && setEditingTitle(null)}
                        className="text-[17px] font-bold text-[#16423c] bg-transparent border-b border-[#fd6333] outline-none flex-1"
                      />
                    ) : (
                      <span 
                        onClick={() => setEditingTitle("blog-title")}
                        className="text-[17px] font-bold text-[#16423c] cursor-text flex-1 truncate"
                      >
                        {MOCK.blog.title}
                      </span>
                    )}

                    <div className="flex flex-col items-center justify-center mr-2">
                      <div className="relative w-[32px] h-[32px]">
                        <svg className="w-full h-full transform rotate-[135deg]" viewBox="0 0 100 100">
                          <circle cx="50" cy="50" r="40" stroke="#f0f0f0" strokeWidth="8" fill="none" pathLength="100" strokeDasharray="75 100" strokeLinecap="round" />
                          <motion.circle
                            cx="50" cy="50" r="40"
                            stroke="#fd6333" strokeWidth="8" fill="none"
                            pathLength="100" strokeDasharray="75 100" strokeLinecap="round"
                            initial={{ strokeDashoffset: 75 }}
                            animate={{ strokeDashoffset: gaugeAnimated ? 75 - seoResult.score * 0.75 : 75 }}
                            transition={{ duration: 1, ease: "easeOut" }}
                          />
                        </svg>
                      </div>
                      <span className="text-[11px] font-bold text-[#16423c] leading-none mt-1">{seoResult.score}</span>
                    </div>

                    <div className="flex items-center gap-1.5 mr-2">
                      <div className="w-2 h-2 rounded-full bg-green-400" />
                      <span className="text-[12px] text-[#6b7280]">Ready</span>
                    </div>

                    <div className="flex items-center gap-1 bg-gray-50 p-1 rounded-full border border-gray-100">
                      {["v1", "v2"].map(v => (
                        <button
                          key={v}
                          onClick={() => setActiveBlogVersion(v)}
                          className={activeBlogVersion === v 
                            ? "bg-[#16423c] text-white text-[11px] font-semibold px-3 py-1 rounded-full transition-colors" 
                            : "text-[#6b7280] text-[11px] font-medium px-3 py-1 rounded-full hover:bg-gray-100 transition-colors"}
                        >
                          {v}
                        </button>
                      ))}
                    </div>
                    <button
                      onClick={() => setPostMetaOpen(true)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-gray-200 bg-white text-[12px] font-medium text-[#6b7280] hover:border-[#16423c] hover:text-[#16423c] transition-colors ml-2"
                    >
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg>
                      Post Settings
                    </button>
                  </div>

                  {/* Card Body */}
                  <div className="px-4 py-4 flex-1 overflow-y-auto" onClick={() => { setBlockTypeMenuId(null); }}>
                    <Reorder.Group
                      axis="y"
                      values={activeBlocks}
                      onReorder={setActiveBlocks}
                      className="flex flex-col gap-0.5"
                    >
                      {activeBlocks.map((block) => (
                        <BlockItem
                          key={block.id}
                          block={block}
                          isEditing={editingSection === block.id}
                          isToolbarVisible={blockToolbarId === block.id}
                          isTypeMenuOpen={blockTypeMenuId === block.id}
                          editedContent={editedContent}
                          setEditingSection={setEditingSection}
                          setEditedContent={setEditedContent}
                          setActiveBlocks={setActiveBlocks}
                          setBlockToolbarId={setBlockToolbarId}
                          setBlockTypeMenuId={setBlockTypeMenuId}
                          setSlashMenuPos={setSlashMenuPos}
                          setSlashTargetId={setSlashTargetId}
                          setSlashFilter={setSlashFilter}
                          setSlashMenuOpen={setSlashMenuOpen}
                          formatToolbarBlockId={formatToolbarBlockId}
                          setFormatToolbarBlockId={setFormatToolbarBlockId}
                          linkInputBlockId={linkInputBlockId}
                          setLinkInputBlockId={setLinkInputBlockId}
                          linkInputValue={linkInputValue}
                          setLinkInputValue={setLinkInputValue}
                          anchorMenuId={anchorMenuId}
                          setAnchorMenuId={setAnchorMenuId}
                        />
                      ))}
                    </Reorder.Group>
                  </div>

                  {/* Card Footer */}
                  <div className="mt-auto px-6 py-4 bg-gray-50/50 border-t border-gray-100 flex items-center gap-3">
                    <div 
                      onClick={() => setSelectedItems(prev => ({ ...prev, blog: !prev.blog }))}
                      className={`w-5 h-5 rounded-md border-2 cursor-pointer flex items-center justify-center transition-colors shrink-0 ${selectedItems.blog ? 'border-[#16423c] bg-[#16423c]' : 'border-gray-300 hover:border-gray-400'}`}
                    >
                      {selectedItems.blog && <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>}
                    </div>
                    <span className="text-[13px] font-semibold text-[#16423c] cursor-pointer" onClick={() => setSelectedItems(prev => ({ ...prev, blog: !prev.blog }))}>
                      Schedule for Publishing
                    </span>

                    <select 
                      value={blogSchedulePlatform}
                      onChange={e => setBlogSchedulePlatform(e.target.value)}
                      className="ml-2 text-[12px] border border-gray-200 rounded-lg px-2 py-1 outline-none focus:border-[#fd6333] text-[#374151] bg-white cursor-pointer"
                    >
                      {["WordPress", "Medium", "Ghost", "Dev.to"].map(p => (
                        <option key={p} value={p}>{p}</option>
                      ))}
                    </select>

                    <div className="flex-1" />

                    <div className="flex items-center gap-1.5 text-[#9ca3af]">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                      <span className="text-[11px]">{scheduledTimes.blog ? scheduledTimes.blog : `AI suggests: ${AI_SUGGESTED_TIMES.blog}`}</span>
                    </div>

                    <div className="relative ml-1">
                      <button 
                        className="text-[12px] font-semibold text-[#fd6333] bg-white border border-[#fd633330] px-4 py-1.5 rounded-lg hover:bg-[#fd63330f] transition-colors"
                        onClick={(e) => { e.stopPropagation(); setOpenSchedulePicker("blog"); }}
                      >
                        {scheduledTimes.blog ? 'Change Time' : 'Set Time'}
                      </button>
                      {renderSchedulePopover("blog", "blog", true, true)}
                    </div>
                  </div>
                </div>

                {/* RIGHT RAIL */}
                <div className="w-[260px] shrink-0 flex flex-col gap-4 overflow-y-auto pr-1 pb-4">
                  
                  {/* 1. SEO Score */}
                  <div className="bg-white rounded-2xl border border-gray-100/80 shadow-[0_2px_12px_rgba(0,0,0,0.06)] p-5">
                    <div className="text-[11px] font-bold uppercase tracking-widest text-[#9ca3af] mb-4 text-center">
                      SEO SCORE
                    </div>
                    <div className="flex flex-col items-center justify-center">
                      <div className="relative w-[96px] h-[96px]">
                        <svg className="w-full h-full transform rotate-[135deg]" viewBox="0 0 100 100">
                          <circle cx="50" cy="50" r="40" stroke="#f0f0f0" strokeWidth="8" fill="none" pathLength="100" strokeDasharray="75 100" strokeLinecap="round" />
                          <motion.circle
                            cx="50" cy="50" r="40"
                            stroke="#fd6333" strokeWidth="8" fill="none"
                            pathLength="100" strokeDasharray="75 100" strokeLinecap="round"
                            initial={{ strokeDashoffset: 75 }}
                            animate={{ strokeDashoffset: gaugeAnimated ? 75 - seoResult.score * 0.75 : 75 }}
                            transition={{ duration: 1, ease: "easeOut" }}
                          />
                        </svg>
                        <div className="absolute inset-0 flex flex-col items-center justify-center pt-1">
                          <span className="text-[28px] font-black text-[#16423c] leading-none">
                            {seoResult.score}
                          </span>
                        </div>
                      </div>
                      <span className="text-[11px] text-[#9ca3af] mt-1 font-medium">out of 100</span>
                    </div>
                  </div>

                  {/* 2. GEO Citability */}
                  <div className="bg-white rounded-2xl border border-gray-100/80 shadow-[0_2px_12px_rgba(0,0,0,0.06)] px-5 py-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="text-[11px] font-bold uppercase tracking-widest text-[#9ca3af]">GEO CITABILITY</div>
                      <span className={`text-[12px] font-black px-2 py-0.5 rounded-lg ${geoResult.grade === 'A' ? 'bg-green-100 text-green-700' : geoResult.grade === 'B' ? 'bg-[#fd63330f] text-[#fd6333]' : 'bg-gray-100 text-gray-500'}`}>
                        Grade {geoResult.grade}
                      </span>
                    </div>
                    {/* Mini horizontal bar chart for 3 sub-scores */}
                    <div className="flex flex-col gap-2 mb-3">
                      {[
                        { label: 'Factual density', value: geoResult.factualDensity, max: 25 },
                        { label: 'Citation format', value: geoResult.citationFormat, max: 25 },
                        { label: 'Entity presence', value: geoResult.entityPresence, max: 25 },
                      ].map(({ label, value, max }) => (
                        <div key={label}>
                          <div className="flex items-center justify-between mb-0.5">
                            <span className="text-[11px] text-[#6b7280]">{label}</span>
                            <span className="text-[11px] font-semibold text-[#16423c]">{value}/{max}</span>
                          </div>
                          <div className="h-1 w-full rounded-full bg-gray-100">
                            <motion.div
                              className="h-full rounded-full bg-[#fd6333]"
                              initial={{ width: 0 }}
                              animate={{ width: `${(value / max) * 100}%` }}
                              transition={{ duration: 0.6, ease: 'easeOut' }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                    <p className="text-[11px] text-[#6b7280] leading-relaxed italic">{geoResult.topSuggestion}</p>
                  </div>

                  {/* 3. Content Metrics */}
                  <div className="bg-white rounded-2xl border border-gray-100/80 shadow-[0_2px_12px_rgba(0,0,0,0.06)] px-5 py-4">
                    <div className="text-[11px] font-bold uppercase tracking-widest text-[#9ca3af] mb-3">
                      CONTENT METRICS
                    </div>
                    <div className="flex items-center justify-between py-1.5 border-b border-gray-50">
                      <span className="text-[12px] text-[#6b7280]">Reading Level</span>
                      <span className="text-[12px] font-semibold text-[#16423c]">{readingLevel}</span>
                    </div>
                    <div className="flex items-center justify-between py-1.5 border-b border-gray-50">
                      <span className="text-[12px] text-[#6b7280]">Word Count</span>
                      <span className="text-[12px] font-semibold text-[#16423c]">{seoResult.wordCount.toLocaleString()} words</span>
                    </div>
                    <div className="flex items-center justify-between py-1.5 border-b border-gray-50 border-0">
                      <span className="text-[12px] text-[#6b7280]">Info Density</span>
                      <span className="text-[12px] font-semibold text-[#16423c]">{lexicalDensity}%</span>
                    </div>
                  </div>

                  {/* 4. Factual Grounding */}
                  <div className="bg-white rounded-2xl border border-gray-100/80 shadow-[0_2px_12px_rgba(0,0,0,0.06)] px-5 py-4">
                    <div className="text-[11px] font-bold uppercase tracking-widest text-[#9ca3af] mb-3">FACTUAL GROUNDING</div>
                    <div className="flex flex-col gap-2">
                      {GEO_FACTUAL_GROUNDING.map((item, i) => (
                        <div key={i} className="flex items-start gap-2.5">
                          <div className={`w-5 h-5 rounded-full flex-shrink-0 flex items-center justify-center mt-0.5 ${item.verified ? 'bg-green-100' : 'bg-red-100'}`}>
                            {item.verified
                              ? <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                              : <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                            }
                          </div>
                          <p className="text-[11px] text-[#374151] leading-relaxed">{item.claim}</p>
                        </div>
                      ))}
                    </div>
                    <div className="mt-3 pt-2.5 border-t border-gray-50 flex items-center gap-1.5">
                      <div className="w-2 h-2 rounded-full bg-green-400" />
                      <span className="text-[11px] text-[#6b7280]">3/3 claims verified against transcript</span>
                    </div>
                  </div>

                  {/* 5. Keyword Density */}
                  <div className="bg-white rounded-2xl border border-gray-100/80 shadow-[0_2px_12px_rgba(0,0,0,0.06)] px-5 py-4">
                    <div className="text-[11px] font-bold uppercase tracking-widest text-[#9ca3af] mb-3">
                      KEYWORD DENSITY
                    </div>
                    <div>
                      {Object.entries(MOCK.blog.keywordDensity).map(([kw, density]) => (
                        <div key={kw} className="mb-3 last:mb-0">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-[12px] text-[#374151] font-medium">{kw}</span>
                            <span className="text-[11px] font-semibold text-[#fd6333]">{density}%</span>
                          </div>
                          <div className="w-full h-1 rounded-full bg-[#fd63330f] overflow-hidden">
                            <div 
                              className="h-full bg-[#fd6333] rounded-full" 
                              style={{ width: `${Math.min((density / 4) * 100, 100)}%` }} 
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* 6. Meta Description */}
                  <div className="bg-white rounded-2xl border border-gray-100/80 shadow-[0_2px_12px_rgba(0,0,0,0.06)] px-5 py-4">
                    <div className="text-[11px] font-bold uppercase tracking-widest text-[#9ca3af] mb-3">
                      META DESCRIPTION
                    </div>
                    <p className="text-[12px] text-[#374151] leading-relaxed mb-2">
                      {MOCK.blog.metaDescription}
                    </p>
                    <div className="text-[11px] text-[#9ca3af] font-medium">
                      {MOCK.blog.metaDescription.length}/160 chars
                    </div>
                  </div>

                  {/* 7. Top Keywords */}
                  <div className="bg-white rounded-2xl border border-gray-100/80 shadow-[0_2px_12px_rgba(0,0,0,0.06)] px-5 py-4">
                    <div className="text-[11px] font-bold uppercase tracking-widest text-[#9ca3af] mb-3">
                      TOP KEYWORDS
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {MOCK.blog.keywords.map((kw, i) => (
                        <span 
                          key={i} 
                          className="bg-[#fd63330f] text-[#fd6333] text-[11px] font-semibold px-2.5 py-1 rounded-full border border-[#fd633320]"
                        >
                          {kw}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* VERSION HISTORY */}
                  <div className="bg-white rounded-2xl border border-gray-100/80 shadow-[0_2px_12px_rgba(0,0,0,0.06)] flex flex-col">
                    <div className="px-4 py-3 border-b border-gray-50 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-[#16423c]" />
                        <span className="text-[10px] font-bold text-[#374151] uppercase tracking-[0.08em]">Version History</span>
                      </div>
                      <button
                        onClick={() => {
                          const snap = {
                            id: genId(),
                            timestamp: Date.now(),
                            label: `Snapshot ${snapshots.length + 1}`,
                            blocks: JSON.parse(JSON.stringify(activeBlocks)) as Block[],
                          };
                          setSnapshots(prev => [snap, ...prev].slice(0, 10));
                        }}
                        className="text-[10px] font-medium text-[#fd6333] hover:text-[#e5572e] transition-colors"
                      >
                        + Save snapshot
                      </button>
                    </div>
                    <div className="p-3 flex flex-col gap-2">
                      {snapshots.length === 0 ? (
                        <p className="text-[11px] text-[#9ca3af] text-center py-3">No snapshots yet. Save one to track your progress.</p>
                      ) : (
                        snapshots.map((snap, i) => (
                          <div key={snap.id} className="flex items-center gap-2 group">
                            <div className="flex flex-col gap-0.5 flex-1 min-w-0">
                              <span className="text-[11px] font-medium text-[#374151] truncate">{snap.label}</span>
                              <span className="text-[10px] text-[#9ca3af]">{formatTimeAgo(snap.timestamp)} · {snap.blocks.length} blocks</span>
                            </div>
                            <button
                              onClick={() => {
                                if (confirm(`Restore "${snap.label}"? This will replace the current canvas.`)) {
                                  setVersionBlocks(prev => ({ ...prev, [activeBlogVersion]: JSON.parse(JSON.stringify(snap.blocks)) }));
                                }
                              }}
                              className="opacity-0 group-hover:opacity-100 text-[10px] font-medium text-[#fd6333] hover:text-[#e5572e] transition-all flex-shrink-0"
                            >
                              Restore
                            </button>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                </div>
              </div>
            )}

            {/* Post Settings Slide-out Panel */}
            <AnimatePresence>
              {postMetaOpen && (
                <>
                  {/* Backdrop */}
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 z-40 bg-black/10"
                    onClick={() => setPostMetaOpen(false)}
                  />
                  {/* Panel */}
                  <motion.div
                    initial={{ x: '100%' }}
                    animate={{ x: 0 }}
                    exit={{ x: '100%' }}
                    transition={{ type: 'spring', damping: 30, stiffness: 300 }}
                    className="fixed right-0 top-0 bottom-0 z-50 w-[380px] bg-white shadow-2xl flex flex-col"
                  >
                    {/* Panel Header */}
                    <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between flex-shrink-0">
                      <div>
                        <h2 className="text-[14px] font-semibold text-[#16423c]">Post Settings</h2>
                        <p className="text-[11px] text-[#9ca3af] mt-0.5">SEO metadata & social preview</p>
                      </div>
                      <button onClick={() => setPostMetaOpen(false)} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-gray-100 text-[#9ca3af] hover:text-[#374151] transition-colors">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
                      </button>
                    </div>
                    {/* Panel Scroll Body */}
                    <div className="flex-1 overflow-y-auto px-5 py-5 space-y-6">
                      
                      {/* Section: Canonical URL */}
                      <div>
                        <h3 className="text-[11px] font-semibold text-[#374151] uppercase tracking-wider mb-3">Canonical URL</h3>
                        <div className="space-y-2">
                          <input
                            type="url"
                            value={postMeta.canonicalUrl}
                            onChange={e => setPostMeta(prev => ({ ...prev, canonicalUrl: e.target.value }))}
                            placeholder="https://yourdomain.com/article-slug"
                            className="w-full text-[12px] px-3 py-2 rounded-xl border border-gray-200 outline-none focus:border-[#fd6333] text-[#374151] placeholder-gray-300 transition-colors"
                          />
                          <p className="text-[10px] text-[#9ca3af]">Tells search engines the preferred URL for this post. Leave blank to use the auto-generated URL.</p>
                        </div>
                      </div>

                      {/* Section: Social Preview */}
                      <div>
                        <h3 className="text-[11px] font-semibold text-[#374151] uppercase tracking-wider mb-3">Social Preview (Open Graph)</h3>
                        <div className="space-y-3">
                          <div>
                            <label className="text-[11px] text-[#6b7280] font-medium mb-1 block">OG Title</label>
                            <input
                              value={postMeta.ogTitle}
                              onChange={e => setPostMeta(prev => ({ ...prev, ogTitle: e.target.value }))}
                              className="w-full text-[12px] px-3 py-2 rounded-xl border border-gray-200 outline-none focus:border-[#fd6333] text-[#374151] transition-colors"
                            />
                            <p className="text-[10px] text-[#9ca3af] mt-1">{postMeta.ogTitle.length}/60 chars</p>
                          </div>
                          <div>
                            <label className="text-[11px] text-[#6b7280] font-medium mb-1 block">OG Description</label>
                            <textarea
                              value={postMeta.ogDescription}
                              onChange={e => setPostMeta(prev => ({ ...prev, ogDescription: e.target.value }))}
                              rows={3}
                              placeholder="Brief description for social sharing…"
                              className="w-full text-[12px] px-3 py-2 rounded-xl border border-gray-200 outline-none focus:border-[#fd6333] text-[#374151] resize-none placeholder-gray-300 transition-colors"
                            />
                            <p className="text-[10px] text-[#9ca3af]">{postMeta.ogDescription.length}/160 chars</p>
                          </div>
                          <div>
                            <label className="text-[11px] text-[#6b7280] font-medium mb-1 block">OG Image URL</label>
                            <input
                              value={postMeta.ogImage}
                              onChange={e => setPostMeta(prev => ({ ...prev, ogImage: e.target.value }))}
                              placeholder="https://…"
                              className="w-full text-[12px] px-3 py-2 rounded-xl border border-gray-200 outline-none focus:border-[#fd6333] text-[#374151] placeholder-gray-300 transition-colors"
                            />
                          </div>
                          
                          {/* Live Preview Card — X/Twitter style */}
                          <div>
                            <p className="text-[10px] text-[#9ca3af] mb-2 font-medium">Preview on X / Twitter</p>
                            <div className="rounded-xl overflow-hidden border border-gray-200 bg-white">
                              {postMeta.ogImage ? (
                                <div className="aspect-[2/1] bg-gray-100 overflow-hidden">
                                  <img src={postMeta.ogImage} alt="" className="w-full h-full object-cover" onError={e => (e.currentTarget.style.display = 'none')} />
                                </div>
                              ) : (
                                <div className="aspect-[2/1] bg-gradient-to-br from-[#16423c] to-[#1e5c54] flex items-center justify-center">
                                  <span className="text-white/30 text-[11px]">No image set</span>
                                </div>
                              )}
                              <div className="px-3 py-2 border-t border-gray-100">
                                <p className="text-[11px] text-[#9ca3af] truncate">{postMeta.canonicalUrl || 'yourdomain.com'}</p>
                                <p className="text-[12px] font-semibold text-[#111827] truncate mt-0.5">{postMeta.ogTitle || 'Post title'}</p>
                                <p className="text-[11px] text-[#6b7280] line-clamp-2 mt-0.5">{postMeta.ogDescription || 'Post description will appear here'}</p>
                              </div>
                            </div>
                          </div>

                          {/* Preview Card — LinkedIn style */}
                          <div>
                            <p className="text-[10px] text-[#9ca3af] mb-2 font-medium">Preview on LinkedIn</p>
                            <div className="rounded-xl overflow-hidden border border-gray-200 bg-white flex">
                              <div className="w-[100px] flex-shrink-0 bg-gradient-to-br from-[#16423c] to-[#1e5c54] flex items-center justify-center overflow-hidden">
                                {postMeta.ogImage
                                  ? <img src={postMeta.ogImage} alt="" className="w-full h-full object-cover" onError={e => (e.currentTarget.style.display = 'none')} />
                                  : <span className="text-white/30 text-[10px]">No image</span>
                                }
                              </div>
                              <div className="px-3 py-2 flex-1 min-w-0">
                                <p className="text-[12px] font-semibold text-[#111827] line-clamp-2 leading-snug">{postMeta.ogTitle || 'Post title'}</p>
                                <p className="text-[10px] text-[#9ca3af] mt-1 truncate">{postMeta.canonicalUrl || 'yourdomain.com'}</p>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                    {/* Panel Footer */}
                    <div className="px-5 py-4 border-t border-gray-100 flex-shrink-0">
                      <button
                        onClick={() => setPostMetaOpen(false)}
                        className="w-full py-2.5 rounded-xl bg-[#16423c] text-white text-[13px] font-semibold hover:bg-[#1e5c54] transition-colors"
                      >
                        Save Settings
                      </button>
                    </div>
                  </motion.div>
                </>
              )}
            </AnimatePresence>


          </motion.div>
        </AnimatePresence>
      </div>
      </div>
    </motion.div>
  );
}
