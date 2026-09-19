/*
 * Z80N instruction metadata the debugger needs, whichever core executes the code.
 */

/**
 * How many bytes each ED-prefixed Z80N instruction occupies, for step-over.
 *
 * Step-over plants a temporary breakpoint at `PC + length`. A wrong length points it into the
 * middle of the *next* instruction, where PC never lands — the breakpoint never fires and the
 * machine runs on to the next real one, which looks like step-over jumping somewhere unrelated.
 *
 * `test/emu/z80n-step-over-lengths.test.ts` checks every entry against the disassembler, which
 * derives lengths by consuming operand bytes rather than by hand. Exported for that test.
 */
export const extendedInstructionLenghts: Record<number, number> = {
  0xa4: 2,
  0xa5: 2,
  0xb4: 2,
  0xac: 2,
  0xbc: 2,
  0xb7: 2,
  0x90: 2,
  0x30: 2,
  0x31: 2,
  0x32: 2,
  0x33: 2,
  0x34: 4,
  0x35: 4,
  0x36: 4,
  0x23: 2,
  0x24: 2,
  0x8a: 4,
  0x91: 4,
  // --- `NEXTREG n,A` takes ONE operand byte where `NEXTREG n,n` takes two, so this is 3 and not 4.
  // --- It was 4, and stepping over `$00FD` in the Next ROM ran away to the next breakpoint.
  0x92: 3,
  0x93: 2,
  0x94: 2,
  0x95: 2,
  0x27: 3,
  0x28: 2,
  0x29: 2,
  0x2a: 2,
  0x2b: 2,
  0x2c: 2,
  0x98: 2
};

