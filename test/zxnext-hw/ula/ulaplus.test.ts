import { describe, expect, it } from "vitest";

import { displayFileAddress, type NextTestSession } from "../../harness/zxnext";
import { colours, hex8, PAPER_LEFT, PAPER_TOP, parkedSession, writePalette } from "./_ula-helpers";

/*
 * ULA+ beyond the ports and the basic decode (catalogue ULP-005 - ULP-008; ULP-001 - ULP-003 are in
 * ulaplus-ports, ULP-004 in ulanext-ulaplus).
 *
 * Hardware:
 * - zxula.vhd ~533-541: with ULA+ on, index = "11" & attr(7:6) & (screen_mode(2) or not pixel_en) &
 *   (ink: attr(2:0) | paper: attr(5:3)); no FLASH, no BRIGHT. Any screen mode: in HiColor the
 *   attribute is the per-line byte at $6000; in HiRes attr_reg is border_clr_tmx = "01" & not n & n
 *   (n = port $FF bits 5-3) in the paper and the border, and screen_mode(2) forces index bit 3, so ink
 *   is $D8 + n, paper and border $D8 + 7 - n.
 * - zxnext.vhd ~4520-4533: group 01 data bit 0 (or $68 bit 3) is the enable only; the palette entries
 *   are ordinary ULA palette RAM, untouched by it. A reset clears the enable (~4526) and the $BF3B mode
 *   and index (~4508).
 * - ~2395, ~2641-2642: both ports decode only with internal_port_enable(24) = NextReg $85 bit 0
 *   (~2348: $85 bits 3-0 are enable bits 27-24; ~5484-5485: bit 7 is the reset type, kept at 1 here).
 *   A disabled port is not decoded at all, so a read returns $FF (PORT-011); $68 bit 3 still works.
 */

const FALLBACK = 0x4d;

async function screen(palette: Array<[number, number]>): Promise<NextTestSession> {
  const s = await parkedSession();
  writePalette(s, palette);
  s.setNextReg(0x14, 0xe3).setNextReg(0x4a, FALLBACK);
  s.poke(0x4000, new Array(0x1800).fill(0x00)).poke(0x6000, new Array(0x1800).fill(0x00));
  for (let line = 0; line < 8; line++) s.poke(displayFileAddress(line, 0), 0xf0);
  return s;
}

/** Ink (buffer x 96-103), paper (104-111) of cell (0, 0) on paper line `line`, and the left border. */
const cell = (s: NextTestSession, line = 0) => ({
  ink: colours(s, [PAPER_LEFT, PAPER_LEFT + 7], [PAPER_TOP + line, PAPER_TOP + line]),
  paper: colours(s, [PAPER_LEFT + 8, PAPER_LEFT + 15], [PAPER_TOP + line, PAPER_TOP + line]),
  border: colours(s, [0, 95], [48, 239])
});

/** $FF3B group 01 write: the ULA+ enable. */
const ulaPlus = (s: NextTestSession, on: boolean) => s.out(0xbf3b, 0x40).out(0xff3b, on ? 0x01 : 0x00);

describe("ULA+", () => {
  it("ULP-005: disabling ULA+ restores the standard colours and keeps the ULA+ palette entries", async () => {
    // --- attr $9A (group 2, paper 3, ink 2): ULA+ ink $E2, paper $EB; border 5 -> $CD.
    // --- Standard: ink 2, paper 16 + 3; border 16 + 5 (FLASH set: attr bit 7 - swapped every 16 frames)
    const s = await screen([[0xe2, 0xe0], [0xeb, 0x1c], [0xcd, 0x03], [2, 0xfc], [19, 0x1f], [21, 0xa2]]);
    s.poke(0x5800, new Array(768).fill(0x1a)).out(0xfe, 5); // --- $1A: no FLASH, group 0 - used for standard
    s.poke(0x5800, 0x9a);
    ulaPlus(s, true).runFrames(2);
    expect(cell(s), "ULA+ on").toEqual({ ink: hex8(0xe0), paper: hex8(0x1c), border: hex8(0x03) });
    // --- off: attr $9A in standard mode is FLASH | paper 3 | ink 2; look at a no-FLASH cell instead
    s.poke(0x5800, 0x1a);
    ulaPlus(s, false).runFrames(1);
    expect(cell(s), "ULA+ off").toEqual({ ink: hex8(0xfc), paper: hex8(0x1f), border: hex8(0xa2) });
    // --- the entries are still there: read back through $40/$41, and on again shows them
    const entry = (i: number) => s.setNextReg(0x40, i).readNextReg(0x41);
    s.setNextReg(0x43, 0x00);
    expect([entry(0xe2), entry(0xeb), entry(0xcd)], "palette kept").toEqual([0xe0, 0x1c, 0x03]);
    s.poke(0x5800, 0x9a);
    ulaPlus(s, true).runFrames(1);
    expect(cell(s), "ULA+ on again").toEqual({ ink: hex8(0xe0), paper: hex8(0x1c), border: hex8(0x03) });
  });

  it("ULP-005: a soft reset turns ULA+ off and clears the $BF3B mode and index", async () => {
    const s = await screen([]);
    ulaPlus(s, true);
    s.out(0xbf3b, 0x40); // --- mode group 01
    expect(s.in(0xff3b), "enabled").toBe(0x01);
    s.reset();
    expect(s.readNextReg(0x68) & 0x08, "$68 bit 3").toBe(0x00);
    // --- mode group 00, index 0 after the reset: $FF3B reads palette entry $C0 (not the enable)
    writePalette(s, [[0xc0, 0x5a]]);
    expect(s.in(0xff3b), "group 00, index 0: entry $C0 in GRB order").toBe(((0x5a >> 2) & 7) << 5 | ((0x5a >> 5) & 7) << 2 | (0x5a & 3));
  });

  it("ULP-006: in HiColor every line's attribute goes through the ULA+ mapping", async () => {
    // --- line 0 attr $9A: ink $E2, paper $EB; line 1 attr $47 (group 1, paper 0, ink 7): ink $D7, paper $D8
    const s = await screen([[0xe2, 0xe0], [0xeb, 0x1c], [0xd7, 0xfc], [0xd8, 0x1f], [0xcd, 0x03]]);
    s.poke(displayFileAddress(0, 0) + 0x2000, 0x9a).poke(displayFileAddress(1, 0) + 0x2000, 0x47);
    s.out(0xfe, 5).out(0x00ff, 0x02);
    ulaPlus(s, true).runFrames(2);
    expect([cell(s, 0), cell(s, 1)]).toEqual([
      { ink: hex8(0xe0), paper: hex8(0x1c), border: hex8(0x03) },
      { ink: hex8(0xfc), paper: hex8(0x1f), border: hex8(0x03) }
    ]);
  });

  it("ULP-007: with $85 bit 0 clear the ULA+ ports do nothing; $68 bit 3 still enables ULA+", async () => {
    const s = await screen([[0xe2, 0x00]]);
    const entryE2 = () => s.setNextReg(0x43, 0x00).setNextReg(0x40, 0xe2).readNextReg(0x41);
    s.setNextReg(0x85, 0x8e); // --- enable bits 27-24 = 1110, reset type 1
    expect(s.readNextReg(0x85), "$85 readback").toBe(0x8e);
    s.out(0xbf3b, 0x22).out(0xff3b, 0xff);
    expect(entryE2(), "palette write ignored").toBe(0x00);
    ulaPlus(s, true);
    expect(s.readNextReg(0x68) & 0x08, "enable write ignored").toBe(0x00);
    expect(s.in(0xff3b), "not decoded: an unmapped read").toBe(0xff);
    s.setNextReg(0x68, 0x08);
    expect(s.readNextReg(0x68) & 0x08, "$68 bit 3").toBe(0x08);
    // --- enabled again: the ports work
    s.setNextReg(0x85, 0x8f);
    s.out(0xbf3b, 0x22).out(0xff3b, 0xff);
    expect(entryE2(), "palette write").toBe(0xff);
  });

  for (const n of [0, 2, 7]) {
    it(`ULP-008: HiRes with ink ${n} and ULA+: ink $${(0xd8 + n).toString(16).toUpperCase()}, paper and border $${(0xd8 + 7 - n).toString(16).toUpperCase()}`, async () => {
      const s = await screen([[0xd8 + n, 0xe0], [0xd8 + 7 - n, 0x1c], [8 + n, 0xfc], [24 + 7 - n, 0x1f]]);
      s.poke(displayFileAddress(0, 0), 0xff).out(0x00ff, 0x06 | (n << 3));
      ulaPlus(s, true).runFrames(2);
      expect({
        ink: colours(s, [PAPER_LEFT, PAPER_LEFT + 7], [PAPER_TOP, PAPER_TOP]),
        paper: colours(s, [PAPER_LEFT + 8, PAPER_LEFT + 511], [PAPER_TOP + 1, PAPER_TOP + 191]),
        border: colours(s, [0, 95], [48, 239])
      }).toEqual({ ink: hex8(0xe0), paper: hex8(0x1c), border: hex8(0x1c) });
    });
  }
});
