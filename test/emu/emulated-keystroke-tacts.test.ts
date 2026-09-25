import { describe, expect, it } from "vitest";

import { tactsPast, toTactCounter } from "@emu/structs/EmulatedKeyStroke";

// --- The WASM cores keep the tact counter in 32 bits (issue #1374)
describe("tact distances on a wrapping 32-bit counter", () => {
  const WRAP = 2 ** 32;

  it("folds a point into the counter's range", () => {
    expect(toTactCounter(123)).toBe(123);
    expect(toTactCounter(WRAP + 5)).toBe(5);
    expect(toTactCounter(-1)).toBe(WRAP - 1);
  });

  it("measures across the wrap", () => {
    expect(tactsPast(10, WRAP - 10)).toBe(20);
    expect(tactsPast(WRAP - 10, 10)).toBe(-20);
    expect(tactsPast(WRAP + 10, 10)).toBe(0);
  });

  it("agrees with plain subtraction away from the wrap", () => {
    expect(tactsPast(70_000, 69_999)).toBe(1);
    expect(tactsPast(69_999, 70_000)).toBe(-1);
  });
});
