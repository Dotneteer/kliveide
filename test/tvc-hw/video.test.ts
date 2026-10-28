import { describe, expect, it } from "vitest";

import { createTvcSession } from "../harness/tvc";
import { bareMachine, beam, PAL, PAPER_LEFT, PAPER_TOP, paperDots, pixel, pokePaper, RGB, stepUntil, writeCrtc, ROM_CRTC } from "./bare";

/*
 * The TVC video path (`.plans/VIDEOTON_TVC_PLAN.md` §7; every fact from
 * `_input/videoton-tvc/TVC_VIDEO_GENERATION.md`, the part named in each test).
 */

describe("TVC video: from byte to pixels (Part 6)", () => {
  it("2-colour: bit 7 first; 0 shows palette 0, 1 palette 1", async () => {
    const s = await createTvcSession();
    bareMachine(s);
    s.wasm.tvcWritePort(0x06, 0x00);
    s.wasm.tvcWritePort(0x60, PAL.black);
    s.wasm.tvcWritePort(0x61, PAL.white);
    pokePaper(s, 0, 0, 0xb4);
    s.runFrames(2);
    const w = RGB.brightWhite;
    const k = RGB.black;
    expect(paperDots(s, 0, 0)).toEqual([w, k, w, w, k, w, k, k]);
  });

  it("4-colour: pixel n is palette[2 * bit(3-n) + bit(7-n)], each two dots wide (the worked byte B4h)", async () => {
    const s = await createTvcSession();
    bareMachine(s);
    s.wasm.tvcWritePort(0x06, 0x01);
    [PAL.black, PAL.blue, PAL.red, PAL.green].forEach((v, i) => s.wasm.tvcWritePort(0x60 + i, v));
    pokePaper(s, 0, 0, 0xb4);
    s.runFrames(2);
    // --- B4h: pixel 0 = 2*0+1 = 1, pixel 1 = 2*1+0 = 2, pixel 2 = 2*0+1 = 1, pixel 3 = 2*0+1 = 1
    const b = RGB.darkBlue;
    const r = RGB.darkRed;
    expect(paperDots(s, 0, 0)).toEqual([b, b, r, r, b, b, b, b]);
  });

  it("16-colour: the left pixel is bits 7/5/3/1, the right 6/4/2/0, as I/G/R/B (mode 11 too)", async () => {
    for (const mode of [0x02, 0x03]) {
      const s = await createTvcSession();
      bareMachine(s);
      s.wasm.tvcWritePort(0x06, mode);
      pokePaper(s, 0, 0, 0xb4);
      s.runFrames(2);
      // --- B4h = 1011 0100: left I1 G1 R0 B0 (bright green), right I0 G1 R1 B0 (dark yellow)
      const g = RGB.brightGreen;
      const y = RGB.darkYellow;
      expect(paperDots(s, 0, 0), `mode ${mode}`).toEqual([g, g, g, g, y, y, y, y]);
    }
  });

  it("the palette takes I/G/R/B from bits 6/4/2/0, the border from bits 7/5/3/1 (Part 7)", async () => {
    const s = await createTvcSession();
    bareMachine(s);
    s.wasm.tvcWritePort(0x06, 0x00);
    // --- 82h on the border is bright blue; 51h in a palette entry is bright cyan
    s.wasm.tvcWritePort(0x00, 0x82);
    s.wasm.tvcWritePort(0x60, 0x51);
    s.runFrames(2);
    expect(pixel(s, PAPER_LEFT - 8, PAPER_TOP).toString(16)).toBe("ffff0000");
    expect(pixel(s, PAPER_LEFT, PAPER_TOP).toString(16)).toBe("ffffff00");
  });

  it("intensity brightens only the guns that are on: I alone is black (Part 7)", async () => {
    const s = await createTvcSession();
    bareMachine(s);
    s.wasm.tvcWritePort(0x06, 0x00);
    s.wasm.tvcWritePort(0x60, 0x40);
    s.runFrames(2);
    expect(pixel(s, PAPER_LEFT, PAPER_TOP).toString(16)).toBe("ff000000");
  });
});

describe("TVC video: paper, border and blanking (Part 8)", () => {
  it("places the paper 48 dots and 24 lines into the picture, the border around it", async () => {
    const s = await createTvcSession();
    bareMachine(s);
    s.wasm.tvcWritePort(0x06, 0x00);
    s.wasm.tvcWritePort(0x60, PAL.white);
    s.wasm.tvcWritePort(0x00, 0x08); // --- border dark red: R in bit 3
    s.runFrames(2);
    const red = RGB.darkRed;
    const white = RGB.brightWhite;
    // --- The first paper dot, and the border just before and after the paper
    expect(pixel(s, PAPER_LEFT - 1, PAPER_TOP)).toBe(red);
    expect(pixel(s, PAPER_LEFT, PAPER_TOP)).toBe(white);
    expect(pixel(s, PAPER_LEFT + 511, PAPER_TOP)).toBe(white);
    expect(pixel(s, PAPER_LEFT + 512, PAPER_TOP)).toBe(red);
    // --- The top and bottom border
    expect(pixel(s, 300, PAPER_TOP - 1)).toBe(red);
    expect(pixel(s, 300, PAPER_TOP + 239)).toBe(white);
    expect(pixel(s, 300, PAPER_TOP + 240)).toBe(red);
  });

  it("the 14.4 us horizontal blank from HS ends 20 dots into the picture: black there, border after", async () => {
    const s = await createTvcSession();
    bareMachine(s);
    s.wasm.tvcWritePort(0x00, 0x08);
    s.runFrames(2);
    // --- HS rises at character 75; 180 dots later is character 97, dot 4; the window starts at 95
    expect(pixel(s, 19, PAPER_TOP)).toBe(RGB.black);
    expect(pixel(s, 20, PAPER_TOP)).toBe(RGB.darkRed);
  });

  it("vertical blank: set at VS (line 264), released when MA9 first goes high - later for start 0000h", async () => {
    const releaseLine = async (start: number) => {
      const s = await createTvcSession();
      const crtc = [...ROM_CRTC];
      crtc[12] = start >> 8;
      crtc[13] = start & 0xff;
      bareMachine(s, { crtc });
      // --- Find the start of the next blank, then its end
      stepUntil(s, () => s.wasm.tvcGetVerticalBlank() === 0 && beam(s).line < 200);
      stepUntil(s, () => s.wasm.tvcGetVerticalBlank() !== 0, 400_000);
      const set = beam(s);
      stepUntil(s, () => s.wasm.tvcGetVerticalBlank() === 0);
      return { set: set.line, release: beam(s) };
    };
    // --- Start 0: MA reaches 1200h at character 64 of line 284 (row 71); 0040h: line 280; 0100h: 268
    const at0 = await releaseLine(0x0000);
    expect(at0.set).toBe(264);
    expect(at0.release.line).toBe(284);
    expect(Math.abs(at0.release.char - 65)).toBeLessThanOrEqual(2);
    expect((await releaseLine(0x0040)).release.line).toBe(280);
    expect((await releaseLine(0x0100)).release.line).toBe(268);
  });

  it("vertical blank: a start address with MA9 high at VS (0200h) blanks nothing", async () => {
    const s = await createTvcSession();
    const crtc = [...ROM_CRTC];
    crtc[12] = 0x02;
    bareMachine(s, { crtc });
    let blanked = false;
    for (let i = 0; i < 70_000 && !blanked; i++) {
      s.step(1);
      blanked = s.wasm.tvcGetVerticalBlank() !== 0;
    }
    expect(blanked).toBe(false);
  });

  it("a palette write lands at the character it happens in: the byte shown next takes the new colour", async () => {
    const s = await createTvcSession();
    bareMachine(s);
    s.wasm.tvcWritePort(0x06, 0x00);
    s.wasm.tvcWritePort(0x60, PAL.blue);
    s.runFrames(2);
    // --- Paper line 100: stop when the CRTC is about to run character 30
    stepUntil(s, () => beam(s).line === 100 && beam(s).char >= 30 && beam(s).char < 34);
    const char = beam(s).char;
    s.wasm.tvcWritePort(0x60, PAL.red);
    s.runFrames(1);
    // --- Character `char` shows byte `char - 1` (the one-character lag): from there on it is red
    expect(paperDots(s, 100, char - 2)[7]).toBe(RGB.darkBlue);
    expect(paperDots(s, 100, char - 1)[0]).toBe(RGB.darkRed);
  });
});

describe("TVC video: the frame interrupt (Part 10)", () => {
  it("is set at the end of the cursor pulse: character 64 of line 239, 47,928 T into the frame", async () => {
    const s = await createTvcSession();
    bareMachine(s);
    s.wasm.tvcWritePort(0x07, 0);
    stepUntil(s, () => s.wasm.tvcGetFrameTacts() < 1000);
    stepUntil(s, () => s.wasm.tvcGetItPending() !== 0);
    // --- The step that saw it ends within one halted cycle (4 T) of the edge
    const at = s.wasm.tvcGetFrameTacts();
    expect(at).toBeGreaterThanOrEqual(47_928);
    expect(at).toBeLessThan(47_928 + 4);
    // --- Port 59h bit 4 shows it (active low); any write to port 07h clears it
    expect(s.wasm.tvcReadPort(0x59) & 0x10).toBe(0);
    s.wasm.tvcWritePort(0x07, 0x5a);
    expect(s.wasm.tvcGetItPending()).toBe(0);
    expect(s.wasm.tvcReadPort(0x59) & 0x10).toBe(0x10);
  });

  it("follows the cursor registers: cursor at 0AFFh (VT-DOS's) fires at line 175", async () => {
    const s = await createTvcSession();
    bareMachine(s);
    writeCrtc(s, [...ROM_CRTC.slice(0, 14), 0x0a, 0xff]);
    s.wasm.tvcWritePort(0x07, 0);
    stepUntil(s, () => s.wasm.tvcGetFrameTacts() < 1000);
    stepUntil(s, () => s.wasm.tvcGetItPending() !== 0);
    expect(Math.floor(s.wasm.tvcGetFrameTacts() / 200)).toBe(175);
  });
});
