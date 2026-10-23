import { expect, it } from "vitest";

import { kitMachine, loadKitFile, press, savePicture, screenText } from "./kit";
import { PublishedPictures } from "./pictures";

/*
 * Timing Test v0.3 (Patrik Rak, 2013, after Jan Bobrowski's zxtests): the T-states a piece of code
 * takes when it starts at each T-state of a frame. Test 0 times a NOP at $7FFF, in contended memory;
 * its table starts 8 T-states before the first contended T-state the program expects (`timing.bas`:
 * `base=14328` on the 48K). Each duration is 4 plus the WoS 48K FAQ's delay, 6,5,4,3,2,1,0,0.
 */
it("test 0, a contended NOP: 4 + the FAQ's delays, from where the program expects them", async () => {
  const pictures = new PublishedPictures();
  const s = await kitMachine({ model: "48k" });
  loadKitFile(s, "timing-test/timingtest-0.3/timing.tap");
  s.runFrames(300);
  press(s, "N0");
  press(s, "Enter");
  s.runFrames(1500);
  savePicture(s, "timing-test-0");
  pictures.take(s, "timing-test-0");
  const rows = new Map<number, number[]>();
  for (const m of screenText(s).matchAll(/^(\d{5})((?:\s+\d+){8})\s*$/gm)) {
    rows.set(Number(m[1]), m[2].trim().split(/\s+/).map(Number));
  }
  expect(rows.get(14328)).toEqual([4, 4, 4, 4, 4, 4, 4, 4]);
  for (let t = 14336; t <= 14376; t += 8) expect(rows.get(t), `${t}`).toEqual([10, 9, 8, 7, 6, 5, 4, 4]);
  pictures.settle();
}, 120_000);
