import { describe, expect, it } from "vitest";

import { createHtSession } from "../harness/ht1080z";
import { HT1080Z_MODELS } from "@emu/machines/ht1080z/ht1080zMachineInfo";
import { pictureHash } from "./goldens";
import goldens from "./goldens.json";

/*
 * The Phase 7 model tests (`.plans/HT1080Z_PLAN.md` §4.3, §13): every registered model boots on its
 * own ROMs, clock and RAM; the 48K Series I/II show their 16K originals' screen; the accented
 * characters print through BASIC on Series II and the /64. The per-model screen goldens are
 * `screen.test.ts`'s.
 */

const EXPECTED: Record<string, { clock: number; top: number; golden: string }> = {
  "ht1080z-s1": { clock: 1_774_000, top: 0x7fff, golden: "ht1080z-s1-boot" },
  "ht1080z-s2": { clock: 1_774_000, top: 0x7fff, golden: "ht1080z-s2-boot" },
  "ht1080z-64": { clock: 1_777_417, top: 0xffff, golden: "ht1080z-64-boot" },
  "ht1080z-s1-48k": { clock: 1_774_000, top: 0xffff, golden: "ht1080z-s1-boot" },
  "ht1080z-s2-48k": { clock: 1_774_000, top: 0xffff, golden: "ht1080z-s2-boot" }
};

describe("HT-1080Z models", () => {
  it("registers Series I, Series II, the /64, and Series I/II with 48K", () => {
    expect(HT1080Z_MODELS.map((m) => m.modelId)).toEqual(Object.keys(EXPECTED));
  });

  for (const [model, { clock, top, golden }] of Object.entries(EXPECTED)) {
    it(`${model}: boots at ${clock} Hz with RAM to ${top.toString(16)}h, to its model's screen`, async () => {
      const s = await createHtSession({ model });
      expect(s.machine.baseClockFrequency).toBe(clock);
      s.bootToPrompt().runFrames(1);
      // --- MEMSIZ (40B1h): the ROM's own memory test found the RAM
      expect(s.peekWord(0x40b1)).toBe(top);
      expect(pictureHash(s.screenPixels())).toBe((goldens as Record<string, string>)[golden]);
    });
  }

  it("the /64 prints its Hungarian and mathematical characters from a BASIC string", async () => {
    const s = (await createHtSession({ model: "ht1080z-64" })).bootToPrompt().extensionOn();
    s.typeKeys("PRINT CHR$(21)\n");
    s.typeKeys('PRINT "ÁRVÍZTŰRŐ ∞π"\n', { settle: 20 });
    // --- The string holds ` + key pairs; PRINT shows each pair as one character of the /64's set
    const printed = s.lineCodes(2, 11);
    expect(printed).toEqual([0, 0x52, 0x56, 2, 0x5a, 0x54, 8, 0x52, 5, 0x20, 11]);
  });

  it("Series II prints its accented capitals and small letters from a BASIC string", async () => {
    const s = (await createHtSession({ model: "ht1080z-s2" })).bootToPrompt().extensionOn();
    s.typeKeys('PRINT "ÁÉÜÖáéüö"\n', { settle: 20 });
    expect(s.lineCodes(2, 8)).toEqual([0x5d, 0x40, 0x5e, 0x5c, 0x7d, 0x60, 0x7e, 0x7c]);
  });
});
