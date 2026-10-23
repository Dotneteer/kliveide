import { expect, it } from "vitest";

import { kitMachine, loadKitFile, pageThrough, press, savePicture } from "./kit";

/*
 * ZX Spectrum Timing Tests - 48K v1.0 (Richard and Tim Butler, 2010): 35 tests of instruction and
 * contention timing, in uncontended and contended memory, each compared by the program with the
 * results of a real 48K. It loads with its own loader, at the real tape speed.
 */
const TAP = "timing-tests-48k/ZX Spectrum Timing Tests - 48K v1.0 (2010-04-14)(Butler, Richard; Butler, Tim)[!].tap";

it("passes every test on the 48K (early timing, which it detects)", async () => {
  const s = await kitMachine({ model: "48k" });
  loadKitFile(s, TAP, { slow: true });
  s.runFrames(8000);
  press(s, "Enter");
  const pages = pageThrough(s, { frames: 400, done: /All Tests Complete|tests failed/ });
  savePicture(s, "timing-tests-48k");
  expect(pages[pages.length - 1]).toContain("All Tests Complete 100% Pass");
}, 300_000);
