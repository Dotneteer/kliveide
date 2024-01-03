import "mocha";
import * as path from "path";
import * as fs from "fs";
import { expect } from "expect";
import { FloppyDiskFormat } from "@emu/abstractions/FloppyDiskFormat";
import { readDiskData } from "@emu/machines/disk/disk-readers";

describe("readDiskData", () => {
  it("Works with CPC #1", () => {
    const dsk = readDiskData(readTestFile("blank180K.dsk"));

    expect(dsk.diskFormat).toEqual(FloppyDiskFormat.Cpc);
    expect(dsk.creator).toEqual("");
    expect(dsk.numTracks).toEqual(40);
    expect(dsk.numSides).toEqual(1);
    expect(dsk.tracks.length).toEqual(40);
  });

  it("Works with Extended CPC #1", () => {
    const dsk = readDiskData(readTestFile("ltk.dsk"));

    expect(dsk.diskFormat).toEqual(FloppyDiskFormat.CpcExtended);
    expect(dsk.creator).toEqual("Moxon's Backup");
    expect(dsk.numTracks).toEqual(42);
    expect(dsk.numSides).toEqual(1);
    expect(dsk.tracks.length).toEqual(42);
  });
});

export function readTestFile (filename: string): Uint8Array {
  const fullname = path.join(__dirname, "../testfiles", filename);
  return fs.readFileSync(fullname);
}
