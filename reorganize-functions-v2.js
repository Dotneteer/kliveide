const fs = require('fs');
const path = require('path');

// Read the M6510Cpu.ts file
const filePath = path.join(__dirname, 'src/emu/m6510/M6510Cpu.ts');
const content = fs.readFileSync(filePath, 'utf8');

// Manually define the operation table order based on the actual file content
const operationTableOrder = [
  'brk', 'oraIndX', 'jam', 'sloIndX', 'dopZp', 'oraZp', 'aslZp', 'sloZp',
  'php', 'oraImm', 'aslA', 'aacImm', 'topAbs', 'oraAbs', 'aslAbs', 'sloAbs',
  'bpl', 'oraIndY', 'jam', 'sloIndY', 'dopZpX', 'oraZpX', 'aslZpX', 'sloZpX',
  'clc', 'oraAbsY', 'illegal', 'sloAbsY', 'topAbsX', 'oraAbsX', 'aslAbsX', 'sloAbsX',
  'jsr', 'andIndX', 'jam', 'rlaIndX', 'bitZp', 'andZp', 'rolZp', 'rlaZp',
  'plp', 'andImm', 'rolA', 'aacImm', 'bitAbs', 'andAbs', 'rolAbs', 'rlaAbs',
  'bmi', 'andIndY', 'jam', 'rlaIndY', 'dopZpX', 'andZpX', 'rolZpX', 'rlaZpX',
  'sec', 'andAbsY', 'illegal', 'rlaAbsY', 'topAbsX', 'andAbsX', 'rolAbsX', 'rlaAbsX',
  'rti', 'eorIndX', 'jam', 'sreIndX', 'dopZp', 'eorZp', 'lsrZp', 'sreZp',
  'pha', 'eorImm', 'lsrA', 'asrImm', 'jmp', 'eorAbs', 'lsrAbs', 'sreAbs',
  'bvc', 'eorIndY', 'jam', 'sreIndY', 'dopZpX', 'eorZpX', 'lsrZpX', 'sreZpX',
  'cli', 'eorAbsY', 'illegal', 'sreAbsY', 'topAbsX', 'eorAbsX', 'lsrAbsX', 'sreAbsX',
  'rts', 'adcIndX', 'jam', 'rraIndX', 'dopZp', 'adcZp', 'rorZp', 'rraZp',
  'pla', 'adcImm', 'rorA', 'arrImm', 'jmpInd', 'adcAbs', 'rorAbs', 'rraAbs',
  'bvs', 'adcIndY', 'jam', 'rraIndY', 'illegal', 'adcZpX', 'rorZpX', 'rraZpX',
  'sei', 'adcAbsY', 'illegal', 'rraAbsY', 'topAbsX', 'adcAbsX', 'rorAbsX', 'rraAbsX',
  'dopImm', 'staIndX', 'dopImm', 'saxIndX', 'styZp', 'staZp', 'stxZp', 'saxZp',
  'dey', 'dopImm', 'txa', 'xaaImm', 'styAbs', 'staAbs', 'stxAbs', 'saxAbs',
  'bcc', 'staIndY', 'jam', 'axaIndY', 'styZpX', 'staZpX', 'stxZpY', 'saxZpY',
  'tya', 'staAbsY', 'txs', 'xasAbsY', 'syaAbsX', 'staAbsX', 'sxaAbsY', 'axaAbsY',
  'ldyImm', 'ldaIndX', 'ldxImm', 'laxIndX', 'ldyZp', 'ldaZp', 'ldxZp', 'laxZp',
  'tay', 'ldaImm', 'tax', 'atxImm', 'ldyAbs', 'ldaAbs', 'ldxAbs', 'laxAbs',
  'bcs', 'ldaIndY', 'jam', 'laxIndY', 'ldyZpX', 'ldaZpX', 'ldxZpY', 'laxZpY',
  'clv', 'ldaAbsY', 'tsx', 'larAbsY', 'ldyAbsX', 'ldaAbsX', 'ldxAbsY', 'laxAbsY',
  'cpyImm', 'cmpIndX', 'dopImm', 'dcpIndX', 'cpyZp', 'cmpZp', 'decZp', 'dcpZp',
  'iny', 'cmpImm', 'dex', 'axsImm', 'cpyAbs', 'cmpAbs', 'decAbs', 'dcpAbs',
  'bne', 'cmpIndY', 'jam', 'dcpIndY', 'dopZpX', 'cmpZpX', 'decZpX', 'dcpZpX',
  'cld', 'cmpAbsY', 'illegal', 'dcpAbsY', 'topAbsX', 'cmpAbsX', 'decAbsX', 'dcpAbsX',
  'cpxImm', 'sbcIndX', 'dopImm', 'iscIndX', 'cpxZp', 'sbcZp', 'incZp', 'iscZp',
  'inx', 'sbcImm', 'nop', 'sbcImm', 'cpxAbs', 'sbcAbs', 'incAbs', 'iscAbs',
  'beq', 'sbcIndY', 'jam', 'iscIndY', 'dopZpX', 'sbcZpX', 'incZpX', 'iscZpX',
  'sed', 'sbcAbsY', 'illegal', 'iscAbsY', 'topAbsX', 'sbcAbsX', 'incAbsX', 'iscAbsX'
];

console.log('Operation table has', operationTableOrder.length, 'entries');

// Find the start and end of the functions section more carefully
const functionsStartMarker = '// 6510 operation implementations';
const functionsStartIndex = content.indexOf(functionsStartMarker);
const functionsStart = content.indexOf('\nfunction ', functionsStartIndex);

// Find the last function by looking for the last closing brace before any export or class definition
const endMarkers = ['\nexport ', '\nclass ', '\n}', '\n// '];
let functionsEnd = content.length;

for (const marker of endMarkers) {
  const index = content.lastIndexOf(marker);
  if (index > functionsStart && index < functionsEnd) {
    // Look backward from this marker to find the last closing brace
    let bracePos = index;
    while (bracePos > functionsStart && content[bracePos] !== '}') {
      bracePos--;
    }
    if (bracePos > functionsStart) {
      functionsEnd = Math.min(functionsEnd, bracePos + 1);
    }
  }
}

console.log('Functions section from', functionsStart, 'to', functionsEnd);

const beforeFunctions = content.substring(0, functionsStart);
const functionsSection = content.substring(functionsStart, functionsEnd);
const afterFunctions = content.substring(functionsEnd);

// Extract each function more carefully using a regex that handles multi-line functions
const functions = {};
const functionRegex = /\nfunction\s+([a-zA-Z][a-zA-Z0-9]*)\s*\([^)]*\):\s*[^{]*\{/g;
let match;
const functionStarts = [];

while ((match = functionRegex.exec(functionsSection)) !== null) {
  functionStarts.push({
    name: match[1],
    start: match.index,
    fullMatch: match[0]
  });
}

// Extract each function by finding matching braces
for (let i = 0; i < functionStarts.length; i++) {
  const funcInfo = functionStarts[i];
  const nextStart = i < functionStarts.length - 1 ? functionStarts[i + 1].start : functionsSection.length;
  
  // Find the function body by counting braces
  let braceCount = 0;
  let start = funcInfo.start + funcInfo.fullMatch.length;
  let end = start;
  
  // Start from the opening brace
  braceCount = 1;
  
  for (let j = start; j < nextStart && braceCount > 0; j++) {
    if (functionsSection[j] === '{') {
      braceCount++;
    } else if (functionsSection[j] === '}') {
      braceCount--;
      if (braceCount === 0) {
        end = j + 1;
        break;
      }
    }
  }
  
  const fullFunction = functionsSection.substring(funcInfo.start, end);
  functions[funcInfo.name] = fullFunction;
}

console.log('Extracted', Object.keys(functions).length, 'functions');

// Remove duplicates from operationTableOrder
const uniqueFunctions = [];
const seen = new Set();
for (let funcName of operationTableOrder) {
  if (!seen.has(funcName)) {
    seen.add(funcName);
    uniqueFunctions.push(funcName);
  }
}

console.log('Unique functions needed:', uniqueFunctions.length);

// Check which functions exist
const missingFunctions = [];
const existingFunctions = [];
for (let funcName of uniqueFunctions) {
  if (functions[funcName]) {
    existingFunctions.push(funcName);
  } else {
    missingFunctions.push(funcName);
  }
}

console.log('Existing functions:', existingFunctions.length);
console.log('Missing functions:', missingFunctions);

// Create the reorganized functions section
const reorganizedFunctions = [];
for (let funcName of uniqueFunctions) {
  if (functions[funcName]) {
    reorganizedFunctions.push(functions[funcName]);
  }
}

// Create the new file content
const newContent = beforeFunctions + reorganizedFunctions.join('\n') + '\n' + afterFunctions;

// Write the reorganized file
fs.writeFileSync(filePath, newContent);

console.log('Functions have been reorganized in opcode order');
console.log('Total functions reorganized:', reorganizedFunctions.length);
