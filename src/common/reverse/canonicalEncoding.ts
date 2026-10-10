/*
 * Which instruction encodings survive a trip through Klive's disassembler and assembler unchanged
 * (`.plans/REVERSE_ENGINEERING_TOOLS_PLAN.md` §7.3, R10).
 *
 * The disassembler names an instruction by what it *does*; the assembler picks one encoding per
 * name. Where the Z80 has several encodings for one operation — the `NEG` and `RETN` mirrors, the
 * `IM` mirrors, the long `LD (nn),HL` — or an encoding the disassembler can only call `nop` — an
 * undefined `ED xx`, a `DD`/`FD` prefix before an opcode with no indexed form — writing the
 * disassembly back as source silently changes the bytes. Source export (G7.6) asks this module
 * before it trusts an instruction's text, and writes `.defb` for every encoding it rejects.
 *
 * The table is the observed behaviour of today's disassembler and assembler, and it is checked
 * exhaustively by `test/reverse-eng/canonicalEncoding.test.ts`: every opcode pattern is
 * disassembled and assembled, and this module must predict the outcome exactly. A change to either
 * tool that breaks a round trip fails that test before it reaches an export.
 */

/** `ED xx` mirrors the disassembler names after their canonical twin. */
const ED_MIRRORS = new Set([
  // --- NEG (canonical ED 44)
  0x4c, 0x54, 0x5c, 0x64, 0x6c, 0x74, 0x7c,
  // --- RETN (canonical ED 45)
  0x55, 0x5d, 0x65, 0x6d, 0x75, 0x7d,
  // --- IM 0 / IM 1 / IM 2 (canonical ED 46 / 56 / 5E)
  0x4e, 0x66, 0x6e, 0x76, 0x7e,
  // --- LD (nn),HL / LD HL,(nn) (canonical 22 / 2A)
  0x63, 0x6b
]);

/** The `ED xx` the plain Z80 defines; anything else is listed as `nop`. */
function isDefinedEd(op: number): boolean {
  if (op >= 0x40 && op <= 0x7f) return op !== 0x77 && op !== 0x7f;
  // --- The block instructions: A0-A3, A8-AB, B0-B3, B8-BB
  return (op & 0xe4) === 0xa0;
}

/** The ZX Spectrum Next's extra `ED xx` instructions. */
const Z80N_ED = new Set([
  0x23, 0x24, 0x27, 0x28, 0x29, 0x2a, 0x2b, 0x2c, 0x30, 0x31, 0x32, 0x33, 0x34, 0x35, 0x36, 0x8a,
  0x90, 0x91, 0x92, 0x93, 0x94, 0x95, 0x98, 0xa4, 0xa5, 0xac, 0xb4, 0xb7, 0xbc
]);

/**
 * The opcodes a `DD`/`FD` prefix turns into an IX/IY instruction. Before any other opcode the
 * prefix does nothing, the disassembler lists the bare instruction, and the assembler drops the
 * prefix byte.
 */
const INDEXED_OPCODES = new Set([
  0x09, 0x19, 0x21, 0x22, 0x23, 0x24, 0x25, 0x26, 0x29, 0x2a, 0x2b, 0x2c, 0x2d, 0x2e, 0x34, 0x35,
  0x36, 0x39, 0x44, 0x45, 0x46, 0x4c, 0x4d, 0x4e, 0x54, 0x55, 0x56, 0x5c, 0x5d, 0x5e, 0x60, 0x61,
  0x62, 0x63, 0x64, 0x65, 0x66, 0x67, 0x68, 0x69, 0x6a, 0x6b, 0x6c, 0x6d, 0x6e, 0x6f, 0x70, 0x71,
  0x72, 0x73, 0x74, 0x75, 0x77, 0x7c, 0x7d, 0x7e, 0x84, 0x85, 0x86, 0x8c, 0x8d, 0x8e, 0x94, 0x95,
  0x96, 0x9c, 0x9d, 0x9e, 0xa4, 0xa5, 0xa6, 0xac, 0xad, 0xae, 0xb4, 0xb5, 0xb6, 0xbc, 0xbd, 0xbe,
  0xcb, 0xe1, 0xe3, 0xe5, 0xe9, 0xf9
]);

/** Why an encoding does not reassemble, for the comment beside its `.defb`. */
export type NonCanonicalReason =
  | "undefined-ed"
  | "ed-mirror"
  | "ignored-prefix"
  | "indexed-bit-mirror";

/**
 * Why the instruction's text would not assemble back to these bytes, or `undefined` when it would.
 *
 * @param opcodes The instruction's bytes, as the disassembler took them
 * @param z80n Whether the Next's extended instructions are decoded
 */
export function nonCanonicalReason(
  opcodes: ArrayLike<number>,
  z80n: boolean
): NonCanonicalReason | undefined {
  const first = opcodes[0];
  if (first === 0xed) {
    const op = opcodes[1];
    if (op === undefined) return "undefined-ed";
    if (ED_MIRRORS.has(op)) return "ed-mirror";
    if (isDefinedEd(op) || (z80n && Z80N_ED.has(op))) return undefined;
    return "undefined-ed";
  }
  if (first === 0xdd || first === 0xfd) {
    const op = opcodes[1];
    if (op === undefined || !INDEXED_OPCODES.has(op)) return "ignored-prefix";
    // --- `BIT b,(IX+d)` has eight encodings; only the one whose low bits are 6 is the canonical one
    if (op === 0xcb) {
      const sub = opcodes[3];
      if (sub !== undefined && (sub & 0xc0) === 0x40 && (sub & 0x07) !== 0x06) {
        return "indexed-bit-mirror";
      }
    }
  }
  return undefined;
}

/** Whether the disassembler's text for these bytes assembles back to exactly these bytes. */
export function isReassemblable(opcodes: ArrayLike<number>, z80n: boolean): boolean {
  return nonCanonicalReason(opcodes, z80n) === undefined;
}

/** A short phrase for a `.defb`'s comment: why the instruction is not written as itself. */
export function describeNonCanonical(reason: NonCanonicalReason): string {
  switch (reason) {
    case "undefined-ed":
      return "undefined ED opcode";
    case "ed-mirror":
      return "non-canonical";
    case "ignored-prefix":
      return "prefix has no effect";
    case "indexed-bit-mirror":
      return "non-canonical";
  }
}
