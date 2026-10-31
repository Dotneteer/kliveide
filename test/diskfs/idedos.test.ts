import { describe, expect, it } from "vitest";

import { MemoryBlockDevice } from "@common/diskfs/blockDevice";
import { formatIdedos, openIdedosPartition, readIdedos, TYPE_PLUS3DOS } from "@common/diskfs/idedos";

/*
 * IDEDOS hard disks (.plans/FILE_MANAGER_PLAN.md, Phase 9): the partition table as the Sinclair
 * Wiki describes it, and a +3DOS file system on a partition, read and written in place.
 */

const PRINT_42 = new Uint8Array([0x00, 0x0a, 0x0a, 0x00, 0xf5, 0x34, 0x32, 0x0e, 0x00, 0x00, 0x2a, 0x00, 0x00, 0x0d]);
const bytes = (n: number, seed = 0) => Uint8Array.from({ length: n }, (_, i) => (i * 7 + seed) & 0xff);

function disk (mb = 4) {
  const image = new Uint8Array(mb * 1024 * 1024);
  const device = new MemoryBlockDevice(image);
  return { image, device };
}

describe("IDEDOS partition tables", () => {
  it("are found at LBA 0, named PLUSIDEDOS, with their geometry", () => {
    const { device, image } = disk();
    formatIdedos(device, { partitions: [{ name: "games", sizeKb: 1024 }, { name: "work", sizeKb: 512 }] });
    expect(String.fromCharCode(...image.subarray(0, 16))).toBe("PLUSIDEDOS      ");
    expect(image[0x10]).toBe(1);
    const idedos = readIdedos(device)!;
    expect(idedos).toMatchObject({ systemLba: 0, geometry: { heads: 4, sectorsPerTrack: 32, cylinders: 64 } });
    expect(idedos.partitions.map((p) => [p.index, p.name, p.type, p.firstLba, p.sectorCount])).toEqual([
      [0, "PLUSIDEDOS", 1, 0, 128],
      [1, "games", TYPE_PLUS3DOS, 128, 2048],
      [2, "work", TYPE_PLUS3DOS, 2176, 1024]
    ]);
  });

  it("are found at head 1 sector 1, behind an MBR", () => {
    const { device, image } = disk();
    formatIdedos(device, { partitions: [{ name: "games", sizeKb: 512 }] });
    // --- Move the system partition's first sector to LBA 32 (head 1 sector 1 at 32 sectors a track)
    const table = image.slice(0, 128 * 512);
    image.fill(0, 0, 33 * 512);
    image[510] = 0x55;
    image[511] = 0xaa;
    image.set(table.subarray(0, 512), 32 * 512);
    expect(readIdedos(device)?.systemLba).toBe(32);
  });

  it("are not found on a disk without one", () => {
    expect(readIdedos(disk(1).device)).toBeUndefined();
  });
});

describe("+3DOS on an IDEDOS partition", () => {
  it("starts empty, takes files with their headers, and reads them back from the disk's sectors", () => {
    const { device, image } = disk();
    formatIdedos(device, { partitions: [{ name: "games", sizeKb: 1024 }] });
    const fs = openIdedosPartition(device, 1);
    expect(fs.list()).toEqual([]);
    expect(fs.info()).toMatchObject({ system: "+3DOS", format: "+3e partition", blockSize: 4096, directoryEntries: 512 });
    fs.write({ name: "LOADER", kind: "basic", data: PRINT_42, start: 10, variablesOffset: PRINT_42.length });
    fs.write({ name: "GAME.BIN", kind: "code", data: bytes(20000), start: 24000 });

    // --- Written in place: a fresh look at the same sectors sees them
    const again = openIdedosPartition(new MemoryBlockDevice(image), 1);
    expect(again.list().map((e) => [e.name, e.kind, e.start, e.size])).toEqual([
      ["LOADER", "basic", 10, 14],
      ["GAME.BIN", "code", 24000, 20000]
    ]);
    expect(again.read("GAME.BIN")).toEqual(bytes(20000));
    // --- The first directory entry sits at the partition's first sector, the data from block 4
    expect(String.fromCharCode(...image.subarray(128 * 512 + 1, 128 * 512 + 9))).toBe("LOADER  ");
    expect(String.fromCharCode(...image.subarray(128 * 512 + 4 * 4096, 128 * 512 + 4 * 4096 + 8))).toBe("PLUS3DOS");
  });

  it("deletes and renames, and keeps the partitions apart", () => {
    const { device } = disk();
    formatIdedos(device, { partitions: [{ name: "a", sizeKb: 512 }, { name: "b", sizeKb: 512 }] });
    const a = openIdedosPartition(device, 1);
    a.write({ name: "ONE", kind: "code", data: bytes(100), start: 1 });
    a.write({ name: "TWO", kind: "code", data: bytes(100), start: 2 });
    a.delete("ONE");
    a.rename("TWO", "THREE");
    expect(openIdedosPartition(device, 1).list().map((e) => e.name)).toEqual(["THREE"]);
    expect(openIdedosPartition(device, 2).list()).toEqual([]);
  });

  it("says when the partition is not there", () => {
    const { device } = disk();
    formatIdedos(device, { partitions: [{ name: "a", sizeKb: 512 }] });
    expect(() => openIdedosPartition(device, 5)).toThrow(expect.objectContaining({ code: "notFound" }));
  });
});
