import type { Block, Instr, MFunction, MModule, Terminator, Value } from "../ir/mir";

/**
 * The MIR verifier (`.docs/kbasic-mir.md` §7, `.docs/kbasic-optimiser.md` §3): run after lowering
 * and after every optimisation pass, so a pass that breaks an invariant is named at once.
 *
 * - S1: every instruction and terminator has a statement id.
 * - SSA: every virtual register is defined once, and only used where it is defined.
 * - S2 (levels 0 and 1): a virtual register is used only by its own statement's instructions.
 * - Every jump target is a block of the function.
 */
export function verifyModule(mir: MModule, level: number): string[] {
  const problems: string[] = [];
  for (const fn of mir.functions) problems.push(...verifyFunction(fn, level).map((p) => `${fn.name}: ${p}`));
  return problems;
}

export function verifyFunction(fn: MFunction, level: number): string[] {
  const problems: string[] = [];
  const blocks = new Set(fn.blocks.map((b) => b.label));
  const defs = new Map<number, number>();
  for (const b of fn.blocks) {
    for (const i of b.instrs) {
      if (typeof i.sid !== "number") problems.push(`S1: an instruction '${i.op}' in ${b.label} has no statement id`);
      const dst = destination(i);
      if (dst !== undefined) {
        if (defs.has(dst)) problems.push(`SSA: %${dst} is defined twice`);
        defs.set(dst, i.sid);
      }
    }
    if (b.term && typeof b.term.sid !== "number") problems.push(`S1: the terminator of ${b.label} has no statement id`);
  }
  const checkUse = (v: Value | undefined, sid: number, where: string) => {
    if (v?.kind !== "vreg") return;
    const at = defs.get(v.id);
    if (at === undefined) problems.push(`SSA: %${v.id} is used in ${where} but never defined`);
    else if (level <= 1 && at !== sid) problems.push(`S2: %${v.id} of statement ${at} is used by statement ${sid} in ${where}`);
  };
  for (const b of fn.blocks) {
    for (const i of b.instrs) for (const v of operands(i)) checkUse(v, i.sid, b.label);
    if (b.term) {
      for (const v of termOperands(b.term)) checkUse(v, b.term.sid, b.label);
      for (const t of termTargets(b.term)) if (!blocks.has(t)) problems.push(`the terminator of ${b.label} jumps to the unknown block ${t}`);
    }
  }
  return problems;
}

function destination(i: Instr): number | undefined {
  return "dst" in i && i.dst ? i.dst.id : undefined;
}

function operands(i: Instr): Value[] {
  switch (i.op) {
    case "store":
      return [i.src, ...(i.slot.kind === "deref" ? [i.slot.ptr] : [])];
    case "load":
    case "addr":
      return i.slot.kind === "deref" ? [i.slot.ptr] : [];
    case "bin":
      return [i.a, i.b];
    case "neg":
    case "not":
    case "lnot":
    case "conv":
      return [i.a];
    case "call":
    case "rtcall":
      return i.args;
    default:
      return [];
  }
}

function termOperands(t: Terminator): Value[] {
  switch (t.op) {
    case "br":
      return [t.cond];
    case "switch":
    case "ongosub":
      return [t.sel];
    case "ret":
      return t.value ? [t.value] : [];
    case "end":
    case "raise":
      return [t.code];
    default:
      return [];
  }
}

function termTargets(t: Terminator): string[] {
  switch (t.op) {
    case "jmp":
      return [t.target];
    case "br":
      return [t.ifTrue, t.ifFalse];
    case "switch":
      return [...t.targets, t.otherwise];
    case "gosub":
      return [t.target, t.next];
    case "ongosub":
      return [...t.targets, t.next];
    default:
      return [];
  }
}

export type { Block };
