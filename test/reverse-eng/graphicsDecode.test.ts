import { describe, expect, it } from "vitest";
import {
  autoColumns,
  byteOffsetsInFrame,
  bytePicture,
  decodeGraphics,
  DEFAULT_GRAPHICS_LOOK,
  dimMaskFor,
  frameGeometry,
  GRAPHIC_INK,
  GRAPHIC_NONE,
  GRAPHIC_PAPER,
  normalizeLook,
  type GraphicsLook
} from "@common/reverse/graphicsDecode";

const look = (patch: Partial<GraphicsLook>): GraphicsLook => ({ ...DEFAULT_GRAPHICS_LOOK, frameGap: false, ...patch });

/** One frame's pixels as text rows. */
function picture(bytes: number[], l: GraphicsLook, frames = 1, columns = 1): string[] {
  const d = decodeGraphics(bytes, l, 0, frames, columns);
  const rows: string[] = [];
  for (let y = 0; y < d.height; y++) {
    let row = "";
    for (let x = 0; x < d.width; x++) {
      const p = d.pixels[y * d.width + x];
      row += p === GRAPHIC_INK ? "#" : p === GRAPHIC_PAPER ? "." : " ";
    }
    rows.push(row);
  }
  return rows;
}

describe("graphicsDecode", () => {
  it("reads linear rows, most significant bit first", () => {
    expect(picture([0x81, 0xff, 0x00, 0x18], look({ width: 2, height: 2 }))).toEqual([
      "#......#########",
      "...........##..."
    ]);
  });

  it("reads character cells in reading order", () => {
    // --- Two cells side by side (width 2), 8 rows: cell 0 is all 0x80, cell 1 all 0x01
    const bytes = [...Array(8).fill(0x80), ...Array(8).fill(0x01)];
    const rows = picture(bytes, look({ width: 2, height: 8, layout: "cells" }));
    expect(rows).toHaveLength(8);
    expect(new Set(rows)).toEqual(new Set(["#..............#"]));
    // --- A 1×16 cell frame stacks two cells
    expect(byteOffsetsInFrame(look({ width: 2, height: 16, layout: "cells" }), 0, 8).graphic).toBe(16);
  });

  it("reads columns top to bottom, then across", () => {
    const l = look({ width: 2, height: 2, layout: "columns" });
    expect(byteOffsetsInFrame(l, 0, 1).graphic).toBe(1);
    expect(byteOffsetsInFrame(l, 1, 0).graphic).toBe(2);
    expect(picture([0x80, 0x40, 0x01, 0x02], l)).toEqual(["#..............#", ".#............#."]);
  });

  it("reads the display file order", () => {
    const l = look({ layout: "screen" });
    expect(normalizeLook(l)).toMatchObject({ width: 32, height: 192 });
    expect(byteOffsetsInFrame(l, 0, 1).graphic).toBe(0x100);
    expect(byteOffsetsInFrame(l, 0, 8).graphic).toBe(0x20);
    expect(byteOffsetsInFrame(l, 3, 64).graphic).toBe(0x803);
    expect(frameGeometry(l).frameBytes).toBe(6144);
  });

  it("weaves masks in each of the three orders", () => {
    const interleaved = look({ width: 1, height: 2, mask: "interleaved" });
    expect(byteOffsetsInFrame(interleaved, 0, 1)).toEqual({ mask: 2, graphic: 3 });
    expect(byteOffsetsInFrame(look({ width: 1, height: 2, mask: "before" }), 0, 1)).toEqual({ mask: 1, graphic: 3 });
    expect(byteOffsetsInFrame(look({ width: 1, height: 2, mask: "after" }), 0, 1)).toEqual({ graphic: 1, mask: 3 });
    expect(frameGeometry(interleaved).frameBytes).toBe(4);
    // --- mask, pixel, mask, pixel
    const bytes = [0xff, 0x0f, 0x00, 0xf0];
    expect(picture(bytes, interleaved)).toEqual(["....####", "####...."]);
    expect(picture(bytes, { ...interleaved, showMask: true })).toEqual(["########", "........"]);
  });

  it("inverts, lays frames out in a sheet with gaps, and maps every pixel to its byte", () => {
    const l = look({ width: 1, height: 1, invert: true, frameGap: true });
    const d = decodeGraphics([0xf0, 0x0f, 0xaa], l, 0, 3, 2, 10);
    expect(d.sheet).toMatchObject({ columns: 2, rows: 2, width: 17, height: 3 });
    expect(d.frames.map((f) => [f.index, f.x, f.y, f.offset])).toEqual([[10, 0, 0, 0], [11, 9, 0, 1], [12, 0, 2, 2]]);
    expect(d.pixels[0]).toBe(GRAPHIC_PAPER);
    expect(d.pixels[8]).toBe(GRAPHIC_NONE);
    expect(d.byteMap[9]).toBe(1);
    expect(d.byteMap[2 * 17]).toBe(2);
    expect(d.byteMap[2 * 17 + 9]).toBe(-1);
  });

  it("draws nothing past the end of the bytes", () => {
    const d = decodeGraphics([0xff], look({ width: 1, height: 2 }), 0, 1, 1);
    expect(Array.from(d.pixels.slice(8))).toEqual(Array(8).fill(GRAPHIC_NONE));
  });

  it("dims by byte, fits columns and draws byte pictures", () => {
    const d = decodeGraphics([1, 2], look({ width: 1, height: 1 }), 0, 2, 2);
    expect(Array.from(dimMaskFor(d.byteMap, (o) => o === 1)).filter(Boolean)).toHaveLength(8);
    expect(autoColumns(look({ width: 1, zoom: 2, frameGap: true }), 100)).toBe(5);
    expect(bytePicture(0x81)).toBe("#......#");
  });
});
