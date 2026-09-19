import { describe, expect, it } from "vitest";

import { NextRegDevice } from "@emu/machines/zxNext/NextRegDevice";
import { NEXT_REG_DESCRIPTORS, getNextRegDescriptor } from "@emu/machines/zxNext/nextRegDescriptors";

/*
 * The static NextReg documentation (`nextRegDescriptors.ts`) is what both cores' IDE interface, the
 * disassembler and the panels read. It was generated from the TypeScript `NextRegDevice`, which still
 * builds its own copy next to its read/write functions; this keeps the two in step for as long as the
 * TypeScript core exists (see `.plans/ZX_SPECTRUM_NEXT_TYPESCRIPT_REMOVAL_PLAN.md`, Step 3).
 */

/** The device's descriptors as the static table spells them: holes dropped, false flags omitted. */
function deviceDescriptors() {
  return new NextRegDevice(null as never)
    .getDescriptors()
    .filter((d) => d != null)
    .map(({ id, description, isReadOnly, isWriteOnly, slices }) => ({
      id,
      description,
      ...(isReadOnly ? { isReadOnly } : {}),
      ...(isWriteOnly ? { isWriteOnly } : {}),
      ...(slices ? { slices } : {})
    }));
}

describe("NextReg descriptors", () => {
  it("the static table matches the TypeScript NextRegDevice, register for register", () => {
    expect(NEXT_REG_DESCRIPTORS).toEqual(deviceDescriptors());
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
