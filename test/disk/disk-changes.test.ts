import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";

import {
  applySectorChangesToDiskContents,
  dskSectorKey,
  dskSectorWrites,
  splitDskSectorKey
} from "@emu/machines/disk/disk-changes";
import { readDiskData } from "@emu/machines/disk/disk-readers";
import { writeDiskData } from "@emu/machines/disk/disk-writer";
import { createBlankTrd, TRD_SECTOR_SIZE } from "@emu/machines/disk/trd/trdImage";
import { corpusDisk, pattern } from "./dskCorpus";

/*
 * Disk write-back by physical sector position (.plans/DISK_IMAGES_AND_FILE_SYSTEMS_PLAN.md, A2):
 * the cases where the old `track * 100 + R` key wrote to the wrong place.
 */

const fill = (length: number, value: number) => new Uint8Array(length).fill(value);

describe("applySectorChangesToDiskContents", () => {
  it("patches sector data in a DSK image held in memory", () => {
    const contents = new Uint8Array(fs.readFileSync(path.join(__dirname, "../testfiles/blank180K.dsk")));
    const replacement = fill(512, 0x77);
    applySectorChangesToDiskContents(contents, new Map([[dskSectorKey(0, 0), replacement]]));
    expect(readDiskData(contents).tracks[0].sectors[0].sectorData).toEqual(replacement);
  });

  it("finds a CPC data sector (R = $C9) on its own track, not the next one", () => {
    const contents = writeDiskData(corpusDisk("cpc-data"));
    applySectorChangesToDiskContents(contents, new Map([[dskSectorKey(3, 8), fill(512, 0x5a)]]));
    const disk = readDiskData(contents);
    expect(disk.tracks[3].sectors[8].R).toBe(0xc9);
    expect(disk.tracks[3].sectors[8].sectorData).toEqual(fill(512, 0x5a));
    // --- Under the old key ($C9 = 201 = two tracks on) track 5 would have taken the write
    expect(disk.tracks[5].sectors[0].sectorData).toEqual(pattern(5, 0, 0xc1, 512));
  });

  it("tells apart two sectors with the same ID", () => {
    const contents = writeDiskData(corpusDisk("duplicate-ids"));
    applySectorChangesToDiskContents(contents, new Map([[dskSectorKey(5, 3), fill(512, 0x33)]]));
    const track = readDiskData(contents).tracks[5];
    expect(track.sectors[2].sectorData).toEqual(pattern(5, 0, 3, 512, 0));
    expect(track.sectors[3].sectorData).toEqual(fill(512, 0x33));
  });

  it("writes only a sector's own bytes on a disk of mixed sizes", () => {
    const contents = writeDiskData(corpusDisk("mixed-sizes"));
    // --- A 1024-byte buffer written to the 256-byte sector must not spill into its neighbour
    applySectorChangesToDiskContents(contents, new Map([[dskSectorKey(1, 0), fill(1024, 0x11)]]));
    const track = readDiskData(contents).tracks[1];
    expect(track.sectors[0].sectorData).toEqual(fill(256, 0x11));
    expect(track.sectors[1].sectorData).toEqual(pattern(1, 0, 2, 512));
  });

  it("writes every copy of a weak sector", () => {
    const contents = writeDiskData(corpusDisk("weak-sectors"));
    applySectorChangesToDiskContents(contents, new Map([[dskSectorKey(4, 2), fill(512, 0x99)]]));
    const sector = readDiskData(contents).tracks[4].sectors[2];
    expect(sector.copies).toBe(3);
    expect(sector.sectorData).toEqual(fill(1536, 0x99));
  });

  it("patches a .trd image by file sector", () => {
    const contents = createBlankTrd({ cylinders: 80, sides: 2 }, "TEST");
    applySectorChangesToDiskContents(contents, new Map([[40, fill(TRD_SECTOR_SIZE, 0x42)]]));
    expect(contents.subarray(40 * 256, 41 * 256)).toEqual(fill(256, 0x42));
    expect(contents[41 * 256]).toBe(0);
  });

  it("refuses a change to a sector the image does not have", () => {
    const contents = writeDiskData(corpusDisk("plus3-format0"));
    expect(() => applySectorChangesToDiskContents(contents, new Map([[dskSectorKey(0, 20), fill(512, 1)]]))).toThrow(
      expect.objectContaining({ code: "noSector" })
    );
  });
});

describe("DSK sector keys", () => {
  it("pack and unpack every track and sector index the format allows", () => {
    for (const [trackIndex, sectorIndex] of [[0, 0], [1, 255], [203, 31]]) {
      expect(splitDskSectorKey(dskSectorKey(trackIndex, sectorIndex))).toEqual({ trackIndex, sectorIndex });
    }
  });

  it("dskSectorWrites gives a position per stored copy", () => {
    const disk = readDiskData(writeDiskData(corpusDisk("weak-sectors")));
    const writes = dskSectorWrites(disk, new Map([[dskSectorKey(4, 1), fill(512, 7)]]));
    const base = disk.tracks[4].sectors[1].sectorDataPosition;
    expect(writes.map((w) => w.position)).toEqual([base, base + 512]);
  });
});
