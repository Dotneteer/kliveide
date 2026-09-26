import { beforeEach, describe, expect, it } from "vitest";

import { createRuntimeRig, heapUsed, makeString, readString, type RuntimeRig } from "./runtime-kit";

const USES = ["StrAlloc", "StrLen", "StrDup", "StrConcat", "StrStore", "StrCompare", "Free"];

describe("Klive BASIC runtime - strings", () => {
  let rig: RuntimeRig;
  beforeEach(async () => {
    rig = await createRuntimeRig({ uses: USES, layout: { heapSize: 2000 }, extra: "Var:\n    .defw 0" });
  });

  it("StrAlloc sets the length and StrLen reads it; the empty String is 0", () => {
    const p = rig.call("core.StrAlloc", { bc: 5 }).hl;
    expect(rig.session.peekWord(p)).toBe(5);
    expect(rig.call("core.StrLen", { hl: p }).bc).toBe(5);
    expect(rig.call("core.StrLen", { hl: 0 }).bc).toBe(0);
  });

  it("StrAlloc fails cleanly for a length no block can hold", () => {
    expect(rig.call("core.StrAlloc", { bc: 0xfffe }).hl).toBe(0);
    expect(rig.call("core.StrAlloc", { bc: 3000 }).hl).toBe(0);
    expect(heapUsed(rig)).toBe(0);
  });

  it("StrDup copies and leaves the original alone", () => {
    const p = makeString(rig, "Klive");
    const q = rig.call("core.StrDup", { hl: p }).hl;
    expect(q).not.toBe(p);
    expect(readString(rig, q)).toBe("Klive");
    expect(readString(rig, p)).toBe("Klive");
    expect(rig.call("core.StrDup", { hl: 0 }).hl).toBe(0);
  });

  it.each([
    ["Hello, ", "World", "Hello, World"],
    ["", "World", "World"],
    ["Hello", "", "Hello"],
    ["", "", ""]
  ])("StrConcat(%j, %j) = %j", (a, b, expected) => {
    const pa = makeString(rig, a);
    const pb = makeString(rig, b);
    const r = rig.call("core.StrConcat", { hl: pa, de: pb, a: 0 }).hl;
    expect(readString(rig, r)).toBe(expected);
    expect(readString(rig, pa)).toBe(a);
    expect(readString(rig, pb)).toBe(b);
  });

  it("StrConcat frees the operands its flags name, after building the result", () => {
    for (const flags of [0, 1, 2, 3]) {
      const pa = makeString(rig, "abc");
      const pb = makeString(rig, "defg");
      const before = heapUsed(rig);
      const r = rig.call("core.StrConcat", { hl: pa, de: pb, a: flags }).hl;
      expect(readString(rig, r)).toBe("abcdefg");
      // --- A String's block is its length plus 4: the heap's size word and the String's length word
      const freed = (flags & 1 ? 7 : 0) + (flags & 2 ? 8 : 0);
      expect(heapUsed(rig), `flags ${flags}`).toBe(before + 11 - freed);
      rig.call("core.Free", { hl: r });
      if (!(flags & 1)) rig.call("core.Free", { hl: pa });
      if (!(flags & 2)) rig.call("core.Free", { hl: pb });
      expect(heapUsed(rig), "nothing leaked").toBe(0);
    }
  });

  it("StrConcat still frees its temporaries when the heap is full", () => {
    const big = makeString(rig, "x".repeat(1200));
    const pb = makeString(rig, "y".repeat(500));
    const r = rig.call("core.StrConcat", { hl: big, de: pb, a: 3 }).hl;
    expect(r).toBe(0);
    expect(heapUsed(rig)).toBe(0);
  });

  it("StrStore takes ownership and frees the variable's old value", () => {
    const v = rig.program.symbol("Var");
    const first = makeString(rig, "first");
    rig.call("core.StrStore", { hl: first, de: v });
    expect(rig.session.peekWord(v)).toBe(first);
    const second = makeString(rig, "second");
    rig.call("core.StrStore", { hl: second, de: v });
    expect(readString(rig, rig.session.peekWord(v))).toBe("second");
    expect(heapUsed(rig)).toBe(6 + 4);
    rig.call("core.StrStore", { hl: 0, de: v });
    expect(heapUsed(rig)).toBe(0);
  });

  it("StrCompare orders like an unsigned character comparison, prefixes first", () => {
    const words = ["", "a", "A", "ab", "abc", "abd", "b", "ba", "ÿ", "abc ", "Z"];
    for (const x of words) {
      for (const y of words) {
        const px = makeString(rig, x);
        const py = makeString(rig, y);
        const r = rig.call("core.StrCompare", { hl: px, de: py, a: 3 });
        const expected = x < y ? -1 : x > y ? 1 : 0;
        const got = r.a === 0xff ? -1 : r.a;
        expect(got, `${JSON.stringify(x)} vs ${JSON.stringify(y)}`).toBe(expected);
        expect(!!(r.f & 0x40), "Z when equal").toBe(expected === 0);
        expect(!!(r.f & 0x80), "S when less").toBe(expected < 0);
      }
    }
    expect(heapUsed(rig), "both operands freed every time").toBe(0);
  });
});
