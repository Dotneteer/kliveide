import { AssemblerOptions } from "@main/compiler-common/assembler-in-out";
import { SpectrumModelType } from "@main/z80-compiler/SpectrumModelTypes";
import { Z80Assembler } from "@main/z80-compiler/z80-assembler";

/*
 * An 8K stand-in for the DivMMC's esxDOS ROM, written for these tests: Klive cannot ship esxDOS
 * (.plans/DISK_IMAGES_AND_FILE_SYSTEMS_PLAN.md, C5 - the user names their copy). It answers the
 * automap's entry points by counting them in the interface's RAM bank 0 (which the ROM sees at $2000
 * while it is mapped) and leaving through the $1FF8-$1FFF unmap area:
 *
 *   $2000  reset (RST $00)   $2001  RST $08   $2002  the NMI   $2003  $3Dxx (code put in bank 0)
 *   $2004  RST $38 (the IM 1 interrupt, which esxDOS hands back to the Spectrum ROM, as here)
 *
 * A delayed entry point maps after the opcode fetch, so the opcode at $0000, $0008 and $0066 is the
 * Spectrum ROM's and its operands are this ROM's: $0009-$000A repeat the 48K ROM's `LD HL,(CH_ADD)`
 * operands, as esxDOS does.
 */
const SOURCE = `
  .model Spectrum48
  .org #0000
  db #a5              ; never executed (the opcode fetch at $0000 is the Spectrum ROM's); conmem reads it
  jp boot             ; $0001: the reset

  .org #0008
  db #2a              ; the Spectrum ROM's opcode (never fetched from here)
  db #5d, #5c         ; LD HL,(CH_ADD)'s operands, read from this ROM
  ld a,(#2001)
  inc a
  ld (#2001),a
  jp leaveRet

  .org #0038
  db #f5              ; PUSH AF: the Spectrum ROM's opcode (the IM 1 interrupt)
  push hl             ; $0039: count it, then on into the Spectrum ROM's handler at $0039
  ld hl,#2004
  inc (hl)
  ld hl,#0039
  ex (sp),hl
  jp leaveRet

  .org #0066
  db #f5              ; PUSH AF: the Spectrum ROM's opcode
  ld hl,#2002
  inc (hl)
  pop af
  retn                ; RETN unmaps the DivMMC

boot:
  ld hl,#2000
  inc (hl)
  ld hl,#0001         ; on into the Spectrum ROM's reset, past the trap at $0000
  push hl
  jp leaveRet

  .org #1ff8
leaveRet:
  ret                 ; the fetch here unmaps (after it: an operand would come from the Spectrum ROM)
`;

let cached: Uint8Array | undefined;

export async function buildDivMmcTestRom(): Promise<Uint8Array> {
  if (cached) return cached;
  const options = new AssemblerOptions();
  options.currentModel = SpectrumModelType.Spectrum48;
  const output = await new Z80Assembler().compile(SOURCE, options);
  const errors = output.errors.filter((e) => !e.isWarning);
  if (errors.length) throw new Error(errors.map((e) => `line ${e.line}: ${e.message}`).join("\n"));
  const rom = new Uint8Array(0x2000);
  for (const segment of output.segments) rom.set(segment.emittedCode, segment.startAddress);
  cached = rom;
  return rom;
}

/** Where the counters are in the interface's memory (the ROM, then RAM bank 0) */
export const COUNTER = { reset: 0x2000, rst8: 0x2001, nmi: 0x2002, trap3d: 0x2003, rst38: 0x2004 } as const;

/**
 * Code for RAM bank 0 at offset $1D00 ($3D00 while mapped): the $3Dxx entry point, instant - the
 * fetch at $3D00 already reads it
 */
export const TRAP_3D_CODE = [
  0x3a, 0x03, 0x20, // LD A,($2003)
  0x3c, //             INC A
  0x32, 0x03, 0x20, // LD ($2003),A
  0xc3, 0xf8, 0x1f //  JP $1FF8 (RET, unmapping)
];
