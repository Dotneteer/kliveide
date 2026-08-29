import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";

import { applySectorChangesToDiskContents } from "@emu/machines/disk/disk-changes";
import { readDiskData } from "@emu/machines/disk/disk-readers";

describe("applySectorChangesToDiskContents", () => {
  it("patches sector data in a DSK image held in memory", () => {
    const contents = new Uint8Array(readTestFile("blank180K.dsk"));
    const disk = readDiskData(contents);
    const sector = disk.tracks[0].sectors[0];
    const replacement = new Uint8Array(sector.sectorData.length);
    replacement.fill(0x77);

    applySectorChangesToDiskContents(contents, new Map([[sector.R, replacement]]));

    const updatedDisk = readDiskData(contents);
    expect(updatedDisk.tracks[0].sectors[0].sectorData).toEqual(replacement);
  });
});

function readTestFile(filename: string): Uint8Array {
  const fullname = path.join(__dirname, "../testfiles", filename);
  return fs.readFileSync(fullname);
}
