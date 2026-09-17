import { describe, expect, it } from "vitest";

import { copperLineToBufferRow, displayFileAddress, waitHToBufferX } from "../../scripts/visual-tests/lib/beam";

describe("visual harness - beam mapping", () => {
  it("maps copper lines to buffer rows (C00 calibration: cvc 96 -> row 144)", () => {
    expect(copperLineToBufferRow(0)).toBe(48);
    expect(copperLineToBufferRow(96)).toBe(144);
    expect(copperLineToBufferRow(239)).toBe(287);
    expect(copperLineToBufferRow(263)).toBe(0); // top border is the end of the count
    expect(copperLineToBufferRow(250)).toBeUndefined();
  });

  it("applies the $64 line offset: a WAIT line lands $64 rows higher", () => {
    expect(copperLineToBufferRow(96, 16)).toBe(128);
    expect(copperLineToBufferRow(10, 16)).toBe(42);
  });

  it("maps WAIT h to the hardware buffer x", () => {
    expect(waitHToBufferX(0)).toBe(96);
    expect(waitHToBufferX(16)).toBe(352);
  });

  it("builds non-linear display file addresses like the ROM", () => {
    expect(displayFileAddress(0, 0)).toBe(0x4000);
    expect(displayFileAddress(96, 0)).toBe(0x4880);
    expect(displayFileAddress(17, 0)).toBe(0x4140); // measured: a poke at $4140 shows on buffer row 65 = paper row 17
    expect(displayFileAddress(191, 31)).toBe(0x57ff);
  });
});
