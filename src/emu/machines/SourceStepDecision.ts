import type { CallableDebugInfo, SourceLevelDebugInfo, StatementDebugInfo } from "@abstractions/CompilerInfo";
import type { CallableFrameInfo, CallSiteDebugInfo, SourceActivationInfo, SourceReturnRegisters } from "@abstractions/SourceDebugInfo";

/**
 * Source-level stepping (plan `.plans/ZXBASIC_COMPILER_PLAN.md` §10.2, §10.3): steps one statement
 * at a time, over and out of calls, using a compiler's `SourceLevelDebugInfo` and its extensions.
 *
 * Everything here is a plain function over plain data, so it runs the same in every machine and is
 * testable without one. `shouldStopAtDebugPoint` (`DebugStepDecision.ts`) calls
 * `shouldStopAtSourceStep` after each instruction while a source step is in progress; breakpoints
 * are checked before it and always win.
 *
 * **Activations, not routines.** Stepping over and out is about activations — one execution of the
 * main program, of a SUB or FUNCTION, or of a GOSUB subroutine — located on the stack by the frame
 * locator (`locateActivations`, §10.2.2). The compiler guarantees what makes that possible: the
 * same SP at every statement entry of an activation (G4), every user call a recorded call site
 * (G5), results in registers at the `ret` (G6).
 *
 * **Cheap per instruction.** Most instructions are neither a statement entry nor a call's return
 * address, and for those the decision is two map lookups; SP is read only when one matches.
 */

// =================================================================================================
// The debug-info index

/** A machine as the frame locator reads it: registers and memory at the moment of the question. */
export type MachineView = {
  pc: number;
  sp: number;
  ix: number;
  readWord: (address: number) => number;
  /** Interrupt handlers running now (§10.2.7): a step begun inside one may stop in it. */
  interruptDepth?: number;
};

/**
 * The lookups a source step needs, built once per debug-info version: statement entries, the
 * statement at any address, call sites by return address, and the callable at any address.
 */
export class SourceDebugIndex {
  readonly statements: StatementDebugInfo[];
  readonly callables: CallableDebugInfo[];
  readonly frames: CallableFrameInfo[];
  readonly mainIndex: number;
  readonly mainBaselineSymbol: number;
  private readonly entries = new Map<number, number>();
  private readonly returnSites = new Map<number, CallSiteDebugInfo>();
  private readonly mapStarts: number[];
  private readonly mapStatements: number[];
  private readonly callableRanges: { start: number; end: number; index: number }[];

  constructor(readonly info: SourceLevelDebugInfo) {
    this.statements = info.statements;
    this.callables = info.callables;
    const ext = info.extensions;
    this.frames = ext?.frames ?? [];
    this.mainIndex = Math.max(
      0,
      info.callables.findIndex((c) => c.kind === "entrypoint")
    );
    this.mainBaselineSymbol = ext?.mainBaselineSymbol ?? 0;
    for (const s of info.statements) {
      if (s.endAddress > s.startAddress) this.entries.set(s.startAddress, s.index);
    }
    for (const site of ext?.callSites ?? []) this.returnSites.set(site.returnAddress, site);
    this.mapStarts = info.addressToStatement.map(([a]) => a);
    this.mapStatements = info.addressToStatement.map(([, s]) => s);
    this.callableRanges = this.frames
      .map((f) => ({ start: f.startAddress, end: f.endAddress, index: f.callableIndex }))
      .sort((a, b) => a.start - b.start);
  }

  /** The statement whose entry is `address`, or -1. */
  entryAt(address: number): number {
    return this.entries.get(address) ?? -1;
  }

  /** The call site whose return address is `address`, if any. */
  returnSiteAt(address: number): CallSiteDebugInfo | undefined {
    return this.returnSites.get(address);
  }

  /** The statement whose code holds `address`, or -1 (runtime, glue). */
  statementAt(address: number): number {
    let lo = 0;
    let hi = this.mapStarts.length - 1;
    let found = -1;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      if (this.mapStarts[mid] <= address) {
        found = mid;
        lo = mid + 1;
      } else hi = mid - 1;
    }
    return found < 0 ? -1 : this.mapStatements[found];
  }

  /** The callable whose code (prologue and epilogue included) holds `address`, if any. */
  callableAt(address: number): number | undefined {
    for (const r of this.callableRanges) {
      if (address >= r.start && address < r.end) return r.index;
    }
    return undefined;
  }

  /** The main program's baseline SP, as the running program's prologue stored it. */
  mainBaseline(m: MachineView): number {
    return m.readWord(this.mainBaselineSymbol);
  }
}

// =================================================================================================
// The frame locator (§10.2.2)

/**
 * One activation on the stack. `baseline` is SP at each of its statement entries; `returnSlot` the
 * address of the word holding its return address (absent for the main program).
 */
export type Activation = SourceActivationInfo;

/**
 * The activation chain, innermost first and the main program last. Works from anywhere: a statement
 * entry, the middle of a statement, a prologue, the runtime. Method (§10.2.2): the innermost
 * callable from PC (or, in runtime code, from IX); a routine's return slot at IX + 2 while its frame
 * is up, otherwise the first stack word that is a call of it; the caller's IX from the saved-IX
 * word under the return address; GOSUB return addresses between an activation's stack top and its
 * baseline.
 */
export function locateActivations(index: SourceDebugIndex, m: MachineView): Activation[] {
  const out: Activation[] = [];
  const main = index.mainIndex;
  const mainBaseline = index.mainBaseline(m);
  const siteAt = (address: number) => index.returnSiteAt(m.readWord(address));
  const isRoutineSite = (site: CallSiteDebugInfo | undefined, callee?: number) =>
    !!site &&
    (site.kind === "sub" || site.kind === "function") &&
    site.calleeIndex !== undefined &&
    (callee === undefined || site.calleeIndex === callee);
  const inStack = (address: number) => address >= m.sp && address < mainBaseline;

  // --- The innermost callable, and its frame pointer when its frame is certainly up
  let callable = index.callableAt(m.pc);
  let ix: number | undefined;
  if (callable !== undefined && callable !== main) {
    const f = index.frames[callable];
    if (f && m.pc >= f.bodyStart && m.pc <= f.epilogueStart && isRoutineSite(siteAt(m.ix + 2), callable)) ix = m.ix;
  } else if (callable === undefined) {
    // --- Runtime or ROM code: the routine it was called from still has IX; else the main program
    const site = inStack(m.ix + 2) ? siteAt(m.ix + 2) : undefined;
    if (isRoutineSite(site)) {
      callable = site!.calleeIndex!;
      ix = m.ix;
    } else callable = main;
  }

  // --- GOSUB activations of `c` in [from, to): innermost (lowest address) first
  const gosubs = (from: number, to: number, c: number) => {
    for (let p = from; p < to; p += 2) {
      const site = siteAt(p);
      if (site && (site.kind === "gosub" || site.kind === "on-gosub") && site.callerIndex === c) {
        out.push({ callableIndex: c, kind: "gosub", baseline: p, returnSlot: p, callSite: site });
      }
    }
  };

  let low = m.sp;
  for (let guard = 0; guard < 1024; guard++) {
    if (callable === main || callable === undefined) break;
    const f = index.frames[callable];
    let slot: number | undefined;
    if (ix !== undefined && isRoutineSite(siteAt(ix + 2), callable)) slot = ix + 2;
    else {
      for (let p = low; p < mainBaseline; p += 2) {
        if (isRoutineSite(siteAt(p), callable)) {
          slot = p;
          break;
        }
      }
    }
    if (slot === undefined || !f || f.convention !== "frame") break;
    const baseline = slot - (f.returnSlotOffset ?? 2);
    gosubs(low, baseline, callable);
    const site = siteAt(slot)!;
    out.push({ callableIndex: callable, kind: "routine", baseline, returnSlot: slot, callSite: site, ix: slot - 2 });
    const caller = site.callerIndex;
    const callerFrame = index.frames[caller];
    ix = callerFrame?.convention === "frame" ? m.readWord(slot - 2) : undefined;
    low = slot + 2 + (f.argBytes ?? 0);
    callable = caller;
  }
  gosubs(low, mainBaseline, main);
  out.push({ callableIndex: main, kind: "main", baseline: mainBaseline });
  return out;
}

/**
 * Follows the running statement through a debug run: the last statement entry passed, or the
 * statement a call returned into. It answers "which statement was running" where the stack cannot:
 * a runtime error raised by a `jp` from the statement itself (`ERROR n`), or from a runtime routine
 * that keeps its return address off the stack (`ArrayAddress`). Two map lookups per instruction.
 */
export class CurrentStatementTracker {
  current = -1;

  constructor(private readonly index: SourceDebugIndex) {}

  observe(pc: number): void {
    const entry = this.index.entryAt(pc);
    if (entry >= 0) {
      this.current = entry;
      return;
    }
    const site = this.index.returnSiteAt(pc);
    if (site && site.statementIndex >= 0) this.current = site.statementIndex;
  }
}

/** The ROM's reports by ERR_NR (the report's number or letter, less one): what an error stop names. */
const REPORTS = [
  "0 OK",
  "1 NEXT without FOR",
  "2 Variable not found",
  "3 Subscript wrong",
  "4 Out of memory",
  "5 Out of screen",
  "6 Number too big",
  "7 RETURN without GOSUB",
  "8 End of file",
  "9 STOP statement",
  "A Invalid argument",
  "B Integer out of range",
  "C Nonsense in BASIC",
  "D BREAK - CONT repeats",
  "E Out of DATA",
  "F Invalid file name",
  "G No room for line",
  "H STOP in INPUT",
  "I FOR without NEXT",
  "J Invalid I/O device",
  "K Invalid colour",
  "L BREAK into program",
  "M RAMTOP no good",
  "N Statement lost",
  "O Invalid stream",
  "P FN without DEF",
  "Q Parameter error",
  "R Tape loading error"
];

/** The report text of an ERR_NR code (runtime `RaiseError`: A = the code). */
export function basicErrorReport(code: number): string {
  return REPORTS[code + 1] ?? `Error ${code}`;
}

/**
 * The user statement that is running when PC is in runtime code (a runtime error, a Z80-level step
 * into a routine): the first stack word above SP that returns into the middle of a statement — the
 * return address of the statement's call into the runtime. -1 when there is none.
 */
export function innermostUserStatement(index: SourceDebugIndex, m: MachineView): number {
  const here = index.statementAt(m.pc);
  if (here >= 0) return here;
  const limit = index.mainBaseline(m);
  for (let p = m.sp, n = 0; p < limit && n < 256; p += 2, n++) {
    const w = m.readWord(p);
    const s = index.statementAt(w);
    if (s >= 0 && w > index.statements[s].startAddress) return s;
  }
  return -1;
}

// =================================================================================================
// The step

export type SourceStepKind =
  /** Stop at the next statement entry at any depth (§10.2.4). */
  | "into"
  /** Stop at the next statement entry of this activation or an outer one (§10.2.3). */
  | "over"
  /** Stop at the return point in the caller (§10.2.5). */
  | "out"
  /** Stop at the next statement entry on another line, or on this line's first statement again (§10.3). */
  | "overLine"
  /** Stop when the activation just inside the chosen frame has returned (§10.2.5, Run to Frame). */
  | "runToFrame"
  /** Stop at the chosen callable's first statement in a deeper activation (§10.2.4, Step Into Target). */
  | "intoTarget";

/** The registers a returned value is decoded from (G6). */
export type ReturnRegisters = SourceReturnRegisters;

export type ReturnedValue = { callableIndex: number; registers: ReturnRegisters };

/** Why a source step stopped; the IDE shows return points differently from statement entries. */
export type SourceStopKind = "statement" | "returnPoint";

export type SourceStep = {
  kind: SourceStepKind;
  index: SourceDebugIndex;
  /** The activation chain when the step began. */
  chain: Activation[];
  /** The reference activation: an index into `chain` (it moves outward as activations return). */
  level: number;
  /** runToFrame: stop once `chain[targetLevel - 1]` has returned (Step Out is 1). */
  targetLevel: number;
  /** overLine: the line the step began on, and that line's first statement. */
  startFile: number;
  startLine: number;
  lineFirstStatement: number;
  /** intoTarget: the callable to stop in. */
  targetCallable?: number;
  /** Statement entries inside interrupt handlers stop too (the setting of §10.2.7; off by default). */
  stopInInterrupts?: boolean;
  /** Interrupt handlers running when the step began: only deeper ones are outside the step. */
  baseInterruptDepth: number;
  /** FUNCTION results seen returning during the step (§10.2.6). */
  returned: ReturnedValue[];
  /**
   * The step began at a return point whose address is also the next statement's entry (a call was
   * the last thing its statement did): that statement has not run yet, so the step stops on it at
   * once instead of running it unseen.
   */
  stopAtStart?: boolean;
  /** How the step ended, once it has. */
  stoppedAt?: SourceStopKind;
  /** Where it ended: PC, and the statement to show (for a return point, the calling statement). */
  stopPc?: number;
  stopStatement?: number;
};

/**
 * Starts a source step at the machine's current state. `targetFrame` is the frame to run to (Run to
 * Frame: 1 is the caller, as Step Out); `targetCallable` the routine for Step Into Target.
 */
export function beginSourceStep(
  index: SourceDebugIndex,
  m: MachineView,
  kind: SourceStepKind,
  options: { targetFrame?: number; targetCallable?: number; previous?: SourceStep; stopInInterrupts?: boolean } = {}
): SourceStep {
  const chain = locateActivations(index, m);
  const { previous } = options;
  const stopAtStart =
    previous?.stoppedAt === "returnPoint" &&
    previous.stopPc === m.pc &&
    index.entryAt(m.pc) >= 0 &&
    (kind === "into" || kind === "over" || kind === "overLine");
  const statement = index.statementAt(m.pc);
  const s = statement >= 0 ? index.statements[statement] : undefined;
  const lineFirstStatement = s
    ? (index.statements.find((x) => x.fileIndex === s.fileIndex && x.startLine === s.startLine && x.callableIndex === s.callableIndex)?.index ?? s.index)
    : -1;
  return {
    kind,
    index,
    chain,
    level: 0,
    targetLevel: kind === "out" ? 1 : kind === "runToFrame" ? Math.max(1, options.targetFrame ?? 1) : 0,
    startFile: s?.fileIndex ?? -1,
    startLine: s?.startLine ?? -1,
    lineFirstStatement,
    ...(options.targetCallable !== undefined ? { targetCallable: options.targetCallable } : {}),
    returned: [],
    baseInterruptDepth: m.interruptDepth ?? 0,
    ...(stopAtStart ? { stopAtStart } : {}),
    ...(options.stopInInterrupts ? { stopInInterrupts: true } : {})
  };
}

/** Whether a step of this kind can start here: Step Out needs something to return to. */
export function canStepOut(chain: Activation[]): boolean {
  return chain.length > 1;
}

export type SourceStepInput = {
  pc: number;
  /** Instructions executed so far in this step: a step never stops before its first one. */
  instructionsExecuted: number;
  getSp: () => number;
  getRegisters?: () => ReturnRegisters;
  /** How many interrupt handlers are running (§10.2.7). */
  getInterruptDepth?: () => number;
};

/**
 * Decides, after an instruction, whether a source step has arrived (§10.2.3–§10.2.5, §10.3).
 * Updates the step: its reference activation as activations return, the returned values seen, and
 * `stoppedAt` when it stops.
 */
export function shouldStopAtSourceStep(step: SourceStep, input: SourceStepInput): boolean {
  const { index } = step;
  const entry = index.entryAt(input.pc);
  if (input.instructionsExecuted === 0) {
    return step.stopAtStart === true && entry >= 0 ? stop(step, "statement", input.pc, entry) : false;
  }
  const site = index.returnSiteAt(input.pc);
  if (entry < 0 && !site) return false;
  // --- An interrupt handler runs outside the step: its statements and returns are not the step's
  if (!step.stopInInterrupts && (input.getInterruptDepth?.() ?? 0) > step.baseInterruptDepth) return false;
  const sp = input.getSp();
  // --- A return point shows the calling statement (PC may already be the next one's entry)
  const returnPoint = () => stop(step, "returnPoint", input.pc, site && site.statementIndex >= 0 ? site.statementIndex : index.statementAt(input.pc));

  // --- Activations that have returned: SP is above their return slot, and PC is back in user code
  // --- (the return address of the call that made them)
  if (site) {
    let returned = false;
    while (step.level < step.chain.length - 1) {
      const a = step.chain[step.level];
      if (a.returnSlot === undefined || sp <= a.returnSlot) break;
      if (a.kind === "routine" && index.frames[a.callableIndex]?.returnType && input.getRegisters) {
        step.returned.push({ callableIndex: a.callableIndex, registers: input.getRegisters() });
      }
      step.level++;
      returned = true;
    }
    if (returned) {
      if ((step.kind === "out" || step.kind === "runToFrame") && step.level >= step.targetLevel) return returnPoint();
      // --- Stop where the caller's statement makes more calls, so the user can step into them
      if ((step.kind === "over" || step.kind === "into") && site.moreCallsFollow) return returnPoint();
      // --- Otherwise on: the return address may also be the next statement's entry (below)
    }
  }

  if (entry < 0) return false;
  const ref = step.chain[step.level];
  switch (step.kind) {
    case "into":
      return stop(step, "statement", input.pc, entry);
    case "over":
      // --- Entries below the baseline belong to callees (and deeper recursion): run through them
      return sp >= ref.baseline ? stop(step, "statement", input.pc, entry) : false;
    case "overLine": {
      if (sp < ref.baseline) return false;
      const s = index.statements[entry];
      const sameLine = s.fileIndex === step.startFile && s.startLine === step.startLine && step.level === 0;
      return !sameLine || entry === step.lineFirstStatement ? stop(step, "statement", input.pc, entry) : false;
    }
    case "intoTarget": {
      const target = step.targetCallable;
      if (target !== undefined && sp < ref.baseline && entry === index.callables[target]?.firstStatementIndex) return stop(step, "statement", input.pc, entry);
      // --- The target was never called: the statement is over
      return sp >= ref.baseline ? stop(step, "statement", input.pc, entry) : false;
    }
    case "out":
    case "runToFrame": {
      // --- An entry past the target's return (it returned without passing a call site): stop anyway
      const target = step.chain[Math.min(step.targetLevel, step.chain.length) - 1];
      return target?.returnSlot !== undefined && sp > target.returnSlot ? stop(step, "statement", input.pc, entry) : false;
    }
  }
}

function stop(step: SourceStep, kind: SourceStopKind, pc: number, statement: number): boolean {
  step.stoppedAt = kind;
  step.stopPc = pc;
  step.stopStatement = statement;
  return true;
}
