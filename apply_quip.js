const fs = require('fs');
const path = require('path');

const pageFile = path.join(__dirname, 'app/page.tsx');
let content = fs.readFileSync(pageFile, 'utf8');

// 1. Color Palette Swaps
content = content.replace(/#fd6333/g, '#6B46FF'); // Primary orange to Quip purple/indigo
content = content.replace(/#ea532a/g, '#5635DB'); // Hover state
content = content.replace(/#c84a20/g, '#5635DB'); // Gradients
content = content.replace(/#eb582d/g, '#5635DB'); // Other hovers
content = content.replace(/#16423c/g, '#0f172a'); // Dark green to dark slate

// 2. Font Swaps
content = content.replace(/font-serif font-black/g, 'font-sans font-black tracking-tight');
content = content.replace(/font-serif font-bold/g, 'font-sans font-bold tracking-tight');

// 3. Navbar Updates
const oldNav = `<nav className="container mx-auto bg-white md:bg-white/80 md:backdrop-blur-lg border border-gray-100 rounded-3xl p-3">`;
const newNav = `<nav className="mx-auto max-w-4xl bg-white/90 backdrop-blur-xl shadow-[0_4px_40px_rgba(0,0,0,0.06)] border border-slate-100/60 rounded-full px-6 py-2 mt-4 transition-all">`;
content = content.replace(oldNav, newNav);

const oldCremiroText = `<span className="text-lg font-bold tracking-tight text-slate-900">Cremiro</span>`;
const newClipText = `<span className="text-xl font-bold tracking-tight text-slate-900">Clip</span>`;
content = content.replace(oldCremiroText, newClipText);
content = content.replace(/Cremiro/g, 'Clip'); // Rename brand

// Simplified logo (White Speech bubble in rounded box)
const oldSvg = `<svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="2" y="7" width="20" height="14" rx="2" />
                  <path d="M2 11h20" />
                  <path d="M7 3l2 4" />
                  <path d="M12 3l2 4" />
                  <path d="M17 3l2 4" />
                </svg>`;
const newSvg = `<svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="currentColor">
  <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z" />
</svg>`;
content = content.replace(oldSvg, newSvg);

// Quip Buttons are pill shaped
content = content.replace(/rounded-lg/g, 'rounded-full');

// 4. Hero Section specific updates
// Hero section background
const heroSectionIdx = content.indexOf(`{/* ── Section B: Hero Section ────────────────────────────────────────── */}`);
if (heroSectionIdx !== -1) {
  const insertPoint = content.indexOf(`{/* Scattered Floating Cards`, heroSectionIdx);
  if (insertPoint !== -1) {
    const dottedBg = `
        {/* Quip-style dotted background grid */}
        <div className="absolute inset-0 z-0 pointer-events-none opacity-[0.15] flex items-center justify-center">
          <svg className="w-full h-full max-w-[1400px]" viewBox="0 0 1400 800" fill="none" preserveAspectRatio="xMidYMid slice">
            <path d="M0 400 H 1400" stroke="#6B46FF" strokeWidth="1" strokeDasharray="4 6" />
            <path d="M700 0 V 800" stroke="#6B46FF" strokeWidth="1" strokeDasharray="4 6" />
            <path d="M200 200 Q 700 0 1200 200" stroke="#6B46FF" strokeWidth="1" strokeDasharray="4 6" />
            <path d="M200 600 Q 700 800 1200 600" stroke="#6B46FF" strokeWidth="1" strokeDasharray="4 6" />
          </svg>
        </div>
        `;
    content = content.slice(0, insertPoint) + dottedBg + content.slice(insertPoint);
  }
}

// Sparkle Badge
content = content.replace(/Powered by Parallel GPU Fan-out/g, 'NEW: PARALLEL GPU FAN-OUT RENDERING IS LIVE JAN 01, 2025');
content = content.replace(/bg-orange-50 border border-orange-100/g, 'bg-transparent border border-slate-200/50 shadow-sm');
content = content.replace(/text-xs font-semibold text-\[#6B46FF\] uppercase tracking-wide/g, 'text-[10px] font-bold text-slate-500 uppercase tracking-widest');

// Main title text
content = content.replace(/Create Once\./g, 'Create Once.');
content = content.replace(/Go Viral Everywhere\./g, 'Go Viral Everywhere.');

// URL Input Area
const oldBoxShadow = `boxShadow: "0 20px 50px -12px rgba(253,99,51,0.12), 0 0 0 1px rgba(253,99,51,0.06)"`;
const newBoxShadow = `boxShadow: "0 8px 30px rgba(107, 70, 255, 0.15), 0 0 0 1px rgba(107, 70, 255, 0.1)"`;
content = content.replace(oldBoxShadow, newBoxShadow);

// Clean up Floating Cards
// Card 1: User Research style (Clips Generated card -> replace text)
content = content.replace(/Clips Generated/g, 'Content Output');
content = content.replace(/3 remaining/g, '12 Generated');

// Output file
fs.writeFileSync(pageFile, content);
console.log("Page updated with layout and Quip colors.");
