import { describe, expect, it } from "vitest";

import { compileCondition } from "@common/utils/breakpoint-condition/condition-checker";
import { evaluateCondition, evaluateNode } from "@common/utils/breakpoint-condition/condition-evaluator";
import {
  bankLocalSymbolKey,
  type ConditionContext,
  type ConditionEnvironment
} from "@common/utils/breakpoint-condition/condition-types";

/*
 * Every memory access form of the breakpoint condition language, systematically
 * (`.plans/CONDITIONAL_BREAKPOINTS_PLAN.md` §3.4): each of the 14 access prefixes, against every
 * addressing mode - the CPU's view, a partition, a ZX Spectrum Next 16K bank, a bank-local label -
 * at an ordinary address and across each wrap boundary; string comparison for every unsigned width
 * and byte order; and the out-of-range check at each type's exact boundaries.
 *
 * Pure unit tests: a fake context, no machine. Expected values come from `DataView`, an oracle
 * independent of the evaluator under test.
 */

type Access = { name: string; width: 1 | 2 | 4; be: boolean; signed: boolean };

/** Every spelling the grammar accepts (§3.2), with what it reads. */
const ACCESSES: Access[] = [
  { name: "b", width: 1, be: false, signed: false },
  { name: "w", width: 2, be: false, signed: false },
  { name: "wle", width: 2, be: false, signed: false },
  { name: "wbe", width: 2, be: true, signed: false },
  { name: "l", width: 4, be: false, signed: false },
  { name: "lle", width: 4, be: false, signed: false },
  { name: "lbe", width: 4, be: true, signed: false },
  { name: "sb", width: 1, be: false, signed: true },
  { name: "sw", width: 2, be: false, signed: true },
  { name: "swle", width: 2, be: false, signed: true },
  { name: "swbe", width: 2, be: true, signed: true },
  { name: "sl", width: 4, be: false, signed: true },
  { name: "slle", width: 4, be: false, signed: true },
  { name: "slbe", width: 4, be: true, signed: true }
];

/** What `access` reads from these bytes, computed by `DataView`, not by the code under test. */
function oracle(access: Access, bytes: number[]): number {
  const view = new DataView(Uint8Array.from(bytes.slice(0, access.width)).buffer);
  const le = !access.be;
  switch (access.width) {
    case 1:
      return access.signed ? view.getInt8(0) : view.getUint8(0);
    case 2:
      return access.signed ? view.getInt16(0, le) : view.getUint16(0, le);
    case 4:
      return access.signed ? view.getInt32(0, le) : view.getUint32(0, le);
  }
}

/**
 * Byte patterns chosen so every byte differs (a byte-order mistake changes the value), and so the
 * top bit is set and clear (a sign mistake changes it).
 */
const PATTERNS = [
  [0x12, 0x34, 0x56, 0x78],
  [0x80, 0x01, 0xfe, 0xc3],
  [0xff, 0xff, 0xff, 0xff],
  [0x00, 0x00, 0x00, 0x80],
  [0x7f, 0x00, 0x80, 0x00]
];

const PARTITION = 5;
const BANK = 0x0a;

/** A 64K CPU view, partitions of the given sizes, and Next banks - each a separate array. */
type World = {
  memory: Uint8Array;
  partitions: Map<number, Uint8Array>;
  banks: Map<number, Uint8Array>;
};

function aWorld(partitionSize = 0x4000): World {
  return {
    memory: new Uint8Array(0x10000),
    partitions: new Map([[PARTITION, new Uint8Array(partitionSize)]]),
    banks: new Map([[BANK, new Uint8Array(0x4000)]])
  };
}

function contextOf(world: World): ConditionContext {
  return {
    reg: (id) => (id === "HL" ? 0x9000 : id === "IX" ? 0x8ff0 : 0),
    readMemory: (address) => world.memory[address & 0xffff],
    readPartition: (p, address) => {
      const view = world.partitions.get(p)!;
      return view[address % view.length];
    },
    readBank: (bank, offset) => world.banks.get(bank)![offset & 0x3fff],
    partitionOf: () => PARTITION
  };
}

/** Writes bytes at consecutive positions of a buffer, wrapping at its end. */
function place(target: Uint8Array, at: number, bytes: number[]): void {
  bytes.forEach((b, i) => (target[(at + i) % target.length] = b));
}

const EXEC: ConditionEnvironment = { accessKind: "exec" };

/** The ZX Spectrum Next: partitions are 8K pages named by hex index; bank 0A's label `Flags`. */
const NEXT_SYMBOLS = {
  [bankLocalSymbolKey(BANK, "Flags")]: 0x0100,
  [bankLocalSymbolKey(BANK, "Edge")]: 0x3ffe,
  score: 0x9000
};
const NEXT: ConditionEnvironment = {
  accessKind: "exec",
  hasPartitions: true,
  isNext: true,
  parsePartitionLabel: (label) => (/^[0-9a-f]{1,2}$/i.test(label) ? parseInt(label, 16) : undefined),
  partitionRange: { min: -23, max: 223 },
  symbols: NEXT_SYMBOLS
};

/** A 128K-like machine: 16K partitions named `B<n>`. */
const SP128: ConditionEnvironment = {
  accessKind: "exec",
  hasPartitions: true,
  parsePartitionLabel: (label) => (/^b[0-7]$/i.test(label) ? parseInt(label.substring(1), 10) : undefined),
  partitionRange: { min: -2, max: 7 }
};

function valueOf(text: string, world: World, env: ConditionEnvironment = EXEC): number {
  const result = compileCondition(text, env);
  if (!result.compiled) throw new Error(`'${text}' did not compile: ${result.errors[0]?.message}`);
  return evaluateNode(result.compiled.tree, contextOf(world), result.compiled.values);
}

describe("every access type reads what its width, byte order and signedness say", () => {
  for (const access of ACCESSES) {
    describe(`${access.name}[…]`, () => {
      it.each(PATTERNS.map((p) => [p.map((b) => b.toString(16)).join(" "), p] as const))(
        "the CPU view, bytes %s",
        (_name, bytes) => {
          const world = aWorld();
          place(world.memory, 0x9000, bytes);
          const expected = oracle(access, bytes);
          expect(valueOf(`${access.name}[$9000]`, world)).toBe(expected);
          // --- The prefix is case-insensitive, and the address is any expression
          expect(valueOf(`${access.name.toUpperCase()}[HL]`, world)).toBe(expected);
          expect(valueOf(`${access.name}[IX+$10]`, world)).toBe(expected);
          expect(valueOf(`${access.name}[$8FFF + 1]`, world)).toBe(expected);
        }
      );

      it("the CPU view wraps from $FFFF to $0000", () => {
        const world = aWorld();
        const bytes = PATTERNS[1];
        place(world.memory, 0xffff, bytes);
        expect(valueOf(`${access.name}[$FFFF]`, world)).toBe(oracle(access, bytes));
        // --- An address beyond 16 bits is wrapped first
        expect(valueOf(`${access.name}[$1FFFF]`, world)).toBe(oracle(access, bytes));
        expect(valueOf(`${access.name}[-1]`, world)).toBe(oracle(access, bytes));
      });

      it("a 16K partition, whatever is paged in, wrapping inside the partition", () => {
        const world = aWorld(0x4000);
        const bytes = PATTERNS[0];
        place(world.partitions.get(PARTITION)!, 0x0010, bytes);
        // --- The CPU view holds something else, so reading it instead would fail
        place(world.memory, 0xc010, [0xaa, 0xaa, 0xaa, 0xaa]);
        expect(valueOf(`${access.name}[B5:$C010]`, world, SP128)).toBe(oracle(access, bytes));
        place(world.partitions.get(PARTITION)!, 0x3fff, PATTERNS[1]);
        expect(valueOf(`${access.name}[B5:$FFFF]`, world, SP128)).toBe(oracle(access, PATTERNS[1]));
      });

      it("an 8K partition (ZX Spectrum Next page), wrapping by the page's own size", () => {
        const world = aWorld(0x2000);
        place(world.partitions.get(PARTITION)!, 0x0010, PATTERNS[4]);
        expect(valueOf(`${access.name}[05:$C010]`, world, NEXT)).toBe(oracle(access, PATTERNS[4]));
        place(world.partitions.get(PARTITION)!, 0x1fff, PATTERNS[1]);
        expect(valueOf(`${access.name}[05:$DFFF]`, world, NEXT)).toBe(oracle(access, PATTERNS[1]));
      });

      it("a Next 16K bank at an offset, wrapping inside the bank", () => {
        const world = aWorld();
        place(world.banks.get(BANK)!, 0x0100, PATTERNS[2]);
        expect(valueOf(`${access.name}[0A:+$0100]`, world, NEXT)).toBe(oracle(access, PATTERNS[2]));
        place(world.banks.get(BANK)!, 0x3ffe, PATTERNS[0]);
        expect(valueOf(`${access.name}[0a:+$3FFE]`, world, NEXT)).toBe(oracle(access, PATTERNS[0]));
      });

      it("a bank-local label of a Next bank, alone and with an offset", () => {
        const world = aWorld();
        place(world.banks.get(BANK)!, 0x0100, PATTERNS[3]);
        expect(valueOf(`${access.name}[0A:Flags]`, world, NEXT)).toBe(oracle(access, PATTERNS[3]));
        place(world.banks.get(BANK)!, 0x0102, PATTERNS[0]);
        expect(valueOf(`${access.name}[0A:Flags+2]`, world, NEXT)).toBe(oracle(access, PATTERNS[0]));
        // --- Across the bank's end
        place(world.banks.get(BANK)!, 0x3ffe, PATTERNS[1]);
        expect(valueOf(`${access.name}[0A:Edge]`, world, NEXT)).toBe(oracle(access, PATTERNS[1]));
      });

      it("a global label as a partition offset, parenthesised", () => {
        const world = aWorld(0x2000);
        place(world.partitions.get(PARTITION)!, 0x1000, PATTERNS[4]);
        expect(valueOf(`${access.name}[05:(score)]`, world, NEXT)).toBe(oracle(access, PATTERNS[4]));
      });

      it("ignores the partition or bank prefix on a machine without banks", () => {
        const world = aWorld();
        place(world.memory, 0x9000, PATTERNS[1]);
        expect(valueOf(`${access.name}[B5:$9000]`, world)).toBe(oracle(access, PATTERNS[1]));
        expect(valueOf(`${access.name}[0A:+$9000]`, world)).toBe(oracle(access, PATTERNS[1]));
      });

      it("accepts its range's boundaries and refuses one past them (C10)", () => {
        const bits = access.width * 8;
        const min = access.signed ? -(2 ** (bits - 1)) : 0;
        const max = access.signed ? 2 ** (bits - 1) - 1 : 2 ** bits - 1;
        for (const ok of [min, max]) {
          expect(compileCondition(`${access.name}[HL] == ${ok}`, EXEC).errors, `${ok}`).toEqual([]);
        }
        for (const bad of [min - 1, max + 1]) {
          // --- A literal above $FFFFFFFF is a syntax error of its own; below that, a range error
          const errors = compileCondition(`${access.name}[HL] == ${bad}`, EXEC).errors;
          expect(errors, `${bad}`).toHaveLength(1);
          if (bad <= 0xffffffff) {
            expect(errors[0].message).toContain(`out of range for ${access.name}[…]`);
          }
        }
      });

      it("compares with signed and unsigned values mathematically", () => {
        const world = aWorld();
        place(world.memory, 0x9000, [0xff, 0xff, 0xff, 0xff]);
        const result = compileCondition(`${access.name}[$9000] < 0`, EXEC);
        expect(evaluateCondition(result.compiled!, contextOf(world))).toBe(access.signed);
      });
    });
  }

  it("treats [a] as b[a]", () => {
    const world = aWorld();
    place(world.memory, 0x9000, [0xa5]);
    expect(valueOf("[$9000]", world)).toBe(valueOf("b[$9000]", world));
  });
});

describe("strings against every unsigned access (C8, C9)", () => {
  const unsigned = ACCESSES.filter((a) => !a.signed);
  const text = "KLIV";

  for (const access of unsigned) {
    const literal = text.substring(0, access.width);
    it(`${access.name}[…] == "${literal}" matches the characters in memory order`, () => {
      const world = aWorld();
      place(world.memory, 0x9000, [...literal].map((c) => c.charCodeAt(0)));
      const result = compileCondition(`${access.name}[$9000] == "${literal}"`, EXEC);
      expect(result.errors).toEqual([]);
      expect(evaluateCondition(result.compiled!, contextOf(world))).toBe(true);
      // --- The other operand order, and the reversed string, which must not match
      const swapped = compileCondition(`"${literal}" != ${access.name}[$9000]`, EXEC).compiled!;
      expect(evaluateCondition(swapped, contextOf(world))).toBe(false);
      if (access.width > 1) {
        const reversed = [...literal].reverse().join("");
        const wrong = compileCondition(`${access.name}[$9000] == "${reversed}"`, EXEC).compiled!;
        expect(evaluateCondition(wrong, contextOf(world))).toBe(false);
      }
    });

    it(`${access.name}[…] refuses a string of any other length`, () => {
      for (const length of [1, 2, 3, 4, 5].filter((n) => n !== access.width)) {
        const errors = compileCondition(`${access.name}[$9000] == "${"ABCDE".substring(0, length)}"`, EXEC).errors;
        expect(errors[0]?.message, `${length}`).toContain(`compares ${access.width}`);
      }
    });

    it(`${access.name}[…] matches a string in a partition and in a bank`, () => {
      const world = aWorld(0x2000);
      const bytes = [...literal].map((c) => c.charCodeAt(0));
      place(world.partitions.get(PARTITION)!, 0x0010, bytes);
      place(world.banks.get(BANK)!, 0x0100, bytes);
      for (const spec of [`05:$C010`, `0A:+$0100`, `0A:Flags`]) {
        const compiled = compileCondition(`${access.name}[${spec}] == "${literal}"`, NEXT).compiled!;
        expect(evaluateCondition(compiled, contextOf(world)), spec).toBe(true);
      }
    });
  }

  it.each(ACCESSES.filter((a) => a.signed).map((a) => [a.name]))(
    "%s[…] refuses a string: signed reads have no character order",
    (name) => {
      expect(compileCondition(`${name}[$9000] == "AB"`, EXEC).errors[0].message).toContain(
        "unsigned memory access"
      );
    }
  );
});

describe("accesses inside expressions", () => {
  it("nest: an access as another access's address", () => {
    const world = aWorld();
    place(world.memory, 0x9000, [0x34, 0x12]);
    place(world.memory, 0x1234, [0x99]);
    expect(valueOf("[w[$9000]]", world)).toBe(0x99);
    expect(valueOf("b[wbe[$9000] ^ $2626]", world)).toBe(0x99);
  });

  it("combine with every operator family", () => {
    const world = aWorld();
    place(world.memory, 0x9000, [0xf0, 0x0f, 0x00, 0x80]);
    expect(valueOf("w[$9000] & $FF", world)).toBe(0xf0);
    expect(valueOf("w[$9000] >> 8", world)).toBe(0x0f);
    expect(valueOf("l[$9000] >>> 31", world)).toBe(1);
    expect(valueOf("sl[$9000] >> 31", world)).toBe(-1);
    expect(valueOf("b[$9000] + b[$9001]", world)).toBe(0xff);
    expect(valueOf("~b[$9002] & $FF", world)).toBe(0xff);
    expect(valueOf("!b[$9002]", world)).toBe(1);
    expect(valueOf("-sb[$9000]", world)).toBe(16);
  });
});
