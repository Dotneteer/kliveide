import { describe, expect, it } from "vitest";

import { NEXT_REG_DESCRIPTORS } from "@emu/machines/zxNext/nextRegDescriptors";
import { NEXT_REG_CATEGORIES } from "@common/zxnext/nextRegCategories";
import {
  baselineOf,
  bitOwners,
  bitSpans,
  buildGroups,
  categoriesByRegister,
  displayedValue,
  formatRegValue,
  isChanged,
  matchesFilter,
  nextRegInstruction,
  visibleIds
} from "@renderer/features/nextRegs/nextRegDocumentModel";
import { onNextRegReveal, requestNextRegReveal } from "@renderer/features/nextRegs/nextRegReveal";

const descriptors = NEXT_REG_DESCRIPTORS;
const byId = new Map(descriptors.map((d) => [d.id, d]));

describe("Next Registers document: grouping", () => {
  it("files every register exactly once by index, sixteen to a block", () => {
    const groups = buildGroups("index", descriptors);
    const ids = groups.flatMap((g) => g.ids);
    expect(ids).toEqual(descriptors.map((d) => d.id));
    for (const g of groups) {
      expect(g.ids.length).toBeGreaterThan(0);
      expect(g.ids.every((id) => id >= g.range!.from && id <= g.range!.to)).toBe(true);
      expect(g.range!.to - g.range!.from).toBe(15);
    }
  });

  it("files every register under at least one category", () => {
    const groups = buildGroups("category", descriptors);
    const seen = new Set(groups.flatMap((g) => g.ids));
    expect(seen.size).toBe(descriptors.length);
    // --- The book's table covers every documented register today, so there is no Other group
    expect(groups.some((g) => g.category!.id === "other")).toBe(false);
    // --- Only documented registers are listed, so a book entry with no descriptor cannot show an empty row
    expect(groups.flatMap((g) => g.ids).every((id) => byId.has(id))).toBe(true);
  });

  it("lists a register in every category the book files it under", () => {
    const categories = categoriesByRegister(descriptors);
    expect(categories.get(0x69)).toEqual(["layer2", "ula"]);
    expect(categories.get(0x06)).toEqual(["audio", "peripherals"]);
    expect(categories.get(0x52)).toEqual(["memory"]);
  });

  it("puts a register no category lists in Other, last", () => {
    const listed = new Set(NEXT_REG_CATEGORIES.flatMap((c) => c.regs));
    expect(listed.has(0xee)).toBe(false);
    const withNew = [...descriptors, { id: 0xee, description: "Not in the book" }];
    const groups = buildGroups("category", withNew);
    expect(groups.at(-1)!.category!.id).toBe("other");
    expect(groups.at(-1)!.ids).toEqual([0xee]);
    expect(categoriesByRegister(withNew).get(0xee)).toEqual(["other"]);
  });

  it("gives each category its own message keys", () => {
    const keys = NEXT_REG_CATEGORIES.flatMap((c) => [c.nameKey, c.descriptionKey]);
    expect(new Set(keys).size).toBe(keys.length);
  });
});

describe("Next Registers document: bits and values", () => {
  it("formats a byte as hex, decimal or binary", () => {
    expect(formatRegValue(0x3a, "hex")).toBe("$3A");
    expect(formatRegValue(0x3a, "dec")).toBe("58");
    expect(formatRegValue(0x3a, "bin")).toBe("0011 1010");
  });

  it("writes the nextreg instruction for a value", () => {
    expect(nextRegInstruction(0x15, 0x0b)).toBe("nextreg $15, $0B");
  });

  it("decodes a write-only register from its last write", () => {
    expect(displayedValue({ id: 1, value: 3, lastWrite: 4 })).toBe(3);
    expect(displayedValue({ id: 1, lastWrite: 4 })).toBe(4);
    expect(displayedValue(undefined)).toBeUndefined();
  });

  it("splits Reg $15 into its documented fields, bit 7 first", () => {
    const reg = byId.get(0x15)!;
    const owners = bitOwners(reg);
    // --- Bits 4:2 are the layer priority field: one owner across three bits
    expect(owners[4]).toBe(owners[3]);
    expect(owners[3]).toBe(owners[2]);
    expect(owners[1]).not.toBe(owners[2]);
    const spans = bitSpans(reg);
    expect(spans.map((s) => [s.high, s.low])).toEqual([[7, 7], [6, 6], [5, 5], [4, 2], [1, 1], [0, 0]]);
  });

  it("treats a register without slices as eight unowned bits", () => {
    const plain = descriptors.find((d) => !d.slices?.length)!;
    expect(bitOwners(plain)).toEqual(new Array(8).fill(-1));
    expect(bitSpans(plain)).toEqual([{ owner: -1, high: 7, low: 0 }]);
  });
});

describe("Next Registers document: filtering and changes", () => {
  const reg15 = byId.get(0x15)!;

  it("matches a prefixed register number only by number", () => {
    expect(matchesFilter(reg15, "$15")).toBe(true);
    expect(matchesFilter(reg15, "0x15")).toBe(true);
    expect(matchesFilter(reg15, "#15")).toBe(true);
    expect(matchesFilter(byId.get(0x16)!, "$15")).toBe(false);
  });

  it("matches names, field texts and category names", () => {
    expect(matchesFilter(reg15, "sprite")).toBe(true);
    expect(matchesFilter(reg15, "LORES")).toBe(true);
    expect(matchesFilter(reg15, "layer system", ["Layer system"])).toBe(true);
    expect(matchesFilter(reg15, "copper")).toBe(false);
  });

  it("marks a register changed only against a baseline that had it", () => {
    const baseline = baselineOf([{ id: 0x15, value: 1 }, { id: 0x16, value: 2 }, { id: 0x17 }]);
    expect(isChanged({ id: 0x15, value: 3 }, baseline)).toBe(true);
    expect(isChanged({ id: 0x16, value: 2 }, baseline)).toBe(false);
    expect(isChanged({ id: 0x17, value: 9 }, baseline)).toBe(false);
    expect(isChanged({ id: 0x15, value: 3 }, undefined)).toBe(false);
  });

  it("lets the switches and the filter narrow a group", () => {
    const group = buildGroups("index", descriptors).find((g) => g.range!.from === 0x10)!;
    const states = new Map([
      [0x15, { id: 0x15, value: 5, lastWrite: 5 }],
      [0x16, { id: 0x16, value: 0 }]
    ]);
    const base = {
      descriptors: byId,
      states,
      baseline: baselineOf([{ id: 0x15, value: 4 }, { id: 0x16, value: 0 }]),
      filter: "",
      changedOnly: false,
      writtenOnly: false,
      categoryNamesOf: () => []
    };
    expect(visibleIds(group, base)).toEqual(group.ids);
    expect(visibleIds(group, { ...base, changedOnly: true })).toEqual([0x15]);
    expect(visibleIds(group, { ...base, writtenOnly: true })).toEqual([0x15]);
    expect(visibleIds(group, { ...base, filter: "$16" })).toEqual([0x16]);
  });
});

describe("Next Registers document: reveal requests", () => {
  it("holds a request until the document listens", () => {
    requestNextRegReveal(0x152);
    const seen: number[] = [];
    const unsubscribe = onNextRegReveal((id) => seen.push(id));
    requestNextRegReveal(0x07);
    unsubscribe();
    expect(seen).toEqual([0x52, 0x07]);
  });
});
