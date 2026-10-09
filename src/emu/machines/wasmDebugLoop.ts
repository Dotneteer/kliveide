import { DebugStepMode } from "@emu/abstractions/DebugStepMode";
import type { ExecutionContext } from "@emu/abstractions/ExecutionContext";
import { FrameTerminationMode } from "@emu/abstractions/FrameTerminationMode";
import type { IDebugSupport } from "@renderer/abstractions/IDebugSupport";
import { shouldStopAtDebugPoint } from "./DebugStepDecision";
import { EXEC_BP, IO_READ_BP, IO_WRITE_BP, MEM_READ_BP, MEM_WRITE_BP, PART_BP } from "./DebugSupport";
import type { ReturnRegisters } from "./SourceStepDecision";
import {
  CORE_STOP_CONDITION,
  WASM_CORE_CONDITION_PLAN_ENTRIES,
  WASM_CORE_CONDITION_PLAN_SLOT_BASE,
  WASM_CORE_CONDITION_PLAN_SLOTS
} from "./wasmDebugLoopLayout";

/*
 * The debug loop every WASM machine host runs outside a plain Run (`.plans/WASM_CORE_LEAN_AND_DEBUG_PLAN.md`
 * Phase 3, D9): debug sessions, steps, and runs to an execution point (a project's start).
 *
 * The hosts had the same loop and the same stop order, each written out by hand; this is that loop
 * once, with the machine-specific steps as hooks. A host builds a `WasmDebugLoopHost` over itself and
 * its core and calls `runWasmDebugLoop`. Phase 4a moves the per-instruction work into the core
 * (`executeUntilStop`); a host that offers it already (the Z88 and the ZX80/81) runs whole stretches
 * there.
 */

/**
 * A test seam: `inCore: false` keeps every run instruction by instruction, so a test can compare the
 * in-core loop with it (`test/wasm/debug-loop-equivalence.test.ts`). Always on in the IDE.
 */
export const wasmDebugLoopOptions = { inCore: true };

/** `extraStop` for `<prefix>ExecuteUntilStop` when there is none: any value above $FFFF */
export const NO_EXTRA_STOP = 0xffff_ffff;

/**
 * What an RZX-aware host says after an instruction call (`RzxSession.afterInstruction`): an
 * instruction ran, the session stopped, a recorded frame completed its picture, or the call ended a
 * recorded frame without running an instruction
 */
export type WasmStepOutcome = "ran" | "stopped" | "picture" | "boundary" | undefined;

/** The machine and core operations the shared loop drives */
export interface WasmDebugLoopHost {
  readonly executionContext: ExecutionContext;
  /** The host's `frameCompleted` */
  frameCompleted: boolean;
  /** The host's mirrored PC */
  readonly pc: number;
  /** Where a step-out lands (`markStepOutAddress`), -1 when unknown */
  readonly stepOutAddress: number;
  getFrameCommand(): unknown;

  /**
   * Once, on entry: frame-level work (begin a new frame, keystrokes, keyboard, audio and clock syncs,
   * the CPU mirror). A termination returned ends the run at once without running an instruction; the
   * host has finished it itself (the Next's pending SD command, which also keeps the frame open).
   */
  enter(): FrameTerminationMode | undefined;
  /** Before each instruction call; a termination returned ends the run (the RZX session's verdict) */
  beforeInstruction?(): FrameTerminationMode | undefined;
  /**
   * Runs one instruction (one core call). A core whose instruction export reports the frame's end
   * returns it, which saves the loop a `coreFrameCompleted` call per instruction.
   */
  executeInstruction(): boolean | void;
  /** What the call did, for an RZX-aware host; `undefined` for an ordinary instruction */
  afterInstruction?(): WasmStepOutcome;
  /**
   * The in-core loop, when the core has one: runs until the frame ends, the PC reaches an address whose
   * breakpoint flags meet `mask` or `extraStop`, or an instruction touches an address or port whose flags
   * meet `accessMask`. Returns the instructions run.
   */
  executeUntilStop?(extraStop: number, mask: number, accessMask: number): number;
  /**
   * Where the last instruction `executeUntilStop` ran started (`<prefix>GetDebugOpStart`): the stop
   * policy's last decision point, had the run gone instruction by instruction
   */
  lastOpStart?(): number;
  /** Copies the stop table (`buildCoreStopTable`) into the core's breakpoint flags (with `executeUntilStop`) */
  pushBreakpointFlags?(flags: Uint16Array): void;
  /** The core's condition plan (`<prefix>CondPlanPtr`), which `buildCoreStopTable` writes */
  conditionPlan?(): Uint32Array;
  /**
   * Whether this run may use `executeUntilStop`, asked after `enter`: a host whose run needs work around
   * every instruction says no (an RZX session, the Next's NextReg, Copper and sprite watches)
   */
  canRunInCore?(): boolean;
  /** Whether the core's frame completed */
  coreFrameCompleted(): boolean;
  /**
   * Mirrors the core's PC into the host, without pushing it back to the core, and returns it: the loop
   * keeps it rather than reading the host's `pc` (on a WASM host, one more core call)
   */
  mirrorPc(): number;
  /** A reverse-debugging replay reached its next journal entry (`z80HistoryCheckStop`) */
  historyStopReached(): boolean;
  /** Copies the core's bus record of the last instruction into the host's fields */
  importBusAccess(): void;
  /** The memory/I/O breakpoint test on the imported bus record */
  hasAccessBreakpoint(): boolean;
  /** The execution-breakpoint and step policy at the current PC (`shouldStopAtDebugPoint`) */
  shouldStopAtBreakpoint(instructionsExecuted: number): boolean;
  /**
   * After an instruction, before the stop tests: the host's own stops (the Next's NextReg, Copper and
   * sprite watches) and its own after-work (a pending reset). A termination returned ends the run.
   */
  afterStep?(): FrameTerminationMode | undefined;
  /** When the frame ended normally inside the loop, before `finish` (the ZX81's auto-run) */
  onFrameEnd?(): void;
  /** The single exit: the host's mirror catches up with the core */
  finish(termination: FrameTerminationMode): FrameTerminationMode;
}

/**
 * Runs the debug loop until the frame ends or something stops it. The stop order is the one every host
 * had: a replay target, the host's own stops, the execution point, memory/I/O breakpoints, execution
 * breakpoints and steps, step-into, a pending frame command.
 */
export function runWasmDebugLoop(host: WasmDebugLoopHost): FrameTerminationMode {
  const context = host.executionContext;
  const debugSupport = context.debugSupport;
  let instructionsExecuted = 0;
  context.lastTerminationReason = undefined;

  const entered = host.enter();
  if (entered !== undefined) return entered;

  // --- Mirroring the core's bus activity costs several boundary crossings per instruction and is
  // --- only ever read by the memory/IO breakpoint test, so decide once whether it is needed
  const watchesBusAccess = debugSupport?.hasAccessBreakpoints() ?? false;

  // --- The in-core loop needs the stop table in the core; a step-into is one instruction, so it never
  // --- uses it. A memory or I/O breakpoint makes the core stop after every instruction that touched a
  // --- flagged address or port, where the test below decides (`accessMask`). Without a debugger (a
  // --- project's start runs to its execution point) no flag can stop the run: the masks are empty, so a
  // --- table a past debug run left in the core is ignored.
  const flags = debugSupport?.breakpointFlags;
  const flagsUsable = flags instanceof Uint16Array && flags.length === 0x1_0000;
  const fastPath =
    wasmDebugLoopOptions.inCore &&
    host.executeUntilStop !== undefined &&
    (debugSupport === undefined || flagsUsable) &&
    context.debugStepMode !== DebugStepMode.StepInto &&
    (host.canRunInCore?.() ?? true);
  if (fastPath && debugSupport) host.pushBreakpointFlags?.(buildCoreStopTable(debugSupport, host.conditionPlan?.()));
  const stopMask = debugSupport ? EXEC_BP | PART_BP | CORE_STOP_CANDIDATE | CORE_STOP_CONDITION : 0;
  const accessMask = watchesBusAccess ? MEM_READ_BP | MEM_WRITE_BP | IO_READ_BP | IO_WRITE_BP : 0;

  if (debugSupport && host.pc !== debugSupport.lastStartupBreakpoint) {
    if (host.shouldStopAtBreakpoint(instructionsExecuted)) {
      return host.finish(FrameTerminationMode.DebugEvent);
    }
  }
  if (debugSupport) {
    debugSupport.lastStartupBreakpoint = undefined;
  }

  while (!host.frameCompleted) {
    const early = host.beforeInstruction?.();
    if (early !== undefined) return host.finish(early);

    let frameEnded: boolean | void = undefined;
    const extraStop = fastPath ? fastPathStop(host, instructionsExecuted) : undefined;
    if (extraStop !== undefined) {
      // --- Up to the next place the policy below may stop at, or the end of the frame
      const executed = host.executeUntilStop!(extraStop, stopMask, accessMask);
      instructionsExecuted += executed;
      // --- Instruction by instruction, the policy decided before every instruction, so its last decision
      // --- was at the start of the last one: an access stop reports that instruction (`lastDecisionPc`)
      if (executed > 0 && debugSupport && host.lastOpStart) debugSupport.lastDecisionPc = host.lastOpStart();
    } else {
      frameEnded = host.executeInstruction();
      const outcome = host.afterInstruction?.();
      if (outcome === "stopped") {
        host.mirrorPc();
        return host.finish(FrameTerminationMode.DebugEvent);
      }
      if (outcome === "picture") {
        host.frameCompleted = true;
        break;
      }
      // --- An RZX call that ends a recorded frame runs no instruction
      if (outcome === "boundary") continue;
      instructionsExecuted++;
    }

    let pc = host.mirrorPc();
    host.frameCompleted = typeof frameEnded === "boolean" ? frameEnded : host.coreFrameCompleted();

    // --- A reverse-debugging replay run reached its next journal entry (REVERSE_DEBUGGING_PLAN D11)
    if (context.historyStopArmed && host.historyStopReached()) {
      return host.finish(FrameTerminationMode.UntilExecutionPoint);
    }
    if (watchesBusAccess) host.importBusAccess();

    if (host.afterStep) {
      const own = host.afterStep();
      if (own !== undefined) return host.finish(own);
      // --- The host's after-work may move the PC (the Next's reset)
      pc = host.pc;
    }

    if (context.frameTerminationMode === FrameTerminationMode.UntilExecutionPoint) {
      const point = context.terminationPoint;
      if (point != null && pc === (point & 0xffff)) {
        return host.finish(FrameTerminationMode.UntilExecutionPoint);
      }
    }
    if (watchesBusAccess && host.hasAccessBreakpoint()) {
      return host.finish(FrameTerminationMode.DebugEvent);
    }
    if (host.shouldStopAtBreakpoint(instructionsExecuted)) {
      return host.finish(FrameTerminationMode.DebugEvent);
    }
    if (context.debugStepMode === DebugStepMode.StepInto) {
      if (debugSupport) debugSupport.imminentBreakpoint = undefined;
      return host.finish(FrameTerminationMode.DebugEvent);
    }
    if (host.getFrameCommand()) {
      return host.finish(FrameTerminationMode.Normal);
    }
  }

  host.onFrameEnd?.();
  return host.finish(FrameTerminationMode.Normal);
}

/**
 * The core's own bit in its stop table: an address where the stop policy acts although no breakpoint
 * is set - an error stop (`errorStopAddress`, `romErrorAddress`), or an address the BASIC statement
 * tracker observes or a source step decides at. `DebugSupport.breakpointFlags` uses bits 0-12 and the
 * conditions bit 14 (`CORE_STOP_CONDITION`); this one exists only in the copy.
 */
export const CORE_STOP_CANDIDATE = 0x8000;

/* Reused for every run: the copy is rebuilt on each entry, so a breakpoint edited while paused is in it */
const coreStopTable = new Uint16Array(0x1_0000);

/**
 * The stop table an in-core debug loop runs with (`.plans/WASM_CORE_LEAN_AND_DEBUG_PLAN.md` D13): the
 * breakpoint flags, plus `CORE_STOP_CANDIDATE` wherever `shouldStopAtDebugPoint` acts per instruction
 * without a breakpoint. The core stops at every candidate and the TypeScript policy decides there, so
 * running in the core decides exactly as running instruction by instruction does.
 *
 * With `plan` (the core's condition plan, Phase 4c), an address whose conditions the core can decide
 * (`coreConditionPlan`) carries `CORE_STOP_CONDITION` instead of its execution bits, and its slots go into
 * the plan: the core runs past it while they are all false. What does not fit keeps its execution bits.
 */
export function buildCoreStopTable(debugSupport: IDebugSupport, plan?: Uint32Array): Uint16Array {
  const flags = debugSupport.breakpointFlags;
  if (flags) coreStopTable.set(flags);
  else coreStopTable.fill(0);
  const mark = (address: number | undefined): void => {
    if (address !== undefined && address >= 0) coreStopTable[address & 0xffff] |= CORE_STOP_CANDIDATE;
  };
  mark(debugSupport.errorStopAddress);
  mark(debugSupport.romErrorAddress);
  for (const address of debugSupport.statementTracker?.stopAddresses?.() ?? []) mark(address);
  // --- A source step decides only at statement entries and return addresses (Phase 4d); its index may be
  // --- an older one than the tracker's, which a rebuild leaves the step in progress
  for (const address of debugSupport.sourceStep?.index.trackedAddresses() ?? []) mark(address);
  if (plan) writeConditionPlan(debugSupport, plan);
  return coreStopTable;
}

/* Writes the condition plan into the core and marks its addresses in the stop table */
function writeConditionPlan(debugSupport: IDebugSupport, plan: Uint32Array): void {
  let entries = 0;
  let used = 0;
  for (const { address, slots } of debugSupport.coreConditionPlan?.() ?? []) {
    if (entries >= WASM_CORE_CONDITION_PLAN_ENTRIES || used + slots.length > WASM_CORE_CONDITION_PLAN_SLOTS) break;
    const at = 1 + 3 * entries;
    plan[at] = address;
    plan[at + 1] = used;
    plan[at + 2] = slots.length;
    for (const slot of slots) plan[WASM_CORE_CONDITION_PLAN_SLOT_BASE + used++] = slot;
    coreStopTable[address] = (coreStopTable[address] & ~(EXEC_BP | PART_BP)) | CORE_STOP_CONDITION;
    entries++;
  }
  plan[0] = entries;
}

/**
 * Whether the debug loop may let the core run on to the next candidate stop, and the one address
 * besides the breakpoints where the stop policy may stop (`NO_EXTRA_STOP` when there is none);
 * `undefined` means one instruction at a time. The policy (`shouldStopAtDebugPoint`) stops only at
 * a breakpoint or at that address in these cases: running to breakpoints, running to an execution
 * point, a step-over already waiting for its return address, and a step-out (the WASM machines take
 * its target from the core's shadow stack and pass `retExecuted: false`).
 */
export function fastPathStop(
  host: Pick<WasmDebugLoopHost, "executionContext" | "getFrameCommand" | "stepOutAddress">,
  instructionsExecuted: number
): number | undefined {
  if (host.getFrameCommand()) return undefined;
  const context = host.executionContext;
  let extra = NO_EXTRA_STOP;
  if (context.frameTerminationMode === FrameTerminationMode.UntilExecutionPoint) {
    if (context.terminationPoint == null) return undefined;
    extra = context.terminationPoint & 0xffff;
  }
  const another = (address: number | undefined): number | undefined =>
    address === undefined || address < 0 ? extra : extra === NO_EXTRA_STOP ? address & 0xffff : undefined;
  switch (context.debugStepMode) {
    case DebugStepMode.NoDebug:
    case DebugStepMode.StopAtBreakpoint:
      return extra;
    case DebugStepMode.StepOver: {
      // --- The first instruction decides whether this step waits for a return address
      const imminent = context.debugSupport?.imminentBreakpoint;
      return instructionsExecuted > 0 && imminent !== undefined ? another(imminent) : undefined;
    }
    case DebugStepMode.StepOut:
      return another(host.stepOutAddress);
    case DebugStepMode.SourceStep:
      // --- The step decides only at statement entries and return addresses, which the stop table marks
      // --- (Phase 4d); its first stop test, before any instruction, runs before the loop
      return extra;
    default:
      return undefined;
  }
}

/** The machine state the shared stop tests read */
export interface WasmStopMachine {
  readonly executionContext: ExecutionContext;
  readonly pc: number;
  readonly stepOutAddress: number;
  getPartition(address: number): number | undefined;
  getCallInstructionLength(): number;
  getInterruptDepth(): number;
}

/**
 * The execution-breakpoint and step policy at the current PC for a WASM machine. `getSp` and
 * `getRegisters` read wherever the host keeps them current during the loop (the core, for a host
 * whose mirror is synced only on exit).
 */
export function shouldStopAtWasmBreakpoint(
  machine: WasmStopMachine,
  instructionsExecuted: number,
  getSp: () => number,
  getRegisters: () => ReturnRegisters
): boolean {
  const debugSupport = machine.executionContext.debugSupport;
  if (!debugSupport) return false;
  return shouldStopAtDebugPoint({
    debugSupport,
    debugStepMode: machine.executionContext.debugStepMode,
    pc: machine.pc,
    instructionsExecuted,
    getPartition: (address) => machine.getPartition(address),
    getCallInstructionLength: () => machine.getCallInstructionLength(),
    getSp,
    getInterruptDepth: () => machine.getInterruptDepth(),
    getRegisters,
    stepOutAddress: machine.stepOutAddress,
    /*
     * `false` on purpose: the core keeps a step-out stack, so `stepOutAddress` is the exact address
     * this routine returns to, which is what `DebugStepMode.StepOut` means. `retExecuted` fires on
     * the first RET at *any* depth, including one returning from a nested call, so leaving it on would
     * stop short of the caller.
     */
    retExecuted: false
  });
}

/** The bus record the memory/I/O breakpoint test reads (the `Z80Cpu` fields every host mirrors) */
export interface WasmBusRecord {
  readonly lastMemoryReads: ArrayLike<number>;
  readonly lastMemoryReadsCount: number;
  readonly lastMemoryWrites: ArrayLike<number>;
  readonly lastMemoryWritesCount: number;
  readonly lastIoReadPort: number;
  readonly lastIoReadValue: number;
  readonly lastIoWritePort: number;
  readonly lastIoWriteValue: number;
}

/**
 * The memory/I/O breakpoint test on a host's imported bus record. All four are asked, not
 * short-circuited: a conditional breakpoint counts its hits (C11), so a read that stops must not hide
 * a write in the same instruction from its counter.
 */
export function hasWasmAccessBreakpoint(
  debugSupport: IDebugSupport | undefined,
  bus: WasmBusRecord,
  getPartition: (address: number) => number | undefined,
  readValues: ArrayLike<number> | undefined,
  writeValues: ArrayLike<number> | undefined
): boolean {
  if (!debugSupport) return false;
  const read = debugSupport.hasMemoryRead(bus.lastMemoryReads, bus.lastMemoryReadsCount, getPartition, readValues);
  const written = debugSupport.hasMemoryWrite(bus.lastMemoryWrites, bus.lastMemoryWritesCount, getPartition, writeValues);
  const portRead = debugSupport.hasIoRead(bus.lastIoReadPort, bus.lastIoReadValue);
  const portWritten = debugSupport.hasIoWrite(bus.lastIoWritePort, bus.lastIoWriteValue);
  return read || written || portRead || portWritten;
}

/** The core's step-out target (`<prefix>GetStepOutAddress`) as the debugger expects it: -1 when none */
export function stepOutAddressFromCore(raw: number): number {
  return raw === 0xffff_ffff ? -1 : raw;
}
