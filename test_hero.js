const parser = require('@babel/parser');
const fs = require('fs');

const heroStartStr = `{/* ── Section B: Hero Section ────────────────────────────────────────── */}`;
const heroEndStr = `{/* ── Section 2: Speed Visualization ─────────────────────────────────── */}`;

const newHero = `${heroStartStr}
      <section className="relative overflow-hidden min-h-screen flex items-center justify-center pt-20 pb-20 px-4 bg-[#fcfdff]">
        {/* Dotted Background Patterns */}
        <div className="absolute inset-0 z-0 pointer-events-none flex items-center justify-center overflow-hidden">
          <svg className="w-full h-full min-w-[1400px] opacity-40" viewBox="0 0 1400 800" fill="none">
            <path d="M150 250 Q 300 250 400 400 T 700 800" stroke="#E2E8F0" strokeWidth="1.5" strokeDasharray="4 6"/>
            <path d="M1250 250 Q 1100 250 1000 400 T 700 800" stroke="#E2E8F0" strokeWidth="1.5" strokeDasharray="4 6"/>
            <path d="M200 650 Q 300 650 400 500 T 700 400" stroke="#E2E8F0" strokeWidth="1.5" strokeDasharray="4 6"/>
            <path d="M1200 650 Q 1100 650 1000 500 T 700 400" stroke="#E2E8F0" strokeWidth="1.5" strokeDasharray="4 6"/>
            <path d="M0 400 L 1400 400" stroke="#E2E8F0" strokeWidth="1.5" strokeDasharray="4 6"/>
          </svg>
        </div>

        {/* --- Card 1: View Performance (replaces User Research) --- */}
        <motion.div
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.2 }}
          className="absolute top-[25%] left-[8%] hidden xl:block bg-white rounded-3xl p-5 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100 z-10 w-64 animate-float"
        >
          <div className="flex justify-between items-start mb-4">
            <div className="text-[14px] font-bold text-slate-800">Engagement View</div>
            <div className="text-xl font-black text-slate-900">92%</div>
          </div>
          <div className="flex -space-x-2 mb-6">
            <div className="w-8 h-8 rounded-full border-2 border-white bg-slate-200"></div>
            <div className="w-8 h-8 rounded-full border-2 border-white bg-slate-300"></div>
            <div className="w-8 h-8 rounded-full border-2 border-white bg-slate-400"></div>
            <div className="w-8 h-8 rounded-full border-2 border-white bg-slate-500"></div>
            <div className="w-8 h-8 rounded-full border-2 border-white bg-slate-100 flex justify-center items-center text-[10px] text-slate-400">+</div>
          </div>
          <div className="flex gap-4">
            <div className="flex flex-col">
              <span className="text-[10px] text-slate-500 font-medium">✨ Clips made</span>
              <span className="text-lg font-bold">120</span>
            </div>
            <div className="flex flex-col">
              <span className="text-[10px] text-slate-500 font-medium">👀 Total Views</span>
              <span className="text-lg font-bold">1.2M</span>
            </div>
          </div>
        </motion.div>

        {/* --- Card 2: AI Automation (replaces Quick Transaction) --- */}
        <motion.div
           initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.3 }}
           className="absolute top-[28%] right-[8%] hidden xl:block bg-white rounded-3xl p-6 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100 z-10 w-72 animate-float-alt"
        >
          <div className="text-[14px] font-bold text-slate-800 mb-1">AI Smart Subtitles</div>
          <div className="text-[12px] text-slate-500 leading-snug mb-5">
            Create personalized social clips that engage, convert, and grow your brand.
          </div>
          <div className="flex -space-x-2 items-center">
            <div className="w-8 h-8 border border-dashed border-slate-300 rounded-full flex items-center justify-center text-slate-400 text-sm bg-slate-50 mr-2">+</div>
            <div className="w-8 h-8 rounded-full border-2 border-white bg-slate-200"></div>
            <div className="w-8 h-8 rounded-full border-2 border-white bg-slate-300"></div>
            <div className="w-8 h-8 rounded-full border-2 border-white bg-slate-400"></div>
          </div>
        </motion.div>

        {/* --- Card 3: Line Chart (replaces This Month Send) --- */}
        <motion.div
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.4 }}
          className="absolute bottom-[10%] left-[12%] hidden xl:block bg-white rounded-3xl p-6 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100 z-10 w-72 animate-float-slow"
        >
          <div className="text-[11px] font-medium text-slate-400 mb-1">This month Views</div>
          <div className="flex justify-between items-baseline mb-4">
            <div className="text-2xl font-black text-slate-900">25,056k</div>
            <div className="text-[10px] font-bold text-emerald-500 bg-emerald-50 px-1.5 rounded">+12.55% ↑</div>
          </div>
          <div className="flex bg-slate-50 rounded-full p-1 mb-4 gap-1">
            <div className="text-[10px] flex-1 text-center py-1 text-slate-500 font-medium">24 hours</div>
            <div className="text-[10px] flex-1 text-center py-1 text-slate-500 font-medium">Week</div>
            <div className="text-[10px] flex-1 text-center py-1 text-white bg-[#6B46FF] font-bold shadow rounded-full">Month</div>
          </div>
          <div className="h-16 w-full relative">
            <svg className="w-full h-full pr-2" viewBox="0 0 100 30" preserveAspectRatio="none">
              <path d="M0 25 Q 15 20 30 10 T 60 15 T 80 5 T 100 20 L 100 30 L 0 30 Z" fill="#6B46FF" fillOpacity="0.1"/>
              <path d="M0 25 Q 15 20 30 10 T 60 15 T 80 5 T 100 20" fill="none" stroke="#6B46FF" strokeWidth="2" strokeLinecap="round"/>
            </svg>
            {/* Tooltip mockup */}
            <div className="absolute top-2 left-1/2 -ml-6 bg-white shadow-lg border border-slate-100 rounded-lg py-1 px-2">
              <div className="text-[9px] text-[#6B46FF] font-bold text-center">45,863</div>
            </div>
            <div className="flex justify-between text-[8px] text-slate-400 mt-1 px-1 uppercase w-full">
              <span>Sep 15</span><span>Sep 15</span><span>Sep 15</span><span>Sep 15</span>
            </div>
          </div>
        </motion.div>

        {/* --- Card 4: Central Avatar Dist --- */}
        <motion.div
           initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.5 }}
           className="absolute bottom-[20%] left-1/2 -ml-28 hidden xl:flex bg-white/70 backdrop-blur-md rounded-3xl p-4 shadow-sm border border-slate-100 z-10 w-56 animate-float items-center gap-4"
        >
          <div className="flex-col flex gap-2 w-10">
            <div className="w-8 h-8 rounded-full bg-slate-300 relative"><div className="absolute top-1/2 -right-4 w-4 border-t border-dashed border-slate-300"></div></div>
            <div className="w-8 h-8 rounded-full bg-slate-400 relative"><div className="absolute top-1/2 -right-4 w-4 border-t border-dashed border-slate-300"></div></div>
            <div className="w-8 h-8 rounded-full bg-slate-500 relative pl-2"><div className="absolute top-1/2 -right-4 w-4 border-t border-dashed border-slate-300"></div></div>
          </div>
          <div className="bg-[#6B46FF] px-3 py-1.5 text-white text-[10px] font-bold rounded shadow-[0_4px_12px_rgba(107,70,255,0.4)]">
            Distribute
          </div>
        </motion.div>

        {/* --- Card 5: Doughnut --- */}
        <motion.div
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.6 }}
          className="absolute bottom-[12%] right-[10%] hidden xl:block bg-white rounded-3xl p-6 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100 z-10 w-72 animate-float-alt"
        >
          <div className="flex justify-between items-center mb-6">
            <div className="text-[14px] font-bold text-slate-800">Retention & Open Rate</div>
            <div className="text-slate-400 font-bold tracking-widest text-lg leading-none mb-2">...</div>
          </div>
          <div className="relative h-24 mb-4 flex justify-center overflow-hidden">
             <svg className="w-48 h-48 absolute top-0" viewBox="0 0 100 100">
              <path d="M 10 50 A 40 40 0 0 1 90 50" fill="none" stroke="#F1F5F9" strokeWidth="6" strokeLinecap="round" />
              <path d="M 10 50 A 40 40 0 0 1 90 50" fill="none" stroke="#6B46FF" strokeWidth="6" strokeDasharray="125" strokeDashoffset="40" strokeLinecap="round" />
              <path d="M 15 50 A 35 35 0 0 1 85 50" fill="none" stroke="#E2E8F0" strokeWidth="6" strokeLinecap="round" />
              <path d="M 15 50 A 35 35 0 0 1 85 50" fill="none" stroke="#4a2ba3" strokeWidth="6" strokeDasharray="110" strokeDashoffset="70" strokeLinecap="round" />
            </svg>
          </div>
          <div className="flex items-center justify-between px-2">
            <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-[#6B46FF]"></div><span className="text-[11px] font-bold text-slate-600">Retain 40%</span></div>
            <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-slate-300"></div><span className="text-[11px] font-bold text-slate-600">Reply 37%</span></div>
          </div>
          <div className="text-center mt-3 text-[11px] font-bold text-slate-400">Click-Through Rate 23%</div>
        </motion.div>

        {/* Center Content */}
        <div className="max-w-[800px] w-full flex flex-col items-center text-center relative z-20 pt-10">
          
          {/* Badge */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="mb-6">
            <div className="inline-flex items-center gap-2 pl-2 pr-4 py-1 rounded-full bg-white border border-slate-200 shadow-sm">
              <div className="bg-transparent inline-flex items-center justify-center p-1 text-[#6B46FF]">
                <SparkleIcon className="w-3.5 h-3.5" />
              </div>
              <span className="text-[10px] font-bold text-slate-600 uppercase tracking-widest bg-clip-text">
                NEW: PARALLEL GPU FAN-OUT AVAILABLE JAN 01, 2025
              </span>
            </div>
          </motion.div>

          {/* Headline */}
          <motion.h1 initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.1 }} className="mb-5 px-4 w-full">
            <span className="block font-sans font-bold text-slate-900 text-[clamp(2.5rem,5.5vw,4.5rem)] leading-[1.05] tracking-tight antialiased" style={{letterSpacing: '-1.5px'}}>
              The Smarter Way to Create<br/>Viral Short-Form Content
            </span>
          </motion.h1>

          {/* Subtitle */}
          <motion.p initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.2 }} className="text-[17px] text-slate-500 max-w-2xl px-4 mx-auto mb-10 leading-relaxed font-medium">
            Create personalized clips, social threads, and blog posts that engage, convert, and grow your brand all in one easy to use platform.
          </motion.p>

          {/* Action Area (Replacing Quip Button with our sleek URL bar) */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.3 }} className="w-full max-w-lg flex flex-col items-center px-4">
             <div className="w-full relative flex items-center p-1.5 bg-white shadow-[0_12px_44px_rgba(107,70,255,0.12)] border border-slate-100 rounded-full">
              <input
                type="text" value={url} onChange={(e) => setUrl(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleGenerate()} disabled={stage !== "idle"}
                placeholder="https://www.youtube.com/watch?v=..."
                className="flex-1 bg-transparent px-5 py-3 outline-none text-[15px] font-medium text-slate-700 placeholder:text-slate-400 min-w-0"
              />
              <button
                onClick={handleGenerate} disabled={stage !== "idle"}
                className={\`flex-shrink-0 flex items-center justify-center text-white px-8 py-3 rounded-full font-bold text-[15px] transition-all \${stage !== "idle" ? "opacity-90" : "hover:shadow-lg hover:scale-[1.02] active:scale-[0.98]"}\`}
                style={{ background: "#6B46FF" }}
              >
                {stage === "loading" ? (
                  <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><path d="M21 12a9 9 0 11-6.219-8.56" /></svg>
                ) : "Get Started for Free"}
              </button>
            </div>

            {/* Progress Area */}
            <AnimatePresence>
              {stage === "progress" && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="w-full px-6 mt-6">
                  <div className="flex justify-between items-center text-xs font-semibold text-slate-500 mb-2">
                    <motion.span key={statusMsg} initial={{ opacity: 0 }} animate={{ opacity: 1 }}>{statusMsg}</motion.span>
                    <span className="tabular-nums text-[#6B46FF]">{Math.round(progress)}%</span>
                  </div>
                  <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-all" style={{ width: \`\${progress}%\`, background: "#6B46FF" }}></div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <p className="text-[13px] font-medium text-slate-500 mt-6 pt-2">
              No credit card required.
            </p>
          </motion.div>
        </div>
      </section>
${heroEndStr}`;

// Evaluate newHero exactly like apply_quip_full.js did
const evalJSX = eval(` \`${newHero}\` `);

try {
  parser.parseExpression(`<>${evalJSX}</>`, { plugins: ['jsx', 'typescript'] });
  console.log("Syntax is OK!");
} catch (e) {
  console.log("Syntax Error at: " + e.loc.line + ":" + e.loc.column);
  console.log(e.message);
}
