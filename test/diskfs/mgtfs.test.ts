import { describe, expect, it } from "vitest";

import { MgtFileSystem, MGT_IMAGE_SIZE } from "@common/diskfs/mgtfs";
import { openDiskFileSystem } from "@common/diskfs/open";

/*
 * The MGT +D / DISCiPLE file system (.plans/FILE_MANAGER_PLAN.md, Phase 9), checked against the
 * layout MGT's DISCiPLE/+D Technical Guide gives: the directory on tracks 0-3, 256-byte entries,
 * the sector count high byte first, the sector address map from track 4 sector 1, 510 data bytes
 * and a (track, sector) link per sector, the 9-byte header first in a ZX file, side 1 as 128+.
 */

const PRINT_42 = new Uint8Array([0x00, 0x0a, 0x0a, 0x00, 0xf5, 0x34, 0x32, 0x0e, 0x00, 0x00, 0x2a, 0x00, 0x00, 0x0d]);
const bytes = (n: number, seed = 0) => Uint8Array.from({ length: n }, (_, i) => (i * 7 + seed) & 0xff);
const SECTOR = 512;
/** A sector's place in the image: cylinder-major, the heads alternating */
const at = (track: number, sector: number) => ((((track & 0x7f) * 2) + (track & 0x80 ? 1 : 0)) * 10 + sector - 1) * SECTOR;

describe("MGT disks", () => {
  it("are 819,200 bytes, and a blank one is empty", () => {
    const fs = MgtFileSystem.blank();
    expect(fs.image().length).toBe(MGT_IMAGE_SIZE);
    expect(fs.list()).toEqual([]);
    expect(fs.info()).toMatchObject({ system: "MGT", directoryEntries: 80, freeBytes: 1560 * 510 });
    expect(() => new MgtFileSystem(new Uint8Array(1000))).toThrow(expect.objectContaining({ code: "unformatted" }));
  });

  it("write a BASIC program as the technical guide lays it out", () => {
    const fs = MgtFileSystem.blank();
    fs.write({ name: "loader", kind: "basic", data: PRINT_42, start: 10, variablesOffset: PRINT_42.length });
    const img = fs.image();
    const entry = img.subarray(at(0, 1), at(0, 1) + 256);
    expect(entry[0]).toBe(1);
    expect(String.fromCharCode(...entry.subarray(1, 11))).toBe("loader    ");
    // --- One sector, the count high byte first; the file starts at track 4 sector 1
    expect([entry[11], entry[12], entry[13], entry[14]]).toEqual([0, 1, 4, 1]);
    // --- Bit 0 of byte 15 is track 4 sector 1
    expect(entry[15]).toBe(1);
    // --- The header: BASIC (0), its length, PROG, the program length, the auto-run line
    expect(Array.from(entry.subarray(211, 220))).toEqual([0, 14, 0, 0xcb, 0x5c, 14, 0, 10, 0]);
    const data = img.subarray(at(4, 1), at(4, 1) + SECTOR);
    expect(Array.from(data.subarray(0, 9))).toEqual(Array.from(entry.subarray(211, 220)));
    expect(data.subarray(9, 9 + 14)).toEqual(PRINT_42);
    expect([data[510], data[511]]).toEqual([0, 0]);
    expect(fs.list()).toEqual([expect.objectContaining({ name: "loader", kind: "basic", size: 14, start: 10, variablesOffset: 14 })]);
    expect(fs.read("LOADER")).toEqual(PRINT_42);
  });

  it("chain files through linked sectors, onto side 1 when side 0 is full", () => {
    const fs = MgtFileSystem.blank();
    // --- Side 0's 76 data tracks hold 760 sectors; eight 48K files take 776
    const files = Array.from({ length: 8 }, (_, i) => bytes(48 * 1024, i));
    files.forEach((data, i) => fs.write({ name: `part${i}`, kind: "code", data, start: 16384 }));
    const img = fs.image();
    // --- The link out of side 0's last sector goes to track 128 sector 1
    const last0 = at(79, 10);
    expect([img[last0 + 510], img[last0 + 511]]).toEqual([128, 1]);
    files.forEach((data, i) => expect(fs.read(`part${i}`)).toEqual(data));
    expect(() => fs.write({ name: "toobig", kind: "code", data: bytes(70000) })).toThrow(expect.objectContaining({ code: "unsupported" }));
  });

  it("keep the second entry in the second half of a sector, and SCREEN$ as its own type", () => {
    const fs = MgtFileSystem.blank();
    fs.write({ name: "a", kind: "code", data: bytes(10), start: 30000 });
    fs.write({ name: "screen", kind: "code", data: bytes(6912), start: 16384 });
    const second = fs.image().subarray(at(0, 1) + 256, at(0, 1) + 512);
    expect(second[0]).toBe(7);
    expect([second[13], second[14]]).toEqual([4, 2]);
    expect(fs.list().map((e) => [e.name, e.kind, e.start])).toEqual([["a", "code", 30000], ["screen", "code", 16384]]);
  });

  it("delete frees the entry and its sectors, rename rewrites the name, and names are checked", () => {
    const fs = MgtFileSystem.blank();
    fs.write({ name: "one", kind: "code", data: bytes(1000) });
    fs.write({ name: "two", kind: "code", data: bytes(10) });
    const free = fs.info().freeBytes;
    fs.delete("one");
    expect(fs.info().freeBytes).toBe(free + 2 * 510);
    fs.rename("two", "three");
    expect(fs.list().map((e) => e.name)).toEqual(["three"]);
    expect(() => fs.write({ name: "THREE", kind: "code", data: bytes(1) })).toThrow(expect.objectContaining({ code: "exists" }));
    expect(() => fs.write({ name: "eleven char", kind: "code", data: bytes(1) })).toThrow(expect.objectContaining({ code: "badName" }));
    // --- The deleted file's entry is reused
    fs.write({ name: "four", kind: "code", data: bytes(1) });
    expect(fs.image()[at(0, 1)]).toBe(4);
  });

  it("refuse a file larger than the disk, and a full directory", () => {
    const fs = MgtFileSystem.blank();
    for (let i = 0; i < 16; i++) fs.write({ name: `big${i}`, kind: "code", data: bytes(48 * 1024) });
    expect(() => fs.write({ name: "more", kind: "code", data: bytes(48 * 1024) })).toThrow(expect.objectContaining({ code: "diskFull" }));
    for (let i = 0; i < 16; i++) fs.delete(`big${i}`);
    for (let i = 0; i < 80; i++) fs.write({ name: `f${i}`, kind: "code", data: bytes(1) });
    expect(() => fs.write({ name: "f80", kind: "code", data: bytes(1) })).toThrow(expect.objectContaining({ code: "directoryFull" }));
  });

  it("is what the disk layer opens for a .mgt", () => {
    expect(openDiskFileSystem(new Uint8Array(MGT_IMAGE_SIZE), "game.MGT").system).toBe("mgt");
  });
});
