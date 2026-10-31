import { describe, expect, it } from "vitest";

import { tapFiles } from "@common/diskfs/importFiles";
import {
  buildPlan,
  convertFile,
  fmFileSystemOf,
  freeName,
  storeSafeName,
  tapOf,
  wasShortened,
  type FmPlanSource,
  type FmSourceFile,
  type FmTransferOptions
} from "@common/fileManager/fmTransfer";

/*
 * What a file becomes on a copy (.plans/FILE_MANAGER_PLAN.md §6, Phase 3): one case per row of the
 * conversion table, the names, and the plan of a whole copy.
 */

const PRINT_42 = new Uint8Array([0x00, 0x0a, 0x0a, 0x00, 0xf5, 0x34, 0x32, 0x0e, 0x00, 0x00, 0x2a, 0x00, 0x00, 0x0d]);
const bytes = (n: number, seed = 0) => Uint8Array.from({ length: n }, (_, i) => (i * 7 + seed) & 0xff);
const AUTO: FmTransferOptions = { mode: "auto" };
const HEADERS: FmTransferOptions = { mode: "headers" };
const RAW: FmTransferOptions = { mode: "raw" };

const basicFile: FmSourceFile = { name: "LOADER", data: PRINT_42, spectrum: { kind: "basic", start: 10, variablesOffset: PRINT_42.length } };
const codeFile: FmSourceFile = { name: "GAME.BIN", data: bytes(500), spectrum: { kind: "code", start: 24000 } };
const screenFile: FmSourceFile = { name: "TITLE", data: bytes(6912), spectrum: { kind: "code", start: 16384 } };
const arrayFile: FmSourceFile = { name: "HISCORE", data: bytes(30), spectrum: { kind: "numberArray", variableName: "h" } };
const rawFile: FmSourceFile = { name: "NOTES.TXT", data: bytes(40), spectrum: { kind: "raw" } };

function tapeOf (...files: { type: number; name: string; data: Uint8Array; p1: number; p2: number }[]): Uint8Array {
  const parts: number[] = [];
  for (const f of files) {
    const header = [0x00, f.type, ...f.name.padEnd(10).split("").map((c) => c.charCodeAt(0)),
      f.data.length & 0xff, f.data.length >> 8, f.p1 & 0xff, f.p1 >> 8, f.p2 & 0xff, f.p2 >> 8];
    header.push(header.reduce((a, b) => a ^ b, 0));
    const body = [0xff, ...f.data];
    body.push(body.reduce((a, b) => a ^ b, 0));
    parts.push(19, 0, ...header, body.length & 0xff, body.length >> 8, ...body);
  }
  return Uint8Array.from(parts);
}

describe("§6: host or FAT to a Spectrum catalogue", () => {
  it("a .tap splits into its files, with their headers", () => {
    const tape = tapeOf(
      { type: 0, name: "game", data: PRINT_42, p1: 10, p2: PRINT_42.length },
      { type: 3, name: "gamecode", data: bytes(100), p1: 24000, p2: 32768 }
    );
    const out = convertFile({ name: "game.tap", data: tape }, "host", "+3dos", AUTO);
    expect(out.map((o) => [o.name, o.kind, o.start, o.becomes])).toEqual([
      ["GAME", "basic", 10, { as: "basic", line: 10 }],
      ["GAMECODE.BIN", "code", 24000, { as: "code", start: 24000 }]
    ]);
  });

  it("a .scr becomes a SCREEN$ at 16384", () => {
    const [out] = convertFile({ name: "my title.scr", data: bytes(6912) }, "fat", "trdos", AUTO);
    expect(out).toMatchObject({ name: "my title.C", kind: "code", start: 16384, becomes: { as: "screen" } });
  });

  it("a .bas is tokenised, with the auto-run line asked for", () => {
    const [out] = convertFile({ name: "loader.bas", data: new TextEncoder().encode('10 PRINT 42\n') }, "host", "+3dos", { mode: "auto", autoRun: 10 });
    expect(out).toMatchObject({ name: "LOADER", kind: "basic", start: 10, becomes: { as: "basic", line: 10 } });
    expect(out.data[out.data.length - 1]).toBe(0x0d);
  });

  it("anything else is CODE at the start address asked for", () => {
    const [out] = convertFile({ name: "font.bin", data: bytes(768) }, "host", "+3dos", { mode: "auto", codeStart: 60000 });
    expect(out).toMatchObject({ name: "FONT.BIN", kind: "code", start: 60000, becomes: { as: "code", start: 60000 } });
  });

  it("raw mode: even a .tap is one CODE file, not split", () => {
    const tape = tapeOf({ type: 3, name: "x", data: bytes(10), p1: 1, p2: 0 });
    const out = convertFile({ name: "game.tap", data: tape }, "host", "+3dos", RAW);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ name: "GAME.TAP", kind: "code", start: 32768, data: tape });
  });

  it("names fit the catalogue", () => {
    expect(convertFile({ name: "my_long_title.scr", data: bytes(6912) }, "host", "+3dos", AUTO)[0].name).toBe("MY_LONG_.SCR");
    expect(convertFile({ name: "a very long name.bin", data: bytes(4) }, "host", "microdrive", AUTO)[0].name).toBe("a very lon");
  });
});

describe("§6: a Spectrum catalogue to host or FAT", () => {
  it("auto: BASIC and arrays keep their header in a .tap, a SCREEN$ is a .scr, other code its bytes", () => {
    expect(convertFile(basicFile, "+3dos", "host", AUTO)[0]).toMatchObject({ name: "LOADER.tap", becomes: { as: "tap" } });
    expect(convertFile(arrayFile, "+3dos", "fat", AUTO)[0]).toMatchObject({ name: "HISCORE.tap", becomes: { as: "tap" } });
    expect(convertFile(screenFile, "+3dos", "host", AUTO)[0]).toMatchObject({ name: "TITLE.scr", becomes: { as: "screen" }, data: screenFile.data });
    expect(convertFile(codeFile, "+3dos", "host", AUTO)[0]).toMatchObject({ name: "GAME.BIN", becomes: { as: "bytes" }, data: codeFile.data });
    expect(convertFile({ ...codeFile, name: "GAME" }, "+3dos", "host", AUTO)[0].name).toBe("GAME.bin");
  });

  it("a headerless file goes as it is", () => {
    expect(convertFile(rawFile, "+3dos", "host", AUTO)[0]).toMatchObject({ name: "NOTES.TXT", becomes: { as: "asIs" }, data: rawFile.data });
  });

  it("keep headers: every file with a header becomes a one-file .tap", () => {
    for (const f of [basicFile, codeFile, screenFile, arrayFile]) {
      expect(convertFile(f, "+3dos", "host", HEADERS)[0].becomes).toEqual({ as: "tap" });
    }
    expect(convertFile(codeFile, "+3dos", "host", HEADERS)[0].name).toBe("GAME.BIN.tap");
  });

  it("raw bytes: the header is dropped, .bin added to a name without an extension", () => {
    expect(convertFile(basicFile, "+3dos", "host", RAW)[0]).toMatchObject({ name: "LOADER.bin", data: PRINT_42, becomes: { as: "bytes" } });
    expect(convertFile(codeFile, "+3dos", "host", RAW)[0].name).toBe("GAME.BIN");
  });

  it("a TR-DOS name loses its type letter", () => {
    expect(convertFile({ ...codeFile, name: "game.C" }, "trdos", "host", RAW)[0].name).toBe("game.bin");
  });

  it("the .tap made from a file reads back as the same file", () => {
    for (const f of [basicFile, codeFile, arrayFile]) {
      const [back] = tapFiles(tapOf(f.name, "+3dos", f.data, f.spectrum!), "x");
      expect(back).toMatchObject({ kind: f.spectrum!.kind, data: f.data });
      if (f.spectrum!.kind === "basic") expect(back).toMatchObject({ start: 10, variablesOffset: PRINT_42.length, name: "LOADER" });
      if (f.spectrum!.kind === "code") expect(back.start).toBe(24000);
      if (f.spectrum!.kind === "numberArray") expect(back.variableName).toBe("h");
    }
  });
});

describe("§6: between Spectrum catalogues, and between file stores", () => {
  it("the header goes with the file and the name is fitted", () => {
    expect(convertFile(basicFile, "+3dos", "trdos", AUTO)[0]).toMatchObject({ name: "LOADER.B", kind: "basic", start: 10, variablesOffset: PRINT_42.length });
    expect(convertFile({ ...codeFile, name: "game.C" }, "trdos", "+3dos", RAW)[0]).toMatchObject({ name: "GAME", kind: "code", start: 24000 });
    expect(convertFile(codeFile, "+3dos", "microdrive", AUTO)[0].name).toBe("GAME.BIN");
  });

  it("host and FAT take the bytes as they are, under the same name", () => {
    const f = { name: "Manic Miner.tap", data: bytes(9) };
    expect(convertFile(f, "host", "fat", AUTO)).toEqual([{ name: "Manic Miner.tap", data: f.data, kind: "raw", becomes: { as: "asIs" } }]);
  });
});

describe("names", () => {
  it("a file store refuses no name, only its characters", () => {
    expect(storeSafeName('a:b/c?.txt')).toBe("a_b_c_.txt");
    expect(storeSafeName("trailing. ")).toBe("trailing");
  });

  it("a free name: numbered on a file store, ~n within the length on a catalogue", () => {
    const taken = new Set(["game.tap", "game (2).tap", "loader", "loader~2", "longname.bin"]);
    expect(freeName("game.tap", "host", taken)).toBe("game (3).tap");
    expect(freeName("LOADER", "+3dos", taken)).toBe("LOADER~3");
    expect(freeName("LONGNAME.BIN", "+3dos", taken)).toBe("LONGNA~2.BIN");
    expect(freeName("other", "host", taken)).toBe("other");
  });

  it("tells a shortened name from a case change", () => {
    expect(wasShortened("my_long_title.scr", "host", "MY_LONG_.SCR", "+3dos")).toBe(true);
    expect(wasShortened("game.bin", "host", "GAME.BIN", "+3dos")).toBe(false);
  });

  it("knows a drive's file system", () => {
    expect(fmFileSystemOf({ kind: "project", fileSystem: "" })).toBe("host");
    expect(fmFileSystemOf({ kind: "hardDisk", fileSystem: "FAT32" })).toBe("fat");
    expect(fmFileSystemOf({ kind: "image", fileSystem: "TR-DOS" })).toBe("trdos");
  });
});

describe("the plan of a copy", () => {
  const src = (over: Partial<FmPlanSource> & Pick<FmPlanSource, "sourceName">): FmPlanSource => ({
    sourcePath: `/p/${over.sourceName}`, relDir: "", isDirectory: false, size: 10, ...over
  });

  it("host to host: folders first-class, files not read, conflicts found per folder", () => {
    const plan = buildPlan(
      [src({ sourceName: "tapes", isDirectory: true }), src({ sourceName: "a.tap", relDir: "tapes", size: 300 }), src({ sourceName: "b.bin" })],
      "host", "host", AUTO,
      (rel) => new Set(rel === "" ? ["b.bin"] : [])
    );
    expect(plan.items.map((i) => [i.relDir, i.targetName, i.isDirectory, i.size, i.conflict])).toEqual([
      ["", "tapes", true, 0, false],
      ["tapes", "a.tap", false, 300, false],
      ["", "b.bin", false, 10, true]
    ]);
    expect(plan.outputs.size).toBe(0);
  });

  it("host to +3DOS: folders are skipped unless flattened, names collide into ~n", () => {
    const sources = [
      src({ sourceName: "gfx", isDirectory: true }),
      src({ sourceName: "a.bin", relDir: "gfx", file: { name: "a.bin", data: bytes(4) } }),
      src({ sourceName: "my_long_title.scr", file: { name: "my_long_title.scr", data: bytes(6912) } }),
      src({ sourceName: "my_long_title_2.scr", file: { name: "my_long_title_2.scr", data: bytes(6912) } })
    ];
    const plan = buildPlan(sources, "host", "+3dos", AUTO, () => new Set(["my_long_.scr"]));
    expect(plan.skippedFolders).toEqual(["gfx"]);
    expect(plan.items.map((i) => [i.targetName, i.conflict, i.shortened])).toEqual([
      ["MY_LONG_.SCR", true, true],
      ["MY_LON~2.SCR", false, true]
    ]);
    expect(plan.outputs.get(plan.items[1].id)?.name).toBe("MY_LON~2.SCR");

    const flat = buildPlan(sources, "host", "+3dos", { mode: "auto", flatten: true }, () => new Set());
    expect(flat.skippedFolders).toEqual([]);
    expect(flat.items.map((i) => i.targetName)).toEqual(["A.BIN", "MY_LONG_.SCR", "MY_LON~2.SCR"]);
  });

  it("a .tap split onto a catalogue marks its files as parts", () => {
    const tape = tapeOf(
      { type: 0, name: "game", data: PRINT_42, p1: 10, p2: PRINT_42.length },
      { type: 3, name: "game", data: bytes(100), p1: 24000, p2: 32768 }
    );
    const plan = buildPlan([src({ sourceName: "game.tap", file: { name: "game.tap", data: tape } })], "host", "trdos", AUTO, () => new Set());
    expect(plan.items.map((i) => [i.targetName, i.part, i.size])).toEqual([["game.B", true, PRINT_42.length], ["game.C", true, 100]]);
  });
});
