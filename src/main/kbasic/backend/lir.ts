import type { CallSite } from "../ir/mir";

/**
 * LIR lines (`.docs/kbasic-lir-regalloc.md` §2): Z80 code as the emitter writes it, one assembler
 * line each, every one tagged with the statement id it belongs to. Phase 3's level-0 code needs
 * only the instruction text; the register uses and definitions the Phase 7 allocator and peephole
 * rules need are added to `instr` lines then.
 */
export type LirLine =
  | { kind: "instr"; text: string; sid: number; site?: CallSite }
  | { kind: "label"; name: string; sid: number }
  /** Zero-size: a statement's entry, or a frame boundary (the debugger's bodyStart/epilogueStart). */
  | { kind: "marker"; marker: "stmt" | "prologue.end" | "epilogue.begin"; sid: number }
  | { kind: "comment"; text: string; sid: number };

export function instr(text: string, sid: number, site?: CallSite): LirLine {
  return { kind: "instr", text, sid, ...(site ? { site } : {}) };
}

export function label(name: string, sid: number): LirLine {
  return { kind: "label", name, sid };
}

/** An internal compiler error: the MIR broke an invariant instruction selection relies on. */
export class CodegenError extends Error {}
