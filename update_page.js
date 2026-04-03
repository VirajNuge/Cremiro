const fs = require('fs');

const file = 'app/page.tsx';
let content = fs.readFileSync(file, 'utf8');

// 1. Add openFaq state
if (!content.includes('const [openFaq')) {
  content = content.replace(
    'const [email, setEmail] = useState("");',
    'const [email, setEmail] = useState("");\n  const [openFaq, setOpenFaq] = useState<number | null>(null);'
  );
}

// 2. Add Sections 2-8
const newSections = `
      {/* ── Section 2: Speed Visualization ─────────────────────────────────── */}
      <section id="speed" className="py-24 sm:py-32 px-4 border-t border-slate-100 bg-white">
        <div className="container mx-auto max-w-6xl">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="text-center mb-16"
          >
            <h2 className="font-serif font-bold text-[#16423c] text-3xl sm:text-4xl md:text-5xl mb-4 tracking-tight">
              While they render one-by-one, we render all at once.
            </h2>
            <p className="text-lg text-slate-500 max-w-2xl mx-auto">
              Our Parallel GPU Fan-out technology distributes your video across hundreds of GPUs, rendering all clips simultaneously instead of sequentially.
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 lg:gap-12">
            {/* Left: Traditional */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-100px" }}
              transition={{ duration: 0.5, delay: 0.2 }}
              className="bg-white rounded-2xl border border-slate-100 p-8"
              style={{ boxShadow: "0 4px 24px rgba(0,0,0,0.07)" }}
            >
              <h3 className="text-xl font-bold text-slate-800 mb-6">Traditional Platforms</h3>
              <div className="space-y-4">
                {[1, 2, 3].map((clip, i) => (
                  <div key={clip} className="flex flex-col gap-2">
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium text-slate-600">Clip {clip}</span>
                    </div>
                    <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden">
                      <motion.div
                        className="h-full rounded-full bg-slate-300"
                        initial={{ width: "0%" }}
                        whileInView={{ width: "100%" }}
                        viewport={{ once: true, margin: "-100px" }}
                        transition={{ duration: 4, delay: i * 4, ease: "linear" }}
                      />
                    </div>
                  </div>
                ))}
                <div className="pt-4 text-center">
                  <span className="text-sm font-medium text-slate-400">...and 7 more clips waiting...</span>
                </div>
              </div>
            </motion.div>

            {/* Right: Clip */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-100px" }}
              transition={{ duration: 0.5, delay: 0.3 }}
              className="bg-white rounded-2xl border-2 border-[#fd6333]/20 p-8 relative overflow-hidden"
              style={{ boxShadow: "0 4px 24px rgba(0,0,0,0.07)" }}
            >
              <div className="absolute top-0 right-0 w-32 h-32 bg-[#fd6333]/10 rounded-bl-[100px] -z-10" />
              <h3 className="text-xl font-bold text-slate-800 mb-6 flex items-center gap-2">
                <SparkleIcon className="w-5 h-5 text-[#fd6333]" />
                Clip <span className="text-sm font-semibold text-[#fd6333] px-2 py-0.5 bg-[#fd6333]/10 rounded-full ml-2">Parallel GPU</span>
              </h3>
              <div className="space-y-3">
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((clip, i) => (
                  <div key={clip} className="flex items-center gap-3">
                    <span className="text-xs font-medium text-slate-500 w-12 shrink-0">Clip {clip}</span>
                    <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                      <motion.div
                        className="h-full rounded-full"
                        style={{ background: "linear-gradient(90deg, #fd6333, #ea532a)" }}
                        initial={{ width: "0%" }}
                        whileInView={{ width: "100%" }}
                        viewport={{ once: true, margin: "-100px" }}
                        transition={{ duration: 2, delay: 0.2 + (i * 0.05), ease: "easeOut" }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          </div>

          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.5, delay: 0.5 }}
            className="mt-12 mx-auto max-w-fit px-6 py-3 bg-[#16423c] rounded-full text-center flex items-center gap-3"
            style={{ boxShadow: "0 4px 24px rgba(22,66,60,0.2)" }}
          >
            <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-white font-bold tracking-wide">10 CLIPS IN 60 SECONDS</span>
          </motion.div>
        </div>
      </section>

      {/* ── Section 3: Feature Deep-Dive Grid ─────────────────────────────── */}
      <section id="features" className="py-24 sm:py-32 px-4 border-t border-slate-100 bg-slate-50/50">
        <div className="container mx-auto max-w-6xl">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="text-center mb-16"
          >
            <h2 className="font-serif font-bold text-[#16423c] text-3xl sm:text-4xl md:text-5xl mb-4 tracking-tight">
              Everything you need. Nothing you don't.
            </h2>
            <p className="text-lg text-slate-500 max-w-2xl mx-auto">
              A meticulously crafted toolkit designed specifically for short-form video creation.
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Card 1 */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-100px" }}
              transition={{ duration: 0.5, delay: 0.1 }}
              className="bg-white rounded-2xl border border-slate-100 p-6 hover:shadow-lg transition-shadow duration-300 flex flex-col group"
              style={{ boxShadow: "0 4px 24px rgba(0,0,0,0.07)" }}
            >
              <div className="w-12 h-12 bg-[#fd6333]/10 rounded-xl flex items-center justify-center mb-6 text-[#fd6333]">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h8m-8 6h16" />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-slate-800 mb-3">Word-by-Word Subtitle Editor</h3>
              <p className="text-slate-500 mb-8 flex-1">
                Edit every word, style, and timing. Full control over your captions with an intuitive timeline interface.
              </p>
              <div className="mt-auto bg-slate-900 rounded-xl p-4 flex flex-wrap gap-2 overflow-hidden relative">
                <div className="absolute inset-0 bg-gradient-to-t from-slate-900/50 to-transparent pointer-events-none z-10" />
                <span className="px-2 py-1 bg-white/10 rounded text-xs font-bold text-white">This</span>
                <span className="px-2 py-1 bg-[#fd6333] rounded text-xs font-bold text-white shadow-[0_0_10px_rgba(253,99,51,0.5)] transform scale-105 transition-transform group-hover:scale-110">video</span>
                <span className="px-2 py-1 bg-white/10 rounded text-xs font-bold text-white">is</span>
                <span className="px-2 py-1 bg-white/10 rounded text-xs font-bold text-white">going</span>
                <span className="px-2 py-1 bg-white/10 rounded text-xs font-bold text-white">viral</span>
              </div>
            </motion.div>

            {/* Card 2 */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-100px" }}
              transition={{ duration: 0.5, delay: 0.2 }}
              className="bg-white rounded-2xl border border-slate-100 p-6 hover:shadow-lg transition-shadow duration-300 flex flex-col group"
              style={{ boxShadow: "0 4px 24px rgba(0,0,0,0.07)" }}
            >
              <div className="w-12 h-12 bg-emerald-500/10 rounded-xl flex items-center justify-center mb-6 text-emerald-600">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-slate-800 mb-3">AI Face-Tracking & Reframing</h3>
              <p className="text-slate-500 mb-8 flex-1">
                Automatically crop landscape to portrait. The speaker is always kept perfectly centered in the frame.
              </p>
              <div className="mt-auto bg-slate-100 rounded-xl p-4 flex justify-between items-center gap-2 overflow-hidden h-32 relative">
                {/* 16:9 box */}
                <div className="w-20 h-12 bg-slate-300 rounded border border-slate-400 relative overflow-hidden flex items-center justify-center">
                  <div className="w-4 h-4 bg-slate-500 rounded-full group-hover:translate-x-3 transition-transform duration-1000" />
                  <div className="absolute inset-y-0 left-1/2 w-8 -ml-4 border border-emerald-500/50 bg-emerald-500/10 group-hover:translate-x-3 transition-transform duration-1000" />
                </div>
                <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                </svg>
                {/* 9:16 box */}
                <div className="w-12 h-20 bg-slate-300 rounded border-2 border-emerald-500 flex items-center justify-center shadow-[0_0_15px_rgba(16,185,129,0.3)]">
                  <div className="w-6 h-6 bg-slate-500 rounded-full" />
                </div>
              </div>
            </motion.div>

            {/* Card 3 */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-100px" }}
              transition={{ duration: 0.5, delay: 0.3 }}
              className="bg-white rounded-2xl border border-slate-100 p-6 hover:shadow-lg transition-shadow duration-300 flex flex-col group"
              style={{ boxShadow: "0 4px 24px rgba(0,0,0,0.07)" }}
            >
              <div className="w-12 h-12 bg-purple-500/10 rounded-xl flex items-center justify-center mb-6 text-purple-600">
                <SparkleIcon className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold text-slate-800 mb-3">Auto B-Roll & Smart Emojis</h3>
              <p className="text-slate-500 mb-8 flex-1">
                AI analyzes context to automatically inject relevant stock footage and animated reaction emojis.
              </p>
              <div className="mt-auto bg-slate-900 rounded-xl p-4 h-32 relative overflow-hidden flex items-center justify-center">
                <div className="w-16 h-24 bg-slate-800 rounded border border-slate-700 relative flex items-center justify-center overflow-hidden">
                  <div className="absolute inset-0 bg-indigo-500/20 group-hover:bg-indigo-500/40 transition-colors duration-500" />
                  <span className="text-2xl z-10 group-hover:scale-125 group-hover:-translate-y-2 transition-all duration-500 delay-100">🚀</span>
                  <span className="absolute bottom-2 text-[10px] bg-black/60 text-white px-1.5 py-0.5 rounded font-bold">B-ROLL</span>
                </div>
                <div className="absolute top-4 right-4 text-lg opacity-0 group-hover:opacity-100 -translate-y-4 group-hover:-translate-y-8 transition-all duration-700">🔥</div>
                <div className="absolute bottom-4 left-4 text-lg opacity-0 group-hover:opacity-100 translate-y-4 group-hover:translate-y-0 transition-all duration-500 delay-200">💯</div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ── Section 4: Workspace Showcase ──────────────────────────────────── */}
      <section id="workspace" className="py-24 sm:py-32 px-4 border-t border-slate-100 bg-white">
        <div className="container mx-auto max-w-6xl">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="text-center mb-16"
          >
            <h2 className="font-serif font-bold text-[#16423c] text-3xl sm:text-4xl md:text-5xl mb-4 tracking-tight">
              Your Content Command Center
            </h2>
            <p className="text-lg text-slate-500 max-w-2xl mx-auto">
              Output Studio 2.0 — edit, preview, and export from one hyper-optimized workspace.
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.7, delay: 0.2 }}
            className="w-full bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden shadow-2xl flex flex-col md:flex-row h-[600px] md:h-[500px]"
          >
            {/* Left Panel: Transcript */}
            <div className="hidden md:flex w-64 border-r border-slate-800 bg-slate-900/50 flex-col p-4">
              <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4 pb-2 border-b border-slate-800">Transcript</div>
              <div className="space-y-3 overflow-hidden flex-1 relative">
                {[
                  { time: "0:00", text: "Have you ever wondered" },
                  { time: "0:02", text: "why some videos go absolutely", active: true },
                  { time: "0:04", text: "viral overnight?" },
                  { time: "0:06", text: "The secret is pacing." },
                  { time: "0:08", text: "Let me show you exactly" }
                ].map((line, i) => (
                  <div key={i} className="flex gap-3 items-start">
                    <span className="text-[10px] text-slate-500 mt-0.5">{line.time}</span>
                    <p className={\`text-sm leading-tight \${line.active ? 'text-white font-medium bg-slate-800/80 px-2 py-1 rounded -ml-2' : 'text-slate-400'}\`}>
                      {line.text}
                    </p>
                  </div>
                ))}
                <div className="absolute bottom-0 inset-x-0 h-12 bg-gradient-to-t from-slate-900 to-transparent" />
              </div>
            </div>

            {/* Center Panel: Video Player */}
            <div className="flex-1 bg-black flex items-center justify-center p-4 relative">
              <div className="w-[240px] h-[426px] bg-slate-800 rounded-xl border border-slate-700 relative flex items-center justify-center overflow-hidden">
                {/* Safe Zones */}
                <div className="absolute inset-4 border border-dashed border-white/20 rounded pointer-events-none" />
                {/* Simulated Content */}
                <div className="absolute inset-0 bg-gradient-to-b from-indigo-900/40 to-slate-900/40" />
                <div className="w-16 h-16 rounded-full bg-white/10 backdrop-blur-sm flex items-center justify-center border border-white/20">
                  <svg className="w-6 h-6 text-white ml-1" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M8 5v14l11-7z" />
                  </svg>
                </div>
                {/* Subtitle Overlay */}
                <div className="absolute bottom-16 text-center w-full px-4">
                  <span className="inline-block px-3 py-1 bg-yellow-400 text-black font-black text-xl italic uppercase tracking-tight transform -skew-x-6 border-2 border-black drop-shadow-md">VIRAL</span>
                  <span className="inline-block px-3 py-1 bg-white text-black font-black text-xl italic uppercase tracking-tight transform -skew-x-6 border-2 border-black drop-shadow-md -ml-1">OVERNIGHT?</span>
                </div>
              </div>
            </div>

            {/* Right Panel: Controls */}
            <div className="w-full md:w-72 border-t md:border-t-0 md:border-l border-slate-800 bg-slate-900/50 p-4 flex flex-col h-1/3 md:h-full">
              <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4 pb-2 border-b border-slate-800">Style Presets</div>
              <div className="grid grid-cols-2 gap-2 mb-6">
                {[
                  { name: "Hormozi", color: "bg-yellow-400", active: true },
                  { name: "Ali Abdaal", color: "bg-blue-400", active: false },
                  { name: "Iman Gadzhi", color: "bg-red-500", active: false },
                  { name: "Minimal", color: "bg-white", active: false }
                ].map((style, i) => (
                  <div key={i} className={\`p-2 rounded-lg border \${style.active ? 'border-[#fd6333] bg-[#fd6333]/10' : 'border-slate-800 bg-slate-800/50'} flex items-center gap-2 cursor-pointer\`}>
                    <div className={\`w-3 h-3 rounded-sm \${style.color}\`} />
                    <span className={\`text-xs font-medium \${style.active ? 'text-white' : 'text-slate-400'}\`}>{style.name}</span>
                  </div>
                ))}
              </div>
              
              <div className="mt-auto">
                <button className="w-full py-3 bg-[#fd6333] hover:bg-[#ea532a] text-white font-bold rounded-xl text-sm transition-colors mb-3 shadow-[0_0_15px_rgba(253,99,51,0.3)]">
                  Export 4K Clip
                </button>
                <div className="flex justify-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-slate-400"><TikTokIcon /></div>
                  <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-slate-400"><InstagramIcon /></div>
                  <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-slate-400"><YouTubeIcon /></div>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ── Section 5: Beyond Video ────────────────────────────────────────── */}
      <section id="beyond" className="py-24 sm:py-32 px-4 border-t border-slate-100 bg-slate-50/50">
        <div className="container mx-auto max-w-6xl">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="text-center mb-16"
          >
            <h2 className="font-serif font-bold text-[#16423c] text-3xl sm:text-4xl md:text-5xl mb-4 tracking-tight">
              Beyond Video — AI-Powered Content at Scale
            </h2>
            <p className="text-lg text-slate-500 max-w-2xl mx-auto">
              Extract maximum ROI from every video. We turn one video into a multi-channel content engine.
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Social Threads */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-100px" }}
              transition={{ duration: 0.5, delay: 0.1 }}
              className="bg-white rounded-2xl border border-slate-100 p-8 flex flex-col group"
              style={{ boxShadow: "0 4px 24px rgba(0,0,0,0.07)" }}
            >
              <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center mb-5 text-blue-500">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-slate-800 mb-2">Social Threads</h3>
              <p className="text-sm text-slate-500 mb-8 flex-1">
                Turn any video into viral Twitter/X threads with hooks, storytelling, and CTAs.
              </p>
              <div className="bg-slate-50 rounded-xl p-4 pt-6 relative border border-slate-100 h-40 overflow-hidden">
                <div className="absolute top-0 left-6 bottom-0 w-px bg-slate-200" />
                
                <div className="relative z-10 flex gap-3 mb-4 group-hover:-translate-y-2 transition-transform duration-500">
                  <div className="w-6 h-6 rounded-full bg-slate-300 shrink-0 border-2 border-white ring-1 ring-slate-100" />
                  <div className="flex-1 space-y-1.5 pt-1">
                    <div className="w-3/4 h-2 bg-slate-200 rounded" />
                    <div className="w-full h-2 bg-slate-200 rounded" />
                    <div className="w-5/6 h-2 bg-slate-200 rounded" />
                  </div>
                </div>
                
                <div className="relative z-10 flex gap-3 group-hover:-translate-y-2 transition-transform duration-500 delay-75">
                  <div className="w-6 h-6 rounded-full bg-slate-300 shrink-0 border-2 border-white ring-1 ring-slate-100" />
                  <div className="flex-1 space-y-1.5 pt-1">
                    <div className="w-full h-2 bg-slate-200 rounded" />
                    <div className="w-4/5 h-2 bg-slate-200 rounded" />
                  </div>
                </div>
              </div>
            </motion.div>

            {/* Editorial Blog Posts */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-100px" }}
              transition={{ duration: 0.5, delay: 0.2 }}
              className="bg-white rounded-2xl border border-slate-100 p-8 flex flex-col group"
              style={{ boxShadow: "0 4px 24px rgba(0,0,0,0.07)" }}
            >
              <div className="w-10 h-10 rounded-full bg-amber-50 flex items-center justify-center mb-5 text-amber-500">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9.5a2 2 0 00-2-2h-2" />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-slate-800 mb-2">Editorial Blog Posts</h3>
              <p className="text-sm text-slate-500 mb-8 flex-1">
                Auto-generate SEO-optimized blog posts from your video transcript in seconds.
              </p>
              <div className="bg-slate-50 rounded-xl p-4 border border-slate-100 h-40 overflow-hidden flex flex-col gap-3 group-hover:bg-white transition-colors duration-300">
                <div className="w-full h-12 bg-slate-200 rounded-lg group-hover:bg-slate-300 transition-colors" />
                <div className="w-2/3 h-4 bg-slate-200 rounded-sm" />
                <div className="space-y-1.5">
                  <div className="w-full h-2 bg-slate-100 rounded" />
                  <div className="w-full h-2 bg-slate-100 rounded" />
                  <div className="w-4/5 h-2 bg-slate-100 rounded" />
                </div>
              </div>
            </motion.div>

            {/* GEO Optimization */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-100px" }}
              transition={{ duration: 0.5, delay: 0.3 }}
              className="bg-white rounded-2xl border border-slate-100 p-8 flex flex-col group"
              style={{ boxShadow: "0 4px 24px rgba(0,0,0,0.07)" }}
            >
              <div className="w-10 h-10 rounded-full bg-emerald-50 flex items-center justify-center mb-5 text-emerald-500">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-slate-800 mb-2">GEO Optimization</h3>
              <p className="text-sm text-slate-500 mb-8 flex-1">
                AI-optimized titles, descriptions, and tags for maximum discoverability.
              </p>
              <div className="bg-slate-50 rounded-xl p-4 border border-slate-100 h-40 flex items-center justify-center relative overflow-hidden">
                <div className="absolute top-2 left-2 px-2 py-1 bg-emerald-100 text-emerald-700 text-[10px] font-bold rounded-full group-hover:scale-110 transition-transform">SEO SCORE</div>
                
                <svg className="w-24 h-24 transform -rotate-90" viewBox="0 0 36 36">
                  <path className="text-slate-200" strokeWidth="3" stroke="currentColor" fill="none" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                  <path className="text-emerald-500 transition-all duration-1000 ease-out drop-shadow-sm" strokeWidth="3" strokeDasharray="98, 100" stroke="currentColor" fill="none" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                  <text x="18" y="21.5" className="text-[10px] font-bold fill-emerald-600 text-center" textAnchor="middle">98</text>
                </svg>

                <div className="absolute bottom-2 right-2 flex gap-1">
                  <span className="w-8 h-1.5 bg-slate-200 rounded-full" />
                  <span className="w-6 h-1.5 bg-slate-200 rounded-full" />
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ── Section 6: Pricing / Waitlist ──────────────────────────────────── */}
      <section id="pricing" className="py-24 sm:py-32 px-4 border-t border-slate-100 bg-white relative overflow-hidden">
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-[#fd6333]/5 rounded-full blur-[100px] pointer-events-none -translate-y-1/2 translate-x-1/3" />
        
        <div className="container mx-auto max-w-6xl relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="text-center mb-16"
          >
            <h2 className="font-serif font-bold text-[#16423c] text-3xl sm:text-4xl md:text-5xl mb-4 tracking-tight">
              Simple, Transparent Pricing
            </h2>
            <p className="text-lg text-slate-500 max-w-2xl mx-auto">
              Start free. Scale when you're ready. No hidden fees.
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-center max-w-5xl mx-auto">
            {/* Free Tier */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-100px" }}
              transition={{ duration: 0.5, delay: 0.1 }}
              className="bg-white rounded-3xl border border-slate-100 p-8 flex flex-col h-full"
              style={{ boxShadow: "0 4px 24px rgba(0,0,0,0.04)" }}
            >
              <h3 className="text-xl font-bold text-slate-800 mb-2">Free</h3>
              <div className="flex items-baseline gap-1 mb-6">
                <span className="text-4xl font-bold text-slate-900">$0</span>
                <span className="text-sm text-slate-500 font-medium">/month</span>
              </div>
              <p className="text-sm text-slate-600 font-semibold mb-6 pb-6 border-b border-slate-100">2 clips per month</p>
              <ul className="space-y-4 mb-8 flex-1">
                {[
                  "Basic subtitles",
                  "720p export",
                  "1 platform integration",
                  "Watermark included"
                ].map((f, i) => (
                  <li key={i} className="flex items-start gap-3 text-sm text-slate-600">
                    <svg className="w-5 h-5 text-slate-300 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                    {f}
                  </li>
                ))}
              </ul>
              <Link href="/signup" className="block w-full py-3 px-4 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-center rounded-xl transition-colors text-sm">
                Start Free
              </Link>
            </motion.div>

            {/* Pro Tier */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-100px" }}
              transition={{ duration: 0.5, delay: 0.2 }}
              className="bg-white rounded-3xl border-2 border-[#fd6333] p-8 flex flex-col h-[105%] relative md:-my-4 z-10"
              style={{ boxShadow: "0 20px 40px -10px rgba(253,99,51,0.15)" }}
            >
              <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-[#fd6333] text-white text-[10px] font-bold uppercase tracking-widest py-1 px-4 rounded-full">
                Most Popular
              </div>
              <h3 className="text-xl font-bold text-slate-800 mb-2">Pro</h3>
              <div className="flex items-baseline gap-1 mb-6">
                <span className="text-5xl font-bold text-slate-900">$29</span>
                <span className="text-sm text-slate-500 font-medium">/month</span>
              </div>
              <p className="text-sm text-[#fd6333] font-bold mb-6 pb-6 border-b border-slate-100">50 clips per month</p>
              <ul className="space-y-4 mb-8 flex-1">
                {[
                  "Interactive subtitles",
                  "AI Face-tracking & Reframe",
                  "4K export quality",
                  "All platforms supported",
                  "No watermark",
                  "Blog & thread generation",
                  "Priority GPU access"
                ].map((f, i) => (
                  <li key={i} className="flex items-start gap-3 text-sm text-slate-700 font-medium">
                    <svg className="w-5 h-5 text-emerald-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                    {f}
                  </li>
                ))}
              </ul>
              <button 
                onClick={() => setStage("modal")}
                className="w-full py-4 px-4 bg-[#fd6333] hover:bg-[#ea532a] text-white font-bold text-center rounded-xl transition-colors shadow-lg shadow-[#fd6333]/20"
              >
                Join the Waitlist
              </button>
            </motion.div>

            {/* Agency Tier */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-100px" }}
              transition={{ duration: 0.5, delay: 0.3 }}
              className="bg-white rounded-3xl border border-slate-100 p-8 flex flex-col h-full"
              style={{ boxShadow: "0 4px 24px rgba(0,0,0,0.04)" }}
            >
              <h3 className="text-xl font-bold text-slate-800 mb-2">Agency</h3>
              <div className="flex items-baseline gap-1 mb-6">
                <span className="text-4xl font-bold text-slate-900">$99</span>
                <span className="text-sm text-slate-500 font-medium">/month</span>
              </div>
              <p className="text-sm text-slate-600 font-semibold mb-6 pb-6 border-b border-slate-100">Unlimited clips</p>
              <ul className="space-y-4 mb-8 flex-1">
                {[
                  "Everything in Pro",
                  "Team collaboration",
                  "API access",
                  "Custom branding",
                  "Dedicated support",
                  "White-label export"
                ].map((f, i) => (
                  <li key={i} className="flex items-start gap-3 text-sm text-slate-600">
                    <svg className="w-5 h-5 text-emerald-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                    {f}
                  </li>
                ))}
              </ul>
              <button 
                onClick={() => setStage("modal")}
                className="w-full py-3 px-4 bg-white border-2 border-slate-200 hover:border-slate-300 text-slate-800 font-bold text-center rounded-xl transition-colors text-sm"
              >
                Join the Waitlist
              </button>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ── Section 7: Comparison Table ────────────────────────────────────── */}
      <section id="comparison" className="py-24 sm:py-32 px-4 border-t border-slate-100 bg-slate-50/50">
        <div className="container mx-auto max-w-5xl">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="text-center mb-16"
          >
            <h2 className="font-serif font-bold text-[#16423c] text-3xl sm:text-4xl md:text-5xl mb-4 tracking-tight">
              Why Creators Choose Clip
            </h2>
            <p className="text-lg text-slate-500">
              The most powerful AI clipping engine on the market.
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="w-full overflow-x-auto pb-4"
          >
            <div className="min-w-[800px] bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
              {/* Header */}
              <div className="grid grid-cols-5 border-b border-slate-200 bg-slate-50/80">
                <div className="p-4 md:p-6 font-bold text-slate-500 text-sm uppercase tracking-wider flex items-center">Feature</div>
                <div className="p-4 md:p-6 font-bold text-[#fd6333] text-lg bg-[#fd6333]/5 flex items-center justify-center border-x border-[#fd6333]/20">Clip</div>
                <div className="p-4 md:p-6 font-semibold text-slate-700 text-center flex items-center justify-center">Opus Clip</div>
                <div className="p-4 md:p-6 font-semibold text-slate-700 text-center flex items-center justify-center">Submagic</div>
                <div className="p-4 md:p-6 font-semibold text-slate-700 text-center flex items-center justify-center">Vidyo.ai</div>
              </div>
              
              {/* Rows */}
              {[
                { name: "Parallel GPU Rendering", clip: true, opus: false, submagic: false, vidyo: false },
                { name: "Editable Subtitles", clip: true, opus: false, submagic: true, vidyo: false },
                { name: "AI B-Roll Injection", clip: true, opus: false, submagic: false, vidyo: false },
                { name: "Face-Tracking Reframe", clip: true, opus: true, submagic: true, vidyo: true },
                { name: "Blog & Thread Generation", clip: true, opus: false, submagic: false, vidyo: false },
                { name: "GEO Optimization", clip: true, opus: false, submagic: false, vidyo: false }
              ].map((row, i, arr) => (
                <div key={i} className={\`grid grid-cols-5 \${i !== arr.length - 1 ? 'border-b border-slate-100' : ''}\`}>
                  <div className="p-4 md:p-5 font-semibold text-slate-800 flex items-center text-sm">{row.name}</div>
                  <div className="p-4 md:p-5 bg-[#fd6333]/5 border-x border-[#fd6333]/10 flex items-center justify-center">
                    {row.clip ? (
                      <div className="w-6 h-6 rounded-full bg-emerald-500 flex items-center justify-center shadow-sm shadow-emerald-500/20"><svg className="w-4 h-4 text-white" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg></div>
                    ) : (
                      <div className="w-6 h-6 rounded-full bg-red-100 flex items-center justify-center"><svg className="w-4 h-4 text-red-500" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" /></svg></div>
                    )}
                  </div>
                  <div className="p-4 md:p-5 flex items-center justify-center">
                    {row.opus ? (
                      <div className="w-6 h-6 rounded-full bg-emerald-500 flex items-center justify-center shadow-sm shadow-emerald-500/20"><svg className="w-4 h-4 text-white" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg></div>
                    ) : (
                      <div className="w-6 h-6 rounded-full bg-red-100 flex items-center justify-center"><svg className="w-4 h-4 text-red-500" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" /></svg></div>
                    )}
                  </div>
                  <div className="p-4 md:p-5 flex items-center justify-center">
                    {row.submagic ? (
                      <div className="w-6 h-6 rounded-full bg-emerald-500 flex items-center justify-center shadow-sm shadow-emerald-500/20"><svg className="w-4 h-4 text-white" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg></div>
                    ) : (
                      <div className="w-6 h-6 rounded-full bg-red-100 flex items-center justify-center"><svg className="w-4 h-4 text-red-500" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" /></svg></div>
                    )}
                  </div>
                  <div className="p-4 md:p-5 flex items-center justify-center">
                    {row.vidyo ? (
                      <div className="w-6 h-6 rounded-full bg-emerald-500 flex items-center justify-center shadow-sm shadow-emerald-500/20"><svg className="w-4 h-4 text-white" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg></div>
                    ) : (
                      <div className="w-6 h-6 rounded-full bg-red-100 flex items-center justify-center"><svg className="w-4 h-4 text-red-500" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" /></svg></div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      </section>

      {/* ── Section 8: FAQ + Final CTA ─────────────────────────────────────── */}
      <section id="faq" className="py-24 sm:py-32 px-4 border-t border-slate-100 bg-white relative">
        <div className="container mx-auto max-w-3xl mb-32">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="text-center mb-12"
          >
            <h2 className="font-serif font-bold text-[#16423c] text-3xl sm:text-4xl md:text-5xl mb-4 tracking-tight">
              Frequently Asked Questions
            </h2>
          </motion.div>

          <div className="space-y-4">
            {[
              {
                q: "How does Clip generate clips so fast?",
                a: "Clip uses Parallel GPU Fan-out technology. Instead of processing your video sequentially (one clip after another), we distribute the workload across multiple GPUs to render all your clips simultaneously."
              },
              {
                q: "Can I edit the subtitles after generation?",
                a: "Yes! Our interactive subtitle editor lets you tweak every single word, adjust timings, change colors, and modify animations to match your exact brand style."
              },
              {
                q: "What video formats and platforms are supported?",
                a: "We support all major platforms including TikTok, Instagram Reels, YouTube Shorts, LinkedIn, and X. You can export in up to 4K resolution."
              },
              {
                q: "Is there a free plan?",
                a: "Yes, our free tier includes 2 clips per month with basic subtitles and 720p export. It's perfect for testing out the platform."
              },
              {
                q: "How does the blog and thread generation work?",
                a: "Our AI analyzes your video transcript, extracts the core narrative and key insights, and reformats them into engaging Twitter/X threads and SEO-optimized blog posts."
              },
              {
                q: "What makes Clip different from Opus Clip or Submagic?",
                a: "Unlike competitors, Clip offers true parallel rendering (10x faster), a complete built-in workspace for manual tweaks, and expands your reach beyond just video by auto-generating text content."
              }
            ].map((faq, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 10 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-50px" }}
                transition={{ duration: 0.4, delay: i * 0.1 }}
                className="border border-slate-200 rounded-2xl bg-white overflow-hidden"
                style={{ boxShadow: "0 4px 24px rgba(0,0,0,0.02)" }}
              >
                <button
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  className="w-full flex items-center justify-between p-6 text-left focus:outline-none"
                >
                  <span className="font-bold text-slate-800 pr-4">{faq.q}</span>
                  <motion.div
                    animate={{ rotate: openFaq === i ? 180 : 0 }}
                    transition={{ duration: 0.3 }}
                    className="w-6 h-6 rounded-full bg-slate-50 flex items-center justify-center shrink-0 text-slate-500"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                    </svg>
                  </motion.div>
                </button>
                <AnimatePresence>
                  {openFaq === i && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.3 }}
                    >
                      <div className="px-6 pb-6 text-slate-500 text-sm leading-relaxed border-t border-slate-50 pt-4">
                        {faq.a}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Final CTA */}
        <div className="container mx-auto max-w-4xl text-center relative z-10 bg-slate-50 rounded-[3rem] p-12 sm:p-20 border border-slate-100 shadow-xl overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-full overflow-hidden rounded-[3rem] z-0">
            <div className="absolute -top-1/2 -right-1/4 w-[600px] h-[600px] bg-[#fd6333]/10 rounded-full blur-[100px]" />
            <div className="absolute -bottom-1/2 -left-1/4 w-[600px] h-[600px] bg-[#16423c]/5 rounded-full blur-[100px]" />
          </div>
          
          <div className="relative z-10">
            <motion.h2
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="font-serif font-bold text-[#16423c] text-4xl sm:text-5xl md:text-6xl mb-6 tracking-tight"
            >
              Ready to Go Viral?
            </motion.h2>
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.1 }}
              className="text-lg sm:text-xl text-slate-500 mb-10"
            >
              Paste a YouTube URL and watch the magic happen.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.2 }}
              className="flex flex-col items-center max-w-xl mx-auto"
            >
              <div
                className="w-full relative flex items-center p-2 bg-white/90 backdrop-blur-xl border border-slate-200/80 rounded-full mb-6"
                style={{ boxShadow: "0 20px 50px -12px rgba(253,99,51,0.12), 0 0 0 1px rgba(253,99,51,0.06)" }}
              >
                <LinkIcon className="w-5 h-5 text-slate-400 pl-4 pr-2 flex-shrink-0 w-11" />
                <input
                  type="text"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleGenerate()}
                  placeholder="https://www.youtube.com/watch?v=..."
                  className="flex-1 bg-transparent px-2 py-3 outline-none text-base text-slate-800 placeholder:text-slate-400 min-w-0"
                  disabled={stage !== "idle"}
                />
                <button
                  onClick={handleGenerate}
                  disabled={stage !== "idle"}
                  className={\`flex-shrink-0 flex items-center gap-2 text-white px-5 sm:px-7 py-3 rounded-full font-bold text-sm transition-all \${stage !== "idle" ? "opacity-90" : "hover:scale-[1.02] active:scale-[0.98] animate-pulse-glow"}\`}
                  style={{ background: "linear-gradient(135deg, #fd6333, #c84a20)" }}
                >
                  {stage === "loading" ? (
                    <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
                      <path d="M21 12a9 9 0 11-6.219-8.56" />
                    </svg>
                  ) : (
                    <>
                      <SparkleIcon className="w-4 h-4" />
                      <span className="hidden sm:inline">Generate Content</span>
                      <span className="sm:hidden">Generate</span>
                    </>
                  )}
                </button>
              </div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest">
                No credit card required · 3 free clips · Cancel anytime
              </p>
            </motion.div>
          </div>
        </div>
      </section>
`;

content = content.replace(
  '        </div>\n      </section>\n\n      {/* Email Capture Modal */}',
  newSections + '\n      {/* Email Capture Modal */}'
);

// 3. Add Footer
const newFooter = `
      {/* ── Footer ─────────────────────────────────────────────────────────── */}
      <footer className="bg-slate-50 border-t border-slate-200 pt-16 pb-8 px-4">
        <div className="container mx-auto max-w-6xl">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-8 mb-12">
            <div className="col-span-2">
              <Link href="/" className="flex items-center gap-2.5 mb-4">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 bg-[#16423c]">
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="2" y="7" width="20" height="14" rx="2" />
                    <path d="M2 11h20" />
                    <path d="M7 3l2 4" />
                    <path d="M12 3l2 4" />
                    <path d="M17 3l2 4" />
                  </svg>
                </div>
                <span className="text-xl font-bold tracking-tight text-slate-900">Cremiro</span>
              </Link>
              <p className="text-sm text-slate-500 max-w-xs mb-6">
                The fastest way to turn long-form videos into viral short-form content, threads, and blogs.
              </p>
            </div>
            
            <div>
              <h4 className="font-bold text-slate-900 mb-4">Product</h4>
              <ul className="space-y-3">
                <li><Link href="#" className="text-sm text-slate-500 hover:text-[#fd6333] transition-colors">Features</Link></li>
                <li><Link href="#" className="text-sm text-slate-500 hover:text-[#fd6333] transition-colors">Pricing</Link></li>
                <li><Link href="#" className="text-sm text-slate-500 hover:text-[#fd6333] transition-colors">API</Link></li>
                <li><Link href="#" className="text-sm text-slate-500 hover:text-[#fd6333] transition-colors">Changelog</Link></li>
              </ul>
            </div>
            
            <div>
              <h4 className="font-bold text-slate-900 mb-4">Resources</h4>
              <ul className="space-y-3">
                <li><Link href="#" className="text-sm text-slate-500 hover:text-[#fd6333] transition-colors">Blog</Link></li>
                <li><Link href="#" className="text-sm text-slate-500 hover:text-[#fd6333] transition-colors">Help Center</Link></li>
                <li><Link href="#" className="text-sm text-slate-500 hover:text-[#fd6333] transition-colors">Tutorials</Link></li>
                <li><Link href="#" className="text-sm text-slate-500 hover:text-[#fd6333] transition-colors">Status</Link></li>
              </ul>
            </div>
            
            <div>
              <h4 className="font-bold text-slate-900 mb-4">Company</h4>
              <ul className="space-y-3">
                <li><Link href="#" className="text-sm text-slate-500 hover:text-[#fd6333] transition-colors">About</Link></li>
                <li><Link href="#" className="text-sm text-slate-500 hover:text-[#fd6333] transition-colors">Careers</Link></li>
                <li><Link href="#" className="text-sm text-slate-500 hover:text-[#fd6333] transition-colors">Contact</Link></li>
                <li><Link href="#" className="text-sm text-slate-500 hover:text-[#fd6333] transition-colors">Press</Link></li>
              </ul>
            </div>
          </div>
          
          <div className="pt-8 border-t border-slate-200 flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="flex items-center gap-4 text-xs text-slate-400">
              <span>© 2025 Cremiro. All rights reserved.</span>
              <Link href="#" className="hover:text-slate-600 transition-colors">Privacy</Link>
              <Link href="#" className="hover:text-slate-600 transition-colors">Terms</Link>
              <Link href="#" className="hover:text-slate-600 transition-colors">Cookies</Link>
            </div>
            <div className="flex items-center gap-4 text-slate-400">
              <Link href="#" className="hover:text-[#fd6333] transition-colors"><XIcon className="w-4 h-4" /></Link>
              <Link href="#" className="hover:text-[#0077B5] transition-colors"><LinkedInIcon className="w-4 h-4" /></Link>
              <Link href="#" className="hover:text-[#FF0000] transition-colors"><YouTubeIcon className="w-4 h-4" /></Link>
              <Link href="#" className="hover:text-[#010101] transition-colors"><TikTokIcon className="w-4 h-4" /></Link>
            </div>
          </div>
        </div>
      </footer>
`;

content = content.replace(
  '      </AnimatePresence>\n\n    </div>\n  );\n}',
  '      </AnimatePresence>\n' + newFooter + '\n    </div>\n  );\n}'
);

fs.writeFileSync(file, content, 'utf8');
console.log('Update complete!');