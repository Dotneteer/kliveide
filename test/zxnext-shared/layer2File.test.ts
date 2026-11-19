import { describe, expect, it } from "vitest";

import { withHeader } from "@common/diskfs/plus3dos";
import { defaultLayer2Palette, parseLayer2File, readPaletteBlock } from "@common/zxnext/layer2/layer2File";

/* `.sl2` / `.nxi` (`dev/plans/LAYER2_INSPECTOR_PLAN.md` Phase 7). */

describe("Layer 2 picture files", () => {
  it("reads a 48K file as 256x192 with the default palette", () => {
    const { file } = parseLayer2File(new Uint8Array(49152));
    expect(file).toMatchObject({ resolutions: [0], paletteFromFile: false });
    expect(file!.data.length).toBe(49152);
    expect(file!.palette).toEqual(defaultLayer2Palette());
  });

  it("reads an 80K file as 320x256 or 640x256: the size cannot tell", () => {
    expect(parseLayer2File(new Uint8Array(81920)).file!.resolutions).toEqual([1, 2]);
  });

  it("takes a 512-byte palette from the front", () => {
    const bytes = new Uint8Array(512 + 49152);
    bytes[2 * 5] = 0xe0; // --- entry 5: red, blue LSB set
    bytes[2 * 5 + 1] = 0x01;
    bytes[512] = 0x42;
    const { file } = parseLayer2File(bytes);
    expect(file).toMatchObject({ resolutions: [0], paletteFromFile: true });
    expect(file!.palette[5]).toBe((0xe0 << 1) | 1);
    expect(file!.data[0]).toBe(0x42);
    expect(file!.data.length).toBe(49152);
    expect(parseLayer2File(new Uint8Array(512 + 81920)).file!.paletteFromFile).toBe(true);
  });

  it("skips the 128-byte PLUS3DOS header a NextBASIC SAVE writes (a .sl2)", () => {
    const pixels = new Uint8Array(49152);
    pixels[0] = 0x42;
    const bytes = withHeader({ name: "PIC.SL2", kind: "code", data: pixels, start: 0 });
    expect(bytes.length).toBe(49280);
    const { file } = parseLayer2File(bytes);
    expect(file).toMatchObject({ resolutions: [0], paletteFromFile: false });
    expect(file!.data.length).toBe(49152);
    expect(file!.data[0]).toBe(0x42);
  });

  it("reads a palette after a PLUS3DOS header", () => {
    const body = new Uint8Array(512 + 81920);
    body[0] = 0xe0;
    const { file } = parseLayer2File(withHeader({ name: "PIC.NXI", kind: "code", data: body, start: 0 }));
    expect(file).toMatchObject({ resolutions: [1, 2], paletteFromFile: true });
    expect(file!.palette[0]).toBe(0xe0 << 1);
  });

  it("does not skip 128 bytes that only look like a header (bad checksum)", () => {
    const bytes = withHeader({ name: "PIC.SL2", kind: "code", data: new Uint8Array(49152), start: 0 });
    bytes[127] ^= 0xff;
    expect(parseLayer2File(bytes).error).toMatch(/Invalid file size \(49280 bytes\)/);
  });

  it("refuses any other size", () => {
    expect(parseLayer2File(new Uint8Array(6912)).error).toMatch(/Invalid file size \(6912 bytes\)/);
  });

  it("the default palette is RGB332 i at index i, as the core's hard reset leaves it", () => {
    const p = defaultLayer2Palette();
    expect(p[0xe3]).toBe((0xe3 << 1) | 1);
    expect(p[0x01]).toBe(0x02);
    expect(readPaletteBlock(new Uint8Array(512).fill(0xff))[0]).toBe(0x1ff);
  });
});
