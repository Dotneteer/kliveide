import { MachineControllerState } from "@abstractions/MachineControllerState";
import { describe, expect, it } from "vitest";
import {
  buildPointedRegisterHints,
  convertTopIndexForViewMode,
  createRowAddresses,
  createSegmentOptions,
  getByteCount,
  getBytesPerRow,
  getDefaultSegment,
  resolveMemoryPartition,
  resolveViewMode,
  usesTwoColumns
} from "@renderer/features/memory/memoryViewModel";

describe("memoryViewModel", () => {
  it("resolves persisted view modes and legacy two-column state", () => {
    expect(resolveViewMode("8x1", true)).toBe("8x1");
    expect(resolveViewMode("8x2", false)).toBe("8x2");
    expect(resolveViewMode("16x1", true)).toBe("16x1");
    expect(resolveViewMode(undefined, false)).toBe("8x1");
    expect(resolveViewMode(undefined, true)).toBe("8x2");
    expect(resolveViewMode("legacy", undefined)).toBe("8x2");
  });

  it("derives layout characteristics from the view mode", () => {
    expect(getBytesPerRow("8x1")).toBe(8);
    expect(getBytesPerRow("8x2")).toBe(16);
    expect(getBytesPerRow("16x1")).toBe(16);
    expect(getByteCount("8x1")).toBe(8);
    expect(getByteCount("8x2")).toBe(8);
    expect(getByteCount("16x1")).toBe(16);
    expect(usesTwoColumns("8x2")).toBe(true);
    expect(usesTwoColumns("16x1")).toBe(false);
  });

  it("creates row addresses for the specified memory length and row width", () => {
    expect(createRowAddresses(0x20, 8)).toEqual([0x00, 0x08, 0x10, 0x18]);
    expect(createRowAddresses(0x20, 16)).toEqual([0x00, 0x10]);
    expect(createRowAddresses(0, 16)).toEqual([]);
  });

  it("converts top index when switching between 8-byte and 16-byte rows", () => {
    expect(convertTopIndexForViewMode(9, "8x1", "8x2")).toBe(4);
    expect(convertTopIndexForViewMode(4, "8x2", "8x1")).toBe(8);
    expect(convertTopIndexForViewMode(4, "8x2", "16x1")).toBe(4);
  });

  it("creates bank and ROM segment options in current display order", () => {
    expect(createSegmentOptions({ [-2]: "rom1", [-1]: "rom0", 0: "bank0", 3: "bank3" }, 8))
      .toEqual([
        { value: "-1", label: "ROM 0" },
        { value: "-2", label: "ROM 1" },
        { value: "0", label: "BANK 0" },
        { value: "3", label: "BANK 3" }
      ]);
    expect(createSegmentOptions({ 0: "bank0" }, 9)).toEqual([]);
  });

  it("derives default segment and refresh partition", () => {
    expect(getDefaultSegment(0)).toBe(0);
    expect(getDefaultSegment(2)).toBe(-1);
    expect(resolveMemoryPartition({ isFullView: true, currentSegment: 3 })).toBeUndefined();
    expect(resolveMemoryPartition({ isFullView: false, currentSegment: 3 })).toBe(3);
    expect(resolveMemoryPartition({ isFullView: false, currentSegment: NaN })).toBe(-1);
  });

  it("builds pointed register hints only while the machine is paused or stopped", () => {
    const response = {
      bc: 0x1000,
      de: 0x1000,
      hl: 0x2000,
      bc_: 0x3000,
      de_: 0x4000,
      hl_: 0x5000,
      pc: 0x6000,
      sp: 0x7000,
      ix: 0x8000,
      iy: 0x9000,
      ir: 0xa000,
      wz: 0xb000
    };

    expect(buildPointedRegisterHints(response, MachineControllerState.Running)).toEqual({});
    expect(buildPointedRegisterHints(response, MachineControllerState.Paused)).toMatchObject({
      0x1000: "BC, DE",
      0x6000: "PC",
      0x7000: "SP",
      0xb000: "WZ"
    });
  });
});
