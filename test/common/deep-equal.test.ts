import { describe, expect, it } from "vitest";

import { deepEqual } from "@common/utils/deep-equal";

describe("deepEqual", () => {
  it.each([
    ["identical primitives", 42, 42],
    ["identical strings", "klive", "klive"],
    ["both null", null, null],
    ["both undefined", undefined, undefined],
    ["NaN with NaN", NaN, NaN],
    ["empty objects", {}, {}],
    ["empty arrays", [], []],
    ["flat objects", { a: 1, b: "x" }, { a: 1, b: "x" }],
    ["objects with different key order", { a: 1, b: 2 }, { b: 2, a: 1 }],
    ["nested structures", { a: [1, { b: [2, 3] }] }, { a: [1, { b: [2, 3] }] }],
    // --- A missing key and an explicit undefined survive a JSON round trip the same way
    ["a missing key and an explicit undefined", { a: 1 }, { a: 1, b: undefined }]
  ])("reports %s as equal", (_title, a, b) => {
    expect(deepEqual(a, b)).toBe(true);
    expect(deepEqual(b, a)).toBe(true);
  });

  it.each([
    ["different numbers", 1, 2],
    ["a number and its string form", 1, "1"],
    ["null and undefined", null, undefined],
    ["null and an object", null, {}],
    ["an object and an array", {}, []],
    ["objects differing in a value", { a: 1 }, { a: 2 }],
    ["objects differing in a key", { a: 1 }, { b: 1 }],
    ["an extra defined key", { a: 1 }, { a: 1, b: 2 }],
    ["arrays of different length", [1, 2], [1, 2, 3]],
    ["arrays differing in order", [1, 2], [2, 1]],
    ["nested structures differing deep down", { a: [1, { b: [2, 3] }] }, { a: [1, { b: [2, 4] }] }],
    ["zero and false", 0, false]
  ])("reports %s as different", (_title, a, b) => {
    expect(deepEqual(a, b)).toBe(false);
    expect(deepEqual(b, a)).toBe(false);
  });

  it("compares non-plain objects by reference only", () => {
    const date = new Date(0);

    expect(deepEqual(date, date)).toBe(true);
    expect(deepEqual(new Date(0), new Date(0))).toBe(false);
    expect(deepEqual(new Map([["a", 1]]), new Map([["a", 1]]))).toBe(false);
  });

  it("compares a realistic document workspace", () => {
    const workspace = {
      version: 2,
      layout: { type: "area", areaId: "document-area-1" },
      activeAreaId: "document-area-1",
      areas: [
        {
          areaId: "document-area-1",
          documents: [
            { type: "code", id: "/p/code.asm", position: { line: 3, column: 0 } },
            { type: "code", id: "/p/klive.project", position: { line: 0, column: 0 } }
          ],
          activeDocumentId: "/p/code.asm"
        }
      ]
    };
    const rebuilt = JSON.parse(JSON.stringify(workspace));
    const moved = JSON.parse(JSON.stringify(workspace));
    moved.areas[0].documents[0].position.line = 4;

    expect(deepEqual(workspace, rebuilt)).toBe(true);
    expect(deepEqual(workspace, moved)).toBe(false);
  });
});
