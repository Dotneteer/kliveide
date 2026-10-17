import { t } from "@common/i18n/i18n";
import { Zx80Chars } from "@common/machines/char-codes";
import { ZX80_FILE_EXTENSIONS } from "@emu/machines/zx8081/ZxPFile";
import { decodeZx8081Program } from "../zx8081BasicListing";
import {
  analyzePFile,
  zx81CodeText,
  zx8081CharText,
  zx8081LetterOf,
  type PFileAnalysis,
  type PFileRegion,
  type PFileRegionKind,
  type PFileView,
  type Zx8081Variable
} from "./pFileView";

/*
 * The model of the viewer for ZX80 `.O` (`.80`) files, the 4K ROM's program files: the same parts
 * and views as a ZX81 `.P` file (`pFileView.ts`), read by the ZX80's own layout.
 *
 * A `.O` file is memory from $4000 up to E_LINE - 1, which the ROM's LOAD reads back as it is. Its
 * system variables say where each part starts (interface facts of the machine, in Klive's words):
 *
 *   $4000        the system variables, up to $4027
 *   $4028        the BASIC program, up to VARS ($4008)
 *   VARS         the variables, ended by $80 at E_LINE - 1
 *   E_LINE       ($400A) the end of the file
 *
 * The display file (D_FILE, $400C) comes after E_LINE, so it is not in the file: a `.O` file has no
 * screen to show.
 *
 * The variables' format was read off the real 4K ROM in the test harness
 * (`test/zx8081-hw/o-file-viewer.test.ts`), not from a document. The ZX80's numbers are 16-bit
 * signed integers, low byte first; the first byte's top three bits say what follows, its low five the
 * letter:
 *   011  a number, one-letter name: two bytes
 *   010  a number, longer name: the rest of the name (bit 7 set on its last letter), two bytes
 *   100  a string (one-letter name, `A$`): the text, ended by the quote character ($01)
 *   101  an array of numbers (one dimension): the highest subscript (one byte), then the elements from
 *        subscript 0, two bytes each
 *   111  a FOR loop's variable: value and limit (two bytes each; there is no STEP), then the line NEXT
 *        goes to (two bytes): the FOR's own line number plus one
 */

export const O_FILE_START = 0x4000;
export const ZX80_PROGRAM_START = 0x4028;
const VARS = 0x4008;
const E_LINE = 0x400a;
const D_FILE = 0x400c;
const ONE_K_END = 0x4400;

const VARIABLES_END = 0x80;
/** The ZX80's quote character, which ends a string variable */
const ZX80_QUOTE = 0x01;

/** Reads a ZX80 `.O` file for the viewer; an error says why a file is not one */
export function analyzeOFile(bytes: Uint8Array): { analysis?: PFileAnalysis; error?: string } {
  const sysVarsLength = ZX80_PROGRAM_START - O_FILE_START;
  if (bytes.length < sysVarsLength) {
    return {
      error: t("panels.pfile.error.tooShort", { machine: "ZX80", sysVars: sysVarsLength, count: bytes.length })
    };
  }
  if (O_FILE_START + bytes.length > 0x10000) {
    return { error: t("panels.pfile.error.tooLarge", { machine: "ZX80" }) };
  }
  const memory = new Uint8Array(0x10000);
  memory.set(bytes, O_FILE_START);
  const word = (address: number) => memory[address] | (memory[address + 1] << 8);
  const fileEnd = O_FILE_START + bytes.length;
  const vars = word(VARS);
  const eLine = word(E_LINE);
  const dFile = word(D_FILE);

  // --- The pointers describe the file when they are in order and inside it (the variables hold at
  // --- least their $80)
  const layoutValid = ZX80_PROGRAM_START <= vars && vars < eLine && eLine <= fileEnd;
  const dataEnd = eLine >= ZX80_PROGRAM_START && eLine <= fileEnd ? eLine : fileEnd;

  const regions: PFileRegion[] = [];
  const add = (kind: PFileRegionKind, start: number, end: number, views: PFileView[]) => {
    if (end <= start && kind !== "program") return;
    regions.push({
      index: regions.length,
      kind,
      start,
      end,
      bytes: bytes.subarray(start - O_FILE_START, end - O_FILE_START),
      views
    });
  };
  add("sysvars", O_FILE_START, ZX80_PROGRAM_START, ["memory"]);
  if (layoutValid) {
    add("program", ZX80_PROGRAM_START, vars, ["basic", "memory", "disassembly"]);
    add("variables", vars, eLine, ["memory"]);
  } else {
    add("data", ZX80_PROGRAM_START, dataEnd, ["memory", "disassembly"]);
  }
  add("extra", dataEnd, fileEnd, ["memory", "disassembly"]);

  const listing = layoutValid ? decodeZx8081Program(memory, ZX80_PROGRAM_START, vars, "zx80") : undefined;
  const { variables, corrupted: variablesCorrupted } = layoutValid
    ? decodeZx80Variables(memory, vars, eLine)
    : { variables: [], corrupted: false };

  return {
    analysis: {
      machine: "zx80",
      bytes,
      memory,
      regions,
      variables,
      summary: {
        size: bytes.length,
        start: O_FILE_START,
        ramKb: dataEnd > ONE_K_END ? 16 : 1,
        layoutValid,
        lineCount: listing?.lineCount ?? 0,
        programCorrupted: listing?.corrupted ?? false,
        // --- The 4K ROM's LOAD does not run the program: it stops with its report
        autorunLine: undefined,
        slowMode: false,
        displayCollapsed: false,
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

/** A ZX80 number: 16 bits, signed, low byte first */
function zx80Number(memory: Uint8Array, address: number): number {
  const value = memory[address] | (memory[address + 1] << 8);
  return value & 0x8000 ? value - 0x10000 : value;
}

/** The ZX80 variables from `start` to `end`, up to the $80 that ends them (formats: the header) */
export function decodeZx80Variables(
  memory: Uint8Array,
  start: number,
  end: number
): { variables: Zx8081Variable[]; corrupted: boolean } {
  const variables: Zx8081Variable[] = [];
  let pos = start;
  while (pos < end) {
    const first = memory[pos];
    if (first === VARIABLES_END) return { variables, corrupted: false };
    const letter = zx8081LetterOf(first, Zx80Chars);
    const address = pos;
    let variable: Zx8081Variable;
    switch (first >> 5) {
      case 0b011:
        variable = { kind: "number", name: letter, address, length: 3, value: zx80Number(memory, pos + 1) };
        break;
      case 0b010: {
        let name = letter;
        let p = pos + 1;
        while (p < end) {
          const code = memory[p++];
          name += zx8081CharText(code & 0x3f, Zx80Chars);
          if (code & 0x80) break;
        }
        variable = { kind: "number", name, address, length: p - pos + 2, value: zx80Number(memory, p) };
        break;
      }
      case 0b100: {
        let p = pos + 1;
        while (p < end && memory[p] !== ZX80_QUOTE) p++;
        const text = Array.from(memory.subarray(pos + 1, p), (code) => zx81CodeText(code, Zx80Chars)).join("");
        variable = { kind: "string", name: `${letter}$`, address, length: p + 1 - pos, text };
        break;
      }
      case 0b101: {
        const highest = memory[pos + 1];
        variable = { kind: "numberArray", name: `${letter}()`, address, length: 2 + 2 * (highest + 1), dims: [highest] };
        break;
      }
      case 0b111:
        variable = {
          kind: "forLoop",
          name: letter,
          address,
          length: 7,
          value: zx80Number(memory, pos + 1),
          limit: zx80Number(memory, pos + 3),
          line: memory[pos + 5] | (memory[pos + 6] << 8)
        };
        break;
      default:
        // --- No variable starts with these bits: the area is damaged
        return { variables, corrupted: true };
    }
    if (pos + variable.length > end) return { variables, corrupted: true };
    variables.push(variable);
    pos += variable.length;
  }
  // --- Ran out before the $80
  return { variables, corrupted: true };
}

/** Whether a file name is a ZX80 program file's (`.o`, `.80`) */
export function isZx80ProgramFileName(fileName: string): boolean {
  const lower = fileName.toLowerCase();
  return ZX80_FILE_EXTENSIONS.some((ext) => lower.endsWith(ext));
}

/** Reads a ZX80 or ZX81 program file, the machine told by its extension (a ZX81 file otherwise) */
export function analyzeProgramFile(
  bytes: Uint8Array,
  fileName: string
): { analysis?: PFileAnalysis; error?: string } {
  return isZx80ProgramFileName(fileName) ? analyzeOFile(bytes) : analyzePFile(bytes);
}
