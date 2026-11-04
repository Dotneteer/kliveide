import type { CompilerOutput, InjectableOutput } from "@abstractions/CompilerInfo";
import { SpectrumTapeHeader } from "@emu/machines/tape/SpectrumTapeHeader";
import { SpectrumModelType } from "@main/z80-compiler/SpectrumModelTypes";

/*
 * The tape blocks `expc -f tap|tzx` writes for a ZX Spectrum program: the code blocks (one per
 * segment, or one merged block, plus one per 128K bank) and the optional auto-start BASIC loader.
 * Each block is a flag byte, the data and the checksum, as a `.tap` file holds them.
 */

/** The `expc` options the Spectrum tape blocks depend on. */
export type SpectrumTapeOptions = {
  "-n"?: string;
  "-p"?: boolean;
  "-c"?: boolean;
  "-b"?: number;
  "-sb"?: boolean;
  "-scr"?: string;
};

// --- Create tap blocks
export function createTapeBlocks(output: InjectableOutput, args: SpectrumTapeOptions): Uint8Array[] {
  var result: Uint8Array[] = [];
  if (output.segments.map((s) => s.emittedCode.length).reduce((a, b) => a + b, 0) === 0) {
    // --- No code to return
    return null;
  }

  if (args["-sb"]) {
    // --- Merge all blocks together
    const startAddr = Math.min(...output.segments.map((s) => s.startAddress));
    const endAddr = Math.max(
      ...output.segments
        .filter((s) => s.bank == undefined)
        .map((s) => s.startAddress + s.emittedCode.length - 1)
    );

    // --- Normal code segments
    const mergedSegment = new Uint8Array(endAddr - startAddr + 3);
    for (const segment of output.segments.filter((s) => s.bank == undefined)) {
      for (let i = 0; i < segment.emittedCode.length; i++) {
        mergedSegment[segment.startAddress - startAddr + 1 + i] = segment.emittedCode[i];
      }
    }

    // --- The first byte of the merged segment is 0xFF (Data block)
    mergedSegment[0] = 0xff;
    setTapeCheckSum(mergedSegment);

    // --- Create the single header
    var singleHeader = new SpectrumTapeHeader();
    singleHeader.type = 3; // --- Code block
    singleHeader.name = args["-n"];
    singleHeader.dataLength = mergedSegment.length - 2;
    singleHeader.parameter1 = startAddr;
    singleHeader.parameter2 = 0x8000;
    // --- Create the two tape blocks (header + data)
    result.push(singleHeader.headerBytes);
    result.push(mergedSegment);
  } else {
    // --- Create separate block for each segment
    let segmentIdx = 0;

    // --- Normal code segments
    for (const segment of output.segments.filter((s) => s.bank == null)) {
      segmentIdx++;
      const startAddr = segment.startAddress;
      const endAddr = segment.startAddress + segment.emittedCode.length - 1;

      const codeSegment = new Uint8Array(endAddr - startAddr + 3);
      for (let i = 0; i < segment.emittedCode.length; i++) {
        codeSegment[i + 1] = segment.emittedCode[i];
      }

      // --- The first byte of the code segment is 0xFF (Data block)
      codeSegment[0] = 0xff;
      setTapeCheckSum(codeSegment);

      // --- Create the single header
      const header = new SpectrumTapeHeader();
      (header.type = 3), // --- Code block
        (header.name = `${segmentIdx}_${args["-n"]}`),
        (header.dataLength = (codeSegment.length - 2) & 0xffff),
        (header.parameter1 = startAddr),
        (header.parameter2 = 0x8000);

      // --- Create the two tape blocks (header + data)
      result.push(header.headerBytes);
      result.push(codeSegment);
    }
  }

  // --- Create blocks for the banks
  const segments = output.segments.filter((s) => s.bank != null);
  segments.sort((a, b) => a.bank - b.bank);
  for (const bankSegment of segments) {
    const startAddr = (0xc000 + bankSegment.bankOffset) & 0xffff;
    const endAddr = startAddr + bankSegment.emittedCode.length - 1;

    const codeSegment = new Uint8Array(endAddr - startAddr + 3);
    for (let i = 0; i < bankSegment.emittedCode.length; i++) {
      codeSegment[i + 1] = bankSegment.emittedCode[i];
    }

    // --- The first byte of the code segment is 0xFF (Data block)
    codeSegment[0] = 0xff;
    setTapeCheckSum(codeSegment);

    // --- Create the single header
    const header = new SpectrumTapeHeader();
    header.type = 3; // --- Code block
    header.name = `bank${bankSegment.bank}.code`;
    header.dataLength = (codeSegment.length - 2) & 0xffff;
    header.parameter1 = startAddr;
    header.parameter2 = 0x8000;

    // --- Create the two tape blocks (header + data)
    result.push(header.headerBytes);
    result.push(codeSegment);
  }

  // --- Done
  return result;
}

// --- Sets the checksum byte for a tape block
export function setTapeCheckSum(bytes: Uint8Array): void {
  let chk = 0x00;
  for (let i = 0; i < bytes.length - 1; i++) {
    chk ^= bytes[i];
  }

  bytes[bytes.length - 1] = chk & 0xff;
}

// --- Creates blocks with autostart functionality
export function createAutoStartBlock(output: CompilerOutput, args: SpectrumTapeOptions, address: number): Uint8Array[] {
  const banked = output.modelType != SpectrumModelType.Spectrum48 && output.segments.some((s) => s.bank != undefined);
  // --- A banked loader always CLEARs below the code: the loader and the program page banks in at
  // --- $C000, and with BASIC's default RAMTOP the machine stack is there too, so paging a bank
  // --- in would take the stack away (the return address included) and the machine resets
  const clearAddr =
    args["-c"] || banked ? Math.min(...(output as InjectableOutput).segments.map((s) => s.startAddress)) : null;
  return !banked
    ? // --- No banks to emit, use the ZX Spectrum 48 auto-loader format
      createSpectrum48StartBlock(output, args, address, clearAddr)
    : // --- There are banks to emit, use the ZX Spectrum 128 auto-loader format
      createSpectrum128StartBlock(output, args, address, clearAddr);
}

// --- Auto start block for ZX Spectrum 48
function createSpectrum48StartBlock(output: CompilerOutput, args: SpectrumTapeOptions, address: number, clearAddr?: number): Uint8Array[] {
  const result: Uint8Array[] = [];

  // --- Step #1: Create the code line for auto start
  const codeLine: number[] = [];
  if (clearAddr !== undefined && clearAddr >= 0x6000) {
    // --- Add clear statement
    codeLine.push(CLEAR_TKN);
    writeNumber(codeLine, clearAddr - 1);
    codeLine.push(COLON);
  }

  // --- Add optional border color
  if (args["-b"] != null) {
    codeLine.push(BORDER_TKN);
    writeNumber(codeLine, args["-b"] & 0x07);
    codeLine.push(COLON);
  }

  // --- Add optional screen loader, LET o = PEEK 23739 : LOAD "" SCREEN$ : POKE 23739,111
  if (args["-scr"]) {
    codeLine.push(LET_TKN);
    writeString(codeLine, "o=");
    codeLine.push(PEEK_TKN);
    writeNumber(codeLine, 23739);
    codeLine.push(COLON);
    codeLine.push(LOAD_TKN);
    codeLine.push(DQUOTE);
    codeLine.push(DQUOTE);
    codeLine.push(SCREEN_TKN);
    codeLine.push(COLON);
    codeLine.push(POKE_TKN);
    writeNumber(codeLine, 23739);
    codeLine.push(COMMA);
    writeNumber(codeLine, 111);
    codeLine.push(COLON);
  }

  // --- Add 'LOAD "" CODE' for each block
  if (args["-sb"]) {
    codeLine.push(LOAD_TKN);
    codeLine.push(DQUOTE);
    codeLine.push(DQUOTE);
    codeLine.push(CODE_TKN);
    codeLine.push(COLON);
  } else {
    for (var i = 0; i < output.segments.length; i++) {
      codeLine.push(LOAD_TKN);
      codeLine.push(DQUOTE);
      codeLine.push(DQUOTE);
      codeLine.push(CODE_TKN);
      codeLine.push(COLON);
    }
  }

  // --- Add 'PAUSE 0'
  if (args["-p"]) {
    codeLine.push(PAUSE_TKN);
    writeNumber(codeLine, 0);
    codeLine.push(COLON);
  }

  // --- Some SCREEN$ related poking
  if (args["-scr"]) {
    codeLine.push(POKE_TKN);
    writeNumber(codeLine, 23739);
    writeString(codeLine, ",o:");
  }

  // --- Add 'RANDOMIZE USR address'
  codeLine.push(RAND_TKN);
  codeLine.push(USR_TKN);
  writeNumber(codeLine, address);

  // --- Complete the line
  codeLine.push(NEW_LINE);

  // --- Step #2: Now, complete the data block
  // --- Allocate extra 6 bytes: 1 byte - header, 2 byte - line number
  // --- 2 byte - line length, 1 byte - checksum
  const dataBlock = new Uint8Array(codeLine.length + 6);
  for (let i = 0; i < codeLine.length; i++) dataBlock[i + 5] = codeLine[i];
  dataBlock[0] = 0xff;
  // --- Set line number to 10. Line number uses MSB/LSB order
  dataBlock[1] = 0x00;
  dataBlock[2] = 10;
  // --- Set line length
  dataBlock[3] = codeLine.length & 0xff;
  dataBlock[4] = (codeLine.length >> 8) & 0xff;
  setTapeCheckSum(dataBlock);

  // --- Step #3: Create the header
  const header = new SpectrumTapeHeader();
  // --- Program block
  header.type = 0;
  header.name = args["-n"];
  header.dataLength = (dataBlock.length - 2) & 0xffff;
  // --- Auto-start at Line 10
  header.parameter1 = 10;
  // --- Variable area offset
  header.parameter2 = (dataBlock.length - 2) & 0xffff;

  // --- Step #4: Retrieve the auto start header and data block for save
  result.push(header.headerBytes);
  result.push(dataBlock);
  return result;
}

// --- Auto start block for ZX Spectrum 128
function createSpectrum128StartBlock(output: CompilerOutput, args: SpectrumTapeOptions, address: number, clearAddr?: number): Uint8Array[] {
  const result: Uint8Array[] = [];

  // --- We keep the code lines here
  var lines: number[][] = [];

  // --- Create placeholder for the paging code (line 10)
  var codeLine: number[] = [];
  codeLine.push(REM_TKN);
  writeString(codeLine, "012345678901234567890");
  codeLine.push(NEW_LINE);
  lines.push(codeLine);

  // --- Create code for CLEAR/PEEK program address (line 20)
  codeLine = [];
  if (clearAddr !== undefined && clearAddr >= 0x6000) {
    // --- Add clear statement
    codeLine.push(CLEAR_TKN);
    writeNumber(codeLine, (clearAddr - 1) & 0xffff);
    codeLine.push(COLON);
  }

  // --- Add "LET c=(PEEK 23635 + 256*PEEK 23636)+5
  codeLine.push(LET_TKN);
  writeString(codeLine, "c=(");
  codeLine.push(PEEK_TKN);
  writeNumber(codeLine, 23635);
  writeString(codeLine, "+");
  writeNumber(codeLine, 256);
  writeString(codeLine, "*");
  codeLine.push(PEEK_TKN);
  writeNumber(codeLine, 23636);
  writeString(codeLine, ")+");
  writeNumber(codeLine, 5);
  codeLine.push(NEW_LINE);
  lines.push(codeLine);

  // --- Setup the machine code
  codeLine = [];
  codeLine.push(FOR_TKN);
  writeString(codeLine, "i=");
  writeNumber(codeLine, 0);
  codeLine.push(TO_TKN);
  writeNumber(codeLine, 20);
  codeLine.push(COLON);
  codeLine.push(READ_TKN);
  writeString(codeLine, "d:");
  codeLine.push(POKE_TKN);
  writeString(codeLine, "c+i,d:");
  codeLine.push(NEXT_TKN);
  writeString(codeLine, "i");
  codeLine.push(NEW_LINE);
  lines.push(codeLine);

  // --- Create code for BORDER/SCREEN and loading normal code blocks (line 30)
  codeLine = [];
  if (args["-b"] !== undefined) {
    codeLine.push(BORDER_TKN);
    writeNumber(codeLine, args["-b"] & 0xff);
    codeLine.push(COLON);
  }

  // --- Add optional screen loader, LET o = PEEK 23739:LOAD "" SCREEN$ : POKE 23739,111
  if (args["-scr"]) {
    codeLine.push(LET_TKN);
    writeString(codeLine, "o=");
    codeLine.push(PEEK_TKN);
    writeNumber(codeLine, 23739);
    codeLine.push(COLON);
    codeLine.push(LOAD_TKN);
    codeLine.push(DQUOTE);
    codeLine.push(DQUOTE);
    codeLine.push(SCREEN_TKN);
    codeLine.push(COLON);
    codeLine.push(POKE_TKN);
    writeNumber(codeLine, 23739);
    codeLine.push(COMMA);
    writeNumber(codeLine, 111);
    codeLine.push(COLON);
  }

  // --- Add 'LOAD "" CODE' for each block
  codeLine.push(LOAD_TKN);
  codeLine.push(DQUOTE);
  codeLine.push(DQUOTE);
  codeLine.push(CODE_TKN);

  codeLine.push(NEW_LINE);
  lines.push(codeLine);

  // --- Code for reading banks
  codeLine = [];
  codeLine.push(READ_TKN);
  writeString(codeLine, "b");
  codeLine.push(NEW_LINE);
  lines.push(codeLine);

  // --- "IF b = 8 THEN GO TO 80";
  codeLine = [];
  codeLine.push(IF_TKN);
  writeString(codeLine, "b=");
  writeNumber(codeLine, 8);
  codeLine.push(THEN_TKN);
  codeLine.push(GOTO_TKN);
  writeNumber(codeLine, 80);
  codeLine.push(NEW_LINE);
  lines.push(codeLine);

  // --- "POKE 23608,b: RANDOMIZE USR c: LOAD "" CODE: GO TO 50"
  codeLine = [];
  codeLine.push(POKE_TKN);
  writeNumber(codeLine, 23608);
  writeString(codeLine, ",b:");
  codeLine.push(RAND_TKN);
  codeLine.push(USR_TKN);
  writeString(codeLine, "c:");
  codeLine.push(LOAD_TKN);
  codeLine.push(DQUOTE);
  codeLine.push(DQUOTE);
  codeLine.push(CODE_TKN);
  codeLine.push(COLON);
  codeLine.push(GOTO_TKN);
  writeNumber(codeLine, 50);
  codeLine.push(NEW_LINE);
  lines.push(codeLine);

  // --- Finishing
  codeLine = [];

  // --- PAUSE and START
  if (args["-p"]) {
    codeLine.push(PAUSE_TKN);
    writeNumber(codeLine, 0);
    codeLine.push(COLON);
  }
  if (args["-scr"]) {
    codeLine.push(POKE_TKN);
    writeNumber(codeLine, 23739);
    writeString(codeLine, ",o:");
  }

  // --- Add 'RANDOMIZE USR address: STOP'
  codeLine.push(RAND_TKN);
  codeLine.push(USR_TKN);
  writeNumber(codeLine, address);
  codeLine.push(COLON);
  codeLine.push(STOP_TKN);
  codeLine.push(NEW_LINE);
  lines.push(codeLine);

  // --- Add data lines with the machine code subroutine
  /*
        di                  243
        ld a, ($5b5c)       58,92,91
        and $f8              240, 248
        ld b, a             71
  
        ld a, ($5c38)       58,56,92
        or b                176
  
        ld ($5b5c),a        50,92,91
  
        ld bc, ($7ffd)      1,253,127
        out (c), a          237,121
        ei                  251
        ret                 201
    */
  codeLine = [];
  writeDataStatement(
    codeLine,
    [
      243, 58, 92, 91, 230, 248, 71, 58, 56, 92, 176, 50, 92, 91, 1, 253, 127, 237, 121, 251,
      201
    ]
  );
  lines.push(codeLine);

  // --- Add data lines with used banks and terminating 8
  codeLine = [];
  const banks = output.segments.filter((s) => s.bank != null).map((s) => s.bank);
  banks.sort((a, b) => a - b);
  banks.push(8);
  writeDataStatement(codeLine, banks);
  lines.push(codeLine);

  // --- All code lines are set up, create the file blocks
  const dataBlock = createDataBlockForCodeLines(lines);
  const header = new SpectrumTapeHeader();
  // --- Program block
  header.type = 0;
  header.name = args["-n"];
  header.dataLength = (dataBlock.length - 2) & 0xffff;
  // --- Auto-start at Line 10
  header.parameter1 = 10;
  // --- Variable area offset
  header.parameter2 = (dataBlock.length - 2) & 0xffff;

  // --- Step #4: Retrieve the auto start header and data block for save
  result.push(header.headerBytes);
  result.push(dataBlock);
  return result;
}

function writeNumber(codeArray: number[], num: number) {
  // --- Number in string form
  for (const ch of num.toString()) codeArray.push(ch.charCodeAt(0));
  codeArray.push(NUMB_SIGN);
  // --- Five bytes as the short form of an integer
  codeArray.push(0x00);
  codeArray.push(0x00);
  codeArray.push(num);
  codeArray.push(num >> 8);
  codeArray.push(0x00);
}

function writeString(codeArray: number[], str: string) {
  for (const ch of str) codeArray.push(ch.charCodeAt(0));
}

function writeDataStatement(codeLine: number[], data: number[]) {
  codeLine.push(DATA_TKN);
  let comma = false;
  for (const item of data) {
    if (comma) {
      writeString(codeLine, ",");
    }
    writeNumber(codeLine, item);
    comma = true;
  }
  codeLine.push(NEW_LINE);
}

function createDataBlockForCodeLines(lines: number[][]): Uint8Array {
  const length = lines.map((cl) => cl.length + 4).reduce((a, b) => a + b, 0) + 2;
  const dataBlock: Uint8Array = new Uint8Array(length);
  dataBlock[0] = 0xff;
  let index = 1;
  let lineNo = 10;
  for (const line of lines) {
    // --- Line number in MSB/LSB format
    dataBlock[index++] = (lineNo >> 8) & 0xff;
    dataBlock[index++] = lineNo & 0xff;

    // --- Set line length in LSB/MSB format
    dataBlock[index++] = line.length & 0xff;
    dataBlock[index++] = (line.length >> 8) & 0xff;

    // --- Copy the code line
    for (let i = 0; i < line.length; i++) {
      dataBlock[i + index] = line[i];
    }

    // --- Move to the next line
    index += line.length;
    lineNo += 10;
  }
  setTapeCheckSum(dataBlock);
  return dataBlock;
}

const CLEAR_TKN = 0xfd;
const CODE_TKN = 0xaf;
const DATA_TKN = 0xe4;
const FOR_TKN = 0xeb;
const IF_TKN = 0xfa;
const GOTO_TKN = 0xec;
const LET_TKN = 0xf1;
const LOAD_TKN = 0xef;
const NEXT_TKN = 0xf3;
const PEEK_TKN = 0xbe;
const POKE_TKN = 0xf4;
const READ_TKN = 0xe3;
const REM_TKN = 0xea;
const THEN_TKN = 0xcb;
const TO_TKN = 0xcc;
const SCREEN_TKN = 0xaa;
const DQUOTE = 0x22;
const STOP_TKN = 0xe2;
const COLON = 0x3a;
const COMMA = 0x2c;
const RAND_TKN = 0xf9;
const USR_TKN = 0xc0;
const NUMB_SIGN = 0x0e;
const NEW_LINE = 0x0d;
const PAUSE_TKN = 0xf2;
const BORDER_TKN = 0xe7;

