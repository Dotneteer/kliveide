import { describe, expect, it } from "vitest";

import { DebugStepMode } from "@emu/abstractions/DebugStepMode";
import { FrameTerminationMode } from "@emu/abstractions/FrameTerminationMode";

import { createSp128Session } from "../../harness/sp128";
import { createSp48Session } from "../../harness/sp48";
import { createZ88Session } from "../../harness/z88";
import { createZx81Session } from "../../harness/zx81";

/*
 * The execution-history recorder's cost on every core (`.plans/EXECUTION_HISTORY_ALL_CORES_PLAN.md`
 * trap T5). `npm run test:perf`; not part of the regular tiers, because a timing ratio on a shared CI
 * runner is noise.
 *
 * - Every core's debug loop runs in C (`…ExecuteUntilStop`, `.plans/WASM_CORE_LEAN_AND_DEBUG_PLAN.md`
 *   Phase 4a): a debug session costs about what a plain Run does, so the recorder's fixed cost per
 *   instruction is a visible fraction of it. The bound is that plan's D14 budget for a debug session with
 *   history recording, 25%. (Before Phase 4a the Spectrums' loop paid a TypeScript round trip per
 *   instruction and recording cost at most 8% of it; the recorder did not change, the loop got faster.)
 * - The ZX81's loop (the ULA works every instruction) measures 16-18% here and 1.3x a plain Run in the
 *   host benchmark, missing D14 (WASM_CORE_LEAN_AND_DEBUG_PLAN §10.6): its bound, 35%, is a guard
 *   against regressions. The Z88's loop is the fastest of all - about 22 ns an instruction - so the
 *   recorder's fixed cost, mostly storing one 64-byte record into a 4 MB ring, is about a third of it:
 *   about 8 ns an instruction, with the debug run still well over 100 times real time. Its bound is
 *   50%, a guard against regressions, which the record format cannot bring down to D14's 25%.
 * - Off, the hook is one predictable branch per cycle; a plain Run never records.
 */

type Timed = {
  machine: {
    executionContext: { debugStepMode: DebugStepMode; frameTerminationMode: FrameTerminationMode };
    executeMachineFrame(): unknown;
    setHistoryEnabled(enabled: boolean): void;
  };
};

/**
 * Times debug-loop frames with recording off and on, interleaved round by round in one machine so
 * drift and JIT state hit both alike; the minimum of each is the least disturbed measurement
 */
function timeOffOn(s: Timed, frames: number, rounds = 12): { off: number; on: number } {
  const machine = s.machine;
  const ctx = machine.executionContext;
  ctx.debugStepMode = DebugStepMode.StopAtBreakpoint;
  ctx.frameTerminationMode = FrameTerminationMode.DebugEvent;
  for (let i = 0; i < 5; i++) machine.executeMachineFrame();
  let off = Infinity;
  let on = Infinity;
  for (let round = 0; round < rounds; round++) {
    for (const record of round % 2 ? [true, false] : [false, true]) {
      machine.setHistoryEnabled(record);
      const start = performance.now();
      for (let i = 0; i < frames; i++) machine.executeMachineFrame();
      const elapsed = performance.now() - start;
      if (record) on = Math.min(on, elapsed);
      else off = Math.min(off, elapsed);
    }
  }
  return { off, on };
}

function report(name: string, { off, on }: { off: number; on: number }): number {
  process.stdout.write(`${name}: off ${off.toFixed(1)} ms, on ${on.toFixed(1)} ms (${((on / off - 1) * 100).toFixed(1)}%)\n`);
  return on / off;
}

describe("execution history: cost on every core (T5)", () => {
  it("costs the 48K's debug loop at most 25%", async () => {
    const s = await createSp48Session();
    s.bootToBasic();
    expect(report("48K debug loop", timeOffOn(s as unknown as Timed, 4))).toBeLessThan(1.25);
  });

  it("costs the 128K's debug loop at most 25%", async () => {
    const s = await createSp128Session("sp128");
    s.runFrames(100);
    expect(report("128K debug loop", timeOffOn(s as unknown as Timed, 4))).toBeLessThan(1.25);
  });

  it("costs the +3E's debug loop at most 25%", async () => {
    const s = await createSp128Session("nofdd");
    s.runFrames(100);
    expect(report("+3E debug loop", timeOffOn(s as unknown as Timed, 4))).toBeLessThan(1.25);
  });

  it("costs the Z88's C debug loop at most 50% (see above)", async () => {
    const s = await createZ88Session();
    await s.loadCode(`
        .org $8000
Start:  ld hl,$9000
Loop:   ld a,(hl)
        add a,l
        ld (hl),a
        inc hl
        res 7,h
        set 4,h
        djnz Loop
        jr Loop`);
    expect(report("Z88 C debug loop", timeOffOn(s as unknown as Timed, 200))).toBeLessThan(1.5);
  });

  it("costs the ZX81's C debug loop at most 35% (SLOW mode: the display runs, forced NOPs merge)", async () => {
    const s = await createZx81Session();
    s.bootToBasic();
    expect(report("ZX81 C debug loop", timeOffOn(s as unknown as Timed, 40))).toBeLessThan(1.35);
  });
});
