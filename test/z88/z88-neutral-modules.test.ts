import { describe, expect, it } from "vitest";

import { MemorySectionType } from "@abstractions/MemorySection";
import {
  parseZ88PartitionLabel,
  resolveZ88KeyboardLayout,
  Z88_BASE_CLOCK_FREQUENCY,
  Z88_TACTS_IN_FRAME,
  Z88_UI_FRAME_FREQUENCY,
  z88DisassemblySections,
  z88PartitionDescriptions,
  z88PartitionGroups,
  z88PartitionLabels,
  z88RomFlags
} from "@emu/machines/z88/z88MachineInfo";
import {
  z88CardSizeInBytes,
  z88ChipMaskForSize,
  z88InternalRamSizeInBytes
} from "@emu/machines/z88/z88CardCatalog";
import { Z88Machine } from "@emu/machines/z88/Z88Machine";
import { machineRegistry } from "@common/machines/machine-registry";

/*
 * The neutral Z88 modules both backends share (Step 0.1 of
 * `.plans/CAMBRIDGE_Z88_WASM_MIGRATION_PLAN.md`), and the TypeScript machine's use of them.
 */

describe("z88MachineInfo", () => {
  it("a frame is 5 ms of the 3.2768 MHz clock, and the UI refreshes every 8th frame", () => {
    expect(Z88_BASE_CLOCK_FREQUENCY).toBe(3_276_800);
    expect(Z88_TACTS_IN_FRAME).toBe(16_384);
    expect(Z88_TACTS_IN_FRAME / Z88_BASE_CLOCK_FREQUENCY).toBe(0.005);
    expect(Z88_UI_FRAME_FREQUENCY).toBe(8);
  });

  it.each([
    ["uk", "uk"],
    ["de", "de"],
    ["fr", "fr"],
    ["es", "es"],
    ["it", "it"],
    ["dk", "dk"],
    ["se", "se"],
    ["us", "uk"],
    [undefined, "uk"],
    [42, "uk"]
  ])("keyboard layout %s resolves to %s", (configured, expected) => {
    expect(resolveZ88KeyboardLayout(configured)).toBe(expected);
  });

  it("names all 256 banks with two hex digits", () => {
    const labels = z88PartitionLabels();
    expect(Object.keys(labels)).toHaveLength(256);
    expect(labels[0x00]).toBe("00");
    expect(labels[0x3f]).toBe("3F");
    expect(labels[0xff]).toBe("FF");
    expect(z88PartitionGroups()[0x80]).toBe("RAM Banks");
    expect(z88PartitionDescriptions()[0xc2]).toBe("Bank $C2");
  });

  it.each([
    ["0", 0x00],
    ["3f", 0x3f],
    ["FF", 0xff],
    ["100", undefined],
    ["G1", undefined],
    ["", undefined]
  ])("parses partition label '%s' as %s", (label, expected) => {
    expect(parseZ88PartitionLabel(label)).toBe(expected);
  });

  it("no 8K page is ROM", () => {
    expect(z88RomFlags()).toEqual(new Array(8).fill(false));
  });

  it("keeps the (Spectrum-shaped) disassembly sections verbatim - follow-up F3", () => {
    const d = MemorySectionType.Disassemble;
    expect(z88DisassemblySections({})).toEqual([{ startAddress: 0, endAddress: 0x3fff, sectionType: d }]);
    expect(z88DisassemblySections({ ram: true })).toEqual([
      { startAddress: 0, endAddress: 0x3fff, sectionType: d },
      { startAddress: 0x5b00, endAddress: 0xffff, sectionType: d }
    ]);
    expect(z88DisassemblySections({ screen: true })).toEqual([
      { startAddress: 0, endAddress: 0x3fff, sectionType: d },
      { startAddress: 0x4000, endAddress: 0x5aff, sectionType: d }
    ]);
    expect(z88DisassemblySections({ ram: true, screen: true })).toEqual([
      { startAddress: 0, endAddress: 0xffff, sectionType: d }
    ]);
  });
});

describe("z88CardCatalog", () => {
  it.each([32, 64, 128, 256, 512, 1024])("a %dK card is %dK * 1024 bytes", (sizeK) => {
    expect(z88CardSizeInBytes(sizeK)).toBe(sizeK * 1024);
  });

  it.each([0, 16, 2048])("rejects a %dK card", (sizeK) => {
    expect(() => z88CardSizeInBytes(sizeK)).toThrow(`Invalid card size: ${sizeK}`);
  });

  it.each([
    [0x00_0000, 0x00],
    [0x00_8000, 0x01],
    [0x01_0000, 0x03],
    [0x02_0000, 0x07],
    [0x04_0000, 0x0f],
    [0x08_0000, 0x1f],
    [0x10_0000, 0x3f]
  ])("a card of %d bytes decodes chip mask %d", (size, mask) => {
    expect(z88ChipMaskForSize(size)).toBe(mask);
  });

  it("rejects a size no card has", () => {
    expect(() => z88ChipMaskForSize(0x1_2345)).toThrow("Invalid memory card size");
  });

  it.each([
    [0x00, 0x00_0000],
    [0x01, 0x00_8000],
    [0x03, 0x01_0000],
    [0x07, 0x02_0000],
    [0x0f, 0x04_0000],
    [0x1f, 0x08_0000],
    [undefined, 0x08_0000],
    [0x55, 0x08_0000]
  ])("internal RAM mask %s selects %d bytes", (mask, size) => {
    expect(z88InternalRamSizeInBytes(mask)).toBe(size);
  });
});

describe("Z88Machine uses the neutral modules", () => {
  it("takes its clock, frame, UI cadence and partition answers from them", () => {
    const model = machineRegistry.find((m) => m.machineId === "z88").models[0];
    const machine = new Z88Machine(model, model.config, undefined);
    expect(machine.baseClockFrequency).toBe(Z88_BASE_CLOCK_FREQUENCY);
    expect(machine.tactsInFrame).toBe(Z88_TACTS_IN_FRAME);
    expect(machine.uiFrameFrequency).toBe(Z88_UI_FRAME_FREQUENCY);
    expect(machine.getPartitionLabels()).toEqual(z88PartitionLabels());
    expect(machine.parsePartitionLabel("2a")).toBe(0x2a);
    expect(machine.getRomFlags()).toEqual(z88RomFlags());
    expect(machine.getSelectedRomPage()).toBe(0);
    expect(machine.getSelectedRamBank()).toBe(0);
  });
});
