import { describe, expect, it } from "vitest";

import {
  bindCondition,
  compileCondition
} from "@common/utils/breakpoint-condition/condition-checker";
import { tokenizeCondition } from "@common/utils/breakpoint-condition/condition-lexer";
import {
  CONDITION_FORMAT,
  CONDITION_REGISTER_IDS,
  CondOp,
  MEM_BE,
  MEM_SIGNED,
  PART_BANK,
  PART_PARTITION,
  emitCondition,
  stackDepthOf
} from "@common/utils/breakpoint-condition/condition-bytecode";
import {
  bankLocalSymbolKey,
  type ConditionContext,
  type ConditionEnvironment,
  type ConditionRegister
} from "@common/utils/breakpoint-condition/condition-types";

/*
 * The condition language's **front end** - lexer, parser, checker, label binding - which needs no
 * evaluator: the §3.7 errors with their ranges, warnings, tokens, the emitted tree and the bound
 * labels (`.plans/CONDITIONAL_BREAKPOINTS_PLAN.md` §3). What expressions *evaluate to* is tested
 * against the C evaluator in `test/wasm/condition/condition-evaluation.test.ts`
 * (`.plans/BREAKPOINT_CONDITIONS_IN_C_PLAN.md`).
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



function compile(text: string, env: ConditionEnvironment = EXEC) {
  const result = compileCondition(text, env);
  if (!result.compiled) {
    throw new Error(`'${text}' did not compile: ${result.errors[0]?.message}`);
  }
  return result.compiled;
}



function error(text: string, env: ConditionEnvironment = EXEC) {
  const result = compileCondition(text, env);
  expect(result.compiled, `'${text}' should not compile`).toBeUndefined();
  return result.errors[0];
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
    ["''", "Empty character literal", 0, 2],
    ["'AB'", 'use "AB" for a string', 0, 4],
    ["'€'", "has no ZX Spectrum character code", 1, 2],
    ["'\\q'", "Invalid escape", 1, 3],
    ["'\\x4'", "Invalid escape", 1, 3],
    ["'A", "Unterminated character literal", 0, 2],
    ['"AB', "Unterminated string", 0, 3],
    ["$1_0000_0000", "larger than $FFFFFFFF", 0, 12],
    ["$G1", "Invalid number", 0, 3],
    ["12ab", "Invalid number", 0, 4],
    ["%102", "Invalid number", 0, 4],
    ["1_", "Invalid number", 0, 2],
    ["@", "needs a label after @", 0, 1]
  ])("rejects %s", (text, message, start, end) => {
    const diagnostic = error(text);
    expect(diagnostic.message).toContain(message);
    expect([diagnostic.start, diagnostic.end]).toEqual([start, end]);
  });
});

describe("precedence", () => {
  it("rejects a chained comparison, pointing at the second operator", () => {
    const diagnostic = error("1 < A < 3");
    expect(diagnostic.message).toContain("cannot be chained");
    expect([diagnostic.start, diagnostic.end]).toEqual([6, 7]);
  });
});

describe("memory accesses", () => {
  it("rejects an unbalanced bracket with the opening column", () => {
    const diagnostic = error("w[HL == 1");
    expect(diagnostic.message).toContain("Missing ']' to close the '[' at column 2");
  });
});

describe("strings (C8, C9)", () => {
  const memory = memoryWith({ 0x8000: [0x4b, 0x4c, 0x49, 0x56] }); // "KLIV"

  it("folds the string into the number the access would read", () => {
    expect(compile('w[HL] == "AB"').tree).toMatchObject({ r: { k: "num", v: 0x4241 } });
    expect(compile('wbe[HL] == "AB"').tree).toMatchObject({ r: { k: "num", v: 0x4142 } });
    expect(compile('l[HL] == "ABCD"').tree).toMatchObject({ r: { k: "num", v: 0x44434241 } });
    expect(compile('lbe[HL] == "ABCD"').tree).toMatchObject({ r: { k: "num", v: 0x41424344 } });
  });

  it("maps string characters to ZX codes and decodes escapes", () => {
    expect(compile('w[HL] == "£\\x7F"').tree).toMatchObject({ r: { k: "num", v: 0x7f60 } });
    expect(compile('l[HL] == "a\\"bc"').tree).toMatchObject({ r: { k: "num", v: 0x63622261 } });
  });

  it.each([
    ['l[HL] == "AB"', 'String "AB" has 2 characters but l[…] compares 4', 9, 13],
    ['w[HL] == "A"', 'String "A" has 1 character but w[…] compares 2', 9, 12],
    ['b[HL] == "AB"', 'String "AB" has 2 characters but b[…] compares 1', 9, 13],
    ['A == "A"', "A string can only be compared (==, !=) with an unsigned memory access", 5, 8],
    ['sw[HL] == "AB"', "A string can only be compared (==, !=) with an unsigned memory access", 10, 14],
    ['w[HL] < "AB"', "A string can only be compared (==, !=)", 8, 12],
    ['"AB"', "A string can only be compared (==, !=)", 0, 4],
    ['"A" == "A"', "Two strings cannot be compared", 0, 10],
    ['w[HL] + "AB" == 1', "A string can only be compared", 8, 12]
  ])("rejects %s", (text, message, start, end) => {
    const diagnostic = error(text);
    expect(diagnostic.message).toContain(message);
    expect([diagnostic.start, diagnostic.end]).toEqual([start, end]);
  });
});

describe("out-of-range constants (C10)", () => {
  it.each([
    ["b[HL] == $1234", "$1234 is out of range for b[…] (0…255)", 9, 14],
    ["[HL] == 256", "256 is out of range for b[…] (0…255)", 8, 11],
    ["A > 300", "300 is out of range for A (0…255)", 4, 7],
    ["A > -1", "-1 is out of range for A (0…255)", 4, 6],
    ["300 < A", "300 is out of range for A (0…255)", 0, 3],
    ["HL == $10000", "$10000 is out of range for HL ", 6, 12],
    ["AF' == $10000", "out of range for AF'", 7, 13],
    ["sb[IX] == $FF", "$FF is out of range for sb[…] (-128…127)", 10, 13],
    ["sw[IX] == $8000", "out of range for sw[…] (-32768…32767)", 10, 15],
    ["w[IX] == -1", "out of range for w[…] (0…$FFFF)", 9, 11],
    ["l[IX] == -1", "out of range for l[…] (0…$FFFFFFFF)", 9, 11],
    ["ZF == 2", "2 is out of range for ZF (0…1)", 6, 7],
    ["s8(A) == 128", "out of range for s8(…) (-128…127)", 9, 12],
    ["s16(HL) == -32769", "out of range for s16(…)", 11, 17],
    ["s32(HL) == $80000000", "out of range for s32(…)", 11, 20]
  ])("rejects %s", (text, message, start, end) => {
    const diagnostic = error(text);
    expect(diagnostic.message).toContain(message);
    expect([diagnostic.start, diagnostic.end]).toEqual([start, end]);
  });

  it("checks VAL, ADDR and nr()", () => {
    expect(error("VAL == $100", MEMORY).message).toContain("out of range for VAL (0…255)");
    expect(error("ADDR == $10000", MEMORY).message).toContain("out of range for ADDR (0…$FFFF)");
    expect(error("nr($56) == 256", NEXT).message).toContain("out of range for nr(…) (0…255)");
  });

  it("checks page() against the machine's partition range", () => {
    expect(error("page($C000) == 8", SP128).message).toContain("out of range for page(…) (-2…7)");
  });

  it("does not range-check compound expressions or labels", () => {
    expect(compileCondition("A & $0F == $1000", EXEC).errors).toEqual([]);
    expect(compileCondition("A + 1 == 256", EXEC).errors).toEqual([]);
    expect(compileCondition("score == $FFFFFF", EXEC).errors).toEqual([]);
  });

  it("accepts the boundaries", () => {
    for (const text of ["A == 255", "A >= 0", "sb[HL] == -128", "sb[HL] == 127", "ZF == 1", "l[HL] == $FFFFFFFF"]) {
      expect(compileCondition(text, EXEC).errors, text).toEqual([]);
    }
  });
});

describe("access specials (VAL, ADDR)", () => {
  it("are an error on an execution breakpoint", () => {
    const diagnostic = error("VAL == 1");
    expect(diagnostic.message).toContain("an execution breakpoint has none");
    expect([diagnostic.start, diagnostic.end]).toEqual([0, 3]);
    expect(error("1 == addr").message).toContain("ADDR is the accessed address");
  });
});

describe("partitions and banks", () => {
  it("lexes a spec before ':' and a number otherwise", () => {
    expect(tokenizeCondition("b[05:$C010]").map((t) => t.kind)).toEqual([
      "ident", "op", "spec", "op", "num", "op", "eof"
    ]);
    expect(tokenizeCondition("b[$05]").map((t) => t.kind)).toEqual(["ident", "op", "num", "op", "eof"]);
  });

  it.each([
    ["b[B9:$C010]", SP128, "Unknown partition 'B9'", 2, 4],
    ["page($C000) == @B9", SP128, "Unknown partition @B9", 15, 18],
    ["page($C000) == 1", EXEC, "page() needs a machine with memory partitions", 0, 11],
    ["@B5 == 1", EXEC, "names a partition, but this machine has none", 0, 3],
    ["nr($56) == 1", SP128, "exists only on the ZX Spectrum Next", 0, 7],
    ["b[05:+$0100]", SP128, "Bank specs (05:+offset, 05:label) exist only on the ZX Spectrum Next", 2, 4],
    ["b[05:Flags]", SP128, "exist only on the ZX Spectrum Next", 2, 4],
    ["05:Flags == 1", EXEC, "Bank-local labels (05:Flags) exist only on the ZX Spectrum Next", 0, 8],
    ["b[70:+$0100]", NEXT, "'70' is not a 16K bank (00-6F)", 2, 4],
    ["b[ZZ:+$0100]", NEXT, "'ZZ' is not a 16K bank", 2, 4],
    ["b[E0:$C000]", NEXT, "Unknown partition 'E0'", 2, 4],
    ["05:$8000 == 1", NEXT, "must be followed by a label here", 0, 8]
  ])("rejects %s", (text, env, message, start, end) => {
    const diagnostic = error(text, env);
    expect(diagnostic.message).toContain(message);
    expect([diagnostic.start, diagnostic.end]).toEqual([start, end]);
  });
});

describe("labels (§3.6)", () => {
  it("is inactive while a label is missing, and active again once defined (C14)", () => {
    const compiled = compile("w[score] > 0 && level == 1 && w[score] < 9");
    bindCondition(compiled, { level: 1 });
    expect(compiled.inactiveReason).toBe("unknown label score");
    bindCondition(compiled, {});
    expect(compiled.inactiveReason).toBe("unknown labels score, level");
    bindCondition(compiled, { score: 1, level: 1 });
    expect(compiled.inactiveReason).toBeUndefined();
  });

  it("warns, but accepts, an unknown label when the symbol table is known", () => {
    const result = compileCondition("w[score] > 1", { ...EXEC, symbols: {} });
    expect(result.errors).toEqual([]);
    expect(result.compiled?.inactiveReason).toBe("unknown label score");
    expect(result.warnings).toEqual([
      {
        severity: "warning",
        message: "Unknown label score: the breakpoint is inactive until a build defines it",
        start: 2,
        end: 7
      }
    ]);
  });

  it("gives no warning without a symbol table", () => {
    expect(compileCondition("w[score] > 1", EXEC).warnings).toEqual([]);
  });

  it("warns when a reserved name shadows a symbol (R5)", () => {
    const result = compileCondition("C == 1", { ...EXEC, symbols: { c: 5 } });
    expect(result.errors).toEqual([]);
    expect(result.warnings[0].message).toContain("write `C` for the label");
  });

  it("does not range-check labels", () => {
    expect(compileCondition("score == $FFFF_FFFF + 1", EXEC).errors).toEqual([]);
  });

  it.each([
    ["`score", "Unterminated backtick label"],
    ["``", "Empty backtick label"]
  ])("rejects %s", (text, message) => {
    expect(error(text).message).toContain(message);
  });
});

describe("syntax errors (§3.7 rule 1)", () => {
  it.each([
    ["", "The condition is empty", 0, 0],
    ["   ", "The condition is empty", 0, 3],
    ["A ==", "ends where a value is expected", 4, 4],
    ["(A == 1", "Missing ')' to close the '(' at column 1", 7, 7],
    ["A == 1)", "Unbalanced ')'", 6, 7],
    ["A == 1]", "Unbalanced ']'", 6, 7],
    ["A == == 1", "Unexpected '=='", 5, 7],
    ["A 1", "Unexpected '1'", 2, 3],
    ["A = 1", "Unexpected character '='", 2, 3],
    ["A * 2", "Unexpected character '*'", 2, 3],
    ["page(1", "Missing ')'", 6, 6],
    ["A == #1", "Unexpected character '#'", 5, 6]
  ])("rejects %j", (text, message, start, end) => {
    const diagnostic = error(text);
    expect(diagnostic.message).toContain(message);
    expect([diagnostic.start, diagnostic.end]).toEqual([start, end]);
  });
});

describe("profile (C18)", () => {
  it("rejects any condition on a non-Z80 machine", () => {
    expect(error("A == 1", { ...EXEC, isZ80: false }).message).toContain("Z80 machines only");
  });
});

describe("no constant folding (`.plans/BREAKPOINT_CONDITIONS_IN_C_PLAN.md` E4)", () => {
  it("leaves constant sub-trees to the C evaluator", () => {
    expect(compile("A == 1 + 2").tree).toEqual({
      k: "bin",
      op: "==",
      l: { k: "reg", r: "A" },
      r: { k: "bin", op: "+", l: { k: "num", v: 1 }, r: { k: "num", v: 2 } }
    });
    expect(compile("s8($FF)").tree).toEqual({ k: "call", fn: "s8", arg: { k: "num", v: 255 } });
  });

  it("range-checks literals - negated ones included - but not computed constants", () => {
    expect(error("A > -1").message).toContain("-1 is out of range for A");
    expect(error("A == --300").message).toContain("--300 is out of range for A");
    expect(compileCondition("A == (1 << 8)", EXEC).errors).toEqual([]);
    expect(compileCondition("A == 255 + 1", EXEC).errors).toEqual([]);
  });

  it("keeps the source text", () => {
    expect(compile("  A == 1 ").source).toBe("  A == 1 ");
  });
});

describe("the plan's §3.1 examples", () => {
  it.each([
    ["A == $FF && !ZF", EXEC],
    ["HL > $C000", EXEC],
    ["(B & %0000_0111) == 3 || CF", EXEC],
    ["(F & $28) != 0  ||  F3F || F5F", EXEC],
    ["[IX+3] == 0", EXEC],
    ["w[$5C3A] > 100", EXEC],
    ["wbe[$8000] == $1234", EXEC],
    ['l[HL] == "KLIV"', EXEC],
    ["sb[IX+2] < -1", EXEC],
    ["s16(HL) < 0", EXEC],
    ["(A >> 4) == $0A", EXEC],
    ["b[05:$C010] == $FF", NEXT],
    ["w[0A:+$0100] == score", NEXT],
    ["VAL == $C9", MEMORY],
    ["ADDR >= $5800 && ADDR < $5B00", MEMORY],
    ["page($C000) == @B5", SP128],
    ["nr($56) == $0A", NEXT],
    ["w[score] >= 1000", EXEC],
    ["b[05:Flags] == 1", NEXT],
    ["AF' == $0044", EXEC]
  ])("%s compiles", (text, env) => {
    expect(compileCondition(text, env).errors).toEqual([]);
  });
});

describe("the bytecode (`.plans/BREAKPOINT_CONDITIONS_IN_C_PLAN.md` §4.1)", () => {
  const code = (text: string, env: ConditionEnvironment = EXEC) => Array.from(emitCondition(compile(text, env)));

  it("starts with the format word and ends with END", () => {
    const words = code("A");
    expect(words[0]).toBe(CONDITION_FORMAT);
    expect(words[words.length - 1]).toBe(CondOp.END);
  });

  it("emits operands in postfix order", () => {
    expect(code("A == 1")).toEqual([
      CONDITION_FORMAT,
      CondOp.REG, CONDITION_REGISTER_IDS.indexOf("A"),
      CondOp.CONST, 1, 0,
      CondOp.EQ,
      CondOp.END
    ]);
  });

  it("encodes a negative constant as 64-bit two's complement", () => {
    // --- A ROM partition literal is -1
    expect(code("page($0000) == @R0", SP128).slice(-5, -2)).toEqual([CondOp.CONST, 0xffffffff, 0xffffffff]);
    // --- `-1` is a literal negated by the evaluator, not folded
    expect(code("-1")).toEqual([CONDITION_FORMAT, CondOp.CONST, 1, 0, CondOp.NEG, CondOp.END]);
  });

  it("encodes a memory access's width, byte order, sign and part", () => {
    const [, , , , mem, info, part] = code("slbe[0A:+$0100]", NEXT);
    expect(mem).toBe(CondOp.MEM);
    expect(info).toBe(4 | MEM_BE | MEM_SIGNED | (PART_BANK << 8));
    expect(part).toBe(0x0a);
    const [, , , , , partInfo, partition] = code("w[B5:$C010]", SP128);
    expect(partInfo).toBe(2 | (PART_PARTITION << 8));
    expect(partition).toBe(5);
    // --- A negative partition (a ROM) as its 32-bit pattern
    expect(code("b[R0:$0010]", SP128)[6]).toBe(0xffffffff);
  });

  it("jumps over the right side of && and || to the end of the operator", () => {
    const words = code("A && B");
    const jump = words.indexOf(CondOp.ANDJ);
    expect(words[jump + 1]).toBe(words.indexOf(CondOp.BOOL) + 1);
    expect(code("A || B")).toContain(CondOp.ORJ);
  });

  it("puts a bound label's value in the program, and re-emits on re-binding (E10)", () => {
    const compiled = compile("w[score] == 1");
    bindCondition(compiled, { score: 0x9000 });
    expect(Array.from(emitCondition(compiled)).slice(1, 4)).toEqual([CondOp.CONST, 0x9000, 0]);
    bindCondition(compiled, { score: 0x9100 });
    expect(Array.from(emitCondition(compiled)).slice(1, 4)).toEqual([CondOp.CONST, 0x9100, 0]);
  });

  it("refuses a condition nested deeper than the evaluator's stack", () => {
    const deep = `${"(1 + ".repeat(70)}1${")".repeat(70)}`;
    expect(stackDepthOf(compile("1 + (1 + 1)").tree)).toBe(3);
    expect(compileCondition(deep, EXEC).errors[0].message).toBe("The condition is nested too deeply");
  });

  it("refuses a condition longer than a core stores", () => {
    const long = Array.from({ length: 400 }, () => "A").join(" + ") + " == 1";
    expect(compileCondition(long, EXEC).errors[0].message).toBe("The condition is too long");
  });
});
