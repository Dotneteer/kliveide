import { describe, expect, it } from "vitest";

import { ALL_CORES, displayFileAddress, type CoreName, type NextTestSession } from "../../harness/zxnext";
import { colours, hex8, PAPER_LEFT, PAPER_TOP, parkedSession, writePalette } from "./_ula-helpers";

/*
 * ULANext (catalogue ULN-001, ULN-003, ULN-005 - ULN-008; ULN-002 / ULN-004 are in ulanext-ulaplus).
 *
 * Hardware:
 * - zxula.vhd ~491-530: with ULANext on, ink = attr AND format; paper = "1" & the attribute bits above
 *   the mask for the seven contiguous formats $01 $03 $07 $0F $1F $3F $7F, and *any other* format
 *   selects the fallback colour for paper (ula_select_bgnd); border = $80 + border colour, the fallback
 *   only for format $FF.
 * - ~451: pixel_en ignores attribute bit 7 (FLASH) with ULANext on; there is no BRIGHT offset.
 * - zxnext.vhd ~6771, ~6927: the ULA palette address is  '0' & $43 bit 1 & index  - the second palette
 *   for every index, 128+ included. ~7046: a ULA pixel is transparent when its RGB equals $14.
 * - zxnext.vhd ~4980-4987: reset sets $42 to $07 and clears $43 bit 0; ~5988-5991 both read back.
 *
 * The screen: cell (0, 0) has bitmap $F0 on all 8 lines (buffer x 96-103 ink, 104-111 paper, rows
 * 48-55), everything else blank with the same attribute; left border x 0-95.
 */

const FALLBACK = 0x4d;

async function screen(core: CoreName, attr: number, border: number, palette: Array<[number, number]>): Promise<NextTestSession> {
  const s = await parkedSession(core);
  writePalette(s, palette);
  s.setNextReg(0x14, 0xe3).setNextReg(0x4a, FALLBACK);
  s.poke(0x4000, new Array(0x1800).fill(0x00)).poke(0x5800, new Array(768).fill(attr));
  for (let line = 0; line < 8; line++) s.poke(displayFileAddress(line, 0), 0xf0);
  return s.out(0xfe, border);
}

const cell = (s: NextTestSession) => ({
  ink: colours(s, [PAPER_LEFT, PAPER_LEFT + 7], [PAPER_TOP, PAPER_TOP + 7]),
  paper: colours(s, [PAPER_LEFT + 8, PAPER_LEFT + 15], [PAPER_TOP, PAPER_TOP + 7]),
  border: colours(s, [0, 95], [48, 239])
});

const bitsOf = (format: number) => format.toString(2).replace(/0/g, "").length;

describe.each(ALL_CORES)("ULANext - %s core", (core: CoreName) => {
  it("ULN-001: $42 resets to $07 and $43 bit 0 to 0; both read back", async () => {
    const s = await parkedSession(core);
    expect([s.readNextReg(0x42), s.readNextReg(0x43) & 0x01], "after a hard reset").toEqual([0x07, 0x00]);
    s.setNextReg(0x42, 0x1f).setNextReg(0x43, 0x01);
    expect([s.readNextReg(0x42), s.readNextReg(0x43) & 0x01]).toEqual([0x1f, 0x01]);
    s.setNextReg(0x43, 0x00);
    expect(s.readNextReg(0x43) & 0x01).toBe(0x00);
    s.setNextReg(0x42, 0x3f).setNextReg(0x43, 0x01).reset();
    expect([s.readNextReg(0x42), s.readNextReg(0x43) & 0x01], "after a soft reset").toEqual([0x07, 0x00]);
  });

  for (const format of [0x01, 0x03, 0x07, 0x0f, 0x1f, 0x3f, 0x7f]) {
    it(`ULN-003: format $${format.toString(16).padStart(2, "0")}: ink = attr & format, paper = $80 | attr >> ${bitsOf(format)}`, async () => {
      const attr = 0xa5;
      const inkIndex = attr & format;
      const paperIndex = 0x80 | (attr >> bitsOf(format));
      const s = await screen(core, attr, 3, [[inkIndex, 0xe0], [paperIndex, 0x1c], [0x83, 0x03]]);
      s.setNextReg(0x42, format).setNextReg(0x43, 0x01).runFrames(2);
      expect(cell(s)).toEqual({ ink: hex8(0xe0), paper: hex8(0x1c), border: hex8(0x03) });
    });
  }

  for (const format of [0x05, 0x00, 0x80, 0xfe]) {
    it(`ULN-005: invalid format $${format.toString(16).padStart(2, "0")}: ink = attr & format, paper the fallback, border $80 + n`, async () => {
      const attr = 0xa5;
      const s = await screen(core, attr, 3, [[attr & format, 0xe0], [0x83, 0x03]]);
      s.setNextReg(0x42, format).setNextReg(0x43, 0x01).runFrames(2);
      expect(cell(s)).toEqual({ ink: hex8(0xe0), paper: hex8(FALLBACK), border: hex8(0x03) });
    });
  }

  it("ULN-006: no FLASH and no BRIGHT: bits 7-6 are part of the paper index", async () => {
    // --- attr $C5 (FLASH, BRIGHT, paper 0, ink 5), format $07: ink 5, paper $80 | $18 = $98
    const s = await screen(core, 0xc5, 3, [[5, 0xe0], [13, 0xfc], [0x98, 0x1c], [0x83, 0x03]]);
    s.setNextReg(0x42, 0x07).setNextReg(0x43, 0x01).runFrames(2);
    const seen = new Set<string>();
    for (let f = 0; f < 40; f++) {
      s.runFrames(1);
      seen.add(JSON.stringify(cell(s)));
    }
    expect([...seen].map((c) => JSON.parse(c))).toEqual([{ ink: hex8(0xe0), paper: hex8(0x1c), border: hex8(0x03) }]);
  });

  it("ULN-007: $43 bit 1 selects the second ULA palette for the 128+ entries too", async () => {
    // --- format $07, attr $5B: ink 3, paper $8B; border 2: $82
    const s = await screen(core, 0x5b, 2, [[3, 0xe0], [0x8b, 0x1c], [0x82, 0x03]]);
    writePalette(s, [[3, 0xfc], [0x8b, 0x1f], [0x82, 0xa2]], 0x40); // --- second ULA palette
    s.setNextReg(0x42, 0x07).setNextReg(0x43, 0x01).runFrames(2);
    expect(cell(s), "first palette").toEqual({ ink: hex8(0xe0), paper: hex8(0x1c), border: hex8(0x03) });
    s.setNextReg(0x43, 0x03).runFrames(1);
    expect(cell(s), "second palette").toEqual({ ink: hex8(0xfc), paper: hex8(0x1f), border: hex8(0xa2) });
  });

  it("ULN-008: ink, paper and border colours equal to $14 are transparent (the fallback shows)", async () => {
    const T = 0x6d;
    // --- format $07, attr $5B: ink 3, paper $8B; border 2: $82 - all three hold the $14 colour in turn
    for (const [index, part] of [[3, "ink"], [0x8b, "paper"], [0x82, "border"]] as const) {
      const s = await screen(core, 0x5b, 2, [[3, 0xe0], [0x8b, 0x1c], [0x82, 0x03]]);
      writePalette(s, [[index, T]]);
      s.setNextReg(0x14, T).setNextReg(0x42, 0x07).setNextReg(0x43, 0x01).runFrames(2);
      const want = { ink: hex8(0xe0), paper: hex8(0x1c), border: hex8(0x03), [part]: hex8(FALLBACK) };
      expect(cell(s), part).toEqual(want);
    }
  });

  /*
   * ULN-009: ULANext in Timex HiRes. zxula.vhd ~431: attr_reg is border_clr_tmx = "01" & not n & n
   * (n = port $FF bits 5-3) in the paper and the border, and goes through the same ULANext decode:
   * ink = attr AND format, paper per format, border $80 + attr(5:3) = $80 + 7 - n; format $FF: paper and
   * border the fallback.
   */
  for (const [format, n] of [[0x07, 2], [0x0f, 5], [0xff, 2]] as const) {
    it(`ULN-009: HiRes with ink ${n} and ULANext format $${format.toString(16).padStart(2, "0")}`, async () => {
      const attr = 0x40 | ((7 - n) << 3) | n;
      const inkIndex = attr & format;
      const paperIndex = format === 0xff ? -1 : 0x80 | (attr >> bitsOf(format));
      const s = await screen(core, 0x38, 0, [[inkIndex, 0xe0], ...(paperIndex >= 0 ? [[paperIndex, 0x1c] as [number, number]] : []), [0x80 + 7 - n, 0x03]]);
      s.poke(0x6000, new Array(0x1800).fill(0x00)); // --- HiRes shows the $6000 bytes too
      s.poke(displayFileAddress(0, 0), 0xff).out(0x00ff, 0x06 | (n << 3));
      s.setNextReg(0x42, format).setNextReg(0x43, 0x01).runFrames(2);
      expect({
        ink: colours(s, [PAPER_LEFT, PAPER_LEFT + 7], [PAPER_TOP, PAPER_TOP]),
        paper: colours(s, [PAPER_LEFT + 8, PAPER_LEFT + 511], [PAPER_TOP + 1, PAPER_TOP + 191]),
        border: colours(s, [0, 95], [48, 239])
      }).toEqual({
        ink: hex8(0xe0),
        paper: hex8(format === 0xff ? FALLBACK : 0x1c),
        border: hex8(format === 0xff ? FALLBACK : 0x03)
      });
    });
  }
});
