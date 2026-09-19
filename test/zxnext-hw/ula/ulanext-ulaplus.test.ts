import { describe, expect, it } from "vitest";

import { createSession, displayFileAddress, type NextTestSession, type Probe } from "../../harness/zxnext";

/*
 * B7 - ULANext and ULA+ palette indexing of ink, paper and border.
 *
 * Hardware (`_input/next-fpga/src/video/zxula.vhd` ~484-553, "Standard ULA, ULAnext, ULA+"):
 * - ULANext (NextReg $43 bit 0), format f = NextReg $42:
 *   ink    = attr and f
 *   paper  = "1" & attr(7:1) for f=$01, "10" & attr(7:2) for $03, ..., "1000000" & attr(7) for $7F,
 *            i.e. $80 | (attr >> bits(f)); any other format (incl. $FF) selects the fallback colour
 *   border = "10000" & border colour  = $80 + border; format $FF selects the fallback colour
 *   no FLASH (pixel_en ignores attr(7) when ulanext_en).
 * - ULA+ (`ulap_en`, NextReg $68 bit 3 - zxnext.vhd ~4531):
 *   index  = "11" & attr(7:6) & (screen_mode(2) or not pixel_en) & (ink: attr(2:0) | paper: attr(5:3))
 *   border = attr "00" & border & border -> $C8 + border; no BRIGHT, no FLASH.
 * Palette entries are 8-bit values written through $40/$41 on the first ULA palette ($43 = 0).
 *
 * The screen: attribute cell 0 has bitmap $F0 on all 8 lines, so buffer x 96-103 is ink and 104-111
 * paper on buffer rows 48-55; the left border beside it is x 0-95.
 */

const INK: Probe["kind"] = "rect";

async function screenWith(
  setup: { nextRegs: Array<[number, number]>; attr: number; border: number; palette: Array<[number, number]> }
): Promise<NextTestSession> {
  const s = await createSession();
  await s.loadCode(` .org $8000\n jr $`);
  s.setNextReg(0x43, 0x00); // --- first ULA palette, auto-increment on
  for (const [index, rgb] of setup.palette) s.setNextReg(0x40, index).setNextReg(0x41, rgb);
  s.setNextReg(0x14, 0xe3).setNextReg(0x4a, 0x4a); // --- fallback: a colour no entry uses
  for (let row = 0; row < 8; row++) s.poke(displayFileAddress(row, 0), 0xf0);
  s.poke(0x5800, setup.attr);
  s.out(0xfe, setup.border);
  for (const [reg, value] of setup.nextRegs) s.setNextReg(reg, value);
  return s.runFrames(2);
}

const cell = (s: NextTestSession, expected: { ink: string; paper: string; border: string }) => {
  const at = (x: [number, number], rgb: string) => {
    try {
      s.expectProbe({ kind: INK, x, y: [48, 55], rgb } as Probe);
      return "ok";
    } catch (e) {
      return (e as Error).message;
    }
  };
  expect({ ink: at([96, 103], expected.ink), paper: at([104, 111], expected.paper), border: at([0, 95], expected.border) }).toEqual({
    ink: "ok",
    paper: "ok",
    border: "ok"
  });
};

describe("ULANext / ULA+ colours", () => {
  it("ULANext format $07: ink = attr & 7, paper = $80 | attr >> 3, border = $80 + border", async () => {
    // --- attr $5B: ink 3, paper $80 | $0B = $8B; border 2 -> $82
    const s = await screenWith({
      nextRegs: [[0x42, 0x07], [0x43, 0x01]],
      attr: 0x5b,
      border: 2,
      palette: [[0x03, 0xe0], [0x8b, 0x1c], [0x82, 0x03]]
    });
    cell(s, { ink: "next8:0xE0", paper: "next8:0x1C", border: "next8:0x03" });
  });

  it("ULANext format $0F: ink = attr & $0F, paper = $80 | attr >> 4", async () => {
    // --- attr $A7: ink 7, paper $80 | $0A = $8A; border 5 -> $85
    const s = await screenWith({
      nextRegs: [[0x42, 0x0f], [0x43, 0x01]],
      attr: 0xa7,
      border: 5,
      palette: [[0x07, 0xfc], [0x8a, 0x1f], [0x85, 0xa2]]
    });
    cell(s, { ink: "next8:0xFC", paper: "next8:0x1F", border: "next8:0xA2" });
  });

  it("ULANext format $FF: ink = attr, paper and border use the fallback colour", async () => {
    // --- attr $C5: ink $C5
    const s = await screenWith({
      nextRegs: [[0x42, 0xff], [0x43, 0x01]],
      attr: 0xc5,
      border: 1,
      palette: [[0xc5, 0xe0], [0x81, 0x1c]]
    });
    cell(s, { ink: "next8:0xE0", paper: "next8:0x4A", border: "next8:0x4A" });
  });

  /*
   * The fallback colour replaces the palette colour *before* the global transparency compare
   * (zxnext.vhd ~6933 `ula_rgb_1 <= fallback_rgb_1 ...`, ~7046 `ula_mix_transparent` on `ula_rgb_2`),
   * so a format-$FF paper or border is transparent when $4A equals $14, and the layer below shows.
   * Layer 2 320x256 (buffer x 32-671, rows 16-271) sits below the ULA in order USL ($15 = $10).
   */
  it(
    "ULANext format $FF: a fallback paper and border equal to $14 are transparent (B7 residual, fixed)",
    async () => {
      const s = await createSession();
      await s.loadCode(`
        .org $8000
        nextreg $70,$10          ; Layer 2 320x256, palette offset 0
        nextreg $12,$08          ; bank 8 = 8K pages 16-25
        ld a,16
        ld b,10
Fill:   nextreg $56,a
        push af
        push bc
        ld hl,$C000
        ld (hl),$21              ; Layer 2 pixel index $21 everywhere
        ld de,$C001
        ld bc,$1FFF
        ldir
        pop bc
        pop af
        inc a
        djnz Fill
        nextreg $56,$00
        nextreg $7F,$A5
        jr $
      `);
      s.runUntilReady();
      s.setNextReg(0x43, 0x10).setNextReg(0x40, 0x21).setNextReg(0x41, 0x1c); // --- Layer 2 palette: $21 green
      s.setNextReg(0x43, 0x00).setNextReg(0x40, 0xc5).setNextReg(0x41, 0xe0); // --- ULA palette: ink $C5 red
      for (let row = 0; row < 8; row++) s.poke(displayFileAddress(row, 0), 0xf0);
      s.poke(0x5800, 0xc5);
      s.out(0xfe, 1);
      s.setNextReg(0x14, 0x6d).setNextReg(0x4a, 0x6d); // --- fallback == global transparency
      s.setNextReg(0x42, 0xff).setNextReg(0x43, 0x01); // --- ULANext, format $FF
      s.setNextReg(0x15, 0x10); // --- USL: ULA above Layer 2
      s.setNextReg(0x69, 0x80).runFrames(2); // --- Layer 2 on
      const at = (x: [number, number], rgb: string) => {
        try {
          s.expectProbe({ kind: "rect", x, y: [48, 55], rgb } as Probe);
          return "ok";
        } catch (e) {
          return (e as Error).message;
        }
      };
      expect({
        ink: at([96, 103], "next8:0xE0"),
        paper: at([104, 111], "next8:0x1C"),
        border: at([32, 95], "next8:0x1C")
      }).toEqual({ ink: "ok", paper: "ok", border: "ok" });
    }
  );

  it("ULA+: ink = $C0 + group*16 + ink, paper = $C8 + group*16 + paper, border = $C8 + border", async () => {
    // --- attr $9A = group 2, paper 3, ink 2: ink $E2, paper $EB; border 5 -> $CD
    const s = await screenWith({
      nextRegs: [[0x68, 0x08]],
      attr: 0x9a,
      border: 5,
      palette: [[0xe2, 0xe0], [0xeb, 0x1c], [0xcd, 0x03]]
    });
    cell(s, { ink: "next8:0xE0", paper: "next8:0x1C", border: "next8:0x03" });
  });

  /*
   * zxula.vhd ~491-553: `if i_ulanext_en ... elsif i_ulap_en ... else` (standard) - ULANext wins over
   * ULA+, and with both off the standard mapping applies (border 16 + n). Covers the precedence the
   * removed field-level tests in test/zxnext/UlaRendering.test.ts (D1, D3) checked.
   */
  it("ULANext takes precedence over ULA+; with both off the standard mapping applies", async () => {
    // --- attr $5B: ULANext $07 -> ink 3, paper $8B, border 2 -> $82
    // ---           ULA+ (group 1) -> ink $D3, paper $DB, border $CA
    // ---           standard (BRIGHT) -> ink 11, paper 27, border 18
    const s = await screenWith({
      nextRegs: [[0x42, 0x07], [0x68, 0x08], [0x43, 0x01]],
      attr: 0x5b,
      border: 2,
      palette: [
        [0x03, 0xe0], [0x8b, 0x1c], [0x82, 0x03],
        [0xd3, 0xfc], [0xdb, 0x1f], [0xca, 0xa2],
        [11, 0x6d], [27, 0x92], [18, 0x49]
      ]
    });
    cell(s, { ink: "next8:0xE0", paper: "next8:0x1C", border: "next8:0x03" });
    s.setNextReg(0x43, 0x00).runFrames(1); // --- ULANext off: ULA+ applies
    cell(s, { ink: "next8:0xFC", paper: "next8:0x1F", border: "next8:0xA2" });
    s.setNextReg(0x68, 0x00).runFrames(1); // --- ULA+ off: standard
    cell(s, { ink: "next8:0x6D", paper: "next8:0x92", border: "next8:0x49" });
  });
});
