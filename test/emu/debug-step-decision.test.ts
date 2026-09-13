import { describe, expect, it, vi } from "vitest";
import { shouldStopAtDebugPoint } from "@emu/machines/DebugStepDecision";
import type { DebugStopDecisionInput } from "@emu/machines/DebugStepDecision";
import { DebugStepMode } from "@emu/abstractions/DebugStepMode";
import type { IDebugSupport } from "@renderer/abstractions/IDebugSupport";

/**
 * A debug-support stub carrying only what the decision reads.
 *
 * `breakAt` is the set of addresses with a real breakpoint; everything else is state the decision
 * mutates and the tests assert on.
 */
function support(breakAt: number[] = [], overrides: Partial<IDebugSupport> = {}) {
  return {
    shouldStopAt: (address: number) => breakAt.includes(address),
    lastBreakpoint: undefined,
    imminentBreakpoint: undefined,
    ...overrides
  } as unknown as IDebugSupport;
}

function decide(overrides: Partial<DebugStopDecisionInput> = {}) {
  const input: DebugStopDecisionInput = {
    debugSupport: support(),
    debugStepMode: DebugStepMode.StepOver,
    pc: 0x8000,
    instructionsExecuted: 0,
    getPartition: () => undefined,
    getCallInstructionLength: () => 0,
    stepOutAddress: undefined,
    retExecuted: false,
    ...overrides
  };
  return { stop: shouldStopAtDebugPoint(input), input };
}

describe("shouldStopAtDebugPoint — real breakpoints", () => {
  it("stops at a breakpoint and remembers it", () => {
    const debugSupport = support([0x8000]);
    const { stop } = decide({ debugSupport, debugStepMode: DebugStepMode.StopAtBreakpoint });
    expect(stop).toBe(true);
    expect(debugSupport.lastBreakpoint).toBe(0x8000);
  });

  it("does not re-trigger on the breakpoint it is already stopped at", () => {
    // --- Otherwise resuming from a breakpoint would stop again on the spot and never move.
    const debugSupport = support([0x8000], { lastBreakpoint: 0x8000 });
    expect(decide({ debugSupport, instructionsExecuted: 0 }).stop).toBe(false);
  });

  it("does trigger again once execution has moved", () => {
    const debugSupport = support([0x8000], { lastBreakpoint: 0x8000 });
    expect(decide({ debugSupport, instructionsExecuted: 1 }).stop).toBe(true);
  });

  it("clears a pending step-over breakpoint when a real one wins", () => {
    const debugSupport = support([0x8000], { imminentBreakpoint: 0x9000 });
    decide({ debugSupport });
    expect(debugSupport.imminentBreakpoint).toBeUndefined();
  });

  it("ignores everything else in StopAtBreakpoint mode", () => {
    expect(
      decide({
        debugStepMode: DebugStepMode.StopAtBreakpoint,
        instructionsExecuted: 5,
        getCallInstructionLength: () => 3
      }).stop
    ).toBe(false);
  });
});

describe("shouldStopAtDebugPoint — step over", () => {
  it("runs one ordinary instruction", () => {
    expect(decide({ instructionsExecuted: 0 }).stop).toBe(false);
    expect(decide({ instructionsExecuted: 1 }).stop).toBe(true);
  });

  it("arms a temporary breakpoint after a call it starts on", () => {
    const debugSupport = support();
    const { stop } = decide({
      debugSupport,
      pc: 0x8000,
      instructionsExecuted: 0,
      getCallInstructionLength: () => 3
    });
    expect(stop).toBe(false);
    expect(debugSupport.imminentBreakpoint).toBe(0x8003);
  });

  it("wraps the temporary breakpoint at the top of memory", () => {
    const debugSupport = support();
    decide({ debugSupport, pc: 0xfffe, getCallInstructionLength: () => 3 });
    expect(debugSupport.imminentBreakpoint).toBe(0x0001);
  });

  it("stops when the temporary breakpoint is reached, and clears it", () => {
    const debugSupport = support([], { imminentBreakpoint: 0x8003 });
    const { stop } = decide({ debugSupport, pc: 0x8003, instructionsExecuted: 9 });
    expect(stop).toBe(true);
    expect(debugSupport.imminentBreakpoint).toBeUndefined();
  });

  it("keeps running while inside the call", () => {
    const debugSupport = support([], { imminentBreakpoint: 0x8003 });
    expect(decide({ debugSupport, pc: 0x4000, instructionsExecuted: 40 }).stop).toBe(false);
  });

  /*
   * The regression this function was extracted for.
   *
   * All four WASM v2 machines lost the guard `MachineFrameRunner` still has, so arriving at a call
   * *after* executing an instruction armed the temporary breakpoint and carried on — one press of
   * Step Over executed two instructions. On the ZX Spectrum Next this made `NEXTREG` instructions
   * disappear from the stepping sequence.
   */
  it("stops on arriving at a call rather than stepping over that one too", () => {
    const debugSupport = support();
    const { stop } = decide({
      debugSupport,
      pc: 0x00fd,
      instructionsExecuted: 1,
      getCallInstructionLength: () => 3
    });
    expect(stop).toBe(true);
    expect(debugSupport.imminentBreakpoint).toBeUndefined();
  });

  it("does not read the instruction when a step-over is already in flight", () => {
    // --- Reading it costs a memory access per instruction of the call, for an answer never used.
    const getCallInstructionLength = vi.fn(() => 3);
    decide({
      debugSupport: support([], { imminentBreakpoint: 0x8003 }),
      pc: 0x4000,
      instructionsExecuted: 5,
      getCallInstructionLength
    });
    expect(getCallInstructionLength).not.toHaveBeenCalled();
  });
});

describe("shouldStopAtDebugPoint — step out", () => {
  it("stops on reaching the step-out address", () => {
    const debugSupport = support([], { imminentBreakpoint: 0x1234 });
    const { stop } = decide({
      debugSupport,
      debugStepMode: DebugStepMode.StepOut,
      pc: 0x8000,
      stepOutAddress: 0x8000
    });
    expect(stop).toBe(true);
    expect(debugSupport.imminentBreakpoint).toBeUndefined();
  });

  it("stops when a RET executed, even short of the step-out address", () => {
    expect(
      decide({
        debugStepMode: DebugStepMode.StepOut,
        pc: 0x8000,
        stepOutAddress: 0x9999,
        retExecuted: true
      }).stop
    ).toBe(true);
  });

  it("keeps running otherwise", () => {
    expect(
      decide({ debugStepMode: DebugStepMode.StepOut, pc: 0x8000, stepOutAddress: 0x9999 }).stop
    ).toBe(false);
  });

  it("still stops at the address when no RET is reported", () => {
    // --- Reaching `stepOutAddress` has to remain sufficient on its own: `retExecuted` is an
    // --- additional way to finish a step-out, never a precondition for finishing one.
    expect(
      decide({
        debugStepMode: DebugStepMode.StepOut,
        pc: 0x9999,
        stepOutAddress: 0x9999,
        retExecuted: false
      }).stop
    ).toBe(true);
  });
});

describe("shouldStopAtDebugPoint — other modes", () => {
  it("never stops on its own in NoDebug", () => {
    expect(
      decide({ debugStepMode: DebugStepMode.NoDebug, instructionsExecuted: 100 }).stop
    ).toBe(false);
  });

  it("still honours a real breakpoint in NoDebug, which the caller gates instead", () => {
    expect(
      decide({ debugSupport: support([0x8000]), debugStepMode: DebugStepMode.NoDebug }).stop
    ).toBe(true);
  });
});
