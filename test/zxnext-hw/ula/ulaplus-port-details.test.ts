import { describe, expect, it } from "vitest";

import { createSession, type NextTestSession } from "../../harness/zxnext";

/*
 * ULA+ port details ported from the "ULA+ Ports" part of test/zxnext/NextComposedScreenDevice.test.ts
 * (the ones not already in ulaplus-ports.test.ts / ulaplus.test.ts).
 *
 * Hardware (`_input/next-fpga/src/zxnext.vhd`):
 * - ~4504-4517: a $BF3B write stores the mode group (bits 7-6); only group "00" also stores the index.
 * - ~4523-4531: `port_ff3b_ulap_en` changes only on a $FF3B write in group "01" (or a NextReg $68
 *   write); writes in groups "10" / "11" do nothing.
 * - ~4538-4547: a $FF3B read in any group but "00" returns "0000000" & ulap_en.
 * - ~2759-2762, ~1828-1833: $BF3B has no read data (`port_bf3b` is not in `port_internal_rd_response`),
 *   so a read of it is an unmapped read: $FF with the expansion bus off.
 * - ~4720-4724: a group-00 $FF3B write is a palette write through NextReg "$FF" (`nr_ff_we`), data
 *   reordered GGGRRRBB -> RRRGGGBB; ~6904: its address is '0' & $43 bit 6 & "11" & index - always a ULA
 *   palette (bit 9 = 0), the first or second by $43 bit 6 alone, entry $C0 + the 6-bit index.
 * Entries are read back through $40/$41 ($41 = the colour's bits 8-1, RRRGGGBB), selected by $43.
 */

const grb = (r: number, g: number, b: number) => ((g & 7) << 5) | ((r & 7) << 2) | (b & 3);
const rgb8 = (r: number, g: number, b: number) => ((r & 7) << 5) | ((g & 7) << 2) | (b & 3);

async function session(): Promise<NextTestSession> {
  const s = await createSession();
  await s.loadCode(" .org $8000\n di\n jr $");
  return s;
}

/** The 8-bit value ($41 read) of entry `index` of the palette `select` ($43 bits 6-4 value). */
const entry = (s: NextTestSession, select: number, index: number) => s.setNextReg(0x43, select).setNextReg(0x40, index).readNextReg(0x41);

describe("ULA+ port details", () => {
  it("$BF3B cannot be read: it returns $FF", async () => {
    const s = await session();
    s.out(0xbf3b, 0x05);
    expect(s.in(0xbf3b)).toBe(0xff);
    s.out(0xbf3b, 0x40);
    expect(s.in(0xbf3b)).toBe(0xff);
  });

  it("$FF3B writes in mode groups 10 and 11 change nothing; reads there return the enable", async () => {
    const s = await session();
    s.out(0xbf3b, 0x40).out(0xff3b, 0x01); // --- ULA+ on
    s.out(0xbf3b, 0x80).out(0xff3b, 0x00);
    expect({ port: s.in(0xff3b), nr68: s.readNextReg(0x68) & 0x08 }, "group 10 write ignored").toEqual({ port: 0x01, nr68: 0x08 });
    s.out(0xbf3b, 0xc0).out(0xff3b, 0x00);
    expect({ port: s.in(0xff3b), nr68: s.readNextReg(0x68) & 0x08 }, "group 11 write ignored").toEqual({ port: 0x01, nr68: 0x08 });
    s.setNextReg(0x68, 0x00);
    expect([0x40, 0x80, 0xc0].map((g) => (s.out(0xbf3b, g), s.in(0xff3b))), "$68 bit 3 cleared: every group reads 0").toEqual([0, 0, 0]);
    s.setNextReg(0x68, 0x08);
    expect([0x40, 0x80, 0xc0].map((g) => (s.out(0xbf3b, g), s.in(0xff3b))), "$68 bit 3 set: every group reads 1").toEqual([1, 1, 1]);
  });

  it("$FF3B writes in groups 01, 10 and 11 never write the palette, whatever the index was", async () => {
    // --- (That a group-01 $BF3B write keeps the index is not observable: only a group-00 $BF3B write,
    // --- which sets the index again, makes $FF3B reach the palette.)
    const s = await session();
    for (const i of [0xc8, 0xcf]) s.setNextReg(0x43, 0x00).setNextReg(0x40, i).setNextReg(0x41, 0x00);
    s.out(0xbf3b, 0x08).out(0xbf3b, 0x4f).out(0xff3b, 0xff).out(0xbf3b, 0x8f).out(0xff3b, 0xff).out(0xbf3b, 0xc8).out(0xff3b, 0xff);
    expect([entry(s, 0x00, 0xc8), entry(s, 0x00, 0xcf)]).toEqual([0x00, 0x00]);
  });

  it("the index is 6 bits: index $3F writes entry $FF", async () => {
    const s = await session();
    s.out(0xbf3b, 0x3f).out(0xff3b, grb(6, 5, 2));
    expect(entry(s, 0x00, 0xff)).toBe(rgb8(6, 5, 2));
    s.out(0xbf3b, 0x00).out(0xff3b, grb(1, 2, 3));
    expect(entry(s, 0x00, 0xc0)).toBe(rgb8(1, 2, 3));
  });

  it("$43 bit 6 alone picks the ULA palette a $FF3B write goes to; it never writes Layer 2, sprites or the tilemap", async () => {
    const s = await session();
    // --- clear entry $C5 in all eight palettes
    for (let sel = 0; sel < 8; sel++) s.setNextReg(0x43, sel << 4).setNextReg(0x40, 0xc5).setNextReg(0x41, 0x00);
    const all = () => Array.from({ length: 8 }, (_, sel) => entry(s, sel << 4, 0xc5));
    const writeVia = (select: number, value: number) => s.setNextReg(0x43, select).out(0xbf3b, 0x05).out(0xff3b, value);

    writeVia(0x40, grb(7, 4, 0)); // --- second ULA palette selected
    // --- $43 bits 6-4: 000 ULA1, 001 L2-1, 010 SPR1, 011 TM1, 100 ULA2, 101 L2-2, 110 SPR2, 111 TM2
    expect(all(), "second ULA").toEqual([0, 0, 0, 0, rgb8(7, 4, 0), 0, 0, 0]);
    writeVia(0x70, grb(1, 1, 1)); // --- second tilemap selected: bit 6 = 1 -> second ULA
    expect(all(), "second tilemap selected").toEqual([0, 0, 0, 0, rgb8(1, 1, 1), 0, 0, 0]);
    writeVia(0x10, grb(2, 3, 1)); // --- first Layer 2 selected: bit 6 = 0 -> first ULA
    expect(all(), "first Layer 2 selected").toEqual([rgb8(2, 3, 1), 0, 0, 0, rgb8(1, 1, 1), 0, 0, 0]);
    writeVia(0x30, grb(5, 0, 3)); // --- first tilemap selected -> first ULA
    expect(all(), "first tilemap selected").toEqual([rgb8(5, 0, 3), 0, 0, 0, rgb8(1, 1, 1), 0, 0, 0]);
  });

  it("group 00 reads return the entry of the ULA palette $43 bit 6 picks", async () => {
    const s = await session();
    s.setNextReg(0x43, 0x00).setNextReg(0x40, 0xc9).setNextReg(0x41, rgb8(3, 4, 1));
    s.setNextReg(0x43, 0x40).setNextReg(0x40, 0xc9).setNextReg(0x41, rgb8(6, 1, 2));
    s.setNextReg(0x43, 0x00).out(0xbf3b, 0x09);
    const first = s.in(0xff3b);
    s.setNextReg(0x43, 0x40).out(0xbf3b, 0x09);
    const second = s.in(0xff3b);
    expect({ first, second }).toEqual({ first: grb(3, 4, 1), second: grb(6, 1, 2) });
  });
});
