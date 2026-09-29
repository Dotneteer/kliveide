import { describe, expect, it } from "vitest";

import {
  Float40Overflow,
  fromDecimal,
  fromInteger,
  fromNumber,
  isTrue,
  negate,
  toNumber,
  type Float40
} from "@main/kbasic/semantics/float40";

describe("float40 conversions", () => {
  it("stores integers in -65535..65535 in the ROM's integer form", () => {
    expect(fromInteger(0)).toEqual([0, 0, 0, 0, 0]);
    expect(fromInteger(1)).toEqual([0, 0, 1, 0, 0]);
    expect(fromInteger(65535)).toEqual([0, 0, 0xff, 0xff, 0]);
    expect(fromInteger(-1)).toEqual([0, 0xff, 0xff, 0xff, 0]);
    expect(fromInteger(-65535)).toEqual([0, 0xff, 1, 0, 0]);
    // --- the same bytes the ROM's own negation produces
    expect(negate(fromInteger(1234))).toEqual(fromInteger(-1234));
  });

  it("stores larger integers exactly in normalised form", () => {
    expect(fromInteger(65536)).toEqual([0x91, 0, 0, 0, 0]);
    expect(fromInteger(-65536)).toEqual([0x91, 0x80, 0, 0, 0]);
    expect(fromInteger(0xffffffff)).toEqual([0xa0, 0x7f, 0xff, 0xff, 0xff]);
    expect(toNumber(fromInteger(123456789))).toBe(123456789);
  });

  it("decodes both forms exactly", () => {
    expect(toNumber([0, 0xff, 0xfe, 0xff, 0])).toBe(-2);
    expect(toNumber([0x81, 0, 0, 0, 0])).toBe(1);
    expect(toNumber([0x80, 0x80, 0, 0, 0])).toBe(-0.5);
    expect(toNumber([0x84, 0x20, 0, 0, 0])).toBe(10);
    expect(toNumber([0x01, 0, 0, 0, 0])).toBe(2 ** -128);
  });

  it("rounds decimal literals to the nearest Float, half to even", () => {
    expect(fromDecimal("0.5")).toEqual([0x80, 0, 0, 0, 0]);
    expect(fromDecimal("0.1")).toEqual([0x7d, 0x4c, 0xcc, 0xcc, 0xcd]);
    expect(fromDecimal("-0.1")).toEqual([0x7d, 0xcc, 0xcc, 0xcc, 0xcd]);
    expect(fromDecimal("3.14159265358979")).toEqual([0x82, 0x49, 0x0f, 0xda, 0xa2]);
    // --- Above 2^33 a Float steps by 4: 2^33 + 2 and 2^33 + 6 are ties, and go to the even mantissa
    expect(fromDecimal("8589934594")).toEqual(fromInteger(2 ** 33));
    expect(fromDecimal("8589934598")).toEqual([0xa2, 0, 0, 0, 2]);
    expect(fromDecimal("8589934595")).toEqual([0xa2, 0, 0, 0, 1]);
  });

  it("gives integer literals up to 65535 the integer form", () => {
    expect(fromDecimal("100")).toEqual(fromInteger(100));
    expect(fromDecimal("100.0")).toEqual(fromInteger(100));
    expect(fromDecimal("1e3")).toEqual(fromInteger(1000));
    expect(fromDecimal("-7")).toEqual(fromInteger(-7));
    expect(fromDecimal("65536")).toEqual([0x91, 0, 0, 0, 0]);
  });

  it("accepts the literal forms BASIC writes", () => {
    expect(toNumber(fromDecimal(".25"))).toBe(0.25);
    expect(toNumber(fromDecimal("2.")) ).toBe(2);
    expect(toNumber(fromDecimal("1.5E-2"))).toBeCloseTo(0.015, 9);
    expect(() => fromDecimal("1.2.3")).toThrow();
    expect(() => fromDecimal("")).toThrow();
  });

  it("overflows above the largest Float and underflows to zero below the smallest", () => {
    expect(() => fromDecimal("1e39")).toThrow(Float40Overflow);
    expect(fromDecimal("1e-39")).toEqual([0, 0, 0, 0, 0]);
    expect(toNumber(fromDecimal("1.7e38"))).toBeCloseTo(1.7e38, -30);
  });

  it("converts doubles exactly, rounding to 32 mantissa bits", () => {
    for (const x of [0.1, -2.5, 1e-10, 12345.678, 2 ** 31 + 0.5, Math.PI]) {
      const f = fromNumber(x);
      expect(Math.abs(toNumber(f) - x)).toBeLessThanOrEqual(Math.abs(x) * 2 ** -32);
    }
    expect(fromNumber(42)).toEqual(fromInteger(42));
    expect(() => fromNumber(Infinity)).toThrow(Float40Overflow);
  });

  it("treats any value with a non-zero byte among the first four as true", () => {
    const cases: [Float40, boolean][] = [
      [[0, 0, 0, 0, 0], false],
      [[0, 0, 1, 0, 0], true],
      [[0x81, 0, 0, 0, 0], true],
      [[0, 0, 0, 0, 7], false]
    ];
    for (const [f, t] of cases) expect(isTrue(f)).toBe(t);
  });
});
