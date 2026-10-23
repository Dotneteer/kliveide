import { expect, it } from "vitest";

import { kitMachine, loadKitFile, pageThrough, press, savePicture } from "./kit";
import { PublishedPictures } from "./pictures";

/*
 * ZX Spectrum Timing Tests - 48K v1.0 (Richard and Tim Butler, 2010): 35 tests of instruction and
 * contention timing, in uncontended and contended memory, each compared by the program with the
 * results of a real 48K. It loads with its own loader, at the real tape speed.
 *
 * Published: the last page, and the page with test 23 contended (IX/IY-indexed instructions in
 * contended memory, which failed before the prefixed instructions' contention was fixed).
 */
const TAP = "timing-tests-48k/ZX Spectrum Timing Tests - 48K v1.0 (2010-04-14)(Butler, Richard; Butler, Tim)[!].tap";

it("passes every test on the 48K (early timing, which it detects)", async () => {
  const pictures = new PublishedPictures();
  const s = await kitMachine({ model: "48k" });
  loadKitFile(s, TAP, { slow: true });
  s.runFrames(8000);
  press(s, "Enter");
  let contended = "";
  const pages = pageThrough(s, {
    frames: 400,
    done: /All Tests Complete|tests failed/,
    onPage: (text) => {
      if (!contended && /Test 23 \{Contended\}(?:\n[^\n]*){1,3}?Pass/.test(text)) {
        contended = text;
        pictures.take(s, "timing-tests-48k-contended");
      }
    }
  });
  savePicture(s, "timing-tests-48k");
  pictures.take(s, "timing-tests-48k");
  expect(pages[pages.length - 1]).toContain("All Tests Complete 100% Pass");
  expect(contended, "a page showing test 23 contended passing").toContain("Test 23 {Contended}");
  pictures.settle();
}, 300_000);
