import { expect, it } from "vitest";

import { kitMachine, loadKitFile, pictureRgb, press, savePicture, screenText } from "./kit";
import { PublishedPictures } from "./pictures";

/*
 * Jan Bobrowski's Border Time and Screen Time (2011). Each repeats one action at a T-state shown on
 * the screen (Q and A change it) and draws its effect at the top left of the paper. They number a
 * machine cycle one higher than the WoS FAQ does - as Patrik Rak's Timing Test, built on Bobrowski's
 * zxtests, whose first contended NOP is at 14,336 where the FAQ says 14,335 (`timing-test.test.ts`).
 *
 * Border Time: an OUT to the border on the line above the paper, timed as its I/O cycle on the next
 * line ("14112 + 224 = 14336"). The WoS 48K FAQ: an OUT ending 14,339-14,342 T-states after the
 * interrupt changes the border exactly at $4000's position, and the border changes only per 8 pixels.
 * The I/O cycle ends 4 T-states after it starts at 14,335-14,338: the program's 14,336-14,339 change
 * it at the paper's left edge (x 48), 14,340 one chunk (8 pixels) to the right, 14,335 one to the left.
 *
 * Screen Time: a write to $4000 in the write cycle shown. The ULA reads $4000's bitmap three T-states
 * into the contention window that opens at 14,335 (the floating bus), so a write cycle at 14,334 (the
 * program's 14,335) is in the RAM in time; one asking for 14,335 (its 14,336) waits for the window to
 * close (14,341) and is not.
 */

/** The first column of row `row` that differs from the column before it */
function firstChange(s: Parameters<typeof pictureRgb>[0], row: number): number {
  for (let col = 1; col < 352; col++) if (pictureRgb(s, row, col) !== pictureRgb(s, row, 0)) return col;
  return -1;
}

/** Presses a key and lets the program settle */
function step(s: Parameters<typeof press>[0], key: string): void {
  press(s, key);
  s.runFrames(100);
}

it("Border Time: the FAQ's OUT window lands on the paper's left edge", async () => {
  const pictures = new PublishedPictures();
  const s = await kitMachine({ model: "48k" });
  loadKitFile(s, "border-time/Border Time (2011-08-20)(Bobrowski, Jan)[!].tap");
  s.runFrames(1500);
  expect(screenText(s)).toContain("14112 + 224 = 14336");
  savePicture(s, "border-time-14336");
  pictures.take(s, "border-time-14336");
  // --- The border line above the paper is the picture's row 47 (48 border rows, the first is row 0)
  const row = 47;
  step(s, "A");
  const expected = [40, 48, 48, 48, 48, 56];
  for (let i = 0; i < expected.length; i++) {
    const tstate = 14335 + i;
    expect(screenText(s), `${tstate}`).toContain(`= ${tstate}`);
    expect(firstChange(s, row), `${tstate}`).toBe(expected[i]);
    step(s, "Q");
  }
  pictures.settle();
}, 180_000);

it("Screen Time: a write cycle at 14,334 is read, one at 14,335 is not", async () => {
  const pictures = new PublishedPictures();
  const s = await kitMachine({ model: "48k" });
  loadKitFile(s, "screen-time/Screen Time (2011-08-20)(Bobrowski, Jan)[!].tap");
  s.runFrames(1500);
  expect(screenText(s)).toContain("14335");
  savePicture(s, "screen-time-14335");
  pictures.take(s, "screen-time-14335");
  // --- $4000's cell: the picture's row 48, columns 48-55
  const paper = pictureRgb(s, 60, 100);
  const cellShowsInk = () => Array.from({ length: 8 }, (_, i) => pictureRgb(s, 48, 48 + i)).some((c) => c !== paper);
  expect(cellShowsInk(), "14335").toBe(true);
  step(s, "Q");
  expect(screenText(s)).toContain("14336");
  expect(cellShowsInk(), "14336").toBe(false);
  pictures.settle();
}, 120_000);
