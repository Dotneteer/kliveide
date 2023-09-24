import "mocha";
import * as path from "path";
import * as fs from "fs";
import { expect } from "expect";
import { FloppyDiskFormat } from "@emu/machines/disk/FloppyDisk";
import { DskDiskReader } from "@emu/machines/disk/DskDiskReader";

describe("Floppy Disk", () => {
  it("readContents works #1", () => {
    const dsk = new DskDiskReader(readTestFile("blank180K.dsk"));

    expect(dsk.diskFormat).toEqual(FloppyDiskFormat.Cpc);
    expect(dsk.header.creator).toEqual("");
    expect(dsk.header.numTracks).toEqual(40);
    expect(dsk.header.numSides).toEqual(1);
    expect(dsk.header.trackSizes.length).toEqual(40);
    for (let i = 0; i < dsk.header.trackSizes.length; i++) {
      expect(dsk.header.trackSizes[i]).toEqual(4864);
    }
  });

  it("readContents works #2", () => {
    const dsk = new DskDiskReader(readTestFile("ltk.dsk"));

    expect(dsk.diskFormat).toEqual(FloppyDiskFormat.CpcExtended);
    expect(dsk.header.creator).toEqual("Moxon's Backup");
    expect(dsk.header.numTracks).toEqual(42);
    expect(dsk.header.numSides).toEqual(1);
    expect(dsk.header.trackSizes.length).toEqual(42);
    for (let i = 0; i < 12; i++) {
      expect(dsk.header.trackSizes[i]).toEqual(4864);
    }
    expect(dsk.header.trackSizes[12]).toEqual(4352);

    for (let i = 13; i < 42; i++) {
      expect(dsk.header.trackSizes[i]).toEqual(0);
    }
  });
});

export function readTestFile (filename: string): Uint8Array {
  const fullname = path.join(__dirname, "../testfiles", filename);
  return fs.readFileSync(fullname);
}
