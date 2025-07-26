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

// Extract all function definitions from the file using a more robust approach
const functionDefRegex = /^function\s+([a-zA-Z][a-zA-Z0-9]*)\(cpu:\s*M6510Cpu\):\s*void\s*\{([\s\S]*?)^}/gm;
const functions = {};
let match;

// Find the start of functions section
const functionsStart = content.indexOf('function jam(cpu: M6510Cpu): void {');
const functionsEnd = content.lastIndexOf('}');
const functionsSection = content.substring(functionsStart, functionsEnd + 1);

// Extract each function individually
let currentPos = 0;
while ((match = functionDefRegex.exec(functionsSection)) !== null) {
  const functionName = match[1];
  const fullMatch = match[0];
  functions[functionName] = fullMatch;
}

console.log('Found', Object.keys(functions).length, 'function definitions');

// Remove duplicates from operationTableOrder - keep track of unique functions in order
const uniqueFunctions = [];
const seen = new Set();
for (let funcName of operationTableOrder) {
  if (!seen.has(funcName)) {
    seen.add(funcName);
    uniqueFunctions.push(funcName);
  }
}

console.log('Unique functions in operation table:', uniqueFunctions.length);

// Verify all functions exist
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

// Find the exact boundaries of the functions section
const firstFunctionStart = content.indexOf('function jam(cpu: M6510Cpu): void {');
const lastFunctionEnd = content.lastIndexOf('}') + 1;

// Get the parts before and after the functions section
const beforeFunctions = content.substring(0, firstFunctionStart);
const afterFunctions = content.substring(lastFunctionEnd);

// Create the new file content
const newContent = beforeFunctions + reorganizedFunctions.join('\n\n') + '\n' + afterFunctions;

// Write the reorganized file
fs.writeFileSync(filePath, newContent);

console.log('Functions have been reorganized in opcode order');
console.log('Total functions reorganized:', reorganizedFunctions.length);
