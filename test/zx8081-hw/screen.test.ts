import { describe, expect, it } from "vitest";

import { createZx81Session, Zx81TestSession } from "../harness/zx81";
import { expectGolden } from "./goldens";

/**
 * The ZX81 picture, built from the ULA's refresh fetches on the real ROM (`.plans/ZX8081_WASM_PLAN.md`
 * §7, §12): the boot screen, the character set (inverse included), PLOT, FAST mode, and a hi-res
 * program. The pictures were checked by eye before they were recorded.
 */
/** A character's 8 x 8 glyph from the ROM's character set ($1E00), as `pixelArt` draws it */
function romGlyph(s: Zx81TestSession, code: number): string[] {
  return [0, 1, 2, 3, 4, 5, 6, 7].map((row) => {
    const bits = s.peek(0x1e00 + code * 8 + row);
    return [0, 1, 2, 3, 4, 5, 6, 7].map((bit) => (bits & (0x80 >> bit) ? "#" : ".")).join("");
  });
}

describe("ZX81 screen", () => {
  it("the boot screen", async () => {
    const s = await createZx81Session();
    s.bootToBasic();
    expectGolden("boot", s.screenPixels());
  });

  it("the whole character set and its inverse (basic/Characters.P)", async () => {
    const s = await createZx81Session();
    s.bootToBasic();
    // --- The file was saved in FAST mode (its CDFLAG says so), where a running program has no
    // --- picture: type SLOW (SHIFT+D) before RUN
    s.loadProgram(Zx81TestSession.readProgram("basic/Characters.P"), { autoRun: false });
    expect(s.peek(0x403b) & 0x80).toBe(0);
    s.typeChords([0, 7], [30]);
    s.runFrames(30);
    s.typeKeys("R\n", { settle: 0 });
    // --- It ends with SAVE, which blacks the screen out (VSYNC on): stop at the ROM's SAVE ($02F6)
    s.runTo(0x02f6, { maxFrames: 3000 });
    expect(s.screenText()[7]).not.toBe("");
    expectGolden("characters", s.screenPixels());
    // --- Row 2 of the output starts with "4": "4[4]5[5]...9[9]" fills columns 0-11, so "A" (code
    // --- $26) is at column 12; each cell is compared with the ROM's glyph
    expect(s.pixelArt(48 + 12 * 8, 48 + 2 * 8, 8, 8)).toEqual(romGlyph(s, 0x26));
    // --- ...and its inverse, in the next cell
    expect(s.pixelArt(48 + 13 * 8, 48 + 2 * 8, 8, 8)).toEqual(
      romGlyph(s, 0x26).map((row) => row.replace(/[#.]/g, (c) => (c === "#" ? "." : "#")))
    );
  });

  it("PLOT 0,0 lights the bottom-left quarter of the upper screen's last character cell", async () => {
    const s = await createZx81Session();
    s.bootToBasic();
    // --- K mode: Q is PLOT; SHIFT+. is the comma
    s.typeKeys("Q0,0\n", { settle: 30 });
    expect(s.screenText()[23]).toBe("0/0");
    // --- 64 x 44 plot points of 4 x 4 pixels; y = 0 is the bottom half of row 21
    const cell = s.pixelArt(48, 48 + 21 * 8, 8, 8);
    expect(cell).toEqual(["........", "........", "........", "........", "####....", "####....", "####....", "####...."]);
  });

  it("FAST mode shows no picture while a program runs (the TV loses its frame sync)", async () => {
    const s = await createZx81Session();
    s.bootToBasic();
    // --- SHIFT+F in K mode is FAST
    s.typeChords([0, 8], [30]);
    s.runFrames(30);
    // --- Waiting for a key, the ROM still displays in FAST mode
    expect(s.wasm.zx8081GetLastFrameLines()).toBeLessThan(330);
    // --- 10 GOTO 10, RUN: no display at all; the TV's vertical oscillator ends each frame
    s.typeKeys("10G10\n", { settle: 30 });
    s.typeKeys("R\n", { settle: 60 });
    expect(s.screenText().filter(Boolean)).toEqual([]);
    expect(s.wasm.zx8081GetLastFrameLines()).toBe(390);
    expectGolden("fast-running", s.screenPixels());
  });

  it("hi-res (WRX) graphics: in RAM, the refresh reads the CPU's own I:R (hi-res/hrg.p)", async () => {
    // --- The ULA substitutes A0-A8 for the ROM only; RAM sees I:R, which is what WRX hi-res uses.
    // --- Read at the character address instead, this program draws stripes (checked by mutation).
    const s = await createZx81Session();
    s.bootToBasic();
    s.insertProgram(Zx81TestSession.readProgram("hi-res/hrg.p"));
    s.typeKeys('J""\n', { settle: 0 });
    s.runFrames(400);
    expectGolden("hrg", s.screenPixels());
  });

  it("a machine-code program fills the screen after S (machine-code/dezog-sample.p)", async () => {
    const s = await createZx81Session();
    s.bootToBasic();
    s.insertProgram(Zx81TestSession.readProgram("machine-code/dezog-sample.p"));
    s.typeKeys('J""\n', { settle: 0 });
    s.runFrames(400);
    s.typeKeys("S", { settle: 100 });
    expectGolden("dezog-sample", s.screenPixels());
  });
});
