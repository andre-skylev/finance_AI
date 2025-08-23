const fs = require('fs');

const content = fs.readFileSync('src/app/api/pdf-upload/route.ts', 'utf8');
const lines = content.split('\n');

let tryStack = [];
let braceStack = [];
let line = 1;

for (const lineContent of lines) {
  const trimmed = lineContent.trim();
  
  if (trimmed.includes('try {')) {
    tryStack.push(line);
    console.log(`TRY at line ${line}:`, trimmed);
  }
  
  if (trimmed.includes('} catch')) {
    const tryLine = tryStack.pop();
    console.log(`CATCH at line ${line} (matches try at ${tryLine}):`, trimmed);
  }
  
  // Count braces specifically for function declarations
  if (trimmed.includes('export async function') || trimmed.includes('function ')) {
    if (trimmed.includes('{')) {
      braceStack.push({type: 'function', line});
    }
  }
  
  line++;
}

console.log('\nOrphan tries:', tryStack);
console.log('Function stack:', braceStack);
