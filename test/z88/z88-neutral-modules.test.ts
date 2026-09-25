import { describe, expect, it } from "vitest";

import { MemorySectionType } from "@abstractions/MemorySection";
import {
  parseZ88PartitionLabel,
  resolveZ88KeyboardLayout,
  Z88_BASE_CLOCK_FREQUENCY,
  Z88_TACTS_IN_FRAME,
  Z88_UI_FRAME_FREQUENCY,
  z88DisassemblySections,
  z88LcdSizeRegisters,
  z88PartitionDescriptions,
  z88PartitionGroups,
  z88PartitionLabels,
  z88RomFlags
} from "@emu/machines/z88/z88MachineInfo";
import {
  z88CardSizeInBytes,
  z88CardSpec,
  z88ChipMaskForSize,
  z88InternalRamSizeInBytes,
  z88RomImageCardSpec,
  z88SlotHasCard
} from "@emu/machines/z88/z88CardCatalog";
import { CardIds } from "@emu/machines/z88/CardIds";
import { goldens } from "../wasm/z88/z88-goldens";

/*
 * The Z88 machine info and card catalog the machine and the renderer share (Step 0.1 of
 * `.plans/CAMBRIDGE_Z88_WASM_MIGRATION_PLAN.md`).
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

  it("disassembles the whole 64K, whatever the view's (hidden) RAM and Screen options - F3", () => {
    // --- The Z88's 64K is four paged segments: no ROM/RAM/screen split as on the Spectrum. The
    // --- Spectrum ranges it used to answer left $4000-$5AFF out with the view's defaults (ram, no screen).
    const whole = [{ startAddress: 0, endAddress: 0xffff, sectionType: MemorySectionType.Disassemble }];
    for (const options of [{}, { ram: true }, { screen: true }, { ram: true, screen: true }]) {
      expect(z88DisassemblySections(options), JSON.stringify(options)).toEqual(whole);
    }
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

describe("z88CardSpec / z88SlotHasCard / z88RomImageCardSpec (the slot rules)", () => {
  /*
   * What the TypeScript card factory (`createZ88MemoryCard`) made of every card id and size - the
   * card kind and size, or its error - recorded before it was removed
   * (`test/wasm/z88/goldens/z88-card-factory.json`, `.plans/CAMBRIDGE_Z88_TYPESCRIPT_REMOVAL_PLAN.md`).
   */
  const factory = goldens("z88-card-factory");

  it.each(Object.values(CardIds).flatMap((id) => [32, 128, 256, 512, 1024, 48].map((size) => [id, size] as const)))(
    "%s of %iK: the spec is the card the TypeScript factory made",
    (id, size) => {
      let spec: unknown;
      try {
        spec = z88CardSpec(id, size);
      } catch (e) {
        spec = { error: (e as Error).message };
      }
      factory.expect(`${id} ${size}K`, spec);
    }
  );

  it("the card dialog's 256K UV EPROM (EPROMUV256) is a 256K UV EPROM (F2)", () => {
    expect(z88CardSpec(CardIds.EPROMUV256, 256)).toEqual({ kind: "UV_EPROM", sizeInBytes: 0x4_0000 });
  });

  it.each([
    [undefined, false],
    [null, false],
    [{ cardType: "RAM32" }, false],
    [{ size: 32, cardType: "-" }, false],
    [{ size: 32, cardType: "RAM32" }, true],
    [{ size: 0, cardType: "ROM" }, true]
  ])("slot %j has a card: %s", (slot, expected) => {
    expect(z88SlotHasCard(slot as any)).toBe(expected);
  });

  it("a ROM image without a slot-0 configuration is a ROM card of the image's size", () => {
    expect(z88RomImageCardSpec(0x2_0000)).toEqual({ kind: "ROM", sizeInBytes: 0x2_0000 });
    expect(() => z88RomImageCardSpec(0x2_0001)).toThrow("Invalid memory card size");
  });
});

describe("z88LcdSizeRegisters (the LCD size rule)", () => {
  // --- The SCW/SCH the TypeScript screen device set for each configured size
  it.each([
    [undefined, 0xff, 8],
    ["640x64", 0xff, 8],
    ["640x320", 0xff, 40],
    ["640x480", 0xff, 60],
    ["800x320", 100, 40],
    ["800x480", 100, 60],
    ["1024x768", 0xff, 8]
  ])("%s: SCW %i, SCH %i", (size, scw, sch) => {
    expect(z88LcdSizeRegisters(size)).toEqual({ scw, sch });
  });
});
