import { describe, expect, it } from "vitest";

import type { NextTilemapState } from "@common/messaging/EmuApi";
import type { TilemapRegs } from "@common/zxnext/tilemap/tilemapDecode";
import { fillAbgr } from "@renderer/controls/Next/IndexedImageCanvas";
import { mapOverlay, tileAtPixel, tilesOverlay, unusedTileMask } from "@renderer/features/tilemap/tilemapOverlay";
import {
  addressOf,
  buildTilemapModel,
  cellAsDb,
  cellFields,
  cellShownIndices,
  globalsStrip,
  highlightedCells,
  invisibilityReasons,
  orderGlobals,
  selectedTile,
  textTransparency,
  tileSheetOffset,
  tilemapStateHash,
  validSelection
} from "@renderer/features/tilemap/tilemapViewModel";

// --- TILEMAP_INSPECTOR_PLAN §4.4-§4.5: the globals strip, the inspector, the overlays

const DEFAULT_SLOTS = [0x00000, 0x02000, 0x054000, 0x056000, 0x044000, 0x046000, 0x040000, 0x042000];

function state(regs: Partial<TilemapRegs> = {}, fill?: (bank5: Uint8Array) => void): NextTilemapState {
  const bank5 = new Uint8Array(0x4000);
  fill?.(bank5);
  return {
    regs: {
      enabled: true,
      control: 0x80,
      defaultAttr: 0,
      mapBank7: false,
      mapMsb: 0x2c,
      defBank7: false,
      defMsb: 0x0c,
      scrollX: 0,
      scrollY: 0,
      transparencyIndex: 0x0f,
      globalTransparency: 0xe3,
      clip: [0, 159, 0, 255],
      clipIndex: 0,
      ulaDisabled: false,
      ...regs
    },
    bank5,
    bank7: new Uint8Array(0x4000),
    slotOffsets: DEFAULT_SLOTS,
    copperRunning: false
  };
}

describe("addresses (T1)", () => {
  it("shows bank:offset, physical and the Z80 address only where the page is mapped", () => {
    const a = addressOf(state(), false, 0x2c00);
    expect([a.bankText, a.physicalText, a.z80Text]).toEqual(["5:$2C00", "$056C00", "$6C00"]);
    const b = addressOf(state(), true, 0x0c00);
    expect([b.bankText, b.physicalText, b.z80Text]).toEqual(["7:$0C00", "$05CC00", undefined]);
  });
});

describe("globals strip", () => {
  it("leads with the overlap chip, then the primary items", () => {
    const items = orderGlobals(globalsStrip(buildTilemapModel(state({ mapMsb: 0x18 }))));
    expect(items[0]).toMatchObject({ flag: "warning", value: "map overlaps ULA attributes" });
    const text = items.map((i) => `${i.key}=${i.value}`).join(" ");
    expect(text).toContain("Size=40×32");
    expect(text).toContain("Entries=2-byte");
    expect(text).toContain("Map=5:$1800");
    expect(text).toContain("$4C=$F");
  });

  it("names $14 in text mode, the $6C attribute when attribute-less, and a running Copper", () => {
    const s = { ...state({ control: 0xa8, defaultAttr: 0x5a }), copperRunning: true };
    const text = globalsStrip(buildTilemapModel(s))
      .map((i) => `${i.key}=${i.value}`)
      .join(" ");
    expect(text).toContain("Entries=1-byte, $6C=$5A");
    expect(text).toContain("$14=$E3");
    expect(text).toContain("Copper=running");
  });
});

describe("inspector", () => {
  it("never decodes bit 0 as ULA-on-top in 512-tile mode (T3)", () => {
    const model = buildTilemapModel(
      state({ control: 0x82, defMsb: 0x00, ulaDisabled: true }, (b) => {
        b[0x2c00] = 44;
        b[0x2c01] = 0x01;
      })
    );
    const fields = cellFields(model, model.cells[0]);
    expect(fields.find((f) => f.name === "Tile")!.value).toBe("300 (bit 8 from attr)");
    expect(fields.find((f) => f.name === "Priority")!.value).toBe("below ULA (512-tile mode)");
    expect(fields.find((f) => f.name === "Raw")!.value).toBe("$2C $01");
    expect(cellAsDb(model.cells[0])).toContain(".db $2C, $01");
  });

  it("says why a cell is invisible: disabled, outside the window, transparent, below the ULA (T8)", () => {
    const model = buildTilemapModel(
      state({ enabled: false, clip: [0, 3, 0, 255] }, (b) => {
        b.fill(0xff, 0x0c00, 0x0c20); // --- tile 0: every nibble $F, the transparent index
        b[0x2c00 + 2 * 20 + 1] = 0x01; // --- cell (20, 0): below the ULA
      })
    );
    const cell = model.cells[20];
    const reasons = invisibilityReasons(model, cell, cellShownIndices(model, cell));
    expect(reasons.map((r) => r.split(" ")[0])).toEqual(["The", "Outside", "Every", "Below"]);
  });

  it("decides text-mode transparency by the palette's RGB against $14 (T4)", () => {
    const model = buildTilemapModel(state({ control: 0x88 }));
    const deviceValues = Array.from({ length: 256 }, (_, i) => (i === 7 ? 0xe3 << 1 : 0));
    const t = textTransparency(model, deviceValues)!;
    expect([t(7), t(8)]).toEqual([true, false]);
    expect(textTransparency(buildTilemapModel(state()), deviceValues)).toBeUndefined();
  });

  it("links a cell to its tile, and a tile to its users", () => {
    const model = buildTilemapModel(state({}, (b) => (b[0x2c00 + 2] = 9)));
    expect(selectedTile(model, { kind: "cell", col: 1, row: 0 })).toBe(9);
    expect(highlightedCells(model, { kind: "tile", tile: 9 })).toEqual([1]);
    expect(validSelection(model, { kind: "cell", col: 60, row: 0 })).toBeUndefined();
    expect(tileSheetOffset(model, 5)(9)).toBe(5);
  });

  it("re-hashes when a byte, a register or the paging changes (D9)", () => {
    const a = state();
    const h = tilemapStateHash(a);
    expect(tilemapStateHash(state())).toBe(h);
    const b = state();
    b.bank5[100] = 1;
    expect(tilemapStateHash(b)).not.toBe(h);
    expect(tilemapStateHash(state({ scrollX: 1 }))).not.toBe(h);
    expect(tilemapStateHash({ ...a, slotOffsets: [...DEFAULT_SLOTS].reverse() })).not.toBe(h);
  });
});

describe("overlays", () => {
  it("outlines the visible window on the whole map and the clip window as displayed (D4)", () => {
    const model = buildTilemapModel(state({ scrollX: 8 }));
    const whole = mapOverlay(model, { asDisplayed: false, grid: false, indices: false, selected: [], selectedIsCell: true, changed: new Set() });
    expect(whole.filter((s) => s.kind === "rect").map((s) => (s as any).role)).toEqual(["visible", "visible"]);
    const shown = mapOverlay(model, { asDisplayed: true, grid: true, indices: false, selected: [0], selectedIsCell: true, changed: new Set([1]) });
    expect(shown.map((s) => (s.kind === "rect" ? s.role : s.kind))).toEqual(["grid", "clip", "dot", "selected"]);
  });

  it("writes tile numbers when asked, one per cell", () => {
    const model = buildTilemapModel(state());
    const shapes = mapOverlay(model, { asDisplayed: false, grid: false, indices: true, selected: [], selectedIsCell: true, changed: new Set() });
    expect(shapes.filter((s) => s.kind === "text")).toHaveLength(1280);
  });

  it("maps the tile sheet and dims unreferenced tiles", () => {
    const model = buildTilemapModel(state());
    expect(tileAtPixel(17, 9, 16, 256)).toBe(18);
    expect(tileAtPixel(0, 8 * 16, 16, 256)).toBeUndefined();
    const mask = unusedTileMask(model, 16);
    expect(mask[0]).toBe(0); // --- tile 0, used by every cell
    expect(mask[8]).toBe(1); // --- tile 1, unused
    expect(tilesOverlay(model, 16, { grid: false, selectedTile: 3, counts: true }).map((s) => s.kind)).toEqual(["text", "rect"]);
  });
});

describe("IndexedImageCanvas.fillAbgr (T9)", () => {
  it("paints indices, leaves transparency to the checker and dims masked pixels", () => {
    const abgr = Uint32Array.from({ length: 256 }, (_, i) => 0xff000000 | i);
    const out = new Uint32Array(3);
    fillAbgr(out, Int16Array.from([5, -1, 6]), abgr, 0xff0000ff, true, Uint8Array.from([0, 0, 1]));
    expect(Array.from(out)).toEqual([0xff000005, 0, 0x50000006]);
    fillAbgr(out, Int16Array.from([5, -1, 6]), abgr, 0xff0000ff, false);
    expect(out[1]).toBe(0xff0000ff);
  });
});
