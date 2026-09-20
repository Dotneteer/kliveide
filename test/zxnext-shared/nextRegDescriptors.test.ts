import { describe, expect, it } from "vitest";

import { NEXT_REG_DESCRIPTORS, getNextRegDescriptor } from "@emu/machines/zxNext/nextRegDescriptors";

/*
 * The static NextReg documentation (`nextRegDescriptors.ts`) is what the machine's IDE interface,
 * the disassembler and the panels read. It was generated from the TypeScript `NextRegDevice`'s own
 * descriptor table, and an equivalence test held the two in step until that device was deleted
 * (`.plans/ZX_SPECTRUM_NEXT_TYPESCRIPT_REMOVAL_PLAN.md`, Steps 3 and 13). The table is now the
 * single source; what is left to check is its shape, which the panels and the disassembler assume.
 */

describe("NextReg descriptors", () => {
  it("documents the registers the Next implements, and each one once", () => {
    // --- 141 registers at the generation; a count is the cheapest guard against a botched edit
    // --- dropping or duplicating a block of the table.
    expect(NEXT_REG_DESCRIPTORS).toHaveLength(141);
    expect(NEXT_REG_DESCRIPTORS.every((d) => d.id >= 0 && d.id <= 0xff)).toBe(true);
    expect(NEXT_REG_DESCRIPTORS.every((d) => d.description.length > 0)).toBe(true);
    // --- A register is not both read-only and write-only
    expect(NEXT_REG_DESCRIPTORS.some((d) => d.isReadOnly && d.isWriteOnly)).toBe(false);
  });

  it("keeps every slice inside its byte and says something about it", () => {
    // --- `NextRegPanel` masks and shifts a byte with these, then labels the result from
    // --- `description` or `valueSet`; a slice with neither renders an unexplained number.
    for (const descriptor of NEXT_REG_DESCRIPTORS) {
      for (const [index, slice] of (descriptor.slices ?? []).entries()) {
        const label = `$${descriptor.id.toString(16).padStart(2, "0")} slice ${index}`;
        expect(slice.mask ?? 0xff, label).toBeGreaterThan(0);
        expect(slice.mask ?? 0xff, label).toBeLessThanOrEqual(0xff);
        expect(slice.shift ?? 0, label).toBeGreaterThanOrEqual(0);
        expect(slice.shift ?? 0, label).toBeLessThanOrEqual(7);
        expect(
          slice.description != null || slice.valueSet != null,
          `${label} has neither a description nor a value set`
        ).toBe(true);
      }
    }
  });

  it("is in register order with no duplicates", () => {
    const ids = NEXT_REG_DESCRIPTORS.map((d) => d.id);
    expect(ids).toEqual([...new Set(ids)].sort((a, b) => a - b));
  });

  it("looks a register up by id, and knows no unimplemented one", () => {
    expect(getNextRegDescriptor(0x07)?.description).toBe(NEXT_REG_DESCRIPTORS.find((d) => d.id === 0x07)?.description);
    expect(getNextRegDescriptor(0x0d)).toBeUndefined();
  });
});
