"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface OutputStudioProps {
  onBack: () => void;
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

  useEffect(() => {
    const t = setTimeout(() => setGaugeAnimated(true), 300);
    return () => clearTimeout(t);
  }, []);

  const totalSelected = Object.values(selectedItems).filter(Boolean).length;

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
          backgroundImage: "radial-gradient(circle at 1px 1px, rgba(0,0,0,0.045) 1px, transparent 0)",
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
              <div className="max-w-[1200px] mx-auto px-6 py-8 flex gap-6 h-[calc(100vh-165px)]">
                
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
                  <div className="mt-auto" />
                  <button className="w-full rounded-xl bg-[#fd63330f] border border-[#fd633330] text-[#fd6333] text-[12px] font-semibold py-2.5 flex items-center justify-center gap-2 mt-auto">
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
                            animate={{ strokeDashoffset: gaugeAnimated ? 75 - MOCK.blog.qualityScore * 0.75 : 75 }}
                            transition={{ duration: 1, ease: "easeOut" }}
                          />
                        </svg>
                      </div>
                      <span className="text-[11px] font-bold text-[#16423c] leading-none mt-1">{MOCK.blog.qualityScore}</span>
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
                  </div>

                  {/* Card Body */}
                  <div className="px-6 py-6 flex-1">
                    {MOCK.blog.versions.find(v => v.id === activeBlogVersion)?.sections.map((section, idx, sections) => {
                      const strIdx = String(idx);
                      const isExpanded = expandedSections[strIdx] ?? false;

                      return (
                        <React.Fragment key={idx}>
                          <div className="flex flex-col mb-1">
                            <div 
                              className="flex items-center gap-3 cursor-pointer py-2 group"
                              onClick={() => setExpandedSections(prev => ({ ...prev, [strIdx]: !prev[strIdx] }))}
                            >
                              <svg 
                                width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                                style={{ transform: `rotate(${isExpanded ? 90 : 0}deg)`, transition: 'transform 0.2s' }}
                              >
                                <polyline points="9 18 15 12 9 6"/>
                              </svg>
                              <h3 className="text-[14px] font-bold text-[#16423c] select-none" style={{ fontFamily: 'var(--font-merriweather), serif' }}>
                                {section.title}
                              </h3>
                            </div>

                            {isExpanded && (
                              <div className="pl-6 pb-2 pt-1">
                                {editingSection === strIdx ? (
                                  <textarea
                                    autoFocus
                                    value={editedContent[strIdx] ?? section.content}
                                    onChange={e => setEditedContent(prev => ({ ...prev, [strIdx]: e.target.value }))}
                                    onBlur={() => setEditingSection(null)}
                                    className="w-full text-[14px] leading-relaxed text-[#374151] resize-none outline-none border border-[#fd633340] rounded-xl p-3 focus:border-[#fd6333] min-h-[80px]"
                                    style={{ fontFamily: 'var(--font-merriweather), serif' }}
                                  />
                                ) : (
                                  <p 
                                    onClick={() => {
                                      setEditingSection(strIdx);
                                      setEditedContent(prev => ({ ...prev, [strIdx]: prev[strIdx] ?? section.content }));
                                    }}
                                    className="text-[14px] leading-relaxed text-[#374151] cursor-text hover:bg-[#fd63330a] rounded-lg px-2 py-1 -mx-2 -my-1 transition-colors"
                                    style={{ fontFamily: 'var(--font-merriweather), serif' }}
                                  >
                                    {editedContent[strIdx] ?? section.content}
                                  </p>
                                )}
                              </div>
                            )}
                          </div>

                          {idx < sections.length - 1 && (
                            <button className="flex items-center gap-2 my-3 w-full group">
                              <div className="flex-1 h-px bg-gray-100 group-hover:bg-[#fd633330] transition-colors" />
                              <span className="w-7 h-7 rounded-full border border-dashed border-gray-300 group-hover:border-[#fd6333] flex items-center justify-center text-[#9ca3af] group-hover:text-[#fd6333] text-[16px] transition-colors pb-0.5">+</span>
                              <div className="flex-1 h-px bg-gray-100 group-hover:bg-[#fd633330] transition-colors" />
                            </button>
                          )}
                        </React.Fragment>
                      );
                    })}
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
                <div className="w-[260px] shrink-0 flex flex-col gap-4 overflow-y-auto">
                  
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
                            animate={{ strokeDashoffset: gaugeAnimated ? 75 - MOCK.blog.qualityScore * 0.75 : 75 }}
                            transition={{ duration: 1, ease: "easeOut" }}
                          />
                        </svg>
                        <div className="absolute inset-0 flex flex-col items-center justify-center pt-1">
                          <span className="text-[28px] font-black text-[#16423c] leading-none">
                            {MOCK.blog.qualityScore}
                          </span>
                        </div>
                      </div>
                      <span className="text-[11px] text-[#9ca3af] mt-1 font-medium">out of 100</span>
                    </div>
                  </div>

                  {/* 2. Content Metrics */}
                  <div className="bg-white rounded-2xl border border-gray-100/80 shadow-[0_2px_12px_rgba(0,0,0,0.06)] px-5 py-4">
                    <div className="text-[11px] font-bold uppercase tracking-widest text-[#9ca3af] mb-3">
                      CONTENT METRICS
                    </div>
                    <div className="flex items-center justify-between py-1.5 border-b border-gray-50">
                      <span className="text-[12px] text-[#6b7280]">Reading Level</span>
                      <span className="text-[12px] font-semibold text-[#16423c]">{MOCK.blog.readingLevel}</span>
                    </div>
                    <div className="flex items-center justify-between py-1.5 border-b border-gray-50 border-0">
                      <span className="text-[12px] text-[#6b7280]">Word Count</span>
                      <span className="text-[12px] font-semibold text-[#16423c]">~1,240 words</span>
                    </div>
                  </div>

                  {/* 3. Keyword Density */}
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

                  {/* 4. Meta Description */}
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

                  {/* 5. Top Keywords */}
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

                </div>
              </div>
            )}


          </motion.div>
        </AnimatePresence>
      </div>
      </div>
    </motion.div>
  );
}
