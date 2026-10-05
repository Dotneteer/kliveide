import { describe, expect, it } from "vitest";

import {
  addTrdFile,
  canonicalSectorToTrdSector,
  canonicalToTrd,
  createBlankTrd,
  isSclImage,
  readTrdCatalog,
  readTrdDiskInfo,
  readTrdFileData,
  sclToTrd,
  trdBasicFile,
  trdCodeFile,
  trdFileOffsetToCanonical,
  trdGeometry,
  trdosImageToCanonical,
  trdToCanonical,
  trdToScl,
  TRD_TRACK_SIZE
} from "@emu/machines/disk/trd/trdImage";

/*
 * TR-DOS images (`.plans/BETA128_TRDOS_PLAN.md` Phase 3). The layout facts, with sources, are in §9
 * of the plan: Kaitai Struct's `tr_dos_image.ksy` (CC0) and the Sinclair Wiki.
 */

const pattern = (length: number, seed: number) => Uint8Array.from({ length }, (_, i) => (i * 7 + seed) & 0xff);

describe("blank disks", () => {
  it("formats an 80-track double-sided disk as TR-DOS does", () => {
    const trd = createBlankTrd({ cylinders: 80, sides: 2 }, "KLIVE");
    expect(trd.length).toBe(80 * 2 * TRD_TRACK_SIZE);
    const info = readTrdDiskInfo(trd);
    // --- 159 x 16 = 2544 free sectors on 80/DS (the Beta 128 user manual's figure)
    expect(info).toMatchObject({ isTrDos: true, diskType: 0x16, fileCount: 0, freeSectors: 2544, firstFreeTrack: 1, firstFreeSector: 0, label: "KLIVE" });
    expect(readTrdCatalog(trd)).toEqual([]);
  });

  it.each([
    [{ cylinders: 40, sides: 2 }, 0x17, 79 * 16],
    [{ cylinders: 80, sides: 1 }, 0x18, 79 * 16],
    [{ cylinders: 40, sides: 1 }, 0x19, 39 * 16]
  ])("types %o as $%s with %i free sectors", (geometry, type, free) => {
    const trd = createBlankTrd(geometry);
    expect(readTrdDiskInfo(trd)).toMatchObject({ diskType: type, freeSectors: free });
    expect(trdGeometry(trd)).toEqual(geometry);
  });
});

describe("files", () => {
  it("adds files from the first free sector and keeps the counters", () => {
    let trd = createBlankTrd({ cylinders: 80, sides: 2 });
    const code = pattern(300, 1);
    trd = addTrdFile(trd, trdCodeFile("prog", 32768, code));
    trd = addTrdFile(trd, trdBasicFile("boot", pattern(100, 2), 10));
    const files = readTrdCatalog(trd);
    expect(files.map((f) => [f.name, f.type, f.param1, f.param2, f.sectors, f.firstTrack, f.firstSector])).toEqual([
      ["prog", "C", 32768, 300, 2, 1, 0],
      ["boot", "B", 100, 100, 1, 1, 2]
    ]);
    expect(readTrdFileData(trd, files[0]).subarray(0, 300)).toEqual(code);
    // --- BASIC: the program, then $80 $AA and the autostart line, which the lengths do not count
    expect(Array.from(readTrdFileData(trd, files[1]).subarray(100, 104))).toEqual([0x80, 0xaa, 10, 0]);
    expect(readTrdDiskInfo(trd)).toMatchObject({ fileCount: 2, freeSectors: 2544 - 3, firstFreeTrack: 1, firstFreeSector: 3 });
  });

  it("refuses a file that does not fit", () => {
    const trd = createBlankTrd({ cylinders: 40, sides: 1 });
    expect(() => addTrdFile(trd, trdCodeFile("big", 0, new Uint8Array(39 * 16 * 256 + 1)))).toThrow(/full/);
  });
});

describe("the core's canonical layout", () => {
  it("interleaves the sides of a double-sided file and maps sectors back", () => {
    const trd = createBlankTrd({ cylinders: 80, sides: 2 });
    trd.set(pattern(256, 9), 3 * TRD_TRACK_SIZE + 5 * 256); // --- logical track 3 = cylinder 1, side 1
    const disk = trdToCanonical(trd);
    expect(disk).toMatchObject({ cylinders: 80, sides: 2 });
    expect(trdFileOffsetToCanonical(3 * TRD_TRACK_SIZE + 5 * 256, disk)).toBe((1 * 2 + 1) * TRD_TRACK_SIZE + 5 * 256);
    expect(disk.data.subarray((1 * 2 + 1) * TRD_TRACK_SIZE + 5 * 256, (1 * 2 + 1) * TRD_TRACK_SIZE + 6 * 256)).toEqual(pattern(256, 9));
    expect(canonicalSectorToTrdSector((1 * 2 + 1) * 16 + 5, disk)).toBe(3 * 16 + 5);
    expect(canonicalToTrd(disk)).toEqual(trd);
  });

  it("puts a single-sided file's tracks on side 0 and has no file sector for side 1", () => {
    const trd = createBlankTrd({ cylinders: 40, sides: 1 });
    trd.set(pattern(256, 3), 2 * TRD_TRACK_SIZE); // --- logical track 2 = cylinder 2
    const disk = trdToCanonical(trd);
    expect(disk.data.subarray(2 * 2 * TRD_TRACK_SIZE, 2 * 2 * TRD_TRACK_SIZE + 256)).toEqual(pattern(256, 3));
    expect(canonicalSectorToTrdSector(2 * 2 * 16, disk)).toBe(2 * 16);
    expect(canonicalSectorToTrdSector((2 * 2 + 1) * 16, disk)).toBeUndefined();
    expect(canonicalToTrd(disk)).toEqual(trd);
  });

  it("sizes an unformatted image by its length, double-sided", () => {
    expect(trdGeometry(new Uint8Array(40 * 2 * TRD_TRACK_SIZE))).toEqual({ cylinders: 40, sides: 2 });
    expect(trdGeometry(new Uint8Array(100))).toEqual({ cylinders: 1, sides: 2 });
  });
});

describe("SCL", () => {
  it("round-trips the live files through an SCL with its checksum", () => {
    let trd = createBlankTrd({ cylinders: 80, sides: 2 });
    trd = addTrdFile(trd, trdCodeFile("one", 24000, pattern(700, 4)));
    trd = addTrdFile(trd, trdBasicFile("boot", pattern(50, 5), 1));
    const scl = trdToScl(trd);
    expect(isSclImage(scl)).toBe(true);
    expect(isSclImage(trd)).toBe(false);
    const back = sclToTrd(scl);
    expect(back.warnings).toEqual([]);
    expect(readTrdCatalog(back.trd)).toEqual(readTrdCatalog(trd));
    expect(readTrdFileData(back.trd, readTrdCatalog(back.trd)[0])).toEqual(readTrdFileData(trd, readTrdCatalog(trd)[0]));
  });

  it("warns on a wrong or missing checksum, and refuses a truncated file", () => {
    const trd = addTrdFile(createBlankTrd({ cylinders: 80, sides: 2 }), trdCodeFile("x", 0, pattern(10, 1)));
    const scl = trdToScl(trd);
    const bad = new Uint8Array(scl);
    bad[bad.length - 1] ^= 0xff;
    expect(sclToTrd(bad).warnings).toEqual(["The SCL checksum does not match its contents"]);
    expect(sclToTrd(scl.subarray(0, scl.length - 4)).warnings).toEqual(["The SCL file has no checksum"]);
    expect(() => sclToTrd(scl.subarray(0, 30))).toThrow(/truncated/);
  });

  it("opens either format in the core's layout, saying which", () => {
    const trd = addTrdFile(createBlankTrd({ cylinders: 80, sides: 2 }), trdCodeFile("x", 0, pattern(10, 1)));
    expect(trdosImageToCanonical(trd).scl).toBe(false);
    const fromScl = trdosImageToCanonical(trdToScl(trd));
    expect(fromScl.scl).toBe(true);
    expect(canonicalToTrd(fromScl)).toEqual(trd);
  });
});
