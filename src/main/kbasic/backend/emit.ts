import type { CallSite, DataItem } from "../ir/mir";
import type { LirLine } from "./lir";

/** What the debug builder needs to know about one line of the generated program. */
export type LineInfo = {
  sid: number;
  site?: CallSite;
  marker?: "stmt" | "prologue.end" | "epilogue.begin";
};

export type EmittedProgram = {
  /** The generated program (`<name>.kbasic.asm`): what the assembler parses and `'@emit-asm` shows. */
  text: string;
  /** One entry per line of `text`: `lines[n - 1]` describes line n. */
  lines: LineInfo[];
  /** Per function, in input order: its lines, 1-based, `end` exclusive (the debugger's callable ranges). */
  functionLines: { start: number; end: number }[];
};

export type EmitInput = {
  /** Lines before the code: `.model`, `.org`, the prologue (statement id -1). */
  header: string[];
  functions: LirLine[][];
  data: DataItem[];
  /** CODEBANK: each function's bank (undefined: resident), in `functions` order. */
  functionBanks?: (number | undefined)[];
  /** CODEBANK: where each bank goes, by logical bank: its first 8K page, the window, the page count. */
  bankPlacement?: Map<number, { page: number; address: number; pages: number }>;
};

/** The label that ends the resident part of a banked program: the runtime continues there. */
export const RESIDENT_END = "__kbResidentEnd";

/**
 * Writes the program (`.docs/kbasic-lir-regalloc.md` §7): one assembler line per LIR line, with the
 * line table the debug builder joins with the assembler's list items. A `jp` to the label that
 * follows it is dropped.
 */
export function emitProgram(input: EmitInput): EmittedProgram {
  const text: string[] = [];
  const lines: LineInfo[] = [];
  const add = (line: string, info: LineInfo) => {
    text.push(line);
    lines.push(info);
  };
  for (const h of input.header) add(h, { sid: -1 });
  const functionLines: { start: number; end: number }[] = new Array(input.functions.length);
  const bankOf = (i: number) => input.functionBanks?.[i];
  const emitFunction = (i: number) => {
    const start = text.length + 1;
    const kept = dropJumpsToNext(input.functions[i]);
    for (const l of kept) {
      switch (l.kind) {
        case "label":
          add(`${l.name}:`, { sid: l.sid });
          break;
        case "instr":
          add(`    ${l.text}`, { sid: l.sid, ...(l.site ? { site: l.site } : {}) });
          break;
        case "marker":
          add(`; ${l.marker}${l.marker === "stmt" ? ` ${l.sid}` : ""}`, { sid: l.sid, marker: l.marker });
          break;
        case "comment":
          add(`; ${l.text}`, { sid: l.sid });
          break;
      }
    }
    functionLines[i] = { start, end: text.length + 1 };
  };
  // --- The resident program: its code, then its data
  input.functions.forEach((_, i) => bankOf(i) === undefined && emitFunction(i));
  for (const d of input.data) if (!d.bank) for (const line of dataLines(d)) add(line, { sid: -1 });
  // --- CODEBANK: each bank in its page(s), assembled for the window; the runtime goes on after the
  // --- resident part
  const banks = [...(input.bankPlacement?.keys() ?? [])].sort((a, b) => a - b);
  if (banks.length) {
    add(`${RESIDENT_END}:`, { sid: -1 });
    for (const bank of banks) {
      const place = input.bankPlacement!.get(bank)!;
      add(`    .page ${place.page}, ${place.address}${place.pages > 1 ? `, ${place.pages}` : ""}`, { sid: -1 });
      add(`__kbBank${bank}:`, { sid: -1 });
      input.functions.forEach((_, i) => bankOf(i) === bank && emitFunction(i));
      for (const d of input.data) if (d.bank === bank) for (const line of dataLines(d)) add(line, { sid: -1 });
    }
    add(`    .org ${RESIDENT_END}`, { sid: -1 });
  }
  return { text: text.join("\n"), lines, functionLines };
}

function dropJumpsToNext(fn: LirLine[]): LirLine[] {
  return fn.filter((l, i) => {
    if (l.kind !== "instr" || !l.text.startsWith("jp ") || l.text.includes(",")) return true;
    const target = l.text.slice(3).trim();
    for (let k = i + 1; k < fn.length; k++) {
      const next = fn[k];
      if (next.kind === "comment") continue;
      return !(next.kind === "label" && next.name === target);
    }
    return true;
  });
}

function dataLines(d: DataItem): string[] {
  switch (d.kind) {
    case "var":
      if (d.init) {
        const out = [`${d.label}:`];
        for (let i = 0; i < d.init.length; i += 16) out.push(`    .defb ${d.init.slice(i, i + 16).join(",")}`);
        return out;
      }
      return [`${d.label}:`, `    .defs ${d.size}`];
    case "string": {
      const codes = [...d.text].map((c) => c.charCodeAt(0) & 0xff);
      const out = [`${d.label}:`, `    .defw ${codes.length}`];
      for (let i = 0; i < codes.length; i += 16) out.push(`    .defb ${codes.slice(i, i + 16).join(",")}`);
      return out;
    }
    case "raw":
      return [`${d.label}:`, ...d.lines];
    case "equ":
      return [`${d.label} .equ ${d.value}`];
  }
}
