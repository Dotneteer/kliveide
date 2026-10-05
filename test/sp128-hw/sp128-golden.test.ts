import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { createSp128Session } from "../harness/sp128";
import { recordTimingExercise } from "./timing-exercise";

/*
 * The ZX Spectrum 128K's behaviour, recorded before the core learned the Pentagon timing
 * (`.plans/PENTAGON_128_PLAN.md` P7) and kept as a regression: the 128K must stay exactly as it was.
 *
 * A program exercises everything the timing touches - interrupts, border stripes, writes to the
 * contended screen, the floating bus, paging (contended and uncontended banks, the shadow screen),
 * the AY and the beeper - and the test hashes, per frame, the picture, the audio, the tact and
 * contention counters and the CPU, and at the end every RAM bank.
 *
 * `SP128_GOLDEN_WRITE=1` records `sp128-golden.json` (only ever from a core known to be right).
 */

const GOLDEN = join(__dirname, "sp128-golden.json");

describe("ZX Spectrum 128K golden (P7)", () => {
  it("behaves exactly as recorded", async () => {
    const s = await createSp128Session("sp128");
    const actual = await recordTimingExercise(s);
    if (process.env.SP128_GOLDEN_WRITE === "1" || !existsSync(GOLDEN)) {
      if (process.env.SP128_GOLDEN_WRITE !== "1") throw new Error(`${GOLDEN} is missing; record it with SP128_GOLDEN_WRITE=1`);
      writeFileSync(GOLDEN, JSON.stringify(actual, null, 2) + "\n");
      return;
    }
    const golden = JSON.parse(readFileSync(GOLDEN, "utf8"));
    expect(actual.tactsInFrame).toBe(golden.tactsInFrame);
    for (let i = 0; i < golden.perFrame.length; i++) {
      expect(actual.perFrame[i], `frame ${i}`).toBe(golden.perFrame[i]);
    }
    expect(actual.banks).toEqual(golden.banks);
    expect(actual.fbsum).toBe(golden.fbsum);
  }, 120_000);
});
