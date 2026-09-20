import { describe, expect, it } from "vitest";

import * as harness from "../../harness/z88";
import { benchmarkZ88, parseArgs } from "../../../scripts/benchmark-z88-wasm.cjs";

/*
 * The rollout gate of `.plans/CAMBRIDGE_Z88_WASM_MIGRATION_PLAN.md` ("the benchmark shows WASM faster
 * than TypeScript"), as a check: every scenario of `scripts/benchmark-z88-wasm.cjs` - OZ idle and at
 * the keyboard, CPU, LCD, beeper and flash-heavy code, and running under the debugger - is faster on
 * the WASM machine, measured through the same public machine API the app uses.
 *
 * Single debugger steps are the exception, and are not measured here: a step is one instruction plus
 * the full register and bus-record handover, about 8 us on WASM against 0.5 us on TypeScript - once
 * per key press, so it never shows.
 *
 * A perf test (`npm run test:perf`): it measures wall-clock time, so run it on an idle machine.
 */
describe("Cambridge Z88: WASM is faster than TypeScript", () => {
  it("in every scenario the app runs frames in", async () => {
    const options = { ...parseArgs([]), frames: 60, runs: 3, warmup: 10 };
    const report = await benchmarkZ88(options, harness);
    const measured = report.results.filter((r: { id: string }) => r.id !== "debug-step");
    expect(measured.map((r: { id: string }) => r.id)).toEqual([
      "oz-idle",
      "oz-typing",
      "cpu-loop",
      "lcd-800x480",
      "beeper",
      "flash-program",
      "debug-run"
    ]);
    for (const r of measured) {
      expect(r.speedup, `${r.id}: TS ${r.typescript.median} ms, WASM ${r.wasm.median} ms`).toBeGreaterThan(1.5);
    }
  }, 300_000);
});
