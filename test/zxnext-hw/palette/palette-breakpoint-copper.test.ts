import { describe, expect, it } from "vitest";

import type { NextTestSession } from "../../harness/zxnext";
import { parkedSession } from "../ula/_ula-helpers";

/*
 * Palette breakpoints and the Copper (`dev/plans/NEXT_PALETTE_DEBUGGING_PLAN.md` §3, D2): a Copper
 * write to the palette stops a `pal:` breakpoint only with `-c`, and the stop names the Copper as the
 * writer. The CPU's own writes are covered by test/wasm/zxNext/wasm-next-palette-breakpoint.test.ts.
 *
 * The list writes entry 16 of the selected palette (ULA 1, `$43` = 0) black at the top of the frame,
 * then green from line 96 - the `test/visual/copper/C03` shape.
 */

const MOVE = (reg: number, value: number) => ((reg & 0x7f) << 8) | (value & 0xff);
const WAIT = (line: number, h = 0) => 0x8000 | ((h & 0x3f) << 9) | (line & 0x1ff);
const HALT = 0xffff;
const C03 = [MOVE(0x40, 16), MOVE(0x41, 0x00), WAIT(96, 8), MOVE(0x40, 16), MOVE(0x41, 0x1c), HALT];

/** A parked CPU and the Copper running C03 in mode 11 (restart at raster (0,0) every frame) */
async function copperSession(): Promise<NextTestSession> {
  const s = await parkedSession();
  s.setNextReg(0x43, 0x00).setNextReg(0x62, 0x00).setNextReg(0x61, 0x00);
  for (const w of C03) s.setNextReg(0x60, w >> 8).setNextReg(0x60, w & 0xff);
  s.setNextReg(0x62, 0xc0);
  return s;
}

describe("palette breakpoints and the Copper", () => {
  it("a Copper write does not stop a breakpoint without -c", async () => {
    const s = await copperSession();
    s.attachDebugSupport().addBreakpoint({ paletteStop: "ula1:$10" });
    expect(() => s.continueToBreakpoint({ maxFrames: 3 })).toThrow(/No breakpoint hit/);
  });

  it("with -c it stops, and names the Copper as the writer", async () => {
    const s = await copperSession();
    s.attachDebugSupport().addBreakpoint({ paletteStop: "ula1:$10", paletteCopper: true });
    s.continueToBreakpoint({ maxFrames: 3 });
    expect(s.lastPaletteWrite()).toMatchObject({ kind: "entry", slot: 0, index: 0x10, origin: "copper", path: "$41" });
  });

  it("with -c and -changed it skips the write that stores the colour already there", async () => {
    const s = await copperSession();
    s.attachDebugSupport().addBreakpoint({ paletteStop: "ula1:$10", paletteCopper: true, paletteChanged: true });
    s.continueToBreakpoint({ maxFrames: 3 });
    const first = s.lastPaletteWrite()!;
    expect(first.oldValue).not.toBe(first.newValue);
    expect(first).toMatchObject({ origin: "copper", index: 0x10 });
  });
});
