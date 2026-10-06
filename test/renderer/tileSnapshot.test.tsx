import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import React from "react";
import type { NextTilemapState } from "@common/messaging/EmuApi";
import { TILE_TRANSPARENT, type TilemapRegs } from "@common/zxnext/tilemap/tilemapDecode";
import { buildTilemapModel } from "@renderer/features/tilemap/tilemapViewModel";
import {
  openTileSnapshot,
  snapshotPixels,
  tileSnapshotAsDb,
  tileSnapshotOf,
  tileSnapshotTitle
} from "@renderer/features/tilemap/tileSnapshot";

/*
 * A tilemap tile popped out of the Tilemap Inspector into a read-only tile viewer: the bytes as
 * stored (through the decoder's addressing), the cell's transform and palette offset, the frozen
 * palette, and a viewer that shows them and changes nothing.
 */

vi.mock("@renderer/appIde/services/DocumentServiceProvider", () => ({
  useDocumentHubService: () => ({ setDocumentViewState: vi.fn() })
}));
vi.mock("@renderer/core/RendererProvider", () => ({ useDispatch: () => vi.fn() }));
vi.mock("@renderer/theming/ThemeProvider", () => ({
  useTheme: () => ({
    theme: { tone: "dark" },
    getThemeProperty: () => "#ffffff",
    getIcon: () => ({ kind: "path", fill: "#ffffff", paint: "" }),
    getImage: () => ({ type: "svg+xml", data: "" })
  })
}));
vi.mock("@renderer/controls/Tooltip", () => ({
  TooltipFactory: () => null,
  Tooltip: () => null,
  useTooltipRef: () => ({ current: null })
}));

const { createTileSnapshotPanel } = await import("@renderer/appIde/DocumentPanels/TileSnapshot/TileSnapshotPanel");

const PALETTE = { deviceValues: Array.from({ length: 256 }, (_, i) => i << 1), bank: 0 as const };

function model(regs: Partial<TilemapRegs> = {}, fill?: (b5: Uint8Array, b7: Uint8Array) => void) {
  const bank5 = new Uint8Array(0x4000);
  const bank7 = new Uint8Array(0x4000);
  fill?.(bank5, bank7);
  const state: NextTilemapState = {
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
    bank7,
    slotOffsets: [0, 0x2000, 0x054000, 0x056000, 0x044000, 0x046000, 0x040000, 0x042000],
    copperRunning: false
  };
  return buildTilemapModel(state);
}

/** Tile 2: top row nibble 1, left column nibble 2, everything else $F (transparent). */
const ASYMMETRIC = (b5: Uint8Array) => {
  const base = 0x0c00 + 2 * 32;
  b5.fill(0xff, base, base + 32);
  for (let x = 0; x < 8; x += 2) b5[base + x / 2] = 0x11;
  for (let y = 1; y < 8; y++) b5[base + y * 4] = 0x2f;
};

afterEach(() => cleanup());

describe("tileSnapshotOf", () => {
  it("takes the 32 definition bytes, the cell's offset and transform, and the palette", () => {
    const m = model({}, (b5) => {
      ASYMMETRIC(b5);
      b5[0x2c00] = 2; // --- cell (0, 0): tile 2,
      b5[0x2c01] = 0x3a; // --- offset 3, X mirror, rotate
    });
    const { bytes, info } = tileSnapshotOf(m, 2, PALETTE, { cell: m.cells[0], takenAt: new Date(2026, 9, 6, 9, 0, 0) });
    expect(bytes.length).toBe(32);
    expect([...bytes.slice(0, 5)]).toEqual([0x11, 0x11, 0x11, 0x11, 0x2f]);
    expect(info).toMatchObject({ tile: 2, paletteOffset: 3, address: "5:$0C40", paletteBank: 0 });
    expect(info.cell).toEqual({ col: 0, row: 0, rotate: true, xmirror: true, ymirror: false });
    expect(info.palette).toHaveLength(256);
    const { title, detail } = tileSnapshotTitle(info);
    expect(title).toBe("Tile 2 · 4-bit");
    expect(detail).toMatch(/^as cell \(0, 0\) shows it · palette 1, offset 3 · rotate, X mirror · 5:\$0C40 · taken /);
  });

  it("reads through the bank-7 8K wrap, and takes 8 bytes in text mode", () => {
    const m = model({ control: 0x88, defBank7: true, defMsb: 0x1f }, (_b5, b7) => {
      b7[0x1ff8] = 0xaa; // --- tile 31: 7:$1F00 + 31 * 8
      b7[0x0000] = 0x81; // --- tile 32: 7:$2000, past the 8K, wraps to 7:$0000
    });
    const t32 = tileSnapshotOf(m, 32, PALETTE).bytes;
    expect(t32.length).toBe(8);
    const t31 = tileSnapshotOf(m, 31, PALETTE).bytes;
    expect(t31[0]).toBe(0xaa);
    expect(t32[0]).toBe(0x81);
  });

  it("uses the sheet's palette offset for a tile taken from the sheet", () => {
    const m = model();
    expect(tileSnapshotOf(m, 9, PALETTE, { paletteOffset: 6 }).info.paletteOffset).toBe(6);
  });
});

describe("snapshotPixels", () => {
  const m = model({}, ASYMMETRIC);
  const { bytes, info } = tileSnapshotOf(m, 2, PALETTE, { paletteOffset: 3 });

  it("draws the stored tile with the offset, nibble $4C transparent", () => {
    const p = snapshotPixels(bytes, info, false);
    expect([p[0].index, p[8].index, p[9].index]).toEqual([0x31, 0x32, TILE_TRANSPARENT]);
    expect(p[9].value).toBe(0x0f);
  });

  it("applies the cell's transform only as shown (T5)", () => {
    const withCell = { ...info, cell: { col: 0, row: 0, rotate: false, xmirror: true, ymirror: false } };
    expect(snapshotPixels(bytes, withCell, false)[7].index).toBe(0x31); // --- stored: top right is the top row
    const shown = snapshotPixels(bytes, withCell, true);
    expect(shown[15].index).toBe(0x32); // --- X mirror: the left column is now on the right
    expect(shown[8].index).toBe(TILE_TRANSPARENT);
  });

  it("decides text-mode transparency by the frozen palette's RGB against $14 (T4)", () => {
    const tm = model({ control: 0x88 }, (b5) => (b5[0x0c00 + 8] = 0x80));
    const palette = { deviceValues: Array.from({ length: 256 }, (_, i) => (i === 0x0e ? 0xe3 << 1 : 0)), bank: 1 as const };
    const snap = tileSnapshotOf(tm, 1, palette, { paletteOffset: 7 });
    const p = snapshotPixels(snap.bytes, snap.info, false);
    expect(p[0].index).toBe(0x0f); // --- bit 1 at offset 7: index $0F
    expect(p[1].index).toBe(TILE_TRANSPARENT); // --- bit 0: index $0E, whose colour is $14
  });

  it("copies as .db, four bytes a line", () => {
    const db = tileSnapshotAsDb(bytes, info).split("\n");
    expect(db[0]).toBe("; tile 2");
    expect(db).toHaveLength(9);
    expect(db[1]).toBe("    .db $11, $11, $11, $11");
  });
});

describe("openTileSnapshot", () => {
  it("opens an in-memory document and retakes an open one in place", async () => {
    const open = new Set<string>();
    const hub = {
      isOpen: vi.fn((id: string) => open.has(id)),
      closeDocument: vi.fn(async (id: string) => void open.delete(id)),
      openDocument: vi.fn(async (doc: { id: string }) => void open.add(doc.id))
    };
    const snap = tileSnapshotOf(model(), 4, PALETTE);
    await openTileSnapshot(hub as any, snap);
    await openTileSnapshot(hub as any, snap);
    expect(hub.closeDocument).toHaveBeenCalledTimes(1);
    const [doc, viewState, temporary] = hub.openDocument.mock.calls[1] as any[];
    expect(doc).toMatchObject({ id: "tileSnapshot-4", type: "TileSnapshot", name: "Tile 4 (snapshot)" });
    expect(doc.contents).toHaveLength(32);
    expect(viewState).toMatchObject({ asShown: false, snapshot: { tile: 4 } });
    expect(temporary).toBe(false);
  });
});

describe("the tile snapshot viewer", () => {
  const m = model({}, (b5) => {
    ASYMMETRIC(b5);
    b5[0x2c00] = 2;
    b5[0x2c01] = 0x38; // --- offset 3, X mirror
  });
  const snap = tileSnapshotOf(m, 2, PALETTE, { cell: m.cells[0] });
  const renderViewer = () =>
    render(
      createTileSnapshotPanel({
        document: { id: "tileSnapshot-2", name: "Tile 2 (snapshot)" } as any,
        contents: snap.bytes,
        viewState: { snapshot: snap.info, asShown: true }
      } as any)
    );
  const fills = () => [...document.querySelectorAll('[data-role="pixels"] rect')].map((r) => r.getAttribute("fill"));

  it("is read-only, names the tile and the cell, and draws 64 pixels", () => {
    renderViewer();
    const bar = screen.getByRole("toolbar", { name: "Read-only snapshot" });
    expect(bar.textContent).toContain("Read-only");
    expect(bar.textContent).toContain("Tile 2 · 4-bit");
    expect(bar.textContent).toContain("as cell (0, 0) shows it");
    expect(fills()).toHaveLength(64);
  });

  it("switches between as shown and as stored", () => {
    renderViewer();
    const shown = fills();
    fireEvent.click(screen.getByRole("button", { name: "As stored" }));
    const stored = fills();
    expect(stored).not.toEqual(shown);
    // --- X mirror only: each row reversed
    for (let y = 0; y < 8; y++) expect(stored.slice(y * 8, y * 8 + 8)).toEqual(shown.slice(y * 8, y * 8 + 8).reverse());
  });

  it("reads the pixel under the pointer: position, nibble and index", () => {
    renderViewer();
    fireEvent.mouseEnter(document.querySelectorAll('[data-role="pixels"] rect')[15]);
    const status = document.querySelector('[aria-live="off"]')!.textContent!;
    expect(status).toContain("x 7, y 1");
    expect(status).toContain("nibble 2");
    expect(status).toContain("index $32");
  });
});
