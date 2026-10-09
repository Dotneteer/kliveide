import { beforeAll, describe, expect, it } from "vitest";
import {
  PF_CODE,
  PF_EXECUTED,
  PF_INTERRUPT,
  PF_READ,
  PF_SELF_MODIFIED,
  PF_WRITTEN
} from "@common/profile/profileTypes";
import { createSp48Session, type Sp48TestSession } from "../../harness/sp48";

/*
 * The access profile on the ZX Spectrum 48K (`.plans/CODE_COVERAGE_AND_HEAT_MAP_PLAN.md` Phases 0-1):
 * a known program gives exactly the expected E/C/R/W/S bytes (D3, D9), counts equal a hand count,
 * time per address sums to the total less the buckets (D7), and the debugger's own reads never
 * count (trap T1).
 */

const E = PF_EXECUTED;
const C = PF_CODE;
const R = PF_READ;
const W = PF_WRITTEN;
const S = PF_SELF_MODIFIED;

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
        ei
        ret
Patch:  nop
Data:   .defb 1,2
Data2:  .defb 0
`;

let s: Sp48TestSession;
let symbol: (name: string) => number;

beforeAll(async () => {
  s = await createSp48Session();
  s.bootToBasic();
  symbol = (await s.loadCode(PROGRAM)).symbol;
});

function flagsAt(address: number, length = 1): number[] {
  return Array.from(s.machine.readProfileFlags(address, length)!);
}

function run(): void {
  s.machine.resetProfile();
  s.machine.setProfiling(true, true);
  try {
    s.call("Main");
  } finally {
    s.machine.setProfiling(false, true);
  }
}

describe("the 48K's access profile", () => {
  it("is off by default and reports its layout", () => {
    const info = s.machine.getProfileInfo()!;
    expect(info.enabled).toBe(false);
    expect(info.flagBytes).toBe(0x10000);
    expect(info.poolPages).toBe(8);
    expect(info.timeUnit).toBe("T-states");
  });

  it("flags instruction starts, code bytes, reads, writes and self-modified bytes", () => {
    run();
    const main = symbol("Main");
    // --- di; ld hl,nn; ld a,(hl); ld (nn),a
    expect(flagsAt(main, 1)).toEqual([E | C]);
    expect(flagsAt(main + 1, 3)).toEqual([E | C, C, C]);
    expect(flagsAt(main + 4, 1)).toEqual([E | C]);
    expect(flagsAt(main + 5, 3)).toEqual([E | C, C, C]);
    // --- ld ix,nn (DD 21 n n): only the prefix byte starts the instruction
    expect(flagsAt(main + 8, 4)).toEqual([E | C, C, C, C]);
    // --- ld b,(ix+1) (DD 46 d)
    expect(flagsAt(main + 12, 3)).toEqual([E | C, C, C]);
    // --- The data: Data read twice (ld a,(hl) and nothing else), Data+1 through IX, Data2 written
    expect(flagsAt(symbol("Data"), 3)).toEqual([R, R, W]);
    // --- Patch was written before it ever ran, then fetched: self-modified (D9)
    expect(flagsAt(symbol("Patch"), 1)).toEqual([E | C | W | S]);
    // --- Nothing outside the program and its stack is touched by the program
    expect(flagsAt(symbol("Data2") + 1, 16).every((f) => f === 0)).toBe(true);
  });

  it("counts executions, reads and writes, and times each instruction start", () => {
    run();
    const loop = symbol("Loop");
    const counts = s.machine.readProfileCounts(loop, 2)!;
    expect(counts.exec[0]).toBe(10);
    expect(counts.exec[1]).toBe(0);
    // --- DJNZ: 13 T-states taken (9 times), 8 not taken; $8000 is uncontended
    expect(counts.time[0]).toBe(9 * 13 + 8);
    expect(counts.counted[0]).toBe(1);
    const data = s.machine.readProfileCounts(symbol("Data"), 3)!;
    expect(Array.from(data.read)).toEqual([1, 1, 0]);
    expect(Array.from(data.write)).toEqual([0, 0, 1]);
    // --- Main ran once: one DI
    expect(s.machine.readProfileCounts(symbol("Main"), 1)!.exec[0]).toBe(1);
  });

  it("charges every T-state either to an address or to a header bucket (D7)", () => {
    s.machine.resetProfile();
    s.machine.setProfiling(true, true);
    s.runFrames(5);
    s.machine.setProfiling(false, true);
    const info = s.machine.getProfileInfo()!;
    const touched = s.machine.readProfileTouched()!;
    const charged = touched.reduce((sum, b) => sum + (b.time ?? 0), 0);
    expect(info.timeIntAck).toBeGreaterThan(0);
    // --- The first of the five frames was entered part-way through (the previous test stopped mid-frame)
    expect(info.timeTotal).toBeGreaterThan(4 * 69888);
    expect(charged).toBe(info.timeTotal - info.timeIntAck - info.timeNmiAck - info.timeDma - info.timeSnooze);
    // --- The ROM's interrupt handler ran inside an interrupt service
    expect(s.machine.readProfileFlags(0x0038, 1)![0] & PF_INTERRUPT).toBe(PF_INTERRUPT);
    expect(info.instructions).toBe(touched.reduce((sum, b) => sum + (b.exec ?? 0), 0));
  });

  it("does not count the debugger's own reads (trap T1)", () => {
    // --- Reads with nothing executing: the memory view, the Watch panel
    s.machine.resetProfile();
    s.machine.setProfiling(true, true);
    for (let a = 0; a < 0x10000; a++) s.machine.doReadMemory(a);
    s.machine.setProfiling(false, true);
    expect(s.machine.readProfileTouched()!).toEqual([]);

    // --- Reads between the instructions of a run, with the history recorder peeking too: the
    // --- program's bytes are flagged and counted exactly as in a run without them
    run();
    const plain = s.machine.readProfileFlags(0x8000, 0x100)!;
    const plainCounts = s.machine.readProfileCounts(0x8000, 0x100)!;
    s.machine.resetProfile();
    s.machine.setProfiling(true, true);
    s.recordHistory(true);
    const ret = s.machine.pc;
    try {
      const sp = (s.machine.sp - 2) & 0xffff;
      s.pokeWord(sp, ret);
      s.machine.sp = sp;
      s.machine.pc = symbol("Main");
      for (let i = 0; i < 200 && s.machine.pc !== ret; i++) {
        s.step(1);
        for (let a = 0x7f00; a < 0x8100; a++) s.machine.doReadMemory(a);
      }
    } finally {
      s.recordHistory(false);
      s.machine.setProfiling(false, true);
    }
    expect(s.machine.pc).toBe(ret);
    expect(s.machine.readProfileFlags(0x8000, 0x100)!).toEqual(plain);
    const counts = s.machine.readProfileCounts(0x8000, 0x100)!;
    expect(counts.read).toEqual(plainCounts.read);
    expect(counts.exec).toEqual(plainCounts.exec);
  });

  it("keeps the flags but no counts with counters off", () => {
    s.machine.resetProfile();
    s.machine.setProfiling(true, false);
    s.call("Main");
    s.machine.setProfiling(false, false);
    expect(flagsAt(symbol("Main"), 1)).toEqual([E | C]);
    expect(s.machine.readProfileCounts(symbol("Loop"), 1)!.counted[0]).toBe(0);
    expect(s.machine.getProfileInfo()!.pagesUsed).toBe(0);
  });

  it("clears everything on reset and moves the generation on", () => {
    run();
    const before = s.machine.getProfileInfo()!.generation;
    s.machine.resetProfile();
    const info = s.machine.getProfileInfo()!;
    expect(info.generation).toBe(before + 1);
    expect(info.timeTotal).toBe(0);
    expect(info.pagesUsed).toBe(0);
    expect(s.machine.readProfileTouched()!).toEqual([]);
  });

  it("maps writes to the ROM nowhere", () => {
    s.machine.resetProfile();
    s.machine.setProfiling(true, true);
    s.poke(0x9000, [0x3e, 0x55, 0x32, 0x00, 0x10, 0xc9]); // ld a,$55; ld ($1000),a; ret
    s.call(0x9000);
    s.machine.setProfiling(false, true);
    expect(s.machine.readProfileFlags(0x1000, 1)![0] & PF_WRITTEN).toBe(0);
  });
});
