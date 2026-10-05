import { AssemblerOptions } from "@main/compiler-common/assembler-in-out";
import { SpectrumModelType } from "@main/z80-compiler/SpectrumModelTypes";
import { Z80Assembler } from "@main/z80-compiler/z80-assembler";

import type { Sp128TestSession } from "../../harness/sp128";

/*
 * A 16K stand-in for the TR-DOS ROM, written for these tests: Klive cannot ship TR-DOS
 * (`.plans/BETA128_TRDOS_PLAN.md` Q1). It holds FDC routines at $3D00, so a test enters them the way
 * TR-DOS is entered - by fetching an instruction from $3D00-$3DFF with the 48K BASIC ROM selected -
 * and they leave by returning to RAM, which pages the ROM out. They drive the WD1793 through the
 * interface's ports with real CPU timing, so DRQ, Lost Data and INTRQ are what a program sees.
 *
 * Entry points (a jump table at $3D00):
 *   SYS    A -> port $FF            TRACK  A -> $3F        SECTOR A -> $5F       DATA A -> $7F
 *   WAIT   A = command; waits for INTRQ; A = status
 *   READ   A = command, HL = buffer; stores every DRQ byte; A = status, HL = past the last byte
 *   WRITE  A = command, HL = buffer; feeds every DRQ byte; A = status
 *   STATUS A = status (resets INTRQ)
 *   SLOW   as READ, but ~270 T per byte: slower than the disk (Lost Data)
 *   REGS   A = status, B = track, C = sector, D = data
 *   CMD    A -> $1F (a command), and return at once
 *   WAITI  waits for INTRQ without issuing a command; A = status
 *   INDEX  polls the status 65 536 times (~4.7 revolutions); A = rising edges of the Index bit
 */
export const ENTRY = {
  SYS: 0x3d00,
  TRACK: 0x3d03,
  SECTOR: 0x3d06,
  DATA: 0x3d09,
  WAIT: 0x3d0c,
  READ: 0x3d0f,
  WRITE: 0x3d12,
  STATUS: 0x3d15,
  SLOW: 0x3d18,
  REGS: 0x3d1b,
  CMD: 0x3d1e,
  WAITI: 0x3d21,
  INDEX: 0x3d24
} as const;

const SOURCE = `
  .model Spectrum128
  .org #3d00
  jp sysOut
  jp setTrack
  jp setSector
  jp setData
  jp cmdWait
  jp cmdRead
  jp cmdWrite
  jp readStatus
  jp cmdReadSlow
  jp readRegs
  jp cmdOnly
  jp waitIntrq
  jp indexCount
sysOut:
  out (#ff),a
  ret
setTrack:
  out (#3f),a
  ret
setSector:
  out (#5f),a
  ret
setData:
  out (#7f),a
  ret
cmdWait:
  out (#1f),a
cw1:
  in a,(#ff)
  and #80
  jr z,cw1
  in a,(#1f)
  ret
cmdRead:
  out (#1f),a
cr1:
  in a,(#ff)
  bit 6,a
  jr nz,crData
  and #80
  jr z,cr1
  in a,(#1f)
  ret
crData:
  in a,(#7f)
  ld (hl),a
  inc hl
  jr cr1
cmdWrite:
  out (#1f),a
cwr1:
  in a,(#ff)
  bit 6,a
  jr nz,cwrData
  and #80
  jr z,cwr1
  in a,(#1f)
  ret
cwrData:
  ld a,(hl)
  out (#7f),a
  inc hl
  jr cwr1
readStatus:
  in a,(#1f)
  ret
cmdReadSlow:
  out (#1f),a
crs1:
  in a,(#ff)
  bit 6,a
  jr nz,crsData
  and #80
  jr z,crs1
  in a,(#1f)
  ret
crsData:
  ld b,20
crsWait:
  djnz crsWait
  in a,(#7f)
  ld (hl),a
  inc hl
  jr crs1
cmdOnly:
  out (#1f),a
  ret
waitIntrq:
  in a,(#ff)
  and #80
  jr z,waitIntrq
  in a,(#1f)
  ret
indexCount:
  ld bc,0
  ld de,0
  ld h,0
ic1:
  in a,(#1f)
  and 2
  cp h
  jr z,ic2
  ld h,a
  or a
  jr z,ic2
  inc bc
ic2:
  dec de
  ld a,d
  or e
  jr nz,ic1
  ld a,c
  ret
readRegs:
  in a,(#3f)
  ld b,a
  in a,(#5f)
  ld c,a
  in a,(#7f)
  ld d,a
  in a,(#1f)
  ret
`;

let cached: Uint8Array | undefined;

/** The 16K test ROM */
export async function buildTestTrdosRom(): Promise<Uint8Array> {
  if (cached) return cached;
  const options = new AssemblerOptions();
  options.currentModel = SpectrumModelType.Spectrum128;
  const output = await new Z80Assembler().compile(SOURCE, options);
  const errors = output.errors.filter((e) => !e.isWarning);
  if (errors.length) throw new Error(errors.map((e) => `line ${e.line}: ${e.message}`).join("\n"));
  const rom = new Uint8Array(0x4000);
  for (const segment of output.segments) rom.set(segment.emittedCode, segment.startAddress);
  cached = rom;
  return rom;
}

/** The RAM stub that calls a routine: at $8000, results at $8100 */
const STUB = 0x8000;
export const RESULT = 0x8100;
export const BUFFER = 0x9000;

export type CallResult = { a: number; bc: number; de: number; hl: number; tacts: number };

/**
 * Calls a test-ROM routine as a program would: DI, the 48K BASIC ROM paged in ($7FFD = $10, which
 * arms the trap), A and HL set, CALL; it returns to RAM, which pages the TR-DOS ROM out.
 * `tacts` is the CPU time from the CALL to the return.
 */
export function callRom(s: Sp128TestSession, entry: number, a = 0, hl = BUFFER, maxFrames = 400): CallResult {
  const code = [
    0xf3, //                                   DI
    0x01, 0xfd, 0x7f, 0x3e, 0x10, 0xed, 0x79, // LD BC,$7FFD / LD A,$10 / OUT (C),A
    0x21, hl & 0xff, hl >> 8, //               LD HL,hl
    0x3e, a & 0xff, //                         LD A,a
    0xcd, entry & 0xff, entry >> 8, //         CALL entry
    0x32, RESULT & 0xff, RESULT >> 8, //       LD (RESULT),A
    0x18, 0xfe //                              JR $
  ];
  s.poke(STUB, code);
  const x = s.machine.wasmV2Runtime!.exports as unknown as Record<string, (...args: number[]) => number>;
  x.sp128SetCpuHalted(0);
  x.sp128SetCpuIff1(0);
  x.sp128SetCpuIff2(0);
  s.machine.pc = STUB;
  s.runTo(STUB + 13, { maxFrames: 5 });
  const start = x.sp128GetTacts();
  s.runTo(STUB + 16, { maxFrames });
  const tacts = x.sp128GetTacts() - start;
  // --- On to the JR $: the return address's own fetch is what pages TR-DOS out
  s.runTo(STUB + 19, { maxFrames: 5 });
  const cpu = s.cpu();
  return { a: cpu.af >> 8, bc: cpu.bc, de: cpu.de, hl: cpu.hl, tacts };
}
