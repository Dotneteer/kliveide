import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";

import { describe, expect, it } from "vitest";

import { startBasic } from "../codegen/run-kit";
import { isNextOnly, programs, readExpectations } from "../corpus/expectations";

/**
 * What the optimiser gains (`.docs/kbasic-optimiser.md` §7): every 48K corpus program is built at
 * each level and run to its end; its code size (the program's own code, runtime and data excluded)
 * and the T-states it took are compared with `opt-baseline.json`. A level may never get worse than
 * its recorded figures (a ratchet): code size exactly, T-states with one frame of slack, because a
 * program that waits (PAUSE, BEEP) can shift by a frame when its code changes. The emulator is
 * deterministic, so there is no other noise.
 *
 * `KBASIC_OPT_UPDATE=1` rewrites the baseline (`node scripts/kbasic-opt-report.cjs` does, and prints
 * the totals); lowering a figure is the normal way a baseline changes, raising one needs a reason.
 */
const LEVELS = [0, 1, 2, 3];
const ROOT = join(__dirname, "..", "corpus");
const BASELINE = join(__dirname, "opt-baseline.json");
const FRAME = 69888;
const UPDATE = !!process.env.KBASIC_OPT_UPDATE;

type Figures = { bytes: number; tstates: number };
type Baseline = Record<string, Record<string, Figures>>;

async function measure(source: string, level: number): Promise<Figures | undefined> {
  const expectations = readExpectations(source);
  // --- Programs that hold keys or end in an error are run by the corpus, not measured here
  if (expectations.some((e) => e.kind === "keys" || e.kind === "error")) return undefined;
  const { session, generated, done } = await startBasic(source, { optimize: level });
  const code = generated.debug.sourceLevel.extensions?.frames ?? [];
  const bytes = code.reduce((n, f) => n + (f.endAddress - f.startAddress), 0);
  const tacts = () => session.machine.getWasmV2Diagnostics().tacts;
  const start = tacts();
  session.runTo(done, { maxFrames: 2000 });
  return { bytes, tstates: tacts() - start };
}

describe("optimiser gains on the corpus", () => {
  it("never gets worse than the recorded baseline", async () => {
    const baseline: Baseline = existsSync(BASELINE) ? JSON.parse(readFileSync(BASELINE, "utf8")) : {};
    const current: Baseline = {};
    const problems: string[] = [];
    for (const file of programs(ROOT)) {
      const source = readFileSync(file, "utf8");
      if (isNextOnly(source)) continue;
      const name = relative(ROOT, file).replace(/\\/g, "/");
      for (const level of LEVELS) {
        const f = await measure(source, level);
        if (!f) continue;
        (current[name] ??= {})[level] = f;
        const was = baseline[name]?.[level];
        if (!was) continue;
        if (f.bytes > was.bytes) problems.push(`${name} at level ${level}: ${f.bytes} bytes, recorded ${was.bytes}`);
        if (f.tstates > was.tstates + FRAME) problems.push(`${name} at level ${level}: ${f.tstates} T-states, recorded ${was.tstates}`);
      }
    }
    const total = (level: number) =>
      Object.values(current).reduce((t, byLevel) => ({ bytes: t.bytes + (byLevel[level]?.bytes ?? 0), tstates: t.tstates + (byLevel[level]?.tstates ?? 0) }), {
        bytes: 0,
        tstates: 0
      });
    const summary = LEVELS.map((l) => `level ${l}: ${total(l).bytes} bytes, ${total(l).tstates} T-states`).join("; ");
    process.stderr.write(`KBASIC-OPT ${Object.keys(current).length} programs; ${summary}\n`);
    if (UPDATE) {
      writeFileSync(BASELINE, JSON.stringify(current, null, 1) + "\n");
      return;
    }
    expect(Object.keys(baseline).length, "a baseline exists (KBASIC_OPT_UPDATE=1 writes it)").toBeGreaterThan(0);
    expect(problems).toEqual([]);
  }, 1200000);
});
