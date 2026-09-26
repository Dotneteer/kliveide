import { describe, expect, it } from "vitest";

import { runBasic } from "./run-kit";

/** Fixed (16.16) on the 48K: DE:HL values, the fixed runtime module, conversions through Float. */
const raw = (x: number) => Math.floor(x * 65536);

describe("Fixed", () => {
  it("multiplies and divides as the compiler folds: the product rounded down, the quotient truncated", async () => {
    const cases: [number, number][] = [
      [1.5, 2.25],
      [-1.5, 2.25],
      [3, -0.1],
      [-7.75, -0.5],
      [100.001, 0.003]
    ];
    const lines = cases.map(([a, b], i) => `a = ${a}: b = ${b}: p(${i}) = a * b: q(${i}) = a / b`);
    const source = ["DIM a, b AS Fixed", `DIM p(${cases.length - 1}) AS Fixed`, `DIM q(${cases.length - 1}) AS Fixed`, ...lines, ""].join("\n");
    const r = await runBasic(source);
    cases.forEach(([a, b], i) => {
      const x = BigInt(raw(a));
      const y = BigInt(raw(b));
      const product = x * y;
      // --- floor division by 65536 for the product, truncation for the quotient
      const p = Number(BigInt.asIntN(32, product >= 0n ? product / 65536n : -((-product + 65535n) / 65536n)));
      const q = Number(BigInt.asIntN(32, (x * 65536n) / y));
      const read = (label: string) => {
        const at = r.program.symbol(`_${label}.data`) + 4 * i;
        return (r.session.peekWord(at) | (r.session.peekWord(at + 2) << 16)) | 0;
      };
      expect(read("p"), `${a} * ${b}`).toBe(p);
      expect(read("q"), `${a} / ${b}`).toBe(q);
    });
  });

  it("adds, compares, takes MOD and prints as the Float of the same value", async () => {
    const source = "DIM a, b AS Fixed\na = 2.5: b = -0.75\nPRINT a + b; \" \"; a - b; \" \"; a > b; a < b; a = 2.5; \" \"; a MOD 1; \" \"; -a MOD 1; \" \"; -a\n";
    expect((await runBasic(source)).screen(1)[0]).toBe("1.75 3.25 101 0.5 -0.5 -2.5");
  });

  it("converts: integers exactly, reals and back rounding towards minus infinity", async () => {
    const source = [
      "DIM f AS Fixed",
      "DIM i AS Integer",
      "DIM l AS Long",
      "DIM x AS Float",
      "i = -3: f = i: PRINT f; \" \";",
      "f = -2.25: i = f: l = f: PRINT i; \" \"; l; \" \";",
      "x = 1.0 / 3: f = x: PRINT f; \" \";",
      "f = 0.5: x = f * 3: PRINT x; \" \"; INT(f); \" \"; ABS(-f); \" \"; SGN(-f)",
      ""
    ].join("\n");
    expect((await runBasic(source)).screen(1)[0]).toBe("-3 -3 -3 0.33332825 1.5 0 0.5 -1");
  });

  it("stops with 6 Number too big when dividing by zero", async () => {
    const r = await runBasic("DIM a, z AS Fixed\na = 1\nPRINT a / z\n", { expectEnd: false, frames: 100 });
    expect(r.session.screenLine(23)).toMatch(/^6 Number too big/);
  });
});
