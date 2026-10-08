import { describe, expect, it } from "vitest";
import { instructionStarts, z80InstructionLength } from "@common/profile/z80InstructionLength";

/* Instruction lengths for coverage's partial lines (`.plans/CODE_COVERAGE_AND_HEAT_MAP_PLAN.md` T8) */

describe("z80InstructionLength", () => {
  const cases: [string, number[], number, boolean?][] = [
    ["nop", [0x00], 1],
    ["ld a,n", [0x3e, 1], 2],
    ["ld hl,nn", [0x21, 0, 0], 3],
    ["jr", [0x18, 0], 2],
    ["call nn", [0xcd, 0, 0], 3],
    ["bit 0,a", [0xcb, 0x47], 2],
    ["ldir", [0xed, 0xb0], 2],
    ["ld (nn),bc", [0xed, 0x43, 0, 0], 4],
    ["ld ix,nn", [0xdd, 0x21, 0, 0], 4],
    ["ld (ix+d),n", [0xdd, 0x36, 1, 2], 4],
    ["ld a,(iy+d)", [0xfd, 0x7e, 1], 3],
    ["inc (ix+d)", [0xdd, 0x34, 1], 3],
    ["jp (ix)", [0xdd, 0xe9], 2],
    ["ld ixh,n", [0xdd, 0x26, 1], 3],
    ["rlc (ix+d)", [0xdd, 0xcb, 1, 6], 4],
    ["dd dd", [0xdd, 0xdd, 0x00], 1],
    ["nextreg n,n (Z80N)", [0xed, 0x91, 7, 3], 4, true],
    ["nextreg n,a (Z80N)", [0xed, 0x92, 7], 3, true],
    ["push nn (Z80N)", [0xed, 0x8a, 0, 0], 4, true],
    ["test n (Z80N)", [0xed, 0x27, 1], 3, true],
    ["ed 91 without Z80N", [0xed, 0x91], 2, false]
  ];
  for (const [name, bytes, length, z80n] of cases) {
    it(name, () => expect(z80InstructionLength(bytes, 0, z80n)).toBe(length));
  }

  it("walks a run of instructions", () => {
    expect(instructionStarts([0x3e, 1, 0xdd, 0x77, 2, 0xc9], 0, 6)).toEqual([0, 2, 5]);
  });
});
