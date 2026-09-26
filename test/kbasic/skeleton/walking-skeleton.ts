/**
 * Klive BASIC walking skeleton — a THROW-AWAY spike, not the compiler.
 *
 * It proves the pipeline shape of `.plans/ZXBASIC_COMPILER_PLAN.md` end to end before the real
 * front end exists (plan §17, R3):
 *
 *   BASIC text → statements with column ranges → generated Klive assembly whose every line is
 *   tagged with a statement id → a Klive-written runtime module (`.module core`) → Klive's own
 *   assembler → classic debug tables (`sourceFileList`, `sourceMap`, `listFileItems`) built by
 *   joining the assembler's list items with the line→statement tags.
 *
 * It accepts only `PRINT "literal"` statements separated by `:`, and comment lines. Everything
 * here is replaced in Phase 3 by the real lexer, parser, code generator and runtime; keep it only
 * as long as the skeleton test is useful.
 */
import type { FileLine, ListFileItem } from "@abstractions/CompilerInfo";
import { AssemblerOptions } from "@main/compiler-common/assembler-in-out";
import { SpectrumModelType } from "@main/z80-compiler/SpectrumModelTypes";
import { Z80Assembler } from "@main/z80-compiler/z80-assembler";

/** One BASIC statement: 1-based line, 0-based columns, end exclusive (as StatementDebugInfo). */
export type SkeletonStatement = {
  index: number;
  line: number;
  startColumn: number;
  endColumn: number;
  text: string;
  literal: string;
};

export type SkeletonStatementInfo = SkeletonStatement & {
  /** Entry address: first byte of the statement's code. */
  startAddress: number;
  /** One past the statement's last byte. */
  endAddress: number;
};

export type SkeletonOutput = {
  /** The generated Klive assembly (for inspection). */
  asm: string;
  statements: SkeletonStatementInfo[];
  /** Address of the program entry (`Main`). */
  entry: number;
  /** Address of the word where the prologue stores the main program's baseline SP. */
  mainBaselineAddress: number;
  segments: { startAddress: number; emittedCode: number[] }[];
  /** Classic tables, BASIC file at index 0 — what the IDE's existing breakpoint/highlight code reads. */
  sourceFileList: { filename: string }[];
  sourceMap: Record<number, FileLine>;
  listFileItems: ListFileItem[];
};

/** Splits BASIC text into PRINT statements with exact column ranges (colons inside strings kept). */
export function parseSkeleton(source: string): SkeletonStatement[] {
  const statements: SkeletonStatement[] = [];
  source.split(/\r?\n/).forEach((lineText, i) => {
    const line = i + 1;
    let col = 0;
    while (col < lineText.length) {
      // --- skip blanks and separators
      while (col < lineText.length && /[\s:]/.test(lineText[col])) col++;
      if (col >= lineText.length || lineText[col] === "'") break; // comment to end of line
      const start = col;
      let inString = false;
      while (col < lineText.length) {
        const ch = lineText[col];
        if (ch === '"') inString = !inString;
        else if (!inString && (ch === ":" || ch === "'")) break;
        col++;
      }
      let end = col;
      while (end > start && /\s/.test(lineText[end - 1])) end--;
      const text = lineText.slice(start, end);
      const m = /^PRINT\s+"([^"]*)"$/i.exec(text);
      if (!m) throw new Error(`Skeleton accepts only PRINT "literal"; line ${line}: ${text}`);
      statements.push({ index: statements.length, line, startColumn: start, endColumn: end, text, literal: m[1] });
    }
  });
  return statements;
}

/**
 * The spike's runtime: Klive-written, Klive dialect, in module `core`. PRINT goes through the ROM
 * here only because this is a spike; the real runtime prints with its own routine (runtime-abi.md
 * §9).
 */
const SKELETON_RUNTIME = [
  "      .module core",
  "Init:",
  "      ld a,2",
  "      call $1601         ; CHAN-OPEN: stream 2 = upper screen",
  "      ret",
  "PrintStr:                ; HL -> [length:2][chars...]",
  "      ld c,(hl)",
  "      inc hl",
  "      ld b,(hl)",
  "      inc hl",
  "PrintStrLoop:",
  "      ld a,b",
  "      or c",
  "      ret z",
  "      ld a,(hl)",
  "      push hl",
  "      push bc",
  "      rst $10            ; PRINT-A",
  "      pop bc",
  "      pop hl",
  "      inc hl",
  "      dec bc",
  "      jr PrintStrLoop",
  "PrintNewline:",
  "      ld a,13",
  "      rst $10",
  "      ret",
  "MainBaseline:",
  "      .defw 0",
  "      .moduleend"
];

/** Compiles skeleton BASIC to a 48K program at `$8000` with classic debug tables. */
export async function compileSkeleton(source: string, filename = "skeleton.zxbas"): Promise<SkeletonOutput> {
  const statements = parseSkeleton(source);

  // --- Generated program: one array entry per assembler line, with its statement id (-1 = glue)
  const lines: { text: string; statement: number }[] = [];
  const emit = (text: string, statement = -1) => lines.push({ text, statement });
  emit("      .model Spectrum48");
  emit("      .org $8000");
  emit("Main:");
  emit("      ld (core.MainBaseline),sp   ; baseline SP of the main program (plan §10.2.2)");
  emit("      call core.Init");
  for (const s of statements) {
    emit(`      ld hl,Str${s.index}`, s.index);
    emit("      call core.PrintStr", s.index);
    emit("      call core.PrintNewline", s.index);
  }
  emit("      ret");
  for (const s of statements) {
    emit(`Str${s.index}:`);
    emit(`      .defw ${s.literal.length}`);
    if (s.literal.length) emit(`      .defm "${s.literal}"`);
  }
  for (const r of SKELETON_RUNTIME) emit(r);
  const asm = lines.map((l) => l.text).join("\n");

  const options = new AssemblerOptions();
  options.currentModel = SpectrumModelType.Spectrum48;
  const output = await new Z80Assembler().compile(asm, options);
  const errors = output.errors.filter((e) => !e.isWarning);
  if (errors.length) {
    throw new Error(errors.map((e) => `asm line ${e.line}: ${e.errorCode} ${e.message}`).join("\n"));
  }

  // --- Join list items (1-based assembler line numbers of the single virtual file) with the tags
  const ranges = new Map<number, { start: number; end: number }>();
  for (const item of output.listFileItems) {
    const tag = lines[item.lineNumber - 1]?.statement ?? -1;
    if (tag < 0 || !item.codeLength) continue;
    const r = ranges.get(tag);
    const end = item.address + item.codeLength;
    if (!r) ranges.set(tag, { start: item.address, end });
    else {
      r.start = Math.min(r.start, item.address);
      r.end = Math.max(r.end, end);
    }
  }
  const infos: SkeletonStatementInfo[] = statements.map((s) => {
    const r = ranges.get(s.index);
    if (!r) throw new Error(`Statement ${s.index} generated no code`);
    return { ...s, startAddress: r.start, endAddress: r.end };
  });

  // --- Classic tables: one entry per statement, at its entry address, with its columns
  const sourceMap: Record<number, FileLine> = {};
  const listFileItems: ListFileItem[] = [];
  for (const s of infos) {
    sourceMap[s.startAddress] = { fileIndex: 0, line: s.line, startColumn: s.startColumn, endColumn: s.endColumn };
    listFileItems.push({
      fileIndex: 0,
      address: s.startAddress,
      lineNumber: s.line,
      segmentIndex: 0,
      codeStartIndex: s.startAddress - 0x8000,
      codeLength: s.endAddress - s.startAddress,
      sourceText: s.text
    });
  }

  const symbol = (name: string) => output.getSymbol(name)?.value?.value as number;
  return {
    asm,
    statements: infos,
    entry: symbol("Main"),
    mainBaselineAddress: output.getNestedModule("core")?.getSymbol("MainBaseline")?.value?.value as number,
    segments: output.segments.map((s) => ({ startAddress: s.startAddress, emittedCode: s.emittedCode })),
    sourceFileList: [{ filename }],
    sourceMap,
    listFileItems
  };
}
