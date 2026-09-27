import type { LirLine } from "../backend/lir";
import { ALL_REGS, parseInstr, type ParsedInstr, type Reg } from "./lir";

/**
 * Register liveness over one function's LIR (`.docs/kbasic-optimiser.md` §4.2): which registers
 * (flags included) may still be read after each line. A register not live after an instruction
 * that writes it is dead there, and a rule may drop or change that write.
 *
 * The control flow is the function's own: jumps to its labels, fall-through, returns. Everything
 * else is conservative — a call, a return, a jump out of the function or through a register keeps
 * every register live. With `statementBarriers` (levels 0 and 1), nothing is live at a statement's
 * entry: level-0/1 code keeps no value in a register across a statement boundary (S2). The one
 * exception is the entry of `END SUB`/`END FUNCTION`, the epilogue: a `RETURN` jumps there with the
 * FUNCTION's result in its registers (G6).
 */
export type Liveness = {
  /** Registers live after line i (before the next line runs). */
  liveOut: Set<Reg>[];
  /** Registers live before line i. */
  liveIn: Set<Reg>[];
  parsed: (ParsedInstr | undefined)[];
};

export function computeLiveness(lines: LirLine[], statementBarriers: boolean): Liveness {
  const n = lines.length;
  const parsed = lines.map((l) => (l.kind === "instr" ? parseInstr(l.text) : undefined));
  const labelAt = new Map<string, number>();
  lines.forEach((l, i) => l.kind === "label" && labelAt.set(l.name, i));
  // --- A statement entry followed by the epilogue is not a barrier: the result crosses it
  const barrier = lines.map((l, i) => {
    if (!statementBarriers || l.kind !== "marker" || l.marker !== "stmt") return false;
    for (let k = i + 1; k < n; k++) {
      const next = lines[k];
      if (next.kind === "comment") continue;
      return !(next.kind === "marker" && next.marker === "epilogue.begin");
    }
    return true;
  });

  // --- Successors of each line; -1 stands for "outside the function" (everything live)
  const succ: number[][] = lines.map((_, i) => {
    const p = parsed[i];
    const next = i + 1 < n ? [i + 1] : [-1];
    if (!p?.branch) return next;
    const { kind, cond, target } = p.branch;
    if (kind === "jp" || kind === "jr" || kind === "djnz") {
      const t = target !== undefined ? labelAt.get(target) : undefined;
      const to = t === undefined ? -1 : t;
      return cond || kind === "djnz" ? [...next, to] : [to];
    }
    if (kind === "ret") return cond ? [...next, -1] : [-1];
    if (kind === "jpind") return [-1];
    return next; // --- call, rst: return here (the conservative uses/defs cover them)
  });

  const liveIn: Set<Reg>[] = Array.from({ length: n }, () => new Set<Reg>());
  const liveOut: Set<Reg>[] = Array.from({ length: n }, () => new Set<Reg>());
  let changed = true;
  while (changed) {
    changed = false;
    for (let i = n - 1; i >= 0; i--) {
      const out = new Set<Reg>();
      for (const s of succ[i]) for (const r of s < 0 ? ALL_REGS : liveIn[s]) out.add(r);
      const line = lines[i];
      let inn: Set<Reg>;
      if (barrier[i]) inn = new Set();
      else if (line.kind !== "instr") inn = out;
      else {
        const p = parsed[i]!;
        inn = new Set(p.uses);
        for (const r of out) if (!p.defs.has(r)) inn.add(r);
      }
      if (!sameSet(out, liveOut[i]) || !sameSet(inn, liveIn[i])) {
        liveOut[i] = out;
        liveIn[i] = inn;
        changed = true;
      }
    }
  }
  return { liveOut, liveIn, parsed };
}

function sameSet(a: Set<Reg>, b: Set<Reg>): boolean {
  if (a.size !== b.size) return false;
  for (const x of a) if (!b.has(x)) return false;
  return true;
}
