import { describe, expect, it } from "vitest";
import {
  PF_CODE,
  PF_EXECUTED,
  PF_INTERRUPT,
  PF_READ,
  PF_SELF_MODIFIED,
  PF_WRITTEN,
  PROFILE_KEY_ROOT
} from "@common/profile/profileTypes";
import { profileOffsetOf } from "@common/profile/layouts/profileLayout";
import { zx8081ProfileLayout } from "@common/profile/layouts/zx8081";
import { createZx81Session, type Zx81TestSession } from "../../harness/zx81";

/*
 * The access profile on the ZX80/ZX81 (`.plans/CODE_COVERAGE_AND_HEAT_MAP_PLAN.md` §2.2): a known
 * program gives exactly the expected E/C/R/W/S bytes (D3, D9); the profile offset is a byte's canonical
 * address whatever mirror reached it (`zx8081.c`'s macros, `layouts/zx8081.ts`), a write to the ROM
 * reaches nothing, the 64K model's opcode fetches above 32K land where they read; and every T-state of
 * a SLOW-mode frame - NMI-driven - is charged either to an address or to a header bucket (D7).
 */

const E = PF_EXECUTED;
const C = PF_CODE;
const R = PF_READ;
const W = PF_WRITTEN;
const S = PF_SELF_MODIFIED;

/** out ($fd),a; di: the ZX81's NMI generator off, and no INT */
const PROLOGUE = [0xd3, 0xfd, 0xf3];

/** Where the test programs return to: a stepped run stops there */
const RETURN = 0x6100;
const STACK = 0x6200;

/*
 * The test program, hand-assembled at $6000. The NMI generator is switched off around it, so the
 * ROM's display never runs between its instructions; IX (the ROM's display vector) is restored.
 */
const MAIN = 0x6000;
const LOOP = 0x601d;
const PATCH = 0x6030;
const DATA = 0x6040;
const DATA2 = 0x6042;
const PROGRAM = [
  0xd3, 0xfd, //             $6000 out ($fd),a     ; the NMI generator off
  0xf3, //                   $6002 di
  0xdd, 0xe5, //             $6003 push ix
  0x21, 0x40, 0x60, //       $6005 ld hl,Data
  0x7e, //                   $6008 ld a,(hl)
  0x32, 0x42, 0x60, //       $6009 ld (Data2),a
  0xdd, 0x21, 0x40, 0x60, // $600C ld ix,Data
  0xdd, 0x46, 0x01, //       $6010 ld b,(ix+1)
  0x3e, 0xc9, //             $6013 ld a,$c9
  0x32, 0x30, 0x60, //       $6015 ld (Patch),a
  0xcd, 0x30, 0x60, //       $6018 call Patch
  0x06, 0x0a, //             $601B ld b,10
  0x10, 0xfe, //             $601D Loop: djnz Loop
  0xdd, 0xe1, //             $601F pop ix
  0xc9 //                    $6021 ret
];

async function session(model?: string, machineId?: string): Promise<Zx81TestSession> {
  const s = await createZx81Session({ machineId, model });
  s.bootToBasic();
  return s;
}

/*
 * Runs the code at `address` with profiling on, stepping until it returns to `RETURN`. The CPU is
 * taken over wherever the ROM's frame left it - out of a HALT first (the PC cannot leave one), often
 * inside an interrupt service, so the X flag is left out of the comparisons (`flagsAt`). The programs
 * start with `PROLOGUE`, so neither an NMI nor an INT runs the ROM between their instructions.
 */
function call(s: Zx81TestSession, address: number, counters = true): void {
  const m = s.machine;
  for (let i = 0; i < 100_000 && s.wasm.zx8081GetCpuHalted() !== 0; i++) s.step(1);
  s.poke(STACK - 2, [RETURN & 0xff, RETURN >> 8]);
  m.sp = STACK - 2;
  m.pc = address;
  m.resetProfile();
  m.setProfiling(true, counters);
  try {
    for (let i = 0; i < 200_000 && m.pc !== RETURN; i++) s.step(1);
  } finally {
    m.setProfiling(false, counters);
  }
  expect(m.pc).toBe(RETURN);
}

/** The flags of a stretch of offsets, without X (see `call`) */
function flagsAt(s: Zx81TestSession, offset: number, length = 1): number[] {
  return Array.from(s.machine.readProfileFlags(offset, length)!).map((f) => f & ~PF_INTERRUPT);
}

describe("the ZX81's access profile", () => {
  it("is off by default and reports its layout", async () => {
    const s = await session();
    const info = s.machine.getProfileInfo()!;
    expect(info.enabled).toBe(false);
    expect(info.flagBytes).toBe(zx8081ProfileLayout.flagBytes);
    expect(info.poolPages).toBe(9);
    expect(info.timeUnit).toBe("T-states");
    expect(s.machine.profileMachineId).toBe("zx81");
  });

  it("flags instruction starts, code bytes, reads, writes and self-modified bytes", async () => {
    const s = await session();
    s.poke(MAIN, PROGRAM).poke(PATCH, 0x00).poke(DATA, [1, 2, 0]);
    call(s, MAIN);
    // --- out (n),a; di; push ix (DD E5: only the prefix starts the instruction); ld hl,nn; ld a,(hl)
    expect(flagsAt(s, MAIN, 9)).toEqual([E | C, C, E | C, E | C, C, E | C, C, C, E | C]);
    // --- ld (nn),a; ld ix,nn; ld b,(ix+1)
    expect(flagsAt(s, 0x6009, 3)).toEqual([E | C, C, C]);
    expect(flagsAt(s, 0x600c, 4)).toEqual([E | C, C, C, C]);
    expect(flagsAt(s, 0x6010, 3)).toEqual([E | C, C, C]);
    // --- The data: Data through HL, Data+1 through IX, Data2 written
    expect(flagsAt(s, DATA, 3)).toEqual([R, R, W]);
    // --- Patch was written before it ever ran, then fetched: self-modified (D9)
    expect(flagsAt(s, PATCH, 1)).toEqual([E | C | W | S]);
    // --- Nothing between the program, Patch and the data is touched
    expect(flagsAt(s, 0x6022, PATCH - 0x6022).every((f) => f === 0)).toBe(true);
    expect(flagsAt(s, PATCH + 1, DATA - PATCH - 1).every((f) => f === 0)).toBe(true);

    const loop = s.machine.readProfileCounts(LOOP, 2)!;
    expect(loop.exec[0]).toBe(10);
    // --- DJNZ: 13 T-states taken (9 times), 8 not taken; no WAIT with the NMI generator off
    expect(loop.time[0]).toBe(9 * 13 + 8);
    const data = s.machine.readProfileCounts(DATA, 3)!;
    expect(Array.from(data.read)).toEqual([1, 1, 0]);
    expect(Array.from(data.write)).toEqual([0, 0, 1]);
  });

  it("keeps the flags but no counts with counters off", async () => {
    const s = await session();
    s.poke(MAIN, PROGRAM).poke(PATCH, 0x00).poke(DATA, [1, 2, 0]);
    call(s, MAIN, false);
    expect(flagsAt(s, MAIN, 1)).toEqual([E | C]);
    expect(s.machine.readProfileCounts(LOOP, 1)!.counted[0]).toBe(0);
    expect(s.machine.getProfileInfo()!.pagesUsed).toBe(0);
  });
});

describe("the ZX80/ZX81's profile offsets: canonical addresses", () => {
  it("lands the ROM's and the 16K RAM's mirrors on one offset, and ROM writes nowhere", async () => {
    const s = await session();
    s.poke(0x6080, [
      ...PROLOGUE,
      0x3a, 0x00, 0x01, // ld a,($0100)
      0x3a, 0x00, 0x21, // ld a,($2100)  ; the ROM's mirror
      0x3a, 0x50, 0xe0, // ld a,($E050)  ; the RAM's echo of $6050
      0x32, 0x00, 0x10, // ld ($1000),a  ; the ROM
      0x32, 0x60, 0xa0, // ld ($A060),a  ; the RAM's echo of $6060
      0xc9 //              ret
    ]);
    call(s, 0x6080);
    expect(flagsAt(s, 0x0100)).toEqual([R]);
    expect(s.machine.readProfileCounts(0x0100, 1)!.read[0]).toBe(2);
    expect(flagsAt(s, 0x2100)).toEqual([0]);
    expect(flagsAt(s, 0x1000)).toEqual([0]);
    expect(flagsAt(s, 0x6050)).toEqual([R]);
    expect(flagsAt(s, 0x6060)).toEqual([W]);
    expect(flagsAt(s, 0xe050)).toEqual([0]);
    // --- The layout names those offsets by the same addresses
    expect(zx8081ProfileLayout.fixedAddress!(0x6050)).toBe(0x6050);
    expect(zx8081ProfileLayout.fixedRom!(0x0100)).toBe(true);
    expect(zx8081ProfileLayout.fixedRom!(0x6050)).toBe(false);
  });

  it("lands the ZX80's 4K ROM's mirror on the ROM's offset", async () => {
    const s = await session("zx80-16k", "zx80");
    s.poke(0x6080, [...PROLOGUE, 0x3a, 0x00, 0x11, 0x32, 0x00, 0x01, 0xc9]); // ld a,($1100); ld ($0100),a; ret
    call(s, 0x6080);
    expect(flagsAt(s, 0x0100)).toEqual([R]);
    expect(flagsAt(s, 0x1100)).toEqual([0]);
    expect(s.machine.profileMachineId).toBe("zx80");
  });

  it("maps the 1K's RAM to $4000 up, through any echo", async () => {
    const s = await session("zx81-1k");
    // --- Code at $4300 (the top of the 1K, below the stack the test sets up at its echo)
    s.poke(0x4300, [...PROLOGUE, 0x3a, 0x10, 0x87, 0xc9]); // ld a,($8710): the 1K's echo of $4310; ret
    const m = s.machine;
    for (let i = 0; i < 100_000 && s.wasm.zx8081GetCpuHalted() !== 0; i++) s.step(1);
    m.sp = 0x4400 - 2;
    s.poke(0x4400 - 2, [RETURN & 0xff, RETURN >> 8]);
    m.pc = 0x4300;
    m.resetProfile();
    m.setProfiling(true, true);
    // --- RETURN ($6100) is the 1K's echo of $4100: run to it
    for (let i = 0; i < 200_000 && m.pc !== RETURN; i++) s.step(1);
    m.setProfiling(false, true);
    expect(m.pc).toBe(RETURN);
    expect(flagsAt(s, 0x4310)).toEqual([R]);
    expect(flagsAt(s, 0x4303)).toEqual([E | C]);
    // --- The return address was popped from $43FE, the 1K's own top
    expect(flagsAt(s, 0x43fe, 2)).toEqual([R, R]);
  });

  it("maps the 64K's RAM by address, and its opcode fetches above 32K through the redirect", async () => {
    const s = await session("zx81-64k");
    const ram = s.machine.wasmV2Runtime!.ram;
    // --- An M1 at $8010 reads RAM $0010 - which no data access reaches - and the operands at
    // --- $8012-$8013 are data-side reads of the full 64K
    ram[0x0010] = 0x40; // ld b,b (bit 6 set: not a forced NOP)
    ram[0x0011] = 0xc3; // jp nn
    ram[0x8012] = RETURN & 0xff;
    ram[0x8013] = RETURN >> 8;
    s.poke(0x6080, [
      ...PROLOGUE,
      0x3a, 0x00, 0x21, // ld a,($2100)  ; RAM on the 64K
      0x32, 0x00, 0x21, // ld ($2100),a
      0x3a, 0x00, 0x01, // ld a,($0100)  ; the ROM
      0xc3, 0x10, 0x80 //  jp $8010
    ]);
    call(s, 0x6080);
    expect(flagsAt(s, 0x2100)).toEqual([R | W]);
    expect(flagsAt(s, 0x0100)).toEqual([R]);
    expect(flagsAt(s, 0x10010, 2)).toEqual([E | C, E | C]);
    expect(flagsAt(s, 0x8012, 2)).toEqual([C, C]);
    expect(flagsAt(s, 0x8010, 2)).toEqual([0, 0]);
    expect(flagsAt(s, 0x0010, 2)).toEqual([0, 0]);
  });
});

describe("the ZX80/ZX81's profiler time", () => {
  for (const machineId of ["zx81", "zx80"]) {
    it(`charges every T-state of a ${machineId} at the prompt to an address or a bucket (D7)`, async () => {
      const s = await session(undefined, machineId);
      s.machine.resetProfile();
      s.machine.setProfiling(true, true);
      s.runFrames(5);
      s.machine.setProfiling(false, true);
      const info = s.machine.getProfileInfo()!;
      const touched = s.machine.readProfileTouched()!;
      const charged = touched.reduce((sum, b) => sum + (b.time ?? 0), 0);
      expect(info.timeTotal).toBeGreaterThan(4 * 65000);
      expect(charged).toBe(info.timeTotal - info.timeIntAck - info.timeNmiAck - info.timeDma - info.timeSnooze);
      expect(info.instructions).toBe(touched.reduce((sum, b) => sum + (b.exec ?? 0), 0));
      expect(info.timeIntAck).toBeGreaterThan(0);
      if (machineId === "zx81") {
        // --- SLOW mode: the NMI generator's acknowledges (with their WAIT) are a bucket of their own,
        // --- and the ROM's NMI service runs inside an interrupt service
        expect(info.timeNmiAck).toBeGreaterThan(0);
        expect(s.machine.readProfileFlags(0x0066, 1)![0] & (E | PF_INTERRUPT)).toBe(E | PF_INTERRUPT);
      } else {
        expect(info.timeNmiAck).toBe(0);
      }
      // --- The display file is fetched through its echo above 32K as forced NOPs: those M1 cycles
      // --- land on the display file's own bytes, and the ROM wrote them, so they read as executed
      // --- and self-modified (see `zx8081.c`'s profile notes)
      const dFile = s.peekWord(0x400c);
      expect(s.machine.readProfileFlags(dFile + 1, 1)![0] & (E | C)).toBe(E | C);
      expect(s.machine.readProfileFlags((dFile + 1) | 0x8000, 1)![0]).toBe(0);
    });
  }
});

describe("the ZX81's display file in the profile", () => {
  it("reads as self-modified code once the ROM prints while profiling (the forced NOPs, D9)", async () => {
    const s = await session();
    s.machine.resetProfile();
    s.machine.setProfiling(true, false);
    s.typeKeys('P"HI"\n', { settle: 20 }); // K mode: P is PRINT; SHIFT+P the quote
    s.machine.setProfiling(false, false);
    expect(s.screenText()[0]).toBe("HI");
    const dFile = s.peekWord(0x400c);
    // --- "H": written by PRINT, then fetched through the echo as a NOP the ULA forced onto the bus
    expect(s.machine.readProfileFlags(dFile + 1, 1)![0] & (E | C | W | S)).toBe(E | C | W | S);
  });

  it("tracks a CALL and its RET as one edge (PROFILER_PLAN Phase 3)", async () => {
    const s = await session();
    // --- The prologue, then call $6008; ret; $6008: nop; ret
    s.poke(MAIN, [...PROLOGUE, 0xcd, 0x08, 0x60, 0xc9, 0x00, 0x00, 0xc9]);
    s.machine.setProfileCalls(true);
    call(s, MAIN);
    s.machine.setProfileCalls(false);
    const sub = profileOffsetOf(zx8081ProfileLayout, undefined, 0x6008)!;
    const own = Array.from(s.machine.readProfileCounts(sub, 2)!.time).reduce((a, b) => a + b, 0);
    expect(own).toBeGreaterThanOrEqual(14);
    expect(s.machine.readProfileEdges()!.filter((e) => e.callee === sub)).toEqual([
      expect.objectContaining({ caller: PROFILE_KEY_ROOT, calls: 1, inclusive: own, exclusive: own })
    ]);
  });
});
