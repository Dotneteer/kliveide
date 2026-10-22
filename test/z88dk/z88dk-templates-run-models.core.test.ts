import { describe, expect, it } from "vitest";

import { P3_MODELS } from "@emu/machines/zxSpectrumP3e/p3RomSets";
import { createSp48Session } from "../harness/sp48";
import { createSp128Session, type Sp128SessionModel } from "../harness/sp128";
import { createTimexSession, hasTimexRom } from "../harness/timex";
import { buildTemplate, codeToInjectOf } from "./zccReplay";
import { runSpectrumTemplate, withTemp } from "./templateRun";

/*
 * Run on the real cores for every other ZX Spectrum family model (`.plans/ZX_SPECTRUM_C_TEMPLATES_PLAN.md`
 * T3, slow tier: `build/e2e-tests.ts`). One representative per route is in the fast
 * `z88dk-templates-run.core.test.ts`. The Timex ROMs cannot ship (`.plans/TIMEX_SCORPION_PLAN.md` P5):
 * their cases run when `KLIVE_TC2048_ROM` / `KLIVE_TC2068_ROM` / `KLIVE_TS2068_ROM` name them.
 */

describe("z88dk templates run on every Spectrum family model", () => {
  it("48K NTSC: the sp48 template", async () => {
    // --- The harness boots the shipped 48K ROM; NTSC changes only the timing of the same core
    await runSpectrumTemplate(await createSp48Session(), "tpl-sp48", "sp48", "ntsc");
  });

  it("Pentagon 128: the sp128 template (the Pentagon is a 128K model)", async () => {
    await runSpectrumTemplate(await createSp128Session("pentagon"), "tpl-sp128", "sp128", "pentagon");
  });

  it("Scorpion ZS-256 on the 128K ROMs: the scorpion template", async () => {
    await runSpectrumTemplate(await createSp128Session("scorpion"), "tpl-scorpion", "scorpion");
  });

  it("Scorpion ZS-256 with its own ROM: Run is refused with the reason, not started into an unknown editor", async () => {
    const s = await createSp128Session("scorpion", { scorpionRom: new Uint8Array(0x10000) });
    await withTemp(async (temp) => {
      const code = codeToInjectOf(await buildTemplate(temp, "tpl-scorpion", "scorpion", undefined, "build"));
      await expect((s.machine as any).getCodeInjectionFlow(code.model)).rejects.toThrow(/does not know the Scorpion ROM's editor/);
    });
  });

  // --- +3E fdd1 is the fast tier's representative
  for (const model of P3_MODELS.map((m) => m.modelId).filter((id) => id !== "fdd1")) {
    it(`${model}: the spp3e template`, async () => {
      await runSpectrumTemplate(await createSp128Session(model as Sp128SessionModel), "tpl-spp3e", "spp3e", model);
    });
  }

  it.skipIf(!hasTimexRom("tc2048"))("TC2048 with its own ROM (KLIVE_TC2048_ROM): the timex template", async () => {
    await runSpectrumTemplate(await createTimexSession({ model: "tc2048", rom: "own" }), "tpl-timex-tc2048", "timex", "tc2048");
  });

  for (const model of ["tc2068", "ts2068"] as const) {
    it.skipIf(!hasTimexRom(model))(`${model.toUpperCase()} with its ROM (KLIVE_${model.toUpperCase()}_ROM): the timex template (+ts2068)`, async () => {
      const out = await runSpectrumTemplate(await createTimexSession({ model, rom: "own" }), "tpl-timex-ts2068", "timex", model);
      expect(out.entryAddress).toBe(0x9c40);
    });
  }
});
