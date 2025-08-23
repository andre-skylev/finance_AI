const fs = require('fs');

const content = fs.readFileSync('src/app/api/pdf-upload/route.ts', 'utf8');
const lines = content.split('\n');

let braceCount = 0;
let parenCount = 0;
let bracketCount = 0;
let errors = [];

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  const lineNum = i + 1;
  
  for (let j = 0; j < line.length; j++) {
    const char = line[j];
    
    if (char === '{') braceCount++;
    if (char === '}') {
      braceCount--;
      if (braceCount < 0) {
        errors.push(`Extra } at line ${lineNum}: ${line.trim()}`);
      }
    }
    
    if (char === '(') parenCount++;
    if (char === ')') {
      parenCount--;
      if (parenCount < 0) {
        errors.push(`Extra ) at line ${lineNum}: ${line.trim()}`);
      }
    }
    
    if (char === '[') bracketCount++;
    if (char === ']') {
      bracketCount--;
      if (bracketCount < 0) {
        errors.push(`Extra ] at line ${lineNum}: ${line.trim()}`);
      }
    }
  }
  
  // Check for specific problems around line 1968
  if (lineNum >= 1965 && lineNum <= 1970) {
    console.log(`Line ${lineNum}: braces=${braceCount}, parens=${parenCount} | ${line}`);
  }
}

console.log('\nFinal counts:');
console.log('Braces:', braceCount);
console.log('Parens:', parenCount);
console.log('Brackets:', bracketCount);

if (errors.length > 0) {
  console.log('\nErrors found:');
  errors.forEach(error => console.log(error));
} else {
  console.log('\nNo syntax errors detected in brackets/braces/parens');
}
