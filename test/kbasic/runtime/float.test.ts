import { beforeAll, describe, expect, it } from "vitest";

import { add, divide, fromDecimal, fromInteger, multiply, subtract, toNumber, type Float40 } from "@main/kbasic/semantics/float40";

import { createRuntimeRig, makeString, readString, type RuntimeRig } from "./runtime-kit";

const USES = ["FMod", "FBinary", "FCompare", "FUnary", "FFromU32", "FFromI32", "FToI32", "FToText", "FStr", "FVal", "StrAlloc", "Free"];

/** Stubs: Bin/Cmp push Left, load Right and the operation, call; Un applies Op to Left. Results in Result. */
const EXTRA = [
  "Bin:",
  "    ld a,(Left)",
  "    ld de,(Left+1)",
  "    ld bc,(Left+3)",
  "    push bc",
  "    push de",
  "    push af",
  "    ld a,(Op)",
  "    ld l,a",
  "    ld a,(Right)",
  "    ld de,(Right+1)",
  "    ld bc,(Right+3)",
  "    call core.FBinary",
  "Store:",
  "    ld (Result),a",
  "    ld (Result+1),de",
  "    ld (Result+3),bc",
  "    ret",
  "Mod:",
  "    ld a,(Left)",
  "    ld de,(Left+1)",
  "    ld bc,(Left+3)",
  "    push bc",
  "    push de",
  "    push af",
  "    ld a,(Right)",
  "    ld de,(Right+1)",
  "    ld bc,(Right+3)",
  "    call core.FMod",
  "    jp Store",
  "Cmp:",
  "    ld a,(Left)",
  "    ld de,(Left+1)",
  "    ld bc,(Left+3)",
  "    push bc",
  "    push de",
  "    push af",
  "    ld a,(Op)",
  "    ld l,a",
  "    ld a,(Right)",
  "    ld de,(Right+1)",
  "    ld bc,(Right+3)",
  "    call core.FCompare",
  "    ld (Result),a",
  "    ret",
  "Un:",
  "    ld a,(Op)",
  "    ld l,a",
  "    ld a,(Left)",
  "    ld de,(Left+1)",
  "    ld bc,(Left+3)",
  "    call core.FUnary",
  "    jp Store",
  "ToI32:",
  "    ld a,(Left)",
  "    ld de,(Left+1)",
  "    ld bc,(Left+3)",
  "    call core.FToI32",
  "    ld (Result),hl",
  "    ld (Result+2),de",
  "    ret",
  "Text:",
  "    ld a,(Left)",
  "    ld de,(Left+1)",
  "    ld bc,(Left+3)",
  "    jp core.FStr",
  "Val:",
  "    ld hl,(Right)",
  "    xor a",
  "    call core.FVal",
  "    jp Store",
  "Op: .defb 0",
  "Left: .defs 5",
  "Right: .defs 5",
  "Result: .defs 5"
].join("\n");

const OP = { add: 0x0f, sub: 0x03, mul: 0x04, div: 0x05, "<=": 0x09, ">=": 0x0a, "<>": 0x0b, ">": 0x0c, "<": 0x0d, "=": 0x0e, neg: 0x1b, sqr: 0x28, int: 0x27 };

describe("Klive BASIC runtime - float", () => {
  let rig: RuntimeRig;
  beforeAll(async () => {
    rig = await createRuntimeRig({ uses: USES, extra: EXTRA });
  });

  const put = (label: string, f: Float40) => rig.session.poke(rig.program.symbol(label), [...f]);
  const result = (): Float40 => {
    const at = rig.program.symbol("Result");
    return [0, 1, 2, 3, 4].map((i) => rig.session.peek(at + i)) as unknown as Float40;
  };
  const binary = (op: number, a: Float40, b: Float40) => {
    rig.session.poke(rig.program.symbol("Op"), [op]);
    put("Left", a);
    put("Right", b);
    rig.call("Bin");
    return result();
  };

  const values = ["0", "1", "-1", "0.1", "3.14159", "-2.5", "65535", "65536", "-70000", "1e10", "1e-10", "123456.789"].map(fromDecimal);

  it("adds, subtracts, multiplies and divides exactly as the ROM (float40)", () => {
    for (const a of values) {
      for (const b of values) {
        expect(binary(OP.add, a, b), `${toNumber(a)} + ${toNumber(b)}`).toEqual(add(a, b));
        expect(binary(OP.sub, a, b), `${toNumber(a)} - ${toNumber(b)}`).toEqual(subtract(a, b));
        expect(binary(OP.mul, a, b), `${toNumber(a)} * ${toNumber(b)}`).toEqual(multiply(a, b));
        if (toNumber(b) !== 0) expect(binary(OP.div, a, b), `${toNumber(a)} / ${toNumber(b)}`).toEqual(divide(a, b));
      }
    }
  });

  it("takes MOD with the dividend's sign", () => {
    const mod = (a: string, b: string) => {
      put("Left", fromDecimal(a));
      put("Right", fromDecimal(b));
      rig.call("Mod");
      return toNumber(result());
    };
    expect([mod("7", "3"), mod("-7", "3"), mod("7", "-3"), mod("5.5", "2")]).toEqual([1, -1, 1, 1.5]);
  });

  it("compares", () => {
    const cmp = (op: keyof typeof OP, a: number, b: number) => {
      rig.session.poke(rig.program.symbol("Op"), [OP[op]]);
      put("Left", fromDecimal(String(a)));
      put("Right", fromDecimal(String(b)));
      rig.call("Cmp");
      return rig.session.peek(rig.program.symbol("Result"));
    };
    expect([cmp("<", 1, 2), cmp("<", 2, 1), cmp(">", -1, -2), cmp("=", 0.5, 0.5), cmp("<>", 0.5, 0.5), cmp("<=", 3, 3), cmp(">=", -3, 3)]).toEqual([1, 0, 1, 1, 0, 1, 0]);
  });

  it("applies unary operations", () => {
    rig.session.poke(rig.program.symbol("Op"), [OP.sqr]);
    put("Left", fromInteger(2));
    rig.call("Un");
    expect(toNumber(result())).toBeCloseTo(Math.SQRT2, 8);
    rig.session.poke(rig.program.symbol("Op"), [OP.neg]);
    put("Left", fromDecimal("2.5"));
    rig.call("Un");
    expect(result()).toEqual(fromDecimal("-2.5"));
  });

  it("converts 32-bit integers exactly, with the small-integer form where the ROM uses it", () => {
    for (const n of [0, 1, 255, 65535, 65536, 123456789, 0xffffffff]) {
      expect(rig.call("core.FFromU32", { hl: n & 0xffff, de: n >>> 16 }), `${n}`).toBeTruthy();
      const r = rig.call("core.FFromU32", { hl: n & 0xffff, de: n >>> 16 });
      expect([r.a, (r.de & 0xff), r.de >> 8, r.bc & 0xff, r.bc >> 8], `${n}`).toEqual([...fromInteger(n)]);
    }
    for (const n of [-1, -2, -65535, -65536, -65537, -123456789, -(2 ** 31)]) {
      const u = n >>> 0;
      const r = rig.call("core.FFromI32", { hl: u & 0xffff, de: u >>> 16 });
      expect([r.a, r.de & 0xff, r.de >> 8, r.bc & 0xff, r.bc >> 8], `${n}`).toEqual([...fromInteger(n)]);
    }
  });

  it("converts to 32 bits rounding towards minus infinity, modulo 2^32", () => {
    const toI32 = (text: string) => {
      put("Left", fromDecimal(text));
      rig.call("ToI32");
      return rig.session.peekWord(rig.program.symbol("Result")) + rig.session.peekWord(rig.program.symbol("Result") + 2) * 65536;
    };
    expect(toI32("2.7")).toBe(2);
    expect(toI32("-2.2")).toBe(0xfffffffd);
    expect(toI32("-1")).toBe(0xffffffff);
    expect(toI32("70000.5")).toBe(70000);
    expect(toI32("-70000.5")).toBe(2 ** 32 - 70001);
    expect(toI32("4294967296")).toBe(0);
    // --- 2^32 + 6 is exact (above 2^32 a Float steps by 2)
    expect(toI32("4294967302")).toBe(6);
    expect(toI32("2147483648")).toBe(2 ** 31);
  });

  it("writes a Float as the ROM prints it (STR)", () => {
    const str = (text: string) => {
      put("Left", fromDecimal(text));
      return readString(rig, rig.call("Text").hl);
    };
    expect([str("123"), str("-0.5"), str("0.1"), str("1e10"), str("3.14159265"), str("0")]).toEqual(["123", "-0.5", "0.1", "1E+10", "3.1415926", "0"]);
  });

  it("reads a number from a String (VAL), and sets ERR_NR for anything else", () => {
    const val = (text: string) => {
      rig.session.poke(0x5c3a, [0xff]);
      rig.session.pokeWord(rig.program.symbol("Right"), makeString(rig, text));
      rig.call("Val");
      return { value: toNumber(result()), err: rig.session.peek(0x5c3a) };
    };
    expect(val("12.5")).toEqual({ value: 12.5, err: 0xff });
    expect(val("  -3 ")).toEqual({ value: -3, err: 0xff });
    expect(val("1e3")).toEqual({ value: 1000, err: 0xff });
    // --- The ROM's decimal reader is not correctly rounded: ".25" is a little below 0.25
    const quarter = val(".25");
    expect(quarter.err).toBe(0xff);
    expect(quarter.value).toBeCloseTo(0.25, 9);
    expect(val("abc")).toEqual({ value: 0, err: 11 });
    expect(val("12x")).toEqual({ value: 0, err: 11 });
    expect(val("")).toEqual({ value: 0, err: 11 });
  });
});
