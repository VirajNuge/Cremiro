const fs = require('fs');

let content = fs.readFileSync('app/page.tsx', 'utf8');

// Global wrapper
content = content.replace(
  /className="min-h-screen bg-white font-sans"/g,
  'className="min-h-screen bg-[#060c0b] text-slate-200 font-sans selection:bg-[#fd6333]/30"'
);

// Nav
content = content.replace(
  /bg-white md:bg-white\/80 md:backdrop-blur-lg border border-gray-100/g,
  'bg-[#0d1f1c]/80 md:backdrop-blur-lg border border-white/10'
);

// General background replacements (cautious order)
content = content.replace(/bg-slate-50/g, 'bg-[#0a1916]');
content = content.replace(/bg-white(?!\/)/g, 'bg-[#0d1f1c]'); // Replace bg-white that aren't bg-white/xx

// Text colors
content = content.replace(/text-slate-900/g, 'text-slate-100');
content = content.replace(/text-slate-800/g, 'text-slate-100');
content = content.replace(/text-slate-700/g, 'text-slate-300');
content = content.replace(/text-slate-600/g, 'text-slate-400');
content = content.replace(/text-slate-500/g, 'text-slate-400');
content = content.replace(/text-\[\#16423c\]/g, 'text-white');
content = content.replace(/text-gray-500/g, 'text-slate-400');
content = content.replace(/text-gray-600/g, 'text-slate-400');
content = content.replace(/text-gray-700/g, 'text-slate-300');
content = content.replace(/text-gray-800/g, 'text-slate-100');
content = content.replace(/text-gray-900/g, 'text-slate-100');

// Borders
content = content.replace(/border-slate-100/g, 'border-white/5');
content = content.replace(/border-slate-200/g, 'border-white/10');
content = content.replace(/border-gray-100/g, 'border-white/10');
content = content.replace(/border-gray-200/g, 'border-white/10');

// Shadows
content = content.replace(/shadow-sm/g, 'shadow-[0_0_40px_rgba(253,99,51,0.1)]');
content = content.replace(/shadow-md/g, 'shadow-[0_0_40px_rgba(253,99,51,0.1)]');
content = content.replace(/shadow-lg/g, 'shadow-[0_0_40px_rgba(253,99,51,0.1)]');
content = content.replace(/shadow-xl/g, 'shadow-[0_0_40px_rgba(253,99,51,0.1)]');
content = content.replace(/shadow-2xl/g, 'shadow-[0_0_40px_rgba(253,99,51,0.1)]');

// Some specific fixes based on expected outcome
content = content.replace(/<section className="([^"]*)bg-\[\#0d1f1c\]/g, '<section className="$1bg-[#060c0b]');

fs.writeFileSync('app/page.tsx', content);
console.log('Theme updated!');
