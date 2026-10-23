import { describe, it } from "vitest";

import { createHtSession, type Ht1080zTestSession } from "../harness/ht1080z";
import { expectGolden } from "./goldens";

/*
 * Screen goldens (`.plans/HT1080Z_PLAN.md` §13, Phase 3): the boot screen and the character set of
 * every model, drawn by the core's renderer from the real character ROMs. Each was checked by eye
 * before it was recorded (`goldens.ts`).
 */

/** Every code 00h-FFh, 64 to a line on lines 0-3, by the IDE (no dash), then two whole frames */
function showCharacterSet(s: Ht1080zTestSession): void {
  for (let line = 0; line < 16; line++) {
    for (let column = 0; column < 64; column++) {
      s.poke(0x3c00 + line * 64 + column, line < 4 ? line * 64 + column : 0x20);
    }
  }
  s.runFrames(2);
}

describe("HT-1080Z screen", () => {
  for (const model of ["ht1080z-s1", "ht1080z-s2", "ht1080z-64"]) {
    it(`${model}: the boot screen`, async () => {
      const s = (await createHtSession({ model })).bootToPrompt();
      // --- The cursor blinks with the extension; a frame right after the prompt appears is stable
      s.runFrames(1);
      expectGolden(`${model}-boot`, s.screenPixels());
    });

    it(`${model}: the character set`, async () => {
      const s = (await createHtSession({ model })).bootToPrompt();
      // --- Park the CPU in a loop outside video RAM, so no dash falls on the picture
      s.poke(0x6000, [0x18, 0xfe]);
      s.machine.pc = 0x6000;
      showCharacterSet(s);
      expectGolden(`${model}-characters`, s.screenPixels());
    });
  }
});
