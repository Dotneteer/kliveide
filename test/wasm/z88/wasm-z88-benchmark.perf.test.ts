import { describe, expect, it } from "vitest";

import * as harness from "../../harness/z88";
import { benchmarkZ88, parseArgs } from "../../../scripts/benchmark-z88-wasm.cjs";

/*
 * A performance regression gate for the Cambridge Z88: every scenario of
 * `scripts/benchmark-z88-wasm.cjs` - OZ idle and at the keyboard, CPU, LCD, beeper and flash-heavy
 * code, running under the debugger, and single debugger steps - stays within an absolute budget,
 * measured through the same public machine API the app uses.
 *
 * Until the TypeScript machine was removed this gate asked for WASM to be at least 1.5x faster than it
 * (`.plans/CAMBRIDGE_Z88_TYPESCRIPT_REMOVAL_PLAN.md`). The budgets are about ten times the figures in
 * `src/emu/machines/z88/wasm/README.md` (Apple M4 Pro), and below what the TypeScript machine took for
 * the heavier scenarios; a 5 ms machine frame must never cost a real-time frame's worth.
 *
 * A perf test (`npm run test:perf`): it measures wall-clock time, so run it on an idle machine.
 */

/** ms per benchmark frame */
const FRAME_BUDGET_MS = 0.5;
/** ms per "frame" of 200 debugger steps: 50 us a step */
const DEBUG_STEP_BUDGET_MS = 10;

describe("Cambridge Z88: the WASM machine stays within its time budget", () => {
  it("in every scenario", async () => {
    const options = { ...parseArgs([]), frames: 60, runs: 3, warmup: 10 };
    const report = await benchmarkZ88(options, harness);
    expect(report.results.map((r: { id: string }) => r.id)).toEqual([
      "oz-idle",
      "oz-typing",
      "cpu-loop",
      "lcd-800x480",
      "beeper",
      "flash-program",
      "debug-run",
      "debug-step"
    ]);
    for (const r of report.results as { id: string; median: number }[]) {
      const budget = r.id === "debug-step" ? DEBUG_STEP_BUDGET_MS : FRAME_BUDGET_MS;
      expect(r.median, `${r.id}: ${r.median.toFixed(3)} ms per frame (budget ${budget} ms)`).toBeLessThan(budget);
    }
  }, 300_000);
});
