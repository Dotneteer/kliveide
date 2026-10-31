import { describe, expect, it } from "vitest";

import { createEpSession, type EpTestSession } from "../harness/enterprise";
import { bareMachine, forceLptBase, loadLpt, lpbBytes, standardLpt, stepUntil, type Lpb } from "./bare";

/*
 * NICK's Line Parameter Table walker (`.plans/ENTERPRISE_PLAN.md` §7.1; NICK_VIDEO.md §3,
 * NICK_VIDEO_BACKGROUND.md §2.4-§2.7): the LPB fetched on every line, LD1/LD2 counting, margins that
 * run on, port 83h's reload sequence, the floating data bus, and the frame ending at vertical sync.
 *
 * `nick().line` counts lines from where vertical sync starts; the bare machine's LPT starts it on LPT
 * line 260, so LPT line L is line (L + 52) mod 312.
 */

const atLptLine = (line: number) => (line + 52) % 312;

/** Steps until NICK is about to run `slot` of LPT line `line` */
function stepTo(s: EpTestSession, line: number, slot: number): void {
  stepUntil(s, () => s.nick().line === atLptLine(line) && s.nick().slot === slot);
}

function withPicture(s: EpTestSession, picture: Lpb[]): void {
  bareMachine(s, { lpt: standardLpt({ picture }) });
}

describe("NICK's LPT walker", () => {
  it("reads the LPB on every line: a palette byte rewritten mid-block shows on the next line", async () => {
    const s = await createEpSession();
    withPicture(s, [{ lines: 256, mode: 7, lm: 10, rm: 52, ld1: 0x4000, palette: [0x11, 0, 0, 0, 0, 0, 0, 0] }]);
    stepTo(s, 40, 10);
    expect(s.nick().lpb[8]).toBe(0x11);
    s.pokeVram(0x3000 + 8, 0x22);
    stepTo(s, 41, 10);
    expect(s.nick().lpb[8]).toBe(0x22);
  });

  it("reloads LD1 on every line with VRES clear and keeps counting with VRES set", async () => {
    const s = await createEpSession();
    // --- LPIXEL, 42 slots (10-51): one byte a slot
    withPicture(s, [
      { lines: 100, mode: 7, vres: true, lm: 10, rm: 52, ld1: 0x4000 },
      { lines: 156, mode: 7, vres: false, lm: 10, rm: 52, ld1: 0x8000 }
    ]);
    stepTo(s, 3, 9);
    expect(s.nick().ld1).toBe(0x4000 + 3 * 42);
    stepTo(s, 103, 9);
    expect(s.nick().ld1).toBe(0x8000);
  });

  it("counts LD1 twice a slot in PIXEL, and in the control slots the margins cover", async () => {
    const s = await createEpSession();
    withPicture(s, [
      { lines: 10, mode: 1, vres: true, lm: 10, rm: 20, ld1: 0x4000 },
      // --- Slots 4-11: four control slots (4-7) count although nothing is fetched there
      { lines: 10, mode: 7, vres: true, lm: 4, rm: 12, ld1: 0x5000 },
      { lines: 236, mode: 7, lm: 63, rm: 0 }
    ]);
    stepTo(s, 2, 9);
    expect(s.nick().ld1).toBe(0x4000 + 2 * 20);
    stepTo(s, 12, 3);
    expect(s.nick().ld1).toBe(0x5000 + 2 * 8);
  });

  it("runs the display on into the next line when the right margin is 57 or more", async () => {
    const s = await createEpSession();
    withPicture(s, [
      { lines: 4, mode: 7, vres: true, lm: 50, rm: 63, ld1: 0x4000 },
      { lines: 252, mode: 7, lm: 63, rm: 0 }
    ]);
    // --- Line 0 counts slots 50-56; line 1 all 57 (LD1 reloads only on a block's first line)
    stepTo(s, 2, 0);
    expect(s.nick().ld1).toBe(0x4000 + 7 + 57);
    expect(s.nick().displayOn).toBe(true);
  });

  it("steps LD2 once a line in the character modes", async () => {
    const s = await createEpSession();
    withPicture(s, [
      { lines: 9, mode: 4, lm: 10, rm: 52, ld1: 0x4000, ld2: 0x01e9 },
      { lines: 247, mode: 7, lm: 63, rm: 0 }
    ]);
    stepTo(s, 0, 8);
    expect(s.nick().ld2).toBe(0x01e9);
    stepTo(s, 5, 8);
    expect(s.nick().ld2).toBe(0x01e9 + 5);
  });

  it("returns the last byte NICK fetched on a port read", async () => {
    const s = await createEpSession();
    withPicture(s, [{ lines: 256, mode: 7, lm: 10, rm: 52, ld1: 0x4000 }]);
    for (let i = 0; i < 0x4000; i++) s.pokeVram(0x4000 + i, 0x5a);
    stepTo(s, 20, 30);
    expect(s.wasm.epReadPort(0x80)).toBe(0x5a);
    expect(s.wasm.epReadPort(0x8f)).toBe(0x5a);
  });

  it("loads a new LPT base at once with port 83h's forced reload (bits 7-6: 00, 01, 11)", async () => {
    const s = await createEpSession();
    withPicture(s, [{ lines: 256, mode: 7, lm: 10, rm: 52, ld1: 0x4000 }]);
    const other = [{ lines: 200, mode: 4, lm: 12, rm: 40, ld1: 0x6000 }, ...standardLpt().slice(1)];
    other.forEach((b, i) => s.pokeVram(0x2000 + i * 16, lpbBytes(b)));
    stepTo(s, 30, 20);
    forceLptBase(s, 0x2000);
    // --- The step comes at the end of this line: the next line is the new table's first block
    stepTo(s, 31, 4);
    expect(s.nick().lptAddress).toBe(0x2000);
    expect(s.nick().lpb.slice(0, 4)).toEqual([256 - 200, 4 << 1, 12, 40]);
    expect(s.nick().linesLeft).toBe(200);
  });

  it("only writes the base with bit 6 left set: the table runs on until its RELOAD block", async () => {
    const s = await createEpSession();
    withPicture(s, [{ lines: 256, mode: 7, lm: 10, rm: 52, ld1: 0x4000 }]);
    stepTo(s, 30, 20);
    s.wasm.epWritePort(0x82, 0x00);
    s.wasm.epWritePort(0x83, 0xc2);
    stepTo(s, 31, 4);
    expect(s.nick().lptAddress).toBe(0x3000);
  });

  it("ends the machine frame where vertical sync starts: 312 lines", async () => {
    const s = await createEpSession();
    bareMachine(s);
    s.runFrames(3);
    const tacts = s.wasm.epGetTactsInCurrentFrame();
    expect(Math.abs(tacts - 79_941.9)).toBeLessThan(5);
    expect(s.nick().vsyncOn).toBe(true);
    expect(s.nick().line).toBe(0);
  });

  it("ends a frame after two nominal frames when no vertical sync comes", async () => {
    const s = await createEpSession();
    bareMachine(s, { lpt: [{ lines: 256, mode: 7, lm: 10, rm: 52, ld1: 0x4000, reload: true }] });
    s.runFrames(2);
    const before = s.wasm.epGetHalfClock();
    s.runFrames(1);
    expect(Math.abs((s.wasm.epGetHalfClock() - before) / 2 - 2 * 79_942)).toBeLessThan(30);
  });
});

describe("the LPT a test writes", () => {
  it("is a 312-line frame", () => {
    expect(standardLpt().reduce((n, b) => n + b.lines, 0)).toBe(312);
    expect(standardLpt({ vintLines: 2 }).reduce((n, b) => n + b.lines, 0)).toBe(312);
  });

  it("loads at the base it names", async () => {
    const s = await createEpSession();
    bareMachine(s);
    loadLpt(s, standardLpt(), 0x1000);
    expect(s.nick().lptBase).toBe(0x1000);
  });
});
