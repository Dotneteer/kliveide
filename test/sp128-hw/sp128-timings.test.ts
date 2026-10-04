import { describe, expect, it } from "vitest";

import { SP128_TIMINGS, type Sp128TimingId } from "@emu/machines/zxSpectrum128/sp128Timings";
import { createSp128Session } from "../harness/sp128";

/*
 * `sp128Timings.ts` is the TypeScript side of the core's `sp128ApplyTiming` (plan P3): the two must
 * not drift. Every figure of the table is read back from the running core.
 */

/** sp128.c / zx-spectrum-ula.c rendering phases */
const PHASE_DISPLAY_B1_FETCH_B2 = 6;

describe("sp128 timing table against the core", () => {
  it.each(Object.keys(SP128_TIMINGS) as Sp128TimingId[])("%s", async (id) => {
    const t = SP128_TIMINGS[id];
    const s = await createSp128Session(id);
    const m = s.machine;
    const x = m.wasmV2Runtime!.exports as unknown as Record<string, (...a: number[]) => number>;

    expect(x.sp128GetTiming()).toBe(t.coreTiming);
    expect(m.baseClockFrequency).toBe(t.clockHz);
    expect(x.sp128GetBaseClockFrequency()).toBe(t.clockHz);
    expect(x.sp128GetTactsInFrame()).toBe(t.tactsPerFrame);
    expect(m.tactsInFrame).toBe(t.tactsPerFrame);
    expect(t.tactsPerLine * t.linesPerFrame).toBe(t.tactsPerFrame);
    expect(x.sp128GetScreenLineTime()).toBe(t.tactsPerLine);
    expect(x.sp128GetRasterLines()).toBe(t.linesPerFrame);
    expect(x.sp128GetInterruptTacts()).toBe(t.interruptTacts);

    // --- The screen device's geometry is the core's
    const sc = t.screen;
    expect(sc.borderLeftTime + sc.displayLineTime + sc.borderRightTime + sc.nonVisibleBorderRightTime + sc.horizontalBlankingTime).toBe(t.tactsPerLine);
    expect(
      sc.verticalSyncLines + sc.nonVisibleBorderTopLines + sc.borderTopLines + sc.displayLines + sc.borderBottomLines + sc.nonVisibleBorderBottomLines
    ).toBe(t.linesPerFrame);
    expect(m.screenWidthInPixels).toBe(2 * (sc.borderLeftTime + sc.displayLineTime + sc.borderRightTime));
    expect(m.screenHeightInPixels).toBe(sc.borderTopLines + sc.displayLines + sc.borderBottomLines - 1);

    // --- Where the paper starts, and the contention table
    let paper = -1;
    let contended = 0;
    for (let tact = 0; tact < t.tactsPerFrame; tact++) {
      if (paper < 0 && x.sp128GetRenderingPhase(tact) === PHASE_DISPLAY_B1_FETCH_B2) paper = tact;
      if (x.sp128GetContentionValue(tact) !== 0) contended++;
    }
    expect(paper).toBe(t.paperStartTact);
    expect(contended > 0).toBe(t.contention);
  });
});
