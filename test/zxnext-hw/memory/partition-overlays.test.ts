import { describe, expect, it } from "vitest";

import { createSession, type NextTestSession } from "../../harness/zxnext";

/*
 * Which partition `getPartition` names for an address while the $0000-$3FFF overlays are paged in
 * (`zxnextPartitionOfPage` in zxnext.c). The partition must name the memory the CPU actually reads
 * code from - source mapping, partitioned breakpoints, `page()` and the execution history all ask it.
 *
 * Hardware (`_input/next-fpga/src`):
 * - device/divmmc.vhd ~131-140: with conmem ($E3 bit 7) or automap, $0000-$1FFF is the DivMMC ROM
 *   (or, with mapram, DivMMC RAM bank 3) and $2000-$3FFF the DivMMC RAM bank $E3 bits 3-0 select.
 * - zxnext.vhd ~2998-3012: in $0000-$3FFF the Multiface wins over the DivMMC, and both over the MMU
 *   and the ROM. Multiface memory has no Klive partition, so the answer there is "none".
 * Partition numbers (`nextPartitionLabels`): ROM 0-3 = -1..-4, DM = -7, M0..MF = -8..-23, RAM page n = n.
 */

const E3 = 0x00e3;
const CONMEM = 0x80;
const MAPRAM = 0x40;

async function parked(): Promise<NextTestSession> {
  const s = await createSession();
  await s.loadCode(" .org $8000\nStart: di\nLoop: jr Loop");
  return s;
}

const slots = (s: NextTestSession) => [0x0000, 0x2000, 0x4000].map((a) => s.partition(a));

describe("getPartition under the $0000-$3FFF overlays", () => {
  it("names the ROM when nothing overlays it", async () => {
    const s = await parked();
    s.out(0x7ffd, 0x00).out(0x1ffd, 0x00);
    s.out(E3, 0x00);
    expect(slots(s)).toEqual([-1, -1, s.partition(0x4000)]);
  });

  it("conmem: the DivMMC ROM in slot 0 (DM) and the selected RAM bank in slot 1 (M5)", async () => {
    const s = await parked();
    s.out(E3, CONMEM | 5);
    expect(s.partition(0x0000)).toBe(-7);
    expect(s.partition(0x1fff)).toBe(-7);
    expect(s.partition(0x2000)).toBe(-8 - 5);
    // --- Outside $0000-$3FFF nothing changes
    const page2 = s.partition(0x4000);
    s.out(E3, 0x00);
    expect(s.partition(0x4000)).toBe(page2);
    expect(s.partition(0x0000)).toBe(-1);
  });

  it("mapram: slot 0 is DivMMC RAM bank 3 (M3), read-only", async () => {
    const s = await parked();
    s.out(E3, CONMEM | MAPRAM | 7);
    expect(s.partition(0x0000)).toBe(-8 - 3);
    expect(s.partition(0x2000)).toBe(-8 - 7);
  });

  it("the DivMMC wins over RAM the MMU pages into slots 0-1", async () => {
    const s = await parked();
    s.setNextReg(0x50, 0x20).setNextReg(0x51, 0x21);
    expect([s.partition(0x0000), s.partition(0x2000)]).toEqual([0x20, 0x21]);
    s.out(E3, CONMEM | 2);
    expect([s.partition(0x0000), s.partition(0x2000)]).toEqual([-7, -8 - 2]);
  });

  it("an automapped DivMMC names its own memory after the entry point", async () => {
    const s = await createSession();
    await s.loadCode(
      `
        .org $8000
Start:  di
        jp $0008`,
      { entry: "Start" }
    );
    s.out(0x7ffd, 0x00).out(0x1ffd, 0x00);
    s.setNextReg(0x0a, s.readNextReg(0x0a) | 0x10);
    s.out(E3, 0x00);
    // --- RST $08: enabled, always, instant
    s.setNextReg(0xb8, 0x02).setNextReg(0xb9, 0x02).setNextReg(0xba, 0x02);
    s.runTo(0x0008);
    expect(s.partition(0x0008), "before the entry fetch").toBe(-1);
    s.step(1);
    expect(s.partition(0x0008), "automapped").toBe(-7);
  });

  it("Multiface memory has no partition; slot 2 is unaffected", async () => {
    const s = await createSession();
    await s.loadCode(" .org $8000\n di\nLoop: jr Loop");
    // --- $0A bits 7-6 = 00: MF+3; they change only in config mode
    const machine = s.readNextReg(0x03) & 0x07;
    s.setNextReg(0x03, 0x07).setNextReg(0x0a, s.readNextReg(0x0a) & 0x3f).setNextReg(0x03, machine);
    await s.loadCode(
      `
        .org $8000
Start:  di
        nextreg $06,$08
        nextreg $02,$08
Loop:   jr Loop`,
      { entry: "Start" }
    );
    const page2 = s.partition(0x4000);
    s.runTo(0x0066, { maxFrames: 2 }).step(1);
    expect([s.partition(0x0000), s.partition(0x2000)], "Multiface paged in").toEqual([undefined, undefined]);
    expect(s.partition(0x4000)).toBe(page2);
    s.in(0xbf); // --- MF+3 disable port
    expect(s.partition(0x0000), "paged out").not.toBeUndefined();
  });
});
