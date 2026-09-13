import type {
  DisassemblyBranchCondition,
  DisassemblyBranchInfo
} from "../common-types";

/**
 * Which opcodes branch, and how — the single structured statement of Z80/Z80N control flow.
 *
 * Deliberately a module of its own rather than an extension of the instruction tables in
 * `z80-disassembler.ts`. Those are ~900 lines of `"mnemonic|t/t2"` text templates whose exact
 * format is asserted by `test/z80-disassembler/standard-ops.test.ts` and its siblings; widening
 * that syntax to carry branch data would put every one of those tests at risk to express something
 * that is not really about rendering. This map is purely additive: nothing reads it unless it asks.
 *
 * It is also the reason the block-repeat instructions are safe. `LDIR` and friends are encoded
 * `21/16` exactly like `CALL cc,nn` is encoded `17/10`, so any timing-based test for "is this
 * conditional" classifies them as branches. They are simply absent from this table, so they are
 * excluded by construction rather than by a filter a later edit could drop.
 *
 * Targets are not recomputed here. `processPragma`'s `^r` and `^L` already resolve the relative and
 * absolute forms into the item's `symbolValue`; the caller copies that across. `RST` is the one
 * exception — `^R` creates no symbol, so the vector is carried in `target` directly.
 */

/** The eight condition codes in opcode order: `cc` occupies bits 5-3 of the opcode. */
const CONDITIONS: DisassemblyBranchCondition[] = ["nz", "z", "nc", "c", "po", "pe", "p", "m"];

/**
 * The four conditions `JR cc` can take. `JR` has only two bits for `cc`, so it reaches the flag
 * pairs (Z and C) and not the parity/sign pairs — which is why `jr po` does not exist.
 */
const JR_CONDITIONS: DisassemblyBranchCondition[] = ["nz", "z", "nc", "c"];

function build(): Record<number, DisassemblyBranchInfo> {
  const map: Record<number, DisassemblyBranchInfo> = {
    // --- Relative jumps. DJNZ is conditional on B, which `kind` says; it takes no condition code.
    0x10: { kind: "djnz", tstatesTaken: 13, tstatesNotTaken: 8 },
    0x18: { kind: "jr", tstatesTaken: 12, tstatesNotTaken: 12 },

    // --- Absolute jumps and calls, unconditional forms.
    0xc3: { kind: "jp", tstatesTaken: 10, tstatesNotTaken: 10 },
    0xcd: { kind: "call", tstatesTaken: 17, tstatesNotTaken: 17 },

    // --- Unconditional return.
    0xc9: { kind: "ret", targetSource: "stack", tstatesTaken: 10, tstatesNotTaken: 10 },

    // --- `JP (HL)`. The indexed forms live in the DD/FD table below.
    0xe9: { kind: "jp-indirect", targetSource: "hl", tstatesTaken: 4, tstatesNotTaken: 4 }
  };

  // --- `JR cc,e` — 0x20 + (cc << 3), cc limited to the first four.
  JR_CONDITIONS.forEach((condition, index) => {
    map[0x20 + (index << 3)] = {
      kind: "jr",
      condition,
      tstatesTaken: 12,
      tstatesNotTaken: 7
    };
  });

  CONDITIONS.forEach((condition, index) => {
    const offset = index << 3;

    // --- `RET cc` — 0xC0 + (cc << 3). Five T-states when it does not return: the shortest
    // --- conditional in the instruction set, and the reason the two figures are worth showing.
    map[0xc0 + offset] = {
      kind: "ret",
      condition,
      targetSource: "stack",
      tstatesTaken: 11,
      tstatesNotTaken: 5
    };

    // --- `JP cc,nn` — 0xC2 + (cc << 3). Ten T-states either way: the operand fetch happens
    // --- regardless of the condition, so there is no second figure. This is precisely the case a
    // --- timing-based detector misses.
    map[0xc2 + offset] = {
      kind: "jp",
      condition,
      tstatesTaken: 10,
      tstatesNotTaken: 10
    };

    // --- `CALL cc,nn` — 0xC4 + (cc << 3).
    map[0xc4 + offset] = {
      kind: "call",
      condition,
      tstatesTaken: 17,
      tstatesNotTaken: 10
    };

    // --- `RST n` — 0xC7 + (n << 3), vector 0x00, 0x08, ... 0x38. Carried in `target` because the
    // --- `^R` pragma renders the vector as text without creating a symbol for it.
    map[0xc7 + offset] = {
      kind: "rst",
      target: offset,
      tstatesTaken: 11,
      tstatesNotTaken: 11
    };
  });

  return map;
}

/**
 * Un-prefixed opcodes that branch, keyed by opcode byte.
 */
export const z80StandardBranches: Readonly<Record<number, DisassemblyBranchInfo>> = build();

/**
 * ED-prefixed branches.
 *
 * `RETN` is mirrored across seven opcodes on real silicon, and the disassembler decodes all of
 * them, so all of them are listed.
 *
 * `0x98` is Z80N's `JP (C)` and is the only branch the Next instruction set adds. Its presence here
 * is harmless on a plain Z80: `z80NextSet` already makes the opcode decode as `nop` when
 * `allowExtendedSet` is false, so a non-Next machine never reaches this lookup for it.
 */
export const z80ExtendedBranches: Readonly<Record<number, DisassemblyBranchInfo>> = {
  0x45: { kind: "ret", targetSource: "stack", tstatesTaken: 14, tstatesNotTaken: 14 },
  0x4d: { kind: "ret", targetSource: "stack", tstatesTaken: 14, tstatesNotTaken: 14 },
  0x55: { kind: "ret", targetSource: "stack", tstatesTaken: 14, tstatesNotTaken: 14 },
  0x5d: { kind: "ret", targetSource: "stack", tstatesTaken: 14, tstatesNotTaken: 14 },
  0x65: { kind: "ret", targetSource: "stack", tstatesTaken: 14, tstatesNotTaken: 14 },
  0x6d: { kind: "ret", targetSource: "stack", tstatesTaken: 14, tstatesNotTaken: 14 },
  0x75: { kind: "ret", targetSource: "stack", tstatesTaken: 14, tstatesNotTaken: 14 },
  0x7d: { kind: "ret", targetSource: "stack", tstatesTaken: 14, tstatesNotTaken: 14 },
  0x98: { kind: "jp-indirect", targetSource: "io-port", tstatesTaken: 13, tstatesNotTaken: 13 }
};

/**
 * DD/FD-prefixed branches — `JP (IX)` and `JP (IY)`, which share opcode 0xE9 with `JP (HL)` and are
 * told apart only by the prefix. Eight T-states: four for the jump, four for the prefix.
 */
export const z80IndexedBranches: Readonly<Record<number, DisassemblyBranchInfo>> = {
  0xe9: { kind: "jp-indirect", targetSource: "ix", tstatesTaken: 8, tstatesNotTaken: 8 }
};

/**
 * The prefix an opcode was decoded under.
 *
 * `"none"` is the un-prefixed table, `"ed"` the extended one, and `"ix"`/`"iy"` the two indexed
 * ones — kept apart rather than collapsed to a single `"indexed"` so the returned
 * `targetSource` names the register that actually supplies the address.
 */
export type Z80BranchPrefix = "none" | "ed" | "ix" | "iy";

/**
 * Look up the branch metadata for one decoded opcode.
 *
 * @param prefix Which table the opcode was decoded from
 * @param opCode The opcode byte, after any prefix
 * @returns The branch metadata, or `undefined` when the instruction does not branch
 */
export function getZ80BranchInfo(
  prefix: Z80BranchPrefix,
  opCode: number
): DisassemblyBranchInfo | undefined {
  switch (prefix) {
    case "none":
      return z80StandardBranches[opCode];
    case "ed":
      return z80ExtendedBranches[opCode];
    case "ix":
      return z80IndexedBranches[opCode];
    case "iy": {
      const info = z80IndexedBranches[opCode];
      return info ? { ...info, targetSource: "iy" } : undefined;
    }
    default:
      return undefined;
  }
}
