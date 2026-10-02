import { describe, expect, it } from "vitest";
import { z88BankStorageOffset } from "@emu/machines/z88/Z88WasmV2Machine";

/**
 * `z88BankStorageOffset` is the core's `z88BankOffset` (z88-memory.c), which the memory views use to
 * find a bank's bytes. A card smaller than its slot is mirrored, so a bank is not `bank * 16K`.
 */
describe("z88BankStorageOffset", () => {
  // --- Slot 0: 512K ROM ($1F), internal RAM: 512K ($1F), slot 1: empty, slot 2: 32K ($01), slot 3: 1M ($3F)
  const masks = [0x1f, 0x00, 0x01, 0x3f, 0x1f];
  const chipMaskOf = (slot: number) => masks[slot];
  const bank = (b: number) => b * 0x4000;

  it.each([
    ["slot 0 maps itself", 0x00, 0x00],
    ["slot 0's top bank maps itself", 0x1f, 0x1f],
    ["internal RAM maps itself", 0x21, 0x21],
    ["an empty slot mirrors its first bank", 0x7f, 0x40],
    ["a 32K card's first bank maps itself", 0x80, 0x80],
    ["a 32K card mirrors odd banks onto its second bank", 0xbf, 0x81],
    ["a 32K card mirrors even banks onto its first bank", 0xbe, 0x80],
    ["a 1M card maps every bank to itself", 0xff, 0xff]
  ])("%s ($%s)", (_what, b, storage) => {
    expect(z88BankStorageOffset(b, chipMaskOf)).toBe(bank(storage));
  });

  it("mirrors a small internal RAM within $20-$3F", () => {
    expect(z88BankStorageOffset(0x3f, (slot) => (slot === 4 ? 0x07 : 0x1f))).toBe(bank(0x27));
  });
});
