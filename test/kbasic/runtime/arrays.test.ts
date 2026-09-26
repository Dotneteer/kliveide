import { beforeEach, describe, expect, it } from "vitest";

import { createRuntimeRig, heapUsed, makeString, type RuntimeRig } from "./runtime-kit";

const USES = ["ArrayAddress", "ArrayAlloc", "ArrayFreeStrings", "ArrayLBound", "ArrayUBound", "StrAlloc", "Free"];

/** Pushes Count words from Indices (the first first) and calls ArrayAddress on the descriptor at Desc. */
const EXTRA = [
  "Index:",
  "    ld a,(Count)",
  "    ld b,a",
  "    ld hl,Indices",
  "IndexPush:",
  "    ld e,(hl)",
  "    inc hl",
  "    ld d,(hl)",
  "    inc hl",
  "    push de",
  "    djnz IndexPush",
  "    ld hl,Desc",
  "    ld a,(Count)",
  "    call core.ArrayAddress",
  "    ret",
  "Count:",
  "    .defb 0",
  "Indices:",
  "    .defs 16",
  "Desc:",
  "    .defs 8",
  "Tables:",
  "    .defs 32"
].join("\n");

describe("Klive BASIC runtime - arrays", () => {
  let rig: RuntimeRig;
  beforeEach(async () => {
    rig = await createRuntimeRig({ uses: USES, layout: { heapSize: 1000 }, extra: EXTRA });
  });

  /** Writes a descriptor for bounds [lower, upper] per dimension; returns the data address. */
  function describeArray(bounds: [number, number][], size: number, withLower: boolean): number {
    const s = rig.session;
    const desc = rig.program.symbol("Desc");
    const tables = rig.program.symbol("Tables");
    const data = 0xc000;
    // --- The dimension table: n - 1, the counts of dimensions 2..n, the element size
    const dims = tables;
    s.pokeWord(dims, bounds.length - 1);
    bounds.slice(1).forEach(([lo, hi], i) => s.pokeWord(dims + 2 + 2 * i, hi - lo + 1));
    s.poke(dims + 2 * bounds.length, [size]);
    const lower = tables + 16;
    bounds.forEach(([lo], i) => s.pokeWord(lower + 2 * i, lo));
    s.pokeWord(desc, dims);
    s.pokeWord(desc + 2, data);
    s.pokeWord(desc + 4, withLower ? lower : 0);
    s.pokeWord(desc + 6, 0);
    return data;
  }

  function address(indices: number[]): number {
    const s = rig.session;
    s.poke(rig.program.symbol("Count"), [indices.length]);
    indices.forEach((v, i) => s.pokeWord(rig.program.symbol("Indices") + 2 * i, v));
    return rig.call("Index").hl;
  }

  it("addresses a one-dimensional array from 0", () => {
    const data = describeArray([[0, 9]], 2, false);
    for (const i of [0, 1, 7, 9]) expect(address([i])).toBe(data + 2 * i);
  });

  it("addresses a three-dimensional array row-major, the last subscript fastest", () => {
    const bounds: [number, number][] = [[0, 2], [0, 3], [0, 4]];
    const data = describeArray(bounds, 1, false);
    for (const [i, j, k] of [[0, 0, 0], [0, 0, 1], [0, 1, 0], [1, 0, 0], [2, 3, 4], [1, 2, 3]]) {
      expect(address([i, j, k]), `(${i}, ${j}, ${k})`).toBe(data + (i * 4 + j) * 5 + k);
    }
  });

  it("subtracts the lower bounds when the descriptor has them", () => {
    const bounds: [number, number][] = [[1, 3], [5, 8]];
    const data = describeArray(bounds, 4, true);
    for (const [i, j] of [[1, 5], [1, 6], [2, 5], [3, 8]]) {
      expect(address([i, j]), `(${i}, ${j})`).toBe(data + 4 * ((i - 1) * 4 + (j - 5)));
    }
  });

  it("ArrayLBound and ArrayUBound read the bound tables; dimension 0 is the number of dimensions", () => {
    describeArray([[1, 3], [5, 8]], 1, true);
    const desc = rig.program.symbol("Desc");
    const upper = rig.program.symbol("Tables") + 24;
    rig.session.pokeWord(upper, 3).pokeWord(upper + 2, 8).pokeWord(desc + 6, upper);
    expect([0, 1, 2].map((d) => rig.call("core.ArrayLBound", { hl: desc, de: d }).hl)).toEqual([2, 1, 5]);
    expect([1, 2].map((d) => rig.call("core.ArrayUBound", { hl: desc, de: d }).hl)).toEqual([3, 8]);
    rig.session.pokeWord(desc + 4, 0);
    expect(rig.call("core.ArrayLBound", { hl: desc, de: 2 }).hl, "no lower-bound table").toBe(0);
  });

  it("ArrayAlloc gives cleared heap memory", () => {
    const s = rig.session;
    const first = rig.call("core.ArrayAlloc", { hl: 10 }).hl;
    s.poke(first, Array(10).fill(0xaa));
    rig.call("core.Free", { hl: first });
    const again = rig.call("core.ArrayAlloc", { hl: 10 }).hl;
    expect(Array.from({ length: 10 }, (_, i) => s.peek(again + i))).toEqual(Array(10).fill(0));
    rig.call("core.Free", { hl: again });
    expect(heapUsed(rig)).toBe(0);
  });

  it("ArrayFreeStrings frees every element, the empty ones too, then the data", () => {
    const s = rig.session;
    const data = rig.call("core.ArrayAlloc", { hl: 8 }).hl;
    s.pokeWord(data, makeString(rig, "one"));
    s.pokeWord(data + 4, makeString(rig, "three"));
    s.pokeWord(data + 6, makeString(rig, "four!"));
    expect(heapUsed(rig)).toBeGreaterThan(0);
    rig.call("core.ArrayFreeStrings", { hl: data, bc: 4 });
    expect(heapUsed(rig)).toBe(0);
  });
});
