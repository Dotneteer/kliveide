import { describe, expect, it } from "vitest";

import { MemoryBlockDevice, PartitionDevice, readPartitions, readHdfHeader, createHdfHeader } from "@common/diskfs/blockDevice";
import { FatFileSystem, createFatImage, formatFat } from "@common/diskfs/fat";

/*
 * FAT16/FAT32 (.plans/DISK_IMAGES_AND_FILE_SYSTEMS_PLAN.md, C1) on images formatted in memory:
 * the layout, files and folders, long names, deletes, renames and attributes, and partitions.
 */

const MB = 1024 * 1024;
const bytes = (n: number, seed = 0) => Uint8Array.from({ length: n }, (_, i) => (i * 7 + seed) & 0xff);
const open = (image: Uint8Array) => FatFileSystem.open(new MemoryBlockDevice(image));

describe("FAT formatting", () => {
  it.each([
    [16, 32, true],
    [16, 16, false],
    [32, 64, true],
    [32, 40, false]
  ] as const)("FAT%i on %i MB (partitioned: %s) opens with its type and free space", (type, mb, partitioned) => {
    const image = createFatImage(mb * MB, { type, label: "KLIVE", partitioned });
    const parts = readPartitions(new MemoryBlockDevice(image));
    expect(parts[0].whole).toBe(!partitioned);
    const fs = open(image);
    const info = fs.info();
    expect(info.system).toBe(`FAT${type}`);
    expect(info.label).toBe("KLIVE");
    expect(info.freeBytes).toBe(info.totalBytes - (type === 32 ? info.blockSize : 0));
    expect(fs.list()).toEqual([]);
  });

  it("refuses a disk too small for the type", () => {
    expect(() => createFatImage(8 * MB, { type: 32 })).toThrow(expect.objectContaining({ code: "unsupported" }));
  });
});

describe.each([16, 32] as const)("FAT%i files and folders", (type) => {
  const fresh = () => createFatImage((type === 16 ? 32 : 64) * MB, { type });

  it("writes files and reads them back, short and long names", () => {
    const image = fresh();
    const fs = open(image);
    fs.write({ name: "GAME.TAP", kind: "raw", data: bytes(70_000) });
    fs.write({ name: "A long file name.scr", kind: "raw", data: bytes(6912, 3) });
    fs.write({ name: "empty.txt", kind: "raw", data: new Uint8Array(0) });
    const again = open(image);
    expect(again.list().map((f) => [f.name, f.size, f.isDirectory])).toEqual([
      ["GAME.TAP", 70_000, false],
      ["A long file name.scr", 6912, false],
      ["empty.txt", 0, false]
    ]);
    expect(again.read("game.tap")).toEqual(bytes(70_000));
    expect(again.read("A LONG FILE NAME.SCR")).toEqual(bytes(6912, 3));
    expect(again.read("empty.txt")).toEqual(new Uint8Array(0));
  });

  it("makes folders, nested, and files in them; a folder grows past one cluster", () => {
    const image = fresh();
    const fs = open(image);
    fs.mkdir("BIN/tools");
    for (let i = 0; i < 80; i++) fs.write({ name: `BIN/tools/command number ${i}.bin`, kind: "raw", data: bytes(100, i) });
    const again = open(image);
    expect(again.list().map((f) => [f.name, f.isDirectory])).toEqual([["BIN", true]]);
    expect(again.list({ dir: "BIN" }).map((f) => f.name)).toEqual(["BIN/tools"]);
    const tools = again.list({ dir: "bin/TOOLS" });
    expect(tools.length).toBe(80);
    expect(tools[79].name).toBe("BIN/tools/command number 79.bin");
    expect(again.read("bin/tools/command number 42.bin")).toEqual(bytes(100, 42));
  });

  it("deletes, renames and sets attributes; space comes back", () => {
    const image = fresh();
    const fs = open(image);
    const free = fs.info().freeBytes;
    fs.write({ name: "one.bin", kind: "raw", data: bytes(10_000) });
    fs.write({ name: "two.bin", kind: "raw", data: bytes(5000) });
    fs.rename("one.bin", "first file.bin");
    fs.setAttributes("two.bin", { readOnly: true });
    expect(() => fs.delete("two.bin")).toThrow(expect.objectContaining({ code: "readOnly" }));
    fs.setAttributes("two.bin", { readOnly: false });
    fs.delete("two.bin");
    fs.delete("first file.bin");
    const again = open(image);
    expect(again.list()).toEqual([]);
    expect(again.info().freeBytes).toBe(free);
    // --- A rename frees the old entry and writes a new one: three deleted entries in all
    expect(again.list({ deleted: true }).length).toBe(3);
  });

  it("refuses duplicates, a missing folder, and a non-empty folder's delete", () => {
    const fs = open(fresh());
    fs.write({ name: "x.bin", kind: "raw", data: bytes(1) });
    expect(() => fs.write({ name: "X.BIN", kind: "raw", data: bytes(1) })).toThrow(expect.objectContaining({ code: "exists" }));
    expect(() => fs.write({ name: "nope/x.bin", kind: "raw", data: bytes(1) })).toThrow(expect.objectContaining({ code: "notFound" }));
    fs.mkdir("dir");
    fs.write({ name: "dir/y.bin", kind: "raw", data: bytes(1) });
    expect(() => fs.delete("dir")).toThrow(expect.objectContaining({ code: "unsupported" }));
  });

  it("maps the volume's regions and the clusters in use", () => {
    const fs = open(fresh());
    fs.write({ name: "big.bin", kind: "raw", data: bytes(200_000) });
    const r = fs.regions();
    expect(r.fats[0]).toBe(r.reserved[1]);
    expect(r.data[0]).toBe(r.root[0] + r.root[1]);
    const use = fs.clusterUse(16);
    expect(use[0]).toBeGreaterThan(0);
    expect(use[15]).toBe(0);
    expect(fs.fileClusters("big.bin").length).toBe(Math.ceil(200_000 / fs.info().blockSize));
  });
});

describe("HDF images", () => {
  it("round trips the header and opens the FAT volume behind it", () => {
    const sectors = (32 * MB) / 512;
    const header = createHdfHeader(sectors);
    const image = new Uint8Array(header.length + 32 * MB);
    image.set(header);
    const info = readHdfHeader(image)!;
    expect(info).toEqual({ version: 0x11, halved: false, dataOffset: 0x216 });
    const device = new MemoryBlockDevice(image, info.dataOffset);
    formatFat(device, { type: 16 });
    expect(FatFileSystem.open(new MemoryBlockDevice(image, info.dataOffset)).info().system).toBe("FAT16");
  });

  it("a partition device reads its own sectors", () => {
    const image = new Uint8Array(4 * 512);
    image[2 * 512] = 42;
    expect(new PartitionDevice(new MemoryBlockDevice(image), 2, 2).readSector(0)[0]).toBe(42);
  });
});

describe("FAT volumes made by another implementation", () => {
  it("reads and extends a FAT16 superfloppy that macOS formatted and filled", async () => {
    const { gunzipSync } = await import("zlib");
    const { readFileSync } = await import("fs");
    const { join } = await import("path");
    const image = new Uint8Array(gunzipSync(readFileSync(join(__dirname, "../testfiles/fat/macos-fat16.img.gz"))));
    const fs = open(image);
    expect(fs.info()).toMatchObject({ system: "FAT16", label: "MACFAT" });
    const names = fs.list().filter((f) => !f.hidden && !f.name.startsWith(".")).map((f) => f.name);
    expect(names).toEqual(expect.arrayContaining(["BIN", "Mac readme.txt"]));
    expect(new TextDecoder().decode(fs.read("Mac readme.txt"))).toBe("written by macOS\n");
    expect(fs.read("BIN/Deeper folder/data.bin")).toEqual(new Uint8Array(50000).fill(0x78));
    fs.write({ name: "BIN/Deeper folder/from klive.bin", kind: "raw", data: bytes(3000) });
    expect(open(image).read("bin/deeper folder/FROM KLIVE.BIN")).toEqual(bytes(3000));
  });
});
