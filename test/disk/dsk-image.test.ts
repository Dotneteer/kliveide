import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";

import { FloppyDiskFormat } from "@emu/abstractions/FloppyDiskFormat";
import { readDiskData } from "@emu/machines/disk/disk-readers";
import { canWriteStandard, writeDiskData } from "@emu/machines/disk/disk-writer";
import { DiskImageError } from "@emu/machines/disk/DiskImageError";
import { DSK_CORPUS, corpusDisk, pattern } from "./dskCorpus";

/*
 * The DSK reader and writer (.plans/DISK_IMAGES_AND_FILE_SYSTEMS_PLAN.md, A0/A1): real images round
 * trip byte for byte, the generated corpus round trips through the model, and broken images are
 * refused with a reason.
 */

const TESTFILES = path.join(__dirname, "../testfiles");
const read = (file: string) => new Uint8Array(fs.readFileSync(file));

const REAL_IMAGES = [
  path.join(TESTFILES, "blank180K.dsk"),
  path.join(TESTFILES, "ltk.dsk"),
  path.join(__dirname, "../z88dk/fixtures/tpl-spp3e/program.dsk"),
  path.join(__dirname, "../z88dk/fixtures/tpl-spp3e-build/program.dsk")
];

describe("DSK round trip", () => {
  it.each(REAL_IMAGES.map((f) => [path.relative(path.join(__dirname, ".."), f), f]))(
    "%s is written back byte for byte",
    (_name, file) => {
      const bytes = read(file);
      expect(Buffer.from(writeDiskData(readDiskData(bytes))).equals(Buffer.from(bytes))).toBe(true);
    }
  );

  it.each(DSK_CORPUS.map((d) => [d.name, d.note]))("corpus %s (%s) survives write, read, write", (name) => {
    const disk = corpusDisk(name);
    const first = writeDiskData(disk);
    const reread = readDiskData(first);
    const second = writeDiskData(reread);
    expect(Buffer.from(second).equals(Buffer.from(first))).toBe(true);

    // --- Every sector reads back with its own bytes, status and ID
    expect(reread.tracks.length).toBe(disk.tracks.length);
    disk.tracks.forEach((track, t) => {
      const back = reread.tracks[t];
      expect(back.unformatted).toBe(track.unformatted);
      expect(back.sectors.map((s) => [s.C, s.H, s.R, s.N, s.SR1, s.SR2, s.actualLength])).toEqual(
        track.sectors.map((s) => [s.C, s.H, s.R, s.N, s.SR1, s.SR2, s.actualLength])
      );
      back.sectors.forEach((s, i) => {
        expect(s.sectorData).toEqual(track.sectors[i].sectorData);
        expect(first.subarray(s.sectorDataPosition, s.sectorDataPosition + s.actualLength)).toEqual(s.sectorData);
      });
    });
  });
});

describe("DSK reader", () => {
  it("reads the standard blank disk", () => {
    const dsk = readDiskData(read(path.join(TESTFILES, "blank180K.dsk")));
    expect(dsk.diskFormat).toBe(FloppyDiskFormat.Cpc);
    expect(dsk.standardTrackSize).toBe(0x1300);
    expect(dsk.tracks[0].sectors.map((s) => s.R)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
    expect(dsk.tracks[0].sectors.every((s) => s.actualLength === 512)).toBe(true);
  });

  it("opens an 80-track double-sided disk (no 42-track limit)", () => {
    const dsk = readDiskData(writeDiskData(corpusDisk("ds80")));
    expect(dsk.numTracks).toBe(80);
    expect(dsk.numSides).toBe(2);
    expect(dsk.tracks[159].sectors[8].sectorData).toEqual(pattern(79, 1, 9, 512));
  });

  it("finds weak sectors stored as several copies", () => {
    const track = readDiskData(writeDiskData(corpusDisk("weak-sectors"))).tracks[4];
    expect(track.sectors.map((s) => s.copies)).toEqual([1, 2, 3, 1, 1, 1, 1, 1, 1]);
    expect(track.sectors.map((s) => s.multipleWeakSectors)).toEqual([false, true, true, false, false, false, false, false, false]);
    expect(track.sectors[2].sectorData.subarray(1024, 1536)).toEqual(pattern(4, 0, 3, 512, 2));
  });

  it("keeps a sector stored shorter than its size code as one copy", () => {
    const sector = readDiskData(writeDiskData(corpusDisk("short-sector"))).tracks[3].sectors[4];
    expect(sector.actualLength).toBe(256);
    expect(sector.copies).toBe(1);
  });

  it("reads a track whose Track-Info runs past 256 bytes", () => {
    const disk = readDiskData(writeDiskData(corpusDisk("many-sectors")));
    const track = disk.tracks[0];
    expect(track.sectors.length).toBe(32);
    // --- 24 + 32 * 8 = 280 header bytes: the data starts at 512
    expect(track.sectors[0].sectorDataPosition).toBe(0x100 + 0x200);
    expect(track.sectors[31].sectorData).toEqual(pattern(0, 0, 32, 128));
  });

  it("reads a standard track with one 6K sector (N = 6)", () => {
    const disk = readDiskData(writeDiskData(corpusDisk("big-sector")));
    expect(disk.standardTrackSize).toBe(0x1900);
    expect(disk.tracks[2].sectors[0].actualLength).toBe(0x1800);
  });

  it("keeps an Offset-Info block after the last track", () => {
    const disk = readDiskData(writeDiskData(corpusDisk("offset-info")));
    expect(new TextDecoder().decode(disk.trailer!.subarray(0, 13))).toBe("Offset-Info\r\n");
  });

  it("marks unformatted tracks", () => {
    const disk = readDiskData(writeDiskData(corpusDisk("unformatted-tracks")));
    expect(disk.tracks.map((t) => t.unformatted).lastIndexOf(false)).toBe(37);
    expect(disk.tracks[39]).toMatchObject({ unformatted: true, trackNumber: 39, sectors: [] });
  });
});

describe("DSK writer", () => {
  it("refuses a model the standard container cannot hold", () => {
    const disk = { ...corpusDisk("mixed-sizes"), diskFormat: FloppyDiskFormat.Cpc };
    expect(canWriteStandard(disk)).toBe(false);
    expect(() => writeDiskData(disk)).toThrow(DiskImageError);
    expect(canWriteStandard(corpusDisk("plus3-format0"))).toBe(true);
  });

  it("updates each sector's data position to the new file", () => {
    const disk = corpusDisk("mixed-sizes");
    const bytes = writeDiskData(disk);
    const s = disk.tracks[1].sectors[2];
    expect(bytes.subarray(s.sectorDataPosition, s.sectorDataPosition + 1024)).toEqual(pattern(1, 0, 3, 1024));
  });
});

describe("broken DSK images", () => {
  const cases: [string, string][] = [
    ["missingTrackInfo1.dsk", "missingTrackInfo"],
    ["missingTrackInfo2.dsk", "missingTrackInfo"],
    ["sideError.dsk", "badSides"],
    ["trackError.dsk", "truncated"]
  ];
  it.each(cases)("%s is refused (%s)", (file, code) => {
    let error: unknown;
    try {
      readDiskData(read(path.join(TESTFILES, file)));
    } catch (err) {
      error = err;
    }
    expect(error).toBeInstanceOf(DiskImageError);
    expect((error as DiskImageError).code).toBe(code);
  });

  it("refuses a file that is not a DSK", () => {
    expect(() => readDiskData(new Uint8Array(512))).toThrow(expect.objectContaining({ code: "notDsk" }));
  });

  it("refuses a file cut inside the Disk-Info block", () => {
    const bytes = read(path.join(TESTFILES, "blank180K.dsk")).subarray(0, 100);
    expect(() => readDiskData(bytes)).toThrow(expect.objectContaining({ code: "truncated" }));
  });
});
