import { describe, it, expect } from "vitest";

import { bankSpaceFor, bankSpaceForAnnotationMachine, ht1080zBankSpace } from "@common/annotations/bankSpace";
import { MC_MEM_SIZE, MI_HT1080Z } from "@common/machines/constants";
import { annotationRoutineLabels, createAddressSymbols } from "@renderer/appIde/annotations/symbolResolver";
import type { RomLayer } from "@renderer/appIde/annotations/romLayer";

/*
 * The HT-1080Z's bank space: two ROM pages at fixed addresses, the BASIC (-1, $0000-$2FFF) and the
 * extension (-2, $3000-$37FF), each counted from its own start, so each file's ROM annotations land
 * at the right addresses; RAM from $4000 as 16K blocks; nothing paged.
 */

function romLayer(labels: { name: string; value: number }[]): RomLayer {
  return {
    kind: "shipped",
    path: "roms/x.rom.dis",
    origin: "ROM: x.rom",
    page: 0,
    annotations: {
      schemaVersion: 3,
      machine: "rom",
      banks: { "0": { offsetIndex: 0, regions: [{ start: 0, end: 0x3fff, type: "disassemble" }], localLabels: labels } }
    }
  };
}

describe("the HT-1080Z bank space", () => {
  const space = ht1080zBankSpace(16);

  it("puts the BASIC and the extension ROM in pages of their own, counted from their starts", () => {
    expect(space.siteAt(0x0000, undefined)).toEqual({ kind: "rom", partition: -1, offset: 0 });
    expect(space.siteAt(0x2fff, undefined)).toEqual({ kind: "rom", partition: -1, offset: 0x2fff });
    expect(space.siteAt(0x3000, undefined)).toEqual({ kind: "rom", partition: -2, offset: 0 });
    expect(space.siteAt(0x37ff, undefined)).toEqual({ kind: "rom", partition: -2, offset: 0x07ff });
    expect(space.romBase?.(-1)).toBe(0x0000);
    expect(space.romBase?.(-2)).toBe(0x3000);
  });

  it("annotates neither the keyboard nor the video RAM, and RAM only as far as the model has it", () => {
    expect(space.siteAt(0x3800, undefined)).toBeUndefined();
    expect(space.siteAt(0x3c00, undefined)).toBeUndefined();
    expect(space.siteAt(0x4000, undefined)).toEqual({ kind: "bank", bank: 1, offset: 0 });
    expect(space.siteAt(0x8000, undefined)).toBeUndefined();
    expect(space.ramBanks).toEqual([1]);
    expect(ht1080zBankSpace(48).siteAt(0xffff, undefined)).toEqual({ kind: "bank", bank: 3, offset: 0x3fff });
    expect(space.addressesOf({ bank: 1, offset: 0x0100 }, undefined)).toEqual([0x4100]);
    expect(space.addressesOf({ bank: 2, offset: 0x0100 }, undefined)).toEqual([]);
  });

  it("has no paging, so no bank breakpoints", () => {
    expect(space.bankBreakpoints).toBe(false);
    expect(space.partitionOf({ bank: 1, offset: 0 })).toBeUndefined();
  });

  it("is chosen by machine id, its RAM size from the model's configuration", () => {
    expect(bankSpaceFor(MI_HT1080Z, { [MC_MEM_SIZE]: 16 })?.ramBanks).toEqual([1]);
    expect(bankSpaceFor(MI_HT1080Z, { [MC_MEM_SIZE]: 48 })?.ramBanks).toEqual([1, 2, 3]);
    expect(bankSpaceFor(MI_HT1080Z)?.id).toBe("ht1080z");
    expect(bankSpaceForAnnotationMachine("ht1080z")?.id).toBe("ht1080z");
  });

  it("names the extension ROM's addresses from its own page's labels", () => {
    const layers = (partition: number) =>
      partition === -1
        ? [romLayer([{ name: "POWER_ON", value: 0 }])]
        : partition === -2
          ? [romLayer([{ name: "EXT_ENTRY", value: 0x0005 }])]
          : [];
    const symbols = createAddressSymbols({ bankSpace: space, romLayersOf: layers });
    expect(symbols.labelAt(0x0000, undefined)?.name).toBe("POWER_ON");
    expect(symbols.labelAt(0x3005, undefined)?.name).toBe("EXT_ENTRY");
    expect(symbols.labelAt(0x0005, undefined)).toBeUndefined();
    expect(annotationRoutineLabels({ bankSpace: space, romLayersOf: layers }, [-1, -2])).toEqual([
      { name: "POWER_ON", address: 0x0000 },
      { name: "EXT_ENTRY", address: 0x3005 }
    ]);
  });
});
