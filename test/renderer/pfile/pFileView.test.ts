import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import {
  analyzePFile,
  decodeZx81Variables,
  describeZx8081Variable,
  zx81CodeText,
  zx81DisplayRows,
  zx81DisplayText,
  zx81Number
} from "@renderer/appIde/DocumentPanels/PFile/pFileView";
import {
  parsePFileRegionDocumentId,
  pFileRegionDumpId,
  pFileRegionTitle,
  readPFileRegion
} from "@renderer/appIde/DocumentPanels/PFile/pFileDocument";
import { drawZx81Screen, zx81FontFromRom } from "@renderer/appIde/DocumentPanels/PFile/zx81Screen";

/*
 * The model of the ZX81 `.P` viewer (`pFileView.ts`), without a DOM. The panel is tested in
 * `test/renderer/PFileViewerPanel.test.tsx`; the variables against the real ROM in
 * `test/zx8081-hw/p-file-viewer.test.ts`.
 */

const TAPES = join(__dirname, "../../../_input/zx81-tapes");
const read = (path: string) => new Uint8Array(readFileSync(join(TAPES, path)));
const ROM = new Uint8Array(readFileSync(join(__dirname, "../../../src/public/roms/zx81.rom")));

/**
 * The variables area of a program the ZX81 ROM saved in Klive (`test/zx8081-hw/p-file-viewer.test.ts`
 * runs it): `LET A=1`, `LET TOTAL=-2.5`, `LET B$="HI"`, `DIM C(3)`, `DIM D$(2,3)` and
 * `60 FOR I=1 TO 10`, then the $80 that ends them
 */
const ROM_VARIABLES = Uint8Array.from(
  Buffer.from(
    "668100000000b9343926b182a00000004702002d2e881200010300000000000000000000000000000000c90b000202000300000000000000ee8100000000842000000081000000003d0080",
    "hex"
  )
);

describe("ZX81 .P file model", () => {
  it("reads a program's parts from its system variables", () => {
    const { analysis } = analyzePFile(read("basic/Characters.P"));
    expect(analysis).toBeDefined();
    const { summary, regions } = analysis!;
    expect(summary.layoutValid).toBe(true);
    expect(regions.map((r) => [r.kind, r.start, r.end])).toEqual([
      ["sysvars", 0x4009, 0x407d],
      ["program", 0x407d, 0x40f3],
      ["display", 0x40f3, 0x440c],
      ["variables", 0x440c, 0x4431]
    ]);
    // --- Each part's bytes are the file's at that address
    expect(regions[1].bytes[0]).toBe(read("basic/Characters.P")[0x407d - 0x4009]);
    expect(summary.lineCount).toBe(6);
    expect(summary.ramKb).toBe(16);
    // --- Saved in FAST mode (CDFLAG bit 6 clear), by a command: it needs RUN
    expect(summary.slowMode).toBe(false);
    expect(summary.autorunLine).toBeUndefined();
    expect(analysis!.variables.map((v) => v.name)).toEqual(["N", "F"]);
  });

  it("finds the line a program saved by a program line runs from (NXTLIN)", () => {
    const { summary } = analyzePFile(read("basic/DEC-TO-FP-2.p")).analysis!;
    expect(summary.autorunLine).toBe(5);
    expect(summary.slowMode).toBe(true);
  });

  it("offers each part the views that suit it", () => {
    const { regions } = analyzePFile(read("basic/Characters.P")).analysis!;
    expect(Object.fromEntries(regions.map((r) => [r.kind, r.views]))).toEqual({
      sysvars: ["memory"],
      program: ["basic", "memory", "disassembly"],
      display: ["screen", "memory"],
      variables: ["memory"]
    });
  });

  it("keeps the bytes after E_LINE, which LOAD never reads, as their own part", () => {
    const { summary, regions } = analyzePFile(read("basic/BASE.p")).analysis!;
    expect(summary.extraBytes).toBe(4);
    expect(regions.at(-1)).toMatchObject({ kind: "extra", start: 0x43b4, end: 0x43b8 });
  });

  it("shows a 1K program that keeps code in its system variables as one part", () => {
    const { summary, regions } = analyzePFile(read("1k/byteForever.p")).analysis!;
    expect(summary.layoutValid).toBe(false);
    expect(regions.map((r) => r.kind)).toEqual(["sysvars", "data"]);
    expect(regions[1]).toMatchObject({ start: 0x407d, end: 0x40e7 });
  });

  it("tells a collapsed 1K display file from a full one", () => {
    expect(analyzePFile(read("1k/rcar.p")).analysis!.summary.displayCollapsed).toBe(true);
    expect(analyzePFile(read("basic/BASE.p")).analysis!.summary.displayCollapsed).toBe(false);
  });

  it("calls a variables area that holds a program's own data not BASIC variables", () => {
    const { summary } = analyzePFile(read("machine-code/jump.p")).analysis!;
    expect(summary.variablesCorrupted).toBe(true);
    expect(summary.variableCount).toBe(0);
  });

  it("explains a file too short to be a program", () => {
    expect(analyzePFile(new Uint8Array(10)).error).toMatch(/116 bytes of system variables/);
  });

  it("reads the display file as the screen shows it", () => {
    const { analysis } = analyzePFile(read("basic/Characters.P"));
    const { memory, summary } = analysis!;
    const rows = zx81DisplayRows(memory, summary.dFile, summary.vars);
    expect(rows).toHaveLength(24);
    const text = zx81DisplayText(rows);
    // --- The program prints every character, each followed by its inverse
    expect(text[0].startsWith(" [ ]▘[▘]▝[▝]")).toBe(true);
    expect(text[2].startsWith("4[4]5[5]")).toBe(true);
  });

  it("stops a collapsed display file's lines at their NEWLINE", () => {
    const memory = new Uint8Array(0x10000);
    // --- NEWLINE, "AB" NEWLINE, an empty line, then the rest empty
    memory.set([0x76, 0x26, 0x27, 0x76, 0x76, ...new Array(22).fill(0x76)], 0x5000);
    const rows = zx81DisplayRows(memory, 0x5000, 0x5000 + 27);
    expect(rows.slice(0, 3)).toEqual([[0x26, 0x27], [], []]);
    expect(rows).toHaveLength(24);
  });
});

describe("ZX81 variables", () => {
  const memory = new Uint8Array(0x10000);
  memory.set(ROM_VARIABLES, 0x4400);
  const { variables, corrupted } = decodeZx81Variables(memory, 0x4400, 0x4400 + ROM_VARIABLES.length);

  it("decodes every kind the ROM stores, up to the $80", () => {
    expect(corrupted).toBe(false);
    expect(variables.map((v) => [v.kind, v.name])).toEqual([
      ["number", "A"],
      ["number", "TOTAL"],
      ["string", "B$"],
      ["numberArray", "C()"],
      ["stringArray", "D$()"],
      ["forLoop", "I"]
    ]);
  });

  it("describes each one", () => {
    expect(variables.map(describeZx8081Variable)).toEqual([
      "1",
      "-2.5",
      '"HI"',
      "DIM (3)",
      "DIM (2, 3)",
      "1 TO 10 STEP 1, NEXT goes to line 61 or the first after it"
    ]);
  });

  it("reads ZX81 numbers", () => {
    const n = (bytes: number[]) => zx81Number(Uint8Array.from(bytes), 0);
    expect(n([0, 0, 0, 0, 0])).toBe(0);
    expect(n([0x81, 0x00, 0, 0, 0])).toBe(1);
    expect(n([0x82, 0xa0, 0, 0, 0])).toBe(-2.5);
    expect(n([0x80, 0x00, 0, 0, 0])).toBe(0.5);
  });

  it("stops at a byte no variable starts with", () => {
    const bad = new Uint8Array(0x10000);
    bad.set([0x66, 0x81, 0, 0, 0, 0, 0x00, 0x80], 0x4400);
    expect(decodeZx81Variables(bad, 0x4400, 0x4408)).toMatchObject({ corrupted: true });
  });

  it("writes tokens as text and other codes as hex", () => {
    expect(zx81CodeText(0x26)).toBe("A");
    expect(zx81CodeText(0xa6)).toBe("[A]");
    expect(zx81CodeText(0xf5)).toBe("PRINT");
    expect(zx81CodeText(0x76)).toBe("{$76}");
  });
});

describe("ZX81 screen", () => {
  it("draws the ROM's glyphs, inverse where bit 7 is set", () => {
    const font = zx81FontFromRom(ROM)!;
    expect(font).toHaveLength(0x200);
    const target = new Uint32Array(256 * 192);
    // --- "A" then an inverse space in the top row
    drawZx81Screen([[0x26, 0x80]], font, [0, 1], target);
    const pixel = (x: number, y: number) => target[y * 256 + x];
    // --- The glyph's rows are the ROM's bytes
    for (let line = 0; line < 8; line++) {
      const bits = font[0x26 * 8 + line];
      for (let x = 0; x < 8; x++) expect(pixel(x, line)).toBe(bits & (0x80 >> x) ? 1 : 0);
    }
    // --- An inverse space is all ink; the rest is paper
    expect(pixel(8, 0)).toBe(1);
    expect(pixel(15, 7)).toBe(1);
    expect(pixel(16, 0)).toBe(0);
    expect(pixel(0, 8)).toBe(0);
  });

  it("has no font from a ROM too short to hold one", () => {
    expect(zx81FontFromRom(new Uint8Array(0x1000))).toBeUndefined();
  });
});

describe("ZX81 .P part documents", () => {
  it("names a part's dump by the file's full path, and reads it back", async () => {
    const id = `memoryDump-${pFileRegionDumpId("/p/Characters.P", "program")}`;
    expect(parsePFileRegionDocumentId(id)).toEqual({ path: "/p/Characters.P", kind: "program" });
    expect(parsePFileRegionDocumentId("memoryDump-tapeBlockDump/a.tap:1")).toBeUndefined();
    expect(pFileRegionTitle("/p/Characters.P", "display", "/p", "screen")).toBe(
      "Characters.P - Screen"
    );
    expect(pFileRegionTitle("/p/Characters.P", "program", "/p")).toBe(
      "Characters.P - BASIC program"
    );
    const region = await readPFileRegion("x", "display", async () => read("basic/Characters.P"));
    expect(region?.start).toBe(0x40f3);
    expect(region?.bytes).toHaveLength(0x440c - 0x40f3);
  });
});
