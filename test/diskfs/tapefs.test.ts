import { describe, expect, it } from "vitest";

import { tapFiles } from "@common/diskfs/importFiles";
import { openDiskFileSystem } from "@common/diskfs/open";
import { TapeFileSystem, tapeFileBlocks } from "@common/diskfs/tapefs";

/*
 * A tape as a file system (.plans/FILE_MANAGER_PLAN.md §5.4, Phase 6): `.tap` read and written,
 * `.tzx` read from its standard-speed blocks.
 */

const PRINT_42 = new Uint8Array([0x00, 0x0a, 0x0a, 0x00, 0xf5, 0x34, 0x32, 0x0e, 0x00, 0x00, 0x2a, 0x00, 0x00, 0x0d]);
const bytes = (n: number, seed = 0) => Uint8Array.from({ length: n }, (_, i) => (i * 7 + seed) & 0xff);

function tap (...blocks: Uint8Array[]): Uint8Array {
  const out: number[] = [];
  for (const b of blocks) out.push(b.length & 0xff, b.length >> 8, ...b);
  return Uint8Array.from(out);
}

function sample (): Uint8Array {
  return tap(
    ...tapeFileBlocks("game", "basic", PRINT_42, 10, PRINT_42.length),
    ...tapeFileBlocks("game", "code", bytes(100), 24000),
    ...tapeFileBlocks("x", "raw", bytes(20, 1))
  );
}

/** A TZX holding the blocks as standard-speed blocks, and one pure tone block between them */
function tzx (...blocks: Uint8Array[]): Uint8Array {
  const out: number[] = [..."ZXTape!".split("").map((c) => c.charCodeAt(0)), 0x1a, 1, 20];
  blocks.forEach((b, i) => {
    out.push(0x10, 0xe8, 0x03, b.length & 0xff, b.length >> 8, ...b);
    if (i === 0) out.push(0x12, 0x78, 0x08, 0x10, 0x00);
  });
  return Uint8Array.from(out);
}

describe("a .tap as files", () => {
  it("lists header and data pairs and headerless blocks, in tape order, names made unique", () => {
    const fs = new TapeFileSystem(sample(), "tap");
    expect(fs.list().map((e) => [e.name, e.kind, e.size, e.start, e.variablesOffset])).toEqual([
      ["game", "basic", PRINT_42.length, 10, PRINT_42.length],
      ["game#2", "code", 100, 24000, undefined],
      ["block01", "raw", 20, undefined, undefined]
    ]);
    expect(fs.info()).toMatchObject({ system: "TAP", usedEntries: 3 });
    expect(fs.read("game#2")).toEqual(bytes(100));
    expect(fs.read("block01")).toEqual(bytes(20, 1));
  });

  it("appends a file, deletes one, renames one, and writes back a .tap any reader loads", () => {
    const fs = new TapeFileSystem(sample(), "tap");
    fs.write({ name: "screen", kind: "code", data: bytes(6912), start: 16384 });
    fs.delete("game#2");
    fs.rename("game", "loader");
    const back = tapFiles(fs.image(), "t");
    expect(back.map((f) => [f.name, f.kind, f.start, f.data.length])).toEqual([
      ["loader", "basic", 10, PRINT_42.length],
      ["t1", "code", 32768, 20],
      ["screen", "code", 16384, 6912]
    ]);
    expect(() => fs.rename("loader", "a name too long")).toThrow(expect.objectContaining({ code: "badName" }));
    expect(() => fs.read("nope")).toThrow(expect.objectContaining({ code: "notFound" }));
  });

  it("moves a file along the tape", () => {
    const fs = new TapeFileSystem(sample(), "tap");
    fs.move("block01", -1);
    expect(fs.list().map((e) => e.name)).toEqual(["game", "block01", "game#2"]);
    fs.move("game", 1);
    expect(fs.list().map((e) => e.name)).toEqual(["block01", "game", "game#2"]);
    expect(new TapeFileSystem(fs.image(), "tap").list().map((e) => e.name)).toEqual(["block01", "game", "game#2"]);
  });

  it("is what the disk layer opens for a .tap or a .tzx", () => {
    expect(openDiskFileSystem(sample(), "x.TAP").system).toBe("tape");
  });
});

describe("a .tzx as files", () => {
  it("reads its standard-speed blocks and refuses changes", () => {
    const blocks = tapeFileBlocks("game", "code", bytes(50), 30000);
    const fs = new TapeFileSystem(tzx(...blocks), "tzx");
    expect(fs.list().map((e) => [e.name, e.kind, e.start, e.size])).toEqual([["game", "code", 30000, 50]]);
    expect(fs.read("game")).toEqual(bytes(50));
    expect(fs.readOnly).toBe(true);
    expect(fs.info().system).toBe("TZX");
    expect(() => fs.write({ name: "x", kind: "code", data: bytes(1) })).toThrow(expect.objectContaining({ code: "readOnly" }));
    expect(() => fs.delete("game")).toThrow(expect.objectContaining({ code: "readOnly" }));
  });

  it("says when the file is not a TZX", () => {
    expect(() => new TapeFileSystem(bytes(30), "tzx")).toThrow(expect.objectContaining({ code: "unformatted" }));
  });
});
