import { describe, expect, it } from "vitest";
import {
  PF_CODE,
  PF_EXECUTED,
  PF_INTERRUPT,
  PF_READ,
  PF_SELF_MODIFIED,
  PF_WRITTEN
} from "@common/profile/profileTypes";
import { profileLocationOf, profileOffsetOf } from "@common/profile/layouts/profileLayout";
import { zxnextProfileLayout } from "@common/profile/layouts/zxnext";
import { createSession, type NextTestSession } from "../../harness/zxnext";

/*
 * The access profile on the ZX Spectrum Next (`.plans/CODE_COVERAGE_AND_HEAT_MAP_PLAN.md` Phase 1):
 * a known program gives exactly the expected flags and counts (D3, D9); reads and writes map apart,
 * through the MMU, the DivMMC and the Layer 2 write window, onto the bytes the layout names (T2); the
 * DMA's bus hold lands in `timeDma`, never in an instruction's time (T5); and every 28 MHz tick is
 * charged either to an address or to a header bucket (D7, D8).
 *
 * Offsets are physical offsets into the Next's memory; the layout turns `getPartition`'s partition
 * and the CPU address into one.
 */

const E = PF_EXECUTED;
const C = PF_CODE;
const R = PF_READ;
const W = PF_WRITTEN;
const S = PF_SELF_MODIFIED;

/** The 28 MHz ticks per CPU T-state at the current speed (NextReg $07) */
function ticksPerTState(s: NextTestSession): number {
  return 8 >> (s.nextRegValue(0x07) & 0x03);
}

/** The profile offset of `address` through the partition the machine names for it now (the 16K ROMs included) */
function offsetOf(s: NextTestSession, address: number): number | undefined {
  return profileOffsetOf(zxnextProfileLayout, s.partition(address), address);
}

describe("the Next's access profile: a known program", () => {
  const PROGRAM = `
        .org $8000
Main:   di
        ld hl,Data
        ld a,(hl)
        ld (Data2),a
        ld ix,Data
        ld b,(ix+1)
        ld a,$c9
        ld (Patch),a
        call Patch
        ld b,10
Loop:   djnz Loop
        ret
Patch:  nop
Data:   .defb 1,2
Data2:  .defb 0
Park:   jr Park`;

  async function session(): Promise<{ s: NextTestSession; at: (label: string) => number }> {
    const s = await createSession();
    await s.loadCode(PROGRAM, { entry: "Park" });
    return { s, at: (label: string) => offsetOf(s, s.symbol(label))! };
  }

  function run(s: NextTestSession, counters = true): void {
    s.resetProfile().profile(true, { counters });
    try {
      s.call("Main");
    } finally {
      s.profile(false);
    }
  }

  it("is off by default and reports its layout and its time unit", async () => {
    const { s } = await session();
    const info = s.profileInfo();
    expect(info.enabled).toBe(false);
    expect(info.flagBytes).toBe(zxnextProfileLayout.flagBytes);
    expect(info.poolPages).toBe(64);
    expect(info.timeUnit).toBe("28 MHz ticks");
  });

  it("flags instruction starts, code bytes, reads, writes and self-modified bytes", async () => {
    const { s, at } = await session();
    run(s);
    const main = at("Main");
    // --- The program lives in RAM page 4 (slot 4 of the NEX layout), named by its partition
    expect(profileLocationOf(zxnextProfileLayout, main)).toEqual({ partition: 4, address: 0, rom: false });
    expect(s.profileFlags(main, 1)).toEqual([E | C]);
    expect(s.profileFlags(main + 1, 3)).toEqual([E | C, C, C]);
    expect(s.profileFlags(main + 4, 1)).toEqual([E | C]);
    expect(s.profileFlags(main + 5, 3)).toEqual([E | C, C, C]);
    // --- ld ix,nn (DD 21 n n) and ld b,(ix+1) (DD 46 d): only the prefix byte starts the instruction
    expect(s.profileFlags(main + 8, 4)).toEqual([E | C, C, C, C]);
    expect(s.profileFlags(main + 12, 3)).toEqual([E | C, C, C]);
    expect(s.profileFlags(at("Data"), 3)).toEqual([R, R, W]);
    // --- Patch was written before it ever ran, then fetched: self-modified (D9)
    expect(s.profileFlags(at("Patch"), 1)).toEqual([E | C | W | S]);
    // --- Park never ran inside the profile
    expect(s.profileFlags(at("Park"), 2)).toEqual([0, 0]);
  });

  it("counts executions, reads and writes, and times each instruction start in 28 MHz ticks", async () => {
    const { s, at } = await session();
    run(s);
    const counts = s.profileCounts(at("Loop"), 2);
    expect(counts.exec[0]).toBe(10);
    // --- DJNZ: 13 T-states taken (9 times), 8 not taken; page 4 (16K bank 2) is never contended
    expect(counts.time[0]).toBe((9 * 13 + 8) * ticksPerTState(s));
    const data = s.profileCounts(at("Data"), 3);
    expect(Array.from(data.read)).toEqual([1, 1, 0]);
    expect(Array.from(data.write)).toEqual([0, 0, 1]);
    expect(s.profileCounts(at("Main"), 1).exec[0]).toBe(1);
  });

  it("keeps the flags but no counts with counters off", async () => {
    const { s, at } = await session();
    run(s, false);
    expect(s.profileFlags(at("Main"), 1)).toEqual([E | C]);
    expect(s.profileCounts(at("Loop"), 1).counted[0]).toBe(0);
    expect(s.profileInfo().pagesUsed).toBe(0);
  });
});

describe("the Next's access profile: reads and writes map apart (T2)", () => {
  // --- One data read and one data write in each 8K slot, at $x800 (clear of the code at $8000 and
  // --- the stack below $BFF0); the write puts back what the read saw
  const SLOT_OFFSET = 0x1800;
  const probeAddresses = Array.from({ length: 8 }, (_, slot) => slot * 0x2000 + SLOT_OFFSET);
  const PROGRAM = `
        .org $8000
Park:   jr Park
Probe:
${probeAddresses.map((a) => `        ld a,($${a.toString(16)})\n        ld ($${a.toString(16)}),a`).join("\n")}
        ret`;

  type Expected = {
    /** Where each slot's read lands (as `getPartition` names it) */
    reads: (number | undefined)[];
    /** Where each slot's write lands; undefined when it reaches no memory */
    writes: (number | undefined)[];
  };

  /** The offsets with `flag` the probe left, the call's own stack traffic left out */
  function touchedBy(s: NextTestSession, flag: number, stack: Set<number>): number[] {
    return s
      .profileTouched(flag)
      .filter((b) => (b.flags & flag) !== 0 && (b.flags & PF_CODE) === 0 && !stack.has(b.offset))
      .map((b) => b.offset)
      .sort((a, b) => a - b);
  }

  /** Runs the probe with profiling on; the reads and writes it left, the stack's left out */
  function probe(s: NextTestSession): { reads: number[]; writes: number[] } {
    const sp = s.registers().sp;
    const stack = new Set([offsetOf(s, (sp - 2) & 0xffff)!, offsetOf(s, (sp - 1) & 0xffff)!]);
    s.resetProfile().profile(true);
    try {
      s.call("Probe");
    } finally {
      s.profile(false);
    }
    return { reads: touchedBy(s, PF_READ, stack), writes: touchedBy(s, PF_WRITTEN, stack) };
  }

  function sorted(values: (number | undefined)[]): number[] {
    return [...new Set(values.filter((v): v is number => v !== undefined))].sort((a, b) => a - b);
  }

  /**
   * The expectation where reads and writes go to the partition `getPartition` names: RAM pages and
   * writable DivMMC RAM; ROM and read-only overlays take no write
   */
  function sameForBoth(s: NextTestSession, readOnly: (slot: number) => boolean): Expected {
    const reads = probeAddresses.map((a) => offsetOf(s, a));
    return { reads, writes: reads.map((o, slot) => (readOnly(slot) ? undefined : o)) };
  }

  async function parked(): Promise<NextTestSession> {
    const s = await createSession();
    await s.loadCode(PROGRAM, { entry: "Park" });
    return s;
  }

  function check(s: NextTestSession, expected: Expected): void {
    // --- Every read lands on the byte the layout names for the slot's partition
    for (const [slot, read] of expected.reads.entries()) {
      expect(read, `slot ${slot} names a partition`).not.toBeUndefined();
    }
    const got = probe(s);
    expect(got.reads, "read offsets").toEqual(sorted(expected.reads));
    expect(got.writes, "write offsets").toEqual(sorted(expected.writes));
  }

  const isRom = (s: NextTestSession, slot: number) => {
    const partition = s.partition(probeAddresses[slot]);
    return partition !== undefined && partition < 0 && partition >= -7;
  };

  it("the NEX layout: ROM in slots 0-1 takes no write; RAM pages elsewhere", async () => {
    const s = await parked();
    expect(isRom(s, 0)).toBe(true);
    check(s, sameForBoth(s, (slot) => isRom(s, slot)));
  });

  it("RAM pages the MMU maps into every slot but the program's", async () => {
    const s = await parked();
    s.setNextReg(0x50, 0x20).setNextReg(0x51, 0x21).setNextReg(0x52, 0x30).setNextReg(0x53, 0x31);
    s.setNextReg(0x56, 0x40).setNextReg(0x57, 0xdf);
    expect(probeAddresses.map((a) => s.partition(a))).toEqual([0x20, 0x21, 0x30, 0x31, 4, 5, 0x40, 0xdf]);
    check(s, sameForBoth(s, () => false));
  });

  it("$7FFD's ROM and bank select", async () => {
    const s = await parked();
    s.out(0x7ffd, 0x13);
    expect(s.partition(0x0000)).toBe(-2);
    expect(s.partition(0xc000)).toBe(6);
    check(s, sameForBoth(s, (slot) => isRom(s, slot)));
  });

  it("the DivMMC's conmem: its ROM in slot 0 takes no write, its RAM bank in slot 1 does", async () => {
    const s = await parked();
    s.out(0xe3, 0x80 | 5);
    expect([s.partition(0x0000), s.partition(0x2000)]).toEqual([-7, -8 - 5]);
    check(s, sameForBoth(s, (slot) => slot === 0));
  });

  it("the DivMMC's mapram: bank 3 in slot 0 is read-only", async () => {
    const s = await parked();
    s.out(0xe3, 0x80 | 0x40 | 7);
    expect([s.partition(0x0000), s.partition(0x2000)]).toEqual([-8 - 3, -8 - 7]);
    check(s, sameForBoth(s, (slot) => slot === 0));
  });

  it("the Layer 2 write window over $0000-$3FFF: writes reach the Layer 2 bank, reads still the ROM", async () => {
    const s = await parked();
    s.setNextReg(0x12, 8);
    // --- $123B: writes mapped (bit 0), segment 0 (bits 7-6); zxnext.vhd ~3001-3020
    s.out(0x123b, 0x01);
    const expected = sameForBoth(s, (slot) => isRom(s, slot));
    // --- Layer 2 bank 8 = RAM pages 16-17 under $0000-$3FFF; the ROM still answers the reads
    expected.writes[0] = profileOffsetOf(zxnextProfileLayout, 16, probeAddresses[0]);
    expected.writes[1] = profileOffsetOf(zxnextProfileLayout, 17, probeAddresses[1]);
    expect(isRom(s, 0)).toBe(true);
    check(s, expected);
  });

  it("the Layer 2 window's segment and bank offset pick the third written", async () => {
    const s = await parked();
    s.setNextReg(0x12, 8);
    // --- segment 1, writes mapped: the second 16K of the 48K Layer 2 (bank 9, pages 18-19)
    s.out(0x123b, 0x41);
    const expected = sameForBoth(s, (slot) => isRom(s, slot));
    expected.writes[0] = profileOffsetOf(zxnextProfileLayout, 18, probeAddresses[0]);
    expected.writes[1] = profileOffsetOf(zxnextProfileLayout, 19, probeAddresses[1]);
    check(s, expected);
  });

  it("the Layer 2 window mapping reads too: both land in the Layer 2 bank", async () => {
    const s = await parked();
    s.setNextReg(0x12, 8);
    s.out(0x123b, 0x05);
    const expected = sameForBoth(s, (slot) => isRom(s, slot));
    for (const slot of [0, 1]) {
      const layer2 = profileOffsetOf(zxnextProfileLayout, 16 + slot, probeAddresses[slot]);
      expected.reads[slot] = layer2;
      expected.writes[slot] = layer2;
    }
    check(s, expected);
  });

  it("the Alt ROM taking writes: reads from the ROM, writes into an Alt ROM", async () => {
    const s = await parked();
    // --- $8C bit 7: Alt ROM on; bit 6: it takes writes while the ROM is read (zxnext.vhd ~3010-3083)
    s.setNextReg(0x8c, 0xc0);
    expect(isRom(s, 0)).toBe(true);
    const got = probe(s);
    expect(got.reads.slice(0, 2)).toEqual([offsetOf(s, probeAddresses[0]), offsetOf(s, probeAddresses[1])]);
    // --- Both writes land in one 16K Alt ROM ($8C bit 4/5 and $7FFD pick which), at the address's offset
    const altWrites = got.writes.filter((o) => o < 0x40000);
    const altRom = [-5, -6]
      .map((partition) => zxnextProfileLayout.regions.find((r) => r.partition === partition)!.start)
      .map((start) => [start + probeAddresses[0], start + probeAddresses[1]]);
    expect(altRom).toContainEqual(altWrites);
  });
});

describe("the Next's access profile: time (D7, D8, T5)", () => {
  /*
   * A continuous 256-byte DMA fill (the DMA-030 program, shortened): the DMA takes the bus before the
   * instruction after the enabling OUT, and the hold must land in `timeDma`, not in that
   * instruction's time
   */
  const DMA_PROGRAM = `
        .org $8000
Start:  di
        ld hl,DmaTable
        ld b,DmaTableEnd-DmaTable
        ld c,$6b
        otir
        ld a,$87
        ld bc,$006b
        out (c),a
Done:   jr Done
DmaTable:
        .defb $83, $7d
        .defw Fill
        .defw $0100
        .defb $24, $10, $ad
        .defw $c000
        .defb $82, $cf
DmaTableEnd:
Fill:   .defb $77`;

  function chargedTime(s: NextTestSession): number {
    return s.profileTouched().reduce((sum, b) => sum + (b.time ?? 0), 0);
  }

  it("a DMA transfer's hold lands in timeDma, not in an instruction's time (T5)", async () => {
    const s = await createSession();
    await s.loadCode(DMA_PROGRAM, { entry: "Start" });
    s.poke(0xc000, 0).poke(0xc0ff, 0);
    s.resetProfile().profile(true);
    s.runFrames(1);
    s.profile(false);
    expect([s.peek(0xc000), s.peek(0xc0ff)], "the fill ran").toEqual([0x77, 0x77]);

    const info = s.profileInfo();
    // --- 256 bytes, each at least one CPU T-state's worth of 28 MHz ticks
    expect(info.timeDma).toBeGreaterThanOrEqual(256 * ticksPerTState(s));
    // --- The instruction after the enable is JR, 12 T-states every time: no hold in any of them
    const done = offsetOf(s, s.symbol("Done"))!;
    const jr = s.profileCounts(done, 1);
    expect(jr.exec[0]).toBeGreaterThan(1);
    expect(jr.time[0]).toBe(jr.exec[0] * 12 * ticksPerTState(s));
    expect(chargedTime(s)).toBe(info.timeTotal - info.timeIntAck - info.timeNmiAck - info.timeDma - info.timeSnooze);
  });

  it("charges every tick either to an address or to a header bucket, across frames (D7)", async () => {
    const s = await createSession();
    await s.loadCode(
      `
        .org $8000
Start:  di
        im 1
        ei
Loop:   halt
        jr Loop`,
      { entry: "Start" }
    );
    // --- RAM under $0000-$1FFF, with an IM 1 handler at $0038
    s.setNextReg(0x50, 0x20);
    s.poke(0x0038, [0xfb, 0xed, 0x4d]); // ei; reti
    s.resetProfile().profile(true);
    s.runFrames(5);
    s.profile(false);
    const info = s.profileInfo();
    expect(info.timeIntAck).toBeGreaterThan(0);
    expect(info.timeHalt).toBeGreaterThan(0);
    // --- Five frames of the +3/128K raster at least: the clock does not wrap with the frame (D8)
    expect(info.timeTotal).toBeGreaterThan(4 * 70000 * ticksPerTState(s));
    expect(chargedTime(s)).toBe(info.timeTotal - info.timeIntAck - info.timeNmiAck - info.timeDma - info.timeSnooze);
    // --- The handler ran inside an interrupt service
    expect(s.profileFlags(offsetOf(s, 0x0038)!, 1)[0] & PF_INTERRUPT).toBe(PF_INTERRUPT);
    expect(info.instructions).toBe(s.profileTouched().reduce((sum, b) => sum + (b.exec ?? 0), 0));
  });
});
