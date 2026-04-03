const fs = require('fs');

let content = fs.readFileSync('app/page.tsx', 'utf8');

content = content.replace(/bg-slate-100/g, 'bg-white/10');
content = content.replace(/bg-slate-200/g, 'bg-white/20');
content = content.replace(/bg-slate-300/g, 'bg-white/30');

content = content.replace(/ring-slate-100/g, 'ring-white/10');
content = content.replace(/border-slate-400/g, 'border-white/20');

// Fix text-slate-100 on bg-slate-100, which is now text-slate-100 on bg-white/10 -> that is perfectly readable in dark mode.

fs.writeFileSync('app/page.tsx', content);
console.log('Mockups fixed!');