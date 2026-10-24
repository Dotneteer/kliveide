import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";

import { Plus3DosFileSystem, parseHeader, withHeader } from "@common/diskfs/plus3dos";
import { DiskFsError } from "@common/diskfs/types";
import { createBlankDsk } from "@emu/machines/disk/blank-dsk";
import { buildDisk, sectorRun } from "@emu/machines/disk/disk-builder";
import { writeDiskData } from "@emu/machines/disk/disk-writer";
import { PRINT_42 } from "./fixtures";

/*
 * +3DOS (.plans/DISK_IMAGES_AND_FILE_SYSTEMS_PLAN.md, B1/B2), without a machine: Klive's own
 * reads of what Klive writes. What the +3 itself makes of them is
 * `test/sp128-hw/plus3-disk/plus3dos-oracle.test.ts`.
 */


const bytes = (n: number, seed = 0) => Uint8Array.from({ length: n }, (_, i) => (i * 7 + seed) & 0xff);

describe("+3DOS on blank disks", () => {
  it.each([
    ["ss", "+3", 173 * 1024],
    ["ds", "PCW/+3 double-sided", 353 * 1024],
    ["dse80", "PCW/+3 double-sided", 706 * 1024]
  ] as const)("%s: an empty disk of the right size", (type, format, free) => {
    const fs3 = new Plus3DosFileSystem(createBlankDsk(type));
    expect(fs3.info()).toMatchObject({ system: "+3DOS", format, freeBytes: free, usedEntries: 0 });
    expect(fs3.list()).toEqual([]);
  });

  it("reads the CPC formats from their sector IDs", () => {
    const data = writeDiskData(buildDisk({ cylinders: 40, sides: 1, track: () => ({ sectors: sectorRun(0xc1, 9) }) }));
    expect(new Plus3DosFileSystem(data).info()).toMatchObject({ format: "CPC data", freeBytes: 178 * 1024 });
    const system = writeDiskData(buildDisk({ cylinders: 40, sides: 1, track: () => ({ sectors: sectorRun(0x41, 9) }) }));
    expect(new Plus3DosFileSystem(system).info()).toMatchObject({ format: "CPC system", freeBytes: 169 * 1024 });
  });

  it.each(["ss", "dse80"] as const)("%s: files written read back with their headers", (type) => {
    const fs3 = new Plus3DosFileSystem(createBlankDsk(type));
    fs3.write({ name: "prog", kind: "basic", data: PRINT_42, start: 10 });
    fs3.write({ name: "pic.scr", kind: "code", data: bytes(6912), start: 16384 });
    fs3.write({ name: "notes.txt", kind: "raw", data: bytes(300, 3) });
    const again = new Plus3DosFileSystem(fs3.image());
    expect(again.list().map((f) => [f.name, f.kind, f.size, f.start])).toEqual([
      ["PROG", "basic", 14, 10],
      ["PIC.SCR", "code", 6912, 16384],
      ["NOTES.TXT", "raw", 384, undefined]
    ]);
    expect(again.read("prog")).toEqual(PRINT_42);
    expect(again.read("PIC.SCR")).toEqual(bytes(6912));
    expect(again.read("notes.txt").subarray(0, 300)).toEqual(bytes(300, 3));
    expect(again.list()[0].variablesOffset).toBe(14);
  });

  it("spreads a big file over several directory entries", () => {
    const fs3 = new Plus3DosFileSystem(createBlankDsk("ss"));
    const big = bytes(40_000, 5);
    fs3.write({ name: "big", kind: "code", data: big, start: 24000 });
    const again = new Plus3DosFileSystem(fs3.image());
    expect(again.read("big")).toEqual(big);
    expect(again.info().usedEntries).toBe(3);
    expect(again.info().freeBytes).toBe((173 - 40) * 1024);
  });

  it("deletes, renames, sets attributes and user areas", () => {
    const fs3 = new Plus3DosFileSystem(createBlankDsk("ss"));
    fs3.write({ name: "one", kind: "code", data: bytes(100) });
    fs3.write({ name: "two", kind: "code", data: bytes(100) });
    fs3.rename("one", "first.bin");
    fs3.setAttributes("two", { readOnly: true, system: true });
    expect(() => fs3.delete("two")).toThrow(DiskFsError);
    fs3.setAttributes("two", { readOnly: false });
    fs3.delete("two");
    fs3.setUser("first.bin", 3);
    const again = new Plus3DosFileSystem(fs3.image());
    expect(again.list().map((f) => [f.name, f.user])).toEqual([["FIRST.BIN", 3]]);
    expect(again.list({ deleted: true }).find((f) => f.deleted)?.name).toBe("TWO");
    expect(again.info().freeBytes).toBe(172 * 1024);
  });

  it("refuses what +3DOS cannot hold", () => {
    const fs3 = new Plus3DosFileSystem(createBlankDsk("ss"));
    expect(() => fs3.write({ name: "much too long", kind: "raw", data: bytes(1) })).toThrow(expect.objectContaining({ code: "badName" }));
    fs3.write({ name: "a", kind: "raw", data: bytes(1) });
    expect(() => fs3.write({ name: "A", kind: "raw", data: bytes(1) })).toThrow(expect.objectContaining({ code: "exists" }));
    expect(() => fs3.write({ name: "huge", kind: "raw", data: bytes(200_000) })).toThrow(expect.objectContaining({ code: "diskFull" }));
    for (let i = 0; i < 63; i++) fs3.write({ name: `f${i}`, kind: "raw", data: bytes(1) });
    expect(() => fs3.write({ name: "last", kind: "raw", data: bytes(1) })).toThrow(expect.objectContaining({ code: "directoryFull" }));
    expect(() => fs3.read("nothere")).toThrow(expect.objectContaining({ code: "notFound" }));
  });

  it("maps every sector to its role", () => {
    const fs3 = new Plus3DosFileSystem(createBlankDsk("ss"));
    fs3.write({ name: "code", kind: "code", data: bytes(2000) });
    const roles = fs3.layout();
    expect(roles.get(0 * 256 + 0)).toEqual({ role: "system" });
    expect(roles.get(1 * 256 + 0)).toEqual({ role: "directory" });
    expect(roles.get(1 * 256 + 3)).toEqual({ role: "directory" });
    // --- Block 2 (the first after the directory) is the file's: track 1, sectors 5 and 6
    expect(roles.get(1 * 256 + 4)).toEqual({ role: "file", file: "CODE" });
    expect([...roles.values()].filter((r) => r.role === "file").length).toBe(6);
    expect(roles.get(39 * 256 + 0)).toEqual({ role: "free" });
    // --- 175.5 blocks of data: the last sector is half a block, which +3DOS never uses
    expect(roles.get(39 * 256 + 8)).toEqual({ role: "unused" });
  });
});

describe("PLUS3DOS header", () => {
  it("round trips and checks its checksum", () => {
    const file = withHeader({ name: "x", kind: "code", data: bytes(10), start: 0x8000 });
    expect(parseHeader(file)).toMatchObject({ kind: "code", length: 10, param1: 0x8000, fileLength: 138 });
    file[127] ^= 1;
    expect(parseHeader(file)).toBeUndefined();
  });
});

describe("+3DOS on disks made elsewhere", () => {
  it.each(["tpl-spp3e", "tpl-spp3e-build"])("lists the file z88dk's appmake put on %s", (fixture) => {
    const image = new Uint8Array(fs.readFileSync(path.join(__dirname, `../z88dk/fixtures/${fixture}/program.dsk`)));
    const files = new Plus3DosFileSystem(image).list();
    expect(files.length).toBeGreaterThan(0);
    for (const file of files) {
      expect(file.size).toBeGreaterThan(0);
    }
  });

  it("lists ltk.dsk's DISK boot program, as the +3's CAT does", () => {
    const image = new Uint8Array(fs.readFileSync(path.join(__dirname, "../testfiles/ltk.dsk")));
    const files = new Plus3DosFileSystem(image).list();
    expect(files.filter((f) => !f.attributes.system).map((f) => f.name)).toContain("DISK");
    expect(new Plus3DosFileSystem(image).info().freeBytes).toBe(124 * 1024);
  });
});
