import type { BreakpointInfo } from "@abstractions/BreakpointInfo";
import type { CodeInjectionFlow } from "@emu/abstractions/CodeInjectionFlow";
import type { MachineStateParts } from "@emu/machines/state/wasmStateImage";
import type { UnitTestCase, UnitTestLabels, UnitTestProgram, DiscoverableOutput } from "@common/unit-tests/discovery";
import type {
  UnitTestCoverage,
  UnitTestErrorKind,
  UnitTestEvent,
  UnitTestResult,
  UnitTestRunOptions,
  UnitTestSummary
} from "@common/unit-tests/unitTestTypes";

import { MI_ZXNEXT } from "@common/machines/constants";
import { DebugStepMode } from "@emu/abstractions/DebugStepMode";
import { FrameTerminationMode } from "@emu/abstractions/FrameTerminationMode";
import { DebugSupport } from "@emu/machines/DebugSupport";
import { connectConditionSupport } from "@emu/machines/conditionStore";
import { commentStopLines } from "@emu/machines/commentStopReport";
import { writeCodeSegments } from "@emu/machines/writeCodeSegments";
import { isAccessProfileSource } from "@emu/abstractions/IAccessProfileSource";
import { annotationBreakpoints } from "@common/utils/source-annotations";
import { integerSymbolsOfOutput } from "@common/utils/breakpoint-condition/integer-symbols";
import { resolvedPartitionFor } from "@common/utils/source-breakpoint-partition";
import { selectTests } from "@common/unit-tests/unitTestTypes";
import {
  testRunGuards,
  unitTestGuard,
  unitTestGuardPurpose,
  unitTestStopMessage
} from "@common/unit-tests/unitTestGuards";

/*
 * The unit-test runner (`.plans/Z80_UNIT_TESTS_PLAN.md` D3, D6-D11, D20, §4.2).
 *
 * Pure TypeScript, no Electron: it gets a machine that is set up (`HeadlessMachineFactory`), a
 * compilation and its discovered tests, and streams `UnitTestEvent`s. It builds the base state once
 * - reset, optionally boot to the ROM's main loop, load every segment, capture the core's image -
 * and runs each test from it:
 *
 *   1. restore the base state;
 *   2. run the init code: push the wrapper's address as a return address, start at UNITTEST_START,
 *      run until the init code returns to the wrapper;
 *   3. write the test's address into the CALL at UNITTEST_CALL_ADDR;
 *   4. run the wrapper until an outcome.
 *
 * Every stop is a breakpoint evaluated in the core (T8): the success loop, the return of a test that
 * used RET, the stack guards (owner `unitTest`) and the program's DeZog comments (owner
 * `annotation`, D11). The budget is emulated T-states (D10), so a result and its T-states are the
 * same on every computer (D20).
 */

/** The machine the runner drives: the parts of a `*WasmV2Machine` it uses */
export type RunnerMachine = {
  readonly machineId: string;
  pc: number;
  sp: number;
  readonly tacts: number;
  readonly baseClockFrequency: number;
  readonly clockMultiplier: number;
  halted: boolean;
  readonly iff1: boolean;
  readonly frameJustCompleted: boolean;
  executionContext: {
    debugStepMode: DebugStepMode;
    frameTerminationMode: FrameTerminationMode;
    terminationPoint?: number;
    terminationPartition?: number;
    debugSupport?: unknown;
  };
  executeMachineFrame(): FrameTerminationMode;
  doReadMemory(address: number): number;
  doWriteMemory(address: number, value: number): void;
  getMemoryPartition(index: number): Uint8Array;
  saveMachineState(): MachineStateParts;
  loadMachineState(parts: MachineStateParts): void;
  getCodeInjectionFlow?(model: string): Promise<CodeInjectionFlow>;
  queueKeystroke?(frameOffset: number, frames: number, primary: number, secondary?: number, ternary?: number): void;
  getKeyQueueLength?(): number;
};

/** What a run needs */
export type UnitTestRunInput = {
  /** The discovered tests and labels (`discoverUnitTests`) */
  program: UnitTestProgram;
  /** The compilation the tests came from: segments, symbols, annotations */
  compilation: DiscoverableOutput & {
    segments: { bank?: number; bankOffset?: number; startAddress: number; emittedCode: number[] }[];
    debugAnnotations?: unknown[];
  };
  /** The machine, set up and reset */
  machine: RunnerMachine;
  /** The injection-flow model to boot (`sp48` on a 128K runs 48 BASIC); the machine's own when absent */
  bootModel?: string;
  options?: UnitTestRunOptions;
};

/**
 * The injection-flow model a compilation boots (D7): 48 BASIC for a `.model Spectrum48` program,
 * the machine's own flow otherwise, as the IDE's run does
 * @param machineId The machine
 * @param modelType The compilation's `SpectrumModelType` (`Spectrum48` is 1)
 */
export function bootModelFor(machineId: string, modelType: number | undefined): string {
  return modelType === 1 && machineId !== MI_ZXNEXT ? "sp48" : machineId;
}

/** The frames one injection-flow `ReachExecPoint` may take before the boot is given up */
const BOOT_MAX_FRAMES = 600;

/** How the outcome of a run segment came out */
type Stop =
  | { kind: "breakpoint"; pc: number; fired: BreakpointInfo[] }
  | { kind: "timeout" }
  | { kind: "halt" }
  | { kind: "cancelled" };

/**
 * Runs the tests and streams their events; resolves with the summary
 * @param input The tests, the compilation and the machine
 * @param onEvent Receives every event, in order
 * @param signal Cancels the run between tests (and within a test, at a frame boundary)
 */
export async function runUnitTests(
  input: UnitTestRunInput,
  onEvent: (event: UnitTestEvent) => void,
  signal?: { readonly aborted: boolean }
): Promise<UnitTestSummary> {
  const { program, compilation, machine } = input;
  const options = input.options ?? {};
  const summary: UnitTestSummary = { total: 0, passed: 0, failed: 0, errors: 0 };
  const finish = (coverage?: UnitTestCoverage) => {
    onEvent({ kind: "finished", summary, ...(coverage ? { coverage } : {}) });
    return summary;
  };

  if (!program.labels) {
    for (const problem of program.problems) onEvent({ kind: "problem", message: problem });
    return finish();
  }
  const labels = program.labels;
  const tests = selectTests(program.tests, options);
  summary.total = tests.length;
  summary.clockHz = machine.baseClockFrequency * (machine.clockMultiplier || 1);
  if (!tests.length) return finish();

  const isNext = machine.machineId === MI_ZXNEXT;

  // --- The wrapper must be in RAM: the runner patches its CALL (T6)
  if (labels.callAddr.address < 0x4000 && labels.callAddr.partition === undefined && !isNext) {
    onEvent({ kind: "problem", message: "UNITTEST_CALL_ADDR is in ROM: the test wrapper must be in RAM." });
    return finish();
  }

  // ==============================================================================================
  // The base state (D7)

  try {
    if ((options.boot ?? "rom") === "rom" && machine.getCodeInjectionFlow) {
      await bootToInjectionPoint(machine, input.bootModel ?? machine.machineId);
    }
  } catch (err) {
    onEvent({ kind: "problem", message: `The machine did not boot to its ROM's main loop: ${messageOf(err)}` });
    return finish();
  }
  writeCodeSegments(machine, compilation.segments, isNext);
  // --- The wrapper's CALL must be a `CALL nn` whose operand the runner can patch
  if (readAt(machine, labels.callAddr) !== 0xcd) {
    onEvent({
      kind: "problem",
      message: `UNITTEST_CALL_ADDR ($${hex4(labels.callAddr.address)}) is not a CALL instruction; the runner patches its operand with each test's address.`
    });
    return finish();
  }
  const base = machine.saveMachineState();

  // --- The breakpoint store, as the emulator's: conditions are evaluated in the core
  const ds = new DebugSupport(undefined, []);
  connectConditionSupport(ds, machine as never);
  machine.executionContext.debugSupport = ds;
  ds.setConditionSymbols(integerSymbolsOfOutput(compilation));
  // --- Annotations are always on in a test run (D11), whatever the project's switches
  ds.resetBreakpointsTo(
    annotationBreakpoints(
      compilation as never,
      (filename) => filename,
      (annotation) => {
        const segment = annotation.segmentIndex === undefined ? undefined : compilation.segments[annotation.segmentIndex];
        return resolvedPartitionFor(segment, annotation.address, machine.machineId);
      }
    ),
    { kind: "annotation" }
  );

  // --- Coverage (D17): the profile is not part of a core's image, so it accumulates over the tests
  const profile = options.coverage && isAccessProfileSource(machine) ? machine : undefined;
  if (profile) {
    profile.resetProfile();
    profile.setProfiling(true, true);
  }

  const budget = Math.max(
    1,
    Math.round((options.timeoutSeconds ?? 1) * machine.baseClockFrequency * (machine.clockMultiplier || 1))
  );

  // ==============================================================================================
  // The tests (D3)

  let cancelled = false;
  for (const test of tests) {
    if (signal?.aborted) {
      cancelled = true;
      break;
    }
    onEvent({ kind: "started", id: test.id });
    const log: string[] = [];
    const drainLog = () => {
      const { lines, dropped } = ds.takeLogLines();
      for (const line of lines) {
        const text = line.group && line.group !== "DEFAULT" ? `[${line.group}] ${line.text}` : line.text;
        log.push(text);
        onEvent({ kind: "log", id: test.id, text });
      }
      if (dropped) log.push(`(${dropped} log lines dropped)`);
    };
    const result = runOneTest(machine, ds, base, labels, test, budget, drainLog, signal);
    if (result === "cancelled") {
      cancelled = true;
      break;
    }
    if (log.length) result.log = log;
    if (result.status === "passed") summary.passed++;
    else if (result.status === "failed") summary.failed++;
    else summary.errors++;
    onEvent({ kind: "result", result });
  }
  if (cancelled) summary.cancelled = true;

  let coverage: UnitTestCoverage | undefined;
  if (profile) {
    const info = profile.getProfileInfo();
    const bytes = profile.readProfileTouched() ?? [];
    profile.setProfiling(false, false);
    coverage = {
      profileMachineId: profile.profileMachineId,
      bytes,
      instructions: info?.instructions ?? 0,
      timeTotal: info?.timeTotal ?? 0
    };
  }
  // --- The machine is the runner's; leave it as a stopped debug session would
  machine.executionContext.debugStepMode = DebugStepMode.NoDebug;
  return finish(coverage);
}

/** Runs one test from the base state */
function runOneTest(
  machine: RunnerMachine,
  ds: DebugSupport,
  base: MachineStateParts,
  labels: UnitTestLabels,
  test: UnitTestCase,
  budget: number,
  drainLog: () => void,
  signal: { readonly aborted: boolean } | undefined
): UnitTestResult | "cancelled" {
  const error = (errorKind: UnitTestErrorKind, message: string, tstates = 0, location?: UnitTestResult["location"]): UnitTestResult => ({
    id: test.id,
    status: "error",
    errorKind,
    tstates,
    message,
    ...(location ? { location } : {})
  });

  // --- (1) The base state
  machine.loadMachineState(base);
  ds.lastBreakpoint = undefined;
  ds.lastDecisionPc = undefined;
  ds.clearFiredBreakpoints();

  // --- (2) The init code, called as a subroutine that returns to the wrapper
  if (labels.stackTop) machine.sp = labels.stackTop.address;
  const sp = (machine.sp - 2) & 0xffff;
  machine.doWriteMemory(sp, labels.wrapper.address & 0xff);
  machine.doWriteMemory((sp + 1) & 0xffff, (labels.wrapper.address >> 8) & 0xff);
  machine.sp = sp;
  machine.pc = labels.start.address;
  installGuards(ds, [unitTestGuard("init", labels.wrapper, { exec: true })]);
  const init = runUntilStop(machine, budget, drainLog, signal);
  if (init.stop.kind === "cancelled") return "cancelled";
  if (init.stop.kind !== "breakpoint" || init.stop.pc !== labels.wrapper.address || hasAnnotation(init.stop.fired)) {
    const reason =
      init.stop.kind === "timeout"
        ? "did not return within the time limit"
        : init.stop.kind === "halt"
          ? "halted with interrupts disabled"
          : (describeStop(ds, machine)?.message ?? `stopped at $${hex4(machine.pc)}`);
    return error("setup", `The initialisation code after UNITTEST_INITIALIZE ${reason}.`, 0, describeStop(ds, machine)?.location);
  }

  // --- (3) The test's address into the CALL
  writeWord(machine, labels.callAddr, 1, test.address);

  // --- (4) The wrapper, until an outcome
  const guards = testRunGuards(labels);
  installGuards(ds, guards);
  machine.pc = labels.wrapper.address;
  ds.lastBreakpoint = undefined;
  ds.clearFiredBreakpoints();
  const run = runUntilStop(machine, budget, drainLog, signal);
  const tstates = run.tstates;
  switch (run.stop.kind) {
    case "cancelled":
      return "cancelled";
    case "timeout":
      return error("timeout", `${test.label} did not finish within ${formatTstates(budget)} T-states (the time limit).`, tstates);
    case "halt":
      return error("halt", `${test.label} halted with interrupts disabled: it can never continue.`, tstates);
  }

  const fired = run.stop.fired;
  const comment = describeStop(ds, machine);
  if (comment?.kind === "ASSERTION") {
    return { id: test.id, status: "failed", tstates, message: comment.message, ...(comment.location ? { location: comment.location } : {}) };
  }
  if (comment?.kind === "WPMEM") {
    return error("breakpoint", comment.message, tstates, comment.location);
  }
  const purpose =
    fired.map(unitTestGuardPurpose).find((p) => p) ?? (run.stop.pc === labels.success.address ? "success" : undefined);
  if (purpose === "success") return { id: test.id, status: "passed", tstates };
  const message = purpose && unitTestStopMessage(purpose, test.label, labels, lastPc(ds, machine));
  if (message) return error(purpose === "returned" ? "returned" : "stack", message, tstates);
  return error("breakpoint", `${test.label} stopped at $${hex4(machine.pc)}.`, tstates);
}

/** Runs in debug mode until a breakpoint, the budget, a dead HALT or a cancel */
function runUntilStop(
  machine: RunnerMachine,
  budget: number,
  drainLog: () => void,
  signal: { readonly aborted: boolean } | undefined
): { stop: Stop; tstates: number } {
  const ctx = machine.executionContext;
  const ds = ctx.debugSupport as DebugSupport;
  const start = machine.tacts;
  const elapsed = () => (machine.tacts - start) >>> 0;
  ctx.frameTerminationMode = FrameTerminationMode.Normal;
  ctx.terminationPoint = undefined;
  ctx.debugStepMode = DebugStepMode.StopAtBreakpoint;
  let frames = 0;
  try {
    while (true) {
      const termination = machine.executeMachineFrame();
      drainLog();
      if (termination === FrameTerminationMode.DebugEvent) {
        ds.consumeFiredOneShots();
        return { stop: { kind: "breakpoint", pc: machine.pc, fired: ds.lastStopBreakpoints ?? [] }, tstates: elapsed() };
      }
      if (elapsed() >= budget) return { stop: { kind: "timeout" }, tstates: elapsed() };
      if (machine.halted && !machine.iff1) return { stop: { kind: "halt" }, tstates: elapsed() };
      if ((++frames & 0x3f) === 0 && signal?.aborted) return { stop: { kind: "cancelled" }, tstates: elapsed() };
    }
  } finally {
    ctx.debugStepMode = DebugStepMode.NoDebug;
  }
}

/** The report of an ASSERTION or WPMEM stop, if the last stop was one */
function describeStop(
  ds: DebugSupport,
  machine: RunnerMachine
): { kind: "ASSERTION" | "WPMEM"; message: string; location?: { file: string; line: number } } | undefined {
  const lines = commentStopLines(ds, () => lastPc(ds, machine));
  if (!lines.length) return undefined;
  // --- An assertion wins over a watchpoint that fired with it
  const first = lines.find((l) => l.kind === "ASSERTION") ?? lines[0];
  return {
    kind: first.kind,
    message: lines.map((l) => l.text).join("\n"),
    ...(first.resource && first.line ? { location: { file: first.resource, line: first.line } } : {})
  };
}

function lastPc(ds: DebugSupport, machine: RunnerMachine): number {
  return ds.lastDecisionPc ?? (machine as { opStartAddress?: number }).opStartAddress ?? machine.pc;
}

function hasAnnotation(fired: BreakpointInfo[]): boolean {
  return fired.some((bp) => bp.owner?.kind === "annotation" && !!bp.annotationKind);
}

function installGuards(ds: DebugSupport, guards: BreakpointInfo[]): void {
  ds.resetBreakpointsTo(guards, { kind: "unitTest" });
}

/**
 * Plays a code-injection flow headlessly up to its `Inject` step, as the IDE's controller does: the
 * machine's own boot to the point where code is injected (D7)
 */
export async function bootToInjectionPoint(machine: RunnerMachine, model: string): Promise<void> {
  const flow = await machine.getCodeInjectionFlow!(model);
  const runFrames = (count: number) => {
    for (let i = 0; i < count; i++) runOneFrame(machine);
  };
  for (const step of flow) {
    switch (step.type) {
      case "ReachExecPoint":
        runToAddress(machine, step.execPoint, BOOT_MAX_FRAMES);
        break;
      case "QueueKey":
        machine.queueKeystroke?.(0, 5, step.primary, step.secondary, step.ternary);
        if ((step.wait ?? 100) > 0) runFrames(Math.ceil((step.wait ?? 100) / 20));
        break;
      case "Wait":
        runFrames(Math.ceil((step.duration ?? 100) / 20));
        break;
      case "WaitKeyQueue":
        for (let i = 0; i < BOOT_MAX_FRAMES && (machine.getKeyQueueLength?.() ?? 0) > 0; i++) runOneFrame(machine);
        break;
      case "WaitIdle": {
        let consecutive = 0;
        for (let i = 0; i < BOOT_MAX_FRAMES && consecutive < (step.samples ?? 12); i++) {
          runOneFrame(machine);
          consecutive = machine.pc >= step.fromAddr && machine.pc <= step.toAddr ? consecutive + 1 : 0;
        }
        break;
      }
      case "Inject":
        return;
    }
  }
}

function runToAddress(machine: RunnerMachine, address: number, maxFrames: number): void {
  const ctx = machine.executionContext;
  ctx.frameTerminationMode = FrameTerminationMode.UntilExecutionPoint;
  ctx.terminationPoint = address & 0xffff;
  ctx.terminationPartition = undefined;
  try {
    for (let frames = 0; frames < maxFrames; ) {
      if (machine.executeMachineFrame() === FrameTerminationMode.UntilExecutionPoint) return;
      if (machine.frameJustCompleted) frames++;
    }
    throw new Error(`$${hex4(address)} was not reached in ${maxFrames} frames (PC=$${hex4(machine.pc)})`);
  } finally {
    ctx.frameTerminationMode = FrameTerminationMode.Normal;
    ctx.terminationPoint = undefined;
  }
}

function runOneFrame(machine: RunnerMachine): void {
  for (let guardCount = 0; guardCount < 1000; guardCount++) {
    machine.executeMachineFrame();
    if (machine.frameJustCompleted) return;
  }
}

/** Reads a byte where a label lives: through its partition when it has one (T6) */
function readAt(machine: RunnerMachine, at: { address: number; partition?: number }, offset = 0): number {
  if (at.partition === undefined) return machine.doReadMemory((at.address + offset) & 0xffff);
  return partitionByte(machine, at, offset).memory[partitionByte(machine, at, offset).index];
}

/** Writes a word after a label: through its partition when it has one (T6) */
function writeWord(machine: RunnerMachine, at: { address: number; partition?: number }, offset: number, value: number): void {
  for (let i = 0; i < 2; i++) {
    const byte = (value >> (8 * i)) & 0xff;
    if (at.partition === undefined) {
      machine.doWriteMemory((at.address + offset + i) & 0xffff, byte);
    } else {
      const { memory, index } = partitionByte(machine, at, offset + i);
      memory[index] = byte;
    }
  }
}

function partitionByte(
  machine: RunnerMachine,
  at: { address: number; partition?: number },
  offset: number
): { memory: Uint8Array; index: number } {
  const memory = machine.getMemoryPartition(at.partition!);
  const size = memory.length;
  return { memory, index: (at.address + offset) & (size - 1) };
}

function formatTstates(value: number): string {
  return value.toLocaleString("en-US");
}

function hex4(value: number): string {
  return (value & 0xffff).toString(16).toUpperCase().padStart(4, "0");
}

function messageOf(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
