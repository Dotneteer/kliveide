import type { IDebugSupport } from "@renderer/abstractions/IDebugSupport";
import { DebugStepMode } from "@emu/abstractions/DebugStepMode";

/**
 * The single answer to "should the machine stop here?", shared by every WASM v2 machine.
 *
 * This exists because it did not, and the cost was two shipped bugs. Four machines
 * (48K, 128, +3E, Next) each carried their own copy of a 58-line decision, and the copies drifted:
 *
 * - All four dropped the `imminentJustCreated` guard that `MachineFrameRunner` has, so a step-over
 *   that *landed on* a call-like instruction stepped over that one too and a whole instruction
 *   vanished from the stepping sequence.
 * - The +3E copy alone omits `retExecuted` from its step-out test (see `retExecuted` below).
 *
 * Neither was catchable by a test, because the logic was welded into classes that need a WASM
 * runtime to instantiate. It is a plain function now, and `test/emu/debug-step-decision.test.ts`
 * exercises every branch of it.
 *
 * `MachineFrameRunner` — the interpreted path, and the reference the WASM copies drifted from —
 * calls this too. Two things stayed with their callers on purpose, because folding them in would
 * have changed behaviour rather than merely de-duplicating it:
 *
 * - **`DebugStepMode.StepInto`.** The interpreted path answers it *before* the breakpoint check;
 *   the WASM machines answer it *after*. That is observable (whether `lastBreakpoint` gets recorded
 *   when stepping onto a breakpoint), so each keeps its own ordering.
 * - **`retExecuted`.** The WASM machines pass it, the interpreted path deliberately does not. That
 *   asymmetry is correct rather than accidental; see the field below.
 */

export type DebugStopDecisionInput = {
  debugSupport: IDebugSupport;

  debugStepMode: DebugStepMode;

  /** The CPU's program counter *now* — after `instructionsExecuted` instructions of this run. */
  pc: number;

  /**
   * How many instructions this debug run has executed so far.
   *
   * Zero means the decision is being made *before* the first instruction, which is what separates
   * "starting on a call" from "landing on one".
   */
  instructionsExecuted: number;

  /** Resolves an address to its memory partition, for partition-aware breakpoints. */
  getPartition: (address: number) => number | undefined;

  /**
   * The length of the call-like instruction at PC, or 0 if it is not one.
   *
   * A callback rather than a value because it reads memory, and most decisions never need it.
   */
  getCallInstructionLength: () => number;

  /** Where a step-out is heading, when one is in progress. */
  stepOutAddress?: number;

  /**
   * Whether a `RET`/`RETN` executed on the instruction just completed.
   *
   * **A fallback, not a refinement, and the two callers differ on purpose.**
   *
   * `DebugStepMode.StepOut` means the RET that returns *to this routine's caller*. The exact way to
   * detect that is `stepOutAddress`, taken from a real call stack that `Z80Cpu`/`M6510VaCpu` push
   * on every CALL and RST. The interpreted `MachineFrameRunner` has that stack, so it passes
   * `retExecuted: false` and relies on the exact test — because this flag fires on the first RET of
   * *any* depth, including one returning from a call nested inside the routine, and would stop
   * short.
   *
   * The WASM machines cannot use the exact test at all: their CPU runs inside the core, the TS push
   * methods never execute, the stack stays empty and `stepOutAddress` is permanently -1. For them
   * this flag is the only signal that can ever end a step-out. The +3E had neither until
   * `spp3eGetCpuRetExecuted`/`RetnExecuted` were added to its core, which meant its step-out could
   * not terminate on its own.
   *
   * Giving the WASM machines a real step-out stack — tracked core-side — would let them use the
   * exact test too, and is the proper fix.
   */
  retExecuted: boolean;
};

/**
 * Decides whether a debugged machine should stop at the current PC.
 *
 * @returns true to stop and report a debug event; false to keep executing
 */
export function shouldStopAtDebugPoint(input: DebugStopDecisionInput): boolean {
  const {
    debugSupport,
    debugStepMode,
    pc,
    instructionsExecuted,
    getPartition,
    getCallInstructionLength,
    stepOutAddress,
    retExecuted
  } = input;

  /*
   * A real breakpoint always wins.
   *
   * The `lastBreakpoint` dance stops a breakpoint from re-triggering on the instruction it already
   * stopped at: resuming from a breakpoint must move, not stop again on the spot.
   */
  const stopAt = debugSupport.shouldStopAt(pc, getPartition);
  if (
    stopAt &&
    (instructionsExecuted > 0 ||
      debugSupport.lastBreakpoint === undefined ||
      debugSupport.lastBreakpoint !== pc)
  ) {
    debugSupport.lastBreakpoint = pc;
    debugSupport.imminentBreakpoint = undefined;
    return true;
  }

  if (debugStepMode === DebugStepMode.StopAtBreakpoint) {
    return false;
  }

  if (debugStepMode === DebugStepMode.StepOver) {
    /*
     * A step-over already in progress: run until the temporary breakpoint placed after the call.
     *
     * If that address is never reached the machine runs on to the next real breakpoint, which is
     * how a wrong instruction length shows up as step-over apparently teleporting. See
     * `extendedInstructionLenghts` in `Z80NMachineBase`, and the test that checks it.
     */
    if (debugSupport.imminentBreakpoint !== undefined) {
      if (debugSupport.imminentBreakpoint === pc) {
        debugSupport.imminentBreakpoint = undefined;
        return true;
      }
      return false;
    }

    const length = getCallInstructionLength();
    if (length > 0) {
      /*
       * The guard the WASM port lost, and the whole reason this function exists.
       *
       * Arriving at a call-like instruction *after* executing one already means this step is
       * finished. Arming the temporary breakpoint here instead would step over the call as well,
       * so one press of Step Over would execute two instructions and the user would watch an
       * instruction disappear from the listing.
       */
      if (instructionsExecuted > 0) {
        return true;
      }
      debugSupport.imminentBreakpoint = (pc + length) & 0xffff;
      return false;
    }

    // --- An ordinary instruction: step over behaves as step into.
    return instructionsExecuted > 0;
  }

  if (debugStepMode === DebugStepMode.StepOut) {
    if (stepOutAddress === pc || retExecuted) {
      debugSupport.imminentBreakpoint = undefined;
      return true;
    }
    return false;
  }

  return false;
}
