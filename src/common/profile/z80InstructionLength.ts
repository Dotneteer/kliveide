/*
 * The length of a Z80 (and Z80N) instruction from its first bytes. Coverage needs the instruction
 * starts inside a line that emitted several instructions - a Klive BASIC statement, an sjasmplus
 * fake instruction - to tell a fully covered line from a partly covered one
 * (`.plans/CODE_COVERAGE_AND_HEAT_MAP_PLAN.md` T8).
 */

/** Unprefixed opcodes followed by one operand byte */
const ONE_OPERAND = new Set([
  0x06, 0x0e, 0x10, 0x16, 0x18, 0x1e, 0x20, 0x26, 0x28, 0x2e, 0x30, 0x36, 0x38, 0x3e, 0xc6, 0xce, 0xd3, 0xd6, 0xdb, 0xde,
  0xe6, 0xee, 0xf6, 0xfe
]);

/** Unprefixed opcodes followed by a 16-bit operand */
const TWO_OPERANDS = new Set([
  0x01, 0x11, 0x21, 0x22, 0x2a, 0x31, 0x32, 0x3a, 0xc2, 0xc3, 0xc4, 0xca, 0xcc, 0xcd, 0xd2, 0xd4, 0xda, 0xdc, 0xe2, 0xe4,
  0xea, 0xec, 0xf2, 0xf4, 0xfa, 0xfc
]);

/** Opcodes that address (HL): with a DD/FD prefix they take a displacement byte */
const HL_INDIRECT = new Set([
  0x34, 0x35, 0x36, 0x46, 0x4e, 0x56, 0x5e, 0x66, 0x6e, 0x70, 0x71, 0x72, 0x73, 0x74, 0x75, 0x77, 0x7e, 0x86, 0x8e, 0x96,
  0x9e, 0xa6, 0xae, 0xb6, 0xbe
]);

/** The ED instructions longer than two bytes: LD (nn),rr / LD rr,(nn), and the Z80N's */
function edLength(op: number, z80n: boolean): number {
  if ((op & 0xc7) === 0x43) return 4;
  if (z80n) {
    switch (op) {
      case 0x27: // TEST n
      case 0x92: // NEXTREG r,A
        return 3;
      case 0x34: // ADD HL,nn
      case 0x35: // ADD DE,nn
      case 0x36: // ADD BC,nn
      case 0x8a: // PUSH nn
      case 0x91: // NEXTREG r,n
        return 4;
    }
  }
  return 2;
}

function baseLength(op: number): number {
  if (TWO_OPERANDS.has(op)) return 3;
  if (ONE_OPERAND.has(op)) return 2;
  if (op === 0xcb) return 2;
  return 1;
}

/**
 * The length of the instruction at `offset` (at least 1; bytes past the end count as zero)
 * @param z80n Decode the ZX Spectrum Next's extended ED instructions
 */
export function z80InstructionLength(bytes: ArrayLike<number>, offset: number, z80n = false): number {
  const at = (i: number) => (offset + i < bytes.length ? bytes[offset + i] : 0);
  const op = at(0);
  if (op === 0xed) return edLength(at(1), z80n);
  if (op === 0xdd || op === 0xfd) {
    const next = at(1);
    // --- A prefix followed by another prefix is a NOP of its own
    if (next === 0xdd || next === 0xfd || next === 0xed) return 1;
    if (next === 0xcb) return 4;
    return 1 + baseLength(next) + (HL_INDIRECT.has(next) ? 1 : 0);
  }
  return baseLength(op);
}

/** The offsets of the instructions that start in `bytes[from, from + length)` */
export function instructionStarts(bytes: ArrayLike<number>, from: number, length: number, z80n = false): number[] {
  const starts: number[] = [];
  let offset = from;
  const end = from + length;
  while (offset < end) {
    starts.push(offset);
    offset += z80InstructionLength(bytes, offset, z80n);
  }
  return starts;
}
