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
};

export type EmitInput = {
  /** Lines before the code: `.model`, `.org`, the prologue (statement id -1). */
  header: string[];
  functions: LirLine[][];
  data: DataItem[];
};

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
  for (const fn of input.functions) {
    const kept = dropJumpsToNext(fn);
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
  }
  for (const d of input.data) for (const line of dataLines(d)) add(line, { sid: -1 });
  return { text: text.join("\n"), lines };
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
