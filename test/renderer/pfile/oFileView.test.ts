import { describe, expect, it } from "vitest";

import { basicListingText } from "@renderer/appIde/DocumentPanels/basicListing";
import { decodeZx8081Program } from "@renderer/appIde/DocumentPanels/zx8081BasicListing";
import {
  analyzeOFile,
  analyzeProgramFile,
  decodeZx80Variables,
  isZx80ProgramFileName,
  ZX80_PROGRAM_START
} from "@renderer/appIde/DocumentPanels/PFile/oFileView";
import { describeZx8081Variable } from "@renderer/appIde/DocumentPanels/PFile/pFileView";
import { readPFileRegion } from "@renderer/appIde/DocumentPanels/PFile/pFileDocument";
import { zx80VarsFile } from "./zx80VarsFile";

/*
 * The model of the ZX80 `.O` files the program viewer shows (`oFileView.ts`), without a DOM. The
 * fixture is a file recorded from the real 4K ROM; `test/zx8081-hw/o-file-viewer.test.ts` makes it.
 */

const word = (bytes: Uint8Array, offset: number) => bytes[offset] | (bytes[offset + 1] << 8);

describe("ZX80 .O file model", () => {
  it("reads a program's parts from its system variables", () => {
    const { analysis } = analyzeOFile(zx80VarsFile());
    const { machine, summary, regions } = analysis!;
    expect(machine).toBe("zx80");
    expect(summary.layoutValid).toBe(true);
    expect(summary.start).toBe(0x4000);
    // --- No display file: D_FILE is at E_LINE, the end of the file
    expect(regions.map((r) => [r.kind, r.start, r.end])).toEqual([
      ["sysvars", 0x4000, 0x4028],
      ["program", 0x4028, 0x406c],
      ["variables", 0x406c, 0x4093]
    ]);
    expect(regions.map((r) => r.views[0])).toEqual(["memory", "basic", "memory"]);
    expect(summary).toMatchObject({ vars: 0x406c, eLine: 0x4093, dFile: 0x4093, ramKb: 1, lineCount: 7 });
    expect(summary.autorunLine).toBeUndefined();
    expect(summary.extraBytes).toBe(0);
  });

  it("lists the program by the 4K ROM's rules", () => {
    const { analysis } = analyzeOFile(zx80VarsFile());
    const { memory, summary } = analysis!;
    const listing = decodeZx8081Program(memory, ZX80_PROGRAM_START, summary.vars, "zx80");
    expect(basicListingText(listing.lines).split("\n").map((l) => l.trimEnd())).toEqual([
      "  10 LET A=1",
      "  20 LET TOTAL=-25",
      '  30 LET B$="HI"',
      "  40 DIM C(3)",
      "  45 LET C(1)=7",
      "  50 FOR I=1 TO 10",
      "  70 FOR J=2 TO 5"
    ]);
  });

  it("decodes every kind of ZX80 variable", () => {
    const file = zx80VarsFile();
    const memory = new Uint8Array(0x10000);
    memory.set(file, 0x4000);
    const { variables, corrupted } = decodeZx80Variables(memory, word(file, 8), word(file, 10));
    expect(corrupted).toBe(false);
    expect(variables.map((v) => [v.kind, v.name, v.length])).toEqual([
      ["number", "A", 3],
      ["number", "TOTAL", 7],
      ["string", "B$", 4],
      ["numberArray", "C()", 10],
      ["forLoop", "I", 7],
      ["forLoop", "J", 7]
    ]);
    expect(variables.map(describeZx8081Variable)).toEqual([
      "1",
      "-25",
      '"HI"',
      "DIM (3)",
      "1 TO 10, NEXT goes to line 51 or the first after it",
      "2 TO 5, NEXT goes to line 71 or the first after it"
    ]);
  });

  it("stops at bytes that are no variable", () => {
    const memory = new Uint8Array(0x10000);
    // --- A number A, then a first byte whose top bits ($00) start no variable
    memory.set([0x66, 0x01, 0x00, 0x00, 0x80], 0x4400);
    expect(decodeZx80Variables(memory, 0x4400, 0x4405)).toMatchObject({ corrupted: true });
    expect(decodeZx80Variables(memory, 0x4400, 0x4405).variables).toHaveLength(1);
    // --- Ran out before the $80
    expect(decodeZx80Variables(memory, 0x4400, 0x4403)).toMatchObject({ corrupted: true });
  });

  it("shows a file whose pointers do not describe it as one part", () => {
    const file = zx80VarsFile();
    // --- E_LINE past the end of the file
    file[10] = 0xff;
    file[11] = 0x7f;
    const { analysis } = analyzeOFile(file);
    expect(analysis!.summary.layoutValid).toBe(false);
    expect(analysis!.regions.map((r) => r.kind)).toEqual(["sysvars", "data"]);
  });

  it("refuses a file too short for the system variables", () => {
    expect(analyzeOFile(new Uint8Array(10)).error).toMatch(/40 bytes of system variables/);
  });

  it("tells the machine by the file's extension", () => {
    expect(isZx80ProgramFileName("/p/GAME.O")).toBe(true);
    expect(isZx80ProgramFileName("/p/game.80")).toBe(true);
    expect(isZx80ProgramFileName("/p/game.p")).toBe(false);
    expect(analyzeProgramFile(zx80VarsFile(), "x.80").analysis?.machine).toBe("zx80");
    // --- Not a ZX81 file: too short for its 116 bytes of system variables
    expect(analyzeProgramFile(zx80VarsFile().subarray(0, 0x40), "x.p").error).toMatch(/116 bytes/);
  });

  it("reads a closed part back from a .O file", async () => {
    const region = await readPFileRegion("/p/VARS.o", "variables", async () => zx80VarsFile());
    expect(region?.start).toBe(0x406c);
    expect(region?.bytes).toHaveLength(0x4093 - 0x406c);
  });
});
