import type { BreakpointInfo } from "@abstractions/BreakpointInfo";

import type { ConditionSymbols } from "@common/utils/breakpoint-condition/condition-types";
import { DebugStepMode } from "@emu/abstractions/DebugStepMode";
import { DebugSupport } from "@emu/machines/DebugSupport";
import { connectConditionSupport } from "@emu/machines/conditionStore";
import { FrameTerminationMode } from "@emu/abstractions/FrameTerminationMode";
import type { FrameMachine } from "./frameRunner";

/*
 * Runs a headless machine until a stop condition (`.plans/COMMAND_LINE_AUTOMATION_PLAN.md` D15): a
 * number of frames or T-states, an execution address, a dead HALT, a breakpoint, or the emulated-time
 * budget. Everything is counted in emulated time, so a run stops at the same instruction on every
 * computer (T10).
 *
 * Breakpoints (`--bp`, `--until-pc`) are the emulator's own: a `DebugSupport` the caller attached to
 * the machine, evaluated in the core with their conditions and hit rules. A T-state target is exact:
 * whole frames run while a frame fits before it, then single instructions, so the run stops at the
 * first instruction boundary at or after the target; breakpoints are still honoured while stepping.
 */

/** The breakpoint store the loop reads (the emulator's `DebugSupport`) */
export type StopDebugSupport = {
  lastStopBreakpoints: BreakpointInfo[];
  consumeFiredOneShots(): number;
  clearFiredBreakpoints(): void;
  takeLogLines(): { lines: { text: string; group?: string }[]; dropped: number };
};

/** The machine the loop drives */
export type StopMachine = FrameMachine & {
  readonly tacts: number;
  readonly tactsInFrame: number;
  readonly halted: boolean;
  readonly iff1: boolean;
  executionContext: FrameMachine["executionContext"] & {
    debugStepMode: DebugStepMode;
    debugSupport?: unknown;
  };
};

/** When a run stops; at least one of the limits should be set, or it runs until a breakpoint */
export type StopConditions = {
  /** Completed frames */
  frames?: number;
  /** T-states */
  tstates?: number;
  /** Execution addresses: the run stops before the instruction there executes */
  untilPc?: number[];
  /** A HALT with interrupts disabled: the program has ended */
  untilHalt?: boolean;
  /** The budget in T-states; reaching it is a timeout */
  timeoutTstates?: number;
};

export type StopReason = "frames" | "tstates" | "pc" | "halt" | "breakpoint" | "timeout";

/** Why and where a run stopped */
export type RunStop = {
  reason: StopReason;
  pc: number;
  /** Frames completed during the run */
  frames: number;
  /** T-states the run took */
  tstates: number;
  /** The breakpoints that stopped it (`breakpoint`), as the store recorded them */
  breakpoints: BreakpointInfo[];
};

/**
 * Attaches the emulator's breakpoint store to a machine with the run's breakpoints: the user's, and
 * one per `untilPc` address (owned by the session, so a stop there reads as `pc`). Conditions are
 * evaluated in the core against this machine, as in the IDE. Every breakpoint takes the store's slow
 * path (a hit rule that always passes, when it has none), which records what fired: the loop needs
 * that to tell a breakpoint from a single step while it steps to a T-state target.
 * @returns The store, or `undefined` when there is nothing to stop at
 */
export function attachRunBreakpoints(
  machine: StopMachine,
  breakpoints: BreakpointInfo[],
  untilPc: number[] = [],
  symbols?: ConditionSymbols
): DebugSupport | undefined {
  if (!breakpoints.length && !untilPc.length) {
    machine.executionContext.debugSupport = undefined;
    return undefined;
  }
  const ds = new DebugSupport(undefined, []);
  connectConditionSupport(ds, machine as never);
  machine.executionContext.debugSupport = ds;
  if (symbols) ds.setConditionSymbols(symbols);
  const recorded = (bp: BreakpointInfo): BreakpointInfo =>
    bp.hitMode === undefined ? { ...bp, hitMode: "ge", hitCount: 1 } : bp;
  for (const bp of breakpoints) ds.addBreakpoint(recorded(bp));
  for (const address of untilPc) {
    ds.addBreakpoint(recorded({ address: address & 0xffff, exec: true, owner: { kind: "session" } }));
  }
  return ds;
}

/**
 * Runs until a stop condition
 * @param machine The machine, with the run's breakpoints attached (`attachRunBreakpoints`) when it
 * has any; `untilPc` needs them too
 * @param conditions When to stop
 * @param options `onLog` receives logpoint lines
 */
export function runToStop(
  machine: StopMachine,
  conditions: StopConditions,
  options: { onLog?: (line: string) => void } = {}
): RunStop {
  const ctx = machine.executionContext;
  const ds = ctx.debugSupport as StopDebugSupport | undefined;
  const untilPc = new Set((conditions.untilPc ?? []).map((a) => a & 0xffff));
  const start = machine.tacts;
  const elapsed = () => (machine.tacts - start) >>> 0;
  let frames = 0;
  const stop = (reason: StopReason, breakpoints: BreakpointInfo[] = []): RunStop => ({
    reason,
    pc: machine.pc,
    frames,
    tstates: elapsed(),
    breakpoints
  });
  const drainLog = () => {
    if (!ds || !options.onLog) return;
    const { lines, dropped } = ds.takeLogLines();
    for (const line of lines) {
      options.onLog(line.group && line.group !== "DEFAULT" ? `[${line.group}] ${line.text}` : line.text);
    }
    if (dropped) options.onLog(`(${dropped} log lines dropped)`);
  };
  // --- The nearest T-state limit: the target or the budget, whichever comes first
  const limit = Math.min(conditions.tstates ?? Infinity, conditions.timeoutTstates ?? Infinity);
  const limitReason = (): StopReason =>
    conditions.tstates !== undefined && elapsed() >= conditions.tstates ? "tstates" : "timeout";
  /** A debug stop: the run's own address, or a breakpoint */
  const debugStop = (): RunStop | undefined => {
    if (!ds) return untilPc.has(machine.pc) ? stop("pc") : undefined;
    ds.consumeFiredOneShots();
    const fired = ds.lastStopBreakpoints ?? [];
    ds.clearFiredBreakpoints();
    if (untilPc.has(machine.pc) && fired.every((bp) => bp.owner?.kind === "session")) return stop("pc");
    return stop("breakpoint", fired.filter((bp) => bp.owner?.kind !== "session"));
  };

  ctx.frameTerminationMode = FrameTerminationMode.Normal;
  ctx.terminationPoint = undefined;
  // --- Always the debug loop, as the unit-test runner does: the fast path (no debug mode) mirrors only
  // --- the frame counters into the machine object, so `halted`, `iff1`, `iff2` and the interrupt mode
  // --- - the dead-HALT test and the registers the run reports - would be stale
  ctx.debugStepMode = DebugStepMode.StopAtBreakpoint;
  ds?.clearFiredBreakpoints();
  try {
    // --- A dead HALT or the run's address before anything runs
    if (conditions.untilHalt && machine.halted && !machine.iff1) return stop("halt");
    if (conditions.frames === 0 || limit === 0) return stop(conditions.frames === 0 ? "frames" : limitReason());

    while (true) {
      // --- Close to a T-state limit: one instruction at a time, to stop exactly at it
      const stepping = limit !== Infinity && elapsed() + machine.tactsInFrame > limit;
      if (stepping) {
        ctx.debugStepMode = DebugStepMode.StepInto;
        ds?.clearFiredBreakpoints();
        const pcBefore = machine.pc;
        machine.executeMachineFrame();
        drainLog();
        if (machine.frameJustCompleted) frames++;
        const fired = ds ? (ds.consumeFiredOneShots(), ds.lastStopBreakpoints ?? []) : [];
        if (fired.length) {
          ds!.clearFiredBreakpoints();
          if (untilPc.has(machine.pc) && fired.every((bp) => bp.owner?.kind === "session")) return stop("pc");
          return stop("breakpoint", fired.filter((bp) => bp.owner?.kind !== "session"));
        }
        if (untilPc.has(machine.pc) && machine.pc !== pcBefore) return stop("pc");
      } else {
        const termination = machine.executeMachineFrame();
        drainLog();
        if (machine.frameJustCompleted) frames++;
        if (termination === FrameTerminationMode.DebugEvent) {
          const debug = debugStop();
          if (debug) return debug;
        }
      }
      if (conditions.untilHalt && machine.halted && !machine.iff1) return stop("halt");
      if (elapsed() >= limit) return stop(limitReason());
      if (conditions.frames !== undefined && frames >= conditions.frames) return stop("frames");
    }
  } finally {
    ctx.debugStepMode = DebugStepMode.NoDebug;
  }
}
