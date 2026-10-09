import { beforeEach, describe, expect, it } from "vitest";
import { PF_CODE, PF_EXECUTED, PF_READ, PF_SELF_MODIFIED, PF_WRITTEN, PROFILE_KEY_ROOT } from "@common/profile/profileTypes";
import { profileLocationOf, profileOffsetOf } from "@common/profile/layouts/profileLayout";
import { z88ProfileLayout } from "@common/profile/layouts/z88";
import { CardIds } from "@emu/machines/z88/CardIds";
import { z88BankStorageOffset, type Z88WasmV2Machine } from "@emu/machines/z88/Z88WasmV2Machine";
import { createZ88Session, Z88_FLAT_RAM_LAYOUT, type Z88TestSession } from "../../harness/z88";

/*
 * The access profile on the Cambridge Z88 (`.plans/CODE_COVERAGE_AND_HEAT_MAP_PLAN.md` Phase 2): the
 * flags of a known program (D3, D9), the read and write mappings through the Blink's paging - COM.RAMS,
 * SR0's half bank, SR1-SR3, a mirrored small card, ROM, an EPROM, a flash chip's command cycles and an
 * empty slot (trap T2) - every T-state charged to an address or a bucket, and the snooze in its own
 * bucket (D7).
 *
 * The expected offset of a mapping is computed here from the Blink documentation's paging rules and
 * the bank storage rule of `z88BankStorageOffset`, not read back from the core's page map.
 */

const E = PF_EXECUTED;
const C = PF_CODE;
const R = PF_READ;
const W = PF_WRITTEN;
const S = PF_SELF_MODIFIED;

/* Internal RAM bank $22 sits at $8000-$BFFF under the flat layout; the mapping tests' code lives there */
const FLAT_SR2_BASE = 0x80000 + 2 * 0x4000;

const PROGRAM = `
        .org $8000
Main:   ld hl,Data
        ld a,(hl)
        ld (Data2),a
        ld ix,Data
        ld b,(ix+1)
        ld a,$c9
        ld (Patch),a
        call Patch
        ld b,10
Loop:   djnz Loop
Done:   jr Done
Patch:  nop
Data:   .defb 1,2
Data2:  .defb 0
`;

let s: Z88TestSession;
let m: Z88WasmV2Machine;

function exports() {
  return m.wasmV2Runtime!.exports;
}

/* A flat-RAM CPU address's offset: banks $20-$23 lie consecutively from $080000 (Z88_FLAT_RAM_LAYOUT) */
function flat(address: number): number {
  return 0x80000 + address;
}

function flagsAt(offset: number, length = 1): number[] {
  return Array.from(m.readProfileFlags(offset, length)!);
}

/** Runs `count` instructions from `pc` with profiling on (counters too) */
function profiled(pc: number, count: number): void {
  m.resetProfile();
  m.setProfiling(true, true);
  try {
    m.pc = pc;
    s.step(count);
  } finally {
    m.setProfiling(false, true);
  }
}

describe("the Z88's access profile", () => {
  beforeEach(async () => {
    s = await createZ88Session();
    m = s.machine as unknown as Z88WasmV2Machine;
  });

  it("is off by default and reports its layout", () => {
    const info = m.getProfileInfo()!;
    expect(info.enabled).toBe(false);
    expect(info.machineId).toBe("z88");
    expect(info.flagBytes).toBe(z88ProfileLayout.flagBytes);
    expect(info.poolPages).toBe(64);
    expect(info.timeUnit).toBe("T-states");
  });

  it("flags instruction starts, code bytes, reads, writes and self-modified bytes", async () => {
    const program = await s.loadCode(PROGRAM);
    const sym = program.symbol;
    m.resetProfile();
    m.setProfiling(true, true);
    s.runTo("Done");
    m.setProfiling(false, true);
    const main = flat(sym("Main"));
    // --- ld hl,nn; ld a,(hl); ld (nn),a
    expect(flagsAt(main, 3)).toEqual([E | C, C, C]);
    expect(flagsAt(main + 3, 1)).toEqual([E | C]);
    expect(flagsAt(main + 4, 3)).toEqual([E | C, C, C]);
    // --- ld ix,nn (DD 21 n n): only the prefix byte starts the instruction; ld b,(ix+1) (DD 46 d)
    expect(flagsAt(main + 7, 4)).toEqual([E | C, C, C, C]);
    expect(flagsAt(main + 11, 3)).toEqual([E | C, C, C]);
    expect(flagsAt(flat(sym("Data")), 3)).toEqual([R, R, W]);
    // --- Patch was written before it ever ran, then fetched: self-modified (D9)
    expect(flagsAt(flat(sym("Patch")), 1)).toEqual([E | C | W | S]);
    const loop = m.readProfileCounts(flat(sym("Loop")), 1)!;
    expect(loop.exec[0]).toBe(10);
    // --- The offset is named after the bank that holds it: Main is bank $22's byte $0000
    expect(profileLocationOf(z88ProfileLayout, main)).toEqual({ partition: 0x22, address: 0, rom: false });
    expect(profileOffsetOf(z88ProfileLayout, m.getCurrentPartitions()[4], sym("Main"))).toBe(main);
  });

  describe("maps reads and writes through the paging (trap T2)", () => {
    /*
     * Reads and writes one address with `ld a,(nn)` / `ld (nn),a`, run from bank $22 at $8000, and
     * returns the offsets that got R and W
     */
    function access(address: number): { read: number[]; written: number[] } {
      const code = [0x3a, address & 0xff, address >> 8, 0x32, address & 0xff, address >> 8];
      s.poke(0x8000, code);
      profiled(0x8000, 2);
      const touched = m.readProfileTouched(R | W)!;
      const data = touched.filter((b) => b.offset < FLAT_SR2_BASE || b.offset >= FLAT_SR2_BASE + code.length);
      return {
        read: data.filter((b) => b.flags & R).map((b) => b.offset),
        written: data.filter((b) => b.flags & W).map((b) => b.offset)
      };
    }

    function chipMask(slot: number): number {
      return exports().z88GetSlotChipMask(slot);
    }

    /* The storage of a bank (the core's `z88BankOffset`, through the card's chip mask) */
    function bankBase(bank: number): number {
      return z88BankStorageOffset(bank, chipMask);
    }

    beforeEach(async () => {
      await s.loadCode("nop");
    });

    it("COM.RAMS: internal RAM bank $20 at $0000-$1FFF, else the slot-0 ROM, which ignores writes", () => {
      expect(access(0x1234)).toEqual({ read: [0x80000 + 0x1234], written: [0x80000 + 0x1234] });
      s.out(0xb0, Z88_FLAT_RAM_LAYOUT.COM & ~0x04);
      expect(access(0x1234)).toEqual({ read: [0x1234], written: [] });
      expect(profileLocationOf(z88ProfileLayout, 0x1234)).toEqual({ partition: 0, address: 0x1234, rom: true });
    });

    it("SR0: $2000-$3FFF is the half of SR0's even bank that SR0 bit 0 selects", () => {
      for (const sr0 of [0x20, 0x21, 0x22, 0x23, 0x24, 0x25]) {
        s.out(0xd0, sr0);
        const expected = bankBase(sr0 & 0xfe) + (sr0 & 1) * 0x2000 + 0x0456;
        expect(access(0x2456), `SR0=$${sr0.toString(16)}`).toEqual({ read: [expected], written: [expected] });
        expect(profileLocationOf(z88ProfileLayout, expected)?.partition).toBe(sr0 & 0xfe);
      }
    });

    it("SR1-SR3: a whole bank per segment, named by getCurrentPartitions", () => {
      const cases: [number, number, number][] = [
        [0xd1, 0x24, 0x4321],
        [0xd1, 0x3f, 0x7fff],
        [0xd3, 0x2a, 0xc000],
        [0xd3, 0x31, 0xdead]
      ];
      for (const [port, bank, address] of cases) {
        s.out(port, bank);
        const expected = bankBase(bank) + (address & 0x3fff);
        expect(access(address), `bank $${bank.toString(16)}`).toEqual({ read: [expected], written: [expected] });
        const partition = m.getCurrentPartitions()[address >> 13];
        expect(partition).toBe(bank);
        // --- A full-size card's bank: the layout's partition + address name the same offset
        expect(profileOffsetOf(z88ProfileLayout, partition, address)).toBe(expected);
      }
      s.out(0xd1, Z88_FLAT_RAM_LAYOUT.SR1);
      s.out(0xd3, Z88_FLAT_RAM_LAYOUT.SR3);
    });

    it("the slot-0 ROM paged into a segment: reads map, writes do not", () => {
      s.out(0xd1, 0x03);
      const expected = 3 * 0x4000 + 0x0100;
      expect(access(0x4100)).toEqual({ read: [expected], written: [] });
    });

    it("an empty slot maps nowhere", () => {
      s.out(0xd1, 0x40);
      s.out(0xd3, 0xc5);
      expect(access(0x4100)).toEqual({ read: [], written: [] });
      expect(access(0xc100)).toEqual({ read: [], written: [] });
    });

    it("a card smaller than its slot is flagged at the bank that holds it, whichever mirror is paged", async () => {
      await s.plugCard(1, { cardType: CardIds.RAM32, size: 32 });
      s.mapFlatRam();
      for (const bank of [0x40, 0x41, 0x43, 0x7e, 0x7f]) {
        s.out(0xd1, bank);
        const expected = 0x100000 + (bank & 1) * 0x4000 + 0x0042;
        expect(access(0x4042), `bank $${bank.toString(16)}`).toEqual({ read: [expected], written: [expected] });
        expect(profileLocationOf(z88ProfileLayout, expected)?.partition).toBe(0x40 | (bank & 1));
      }
    });

    it("an EPROM is read-only until it is programmed", async () => {
      await s.plugCard(3, { cardType: CardIds.EPROMUV128, size: 128 });
      s.mapFlatRam();
      s.out(0xd3, 0xc1);
      const expected = 0x300000 + 0x4000 + 0x0010;
      expect(access(0xc010)).toEqual({ read: [expected], written: [] });
      // --- Programming: EPR = $69 for a 128K chip, COM.VPPON | COM.PROGRAM (Blink documentation)
      s.out(0xb3, 0x69);
      s.out(0xb0, Z88_FLAT_RAM_LAYOUT.COM | 0x02 | 0x08);
      expect(access(0xc010)).toEqual({ read: [expected], written: [expected] });
    });

    it("a flash chip's command cycles are not stores; its byte program is", async () => {
      await s.plugCard(1, { cardType: CardIds.AMDF29F040B, size: 512 });
      s.mapFlatRam();
      s.out(0xd3, 0x41);
      // --- The AMD byte program: two unlock cycles, $A0, then the byte (the benchmark's FLASH loop)
      const code = [
        0x3e, 0xaa, 0x32, 0x55, 0xc5, // ld a,$aa; ld ($c555),a
        0x3e, 0x55, 0x32, 0xaa, 0xc2, // ld a,$55; ld ($c2aa),a
        0x3e, 0xa0, 0x32, 0x55, 0xc5, // ld a,$a0; ld ($c555),a
        0x3e, 0x12, 0x32, 0x34, 0xc0 // ld a,$12; ld ($c034),a
      ];
      s.poke(0x8000, code);
      profiled(0x8000, 8);
      const written = m.readProfileTouched(W)!.map((b) => b.offset);
      expect(written).toEqual([0x100000 + 0x4000 + 0x0034]);
      expect(s.physPeek(0x100000 + 0x4000 + 0x0034)).toBe(0x12);
    });
  });

  it("charges every T-state either to an address or to a header bucket (D7)", async () => {
    await s.loadCode(
      `
        .org $8000
Main:   ld hl,$a000
Loop:   inc (hl)
        djnz Loop
        jr Main
`
    );
    m.resetProfile();
    m.setProfiling(true, true);
    s.runFrames(5);
    m.setProfiling(false, true);
    const info = m.getProfileInfo()!;
    const touched = m.readProfileTouched()!;
    const charged = touched.reduce((sum, b) => sum + (b.time ?? 0), 0);
    expect(info.timeTotal).toBeGreaterThanOrEqual(4 * 16384);
    expect(info.timeSnooze).toBe(0);
    expect(charged).toBe(info.timeTotal - info.timeIntAck - info.timeNmiAck - info.timeDma - info.timeSnooze);
    expect(info.instructions).toBe(touched.reduce((sum, b) => sum + (b.exec ?? 0), 0));
  });

  it("puts the snooze in its own bucket, not on an instruction (D7)", async () => {
    // --- INT.KWAIT set and no key down: the keyboard read snoozes the CPU (Blink documentation)
    const program = await s.loadCode(
      `
        .org $8000
Main:   ld a,$80
        out ($b1),a
        ld a,$fe
        in a,($b2)
Done:   jr Done
`
    );
    m.resetProfile();
    m.setProfiling(true, true);
    s.runFrames(4);
    m.setProfiling(false, true);
    expect(s.snoozed).toBe(true);
    const info = m.getProfileInfo()!;
    const touched = m.readProfileTouched()!;
    const charged = touched.reduce((sum, b) => sum + (b.time ?? 0), 0);
    // --- Four instructions ran; the rest of the four frames (less a 16-tact pause's rounding) snoozed
    expect(info.instructions).toBe(4);
    expect(info.timeSnooze).toBeGreaterThan(3 * 16384);
    expect(charged).toBe(info.timeTotal - info.timeIntAck - info.timeNmiAck - info.timeDma - info.timeSnooze);
    // --- IN A,(n) takes 11 T-states and keeps exactly those: the snooze after it is not its time
    const inAt = flat(program.symbol("Done") - 2);
    expect(m.readProfileCounts(inAt, 1)!.time[0]).toBe(11);
    expect(m.readProfileCounts(flat(program.symbol("Done")), 1)!.exec[0]).toBe(0);
  });

  it("tracks a CALL and its RET as one edge (PROFILER_PLAN Phase 3)", async () => {
    const program = await s.loadCode(
      `
        .org $8000
Main:   call Sub
Done:   jr Done
Sub:    nop
        ret
`
    );
    m.resetProfile();
    m.setProfiling(true, true);
    m.setProfileCalls(true);
    s.runTo("Done");
    m.setProfiling(false, true);
    m.setProfileCalls(false);
    const sub = flat(program.symbol("Sub"));
    const own = Array.from(m.readProfileCounts(sub, 2)!.time).reduce((a, b) => a + b, 0);
    expect(own).toBeGreaterThanOrEqual(14);
    // --- An interrupt may land inside Sub: its time is the handler's, not Sub's (D11)
    expect(m.readProfileEdges()!.filter((e) => e.callee === sub)).toEqual([
      expect.objectContaining({ caller: PROFILE_KEY_ROOT, calls: 1, inclusive: own, exclusive: own })
    ]);
  });
});
