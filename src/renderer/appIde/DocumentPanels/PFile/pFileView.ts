import { Zx81Chars } from "@common/machines/char-codes";
import type { CharDescriptor } from "@common/machines/info-types";
import { decodeZx8081Program } from "../zx8081BasicListing";

/*
 * The model of the ZX81 `.P` viewer (and, through `oFileView.ts`, of the ZX80 `.O` files it shows too): a file read into the parts the ZX81 keeps in memory, the way
 * the tape viewer's `tapeView.ts` reads a tape into blocks. No DOM; the panel draws what this says.
 *
 * A `.P` file is the bytes the ROM's SAVE sends after the name: memory from VERSN ($4009) up to
 * E_LINE - 1. Its own system variables say where each part starts (interface facts of the machine,
 * from the ZX81 manual's chapter on memory, in Klive's words):
 *
 *   $4009        the system variables, up to $407C
 *   $407D        the BASIC program, up to D_FILE
 *   D_FILE       the display file: a NEWLINE ($76), then 24 lines each ended by NEWLINE; a 1K machine
 *                collapses a line to its last printed character, so a line may be just its NEWLINE
 *   VARS         the variables, ended by $80 at E_LINE - 1
 *   E_LINE       the end of the file (the edit line is not saved)
 *
 * A file whose system variables do not describe it - 1K programs keep code in them - is still shown:
 * its bytes after the system variables are one part, and the viewer says why.
 */

/** The parts of a `.P` file, in memory order */
export type PFileRegionKind = "sysvars" | "program" | "display" | "variables" | "data" | "extra";

/** How a part pops out */
export type PFileView = "memory" | "disassembly" | "basic" | "screen";

export const P_FILE_VIEW_NAMES: Record<PFileView, string> = {
  memory: "Memory",
  disassembly: "Disassembly",
  basic: "BASIC",
  screen: "Screen"
};

export const P_FILE_REGION_NAMES: Record<PFileRegionKind, string> = {
  sysvars: "System variables",
  program: "BASIC program",
  display: "Display file",
  variables: "Variables",
  data: "Program and data",
  extra: "After E_LINE"
};

/** The chip of each part in the list */
export const P_FILE_REGION_CHIPS: Record<PFileRegionKind, string> = {
  sysvars: "SYS",
  program: "BASIC",
  display: "DFILE",
  variables: "VARS",
  data: "DATA",
  extra: "EXTRA"
};

export type PFileRegion = {
  /** The part's position in the list, 0 first */
  index: number;
  kind: PFileRegionKind;
  /** The address of its first byte */
  start: number;
  /** The address after its last byte */
  end: number;
  /** Its bytes, from the file */
  bytes: Uint8Array;
  /** The views it pops out in, the first the default */
  views: PFileView[];
};

/** A BASIC variable, decoded: a ZX81's, or a ZX80's (which has no string arrays and no STEP) */
export type Zx8081Variable = {
  kind: "number" | "string" | "numberArray" | "stringArray" | "forLoop";
  /** The name as the ROM lists it: `A`, `TOTAL`, `A$`, `A()` */
  name: string;
  /** Where its first byte is */
  address: number;
  /** Its size in bytes */
  length: number;
  /** A number's value, or a FOR loop's current value */
  value?: number;
  /** A string's text */
  text?: string;
  /** An array's dimensions */
  dims?: number[];
  /**
   * A FOR loop's limit and step, and where NEXT continues: the FOR's line number plus one, so the
   * first line after the FOR (the ZX81 has one statement a line)
   */
  limit?: number;
  step?: number;
  line?: number;
};

export type PFileSummary = {
  size: number;
  /** The address the file's first byte loads at: $4009 for a ZX81 file, $4000 for a ZX80 one */
  start: number;
  /** The machine the file needs: 1K when it ends by $4400, else 16K */
  ramKb: 1 | 16;
  /** Whether the system variables describe the file's parts */
  layoutValid: boolean;
  lineCount: number;
  /** The listing stopped early: a damaged program */
  programCorrupted: boolean;
  /** The line the program runs from after LOAD (NXTLIN points into the program), if any */
  autorunLine?: number;
  /** CDFLAG bit 6: the program was saved in SLOW mode, and loads in it */
  slowMode: boolean;
  /** The display file is collapsed: some line is shorter than 32 characters (a 1K machine's) */
  displayCollapsed: boolean;
  variableCount: number;
  /** The variables area stops early: a damaged or unusual file */
  variablesCorrupted: boolean;
  /** Bytes after E_LINE, which the ROM's LOAD never reads */
  extraBytes: number;
  /** The system variables' pointers, as the file holds them (a ZX80 file's D_FILE is past its end) */
  dFile: number;
  vars: number;
  eLine: number;
};

/** Whose program file it is: a ZX81 `.P` or a ZX80 `.O` */
export type ProgramFileMachine = "zx81" | "zx80";

export type PFileAnalysis = {
  machine: ProgramFileMachine;
  /** The file */
  bytes: Uint8Array;
  /** The file at its address in a 64K image, as the ZX81 holds it after LOAD */
  memory: Uint8Array;
  summary: PFileSummary;
  regions: PFileRegion[];
  variables: Zx8081Variable[];
};

/** Where a `.P` file sits */
export const P_FILE_START = 0x4009;
export const ZX81_PROGRAM_START = 0x407d;
const D_FILE = 0x400c;
const VARS = 0x4010;
const E_LINE = 0x4014;
const NXTLIN = 0x4029;
const CDFLAG = 0x403b;
const ONE_K_END = 0x4400;

const NEWLINE = 0x76;
const VARIABLES_END = 0x80;

/** Reads a `.P` file for the viewer; an error says why a file is not one */
export function analyzePFile(bytes: Uint8Array): { analysis?: PFileAnalysis; error?: string } {
  const sysVarsLength = ZX81_PROGRAM_START - P_FILE_START;
  if (bytes.length < sysVarsLength) {
    return {
      error: `A ZX81 program file starts with ${sysVarsLength} bytes of system variables; this file has ${bytes.length.toLocaleString("en-US")}.`
    };
  }
  if (P_FILE_START + bytes.length > 0x10000) {
    return { error: "This file is larger than the ZX81's memory." };
  }
  const memory = new Uint8Array(0x10000);
  memory.set(bytes, P_FILE_START);
  const word = (address: number) => memory[address] | (memory[address + 1] << 8);
  const fileEnd = P_FILE_START + bytes.length;
  const dFile = word(D_FILE);
  const vars = word(VARS);
  const eLine = word(E_LINE);

  // --- The pointers describe the file when they are in order and inside it
  const layoutValid =
    ZX81_PROGRAM_START <= dFile && dFile <= vars && vars < eLine && eLine <= fileEnd;
  const dataEnd = Math.min(eLine >= ZX81_PROGRAM_START && eLine <= fileEnd ? eLine : fileEnd, fileEnd);

  const regions: PFileRegion[] = [];
  const add = (kind: PFileRegionKind, start: number, end: number, views: PFileView[]) => {
    if (end <= start && kind !== "program") return;
    regions.push({
      index: regions.length,
      kind,
      start,
      end,
      bytes: bytes.subarray(start - P_FILE_START, end - P_FILE_START),
      views
    });
  };
  add("sysvars", P_FILE_START, ZX81_PROGRAM_START, ["memory"]);
  if (layoutValid) {
    add("program", ZX81_PROGRAM_START, dFile, ["basic", "memory", "disassembly"]);
    add("display", dFile, vars, ["screen", "memory"]);
    add("variables", vars, eLine, ["memory"]);
  } else {
    add("data", ZX81_PROGRAM_START, dataEnd, ["memory", "disassembly"]);
  }
  add("extra", dataEnd, fileEnd, ["memory", "disassembly"]);

  const listing = layoutValid
    ? decodeZx8081Program(memory, ZX81_PROGRAM_START, dFile, "zx81")
    : undefined;
  const nxtLin = word(NXTLIN);
  const autorunLine =
    layoutValid && nxtLin >= ZX81_PROGRAM_START && nxtLin < dFile
      ? (memory[nxtLin] << 8) | memory[nxtLin + 1]
      : undefined;
  const { variables, corrupted: variablesCorrupted } = layoutValid
    ? decodeZx81Variables(memory, vars, eLine)
    : { variables: [], corrupted: false };
  const rows = layoutValid ? zx81DisplayRows(memory, dFile, vars) : [];

  return {
    analysis: {
      machine: "zx81",
      bytes,
      memory,
      regions,
      variables,
      summary: {
        size: bytes.length,
        start: P_FILE_START,
        ramKb: dataEnd > ONE_K_END ? 16 : 1,
        layoutValid,
        lineCount: listing?.lineCount ?? 0,
        programCorrupted: listing?.corrupted ?? false,
        autorunLine,
        slowMode: (memory[CDFLAG] & 0x40) !== 0,
        displayCollapsed: rows.some((row) => row.length < 32),
        variableCount: variables.length,
        variablesCorrupted,
        extraBytes: fileEnd - dataEnd,
        dFile,
        vars,
        eLine
      }
    }
  };
}

// ------------------------------------------------------------------------------------------------
// The display file

/** Rows the display has: 24 lines of up to 32 character codes */
export const ZX81_SCREEN_ROWS = 24;
export const ZX81_SCREEN_COLUMNS = 32;

/**
 * The display file's lines, each the character codes before its NEWLINE (none for a collapsed empty
 * line). Reads at most 24 lines of 32, and stops at `end`.
 */
export function zx81DisplayRows(memory: Uint8Array, dFile: number, end: number): number[][] {
  const rows: number[][] = [];
  let pos = dFile;
  // --- The display file starts with a NEWLINE
  if (memory[pos] === NEWLINE) pos++;
  while (rows.length < ZX81_SCREEN_ROWS && pos < end) {
    const row: number[] = [];
    while (pos < end && memory[pos] !== NEWLINE && row.length < ZX81_SCREEN_COLUMNS) {
      row.push(memory[pos++]);
    }
    // --- Past a full line's 32 characters, whatever is left before the NEWLINE is not shown
    while (pos < end && memory[pos] !== NEWLINE) pos++;
    pos++;
    rows.push(row);
  }
  return rows;
}

/** The display as text, one string per row: inverse characters in brackets, as the harness reads it */
export function zx81DisplayText(rows: number[][]): string[] {
  return rows.map((row) => row.map((code) => zx81CodeText(code)).join("").trimEnd());
}

// ------------------------------------------------------------------------------------------------
// The variables

/**
 * A ZX81 number from its five bytes: an exponent byte (0 means zero), then the mantissa, whose
 * first bit is the sign; the mantissa is read with that bit set, as a fraction from 0.5 to 1
 */
export function zx81Number(memory: Uint8Array, address: number): number {
  const exponent = memory[address];
  if (exponent === 0) return 0;
  const b1 = memory[address + 1];
  const mantissa =
    ((b1 | 0x80) * 0x1000000 +
      memory[address + 2] * 0x10000 +
      memory[address + 3] * 0x100 +
      memory[address + 4]) /
    0x100000000;
  const value = mantissa * Math.pow(2, exponent - 128);
  return b1 & 0x80 ? -value : value;
}

/** A character's glyph (codes $00-$3F, inverse or not) as text, in the ZX81's set or another */
export function zx8081CharText(code: number, charSet: Record<number, CharDescriptor> = Zx81Chars): string {
  const v = charSet[code & 0x3f]?.v;
  return v === undefined || v === "\xa0" ? " " : v;
}

const charText = (code: number) => zx8081CharText(code);

/**
 * A character code as text: a glyph, an inverse one in brackets, a keyword token as its text, any
 * other code as `{$NN}`. The ZX81's set unless another is given (the ZX80's, for its files).
 */
export function zx81CodeText(code: number, charSet: Record<number, CharDescriptor> = Zx81Chars): string {
  if ((code & 0x40) === 0) {
    const glyph = zx8081CharText(code, charSet);
    return code & 0x80 ? `[${glyph}]` : glyph;
  }
  const descriptor = charSet[code];
  if (descriptor?.c === "token" && descriptor.t) return descriptor.t;
  return `{$${code.toString(16).toUpperCase().padStart(2, "0")}}`;
}

/**
 * A variable's letter: the low five bits of its first byte, counted from character code $20 - on
 * both machines, whose letters are $26-$3F
 */
export const zx8081LetterOf = (first: number, charSet: Record<number, CharDescriptor> = Zx81Chars) =>
  zx8081CharText((first & 0x1f) + 0x20, charSet);
const letterOf = (first: number) => zx8081LetterOf(first);

/**
 * The variables from `start` to `end`, up to the $80 that ends them. The first byte's top three bits
 * say what follows:
 *   011  a number, one-letter name: five bytes
 *   101  a number, longer name: the rest of the name (bit 7 set on its last letter), five bytes
 *   010  a string: a two-byte length, the text
 *   100  an array of numbers: a two-byte length, the dimension count, two bytes a dimension, the
 *        elements (five bytes each)
 *   110  an array of strings: the same, with one byte an element
 *   111  a FOR loop's variable: value, limit and step (five bytes each), then the line NEXT goes to
 *        (two bytes, low first): the FOR's own line number plus one
 */
export function decodeZx81Variables(
  memory: Uint8Array,
  start: number,
  end: number
): { variables: Zx8081Variable[]; corrupted: boolean } {
  const variables: Zx8081Variable[] = [];
  const word = (address: number) => memory[address] | (memory[address + 1] << 8);
  let pos = start;
  while (pos < end) {
    const first = memory[pos];
    if (first === VARIABLES_END) return { variables, corrupted: false };
    const letter = letterOf(first);
    const address = pos;
    let variable: Zx8081Variable;
    switch (first >> 5) {
      case 0b011:
        variable = { kind: "number", name: letter, address, length: 6, value: zx81Number(memory, pos + 1) };
        break;
      case 0b101: {
        let name = letter;
        let p = pos + 1;
        while (p < end) {
          const code = memory[p++];
          name += charText(code & 0x3f);
          if (code & 0x80) break;
        }
        variable = { kind: "number", name, address, length: p - pos + 5, value: zx81Number(memory, p) };
        break;
      }
      case 0b010: {
        const length = word(pos + 1);
        const text = Array.from(memory.subarray(pos + 3, Math.min(pos + 3 + length, end)), (code) => zx81CodeText(code)).join("");
        variable = { kind: "string", name: `${letter}$`, address, length: 3 + length, text };
        break;
      }
      case 0b100:
      case 0b110: {
        const length = word(pos + 1);
        const dimCount = memory[pos + 3];
        const dims: number[] = [];
        for (let i = 0; i < dimCount; i++) dims.push(word(pos + 4 + 2 * i));
        const isString = first >> 5 === 0b110;
        variable = {
          kind: isString ? "stringArray" : "numberArray",
          name: isString ? `${letter}$()` : `${letter}()`,
          address,
          length: 3 + length,
          dims
        };
        break;
      }
      case 0b111:
        variable = {
          kind: "forLoop",
          name: letter,
          address,
          length: 18,
          value: zx81Number(memory, pos + 1),
          limit: zx81Number(memory, pos + 6),
          step: zx81Number(memory, pos + 11),
          line: word(pos + 16)
        };
        break;
      default:
        // --- No variable starts with these bits: the area is damaged
        return { variables, corrupted: true };
    }
    if (variable.length <= 0 || pos + variable.length > end) return { variables, corrupted: true };
    variables.push(variable);
    pos += variable.length;
  }
  // --- Ran out before the $80
  return { variables, corrupted: true };
}

/** A number as the ZX81 would print it, near enough: up to 8 significant digits */
export function formatZx81Number(value: number): string {
  if (Number.isInteger(value) && Math.abs(value) < 1e9) return `${value}`;
  return `${Number(value.toPrecision(8))}`;
}

/** What a variable holds, in a few words */
export function describeZx8081Variable(variable: Zx8081Variable): string {
  switch (variable.kind) {
    case "number":
      return formatZx81Number(variable.value ?? 0);
    case "string":
      return `"${variable.text ?? ""}"`;
    case "numberArray":
    case "stringArray":
      return `DIM (${(variable.dims ?? []).join(", ")})`;
    case "forLoop": {
      // --- A ZX80 loop has no STEP
      const step = variable.step === undefined ? "" : ` STEP ${formatZx81Number(variable.step)}`;
      return `${formatZx81Number(variable.value ?? 0)} TO ${formatZx81Number(variable.limit ?? 0)}${step}, NEXT goes to line ${
        variable.line
      } or the first after it`;
    }
  }
}

/** A region's title in the list: its name, and the line count or size where that says more */
export function regionText(region: PFileRegion, analysis: PFileAnalysis): string {
  const { summary } = analysis;
  switch (region.kind) {
    case "program":
      return summary.lineCount === 0
        ? "No program"
        : `${summary.lineCount} line${summary.lineCount === 1 ? "" : "s"}${
            summary.autorunLine !== undefined ? ` · runs from ${summary.autorunLine}` : ""
          }`;
    case "display":
      return summary.displayCollapsed ? "Collapsed" : "Full";
    case "variables":
      return summary.variableCount === 0
        ? "None"
        : `${summary.variableCount} variable${summary.variableCount === 1 ? "" : "s"}`;
    default:
      return P_FILE_REGION_NAMES[region.kind];
  }
}
