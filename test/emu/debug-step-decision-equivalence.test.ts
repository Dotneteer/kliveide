import { describe, expect, it } from "vitest";
import { shouldStopAtDebugPoint } from "@emu/machines/DebugStepDecision";
import { DebugStepMode } from "@emu/abstractions/DebugStepMode";
import type { IDebugSupport } from "@renderer/abstractions/IDebugSupport";

/**
 * Proves the fold did not change the interpreted path's behaviour.
 *
 * `MachineFrameRunner.checkBreakpoints` was the *correct* implementation — the WASM v2 copies had
 * drifted from it — so replacing its body with a call to the shared function has to be provably
 * behaviour-preserving, not merely plausible. `previousFrameRunnerLogic` below is that body,
 * transcribed verbatim from before the change, and the tests run both over an exhaustive matrix of
 * inputs and compare the answer *and* the state each leaves behind.
 *
 * Step-into is excluded on purpose: it stayed with the caller, because the two paths test it at
 * different points relative to the breakpoint check. See `DebugStepDecision.ts`.
 *
 * One-shot consumption is likewise excluded: the fold predates it, and the matrix arms no one-shot,
 * so the added `consumeOneShotsAt` call cannot make the two paths differ here. It is a deliberate
 * behaviour change of its own, covered by `debug-step-decision.test.ts`.
 *
 * `retExecuted` is pinned to `false` throughout, which is what the interpreted path passed at the
 * time of the fold. It now passes the real flag — a deliberate behaviour change made afterwards, so
 * that step-out means what it is documented to mean on every machine. That change is covered by
 * `debug-step-decision.test.ts`; this file's job is only to prove the *de-duplication* itself
 * changed nothing, and it keeps doing that by holding the input it was true for.
 */
function previousFrameRunnerLogic(machine: {
  pc: number;
  stepOutAddress?: number;
  getPartition: (address: number) => number | undefined;
  getCallInstructionLength: () => number;
  debugStepMode: DebugStepMode;
  debugSupport: IDebugSupport;
  instructionsExecuted: number;
}): boolean {
  const { debugSupport, instructionsExecuted } = machine;

  const stopAt = debugSupport.shouldStopAt(machine.pc, () => machine.getPartition(machine.pc));
  if (
    stopAt &&
    (instructionsExecuted > 0 ||
      debugSupport.lastBreakpoint === undefined ||
      debugSupport.lastBreakpoint !== machine.pc)
  ) {
    debugSupport.lastBreakpoint = machine.pc;
    debugSupport.imminentBreakpoint = undefined;
    return true;
  }

  if (machine.debugStepMode === DebugStepMode.StopAtBreakpoint) {
    return false;
  }

  if (machine.debugStepMode === DebugStepMode.StepOver) {
    if (debugSupport.imminentBreakpoint !== undefined) {
      if (debugSupport.imminentBreakpoint === machine.pc) {
        debugSupport.imminentBreakpoint = undefined;
        return true;
      }
    } else {
      let imminentJustCreated = false;
      const length = machine.getCallInstructionLength();
      if (length > 0) {
        debugSupport.imminentBreakpoint = (machine.pc + length) & 0xffff;
        imminentJustCreated = true;
      }
      if (
        instructionsExecuted > 0 &&
        (debugSupport.imminentBreakpoint === undefined || imminentJustCreated)
      ) {
        debugSupport.imminentBreakpoint = undefined;
        return true;
      }
    }
    return false;
  }

  // --- Step out. Unguarded in the original, but this loop only runs when the mode is not NoDebug,
  // --- and the three modes above have already returned, so it is only ever reached for StepOut.
  if (machine.stepOutAddress === machine.pc) {
    debugSupport.imminentBreakpoint = undefined;
    return true;
  }
  return false;
}

function makeSupport(breakAt: number[], lastBreakpoint?: number, imminentBreakpoint?: number) {
  return {
    shouldStopAt: (address: number) => breakAt.includes(address),
    // --- No one-shots in this matrix, so the call is a no-op and the two paths still leave the
    // --- same state behind. `debug-step-decision.test.ts` covers what it does when there are some.
    consumeOneShotsAt: () => 0,
    lastBreakpoint,
    imminentBreakpoint
  } as unknown as IDebugSupport;
}

describe("DebugStepDecision is equivalent to the pre-fold MachineFrameRunner logic", () => {
  const MODES = [
    DebugStepMode.StopAtBreakpoint,
    DebugStepMode.StepOver,
    DebugStepMode.StepOut
  ];
  const PCS = [0x0000, 0x8000, 0xfffe];
  const EXECUTED = [0, 1, 7];
  const LENGTHS = [0, 1, 3];
  const BREAKPOINTS: number[][] = [[], [0x8000], [0x0000, 0x8000, 0xfffe]];
  const LAST: (number | undefined)[] = [undefined, 0x8000];
  const IMMINENT: (number | undefined)[] = [undefined, 0x8000, 0x8003];
  const STEP_OUT: (number | undefined)[] = [undefined, 0x8000];

  it("agrees on the answer and the resulting state for every combination", () => {
    let cases = 0;
    for (const debugStepMode of MODES)
      for (const pc of PCS)
        for (const instructionsExecuted of EXECUTED)
          for (const length of LENGTHS)
            for (const breakAt of BREAKPOINTS)
              for (const lastBreakpoint of LAST)
                for (const imminentBreakpoint of IMMINENT)
                  for (const stepOutAddress of STEP_OUT) {
                    const oldSupport = makeSupport(breakAt, lastBreakpoint, imminentBreakpoint);
                    const newSupport = makeSupport(breakAt, lastBreakpoint, imminentBreakpoint);

                    const oldAnswer = previousFrameRunnerLogic({
                      pc,
                      stepOutAddress,
                      getPartition: () => undefined,
                      getCallInstructionLength: () => length,
                      debugStepMode,
                      debugSupport: oldSupport,
                      instructionsExecuted
                    });

                    const newAnswer = shouldStopAtDebugPoint({
                      debugSupport: newSupport,
                      debugStepMode,
                      pc,
                      instructionsExecuted,
                      getPartition: () => undefined,
                      getCallInstructionLength: () => length,
                      stepOutAddress,
                      // --- The interpreted path never consulted it, and still does not.
                      retExecuted: false
                    });

                    const where =
                      `mode=${DebugStepMode[debugStepMode]} pc=${pc.toString(16)} ` +
                      `executed=${instructionsExecuted} len=${length} bps=[${breakAt}] ` +
                      `last=${lastBreakpoint} imminent=${imminentBreakpoint} out=${stepOutAddress}`;

                    expect(newAnswer, `answer differs: ${where}`).toBe(oldAnswer);
                    expect(newSupport.imminentBreakpoint, `imminentBreakpoint differs: ${where}`)
                      .toBe(oldSupport.imminentBreakpoint);
                    expect(newSupport.lastBreakpoint, `lastBreakpoint differs: ${where}`)
                      .toBe(oldSupport.lastBreakpoint);
                    cases++;
                  }
    // --- Guard against the matrix silently collapsing to nothing.
    expect(cases).toBe(
      MODES.length * PCS.length * EXECUTED.length * LENGTHS.length * BREAKPOINTS.length *
        LAST.length * IMMINENT.length * STEP_OUT.length
    );
  });
});
