import { mtypeSize, type Block, type Instr, type MFunction, type MModule, type Terminator, type Value } from "../mir/mir";
import { isIntegerType, isRealType } from "../mir/representations";

/**
 * The MIR verifier (`.docs/kbasic-mir.md` §7, `.docs/kbasic-optimiser.md` §3): run after lowering
 * and after every optimisation pass, so a pass that breaks an invariant is named at once.
 *
 * - S1: every instruction and terminator has a statement id.
 * - SSA: every virtual register is defined once, and only used where it is defined.
 * - S2 (levels 0 and 1): a virtual register is used only by its own statement's instructions.
 * - Every jump target is a block of the function.
 * - S3: every operation whose meaning differs between languages states it, and states one instruction
 *   selection implements (`.plans/SHARED_Z80_BACKEND_PLAN.md` §3.4; `semanticProblems`).
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
  problems.push(...semanticProblems(fn));
  return problems;
}

/**
 * The meanings this back end implements, by attribute (`mir.ts`, "the meanings an operation may
 * have"). Each new one needs instruction selection, folding and a MIR-level test before it is listed.
 */
const IMPLEMENTED = {
  div: ["trunc"],
  mod: ["magnitude"],
  overflow: ["wrap"],
  toInt: ["floor"],
  signedShift: ["arith"],
  truth: ["01"]
} as const;

/** S3, at every level: operations that need a stated meaning have one, and one that is implemented. */
export function semanticProblems(fn: MFunction): string[] {
  const problems: string[] = [];
  const check = (what: string, value: string | undefined, implemented: readonly string[], where: string) => {
    if (value === undefined) problems.push(`S3: ${where} does not say its ${what}`);
    else if (!implemented.includes(value)) problems.push(`S3: ${where} asks for ${what} '${value}', which this back end does not implement yet`);
  };
  for (const b of fn.blocks) {
    for (const i of b.instrs) {
      const where = `'${i.op}${i.op === "bin" ? ` ${i.bop}` : ""}' of statement ${i.sid}`;
      if (i.op === "bin" && isIntegerType(i.a.type) && i.a.type !== "bool") {
        if (i.bop === "div") check("rounding", i.rounding, IMPLEMENTED.div, where);
        else if (i.bop === "mod") check("rounding", i.rounding, IMPLEMENTED.mod, where);
        else if (i.bop === "add" || i.bop === "sub" || i.bop === "mul" || i.bop === "shl") check("overflow", i.overflow, IMPLEMENTED.overflow, where);
        else if (i.bop === "shr" && (i.a.type === "i8" || i.a.type === "i16" || i.a.type === "i32")) check("shift", i.shift, IMPLEMENTED.signedShift, where);
      } else if (i.op === "neg" && isIntegerType(i.a.type)) check("overflow", i.overflow, IMPLEMENTED.overflow, where);
      else if (i.op === "conv") {
        const from = i.a.type;
        const to = i.dst.type;
        if (from === "bool" || to === "bool") {
          if (from !== to) check("truth", i.truth, IMPLEMENTED.truth, where);
        } else if (isRealType(from) && isIntegerType(to)) {
          check("toInt", i.toInt, IMPLEMENTED.toInt, where);
          check("overflow", i.overflow, IMPLEMENTED.overflow, where);
        } else if (isIntegerType(from) && isIntegerType(to) && mtypeSize(to) < mtypeSize(from)) check("overflow", i.overflow, IMPLEMENTED.overflow, where);
      }
    }
  }
  return problems;
}

/** S3 over a whole module: what every build checks, whatever its optimisation level. */
export function moduleSemanticProblems(mir: MModule): string[] {
  return mir.functions.flatMap((fn) => semanticProblems(fn).map((p) => `${fn.name}: ${p}`));
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
      return [t.sel];
    case "ret":
      return t.value ? [t.value] : [];
    case "exit":
      return [t.value];
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
    case "localcall":
      return [t.target, t.next];
    default:
      return [];
  }
}

export type { Block };
