import { describe, expect, it } from "vitest";

import { createSession, type NextTestSession } from "../../harness/zxnext";
import { romBytes } from "./_memory-helpers";

/*
 * Config mode: NextReg $04 maps a 16K SRAM bank at $0000-$3FFF (catalogue MEM-026).
 *
 * Hardware (`_input/next-fpga/src/zxnext.vhd`):
 * - ~5125-5132: $03 low bits 111 enter config mode, any other non-zero type leaves it; `$04` stores
 *   bits 6-0 (`nr_04_romram_bank`) - written at any time.
 * - ~2980-3014: in $0000-$3FFF, after the Multiface and an MMU page below $E0, config mode maps SRAM
 *   `nr_04_romram_bank & A13` (16K bank n at n x 16K of SRAM: 0-3 the ROMs, 4 the DivMMC ROM + unused,
 *   8-15 DivMMC RAM, 16 up the Next RAM from bank 0), writable (`sram_pre_rdonly` '0'), with
 *   `sram_pre_override` "110": DivMMC and Layer 2 can still go above it, the Alt ROM and ROMCS cannot.
 *   This is how the firmware loads the ROMs.
 */

async function parked(): Promise<NextTestSession> {
  const s = await createSession();
  await s.loadCode(" .org $8000\n di\nLoop: jr Loop");
  return s;
}

/** Enters config mode; returns the machine type to leave it with. */
function enter(s: NextTestSession): number {
  const type = s.readNextReg(0x03) & 0x07;
  s.setNextReg(0x03, 0x07);
  return type;
}

describe("Config mode $04 mapping", () => {
  it("MEM-026: $04 = 16 maps Next RAM bank 0, writable; leaving config mode brings the ROM back", async () => {
    const s = await parked();
    const rom = Array.from(s.peekBytes(0x0000, 8));
    const type = enter(s);
    s.setNextReg(0x04, 16).poke(0x0000, [0x5a, 0x5b]).poke(0x2000, [0xa5, 0xa6]);
    expect(Array.from(s.peekBytes(0x0000, 2)), "written").toEqual([0x5a, 0x5b]);
    s.setNextReg(0x03, type);
    expect(Array.from(s.peekBytes(0x0000, 8)), "ROM again").toEqual(rom);
    s.setNextReg(0x52, 0x00).setNextReg(0x53, 0x01); // --- RAM pages 0 and 1 at $4000 / $6000
    expect([...s.peekBytes(0x4000, 2), ...s.peekBytes(0x6000, 2)], "SRAM 0x040000 = page 0").toEqual([0x5a, 0x5b, 0xa5, 0xa6]);
  });

  it("MEM-026: $04 = 0-3 show the ROM images, and a write there changes the ROM", async () => {
    const s = await parked();
    const type = enter(s);
    for (const n of [0, 1, 2, 3]) {
      s.setNextReg(0x04, n);
      expect(Array.from(s.peekBytes(0x0000, 8)), `ROM ${n}`).toEqual(romBytes(n, 0, 8));
      expect(Array.from(s.peekBytes(0x3ff0, 8)), `ROM ${n} top`).toEqual(romBytes(n, 0x3ff0, 8));
    }
    s.setNextReg(0x04, 3).poke(0x0100, 0x77);
    s.setNextReg(0x03, type);
    s.out(0x7ffd, 0x10).out(0x1ffd, 0x04); // --- ROM 3
    expect(s.peek(0x0100)).toBe(0x77);
  });

  it("MEM-026: an MMU RAM page in slot 0 goes above config mode; the Alt ROM does not", async () => {
    const s = await parked();
    enter(s);
    s.setNextReg(0x04, 17).poke(0x0000, 0x11);
    s.setNextReg(0x50, 0x0a).poke(0x0000, 0x22);
    expect(s.peek(0x0000), "MMU0 = page 10").toBe(0x22);
    s.setNextReg(0x50, 0xff);
    expect(s.peek(0x0000), "the $04 bank again").toBe(0x11);
    s.setNextReg(0x8c, 0x80); // --- Alt ROM for reads
    expect(s.peek(0x0000), "no Alt ROM in config mode").toBe(0x11);
  });

  it("MEM-026: DivMMC conmem goes above config mode", async () => {
    const s = await parked();
    enter(s);
    s.setNextReg(0x04, 4).poke(0x0000, [0xc3, 0x12, 0x34]); // --- SRAM 0x010000: the DivMMC ROM
    s.setNextReg(0x04, 17).poke(0x0000, [0x01, 0x02, 0x03]);
    s.out(0xe3, 0x80);
    expect(Array.from(s.peekBytes(0x0000, 3)), "DivMMC ROM").toEqual([0xc3, 0x12, 0x34]);
    s.out(0xe3, 0x00);
    expect(Array.from(s.peekBytes(0x0000, 3)), "the $04 bank").toEqual([0x01, 0x02, 0x03]);
  });
});
