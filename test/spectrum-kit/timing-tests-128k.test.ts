import { expect, it } from "vitest";

import { kitMachine, loadKitFile, pageThrough, press, savePicture } from "./kit";
import { PublishedPictures } from "./pictures";

/*
 * ZX Spectrum Timing Tests - 128K v1.0 (Richard and Tim Butler, 2015), a `.szx` snapshot: the 48K
 * suite's 35 tests (and two I/O tests) on the 128K in 48K mode, each compared by the program with the
 * results of its authors' real 128K - a machine with late timing: Klive passes them with late timing
 * on and fails five contended tests with early timing (`.plans/SPECTRUM_ULA_ACCURACY_PLAN.md` §1.4).
 *
 * Known: test 15 uncontended (IM 0/1/2, LD A,I, ...) counts twice the loops Klive does, as if the
 * real machine skipped an interrupt; not explained yet.
 */
const SZX = "timing-tests-128k/ZX Spectrum Timing Tests - 128K v1.0 (2015-03-30)(Butler, Richard; Butler, Tim)[!].szx";

/** Each test's outcome: "15 Uncontended" -> "Fail" */
function outcomes(pages: string[]): Map<string, string> {
  const result = new Map<string, string>();
  const pattern = /Test (\d+) \{(Uncontended|Contended)\}\n(?:[^\n]*\n){0,3}?R=\d+\s+loop=\d+\s+sp=\d+\s+(Pass|Fail)/g;
  for (const page of pages) {
    for (const m of page.matchAll(pattern)) result.set(`${m[1]} ${m[2]}`, m[3]);
  }
  return result;
}

/*
 * A test that passes does not wait for a key, so most scroll past between two looks at the screen; a
 * test that fails waits, so every failure is seen. Its BASIC stops after test 34 (line 1350), before
 * the summary the 48K suite prints, so a run ends at test 34.
 */
async function run(late: boolean, pictures?: PublishedPictures): Promise<{ results: Map<string, string>; last: string }> {
  const s = await kitMachine({ model: "128k" });
  loadKitFile(s, SZX);
  // --- After the load: the file's header says standard timing (an .szx sets the machine's)
  (s.machine.wasmV2Runtime!.exports as unknown as Record<string, (v: number) => void>).sp128SetLateTiming(late ? 1 : 0);
  s.runFrames(100);
  press(s, "Enter");
  const pages = pageThrough(s, { frames: 300, maxPages: 200, done: /Test 34 \{Contended\}(.|\n)*(Pass|Fail)/ });
  savePicture(s, `timing-tests-128k-${late ? "late" : "early"}`);
  pictures?.take(s, "timing-tests-128k-late");
  return { results: outcomes(pages), last: pages[pages.length - 1] };
}

it("passes every test but one with late timing (its authors' 128K)", async () => {
  const pictures = new PublishedPictures();
  const { results, last } = await run(true, pictures);
  const failed = [...results].filter(([, outcome]) => outcome === "Fail").map(([test]) => test);
  expect(failed).toEqual(["15 Uncontended"]);
  expect(last).toContain("Test 34 {Contended}");
  pictures.settle();
}, 300_000);

it("fails contended tests with early timing", async () => {
  const { results } = await run(false);
  const failed = [...results].filter(([, outcome]) => outcome === "Fail").map(([test]) => test);
  expect(failed.some((test) => test.endsWith("Contended") && !test.endsWith("Uncontended"))).toBe(true);
}, 300_000);
