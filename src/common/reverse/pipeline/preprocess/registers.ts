import type { DisassemblyBranchCondition } from "@renderer/appIde/disassemblers/common-types";
import { rowAt, type DecodedBank, type DecodedRow } from "./decode";
import { REG8, type Reg8 } from "./effects";
import { nextInstruction } from "./routines";

/*
 * Stage 8: register facts and exit paths (`.plans/ROM_ANNOTATION_PIPELINE_PLAN.md` §4.1, D10).
 *
 * A symbolic data-flow pass over the paths from a routine's entry. Each register holds a *symbol*: the
 * name of the entry register whose value it still has (`"HL"` -> `H` holds the entry `H`), or `?`. A
 * write makes it `?`; `PUSH`/`POP` carry symbols through a modelled stack; `EX AF,AF'`, `EXX` and
 * `EX DE,HL` swap them; a `CALL` applies the callee's own summary. At every exit the symbols say which
 * registers kept their entry value (`Keeps:`), which changed (`Changes:`), and which now hold another
 * register's entry value. A register read while it still holds an entry value is an input (`Entry:`).
 *
 * The facts are facts or `unknown`: a call out of the page, `JP (HL)`, a stack the pass cannot follow
 * (a `POP` of the return address, `LD SP`, paths that meet with different stack depths) are listed with
 * their instruction, never guessed (D7).
 */

/** The tracked registers: the main set's halves and the alternate set. */
export type Reg = Reg8 | "A'" | "F'" | "B'" | "C'" | "D'" | "E'" | "H'" | "L'";

const ALT: Reg[] = ["A'", "F'", "B'", "C'", "D'", "E'", "H'", "L'"];
export const REGS: readonly Reg[] = [...REG8, ...ALT];

/** The value a register holds: the entry register whose value it still is, or `?`. */
type Sym = Reg | "?";

type Known = { carry?: 0 | 1; zero?: 0 | 1; a?: number };

/**
 * `lost`: the stack is no longer the routine's own (`LD SP`, a `POP` of the return address), so a `RET`
 * on this path does not return to the caller.
 */
type State = { regs: Record<Reg, Sym>; stack: Sym[]; known: Known; lost?: boolean };

export type ExitKind = "ret" | "ret-cc" | "jump-out" | "indirect" | "unknown";

export type ExitFact = {
  offset: number;
  kind: ExitKind;
  condition?: DisassemblyBranchCondition;
  /** Flags and A known at the exit (`SCF; RET` -> carry 1). */
  known: Known;
};

export type RegisterFacts = {
  entry: number;
  /** Entry registers read before they are written. */
  inputs: Reg[];
  /** Registers whose value at some return is not their entry value. */
  changes: Reg[];
  /** Registers that hold their entry value at every return. */
  keeps: Reg[];
  /** Registers that hold another register's entry value at every return (`EX DE,HL`). */
  moved: { reg: Reg; from: Reg }[];
  /** Whether any return is reachable. */
  returns: boolean;
  exits: ExitFact[];
  /** What the pass could not follow, with the instruction. */
  unknowns: { offset: number; reason: string }[];
};

export type RegisterAnalysis = Map<number, RegisterFacts>;

/** Register facts for every entry, callees before callers, iterated over recursion. */
export function analyseRegisters(decoded: DecodedBank, entries: readonly number[]): RegisterAnalysis {
  const facts: RegisterAnalysis = new Map();
  const order = bottomUp(decoded, entries);
  for (let round = 0; round < 4; round++) {
    let pending = false;
    for (const entry of order) {
      const result = analyse(decoded, entry, facts);
      pending ||= result.usedPending;
      facts.set(entry, result.facts);
    }
    if (!pending) break;
  }
  return facts;
}

/** Entries in post-order of the call graph: a routine's callees come before it where they can. */
function bottomUp(decoded: DecodedBank, entries: readonly number[]): number[] {
  const set = new Set(entries);
  const calleesOf = new Map<number, number[]>();
  for (const entry of entries) {
    const callees = new Set<number>();
    walk(decoded, entry, (row) => {
      const target = row.branch?.target;
      if ((row.branch?.kind === "call" || row.branch?.kind === "rst") && target !== undefined && set.has(target)) callees.add(target);
    });
    calleesOf.set(entry, [...callees]);
  }
  const order: number[] = [];
  const state = new Map<number, "open" | "done">();
  const visit = (entry: number) => {
    if (state.has(entry)) return;
    state.set(entry, "open");
    for (const callee of calleesOf.get(entry) ?? []) visit(callee);
    state.set(entry, "done");
    order.push(entry);
  };
  for (const entry of [...entries].sort((a, b) => a - b)) visit(entry);
  return order;
}

/** Visits the rows reachable from `start` without following calls. */
function walk(decoded: DecodedBank, start: number, visit: (row: DecodedRow) => void) {
  const seen = new Set<number>();
  const work = [start];
  while (work.length) {
    const offset = work.pop()!;
    if (seen.has(offset)) continue;
    seen.add(offset);
    const row = rowAt(decoded, offset);
    if (!row || row.data) continue;
    visit(row);
    const branch = row.branch;
    const next = nextInstruction(row, decoded);
    if (branch && (branch.kind === "jp" || branch.kind === "jr" || branch.kind === "djnz") && branch.target !== undefined) {
      work.push(branch.target);
    }
    const stops =
      branch && ((branch.kind === "jp" || branch.kind === "jr") && !branch.condition || (branch.kind === "ret" && !branch.condition) || branch.kind === "jp-indirect");
    if (!stops && next !== undefined) work.push(next);
  }
}

function initialState(): State {
  const regs = {} as Record<Reg, Sym>;
  for (const reg of REGS) regs[reg] = reg;
  return { regs, stack: [], known: {} };
}

function unknownState(from: State): State {
  const regs = {} as Record<Reg, Sym>;
  for (const reg of REGS) regs[reg] = "?";
  return { regs, stack: [...from.stack], known: {}, ...(from.lost ? { lost: true } : {}) };
}

function cloneState(state: State): State {
  return { regs: { ...state.regs }, stack: [...state.stack], known: { ...state.known }, ...(state.lost ? { lost: true } : {}) };
}

function analyse(decoded: DecodedBank, entry: number, facts: RegisterAnalysis): { facts: RegisterFacts; usedPending: boolean } {
  const states = new Map<number, State>();
  const inputs = new Set<Reg>();
  const exitsAt = new Map<string, { fact: ExitFact; state: State }>();
  /** An exit seen again (a path revisited) joins into the one already recorded. */
  const exit = (fact: ExitFact, state: State) => {
    const key = `${fact.offset}:${fact.kind}`;
    const seen = exitsAt.get(key);
    if (!seen) {
      exitsAt.set(key, { fact, state });
      return;
    }
    const joined = join(seen.state, state, () => undefined);
    exitsAt.set(key, { fact: { ...seen.fact, known: joined.known }, state: joined });
  };
  const unknowns = new Map<number, string>();
  let usedPending = false;
  const work: number[] = [];

  const unknown = (offset: number, reason: string) => {
    if (!unknowns.has(offset)) unknowns.set(offset, reason);
  };
  const flowTo = (offset: number | undefined, state: State, from: DecodedRow) => {
    if (offset === undefined) {
      unknown(from.offset, "runs off the end of the code");
      exit({ offset: from.offset, kind: "unknown", known: {} }, unknownState(state));
      return;
    }
    const target = rowAt(decoded, offset);
    if (!target || target.data) {
      unknown(from.offset, `goes to $${hex(offset)}, which is not an instruction start in the code (inside an instruction, or data)`);
      exit({ offset: from.offset, kind: "unknown", known: {} }, unknownState(state));
      return;
    }
    const existing = states.get(offset);
    if (!existing) {
      states.set(offset, cloneState(state));
      work.push(offset);
      return;
    }
    const joined = join(existing, state, () => unknown(offset, "paths meet here with different stack depths"));
    if (!sameState(joined, existing)) {
      states.set(offset, joined);
      work.push(offset);
    }
  };

  states.set(entry, initialState());
  work.push(entry);
  let steps = 0;
  while (work.length && steps++ < 200_000) {
    const offset = work.pop()!;
    const row = rowAt(decoded, offset)!;
    const before = states.get(offset)!;
    let state = cloneState(before);
    const effects = row.effects;

    // --- Inputs: a read of a register that still holds an entry value (a push only saves it)
    if (effects.stack?.op !== "push") {
      for (const reg of effects.reads) {
        const sym = state.regs[reg];
        if (sym !== "?") inputs.add(sym);
      }
    }

    if (effects.unknown) {
      unknown(offset, effects.unknown);
      state = unknownState(state);
    } else if (/^(ld sp,|inc sp|dec sp)/.test(row.text)) {
      unknown(offset, "changes SP: the stack is not followed past it");
      state = unknownState(state);
      state.stack = [];
      state.lost = true;
    } else {
      state = transfer(state, row, (reason) => unknown(offset, reason));
    }

    const branch = row.branch;
    const next = nextInstruction(row, decoded);
    if (!branch) {
      flowTo(next, state, row);
      continue;
    }
    switch (branch.kind) {
      case "jp":
      case "jr":
      case "djnz": {
        const taken = branch.condition ? refine(state, branch.condition, true) : state;
        if (branch.target !== undefined) flowTo(branch.target, taken, row);
        else {
          unknown(offset, `jumps out of the page to $${hex(branch.address ?? 0)}`);
          exit({ offset, kind: "jump-out", known: {} }, unknownState(taken));
        }
        if (branch.condition || branch.kind === "djnz") flowTo(next, branch.condition ? refine(state, branch.condition, false) : state, row);
        break;
      }
      case "call":
      case "rst": {
        const callee = branch.target !== undefined ? facts.get(branch.target) : undefined;
        const isEntry = branch.target !== undefined && rowAt(decoded, branch.target) !== undefined;
        let after: State | undefined;
        if (callee) {
          if (callee.returns) after = applyCallee(state, callee, inputs);
          else if (callee.exits.some((e) => e.kind !== "ret" && e.kind !== "ret-cc")) {
            // --- The callee's own exits are not followed (a jump out, a stack trick): it may come back
            unknown(offset, `calls $${hex(branch.target!)}, whose return the pass cannot follow`);
            after = unknownState(state);
          }
        } else if (isEntry) {
          usedPending = true;
          after = unknownState(state);
        } else {
          unknown(offset, `calls $${hex(branch.address ?? 0)}, outside the page: its effects are not known`);
          after = unknownState(state);
        }
        const notTaken = branch.condition ? refine(state, branch.condition, false) : undefined;
        const result = after && notTaken ? join(after, notTaken, () => unknown(offset, "the call changes the stack depth")) : after ?? notTaken;
        if (result) flowTo(next, result, row);
        break;
      }
      case "ret": {
        const taken = branch.condition ? refine(state, branch.condition, true) : state;
        if (taken.lost) {
          // --- Not a return to the caller: the stack was switched or the return address taken
          exit({ offset, kind: "unknown", known: {} }, unknownState(taken));
        } else if (taken.stack.length) {
          unknown(offset, `returns with ${taken.stack.length} byte(s) still pushed: a computed jump, not a return`);
          exit({ offset, kind: "indirect", known: {} }, unknownState(taken));
        } else {
          exit({ offset, kind: branch.condition ? "ret-cc" : "ret", ...(branch.condition ? { condition: branch.condition } : {}), known: { ...taken.known } }, taken);
        }
        if (branch.condition) flowTo(next, refine(state, branch.condition, false), row);
        break;
      }
      case "jp-indirect":
        unknown(offset, `${row.text}: the target is not known statically`);
        exit({ offset, kind: "indirect", known: {} }, unknownState(state));
        break;
    }
  }
  if (work.length) unknown(entry, "the pass stopped: too many steps");

  const exits = [...exitsAt.values()];
  const returning = exits.filter((e) => e.fact.kind === "ret" || e.fact.kind === "ret-cc");
  const exitValues = {} as Record<Reg, Sym>;
  for (const reg of REGS) {
    const values = new Set(returning.map((e) => e.state.regs[reg]));
    exitValues[reg] = values.size === 1 ? [...values][0] : "?";
  }
  const returns = returning.length > 0;
  return {
    usedPending,
    facts: {
      entry,
      inputs: REGS.filter((r) => inputs.has(r)),
      changes: returns ? REGS.filter((r) => exitValues[r] !== r) : [],
      keeps: returns ? REGS.filter((r) => exitValues[r] === r) : [],
      moved: returns ? REGS.filter((r) => exitValues[r] !== r && exitValues[r] !== "?").map((r) => ({ reg: r, from: exitValues[r] as Reg })) : [],
      returns,
      exits: exits.map((e) => e.fact).sort((a, b) => a.offset - b.offset),
      unknowns: [...unknowns].map(([offset, reason]) => ({ offset, reason })).sort((a, b) => a.offset - b.offset)
    }
  };
}

/** One instruction's effect on the symbols, the stack and the known values. */
function transfer(input: State, row: DecodedRow, unknown: (reason: string) => void): State {
  const state = cloneState(input);
  const effects = row.effects;
  const regs = state.regs;
  const swap = (a: Reg, b: Reg) => {
    [regs[a], regs[b]] = [regs[b], regs[a]];
  };
  if (effects.swap === "af") {
    swap("A", "A'");
    swap("F", "F'");
    state.known = {};
  } else if (effects.swap === "exx") {
    for (const r of ["B", "C", "D", "E", "H", "L"] as const) swap(r, `${r}'` as Reg);
  } else if (effects.swap === "de-hl") {
    swap("D", "H");
    swap("E", "L");
  }

  const stack = effects.stack;
  if (stack?.op === "push") state.stack.push(regs[stack.pair[0]], regs[stack.pair[1]]);
  else if (stack?.op === "push-value") state.stack.push("?", "?");
  else if (stack?.op === "pop") {
    if (state.stack.length >= 2) {
      regs[stack.pair[1]] = state.stack.pop()!;
      regs[stack.pair[0]] = state.stack.pop()!;
    } else {
      unknown("POP below the routine's own pushes: it takes the caller's stack (the return address)");
      regs[stack.pair[0]] = "?";
      regs[stack.pair[1]] = "?";
      state.stack = [];
      state.lost = true;
    }
  } else if (stack?.op === "exchange") {
    if (state.stack.length >= 2) {
      const n = state.stack.length;
      [regs[stack.pair[0]], state.stack[n - 2]] = [state.stack[n - 2], regs[stack.pair[0]]];
      [regs[stack.pair[1]], state.stack[n - 1]] = [state.stack[n - 1], regs[stack.pair[1]]];
    } else {
      unknown("EX (SP) on the caller's stack (the return address)");
      regs[stack.pair[0]] = "?";
      regs[stack.pair[1]] = "?";
      state.lost = true;
    }
  }

  // --- A POP or EX (SP) has moved its symbols already; any other write makes a register unknown
  if (stack?.op !== "pop" && stack?.op !== "exchange") for (const reg of effects.writes) regs[reg] = "?";

  // --- Known values for the exit facts
  const writesF = effects.writes.includes("F");
  const writesA = effects.writes.includes("A");
  const known = effects.known;
  if (known?.carryToggles) state.known.carry = state.known.carry === undefined ? undefined : state.known.carry === 1 ? 0 : 1;
  else if (writesF) {
    state.known.carry = known?.carry;
    state.known.zero = known?.zero;
  }
  if (writesA) state.known.a = known?.a;
  if (stack?.op === "pop" && stack.pair[0] === "A") state.known = {};
  return state;
}

/** The state after a call, from the callee's summary; the callee's inputs become the caller's. */
function applyCallee(state: State, callee: RegisterFacts, inputs: Set<Reg>): State {
  for (const reg of callee.inputs) {
    const sym = state.regs[reg];
    if (sym !== "?") inputs.add(sym);
  }
  const after = cloneState(state);
  const moved = new Map(callee.moved.map((m) => [m.reg, m.from]));
  for (const reg of REGS) {
    if (callee.keeps.includes(reg)) after.regs[reg] = state.regs[reg];
    else if (moved.has(reg)) after.regs[reg] = state.regs[moved.get(reg)!];
    else after.regs[reg] = "?";
  }
  after.known = {};
  return after;
}

/** The state on the side of a condition that is `taken` (true) or not. */
function refine(state: State, condition: DisassemblyBranchCondition, taken: boolean): State {
  const result = cloneState(state);
  const holds = (flag: 0 | 1) => (taken ? flag : ((1 - flag) as 0 | 1));
  if (condition === "c") result.known.carry = holds(1);
  if (condition === "nc") result.known.carry = holds(0);
  if (condition === "z") result.known.zero = holds(1);
  if (condition === "nz") result.known.zero = holds(0);
  return result;
}

function join(a: State, b: State, depthMismatch: () => void): State {
  const regs = {} as Record<Reg, Sym>;
  for (const reg of REGS) regs[reg] = a.regs[reg] === b.regs[reg] ? a.regs[reg] : "?";
  let stack: Sym[];
  if (a.stack.length !== b.stack.length) {
    depthMismatch();
    stack = a.stack.length < b.stack.length ? [...a.stack] : [...b.stack];
  } else stack = a.stack.map((s, i) => (s === b.stack[i] ? s : "?"));
  const known: Known = {};
  if (a.known.carry === b.known.carry && a.known.carry !== undefined) known.carry = a.known.carry;
  if (a.known.zero === b.known.zero && a.known.zero !== undefined) known.zero = a.known.zero;
  if (a.known.a === b.known.a && a.known.a !== undefined) known.a = a.known.a;
  return { regs, stack, known, ...(a.lost || b.lost ? { lost: true } : {}) };
}

function sameState(a: State, b: State): boolean {
  if (a.stack.length !== b.stack.length) return false;
  for (const reg of REGS) if (a.regs[reg] !== b.regs[reg]) return false;
  for (let i = 0; i < a.stack.length; i++) if (a.stack[i] !== b.stack[i]) return false;
  return a.known.carry === b.known.carry && a.known.zero === b.known.zero && a.known.a === b.known.a && !a.lost === !b.lost;
}

function hex(value: number): string {
  return value.toString(16).padStart(4, "0").toUpperCase();
}
