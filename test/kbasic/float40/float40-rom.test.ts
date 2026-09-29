import { beforeAll, describe, expect, it } from "vitest";

import {
  add,
  compare,
  divide,
  Float40Overflow,
  fromInteger,
  multiply,
  negate,
  subtract,
  truncate,
  type Float40,
  type Float40Comparison
} from "@main/kbasic/semantics/float40";

import { CALC, RomCalculator, type CalcCase, type CalcResult } from "./rom-calculator";

/** Deterministic pseudo-random numbers, so a failure reproduces. */
function lcg(seed: number): () => number {
  let x = seed >>> 0;
  return () => {
    x = (Math.imul(x, 1664525) + 1013904223) >>> 0;
    return x;
  };
}

const hex = (f: Float40) => f.map((b) => b.toString(16).padStart(2, "0")).join(" ");

/** A spread of operands: small integers, every exponent, extremes, near-equal values, odd forms. */
function operands(seed: number, count: number): Float40[] {
  const rnd = lcg(seed);
  const out: Float40[] = [];
  const edgeInts = [0, 1, -1, 2, -2, 3, 10, -10, 255, 256, -256, 32767, 32768, -32768, 65534, 65535, -65535];
  for (const n of edgeInts) out.push(fromInteger(n));
  out.push([0x81, 0, 0, 0, 0], [0x81, 0x80, 0, 0, 0], [0x80, 0, 0, 0, 0], [0x91, 0x7f, 0xff, 0x80, 0]);
  out.push([0x91, 0x80, 0, 0, 0], [0x92, 0, 0, 0, 0], [0x01, 0, 0, 0, 0], [0xff, 0x7f, 0xff, 0xff, 0xff]);
  out.push([0xff, 0xff, 0xff, 0xff, 0xff], [0x02, 0x80, 0, 0, 1], [0xa0, 0x7f, 0xff, 0xff, 0xff]);
  while (out.length < count) {
    const r = rnd();
    const kind = r % 5;
    if (kind === 0) {
      out.push(fromInteger(((rnd() % 131071) - 65535) | 0));
    } else {
      const exponent =
        kind === 1 ? 1 + (rnd() % 255) : kind === 2 ? 0x70 + (rnd() % 0x40) : kind === 3 ? 1 + (rnd() % 12) : 0xf0 + (rnd() % 16);
      out.push([exponent, rnd() & 0xff, rnd() & 0xff, rnd() & 0xff, rnd() & 0xff]);
    }
  }
  return out;
}

/** Pairs: random operand pairs plus pairs of nearly equal values (the cancellation cases). */
function pairs(seed: number, count: number): [Float40, Float40][] {
  const rnd = lcg(seed);
  const pool = operands(seed + 1, 400);
  const out: [Float40, Float40][] = [];
  for (let i = 0; i < count; i++) {
    const a = pool[rnd() % pool.length];
    if (i % 4 === 0 && a[0] !== 0) {
      const b: Float40 = [a[0], a[1] ^ (rnd() & 0x80), a[2], a[3], (a[4] + (rnd() % 5) - 2) & 0xff];
      out.push([a, b]);
    } else out.push([a, pool[rnd() % pool.length]]);
  }
  return out;
}

function mine(fn: () => Float40): CalcResult {
  try {
    return { result: fn() };
  } catch (e) {
    if (e instanceof Float40Overflow) return { error: 5 };
    throw e;
  }
}

function expectSame(cases: CalcCase[], rom: CalcResult[], ours: (c: CalcCase) => CalcResult, label: string): void {
  const mismatches: string[] = [];
  cases.forEach((c, i) => {
    const r = rom[i];
    const o = ours(c);
    if (JSON.stringify(r) !== JSON.stringify(o)) {
      const show = (x: CalcResult) => ("error" in x ? `error ${x.error}` : hex(x.result));
      mismatches.push(`${hex(c.a)}${c.b ? " , " + hex(c.b) : ""}: ROM ${show(r)}, float40 ${show(o)}`);
    }
  });
  expect(mismatches.slice(0, 10), `${label}: ${mismatches.length} of ${cases.length} differ`).toEqual([]);
}

describe("float40 against the 48K ROM calculator", () => {
  let rom: RomCalculator;
  beforeAll(async () => {
    rom = await RomCalculator.create();
  });

  const binaries: [string, number, (a: Float40, b: Float40) => Float40][] = [
    ["addition", CALC.addition, add],
    ["subtraction", CALC.subtract, subtract],
    ["multiplication", CALC.multiply, multiply],
    ["division", CALC.division, divide]
  ];

  it.each(binaries)("%s matches the ROM bit for bit", (label, op, fn) => {
    const cases: CalcCase[] = pairs(op * 7919, 3000).map(([a, b]) => ({ op, a, b }));
    expectSame(cases, rom.run(cases), (c) => mine(() => fn(c.a, c.b!)), label);
  });

  it.each(["<=", ">=", "<>", ">", "<", "="] as Float40Comparison[])("comparison %s matches the ROM", (cmp) => {
    const op = CALC[cmp];
    const cases: CalcCase[] = pairs(op * 104729, 1500).map(([a, b]) => ({ op, a, b }));
    expectSame(cases, rom.run(cases), (c) => mine(() => compare(c.a, cmp, c.b!)), cmp);
  });

  it("negation matches the ROM", () => {
    const cases: CalcCase[] = operands(11, 1500).map((a) => ({ op: CALC.negate, a }));
    expectSame(cases, rom.run(cases), (c) => mine(() => negate(c.a)), "negate");
  });

  it("truncation matches the ROM", () => {
    const cases: CalcCase[] = operands(13, 1500).map((a) => ({ op: CALC.truncate, a }));
    expectSame(cases, rom.run(cases), (c) => mine(() => truncate(c.a)), "truncate");
  });
});
