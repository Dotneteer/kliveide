import { beforeAll, describe, expect, it } from "vitest";

import { createRuntimeRig, s16, s8, type RuntimeRig } from "./runtime-kit";

/** Deterministic pseudo-random values (a small LCG), so a failure reproduces. */
function* lcg(seed: number, count: number): Generator<number> {
  let x = seed;
  for (let i = 0; i < count; i++) {
    x = (Math.imul(x, 1103515245) + 12345) >>> 0;
    yield x >>> 8;
  }
}

const EDGE16 = [0, 1, 2, 3, 7, 10, 127, 128, 255, 256, 1000, 0x7fff, 0x8000, 0x8001, 0xfffe, 0xffff];

function truncDiv(a: number, b: number): number {
  return Math.trunc(a / b);
}

describe("Klive BASIC runtime - arith16", () => {
  let rig: RuntimeRig;
  beforeAll(async () => {
    rig = await createRuntimeRig({ uses: ["Mul8", "DivModU8", "DivModI8", "Mul16", "DivModU16", "DivModI16"] });
  });

  it("Mul8 keeps the low 8 bits of every product", () => {
    for (let a = 0; a < 256; a += 5) {
      for (let h = 0; h < 256; h += 7) {
        const r = rig.call("core.Mul8", { a, hl: h << 8 });
        expect(r.a, `${a} * ${h}`).toBe((a * h) & 0xff);
      }
    }
  });

  it("DivModU8 divides every dividend by every non-zero divisor", () => {
    for (let a = 0; a < 256; a += 3) {
      for (let h = 1; h < 256; h += 5) {
        const r = rig.call("core.DivModU8", { a, hl: h << 8 });
        expect([r.a, r.hl & 0xff], `${a} / ${h}`).toEqual([Math.floor(a / h), a % h]);
      }
    }
  });

  it("DivModI8 truncates towards zero; the remainder takes the dividend's sign", () => {
    for (let a = -128; a < 128; a += 3) {
      for (const h of [-128, -127, -10, -3, -2, -1, 1, 2, 3, 7, 10, 100, 127]) {
        const r = rig.call("core.DivModI8", { a: a & 0xff, hl: (h & 0xff) << 8 });
        const q = truncDiv(a, h);
        expect([s8(r.a), s8(r.hl & 0xff)], `${a} / ${h}`).toEqual([s8(q & 0xff), a - q * h]);
      }
    }
  });

  it("Mul16 keeps the low 16 bits of every product", () => {
    const values = [...EDGE16, ...lcg(1, 40)].map((v) => v & 0xffff);
    for (const x of values) {
      for (const y of values.slice(0, 20)) {
        const r = rig.call("core.Mul16", { hl: x, de: y });
        expect(r.hl, `${x} * ${y}`).toBe(Number((BigInt(x) * BigInt(y)) & 0xffffn));
      }
    }
  });

  it("DivModU16 divides, including divisors above $7FFF", () => {
    const values = [...EDGE16, ...lcg(2, 40)].map((v) => v & 0xffff);
    for (const x of values) {
      for (const y of values.filter((v) => v !== 0).slice(0, 24)) {
        const r = rig.call("core.DivModU16", { hl: x, de: y });
        expect([r.hl, r.de], `${x} / ${y}`).toEqual([Math.floor(x / y), x % y]);
      }
    }
  });

  it("DivModI16 truncates towards zero; the remainder takes the dividend's sign", () => {
    const values = [...EDGE16, ...lcg(3, 40)].map((v) => s16(v & 0xffff));
    for (const x of values) {
      for (const y of values.filter((v) => v !== 0).slice(0, 24)) {
        const r = rig.call("core.DivModI16", { hl: x & 0xffff, de: y & 0xffff });
        const q = truncDiv(x, y);
        expect([s16(r.hl), s16(r.de)], `${x} / ${y}`).toEqual([s16(q & 0xffff), s16((x - q * y) & 0xffff)]);
      }
    }
  });

  it("division by zero gives an all-ones quotient and the dividend as the remainder", () => {
    expect(rig.call("core.DivModU16", { hl: 1234, de: 0 })).toMatchObject({ hl: 0xffff, de: 1234 });
    const r = rig.call("core.DivModU8", { a: 99, hl: 0 });
    expect([r.a, r.hl & 0xff]).toEqual([0xff, 99]);
  });
});
