import "mocha";
import * as path from "path";
import * as fs from "fs";
import { expect } from "expect";
import { FloppyDisk } from "@emu/machines/disk/FloppyDiskNew";
import { FloppyDiskFormat } from "@emu/abstractions/FloppyDiskFormat";
import { DiskError } from "@emu/abstractions/DiskError";

describe("Floppy Disk", () => {
  it("detects CPC format", () => {
    const diskData = readTestFile("blank180K.dsk");
    const fd = new FloppyDisk(diskData);

    expect(fd.diskFormat).toEqual(FloppyDiskFormat.Cpc);
    expect(fd.tracksPerSide).toEqual(40);
    expect(fd.sides).toEqual(1);
    expect(fd.status).toEqual(DiskError.OK);
  });

  it("detects Extended CPC format", () => {
    const diskData = readTestFile("ltk.dsk");
    const fd = new FloppyDisk(diskData);

    expect(fd.diskFormat).toEqual(FloppyDiskFormat.CpcExtended);
    expect(fd.tracksPerSide).toEqual(42);
    expect(fd.sides).toEqual(1);
    expect(fd.status).toEqual(DiskError.OK);
  });

  it("detects geometry error (track)", () => {
    const diskData = readTestFile("trackError.dsk");
    const fd = new FloppyDisk(diskData);

    expect(fd.status).toEqual(DiskError.GEOMETRY_ISSUE);
  });

  it("detects geometry error (side)", () => {
    const diskData = readTestFile("sideError.dsk");
    const fd = new FloppyDisk(diskData);

    expect(fd.status).toEqual(DiskError.GEOMETRY_ISSUE);
  });

  it("detects missing track info #1", () => {
    const diskData = readTestFile("missingTrackInfo1.dsk");
    const fd = new FloppyDisk(diskData);

    expect(fd.status).toEqual(DiskError.MISSING_TRACK_INFO);
  });

  it("detects missing track info #2", () => {
    const diskData = readTestFile("missingTrackInfo2.dsk");
    const fd = new FloppyDisk(diskData);

    expect(fd.status).toEqual(DiskError.MISSING_TRACK_INFO);
  });

});

export function readTestFile (filename: string): Uint8Array {
  const fullname = path.join(__dirname, "../testfiles", filename);
  return fs.readFileSync(fullname);
}
