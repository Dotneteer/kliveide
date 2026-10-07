import { describe, expect, it } from "vitest";

import { DebugStepMode } from "@emu/abstractions/DebugStepMode";
import { FrameTerminationMode } from "@emu/abstractions/FrameTerminationMode";

import { createSession } from "../../harness/zxnext";

/*
 * The execution-history recorder's cost (`.plans/EXECUTION_HISTORY_VIEWER_PLAN.md` trap T14, Phase 8).
 * `npm run test:perf`; not part of the regular tiers, because a timing ratio on a shared CI runner
 * is noise.
 *
 * - On, in the debug loop (Start with Debugging, which already pays a TypeScript round trip per
 *   instruction), it costs at most 8%.
 * - Off, the hook is one predictable branch per cycle. A plain Run never records (D8); the second
 *   test reports what recording would cost a fast frame, for the record. The "off" cost against a
 *   build without the hook was measured once when the hook landed (the plan's Phase 8 note) - a
 *   test cannot build the core twice.
 */

const PROGRAM = `
        .org $8000
Start:  di
        nextreg $07,$03
        ld hl,$c000
Loop:   ld a,(hl)
        add a,l
        ld (hl),a
        inc hl
        ld a,h
        or $c0
        ld h,a
        djnz Loop
        jr Loop`;

/**
 * Times frames with recording off and on, interleaved round by round in one machine so drift and
 * JIT state hit both alike; the minimum of each is the least disturbed measurement
 */
async function timeOffOn(debugLoop: boolean, frames: number, rounds = 12): Promise<{ off: number; on: number }> {
  const s = await createSession();
  await s.loadCode(PROGRAM);
  const machine = s.machine;
  const ctx = machine.executionContext;
  if (debugLoop) {
    ctx.debugStepMode = DebugStepMode.StopAtBreakpoint;
    ctx.frameTerminationMode = FrameTerminationMode.DebugEvent;
  }
  for (let i = 0; i < 5; i++) machine.executeMachineFrame();
  let off = Infinity;
  let on = Infinity;
  for (let round = 0; round < rounds; round++) {
    for (const record of round % 2 ? [true, false] : [false, true]) {
      s.recordHistory(record);
      const start = performance.now();
      for (let i = 0; i < frames; i++) machine.executeMachineFrame();
      const elapsed = performance.now() - start;
      if (record) on = Math.min(on, elapsed);
      else off = Math.min(off, elapsed);
    }
  }
  return { off, on };
}

describe("execution history: cost (T14)", () => {
  it("costs at most 8% in the debug loop while recording", async () => {
    const { off, on } = await timeOffOn(true, 4);
    console.log(`debug loop: off ${off.toFixed(1)} ms, on ${on.toFixed(1)} ms (${((on / off - 1) * 100).toFixed(1)}%)`);
    expect(on / off).toBeLessThan(1.08);
  });

  it("reports what recording costs a fast frame (the hook is off in a plain Run, D8)", async () => {
    const { off, on } = await timeOffOn(false, 10);
    console.log(`fast frames: off ${off.toFixed(1)} ms, on ${on.toFixed(1)} ms (${((on / off - 1) * 100).toFixed(1)}%)`);
    expect(off).toBeGreaterThan(0);
  });
});
