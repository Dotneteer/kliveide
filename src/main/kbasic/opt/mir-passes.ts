import { COMPARISONS, isSignedM, mtypeSize, type BinOp, type Instr, type MFunction, type MModule, type MType, type Value, type VReg } from "../ir/mir";
import { propagateConstantSlots } from "./constant-slots";
import { inlineCalls } from "./inline";
import { removeUnusedRoutines } from "./unused-routines";
import { verifyFunction } from "./verify";

/**
 * The level-1 MIR passes (`.docs/kbasic-optimiser.md` §3): constant folding, algebraic identities
 * and removal of unused pure instructions. At level 1 they work inside statements only — a
 * value never crosses a statement (S2), and nothing here moves an instruction to another statement.
 *
 * They keep the order the level-0 stack machine relies on (an instruction finds its operands as the
 * most recently computed values): a folded instruction becomes a `const` that defines the *same*
 * vreg in the same place, and an identity (`x + 0`) renames its result to its operand, which was
 * computed just before it. Strength reduction (multiplying by constants and the like) is done by the
 * tree selector, where the constant operands are in view (`select1.ts`).
 *
 * After every pass the verifier runs; a pass that breaks the MIR throws with its name.
 */
export type MirPass = { name: string; run: (fn: MFunction) => boolean };

export function optimizeMir(mir: MModule, level: number, onPass?: (name: string) => void): void {
  if (level < 1) return;
  // --- Level 2: routines nothing reaches get no code; constant slots across statements next, so the
  // --- per-statement passes fold what they give
  if (level >= 2 && removeUnusedRoutines(mir)) onPass?.("unused-routines");
  // --- Level 3: small leaf routines with one call site go into their callers (then the constant
  // --- slots can follow constant arguments into them)
  if (level >= 3 && inlineCalls(mir)) {
    onPass?.("inline");
    for (const fn of mir.functions) {
      if (fn.removed) continue;
      const problems = verifyFunction(fn, level);
      if (problems.length) throw new Error(`The MIR pass 'inline' broke ${fn.name}: ${problems.slice(0, 3).join("; ")}`);
    }
  }
  if (level >= 2 && propagateConstantSlots(mir)) {
    onPass?.("constant-slots");
    for (const fn of mir.functions) {
      const problems = verifyFunction(fn, level);
      if (problems.length) throw new Error(`The MIR pass 'constant-slots' broke ${fn.name}: ${problems.slice(0, 3).join("; ")}`);
    }
  }
  for (const fn of mir.functions) {
    for (let round = 0; round < 10; round++) {
      let changed = false;
      for (const pass of MIR_PASSES) {
        if (!pass.run(fn)) continue;
        changed = true;
        onPass?.(pass.name);
        const problems = verifyFunction(fn, level);
        if (problems.length) throw new Error(`The MIR pass '${pass.name}' broke ${fn.name}: ${problems.slice(0, 3).join("; ")}`);
      }
      if (!changed) break;
    }
  }
}

const INTEGER = new Set<MType>(["i8", "u8", "i16", "u16", "i32", "u32", "bool", "ptr"]);

/** The integer value of a constant operand (an immediate, or a vreg a `const` defines), if any. */
function constantOf(v: Value, defs: Map<number, Instr>): number | undefined {
  if (v.kind === "imm") return v.value;
  if (v.kind !== "vreg") return undefined;
  const d = defs.get(v.id);
  return d?.op === "const" && d.value.kind === "imm" ? d.value.value : undefined;
}

/** A value wrapped to a type's width, sign-extended for signed types. */
function wrap(value: number, type: MType): number {
  if (type === "bool") return value ? 1 : 0;
  const bits = mtypeSize(type) * 8;
  const mod = 2 ** bits;
  let v = ((value % mod) + mod) % mod;
  if (isSignedM(type) && v >= mod / 2) v -= mod;
  return v;
}

function defsOf(fn: MFunction): Map<number, Instr> {
  const defs = new Map<number, Instr>();
  for (const b of fn.blocks) for (const i of b.instrs) if ("dst" in i && i.dst) defs.set(i.dst.id, i);
  return defs;
}

// -------------------------------------------------------------------------------------------------
// Constant folding

function foldBinary(op: BinOp, a: number, b: number, type: MType): number | undefined {
  const signed = isSignedM(type);
  const x = wrap(a, type);
  const y = wrap(b, type);
  const unsigned = (v: number) => wrap(v, type) & (2 ** (mtypeSize(type) * 8) - 1);
  switch (op) {
    case "add":
      return x + y;
    case "sub":
      return x - y;
    case "mul":
      return Number((BigInt(x) * BigInt(y)) % 2n ** 64n);
    case "and":
    case "land":
      return Number(BigInt(unsigned(x)) & BigInt(unsigned(y)));
    case "or":
    case "lor":
      return Number(BigInt(unsigned(x)) | BigInt(unsigned(y)));
    case "xor":
    case "lxor":
      return Number(BigInt(unsigned(x)) ^ BigInt(unsigned(y)));
    case "eq":
      return x === y ? 1 : 0;
    case "ne":
      return x !== y ? 1 : 0;
    case "lt":
      return (signed ? x < y : unsigned(x) < unsigned(y)) ? 1 : 0;
    case "le":
      return (signed ? x <= y : unsigned(x) <= unsigned(y)) ? 1 : 0;
    case "gt":
      return (signed ? x > y : unsigned(x) > unsigned(y)) ? 1 : 0;
    case "ge":
      return (signed ? x >= y : unsigned(x) >= unsigned(y)) ? 1 : 0;
    default:
      // --- Division, shifts and powers keep the runtime's own semantics
      return undefined;
  }
}

const fold: MirPass = {
  name: "fold",
  run(fn) {
    const defs = defsOf(fn);
    let changed = false;
    for (const b of fn.blocks) {
      b.instrs = b.instrs.map((i) => {
        if (i.op !== "bin" || !INTEGER.has(i.a.type) || !INTEGER.has(i.dst.type)) return i;
        const x = constantOf(i.a, defs);
        const y = constantOf(i.b, defs);
        if (x === undefined || y === undefined) return i;
        const r = foldBinary(i.bop, x, y, i.a.type);
        if (r === undefined) return i;
        changed = true;
        const value = COMPARISONS.has(i.bop) ? r : wrap(r, i.dst.type);
        const folded: Instr = { op: "const", dst: i.dst, value: { kind: "imm", type: i.dst.type, value }, sid: i.sid };
        defs.set(i.dst.id, folded);
        return folded;
      });
    }
    return changed;
  }
};

// -------------------------------------------------------------------------------------------------
// Algebraic identities

/** Renames every use of `from` to `to` in the function (instructions and terminators). */
function renameUses(fn: MFunction, from: VReg, to: Value): void {
  const swap = (v: Value): Value => (v.kind === "vreg" && v.id === from.id ? to : v);
  for (const b of fn.blocks) {
    b.instrs = b.instrs.map((i) => mapOperands(i, swap));
    if (b.term) {
      const t = b.term;
      if (t.op === "br") b.term = { ...t, cond: swap(t.cond) };
      else if (t.op === "switch" || t.op === "ongosub") b.term = { ...t, sel: swap(t.sel) };
      else if (t.op === "ret" && t.value) b.term = { ...t, value: swap(t.value) };
      else if (t.op === "end" || t.op === "raise") b.term = { ...t, code: swap(t.code) };
    }
  }
}

function mapOperands(i: Instr, f: (v: Value) => Value): Instr {
  const slot = (s: Extract<Instr, { op: "load" }>["slot"]) => (s.kind === "deref" ? { ...s, ptr: f(s.ptr) } : s);
  switch (i.op) {
    case "load":
    case "addr":
      return { ...i, slot: slot(i.slot) };
    case "store":
      return { ...i, slot: slot(i.slot), src: f(i.src) };
    case "bin":
      return { ...i, a: f(i.a), b: f(i.b) };
    case "neg":
    case "not":
    case "lnot":
    case "conv":
      return { ...i, a: f(i.a) };
    case "call":
      return { ...i, args: i.args.map(f) };
    case "rtcall":
      return { ...i, args: i.args.map(f) };
    default:
      return i;
  }
}

const algebra: MirPass = {
  name: "algebra",
  run(fn) {
    const defs = defsOf(fn);
    for (const b of fn.blocks) {
      for (let n = 0; n < b.instrs.length; n++) {
        const i = b.instrs[n];
        if (i.op !== "bin" || !INTEGER.has(i.a.type) || i.a.type !== i.dst.type || i.a.kind !== "vreg") continue;
        const y = constantOf(i.b, defs);
        if (y === undefined) continue;
        const allOnes = wrap(-1, i.a.type);
        const w = wrap(y, i.a.type);
        const identity =
          ((i.bop === "add" || i.bop === "sub" || i.bop === "or" || i.bop === "xor" || i.bop === "shl" || i.bop === "shr") && w === 0) ||
          ((i.bop === "mul" || i.bop === "div") && w === 1) ||
          (i.bop === "and" && w === allOnes);
        if (identity) {
          // --- x op k is x: the operand, computed just before, stands for the result
          renameUses(fn, i.dst, i.a);
          b.instrs.splice(n, 1);
          return true;
        }
        // --- x * 0 is 0 when x's tree has no effect: the dead-code pass then removes that tree
        const zero = (i.bop === "mul" || i.bop === "and") && w === 0 && pureTree(i.a, defs);
        if (zero) {
          b.instrs[n] = { op: "const", dst: i.dst, value: { kind: "imm", type: i.dst.type, value: 0 }, sid: i.sid };
          return true;
        }
      }
    }
    return false;
  }
};

/** Whether a value is computed by pure integer instructions only (no calls, no division). */
function pureTree(v: Value, defs: Map<number, Instr>): boolean {
  if (v.kind !== "vreg") return true;
  const d = defs.get(v.id);
  if (!d || !PURE.has(d.op) || !("dst" in d) || !d.dst || !INTEGER.has(d.dst.type)) return false;
  if (d.op === "bin" && (d.bop === "div" || d.bop === "mod" || d.bop === "pow")) return false;
  let pure = true;
  mapOperands(d, (x) => {
    if (!pureTree(x, defs)) pure = false;
    return x;
  });
  return pure;
}

// -------------------------------------------------------------------------------------------------
// Unused pure instructions

const PURE = new Set(["const", "load", "addr", "bin", "neg", "not", "lnot", "conv"]);

const deadCode: MirPass = {
  name: "dead-code",
  run(fn) {
    const uses = new Map<number, number>();
    const count = (v: Value) => v.kind === "vreg" && uses.set(v.id, (uses.get(v.id) ?? 0) + 1);
    for (const b of fn.blocks) {
      for (const i of b.instrs) mapOperands(i, (v) => (count(v), v));
      const t = b.term;
      if (t?.op === "br") count(t.cond);
      else if (t?.op === "switch" || t?.op === "ongosub") count(t.sel);
      else if (t?.op === "ret" && t.value) count(t.value);
      else if (t?.op === "end" || t?.op === "raise") count(t.code);
    }
    let changed = false;
    for (const b of fn.blocks) {
      const kept = b.instrs.filter((i) => {
        // --- Float and String values keep their code: their loads can have ownership side effects
        if (!PURE.has(i.op) || !("dst" in i) || !i.dst || !INTEGER.has(i.dst.type)) return true;
        if ((uses.get(i.dst.id) ?? 0) > 0) return true;
        // --- Division by zero reports nothing, but keep it anyway: it calls the runtime
        if (i.op === "bin" && (i.bop === "div" || i.bop === "mod" || i.bop === "pow")) return true;
        return false;
      });
      if (kept.length !== b.instrs.length) {
        b.instrs = kept;
        changed = true;
      }
    }
    return changed;
  }
};

// -------------------------------------------------------------------------------------------------
// Branch folding

/**
 * A branch on a constant is a jump (`IF 1 THEN`, a comparison the folder decided, `WHILE 1`); an
 * ON GOTO with a constant selector jumps to its target. The constant then has no use and goes with
 * the dead code. The code the branch no longer reaches stays: its statement entries are kept.
 */
const branchFold: MirPass = {
  name: "branch-fold",
  run(fn) {
    const defs = defsOf(fn);
    let changed = false;
    for (const b of fn.blocks) {
      const t = b.term;
      if (t?.op === "br") {
        const k = constantOf(t.cond, defs);
        if (k === undefined) continue;
        b.term = { op: "jmp", target: k !== 0 ? t.ifTrue : t.ifFalse, sid: t.sid };
        changed = true;
      } else if (t?.op === "switch") {
        const k = constantOf(t.sel, defs);
        if (k === undefined) continue;
        b.term = { op: "jmp", target: k >= 0 && k < t.targets.length ? t.targets[k] : t.otherwise, sid: t.sid };
        changed = true;
      }
    }
    return changed;
  }
};

export const MIR_PASSES: readonly MirPass[] = [fold, algebra, branchFold, deadCode];
