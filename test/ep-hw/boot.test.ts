import { describe, expect, it } from "vitest";

import { createEpSession } from "../harness/enterprise";

/*
 * Booting EXOS 2.1 and IS-BASIC 2.1 on the Enterprise 128 (`.plans/ENTERPRISE_PLAN.md` Phase 1): the
 * RAM test, the ROM scan, the ENTERPRISE banner that waits for a key, and IS-BASIC's prompt. Phase 1
 * draws no pixels, so the screen is read the way NICK reads it: the LPT and the character codes its
 * character-mode blocks point at.
 */

describe("Enterprise 128 boot", () => {
  it("tests the RAM, shows the banner, and boots IS-BASIC with 128K", async () => {
    const s = await createEpSession();
    s.runUntil(() => s.screenText().includes("TESTING"), { maxFrames: 300 }, "the RAM test");
    expect(s.screenText()).toContain("EXOS 2.1");
    s.bootToBasic();
    const text = s.screenText();
    expect(text).toContain("IS-BASIC");
    expect(text).toContain("131072 bytes in system");
    expect(text).toMatch(/^ok$/m);
  });

  it("builds EXOS's display list: 28 text rows, then the bottom border, vertical sync and the top (observed, plan §13)", async () => {
    const s = await createEpSession();
    s.bootToBasic();
    const lpt = s.lpt();
    expect(lpt).toHaveLength(34);
    // --- The status line and 27 text rows: CH128, 9 lines each, VRES clear
    for (const block of lpt.slice(0, 28)) {
      expect([block.lines, block.mode, block.vres, block.vint, block.reload]).toEqual([9, 4, false, false, false]);
    }
    // --- Then the frame's tail: the VINT block, three VSYNC blocks (sync from slot 6 of the second to
    // --- slot 32 of the third), and two blank PIXEL blocks, the last one RELOAD
    const tail = lpt.slice(28).map((b) => [b.lines, b.mode, b.lm, b.rm, b.vint, b.reload]);
    expect(tail).toEqual([
      [14, 1, 63, 0, true, false],
      [3, 0, 63, 0, false, false],
      [4, 0, 6, 63, false, false],
      [1, 0, 63, 32, false, false],
      [4, 1, 6, 63, false, false],
      [34, 1, 63, 0, false, true]
    ]);
    expect(lpt.reduce((sum, b) => sum + b.lines, 0)).toBe(312);
  });

  it("runs frames of 312 NICK lines, 79 941.9 T, ending where vertical sync starts", async () => {
    const s = await createEpSession();
    s.bootToBasic();
    const before = s.wasm.epGetHalfClock();
    const frames = s.wasm.epGetFrames();
    s.runFrames(100);
    expect(s.wasm.epGetFrames() - frames).toBe(100);
    // --- 100 frames are 7 994 192 T; each frame ends on a slot boundary, so within one slot (4.5 T)
    const halves = (s.wasm.epGetHalfClock() - before) >>> 0;
    expect(Math.abs(halves / 2 - 7_994_192)).toBeLessThan(5);
    // --- The frame ends as sync turns on: the second VSYNC block, at its left margin (slot 6)
    expect(s.nick().vsyncOn).toBe(true);
    expect(s.wasm.epGetTactsInCurrentFrame()).toBeGreaterThanOrEqual(79_940);
    expect(s.wasm.epGetTactsInCurrentFrame()).toBeLessThanOrEqual(79_945);
  });

  it("leaves DAVE as EXOS sets it: M1-only waits (BFh = 04h), the 1 Hz and video interrupts on", async () => {
    const s = await createEpSession();
    s.bootToBasic();
    const dave = s.dave();
    // --- NICK_VIDEO_BACKGROUND.md OQ9: the EXOS book's "default mode", now read off the running ROM
    expect(dave.bf).toBe(0x04);
    expect(dave.enable & 0x14).toBe(0x14);
  });

  it("boots whatever NICK's port registers hold at power-on (they are random on a real machine)", async () => {
    for (const seed of [1, 0xdeadbeef, 0x12345678]) {
      const s = await createEpSession();
      s.wasm.epNickSetSeed(seed);
      s.machine.hardReset();
      s.bootToBasic();
      expect(s.screenText()).toContain("IS-BASIC");
    }
  });
});
