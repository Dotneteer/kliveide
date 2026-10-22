import { describe, expect, it } from "vitest";

import { createSp48Session } from "../harness/sp48";
import { createSp128Session } from "../harness/sp128";
import { createTimexSession } from "../harness/timex";
import { createSession as createNextSession } from "../harness/zxnext";
import { buildTemplate } from "./zccReplay";
import { globalAddress, runSpectrumTemplate, runUntilCounterDone, topRowsHaveInk, withTemp, type TemplateSession } from "./templateRun";

/*
 * Run on the real cores, one representative per route (`.plans/ZX_SPECTRUM_C_TEMPLATES_PLAN.md` T3,
 * fast tier): the 48K's own injection, the 128K and +3 family's 48 BASIC injection, the TC2048 (+zx on
 * the Timex core), and the Next's .nex. Every other model is in `z88dk-templates-run-models.core.test.ts`
 * (slow tier).
 */

describe("z88dk templates run (one per route)", () => {
  it("48K: the sp48 template runs and returns to BASIC", async () => {
    const s = await createSp48Session();
    const out = await runSpectrumTemplate(s, "tpl-sp48", "sp48", "pal");
    expect(out.entryAddress).toBe(0x8000);
  });

  it("128K: the sp128 template runs through the 48 BASIC injection and returns to BASIC", async () => {
    await runSpectrumTemplate(await createSp128Session("sp128"), "tpl-sp128", "sp128", "sp128");
  });

  it("+3E: the spp3e template runs through the 48 BASIC injection and returns to BASIC", async () => {
    await runSpectrumTemplate(await createSp128Session("fdd1"), "tpl-spp3e", "spp3e", "fdd1");
  });

  it("TC2048: the timex template (+zx) runs and returns to BASIC", async () => {
    await runSpectrumTemplate(await createTimexSession({ model: "tc2048" }), "tpl-timex-tc2048", "timex", "tc2048");
  });

  it("Next: the zxnext template's .nex loads and runs its loop", async () => {
    await withTemp(async (temp) => {
      const out = await buildTemplate(temp, "tpl-zxnext", "zxnext", "standard", "build");
      expect(out.z88dkRun).toBe("nex");
      expect(out.prebuiltNex?.length).toBeGreaterThan(0);
      // --- Run exports this .nex and has NextZXOS `.nexload` it; the harness loads it directly, with
      // --- the 48K BASIC ROM and system variables `.nexload` hands over (harness README, "Direct load")
      const fs = await import("fs");
      const path = await import("path");
      const nexFile = path.join(temp, "program.nex");
      fs.writeFileSync(nexFile, Uint8Array.from(out.prebuiltNex!));
      const s = await createNextSession();
      await s.prepareBasic();
      await s.loadProgramFile(nexFile);
      runUntilCounterDone(s as unknown as TemplateSession, out);
      expect(topRowsHaveInk(s as unknown as TemplateSession), "the template's text in the top rows").toBe(true);
      // --- `.nexload` leaves no return address (`_input/nexload.asm`: SP from the header, `rst $20`
      // --- to PC), so the template must not return from main: it stays in its own code. A `return`
      // --- there went to a garbage address and reset the machine.
      const { startAddress, emittedCode } = out.segments[0];
      for (let i = 0; i < 10; i++) {
        s.runFrames(5);
        expect(s.machine.pc, `PC stays in the program ($${startAddress.toString(16)}..)`).toBeGreaterThanOrEqual(startAddress);
        expect(s.machine.pc).toBeLessThan(startAddress + emittedCode.length);
      }
      expect(s.peekWord(globalAddress(out, "counter"))).toBe(6);
    });
  });
});
