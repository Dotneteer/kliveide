import { describe, expect, it } from "vitest";

import {
  bindCondition,
  compileCondition
} from "@common/utils/breakpoint-condition/condition-checker";
import { RESULT, evaluateCondition, evaluateValue, runProgram } from "./condition-host";
import { CONDITION_FORMAT, CondOp } from "@common/utils/breakpoint-condition/condition-bytecode";
import { tokenizeCondition } from "@common/utils/breakpoint-condition/condition-lexer";
import {
  bankLocalSymbolKey,
  type ConditionContext,
  type ConditionEnvironment,
  type ConditionRegister
} from "@common/utils/breakpoint-condition/condition-types";

/*
 * What breakpoint conditions evaluate to - every operator and precedence level, the literal forms,
 * registers, flags, accesses, partitions, banks, strings and labels - checked against the C
 * evaluator every Z80 core includes (`src/emu/z80/wasm/z80-condition.c`), run standalone through
 * `condition-host.ts` (`.plans/BREAKPOINT_CONDITIONS_IN_C_PLAN.md`). The expectations are the ones
 * the TypeScript evaluator met before it was retired.
 */

const EXEC: ConditionEnvironment = { accessKind: "exec" };
const MEMORY: ConditionEnvironment = { accessKind: "memory" };

/** A 128K-like machine: 16K partitions, ROMs negative. */
const SP128: ConditionEnvironment = {
  accessKind: "exec",
  hasPartitions: true,
  parsePartitionLabel: (label) =>
    ({ r0: -1, r1: -2, b0: 0, b1: 1, b2: 2, b3: 3, b4: 4, b5: 5, b6: 6, b7: 7 })[label.toLowerCase()],
  partitionRange: { min: -2, max: 7 }
};

/** The ZX Spectrum Next: 8K pages named by hex index. */
const NEXT: ConditionEnvironment = {
  accessKind: "exec",
  hasPartitions: true,
  isNext: true,
  parsePartitionLabel: (label) =>
    /^[0-9a-f]{1,2}$/i.test(label) && parseInt(label, 16) < 224 ? parseInt(label, 16) : undefined,
  partitionRange: { min: -23, max: 223 }
};

type FakeMachine = Partial<Record<ConditionRegister, number>> & {
  memory?: Uint8Array;
  partitions?: Record<number, Uint8Array>;
  banks?: Record<number, Uint8Array>;
  paging?: (address: number) => number | undefined;
  nextRegs?: Record<number, number>;
  val?: number;
  addr?: number;
};

function context(m: FakeMachine = {}): ConditionContext {
  const memory = m.memory ?? new Uint8Array(0x10000);
  return {
    reg: (id) => m[id] ?? 0,
    readMemory: (address) => memory[address],
    readPartition: (p, address) => {
      const view = m.partitions?.[p];
      return view ? view[address % view.length] : 0;
    },
    readBank: (bank, offset) => m.banks?.[bank]?.[offset] ?? 0,
    partitionOf: (address) => m.paging?.(address),
    nextReg: (reg) => m.nextRegs?.[reg] ?? 0,
    accessValue: m.val,
    accessAddress: m.addr
  };
}

function compile(text: string, env: ConditionEnvironment = EXEC) {
  const result = compileCondition(text, env);
  if (!result.compiled) {
    throw new Error(`'${text}' did not compile: ${result.errors[0]?.message}`);
  }
  return result.compiled;
}

/** The numeric value of an expression (not just its truth). */
function value(text: string, m: FakeMachine = {}, env: ConditionEnvironment = EXEC): number {
  const compiled = compile(text, env);
  return evaluateValue(compiled, context(m));
}

function holds(text: string, m: FakeMachine = {}, env: ConditionEnvironment = EXEC): boolean {
  return evaluateCondition(compile(text, env), context(m));
}


function memoryWith(bytes: Record<number, number[]>): Uint8Array {
  const memory = new Uint8Array(0x10000);
  for (const [address, values] of Object.entries(bytes)) {
    values.forEach((b, i) => (memory[(Number(address) + i) & 0xffff] = b));
  }
  return memory;
}

describe("literals", () => {
  it.each([
    ["100", 100],
    ["65_535", 65535],
    ["$FF", 255],
    ["$ff", 255],
    ["0xFF", 255],
    ["0XfF", 255],
    ["%1010", 10],
    ["0b1010", 10],
    ["%0000_0111", 7],
    ["$FFFF_FFFF", 0xffffffff],
    ["-1", -1],
    ["--1", 1],
    ["'A'", 0x41],
    ["'\\''", 0x27],
    ["'\\\\'", 0x5c],
    ["'\\\"'", 0x22],
    ["'\\n'", 0x0a],
    ["'\\r'", 0x0d],
    ["'\\t'", 0x09],
    ["'\\0'", 0x00],
    ["'\\x7F'", 0x7f],
    ["'\"'", 0x22]
  ])("%s is %d", (text, expected) => {
    expect(value(text)).toBe(expected);
  });

  it("maps the three characters where the ZX Spectrum set differs from ASCII", () => {
    expect(value("'£'")).toBe(0x60);
    expect(value("'©'")).toBe(0x7f);
    expect(value("'↑'")).toBe(0x5e);
  });

  it("accepts any other character up to $FF", () => {
    expect(value("'é'")).toBe(0xe9);
  });

});

describe("operators", () => {
  it("adds and subtracts mathematically", () => {
    expect(value("3 + 4 - 10")).toBe(-3);
    expect(value("$FFFFFFFF + 1")).toBe(0x1_0000_0000);
  });

  it("compares mathematically, so signed and unsigned mix", () => {
    expect(value("-1 < 0")).toBe(1);
    expect(value("$FFFFFFFF > -1")).toBe(1);
    expect(value("3 <= 3")).toBe(1);
    expect(value("3 >= 4")).toBe(0);
    expect(value("3 == 3")).toBe(1);
    expect(value("3 != 3")).toBe(0);
  });

  it("gives & | ^ ~ an unsigned 32-bit result (C6)", () => {
    expect(value("~0")).toBe(0xffffffff);
    expect(value("~0 == $FFFFFFFF")).toBe(1);
    expect(value("$F0F0 | $0F0F")).toBe(0xffff);
    expect(value("$FF ^ $0F")).toBe(0xf0);
    expect(value("$80000000 & $80000000")).toBe(0x80000000);
    expect(value("-1 & $FF")).toBe(0xff);
  });

  it("shifts exactly as JavaScript does (C5)", () => {
    expect(value("1 << 31")).toBe(-2147483648);
    expect(value("(1 << 31) >>> 0")).toBe(2147483648);
    expect(value("-8 >> 1")).toBe(-4);
    expect(value("-8 >>> 28")).toBe(15);
    expect(value("1 << 32")).toBe(1);
    expect(value("1 << 33")).toBe(2);
    expect(value("$100 >> 36")).toBe(0x10);
  });

  it("yields 0 or 1 from the logical operators", () => {
    expect(value("!0")).toBe(1);
    expect(value("!5")).toBe(0);
    expect(value("5 && 7")).toBe(1);
    expect(value("5 && 0")).toBe(0);
    expect(value("0 || 9")).toBe(1);
    expect(value("0 || 0")).toBe(0);
  });

  it("short-circuits && and ||", () => {
    let reads = 0;
    const ctx = context();
    ctx.readMemory = () => {
      reads++;
      return 0;
    };
    evaluateCondition(compile("A == 1 && [HL] == 0"), ctx);
    evaluateCondition(compile("A == 0 || [HL] == 0"), ctx);
    expect(reads).toBe(0);
  });
});

describe("precedence", () => {
  it("binds bitwise operators tighter than comparisons (C3)", () => {
    expect(holds("A & $80 == 0", { A: 0x7f })).toBe(true);
    expect(holds("A & $80 == 0", { A: 0x80 })).toBe(false);
    expect(holds("A | 1 == 1", { A: 0 })).toBe(true);
    expect(holds("A ^ 1 == 0", { A: 1 })).toBe(true);
  });

  it("orders the levels || < && < comparison < | < ^ < & < shift < additive < unary", () => {
    expect(value("1 || 0 && 0")).toBe(1); // && first
    expect(value("0 && 1 == 1")).toBe(0);
    expect(value("6 | 3 ^ 3")).toBe(6); // ^ first
    expect(value("6 ^ 3 & 1")).toBe(7); // & first
    expect(value("3 & 1 << 1")).toBe(2); // shift first
    expect(value("1 << 1 + 1")).toBe(4); // additive first
    expect(value("-1 + 2")).toBe(1); // unary first
    expect(value("!0 + 1")).toBe(2);
    expect(value("~0 + 1")).toBe(0x1_0000_0000);
  });

  it("is left-associative within a level", () => {
    expect(value("10 - 3 - 2")).toBe(5);
    expect(value("256 >> 2 >> 1")).toBe(32);
  });

  it("honours parentheses", () => {
    expect(value("(1 + 2) << 1")).toBe(6);
    expect(value("(B & %0000_0111) == 3 || CF", { B: 0x0b, F: 0 })).toBe(1);
  });

});

describe("registers and flags", () => {
  const cpu: FakeMachine = {
    A: 0xff, F: 0b1101_0101, B: 1, C: 2, D: 3, E: 4, H: 5, L: 6, I: 7, R: 8,
    XH: 9, XL: 10, YH: 11, YL: 12,
    AF: 0xff55, BC: 0x0102, DE: 0x0304, HL: 0x0506, IX: 0x090a, IY: 0x0b0c,
    SP: 0xfffe, PC: 0x8000, WZ: 0x1234,
    "AF'": 0x0044, "BC'": 0x1111, "DE'": 0x2222, "HL'": 0x3333
  };

  it.each([
    ["A", 0xff], ["a", 0xff], ["F", 0b1101_0101], ["B", 1], ["C", 2], ["D", 3], ["E", 4],
    ["H", 5], ["L", 6], ["I", 7], ["R", 8],
    ["IXH", 9], ["XH", 9], ["IXL", 10], ["XL", 10], ["IYH", 11], ["YH", 11], ["IYL", 12], ["YL", 12],
    ["AF", 0xff55], ["BC", 0x0102], ["DE", 0x0304], ["HL", 0x0506], ["hl", 0x0506],
    ["IX", 0x090a], ["IY", 0x0b0c], ["SP", 0xfffe], ["PC", 0x8000], ["WZ", 0x1234],
    ["AF'", 0x0044], ["af'", 0x0044], ["BC'", 0x1111], ["DE'", 0x2222], ["HL'", 0x3333]
  ])("%s reads its register", (name, expected) => {
    expect(value(name, cpu)).toBe(expected);
  });

  it.each([
    ["SF", 1], ["ZF", 1], ["F5F", 0], ["YF", 0], ["HF", 1], ["F3F", 0], ["XF", 0],
    ["PVF", 1], ["PF", 1], ["VF", 1], ["NF", 0], ["CF", 1], ["zf", 1]
  ])("%s reads its bit of F", (name, expected) => {
    expect(value(name, cpu)).toBe(expected);
  });

  it("reads the base plan's example with named flags (C16)", () => {
    expect(holds("A == $FF && !ZF", { A: 0xff, F: 0 })).toBe(true);
    expect(holds("A == $FF && !ZF", { A: 0xff, F: 0x40 })).toBe(false);
  });

  it("lexes a prime only directly after AF, BC, DE or HL", () => {
    expect(tokenizeCondition("AF'").map((t) => t.text)).toEqual(["AF'", ""]);
    // --- After any other name it starts a character literal
    expect(tokenizeCondition("A=='x'").map((t) => t.kind)).toEqual(["ident", "op", "num", "eof"]);
    expect(holds("AF' == $0044", cpu)).toBe(true);
  });

  it("reads the undocumented flags two ways", () => {
    expect(holds("(F & $28) != 0 || F3F || F5F", { F: 0x08 })).toBe(true);
    expect(holds("(F & $28) != 0 || F3F || F5F", { F: 0 })).toBe(false);
  });
});

describe("memory accesses", () => {
  const memory = memoryWith({
    0x8000: [0x34, 0x12, 0x78, 0x56],
    0x9000: [0x80, 0xff, 0xff, 0xff],
    0xffff: [0xaa],
    0x0000: [0xbb, 0xcc, 0xdd],
    0x5c3a: [0x65, 0x00]
  });

  it.each([
    ["[$8000]", 0x34],
    ["b[$8000]", 0x34],
    ["w[$8000]", 0x1234],
    ["wle[$8000]", 0x1234],
    ["wbe[$8000]", 0x3412],
    ["l[$8000]", 0x56781234],
    ["lle[$8000]", 0x56781234],
    ["lbe[$8000]", 0x34127856],
    ["sb[$9000]", -128],
    ["sw[$9000]", -128],
    ["swle[$9000]", -128],
    ["swbe[$9000]", -32513],
    ["sl[$9000]", -128],
    ["slle[$9000]", -128],
    ["slbe[$9000]", -2130706433],
    ["l[$9000]", 0xffffff80],
    ["W[$8000]", 0x1234]
  ])("%s reads %d", (text, expected) => {
    expect(value(text, { memory })).toBe(expected);
  });

  it("evaluates the address expression", () => {
    expect(value("[IX+3]", { memory, IX: 0x7ffd })).toBe(0x34);
    expect(value("[HL-1]", { memory, HL: 0x8001 })).toBe(0x34);
    expect(value("w[$5C3A] > 100", { memory })).toBe(1);
  });

  it("wraps the address and consecutive bytes at $FFFF", () => {
    expect(value("w[$FFFF]", { memory })).toBe(0xbbaa);
    expect(value("l[$FFFF]", { memory })).toBe(0xddccbbaa);
    expect(value("[$10000]", { memory })).toBe(0xbb);
    expect(value("[-1]", { memory })).toBe(0xaa);
  });

  it("treats access prefixes as labels when no bracket follows", () => {
    const compiled = compile("w + b", { ...EXEC, symbols: { w: 2, b: 3 } });
    expect(evaluateCondition(compiled, context())).toBe(true);
  });

});

describe("signed conversions", () => {
  it.each([
    ["s8($FF)", -1],
    ["s8($7F)", 127],
    ["s8($180)", -128],
    ["s16($8000)", -32768],
    ["s16($17FFF)", 32767],
    ["s32($FFFFFFFF)", -1],
    ["s32($80000000)", -2147483648]
  ])("%s folds to %d", (text, expected) => {
    expect(value(text)).toBe(expected);
  });

  it("converts at run time", () => {
    expect(holds("s16(HL) < 0", { HL: 0x8000 })).toBe(true);
    expect(holds("s16(HL) < 0", { HL: 0x7fff })).toBe(false);
    expect(holds("s8(A) == -1", { A: 0xff })).toBe(true);
  });

  it("compares a signed access with a negative literal", () => {
    expect(holds("sb[IX+2] < -1", { memory: memoryWith({ 0x8002: [0xfe] }), IX: 0x8000 })).toBe(true);
  });
});

describe("strings (C8, C9)", () => {
  const memory = memoryWith({ 0x8000: [0x4b, 0x4c, 0x49, 0x56] }); // "KLIV"

  it.each([
    ['l[HL] == "KLIV"', true],
    ['lbe[HL] == "KLIV"', true],
    ['w[HL] == "KL"', true],
    ['wbe[HL] == "KL"', true],
    ['b[HL] == "K"', true],
    ['[HL] == "K"', true],
    ['"KLIV" == l[HL]', true],
    ['l[HL] != "KLIX"', true],
    ['(l[HL]) == "KLIV"', true],
    ['w[HL] == "LK"', false],
    ['wbe[HL] == "LK"', false]
  ])("%s is %s", (text, expected) => {
    expect(holds(text, { memory, HL: 0x8000 })).toBe(expected);
  });

  it("is a numeric test when written as a character literal", () => {
    expect(holds("w[HL] == 'A'", { memory: memoryWith({ 0x8000: [0x41, 0] }), HL: 0x8000 })).toBe(true);
  });

});

describe("access specials (VAL, ADDR)", () => {
  it.each<ConditionEnvironment["accessKind"]>(["memory", "io", "nextReg"])("are available on %s breakpoints", (accessKind) => {
    expect(holds("VAL == $C9 && ADDR >= $5800", { val: 0xc9, addr: 0x5900 }, { accessKind })).toBe(true);
  });

});

describe("partitions and banks", () => {
  it("reads a partition-qualified byte at the address's offset, whatever is paged in", () => {
    const partitions = { 5: new Uint8Array(0x4000) };
    partitions[5][0x0010] = 0xff;
    expect(holds("b[B5:$C010] == $FF", { partitions }, SP128)).toBe(true);
  });

  it("wraps consecutive bytes inside the partition", () => {
    const partitions = { 5: new Uint8Array(0x4000) };
    partitions[5][0x3fff] = 0x34;
    partitions[5][0x0000] = 0x12;
    expect(value("w[B5:$FFFF]", { partitions }, SP128)).toBe(0x1234);
  });

  it("wraps by the partition's own size (8K on the Next)", () => {
    const partitions = { 5: new Uint8Array(0x2000) };
    partitions[5][0x0010] = 0x99;
    expect(value("b[05:$C010]", { partitions }, NEXT)).toBe(0x99);
  });

  it("reads a Next 16K bank at an offset, wrapping inside the bank", () => {
    const banks = { 0x0a: new Uint8Array(0x4000) };
    banks[0x0a][0x0100] = 0x34;
    banks[0x0a][0x0101] = 0x12;
    banks[0x0a][0x3fff] = 0x78;
    banks[0x0a][0x0000] = 0x56;
    expect(value("w[0A:+$0100]", { banks }, NEXT)).toBe(0x1234);
    expect(value("w[0a:+$3FFF]", { banks }, NEXT)).toBe(0x5678);
  });

  it("reads a bank-local label inside the bank, and its offset outside brackets", () => {
    const banks = { 5: new Uint8Array(0x4000) };
    banks[5][0x0123] = 1;
    banks[5][0x0125] = 7;
    const symbols = { [bankLocalSymbolKey(5, "Flags")]: 0x0123 };
    const env = { ...NEXT, symbols };
    expect(holds("b[05:Flags] == 1", { banks }, env)).toBe(true);
    expect(holds("b[05:Flags+2] == 7", { banks }, env)).toBe(true);
    expect(value("05:Flags", {}, env)).toBe(0x0123);
  });

  it("reads a global label as a partition-qualified address when parenthesised", () => {
    const partitions = { 5: new Uint8Array(0x2000) };
    partitions[5][0x0010] = 0x42;
    const env = { ...NEXT, symbols: { score: 0xc010 } };
    expect(value("b[05:(score)]", { partitions }, env)).toBe(0x42);
  });

  it("treats a reserved name after a spec as a partition-qualified address", () => {
    const partitions = { 5: new Uint8Array(0x4000) };
    partitions[5][0x0010] = 0x42;
    expect(value("b[B5:HL]", { partitions, HL: 0xc010 }, SP128)).toBe(0x42);
  });

  it("compares page() with a partition literal", () => {
    const paging = (address: number) => (address >= 0xc000 ? 5 : 0);
    expect(holds("page($C000) == @B5", { paging }, SP128)).toBe(true);
    expect(holds("page($C000) == @b5", { paging }, SP128)).toBe(true);
    expect(holds("page($8000) == @B5", { paging }, SP128)).toBe(false);
    expect(holds("page($C000) == @R0", { paging: () => undefined }, SP128)).toBe(false);
  });

  it("reads a Next register", () => {
    expect(holds("nr($56) == $0A", { nextRegs: { 0x56: 0x0a } }, NEXT)).toBe(true);
  });

  it("ignores partition and bank prefixes on a machine without partitions (C17)", () => {
    const memory = memoryWith({ 0xc010: [0xff], 0x0100: [0x11], 0x0123: [0x22] });
    expect(holds("b[05:$C010] == $FF", { memory })).toBe(true);
    expect(holds("b[B5:$C010] == $FF", { memory })).toBe(true);
    expect(holds("b[0A:+$0100] == $11", { memory })).toBe(true);
    // --- The bank-local label reads as the global label of that name
    expect(holds("b[05:Flags] == $22", { memory }, { ...EXEC, symbols: { flags: 0x0123 } })).toBe(true);
  });

});

describe("labels (§3.6)", () => {
  it("binds labels case-insensitively and re-binds after a build", () => {
    const compiled = compile("w[score] >= 1000 && Lives == 3");
    expect(compiled.labels).toEqual(["score", "lives"]);
    bindCondition(compiled, { score: 0x8000, lives: 3 });
    expect(compiled.inactiveReason).toBeUndefined();
    const memory = memoryWith({ 0x8000: [0xe8, 0x03] });
    expect(evaluateCondition(compiled, context({ memory }))).toBe(true);

    bindCondition(compiled, { score: 0x8000, lives: 2 });
    expect(evaluateCondition(compiled, context({ memory }))).toBe(false);
  });

  it("lets reserved names win, and reaches the label through backticks", () => {
    const symbols = { zf: 0x9000, c: 0x9100 };
    const memory = memoryWith({ 0x9000: [0x55] });
    const compiled = compile("w[`ZF`] == $55", { ...EXEC, symbols });
    expect(evaluateCondition(compiled, context({ memory }))).toBe(true);
    expect(compile("ZF", EXEC).tree).toEqual({ k: "flag", bit: 6 });
  });

});

describe("the C evaluator's own guarantees (`.plans/BREAKPOINT_CONDITIONS_IN_C_PLAN.md`)", () => {
  const F = CONDITION_FORMAT;
  const ctx = context();

  it.each<[string, number[]]>([
    ["no format word", [CondOp.CONST, 1, 0, CondOp.END]],
    ["a format from another front end", [0x434e0002, CondOp.CONST, 1, 0, CondOp.END]],
    ["an unknown op", [F, 99, CondOp.END]],
    ["a stack underflow", [F, CondOp.ADD, CondOp.END]],
    ["a truncated operand", [F, CondOp.CONST, 1]],
    ["no END", [F, CondOp.CONST, 1, 0]],
    ["a backward jump", [F, CondOp.CONST, 1, 0, CondOp.ANDJ, 1, CondOp.END]],
    ["a jump past the end", [F, CondOp.CONST, 1, 0, CondOp.ANDJ, 99, CondOp.END]],
    ["a memory read of width 3", [F, CondOp.CONST, 0, 0, CondOp.MEM, 3, 0, CondOp.END]],
    ["an empty program", []]
  ])("refuses %s as an error, never as false", (_name, words) => {
    expect(runProgram(Uint32Array.from(words), ctx).status).toBe(RESULT.ERROR);
  });

  it("refuses a stack overflow", () => {
    const words = [F];
    for (let i = 0; i < 65; i++) words.push(CondOp.CONST, 1, 0);
    words.push(CondOp.END);
    expect(runProgram(Uint32Array.from(words), ctx).status).toBe(RESULT.ERROR);
  });

  describe("'no value' (page() where nothing is paged) behaves like the NaN it replaced", () => {
    const unpaged = context({ paging: () => undefined });
    const truth = (text: string) => evaluateCondition(compile(text, SP128), unpaged);

    it("compares false with everything, except !=", () => {
      expect(truth("page($C000) == @B5")).toBe(false);
      expect(truth("page($C000) < 7")).toBe(false);
      expect(truth("page($C000) >= -2")).toBe(false);
      expect(truth("page($C000) != @B5")).toBe(true);
    });

    it("is truthy, and !no-value is false", () => {
      expect(truth("page($C000)")).toBe(true);
      expect(truth("!page($C000)")).toBe(false);
      expect(truth("page($C000) && 1")).toBe(true);
    });

    it("survives arithmetic and reads as 0 in bitwise operators", () => {
      expect(truth("page($C000) + 1 == page($C000) + 1")).toBe(false);
      expect(truth("(page($C000) | 0) == 0")).toBe(true);
      expect(truth("~page($C000) == $FFFFFFFF")).toBe(true);
    });
  });
});
