import { describe, expect, it } from "vitest";

import { type NextTestSession } from "../../harness/zxnext";
import { parkedSession } from "../ula/_ula-helpers";

/*
 * Palette registers $40-$44 (catalogue PAL-001 - PAL-008, PAL-012, PAL-013).
 *
 * Hardware (`_input/next-fpga/src/zxnext.vhd`):
 * - ~5351-5381 (the NextReg write process):
 *     $40: nr_palette_idx <= value, nr_palette_sub_idx <= 0.
 *     $41: nr_palette_idx + 1 unless $43 bit 7, sub_idx <= 0.
 *     $43: bits 7 / 6-4 / 3 / 2 / 1 / 0 stored, sub_idx <= 0.
 *     $44: sub_idx = 0: nr_stored_palette_value <= value; sub_idx = 1: nr_palette_idx + 1 unless $43
 *          bit 7. sub_idx toggles on every $44 write.
 *   nr_palette_idx is 8 bits: 255 + 1 wraps to 0.
 * - ~4896-4898 (combinational, with the *old* sub_idx): the palette RAM is written by a $41 write, or by
 *   a $44 write while sub_idx = 1 (the second byte). A $41 write stores  value & (value(1) or value(0))
 *   with priority "00"; the second $44 byte stores  stored_value & value(0)  with priority value(7:6).
 * - ~6898-6903, ~6957: the write select $43 bits 6-4 = s(2:0) addresses  s(1) & s(2) & index  in the
 *   ULA/tilemap RAM when s(1) = s(0) (000 ULA 1, 100 ULA 2, 011 tilemap 1, 111 tilemap 2), else in the
 *   Layer 2/sprite RAM (001 Layer 2 1, 101 Layer 2 2, 010 sprites 1, 110 sprites 2). Each RAM word is
 *   priority(1:0) & "00000" & colour(8:0). The read mux follows the *write* select too.
 * - Read mux: $40 ~5982 index; $41 ~5985 colour(8:1); $44 ~5994  priority(1:0) & "00000" & colour(0)
 *   (so bit 6 of the second byte reads back, like bit 7); $28 ~5950 the stored first byte; $03 ~5840
 *   bit 7 = sub_idx.
 * - ~4977-4989: `reset` (soft and hard) clears the index, sub_idx, $43 and the stored byte. The palette
 *   RAMs are dpram2 instances with no reset: their contents survive.
 */

/** The 9-bit colour an 8-bit $41 write stores (blue LSB = B1 or B0). */
const nine = (v8: number) => (v8 << 1) | ((v8 & 3) !== 0 ? 1 : 0);

/** One palette entry as the read mux shows it: [$41, $44]. */
function entry(s: NextTestSession, index: number): [number, number] {
  s.setNextReg(0x40, index);
  return [s.readNextReg(0x41), s.readNextReg(0x44)];
}

/** [$41, $44] of a 9-bit colour with priority bits `prio` (1:0). */
const asRead = (colour9: number, prio = 0): [number, number] => [colour9 >> 1, (prio << 6) | (colour9 & 1)];

const subIndex = (s: NextTestSession) => s.readNextReg(0x03) >> 7;

describe("palette registers", () => {
  it("PAL-001: $40 reads back; a $41 write moves it on by one", async () => {
    const s = await parkedSession();
    s.setNextReg(0x43, 0x00);
    for (const i of [0x00, 0x37, 0x80, 0xfe]) {
      s.setNextReg(0x40, i);
      expect(s.readNextReg(0x40), `after $40 = ${i}`).toBe(i);
      s.setNextReg(0x41, 0x12);
      expect(s.readNextReg(0x40), `after $40 = ${i} and a $41 write`).toBe((i + 1) & 0xff);
      s.setNextReg(0x41, 0x34);
      expect(s.readNextReg(0x40), "after a second $41 write").toBe((i + 2) & 0xff);
    }
  });

  it("PAL-002: every 8-bit $41 value: blue LSB = B1 or B0; $41 reads colour bits 8-1, $44 bit 0 the LSB", async () => {
    const s = await parkedSession();
    s.setNextReg(0x43, 0x00).setNextReg(0x40, 0x00);
    for (let v = 0; v < 256; v++) s.setNextReg(0x41, v); // --- autoincrement: entry v = v
    const bad: string[] = [];
    for (let v = 0; v < 256; v++) {
      const got = entry(s, v);
      const want = asRead(nine(v));
      if (got[0] !== want[0] || got[1] !== want[1]) bad.push(`$${v.toString(16)}: [${got}] != [${want}]`);
    }
    expect(bad).toEqual([]);
  });

  it("PAL-002: a $41 write clears the priority bits a $44 write set", async () => {
    const s = await parkedSession();
    s.setNextReg(0x43, 0x10).setNextReg(0x40, 0x20).setNextReg(0x44, 0x55).setNextReg(0x44, 0xc1);
    expect(entry(s, 0x20), "after $44 $55,$C1").toEqual(asRead((0x55 << 1) | 1, 3));
    s.setNextReg(0x41, 0x55);
    expect(entry(s, 0x20), "after $41 $55").toEqual(asRead(nine(0x55), 0));
  });

  it("PAL-003: $44 stores the first byte ($28, $03 bit 7 set), writes on the second byte, then moves on", async () => {
    const s = await parkedSession();
    s.setNextReg(0x43, 0x00).setNextReg(0x40, 0x05).setNextReg(0x41, 0x1c); // --- entry 5 = $1C
    s.setNextReg(0x40, 0x05).setNextReg(0x44, 0xa4);
    expect([s.readNextReg(0x28), subIndex(s), s.readNextReg(0x40)], "after the first byte: stored, pending, index kept").toEqual([
      0xa4, 1, 0x05
    ]);
    expect(s.readNextReg(0x41), "the first byte alone does not write the entry").toBe(0x1c);
    s.setNextReg(0x44, 0x01);
    expect([subIndex(s), s.readNextReg(0x40)], "after the second byte").toEqual([0, 0x06]);
    expect(entry(s, 0x05), "entry 5 = $A4 & 1").toEqual(asRead((0xa4 << 1) | 1));
    // --- blue LSB 0 although B1/B0 of the first byte are set: no OR expansion on the $44 path
    s.setNextReg(0x40, 0x05).setNextReg(0x44, 0x03).setNextReg(0x44, 0x00);
    expect(entry(s, 0x05), "entry 5 = $03 & 0").toEqual(asRead(0x03 << 1));
    // --- the first byte stays in $28 after the pair
    expect(s.readNextReg(0x28)).toBe(0x03);
  });

  for (const second of [0x80, 0x40, 0xc1, 0x3e]) {
    it(`PAL-004: $44 reads back bits 7-6 and 0 of a second byte $${second.toString(16).padStart(2, "0")}, bits 5-1 as 0, for every palette`, async () => {
      const s = await parkedSession();
      for (let sel = 0; sel < 8; sel++) {
        s.setNextReg(0x43, sel << 4).setNextReg(0x40, 0x42).setNextReg(0x44, 0x5a).setNextReg(0x44, second);
        expect(entry(s, 0x42), `write select ${sel}`).toEqual([0x5a, second & 0xc1]);
      }
    });
  }

  it("PAL-005: a $40 write between the two $44 bytes restarts the pair; so does a $43 write", async () => {
    const s = await parkedSession();
    s.setNextReg(0x43, 0x00);
    s.setNextReg(0x40, 10).setNextReg(0x41, 0x00).setNextReg(0x41, 0x00); // --- entries 10, 11 = 0
    s.setNextReg(0x40, 20).setNextReg(0x41, 0x00).setNextReg(0x41, 0x00); // --- entries 20, 21 = 0
    s.setNextReg(0x40, 10).setNextReg(0x44, 0x11);
    expect(subIndex(s), "pending after one byte").toBe(1);
    s.setNextReg(0x40, 20);
    expect(subIndex(s), "a $40 write clears the pending byte").toBe(0);
    s.setNextReg(0x44, 0x22).setNextReg(0x44, 0x01);
    expect(entry(s, 20), "entry 20 from the restarted pair").toEqual(asRead((0x22 << 1) | 1));
    expect(entry(s, 10), "entry 10 untouched").toEqual(asRead(0));
    expect(entry(s, 21), "entry 21 untouched").toEqual(asRead(0));

    s.setNextReg(0x40, 10).setNextReg(0x44, 0x33).setNextReg(0x43, 0x00);
    expect(subIndex(s), "a $43 write clears the pending byte").toBe(0);
    s.setNextReg(0x44, 0x44).setNextReg(0x44, 0x00);
    expect(entry(s, 10), "entry 10 from the restarted pair").toEqual(asRead(0x44 << 1));
    expect(entry(s, 11), "entry 11 untouched").toEqual(asRead(0));
  });

  it("PAL-006: a $41 write between the two $44 bytes writes its entry and restarts the pair", async () => {
    const s = await parkedSession();
    s.setNextReg(0x43, 0x00).setNextReg(0x40, 10);
    for (let i = 0; i < 4; i++) s.setNextReg(0x41, 0x00); // --- entries 10-13 = 0
    s.setNextReg(0x40, 10).setNextReg(0x44, 0x11).setNextReg(0x41, 0x33);
    expect([subIndex(s), s.readNextReg(0x40)], "after $44 $11, $41 $33").toEqual([0, 11]);
    expect(s.readNextReg(0x28), "a $41 write leaves the stored first byte").toBe(0x11);
    s.setNextReg(0x44, 0x44).setNextReg(0x44, 0x01);
    expect(s.readNextReg(0x40)).toBe(12);
    expect(entry(s, 10), "entry 10 = the $41 write").toEqual(asRead(nine(0x33)));
    expect(entry(s, 11), "entry 11 = the new pair").toEqual(asRead((0x44 << 1) | 1));
    expect(entry(s, 12), "entry 12 untouched").toEqual(asRead(0));
  });

  it("PAL-007: with $43 bit 7 repeated $41 writes and $44 pairs change one entry", async () => {
    const s = await parkedSession();
    s.setNextReg(0x43, 0x00).setNextReg(0x40, 7).setNextReg(0x41, 0x00).setNextReg(0x41, 0x00); // --- 7, 8 = 0
    s.setNextReg(0x43, 0x80).setNextReg(0x40, 7).setNextReg(0x41, 0xe0).setNextReg(0x41, 0x1c);
    expect(s.readNextReg(0x40), "index kept after two $41 writes").toBe(7);
    expect(s.readNextReg(0x41), "the last $41 write").toBe(0x1c);
    s.setNextReg(0x44, 0xaa).setNextReg(0x44, 0x01).setNextReg(0x44, 0x55).setNextReg(0x44, 0x80);
    expect([s.readNextReg(0x40), subIndex(s)], "index kept after two $44 pairs").toEqual([7, 0]);
    expect(entry(s, 7), "the last $44 pair").toEqual(asRead(0x55 << 1, 2));
    expect(entry(s, 8), "entry 8 untouched").toEqual(asRead(0));
    expect(s.readNextReg(0x43), "$43 reads back").toBe(0x80);
  });

  it("PAL-008: each of the eight write selections has its own entries; $41/$44 read the selected one", async () => {
    const s = await parkedSession();
    const colour = (sel: number) => 0x21 + sel * 0x1b; // --- eight distinct 8-bit values
    for (let sel = 0; sel < 8; sel++) {
      s.setNextReg(0x43, sel << 4).setNextReg(0x40, 0x99).setNextReg(0x44, colour(sel)).setNextReg(0x44, sel & 1);
      expect(s.readNextReg(0x43), `$43 reads back select ${sel}`).toBe(sel << 4);
    }
    const got: Array<[number, number]> = [];
    for (let sel = 0; sel < 8; sel++) {
      s.setNextReg(0x43, sel << 4);
      got.push(entry(s, 0x99));
    }
    expect(got).toEqual(Array.from({ length: 8 }, (_, sel) => asRead((colour(sel) << 1) | (sel & 1))));
  });

  it("PAL-008: $43 stores all eight bits and reads them back", async () => {
    const s = await parkedSession();
    for (const v of [0xff, 0x00, 0xaa, 0x55, 0x7e, 0x81]) {
      s.setNextReg(0x43, v);
      expect(s.readNextReg(0x43), `$43 = $${v.toString(16)}`).toBe(v);
    }
  });

  it("PAL-012: the index wraps from 255 to 0 after a $41 write and after a $44 pair", async () => {
    const s = await parkedSession();
    s.setNextReg(0x43, 0x00).setNextReg(0x40, 0x00).setNextReg(0x41, 0x00).setNextReg(0x40, 0xff);
    s.setNextReg(0x41, 0xe7);
    expect(s.readNextReg(0x40), "after $41 at 255").toBe(0x00);
    s.setNextReg(0x41, 0x1f);
    expect(entry(s, 0xff), "entry 255").toEqual(asRead(nine(0xe7)));
    expect(entry(s, 0x00), "entry 0 = the next write").toEqual(asRead(nine(0x1f)));
    s.setNextReg(0x40, 0xff).setNextReg(0x44, 0x66).setNextReg(0x44, 0x01);
    expect(s.readNextReg(0x40), "after a $44 pair at 255").toBe(0x00);
    expect(entry(s, 0xff)).toEqual(asRead((0x66 << 1) | 1));
  });

  it("PAL-013: a soft reset keeps the palette RAM and clears the index, $43, the pending byte and $28", async () => {
    const s = await parkedSession();
    const colour = (sel: number, i: number) => (sel * 37 + i * 11 + 5) & 0xff;
    const INDICES = [0x00, 0x01, 0x10, 0x80, 0xe3, 0xff];
    for (let sel = 0; sel < 8; sel++) {
      s.setNextReg(0x43, sel << 4);
      for (const i of INDICES) s.setNextReg(0x40, i).setNextReg(0x44, colour(sel, i)).setNextReg(0x44, (i & 1) | (sel === 1 ? 0x80 : 0));
    }
    s.setNextReg(0x43, 0x7e).setNextReg(0x40, 0x37).setNextReg(0x44, 0x5a); // --- leave a byte pending
    expect([s.readNextReg(0x28), subIndex(s)], "before the reset").toEqual([0x5a, 1]);
    s.reset();
    expect(
      { index: s.readNextReg(0x40), control: s.readNextReg(0x43), stored: s.readNextReg(0x28), pending: subIndex(s) },
      "registers after the soft reset"
    ).toEqual({ index: 0, control: 0, stored: 0, pending: 0 });
    for (let sel = 0; sel < 8; sel++) {
      s.setNextReg(0x43, sel << 4);
      const got = INDICES.map((i) => entry(s, i));
      const want = INDICES.map((i) => asRead((colour(sel, i) << 1) | (i & 1), sel === 1 ? 2 : 0));
      expect(got, `write select ${sel} after the soft reset`).toEqual(want);
    }
  });

  /*
   * Not hardware: the FPGA palette RAM has no reset contents, and what a real machine shows after power-on
   * is whatever the firmware writes. Klive's hard reset stands in for that with fixed palettes - the ULA
   * colours repeated every 16 entries (entry 11, bright magenta, as $1CF so it is not the $E3 transparent
   * colour) and colour i with blue LSB = bit 1 elsewhere. This pins down that a *hard* reset still loads
   * them, now that a soft reset keeps the RAM (PAL-013).
   */
  it("Klive's hard reset reloads its default palettes", async () => {
    const s = await parkedSession();
    for (let sel = 0; sel < 8; sel++) s.setNextReg(0x43, sel << 4).setNextReg(0x40, 0x0b).setNextReg(0x41, 0x00);
    s.hardReset();
    const read = (sel: number, i: number) => (s.setNextReg(0x43, sel << 4), entry(s, i));
    expect({
      ula1: read(0, 0x0b),
      ula2: read(4, 0x1b),
      ula7: read(0, 0x07),
      layer2: read(1, 0x0b),
      sprite: read(6, 0x0b),
      tilemap: read(7, 0x0b)
    }).toEqual({
      ula1: asRead(0x1cf),
      ula2: asRead(0x1cf),
      ula7: asRead(0x16d),
      layer2: asRead((0x0b << 1) | 1),
      sprite: asRead((0x0b << 1) | 1),
      tilemap: asRead((0x0b << 1) | 1)
    });
  });
});
