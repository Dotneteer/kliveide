import { describe, expect, it } from "vitest";

import { decodeMap, tilemapMode } from "@common/zxnext/tilemap/tilemapDecode";
import {
  bankRange,
  mapRange,
  overlapOf,
  tilemapDiagnostics,
  ULA_ATTRIBUTES
} from "@common/zxnext/tilemap/tilemapDiagnostics";
import { changedCells, cellKeys, paletteOffsetFromMap, tileUsage, usageCount } from "@common/zxnext/tilemap/tilemapUsage";
import { emptyBanks, regs } from "./tilemapFixtures";

function diagnose(patch: Parameters<typeof regs>[0], fill?: (b: ReturnType<typeof emptyBanks>) => void) {
  const r = regs(patch);
  const b = emptyBanks();
  fill?.(b);
  const mode = tilemapMode(r);
  return tilemapDiagnostics(mode, r, decodeMap(mode, r, b)).map((d) => d.id);
}

describe("ranges (T1)", () => {
  it("wraps a bank 7 range at 8K", () => {
    expect(bankRange("x", 7, 0x1f00, 0x200).spans).toEqual([
      [0x1f00, 0x2000],
      [0, 0x100]
    ]);
  });

  it("finds the overlap of the map with the ULA attributes", () => {
    const r = regs({ mapMsb: 0x18 });
    expect(overlapOf(mapRange(tilemapMode(r), r), ULA_ATTRIBUTES)).toEqual([[0x1800, 0x1b00]]);
  });

  it("never overlaps across banks", () => {
    const r = regs({ mapBank7: true, mapMsb: 0x18 });
    expect(overlapOf(mapRange(tilemapMode(r), r), ULA_ATTRIBUTES)).toEqual([]);
  });
});

describe("tilemapDiagnostics (D10, T7)", () => {
  it("is quiet for the reset layout with tile 0 only", () => {
    // --- tile 0 at $4C00: inside the ULA bitmap, so it warns
    expect(diagnose({})).toEqual(["overlap:tiles:ULA bitmap"]);
    expect(diagnose({ defMsb: 0x1c })).toEqual([]);
  });

  it("suppresses the ULA overlaps when the ULA is off (T7)", () => {
    expect(diagnose({ ulaDisabled: true })).toEqual([]);
    expect(diagnose({ mapMsb: 0x18, ulaDisabled: true, defMsb: 0x00 })).toEqual([]);
  });

  it("warns when the map and the used tiles overlap", () => {
    expect(diagnose({ defMsb: 0x2c })).toContain("overlap:map:tiles");
  });

  it("warns when an 80x32 map wraps in bank 7's 8K", () => {
    expect(diagnose({ control: 0xc0, mapBank7: true, mapMsb: 0x1c, defBank7: true, defMsb: 0x00, ulaDisabled: true })).toContain(
      "wrap:map"
    );
  });

  it("says when the tilemap is off, and the 512-tile priority rule", () => {
    // --- 512 tiles of 32 bytes fill bank 5, so from any base but 0 the full table wraps (an info)
    expect(diagnose({ enabled: false, control: 0x02, defMsb: 0x1c })).toEqual(["disabled", "wrap:definitions", "512:below"]);
  });

  it("warns about used tiles past the bank end, but only notes a too-long table", () => {
    const ids = diagnose({ defMsb: 0x3f, ulaDisabled: true }, (b) => (b.bank5[0x2c00] = 9));
    expect(ids).toContain("wrap:tiles");
    expect(diagnose({ defMsb: 0x38, ulaDisabled: true })).toEqual(["wrap:definitions"]);
  });
});

describe("tileUsage", () => {
  it("indexes cells by tile and reads From map palette offsets", () => {
    const r = regs();
    const b = emptyBanks();
    b.bank5[0x2c00 + 2] = 5;
    b.bank5[0x2c00 + 3] = 0x70;
    const cells = decodeMap(tilemapMode(r), r, b);
    const usage = tileUsage(cells);
    expect(usageCount(usage, 5)).toBe(1);
    expect(usageCount(usage, 0)).toBe(1279);
    expect(usage.maxTile).toBe(5);
    expect(paletteOffsetFromMap(cells, usage, 5, 0)).toBe(7);
    expect(paletteOffsetFromMap(cells, usage, 6, 2)).toBe(2);
  });

  it("marks cells changed since the baseline", () => {
    const r = regs();
    const b = emptyBanks();
    const before = cellKeys(decodeMap(tilemapMode(r), r, b));
    b.bank5[0x2c00 + 3] = 0x10;
    const after = cellKeys(decodeMap(tilemapMode(r), r, b));
    expect([...changedCells(before, after)]).toEqual([1]);
    expect(changedCells(undefined, after).size).toBe(0);
  });
});
