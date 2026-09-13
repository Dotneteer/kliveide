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

  it("labels segment options with the machine's own partition names", () => {
    // --- This used to format `ROM 0` / `BANK 0` from the index and throw the label map away, which
    // --- is why the memory view named a partition something the breakpoints panel and `bp-set`
    // --- did not recognise. The invented names are descriptions now.
    expect(
      createSegmentOptions(
        { [-2]: "R1", [-1]: "R0", 0: "B0", 3: "B3" },
        8,
        { [-1]: "ROM 0", [-2]: "ROM 1", 0: "Bank 0", 3: "Bank 3" }
      )
    ).toEqual([
      { value: "-1", label: "R0", description: "ROM 0" },
      { value: "-2", label: "R1", description: "ROM 1" },
      { value: "0", label: "B0", description: "Bank 0" },
      { value: "3", label: "B3", description: "Bank 3" }
    ]);
  });

  it("keeps ROMs before banks, each ordered outward from zero", () => {
    expect(
      createSegmentOptions({ 3: "B3", [-1]: "R0", 0: "B0", [-2]: "R1" }, 8).map((o) => o.value)
    ).toEqual(["-1", "-2", "0", "3"]);
  });

  it("works for a machine that supplies no descriptions", () => {
    expect(createSegmentOptions({ [-1]: "R0" }, 8)).toEqual([
      { value: "-1", label: "R0", description: undefined }
    ]);
  });

  it("yields nothing past eight banks, where the matrix picker takes over", () => {
    expect(createSegmentOptions({ 0: "00" }, 9)).toEqual([]);
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
