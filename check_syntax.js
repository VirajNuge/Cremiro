const fs = require('fs');
const parser = require('@babel/parser');

const code = fs.readFileSync('app/page.tsx', 'utf8');

try {
  parser.parse(code, {
    sourceType: 'module',
    plugins: ['jsx', 'typescript']
  });
  console.log("Syntax is OK!");
} catch (e) {
  console.log('Error at Line: ' + e.loc.line + ', Col: ' + e.loc.column);
  console.log('Message: ' + e.message);
  
  // To find the exact unclosed tag, we can manually trace jsx tags or braces.
  let stack = [];
  let tokenRegex = /<\/?([a-zA-Z0-9\.\_]+)[^>]*>|{|}/g;
  let match;
  while ((match = tokenRegex.exec(code)) !== null) {
      // Very basic trace.
  }
}
